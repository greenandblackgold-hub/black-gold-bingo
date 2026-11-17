import crypto from 'node:crypto';
import { hashSecret, signJwt, verifyJwt, verifySecret, randomInt, randomToken, hmacHex, safeEqual } from '../util/crypto.js';
import { HttpError, RepoError } from '../util/errors.js';

const TOKEN_TTL = 7 * 24 * 3600;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

/** Accepts 09XXXXXXXX, 07XXXXXXXX, +2519XXXXXXXX, 2519XXXXXXXX and returns the local form, or null. */
export function normalizePhone(input) {
  const digits = String(input ?? '').replace(/[\s()-]/g, '').replace(/^\+/, '');
  const m = digits.match(/^(?:251|0)?([79]\d{8})$/);
  return m ? `0${m[1]}` : null;
}

export const publicUser = (u) => ({ id: u.id, phone: u.phone, name: u.name, role: u.role, phoneVerified: u.phoneVerified === true, balance: u.balance / 100 });

export function createAuthService({ repo, config }) {
  const otpKey = crypto.createHash('sha256').update('black-gold-phone-otp:v1:' + config.jwtSecret).digest();
  const encryptOtp = (code) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', otpKey, iv);
    const encryptedCode = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
    return { encryptedCode: encryptedCode.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
  };
  const decryptOtp = (c) => {
    const decipher = crypto.createDecipheriv('aes-256-gcm', otpKey, Buffer.from(c.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(c.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(c.encryptedCode, 'base64')), decipher.final()]).toString('utf8');
  };
  const issue = (user) => ({ token: signJwt({ sub: user.id, role: user.role }, config.jwtSecret, TOKEN_TTL), user: publicUser(user) });

  return {
    async requestPhoneVerification(user) {
      if (user.phoneVerified) return { alreadyVerified: true };
      const previous = await repo.getPhoneVerification(user.id);
      const now = new Date();
      if (previous && !previous.consumedAt && previous.createdAt && now - new Date(previous.createdAt) < 60_000) {
        throw new HttpError(429, 'otp_wait', 'Please wait one minute before requesting another code.');
      }
      const code = String(randomInt(1_000_000)).padStart(6, '0');
      const id = randomToken(16);
      const codeHash = hmacHex(config.jwtSecret, user.id + ':' + id + ':' + code);
      await repo.savePhoneVerification({
        id, userId: user.id, codeHash, ...encryptOtp(code), attempts: 0,
        createdAt: now, expiresAt: new Date(now.getTime() + 5 * 60_000), consumedAt: null,
      });
      return { requested: true, expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString() };
    },

    async verifyPhoneVerification(user, input) {
      const code = String(input ?? '').trim();
      if (!/^\\d{6}$/.test(code)) throw new HttpError(400, 'invalid_otp', 'Enter the six-digit code.');
      const challenge = await repo.getPhoneVerification(user.id);
      const now = new Date();
      if (!challenge || challenge.consumedAt || new Date(challenge.expiresAt) <= now || challenge.attempts >= 5) {
        throw new HttpError(400, 'otp_expired', 'The code expired. Request a new code.');
      }
      const candidate = hmacHex(config.jwtSecret, user.id + ':' + challenge.id + ':' + code);
      if (!safeEqual(candidate, challenge.codeHash)) {
        await repo.incrementPhoneVerificationAttempts(user.id, now);
        throw new HttpError(400, 'invalid_otp', 'The code is incorrect.');
      }
      const consumed = await repo.consumePhoneVerification(user.id, candidate, now);
      if (!consumed) throw new HttpError(409, 'otp_used', 'The code is expired or has already been used.');
      return publicUser(await repo.findUserById(user.id));
    },

    async listPendingPhoneVerifications() {
      const rows = await repo.listPendingPhoneVerifications(new Date());
      return rows.map(c => ({
        id: c.id, userId: c.userId, name: c.name, phone: c.phone,
        code: decryptOtp(c), expiresAt: new Date(c.expiresAt).toISOString(),
        attempts: c.attempts, createdAt: new Date(c.createdAt).toISOString(),
      }));
    },

    async register({ phone, name, pin, pinConfirm }) {
      if (!config.registrationEnabled) throw new HttpError(503, 'registration_disabled', 'New registrations are temporarily disabled until phone verification is ready.');
      const p = normalizePhone(phone);
      if (!p) throw new HttpError(400, 'invalid_phone', 'Enter a valid Ethiopian mobile number');
      const cleanName = String(name ?? '').trim().slice(0, 60);
      if (cleanName.length < 2) throw new HttpError(400, 'invalid_name', 'Enter your name');
      if (!/^\d{6}$/.test(String(pin ?? ''))) throw new HttpError(400, 'invalid_pin', 'PIN must be 6 digits');
      if (String(pin) !== String(pinConfirm ?? '')) throw new HttpError(400, 'pin_mismatch', 'PIN confirmation does not match');
      try {
        const user = await repo.createUser({ phone: p, name: cleanName, pinHash: await hashSecret(String(pin)), role: 'player' });
        return issue(user);
      } catch (e) {
        if (e instanceof RepoError && e.code === 'PHONE_TAKEN') throw new HttpError(409, 'phone_taken', 'This number is already registered');
        throw e;
      }
    },

    async login({ phone, pin }) {
      const p = normalizePhone(phone);
      const user = p ? await repo.findUserByPhone(p) : null;
      // Same error for unknown number and wrong PIN: do not reveal which numbers exist.
      const bad = new HttpError(401, 'invalid_credentials', 'Wrong phone number or PIN');
      if (!user) throw bad;
      if (user.lockedUntil && user.lockedUntil > Date.now()) throw new HttpError(429, 'locked', 'Too many attempts. Try again later.');
      if (!(await verifySecret(String(pin ?? ''), user.pinHash))) {
        const fails = (user.failedLogins ?? 0) + 1;
        await repo.updateUser(user.id, fails >= MAX_FAILS ? { failedLogins: 0, lockedUntil: Date.now() + LOCK_MS } : { failedLogins: fails });
        throw bad;
      }
      if (user.failedLogins || user.lockedUntil) await repo.updateUser(user.id, { failedLogins: 0, lockedUntil: 0 });
      return issue(user);
    },

    /** Resolves a Bearer token to a fresh user record (role and balance always come from the database). */
    async authenticate(token) {
      const payload = token ? verifyJwt(token, config.jwtSecret) : null;
      if (!payload) return null;
      return repo.findUserById(payload.sub);
    },

    /**
     * Makes sure the owner account exists with the PIN from the ADMIN_PHONE / ADMIN_PIN settings.
     * Safe to run on every start: creates it once, then only changes it if the settings changed.
     */
    async ensureAdmin({ phone, pin, name }) {
      const p = normalizePhone(phone);
      if (!p || !/^\d{6}$/.test(String(pin))) return 'invalid';
      const existing = await repo.findUserByPhone(p);
      if (!existing) {
        await repo.createUser({ phone: p, name: name || 'Owner', pinHash: await hashSecret(String(pin)), role: 'admin' });
        return 'created';
      }
      if (existing.role !== 'admin') {
        throw new Error('ADMIN_PHONE already belongs to a player account. Use a separate owner phone number.');
      }
      const patch = {};
      if (!(await verifySecret(String(pin), existing.pinHash))) patch.pinHash = await hashSecret(String(pin));
      if (!Object.keys(patch).length) return 'ok';
      await repo.updateUser(existing.id, { ...patch, failedLogins: 0, lockedUntil: 0 });
      return 'updated';
    },

    async createAdmin({ phone, name, pin }) {
      const p = normalizePhone(phone);
      if (!p) throw new Error('Invalid phone');
      if (!/^\d{6}$/.test(String(pin))) throw new Error('PIN must be 6 digits');
      return repo.createUser({ phone: p, name, pinHash: await hashSecret(String(pin)), role: 'admin' });
    },
  };
}
