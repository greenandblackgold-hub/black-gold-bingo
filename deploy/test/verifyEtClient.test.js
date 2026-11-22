import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  createVerifyEtClient, verifyVerifyEtWebhook, retryVerifyEt,
  createWebhookDeduplicator, isExactVerifiedPayment,
} from '../src/payments/verifyEtClient.js';

const secret = 'whsec_test_secret';
const timestamp = '2026-11-22T12:00:00.000Z';
const rawBody = JSON.stringify({ id: 'evt_1', event: 'verification.completed', data: { status: 'success' } });
const signature = createHmac('sha256', secret).update(timestamp + '.' + rawBody).digest('hex');

test('verifies exact raw-body HMAC and rejects tampering/stale timestamps', () => {
  const headers = { 'x-webhook-timestamp': timestamp, 'x-webhook-signature': 'sha256=' + signature };
  const now = Date.parse(timestamp);
  assert.equal(verifyVerifyEtWebhook({ rawBody, headers, secret, now }), true);
  assert.equal(verifyVerifyEtWebhook({ rawBody: rawBody + ' ', headers, secret, now }), false);
  assert.equal(verifyVerifyEtWebhook({ rawBody, headers, secret, now: now + 301000 }), false);
});

test('accepts either rotated signature in a comma-separated header', () => {
  const headers = { 'x-webhook-timestamp': timestamp, 'x-webhook-signature': 'sha256=' + 'a'.repeat(64) + ', sha256=' + signature };
  assert.equal(verifyVerifyEtWebhook({ rawBody, headers, secret, now: Date.parse(timestamp) }), true);
});

test('submits JSON to documented Verify.et endpoint with API key and stable idempotency key', async () => {
  let captured;
  const client = createVerifyEtClient({ apiKey: 'VERIFY_BANK_ET_test', fetchImpl: async (url, options) => {
    captured = { url, options };
    return { ok: true, status: 202, json: async () => ({ requestId: 'req_1', verification: { status: 'pending' } }) };
  }});
  const result = await client.submit({ bank: 'telebirr', transactionNumber: 'T123456', idempotencyKey: 'deposit-ref-1', waitMs: 9000 });
  assert.equal(result.requestId, 'req_1');
  assert.equal(captured.url, 'https://verify.et/api/verify?waitMs=8000');
  assert.equal(captured.options.headers['x-api-key'], 'VERIFY_BANK_ET_test');
  assert.equal(captured.options.headers['Idempotency-Key'], 'deposit-ref-1');
  assert.deepEqual(JSON.parse(captured.options.body), { bank: 'telebirr', transactionNumber: 'T123456' });
});

test('fetches status by safely encoded request id', async () => {
  let url;
  const client = createVerifyEtClient({ apiKey: 'key', fetchImpl: async (u) => {
    url = u; return { ok: true, json: async () => ({ data: { processingStatus: 'completed' } }) };
  }});
  await client.getStatus('req/a');
  assert.equal(url, 'https://verify.et/api/verify/req%2Fa');
});

test('retries transient failures and stops on permanent 4xx', async () => {
  let calls = 0; const delays = [];
  const value = await retryVerifyEt(async () => {
    calls += 1; if (calls < 3) { const e = new Error('busy'); e.status = 503; e.retryAfterMs = 25; throw e; }
    return 'ok';
  }, { sleep: async (ms) => delays.push(ms) });
  assert.equal(value, 'ok'); assert.equal(calls, 3); assert.deepEqual(delays, [25, 25]);
  let permanentCalls = 0;
  await assert.rejects(() => retryVerifyEt(async () => {
    permanentCalls += 1; const e = new Error('bad key'); e.status = 401; throw e;
  }, { sleep: async () => {} }), /bad key/);
  assert.equal(permanentCalls, 1);
});

test('deduplicates repeated webhook event ids through injected store', async () => {
  const seen = new Set();
  const dedupe = createWebhookDeduplicator({
    has: async (id) => seen.has(id),
    mark: async (id) => { if (seen.has(id)) return false; seen.add(id); return true; },
  });
  assert.equal(await dedupe.claim('evt_1'), true);
  assert.equal(await dedupe.claim('evt_1'), false);
});

test('requires verified success, ETB, exact amount and exact reference', () => {
  const good = { verified: true, status: 'success', currency: 'ETB', amount: '1500.00', receiptNumber: 'ABC123' };
  assert.equal(isExactVerifiedPayment(good, { amountEtb: 1500, reference: 'abc123' }), true);
  assert.equal(isExactVerifiedPayment({ ...good, amount: '1499' }, { amountEtb: 1500, reference: 'ABC123' }), false);
  assert.equal(isExactVerifiedPayment({ ...good, verified: false }, { amountEtb: 1500, reference: 'ABC123' }), false);
  assert.equal(isExactVerifiedPayment({ ...good, currency: 'USD' }, { amountEtb: 1500, reference: 'ABC123' }), false);
  assert.equal(isExactVerifiedPayment({ ...good, receiptNumber: 'OTHER' }, { amountEtb: 1500, reference: 'ABC123' }), false);
});
