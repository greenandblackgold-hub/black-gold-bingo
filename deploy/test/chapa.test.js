import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createChapa } from '../src/payments/chapa.js';

const base = { secretKey: 'CHASECK_TEST-abc', webhookSecret: 'whsec', baseUrl: 'https://api.chapa.co/v1', mock: false, publicApiUrl: 'https://api.example.com', emailDomain: 'bingo.example' };

function fakeFetch(responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined });
    const r = responses.shift();
    return { ok: r.status < 400, status: r.status, json: async () => r.json };
  };
  return { impl, calls };
}

test('initialize sends the documented fields and returns the checkout url', async () => {
  const f = fakeFetch([{ status: 200, json: { status: 'success', data: { checkout_url: 'https://checkout.chapa.co/x' } } }]);
  const chapa = createChapa({ ...base, fetchImpl: f.impl });
  const out = await chapa.initialize({
    amount: 12550, txRef: 'bgd-1', user: { id: 'u1', name: 'Abebe Kebede', phone: '0911223344' },
    returnUrl: 'https://web/?tx_ref=bgd-1', callbackUrl: 'https://api/cb',
  });
  assert.equal(out.checkoutUrl, 'https://checkout.chapa.co/x');
  const c = f.calls[0];
  assert.equal(c.url, 'https://api.chapa.co/v1/transaction/initialize');
  assert.equal(c.method, 'POST');
  assert.equal(c.headers.Authorization, 'Bearer CHASECK_TEST-abc');
  assert.equal(c.body.amount, '125.50');
  assert.equal(c.body.currency, 'ETB');
  assert.equal(c.body.tx_ref, 'bgd-1');
  assert.equal(c.body.first_name, 'Abebe');
  assert.equal(c.body.last_name, 'Kebede');
  assert.equal(c.body.phone_number, '0911223344');
  assert.equal(c.body.email, 'player-u1@bingo.example');
  assert.equal(c.body.return_url, 'https://web/?tx_ref=bgd-1');
  assert.ok(c.body.customization.title.length <= 16);
});

test('verify maps Chapa statuses and converts amounts to santim', async () => {
  const f = fakeFetch([
    { status: 200, json: { status: 'success', data: { status: 'success', amount: 100, currency: 'ETB', reference: 'APx' } } },
    { status: 200, json: { status: 'success', data: { status: 'pending', amount: '10.00', currency: 'ETB' } } },
    { status: 404, json: { message: 'not found' } },
  ]);
  const chapa = createChapa({ ...base, fetchImpl: f.impl });
  assert.deepEqual(await chapa.verify('a'), { status: 'success', amount: 10000, currency: 'ETB', chapaRef: 'APx' });
  assert.equal((await chapa.verify('b')).status, 'pending');
  assert.equal((await chapa.verify('c')).status, 'failed');
  assert.equal(f.calls[0].url, 'https://api.chapa.co/v1/transaction/verify/a');
  assert.equal(f.calls[0].method, 'GET');
});

test('transfer sends the documented payout fields', async () => {
  const f = fakeFetch([{ status: 200, json: { status: 'success', data: { status: 'success' } } }]);
  const chapa = createChapa({ ...base, fetchImpl: f.impl });
  const r = await chapa.transfer({ accountName: 'Abebe Kebede', accountNumber: '0911223344', amount: 5000, reference: 'wd-1', bankCode: '855' });
  assert.equal(r.status, 'success');
  const b = f.calls[0].body;
  assert.equal(f.calls[0].url, 'https://api.chapa.co/v1/transfers');
  assert.deepEqual(b, { account_name: 'Abebe Kebede', account_number: '0911223344', amount: '50.00', currency: 'ETB', reference: 'wd-1', bank_code: 855 });
});

test('webhook signature: HMAC-SHA256 of the raw body, either header, constant-time compare', () => {
  const chapa = createChapa({ ...base });
  const raw = JSON.stringify({ event: 'charge.success', tx_ref: 'bgd-1' });
  const sig = crypto.createHmac('sha256', 'whsec').update(raw).digest('hex');
  assert.equal(chapa.verifyWebhookSignature(raw, { 'chapa-signature': sig }), true);
  assert.equal(chapa.verifyWebhookSignature(raw, { 'x-chapa-signature': sig }), true);
  assert.equal(chapa.verifyWebhookSignature(raw + ' ', { 'chapa-signature': sig }), false);
  assert.equal(chapa.verifyWebhookSignature(raw, { 'chapa-signature': 'deadbeef' }), false);
  assert.equal(chapa.verifyWebhookSignature(raw, {}), false);
});

test('without a webhook secret the signature filter is skipped (payments are re-verified anyway)', () => {
  const chapa = createChapa({ ...base, webhookSecret: '' });
  assert.equal(chapa.verifyWebhookSignature('{}', {}), true);
});

test('a Chapa HTTP error surfaces as an exception (so nothing is credited)', async () => {
  const f = fakeFetch([{ status: 500, json: { message: 'boom' } }]);
  const chapa = createChapa({ ...base, fetchImpl: f.impl });
  await assert.rejects(() => chapa.verify('x'), /500/);
});
