import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/db/memoryRepo.js';
import { createAuthService } from '../src/services/authService.js';

const config = {
  registrationEnabled: true,
  jwtSecret: 'test-only-jwt-secret-that-is-at-least-32-characters',
};

test('admin-assisted phone OTP is time-limited, attempt-limited and one-time', async () => {
  const repo = createMemoryRepo();
  await repo.init();
  const auth = createAuthService({ repo, config });

  const registration = await auth.register({
    phone: '0912345678',
    name: 'Test Player',
    pin: '123456',
    pinConfirm: '123456',
  });
  assert.equal(registration.user.phoneVerified, false);
  assert.equal(registration.phoneVerificationRequired, true);

  const pending = await auth.listPendingPhoneVerifications();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].phone, '0912345678');
  assert.match(pending[0].code, /^\d{6}$/);

  await assert.rejects(() => auth.verifyPhoneCode(registration.user, '000000'), { code: 'invalid_otp' });
  const verified = await auth.verifyPhoneCode(registration.user, pending[0].code);
  assert.equal(verified.verified, true);
  assert.equal(verified.user.phoneVerified, true);
  assert.equal((await auth.listPendingPhoneVerifications()).length, 0);

  await assert.rejects(() => auth.verifyPhoneCode(registration.user, pending[0].code), { code: 'invalid_otp' });
  await repo.close();
});

test('phone OTP locks after five incorrect attempts', async () => {
  const repo = createMemoryRepo();
  const auth = createAuthService({ repo, config });
  const registration = await auth.register({
    phone: '0912345679',
    name: 'Second Player',
    pin: '123456',
    pinConfirm: '123456',
  });
  for (let i = 0; i < 4; i += 1) {
    await assert.rejects(() => auth.verifyPhoneCode(registration.user, '999999'));
  }
  await assert.rejects(() => auth.verifyPhoneCode(registration.user, '999999'), { code: 'otp_attempts_exceeded' });
  await assert.rejects(() => auth.verifyPhoneCode(registration.user, '999999'), { code: 'otp_attempts_exceeded' });
  await repo.close();
});
