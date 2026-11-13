/**
 * Telebirr direct integration: TEMPLATE ONLY (not wired in, not tested).
 *
 * Why it is a template: Telebirr's merchant API is issued per merchant by Ethio telecom. You need an
 * approved merchant account and these credentials from the Telebirr developer portal before any code can run:
 * Fabric App ID, App Secret, Merchant App ID, Merchant Code (short code) and your RSA private key.
 *
 * Flow used by the published H5 "web checkout" integrations (verify against the spec Ethio telecom gives you):
 *   1. Get a Fabric token (POST to the gateway with Fabric App ID + App Secret).
 *   2. Create an order (outTradeNo = your unique reference, amount, notifyUrl, returnUrl), signed with your RSA private key.
 *   3. Redirect the player to the returned checkout URL.
 *   4. Telebirr calls your notifyUrl with the result, signed by Telebirr: verify the signature with their public key.
 *   5. Confirm with the order-query endpoint before crediting (same rule as Chapa: never trust the callback alone).
 *
 * To plug it in, implement the same four methods the wallet service uses from Chapa:
 *   initialize({ amount, txRef, user, returnUrl, callbackUrl }) -> { checkoutUrl }
 *   verify(txRef)                                              -> { status, amount, currency, chapaRef }
 *   transfer(...) / verifyTransfer(...)                        -> only if Telebirr offers B2C payouts on your contract
 *   verifyWebhookSignature(rawBody, headers)                   -> boolean
 * then pass the object to createApp() instead of the Chapa client.
 *
 * The simplest route to Telebirr today: Chapa's hosted checkout already offers Telebirr as a payment method,
 * and Chapa transfers can pay out to Telebirr wallets, so you can launch with Chapa alone.
 */
export function createTelebirr() {
  const notConfigured = async () => {
    throw new Error('Telebirr is not configured. See the comments in src/payments/telebirr.js.');
  };
  return {
    mock: false,
    initialize: notConfigured,
    verify: notConfigured,
    transfer: notConfigured,
    verifyTransfer: notConfigured,
    banks: notConfigured,
    verifyWebhookSignature: () => false,
  };
}
