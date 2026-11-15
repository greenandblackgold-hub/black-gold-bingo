import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { createMemoryRepo } from '../src/db/memoryRepo.js';
import { createAuthService } from '../src/services/authService.js';
import { createGameService } from '../src/services/gameService.js';
import { createWalletService } from '../src/services/walletService.js';
import { hashSecret } from '../src/util/crypto.js';

const secret = 'test-secret-test-secret-test-secret-123';

test('production real-money mode is off unless explicitly approved', () => {
  const safe = loadConfig({
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb://example.invalid/db',
    JWT_SECRET: secret,
  });
  assert.equal(safe.registrationEnabled, true);
  assert.equal(safe.realMoneyEnabled, false);
  assert.equal(safe.lotteryLicenseApproved, false);
  assert.equal(safe.chapaMerchantApproved, false);
  assert.throws(() => loadConfig({
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb://example.invalid/db',
    JWT_SECRET: secret,
    REAL_MONEY_ENABLED: 'true',
  }), /LOTTERY_LICENSE_APPROVED/);
  assert.throws(() => loadConfig({
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb://example.invalid/db',
    JWT_SECRET: secret,
    REAL_MONEY_ENABLED: 'true',
    LOTTERY_LICENSE_APPROVED: 'true',
    CHAPA_MERCHANT_APPROVED: 'true',
  }), /CHAPA_SECRET_KEY/);
  const approved = loadConfig({
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb://example.invalid/db',
    JWT_SECRET: secret,
    REAL_MONEY_ENABLED: 'true',
    LOTTERY_LICENSE_APPROVED: 'true',
    CHAPA_MERCHANT_APPROVED: 'true',
    CHAPA_SECRET_KEY: 'live-key-placeholder',
  });
  assert.equal(approved.realMoneyEnabled, true);
});

test('a player account cannot be silently promoted to admin by startup settings', async () => {
  const repo = createMemoryRepo();
  const config = loadConfig({ NODE_ENV: 'test', JWT_SECRET: secret });
  const auth = createAuthService({ repo, config });
  const player = await repo.createUser({
    phone: '0911223344',
    name: 'Existing player',
    pinHash: await hashSecret('123456'),
    role: 'player',
  });
  await assert.rejects(
    () => auth.ensureAdmin({ phone: player.phone, pin: '654321', name: 'Owner' }),
    /already belongs to a player account/,
  );
  assert.equal((await repo.findUserByPhone(player.phone)).role, 'player');
});

test('simulation cards are playable while real-money deposits and cash-outs are blocked without approval', async () => {
  const repo = createMemoryRepo();
  const config = loadConfig({ NODE_ENV: 'test', JWT_SECRET: secret, CARD_PRICE_ETB: '10' });
  const auth = createAuthService({ repo, config });
  const player = await auth.createAdmin({ phone: '0911223345', name: 'Test', pin: '123456' });
  await repo.applyLedger({ userId: player.id, amount: 1000, kind: 'deposit', ref: 'seed-security-card-test' });
  const game = createGameService({ repo, config });
  const wallet = createWalletService({ repo, config, chapa: {} });

  const purchase = await game.buyCards(player, 1);
  assert.equal(purchase.cards.length, 1);
  assert.equal(purchase.balance, 0);
  assert.equal((await game.getPublicState()).cardPrice, 10);
  await assert.rejects(() => wallet.startDeposit(player, 100), (e) => e.status === 503 && e.code === 'real_money_disabled');
  await assert.rejects(
    () => wallet.requestWithdrawal(player, { amount: 50, accountName: 'Test', accountNumber: '12345678', bankCode: '1' }),
    (e) => e.status === 503 && e.code === 'real_money_disabled',
  );
  game.stop();
});

test('registration rejects a mismatched PIN confirmation on the server', async () => {
  const repo = createMemoryRepo();
  const config = loadConfig({ NODE_ENV: 'test', JWT_SECRET: secret });
  const auth = createAuthService({ repo, config });
  await assert.rejects(
    () => auth.register({ phone: '0911223346', name: 'Mismatch', pin: '123456', pinConfirm: '654321' }),
    (e) => e.status === 400 && e.code === 'pin_mismatch',
  );
});

test('failed withdrawal transition and refund are applied together exactly once', async () => {
  const repo = createMemoryRepo();
  const user = await repo.createUser({ phone: '0911223347', name: 'Refund', pinHash: await hashSecret('123456') });
  await repo.applyLedger({ userId: user.id, amount: 10000, kind: 'deposit', ref: 'seed-refund-test' });
  await repo.requestWithdrawal({ id: 'wd-test', userId: user.id, amount: 5000, accountName: 'Refund User', accountNumber: '0911223344', bankCode: '1' });
  assert.equal((await repo.findUserById(user.id)).balance, 5000);
  const failed = await repo.transitionWithdrawalAndRefund('wd-test', ['processing'], 'failed');
  assert.equal(failed, null, 'cannot refund while status is pending');
  const rejected = await repo.transitionWithdrawalAndRefund('wd-test', ['pending'], 'rejected');
  assert.equal(rejected.status, 'rejected');
  assert.equal((await repo.findUserById(user.id)).balance, 10000);
  assert.equal(await repo.transitionWithdrawalAndRefund('wd-test', ['pending'], 'rejected'), null, 'second refund is blocked by status transition');
  assert.equal((await repo.listLedger(user.id)).filter((x) => x.kind === 'withdraw_refund').length, 1);
});

test('production registration is open without SMS verification when enabled', async () => {
  const config = loadConfig({
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb://example.invalid/db',
    JWT_SECRET: secret,
    REGISTRATION_ENABLED: 'true',
  });
  const repo = createMemoryRepo();
  const auth = createAuthService({ repo, config });
  const player = await auth.register({ phone: '0911223344', name: 'New Player', pin: '123456', pinConfirm: '123456' });
  assert.equal(player.user.phone, '0911223344');
  assert.equal(player.user.role, 'player');
  assert.ok(player.token);
});
