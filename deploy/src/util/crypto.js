import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

export const randomToken = (bytes = 16) => crypto.randomBytes(bytes).toString('hex');

export function randomInt(max) {
  return crypto.randomInt(0, max);
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export const hmacHex = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');

/** Password / PIN hashing with scrypt (salted, memory-hard). */
export async function hashSecret(secret) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(secret, salt, 32);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifySecret(secret, stored) {
  const [alg, saltHex, keyHex] = String(stored).split('$');
  if (alg !== 'scrypt' || !saltHex || !keyHex) return false;
  const key = await scrypt(secret, Buffer.from(saltHex, 'hex'), 32);
  return safeEqual(key.toString('hex'), keyHex);
}

/** Minimal HS256 JWT. */
export function signJwt(payload, secret, ttlSec) {
  const iat = Math.floor(Date.now() / 1000);
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat, exp: iat + ttlSec })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

export function verifyJwt(token, secret) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
