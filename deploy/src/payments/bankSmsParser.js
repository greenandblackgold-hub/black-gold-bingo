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

const normalizeDigits = (value) => String(value).replace(/[፩-፱]/g, (digit) =>
  String('፩፪፫፬፭፮፯፰፱'.indexOf(digit) + 1));

/**
 * Parse a complete Ethiopian bank/mobile-money credit notification.
 * This only creates a pending request; it does not prove settlement or credit
 * a wallet. The HTTP gateway must authenticate forwarded SMS events separately.
 * Unknown/ambiguous messages are rejected rather than guessing an amount/reference.
 */
export function parseBankSms({ sender, provider: providerHint, text, eventId } = {}) {
  const hinted = normalizeSender(providerHint);
  const provider = BANK_SENDERS.get(normalizeSender(sender)) ?? BANK_SENDERS.get(hinted) ??
    (hinted === 'TELEBIRR' ? 'telebirr' : hinted === 'CBE' ? 'cbe' : ['LIONBANK', 'LIONINTERNATIONALBANK'].includes(hinted) ? 'lion-bank' : null);
  if (!provider) throw new Error('unsupported_sms_sender');

  const message = normalizeDigits(String(text ?? ''))
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!message || message.length > 4000) throw new Error('invalid_sms_text');

  // Reject clear debit/outgoing wording before checking for incoming wording.
  if (/\b(debit(?:ed)?|withdraw(?:n|al)?|sent|paid|purchase|payment\s+to|you\s+sent|transferred\s+to)\b/i.test(message) ||
      /(?:ወጪ|ተቀንሷል|ከሂሳብዎ\s*ወጥቷል)/.test(message)) {
    throw new Error('not_an_incoming_credit');
  }
  if (!/\b(credit(?:ed)?|received|deposit(?:ed)?|you\s+got|money\s+in|funds\s+received)\b/i.test(message) &&
      !/(?:ተቀብለዋል|ገቢ\s*(?:ሆኗል|ተደርጓል)?)/.test(message)) {
    throw new Error('sms_not_confirmed_incoming');
  }

  // Accept common provider labels: Transaction ID/Ref/No, Txn, Reference,
  // Receipt No and RRN. Keep the reference bounded and never derive it from
  // an arbitrary long number such as an account or phone number.
  const reference = firstCapture(message, [
    /\b(?:transaction\s*(?:id|ref(?:erence)?|no\.?|number)|txn\s*(?:id|ref|no\.?|number)|trans\.?\s*(?:id|ref)|reference\s*(?:id|no\.?|number)?|ref\s*(?:no\.?|id)?|receipt\s*(?:no\.?|number)|rrn)\s*[:#=\-]?\s*([A-Z0-9][A-Z0-9_-]{4,39})\b/i,
    /\b(?:ID|Ref)\s*[:#=]\s*([A-Z0-9][A-Z0-9_-]{4,39})\b/i,
    /\b(?:የደረሰኝ\s*ቁጥር|የግብይት\s*መለያ)\s*[:#=]?\s*([A-Z0-9][A-Z0-9_-]{4,39})\b/i,
  ]);
  if (!reference) throw new Error('sms_transaction_reference_missing');

  // Find currency-tagged amounts in either order. Ignore an explicitly
  // labelled available/current/remaining balance; multiple transaction
  // amounts remain ambiguous and are rejected.
  const amountPattern = /(?:\b(?:ETB|Birr)\s*([0-9][0-9,]*(?:\.\d{1,2})?)\b|\b([0-9][0-9,]*(?:\.\d{1,2})?)\s*(?:ETB|Birr)\b|([0-9][0-9,]*(?:\.\d{1,2})?)\s*ብር|ብር\s*([0-9][0-9,]*(?:\.\d{1,2})?))/gi;
  const amounts = [];
  for (const match of message.matchAll(amountPattern)) {
    const raw = match.slice(1).find(Boolean);
    if (!raw) continue;
    const amount = Number(raw.replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const before = message.slice(Math.max(0, match.index - 55), match.index);
    if (/(?:available|current|remaining|closing|new)\s+balance\s*(?:is|:|=)?\s*$/i.test(before) ||
        /(?:ቀሪ\s*ሂሳብ|ያለው\s*ሂሳብ)\s*[:=]?\s*$/.test(before)) continue;
    amounts.push(amount);
  }
  const uniqueAmounts = [...new Set(amounts)];
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
