const normalizeSender = (value) => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const BANK_SENDERS = new Map([
  ['TELEBIRR', 'telebirr'], ['CBE', 'cbe'],
  ['COMMERCIALBANKOFETHIOPIA', 'cbe'], ['CBEETHIOPIA', 'cbe'],
  ['LIONBANK', 'lion-bank'], ['LIONINTERNATIONALBANK', 'lion-bank'],
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

/** Parse incoming notices and configured Telebirr-to-CBE transfer receipts. */
export function parseBankSms({ sender, provider: providerHint, text, eventId, expectedRecipientAccount, timezoneOffsetMinutes = 180 } = {}) {
  const hinted = normalizeSender(providerHint);
  const provider = BANK_SENDERS.get(normalizeSender(sender)) ?? BANK_SENDERS.get(hinted) ??
    (hinted === 'TELEBIRR' ? 'telebirr' : hinted === 'CBE' ? 'cbe' : ['LIONBANK', 'LIONINTERNATIONALBANK'].includes(hinted) ? 'lion-bank' : null);
  if (!provider) throw new Error('unsupported_sms_sender');

  const message = normalizeDigits(String(text ?? ''))
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!message || message.length > 4000) throw new Error('invalid_sms_text');

  const recipientAccount = String(expectedRecipientAccount ?? '').replace(/\D/g, '');
  const transferToConfiguredCbe = provider === 'telebirr' && recipientAccount.length >= 8 &&
    new RegExp('(?:Commercial\\s+Bank\\s+of\\s+Ethiopia|CBE)[^0-9]{0,100}(?:account|አካውንት)\\s*(?:number|no\\.?|ቁጥር)?\\s*' + recipientAccount + '\\b', 'i').test(message) &&
    /(?:አስተላልፈዋል|አስተላልፏል|transferred\s+successfully|successfully\s+transferred)/i.test(message);

  if (transferToConfiguredCbe) {
    const amountMatch = message.match(new RegExp(recipientAccount + '\\s+([0-9][0-9,]*(?:\\.\\d{1,2})?)\\s*ብር'));
    const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : NaN;
    const timestampMatch = message.match(/(?:በቀን\s*)?(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
    if (!timestampMatch) throw new Error('sms_transfer_timestamp_missing');
    const [, dayText, monthText, yearText, hourText, minuteText, secondText] = timestampMatch;
    const [day, month, year, hour, minute, second] = [dayText, monthText, yearText, hourText, minuteText, secondText].map(Number);
    const calendarCheck = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    if (calendarCheck.getUTCFullYear() !== year || calendarCheck.getUTCMonth() !== month - 1 || calendarCheck.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) throw new Error('sms_transfer_timestamp_invalid');
    const transactionAt = Date.UTC(year, month - 1, day, hour, minute, second) - Number(timezoneOffsetMinutes) * 60_000;
    const bankReference = firstCapture(message, [
      /የባንክ\s*ሂሳብ\s*እንቅስቃሴ\s*ቁጥርዎ?\s*[:：]?\s*([A-Z0-9][A-Z0-9_-]{4,39})/i,
      /\b(?:bank\s+)?(?:transaction\s*(?:id|ref|no\.?))\s*[:#=]?\s*([A-Z0-9][A-Z0-9_-]{4,39})/i,
    ]);
    if (!Number.isFinite(amount) || amount <= 0 || !bankReference) throw new Error('sms_transfer_details_missing');
    return { eventId: String(eventId ?? bankReference).slice(0, 120), reference: bankReference, amount, currency: 'ETB', status: 'success', provider: 'telebirr', recipientAccount, transactionAt };
  }

  // An outgoing receipt for any other destination is not a deposit notification.
  if (/\b(debit(?:ed)?|withdraw(?:n|al)?|sent|paid|purchase|payment\s+to|you\s+sent|transferred\s+to)\b/i.test(message) ||
      /(?:ወጪ|ተቀንሷል|ከሂሳብዎ\s*ወጥቷል|አስተላልፈዋል)/.test(message)) {
    throw new Error('not_an_incoming_credit');
  }
  if (!/\b(credit(?:ed)?|received|deposit(?:ed)?|you\s+got|money\s+in|funds\s+received)\b/i.test(message) &&
      !/(?:ተቀብለዋል|ገቢ\s*(?:ሆኗል|ተደርጓል)?)/.test(message)) {
    throw new Error('sms_not_confirmed_incoming');
  }

  const reference = firstCapture(message, [
    /\b(?:transaction\s*(?:id|ref(?:erence)?|no\.?|number)|txn\s*(?:id|ref|no\.?|number)|trans\.?\s*(?:id|ref)|reference\s*(?:id|no\.?|number)?|ref\s*(?:no\.?|id)?|receipt\s*(?:no\.?|number)|rrn)\s*[:#=\-]?\s*([A-Z0-9][A-Z0-9_-]{4,39})\b/i,
    /\b(?:ID|Ref)\s*[:#=]\s*([A-Z0-9][A-Z0-9_-]{4,39})\b/i,
    /(?:የደረሰኝ\s*ቁጥር|የግብይት\s*መለያ)\s*[:#=]?\s*([A-Z0-9][A-Z0-9_-]{4,39})/i,
  ]);
  if (!reference) throw new Error('sms_transaction_reference_missing');

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
  return { eventId: String(eventId ?? reference).slice(0, 120), reference, amount: uniqueAmounts[0], currency: 'ETB', status: 'success', provider };
}
export const supportedSmsSenders = ['Telebirr', 'CBE', 'Lion Bank'];
