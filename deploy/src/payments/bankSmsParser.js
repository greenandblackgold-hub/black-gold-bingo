const normalizeSender = (value) => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const BANK_SENDERS = new Map([
  ['TELEBIRR', 'telebirr'],
  ['CBE', 'cbe'],
  ['COMMERCIALBANKOFETHIOPIA', 'cbe'],
  ['CBEETHIOPIA', 'cbe'],
  ['LIONBANK', 'lion-bank'],
  ['LIONINTERNATIONALBANK', 'lion-bank'],
]);

const firstCapture = (text, patterns) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
};

/**
 * Convert a forwarded Ethiopian bank/mobile-money notification to a normalized
 * simulation-wallet event. The HTTP layer must authenticate the forwarding
 * device with HMAC before calling this parser.
 *
 * SMS templates differ by account, language and provider release. Unknown or
 * ambiguous messages are rejected instead of guessing a transaction or amount.
 */
export function parseBankSms({ sender, text, eventId } = {}) {
  const provider = BANK_SENDERS.get(normalizeSender(sender));
  if (!provider) throw new Error('unsupported_sms_sender');

  const message = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!message || message.length > 4000) throw new Error('invalid_sms_text');

  // Never treat outgoing transfers, purchases, withdrawals or debits as deposits.
  if (/\b(debit(?:ed)?|withdraw(?:n|al)?|sent|paid|purchase|payment\s+to|you\s+sent)\b/i.test(message)) {
    throw new Error('not_an_incoming_credit');
  }
  if (!/\b(credit(?:ed)?|received|deposit(?:ed)?|you\s+got|ተቀብለዋል|ገቢ)\b/i.test(message)) {
    throw new Error('sms_not_confirmed_incoming');
  }

  const reference = firstCapture(message, [
    /\b(?:transaction\s*(?:id|no\.?|number)|txn\s*(?:id|no\.?|ref)|trans(?:action)?\s*ref(?:erence)?|reference\s*(?:id|no\.?|number)?|ref\s*no\.?)\s*[:#=\-]?\s*([A-Z0-9][A-Z0-9_-]{5,39})\b/i,
    /\b(?:ID|Ref)\s*[:#=]\s*([A-Z0-9][A-Z0-9_-]{5,39})\b/i,
  ]);
  if (!reference) throw new Error('sms_transaction_reference_missing');

  const amountCandidates = [];
  const amountPatterns = [
    /\b(?:ETB|Birr)\s*([0-9][0-9,]*(?:\.\d{1,2})?)\b/gi,
    /\b([0-9][0-9,]*(?:\.\d{1,2})?)\s*(?:ETB|Birr)\b/gi,
  ];
  for (const pattern of amountPatterns) {
    for (const match of message.matchAll(pattern)) {
      const amount = Number(match[1].replace(/,/g, ''));
      if (Number.isFinite(amount) && amount > 0) amountCandidates.push(amount);
    }
  }
  const uniqueAmounts = [...new Set(amountCandidates)];
  if (uniqueAmounts.length !== 1) throw new Error('sms_amount_missing_or_ambiguous');

  return {
    eventId: String(eventId ?? reference).slice(0, 120),
    reference,
    amount: uniqueAmounts[0],
    currency: 'ETB',
    status: 'success',
    provider,
  };
}

export const supportedSmsSenders = ['Telebirr', 'CBE', 'Lion Bank'];
