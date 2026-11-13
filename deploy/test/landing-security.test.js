import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('production landing page does not expose legacy OTP or manual-payment debug paths', () => {
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /debugOtp|debugOtpHint|send-otp|REAL SMS GATEWAY|api\/payments\/manual/i);
  assert.match(html, /Do not send money|አሁን ገንዘብ አይላኩ/);
});
