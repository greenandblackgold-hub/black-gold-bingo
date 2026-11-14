import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('production landing page serves the built app without legacy OTP or manual-payment debug paths', () => {
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /debugOtp|debugOtpHint|send-otp|REAL SMS GATEWAY|payments.manual/i);
  assert.ok(html.includes('<div id="root"></div>'), 'built SPA root is present');
  assert.ok(html.includes('/assets/') && html.includes('.js'), 'built JavaScript bundle is linked');
});
