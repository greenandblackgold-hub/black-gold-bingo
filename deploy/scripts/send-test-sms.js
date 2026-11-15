import { createHmac, randomUUID } from 'node:crypto';

const [reference, amountText] = process.argv.slice(2);
const amount = Number(amountText);
if (!reference || !Number.isFinite(amount) || amount <= 0) {
  console.error('Usage: npm run simulate:sms -- TXN123456789 100');
  process.exit(1);
}
const secret = process.env.SMS_WEBHOOK_SECRET ?? 'local-only-sms-webhook-secret-change-before-hosting-2026';
const url = (process.env.SMS_WEBHOOK_URL ?? 'http://localhost:8080/api/webhooks/sms').replace(/\/$/, '');
const event = { eventId: randomUUID(), reference, amount, currency: 'ETB', status: 'success' };
const rawBody = JSON.stringify(event);
const signature = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');

const response = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-sms-signature': signature },
  body: rawBody,
});
const result = await response.json().catch(() => ({}));
console.log(`Webhook response: HTTP ${response.status}`);
console.log(result);
if (!response.ok) process.exitCode = 1;
