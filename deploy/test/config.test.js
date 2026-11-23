import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

const productionEnv = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb+srv://example.invalid/blackgold',
  JWT_SECRET: 'a-long-test-secret-value-with-more-than-32-characters',
};

test('production shared Games Center wallet is disabled until both written approvals exist', () => {
  assert.equal(loadConfig({ ...productionEnv }).gamesHubSharedWalletEnabled, false);
  assert.throws(
    () => loadConfig({ ...productionEnv, GAMES_HUB_SHARED_WALLET_ENABLED: 'true' }),
    /GAMES_HUB_SHARED_WALLET_ENABLED requires LOTTERY_LICENSE_APPROVED and CHAPA_MERCHANT_APPROVED/,
  );
  const approved = loadConfig({
    ...productionEnv,
    GAMES_HUB_SHARED_WALLET_ENABLED: 'true',
    LOTTERY_LICENSE_APPROVED: 'true',
    CHAPA_MERCHANT_APPROVED: 'true',
  });
  assert.equal(approved.gamesHubSharedWalletEnabled, true);
});

test('production registration is enabled by default for this deployment', () => {
  const config = loadConfig({ ...productionEnv });
  assert.equal(config.registrationEnabled, true);
});

test('production registration can still be disabled by deployment setting', () => {
  const config = loadConfig({ ...productionEnv, REGISTRATION_ENABLED: 'false' });
  assert.equal(config.registrationEnabled, false);
});


test('production manual bank deposits require lottery authorization but not Chapa approval', () => {
  assert.equal(loadConfig({ ...productionEnv }).realMoneyEnabled, false);
  assert.throws(
    () => loadConfig({ ...productionEnv, REAL_MONEY_ENABLED: 'true' }),
    /LOTTERY_LICENSE_APPROVED is required/,
  );
  const approved = loadConfig({
    ...productionEnv,
    REAL_MONEY_ENABLED: 'true',
    LOTTERY_LICENSE_APPROVED: 'true',
  });
  assert.equal(approved.realMoneyEnabled, true);
  assert.equal(approved.chapaMerchantApproved, false);
});

test('Android Capacitor WebView origin is allowed without dropping configured website origins', () => {
  const config = loadConfig({ ...productionEnv, CLIENT_ORIGINS: 'https://black-gold-bingo.onrender.com' });
  assert.deepEqual(config.clientOrigins, ['https://black-gold-bingo.onrender.com', 'https://localhost']);
});
