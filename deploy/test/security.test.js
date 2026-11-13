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
  assert.equal(safe.registrationEnabled, false);
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

test('paid cards, deposits and cash-outs are blocked when real-money mode is off', async () => {
  const repo = createMemoryRepo();
  const config = loadConfig({ NODE_ENV: 'test', JWT_SECRET: secret });
  const auth = createAuthService({ repo, config });
  const player = await auth.createAdmin({ phone: '0911223345', name: 'Test', pin: '123456' });
  const game = createGameService({ repo, config });
  const wallet = createWalletService({ repo, config, chapa: {} });

  await assert.rejects(() => game.buyCards(player, 1), (e) => e.status === 503 && e.code === 'real_money_disabled');
  await assert.rejects(() => wallet.startDeposit(player, 100), (e) => e.status === 503 && e.code === 'real_money_disabled');
  await assert.rejects(
    () => wallet.requestWithdrawal(player, { amount: 50, accountName: 'Test', accountNumber: '12345678', bankCode: '1' }),
    (e) => e.status === 503 && e.code === 'real_money_disabled',
  );
  game.stop();
});
