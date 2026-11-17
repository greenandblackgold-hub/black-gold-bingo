import crypto from 'node:crypto';
import { hashSecret, signJwt, verifyJwt, verifySecret } from '../util/crypto.js';
import { HttpError, RepoError } from '../util/errors.js';

const TOKEN_TTL = 7 * 24 * 3600;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const otpHash = (secret, userId, code) => crypto.createHmac('sha256', secret).update('phone-otp:v1:' + userId + ':' + code).digest('hex');
const encryptOtp = (secret, code) => { const key = crypto.createHash('sha256').update('phone-otp-encryption:v1:' + secret).digest(); const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', key, iv); const encrypted = Buffer.concat([c.update(code), c.final()]); return Buffer.concat([iv, c.getAuthTag(), encrypted]).toString('base64'); };
const decryptOtp = (secret, value) => { const d = Buffer.from(value, 'base64'); const key = crypto.createHash('sha256').update('phone-otp-encryption:v1:' + secret).digest(); const c = crypto.createDecipheriv('aes-256-gcm', key, d.subarray(0,12)); c.setAuthTag(d.subarray(12,28)); return Buffer.concat([c.update(d.subarray(28)), c.final()]).toString(); };

/** Accepts 09XXXXXXXX, 07XXXXXXXX, +2519XXXXXXXX, 2519XXXXXXXX and returns the local form, or null. */
export function normalizePhone(input) {
  const digits = String(input ?? '').replace(/[\s()-]/g, '').replace(/^\+/, '');
  const m = digits.match(/^(?:251|0)?([79]\d{8})$/);
  return m ? `0${m[1]}` : null;
}

export const publicUser = (u) => ({ id: u.id, phone: u.phone, name: u.name, role: u.role, balance: u.balance / 100, phoneVerified: u.role === 'admin' || u.phoneVerified === true });

export function createAuthService({ repo, config }) {
  const issue = (user) => ({ token: signJwt({ sub: user.id, role: user.role }, config.jwtSecret, TOKEN_TTL), user: publicUser(user) });
  const createPhoneChallenge = async (userId) => { const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0'); const expiresAt = new Date(Date.now() + OTP_TTL_MS); await repo.createPhoneChallenge({ userId, codeHash: otpHash(config.jwtSecret, userId, code), codeEncrypted: encryptOtp(config.jwtSecret, code), expiresAt }); return expiresAt.getTime(); };

  return {
    async register({ phone, name, pin, pinConfirm }) {
      if (!config.registrationEnabled) throw new HttpError(503, 'registration_disabled', 'New registrations are temporarily disabled until phone verification is ready.');
      const p = normalizePhone(phone);
      if (!p) throw new HttpError(400, 'invalid_phone', 'Enter a valid Ethiopian mobile number');
      const cleanName = String(name ?? '').trim().slice(0, 60);
      if (cleanName.length < 2) throw new HttpError(400, 'invalid_name', 'Enter your name');
      if (!/^\d{6}$/.test(String(pin ?? ''))) throw new HttpError(400, 'invalid_pin', 'PIN must be 6 digits');
      if (String(pin) !== String(pinConfirm ?? '')) throw new HttpError(400, 'pin_mismatch', 'PIN confirmation does not match');
      try {
        const user = await repo.createUser({ phone: p, name: cleanName, pinHash: await hashSecret(String(pin)), role: 'player', phoneVerified: false });
        const verificationExpiresAt = await createPhoneChallenge(user.id);
        return { ...issue(user), phoneVerificationRequired: true, verificationExpiresAt };
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
      if (user.role === 'player' && user.phoneVerified !== true) { const c = await repo.getPhoneChallenge(user.id); if (!c || c.expiresAt <= new Date() || c.attempts >= OTP_MAX_ATTEMPTS) await createPhoneChallenge(user.id); }
      return { ...issue(user), phoneVerificationRequired: user.role === 'player' && user.phoneVerified === false };
    },

    async verifyPhoneCode(user, code) {
      const value = String(code ?? '');
      if (!/^\d{6}$/.test(value)) throw new HttpError(400, 'invalid_otp', 'Enter the 6-digit verification code');
      if (user.role !== 'player' || user.phoneVerified === true) return { verified: true, user: publicUser(user) };
      const c = await repo.getPhoneChallenge(user.id);
      if (!c || c.expiresAt <= new Date()) throw new HttpError(410, 'otp_expired', 'Code expired. Sign in again to request another.');
      if (c.attempts >= OTP_MAX_ATTEMPTS) throw new HttpError(429, 'otp_attempts_exceeded', 'Too many attempts. Sign in again to request another code.');
      if (await repo.completePhoneVerification(user.id, otpHash(config.jwtSecret, user.id, value))) { const fresh = await repo.findUserById(user.id); return { verified: true, user: publicUser(fresh) }; }
      await repo.recordPhoneChallengeFailure(user.id);
      const updated = await repo.getPhoneChallenge(user.id);
      if (updated?.attempts >= OTP_MAX_ATTEMPTS) throw new HttpError(429, 'otp_attempts_exceeded', 'Too many attempts. Sign in again to request another code.');
      throw new HttpError(400, 'invalid_otp', 'Incorrect verification code');
    },
    async listPendingPhoneVerifications() {
      return (await repo.listPendingPhoneChallenges()).map((r) => ({ userId: r.userId, name: r.name, phone: r.phone, code: decryptOtp(config.jwtSecret, r.codeEncrypted), expiresAt: r.expiresAt.getTime(), attempts: r.attempts }));
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
        await repo.createUser({ phone: p, name: name || 'Owner', pinHash: await hashSecret(String(pin)), role: 'admin', phoneVerified: true });
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
      return repo.createUser({ phone: p, name, pinHash: await hashSecret(String(pin)), role: 'admin', phoneVerified: true });
    },
  };
}
