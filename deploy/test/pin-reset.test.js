import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/db/memoryRepo.js';
import { createAuthService } from '../src/services/authService.js';

const config = {
  registrationEnabled: true,
  jwtSecret: 'test-only-jwt-secret-that-is-at-least-32-characters',
};

test('admin-assisted PIN reset creates an admin-visible code and changes PIN exactly once', async () => {
  const repo = createMemoryRepo();
  const auth = createAuthService({ repo, config });
  await auth.register({ phone: '0912345678', name: 'PIN Reset Player', pin: '123456', pinConfirm: '123456' });

  const request = await auth.requestPinReset('0912345678');
  assert.equal(request.accepted, true);
  const pending = await auth.listPendingPinResets();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].phone, '0912345678');
  assert.match(pending[0].code, /^\\d{6}$/);

  const reset = await auth.resetPin({ phone: '0912345678', code: pending[0].code, pin: '654321', pinConfirm: '654321' });
  assert.equal(reset.reset, true);
  assert.equal((await auth.listPendingPinResets()).length, 0);
  await assert.rejects(() => auth.resetPin({ phone: '0912345678', code: pending[0].code, pin: '111111', pinConfirm: '111111' }), { code: 'invalid_reset_code' });
  const login = await auth.login({ phone: '0912345678', pin: '654321' });
  assert.equal(login.user.phone, '0912345678');
  await assert.rejects(() => auth.login({ phone: '0912345678', pin: '123456' }), { code: 'invalid_credentials' });
});

test('PIN reset code is attempt-limited and unknown phone requests do not reveal account existence', async () => {
  const repo = createMemoryRepo();
  const auth = createAuthService({ repo, config });
  const registration = await auth.register({ phone: '0912345679', name: 'Second Player', pin: '123456', pinConfirm: '123456' });
  assert.deepEqual(await auth.requestPinReset('0912345680'), {
    accepted: true,
    message: 'If the number belongs to a player account, an admin will provide the reset code.',
  });
  await auth.requestPinReset('0912345679');
  const pending = await auth.listPendingPinResets();
  const wrongCode = pending[0].code === '999999' ? '999998' : '999999';
  for (let i = 0; i < 4; i += 1) {
    await assert.rejects(() => auth.resetPin({ phone: registration.user.phone, code: wrongCode, pin: '654321', pinConfirm: '654321' }), { code: 'invalid_reset_code' });
  }
  await assert.rejects(() => auth.resetPin({ phone: registration.user.phone, code: wrongCode, pin: '654321', pinConfirm: '654321' }), { code: 'reset_attempts_exceeded' });
  assert.equal((await auth.listPendingPinResets()).length, 0);
});
