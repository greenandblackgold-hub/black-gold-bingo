/**
 * Isolated Verify.et API adapter.
 *
 * Deliberately not wired into HTTP routes, wallet services, repositories, config,
 * or the existing SMS bridge. This module is safe to exercise with injected fetch
 * and storage fakes until a separately authorized production integration exists.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_BASE_URL = 'https://verify.et';

function parseRetryAfter(value, now = Date.now()) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const at = Date.parse(value);
  return Number.isFinite(at) ? Math.max(0, at - now) : null;
}

function signatureCandidates(header) {
  return String(header ?? '').split(',').map((part) => part.trim())
    .filter(Boolean).map((part) => part.replace(/^sha256=/i, '').toLowerCase())
    .filter((part) => /^[a-f0-9]{64}$/.test(part));
}

/** Verify Verify.et's timestamp + "." + exact raw-body HMAC-SHA256 signature. */
export function verifyVerifyEtWebhook({ rawBody, headers, secret, now = Date.now(), toleranceSeconds = 300 }) {
  if (!secret || typeof rawBody !== 'string') return false;
  const timestamp = String(headers?.['x-webhook-timestamp'] ?? headers?.['X-Webhook-Timestamp'] ?? '');
  const supplied = signatureCandidates(headers?.['x-webhook-signature'] ?? headers?.['X-Webhook-Signature']);
  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > toleranceSeconds * 1000 || supplied.length === 0) return false;
  const expected = createHmac('sha256', secret).update(timestamp + '.' + rawBody, 'utf8').digest();
  return supplied.some((hex) => {
    const candidate = Buffer.from(hex, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}

/** Build the documented POST /api/verify and GET /api/verify/:requestId client. */
export function createVerifyEtClient({ apiKey, baseUrl = DEFAULT_BASE_URL, fetchImpl = fetch, timeoutMs = 12000 }) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new TypeError('Verify.et API key is required');
  const base = String(baseUrl).replace(/\/$/, '');

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(base + path, {
        ...options,
        signal: controller.signal,
        headers: { 'x-api-key': apiKey, ...(options.headers ?? {}) },
      });
      let body = {};
      try { body = await response.json(); } catch { /* retain empty response */ }
      if (!response.ok) {
        const error = new Error(body?.message || `Verify.et request failed (${response.status})`);
        error.status = response.status;
        error.retryAfterMs = parseRetryAfter(response.headers?.get?.('retry-after'));
        error.responseBody = body;
        throw error;
      }
      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async submit({ bank, reference, transactionNumber, accountNumber, accountSuffix, phoneNumber, idempotencyKey, waitMs }) {
      if (!idempotencyKey) throw new TypeError('Idempotency-Key is required');
      if (!reference && !transactionNumber) throw new TypeError('A transaction reference is required');
      const payload = { ...(bank ? { bank } : {}), ...(reference ? { reference } : {}),
        ...(transactionNumber ? { transactionNumber } : {}), ...(accountNumber ? { accountNumber } : {}),
        ...(accountSuffix ? { accountSuffix } : {}), ...(phoneNumber ? { phoneNumber } : {}) };
      const query = Number.isFinite(waitMs) ? `?waitMs=${Math.max(0, Math.min(waitMs, bank === 'telebirr' ? 8000 : 5000))}` : '';
      return request('/api/verify' + query, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(payload),
      });
    },

    async getStatus(requestId) {
      if (!requestId) throw new TypeError('Verify.et requestId is required');
      return request('/api/verify/' + encodeURIComponent(requestId), { method: 'GET' });
    },
  };
}

/** Retry transient network/429/5xx failures; never retry ordinary 4xx responses. */
export async function retryVerifyEt(operation, {
  attempts = 5, baseDelayMs = 1000, maxDelayMs = 30000, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { return await operation(attempt); }
    catch (error) {
      lastError = error;
      const transient = error?.name === 'AbortError' || !Number.isFinite(error?.status) ||
        error.status === 408 || error.status === 429 || error.status >= 500;
      if (!transient || attempt === attempts - 1) throw error;
      const delay = error.retryAfterMs ?? Math.min(maxDelayMs, baseDelayMs * (2 ** attempt));
      await sleep(delay);
    }
  }
  throw lastError;
}

/**
 * Event idempotency helper. The caller supplies durable storage in production;
 * this module intentionally provides no database implementation.
 */
export function createWebhookDeduplicator(store) {
  if (!store || typeof store.has !== 'function' || typeof store.mark !== 'function') {
    throw new TypeError('A store with async has(id) and mark(id) methods is required');
  }
  return {
    async claim(eventId) {
      if (!eventId || typeof eventId !== 'string') throw new TypeError('Webhook event id is required');
      if (await store.has(eventId)) return false;
      // Store.mark must be atomic (unique key / compare-and-set) to prevent races.
      return (await store.mark(eventId)) === true;
    },
  };
}

/** True only for a completed, verified ETB payment with exact amount and reference. */
export function isExactVerifiedPayment(data, { amountEtb, reference }) {
  if (!data || data.verified !== true || String(data.status).toLowerCase() !== 'success' ||
      String(data.currency).toUpperCase() !== 'ETB') return false;
  const actual = Number(data.amount);
  const expected = Number(amountEtb);
  const normalize = (value) => String(value ?? '').trim().toUpperCase();
  return Number.isFinite(actual) && Number.isFinite(expected) &&
    Math.round(actual * 100) === Math.round(expected * 100) &&
    [data.referenceNumber, data.receiptNumber, data.transactionNumber].some((v) => normalize(v) === normalize(reference));
}
