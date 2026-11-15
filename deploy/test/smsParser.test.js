import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBankSms } from '../src/payments/bankSmsParser.js';

test('parses incoming Telebirr ETB notification', () => {
  assert.deepEqual(parseBankSms({
    sender: 'Telebirr',
    text: 'You have received ETB 250.00. Transaction ID: TB123456789. Thank you.',
  }), {
    eventId: 'TB123456789',
    reference: 'TB123456789',
    amount: 250,
    currency: 'ETB',
    status: 'success',
    provider: 'telebirr',
  });
});

test('parses incoming CBE and Lion Bank notifications', () => {
  const cbe = parseBankSms({
    sender: 'CBE',
    text: 'Your account is credited with 1,250.50 ETB. Ref No: CBE12345678',
  });
  assert.equal(cbe.provider, 'cbe');
  assert.equal(cbe.amount, 1250.5);
  assert.equal(cbe.reference, 'CBE12345678');

  const lion = parseBankSms({
    sender: 'Lion Bank',
    text: 'You received Birr 75.00. Transaction ID: LION12345678',
  });
  assert.equal(lion.provider, 'lion-bank');
  assert.equal(lion.amount, 75);
  assert.equal(lion.reference, 'LION12345678');
});

test('selects the incoming transfer amount when SMS also reports available balance', () => {
  const parsed = parseBankSms({
    sender: 'CBE',
    text: 'Your account is credited with ETB 125.00. Available balance is ETB 2,450.00. Ref No: CBE98765432',
  });
  assert.equal(parsed.amount, 125);
  assert.equal(parsed.reference, 'CBE98765432');
});

test('rejects unknown senders, outgoing transfers and ambiguous amounts', () => {
  assert.throws(() => parseBankSms({
    sender: 'Unknown',
    text: 'You received ETB 50. Transaction ID: ABC123456',
  }), /unsupported_sms_sender/);
  assert.throws(() => parseBankSms({
    sender: 'CBE',
    text: 'You sent ETB 50. Transaction ID: ABC123456',
  }), /not_an_incoming_credit/);
  assert.throws(() => parseBankSms({
    sender: 'Telebirr',
    text: 'You received ETB 50 and ETB 60. Transaction ID: ABC123456',
  }), /sms_amount_missing_or_ambiguous/);
});
