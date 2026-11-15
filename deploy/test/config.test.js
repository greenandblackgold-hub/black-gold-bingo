import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

const productionEnv = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb+srv://example.invalid/blackgold',
  JWT_SECRET: 'a-long-test-secret-value-with-more-than-32-characters',
};

test('production registration is enabled by default for this deployment', () => {
  const config = loadConfig({ ...productionEnv });
  assert.equal(config.registrationEnabled, true);
});

test('production registration can still be disabled by deployment setting', () => {
  const config = loadConfig({ ...productionEnv, REGISTRATION_ENABLED: 'false' });
  assert.equal(config.registrationEnabled, false);
});
