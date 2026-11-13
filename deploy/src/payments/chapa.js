/**
 * Chapa client (https://developer.chapa.co). Endpoints used:
 *   POST {base}/transaction/initialize      start a checkout (returns data.checkout_url)
 *   GET  {base}/transaction/verify/{tx_ref} confirm a payment (the source of truth)
 *   POST {base}/transfers                   pay money out to a bank / mobile-money account
 *   GET  {base}/transfers/verify/{ref}      confirm a payout
 *   GET  {base}/banks                       bank codes for transfers
 *
 * Never credit a wallet because a webhook or redirect SAYS the payment succeeded.
 * Always call verify() on your own server and compare status, currency and amount.
 *
 * mock=true simulates Chapa in memory for local testing (no network, no money).
 */
import { hmacHex, safeEqual } from '../util/crypto.js';

const toSantim = (v) => Math.round(Number(v) * 100);
const toEtbString = (santim) => (santim / 100).toFixed(2);

export function createChapa({ secretKey, webhookSecret, baseUrl, mock, publicApiUrl, emailDomain, fetchImpl = fetch }) {
  /* ───────────── mock ───────────── */
  const mockPayments = new Map(); // txRef -> { amount, paid, returnUrl }
  const mockTransfers = new Map();

  async function call(method, path, body) {
    const res = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON error body */
    }
    if (!res.ok) {
      const err = new Error(`Chapa ${method} ${path} failed (${res.status}): ${json?.message ?? 'no message'}`);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  return {
    mock,
    mockPayments,

    /** Returns the hosted checkout URL to redirect the player to. */
    async initialize({ amount, txRef, user, returnUrl, callbackUrl }) {
      if (mock) {
        mockPayments.set(txRef, { amount, paid: false, returnUrl });
        return { checkoutUrl: `${publicApiUrl}/mock/chapa/checkout?tx_ref=${encodeURIComponent(txRef)}` };
      }
      const [first, ...rest] = String(user.name || 'Player').split(' ');
      const body = {
        amount: toEtbString(amount),
        currency: 'ETB',
        tx_ref: txRef,
        first_name: first,
        last_name: rest.join(' ') || 'Player',
        phone_number: user.phone,
        callback_url: callbackUrl,
        return_url: returnUrl,
        customization: { title: 'Bingo deposit', description: 'Wallet top up' },
      };
      if (user.email) body.email = user.email;
      else if (emailDomain) body.email = `player-${user.id}@${emailDomain}`;
      const json = await call('POST', '/transaction/initialize', body);
      const url = json?.data?.checkout_url;
      if (!url) throw new Error('Chapa did not return a checkout_url');
      return { checkoutUrl: url };
    },

    /** Source of truth for a deposit. status: 'success' | 'pending' | 'failed' */
    async verify(txRef) {
      if (mock) {
        const p = mockPayments.get(txRef);
        if (!p) return { status: 'failed', amount: 0, currency: 'ETB' };
        return { status: p.paid ? 'success' : 'pending', amount: p.amount, currency: 'ETB', chapaRef: `mock-${txRef}` };
      }
      let json;
      try {
        json = await call('GET', `/transaction/verify/${encodeURIComponent(txRef)}`);
      } catch (e) {
        if (e.status === 404) return { status: 'failed', amount: 0, currency: 'ETB' };
        throw e;
      }
      const d = json?.data ?? {};
      const raw = String(d.status ?? json?.status ?? '').toLowerCase();
      const status = raw === 'success' ? 'success' : raw === 'failed' || raw === 'cancelled' ? 'failed' : 'pending';
      return { status, amount: toSantim(d.amount), currency: String(d.currency ?? '').toUpperCase(), chapaRef: d.reference ?? d.ref_id ?? null };
    },

    /** Payout. `reference` must be unique per transfer. */
    async transfer({ accountName, accountNumber, amount, reference, bankCode }) {
      if (mock) {
        mockTransfers.set(reference, { status: 'success' });
        return { status: 'success' };
      }
      const json = await call('POST', '/transfers', {
        account_name: accountName,
        account_number: accountNumber,
        amount: toEtbString(amount),
        currency: 'ETB',
        reference,
        bank_code: Number(bankCode),
      });
      const raw = String(json?.data?.status ?? json?.status ?? '').toLowerCase();
      return { status: raw === 'success' ? 'success' : raw === 'failed' ? 'failed' : 'pending', raw: json };
    },

    async verifyTransfer(reference) {
      if (mock) return { status: mockTransfers.get(reference)?.status ?? 'failed' };
      const json = await call('GET', `/transfers/verify/${encodeURIComponent(reference)}`);
      const raw = String(json?.data?.status ?? json?.status ?? '').toLowerCase();
      return { status: raw === 'success' ? 'success' : raw === 'failed' ? 'failed' : 'pending' };
    },

    async banks() {
      if (mock) return [{ id: 1, name: 'Mock Bank' }, { id: 2, name: 'Telebirr (mock)' }];
      const json = await call('GET', '/banks');
      return json?.data ?? [];
    },

    /**
     * Optional extra filter: when CHAPA_WEBHOOK_SECRET is set, require the HMAC-SHA256 of the raw body in the
     * `Chapa-Signature` / `x-chapa-signature` header. Deposits are confirmed via verify() either way.
     */
    verifyWebhookSignature(rawBody, headers) {
      if (mock) return true;
      // No webhook secret configured = skip this extra filter. Safe, because a deposit is only ever credited
      // after the server itself asks Chapa to verify it (see walletService.confirmDeposit).
      const secret = webhookSecret;
      if (!secret) return true;
      const expected = hmacHex(secret, rawBody);
      const sigs = [headers['chapa-signature'], headers['x-chapa-signature']].filter(Boolean);
      return sigs.some((s) => safeEqual(String(s).toLowerCase(), expected));
    },
  };
}
