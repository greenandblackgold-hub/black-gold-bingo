import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBankSms } from '../src/payments/bankSmsParser.js';

test('parses the exact Telebirr-to-configured-CBE receipt format', () => {
  const message = 'ውድ Customer ከቴሌ ብር አካውንትዎ 251900000000 ለ Commercial Bank of Ethiopia አካውንት ቁጥር 1000737138686 50.00 ብር በቀን 20/11/2026 21:51:38 በተሳካ ሁኔታ አስተላልፈዋል። የቴሌብር ሂሳብ እንቅስቃሴ ቁጥርዎ DKK7G8RIQH እና የባንክ ሂሳብ እንቅስቃሴ ቁጥርዎ FT26325ZWP2R ነው። የአገልግሎት ክፍያው 0.87 ብር፤ የአገልግሎት ክፍያው 15% VAT 0.13 ብር ነው። ያለዎት ቀሪ ሂሳብ 754.73 ብር ነው።';
  const parsed = parseBankSms({ sender: 'Telebirr', text: message, expectedRecipientAccount: '1000737138686' });
  assert.equal(parsed.amount, 50);
  assert.equal(parsed.reference, 'FT26325ZWP2R');
  assert.equal(parsed.provider, 'telebirr');
  assert.throws(() => parseBankSms({ sender: 'Telebirr', text: message, expectedRecipientAccount: '1000000000000' }), /not_an_incoming_credit/);
});

test('does not accept Telebirr transfer receipts without the configured beneficiary account', () => {
  const message = 'ለ Commercial Bank of Ethiopia አካውንት ቁጥር 1000737138686 50.00 ብር በተሳካ ሁኔታ አስተላልፈዋል። የባንክ ሂሳብ እንቅስቃሴ ቁጥርዎ FT26325ZWP2R';
  assert.throws(() => parseBankSms({ sender: 'Telebirr', text: message }), /not_an_incoming_credit/);
});

test('parses incoming CBE credit with one amount and balance excluded', () => {
  const parsed = parseBankSms({ sender: 'CBE', text: 'Your account is credited with ETB 125.00. Available balance is ETB 2,450.00. Ref No: CBE98765432' });
  assert.equal(parsed.amount, 125);
  assert.equal(parsed.reference, 'CBE98765432');
});

test('rejects ambiguous incoming amounts and outgoing transfer without beneficiary match', () => {
  assert.throws(() => parseBankSms({ sender: 'CBE', text: 'You sent ETB 50. Transaction ID: ABC123456' }), /not_an_incoming_credit/);
  assert.throws(() => parseBankSms({ sender: 'Telebirr', text: 'You received ETB 50 and ETB 60. Transaction ID: ABC123456' }), /sms_amount_missing_or_ambiguous/);
});
