import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createMaintenanceHandler } from '../src/index.js';

let server, base;

before(async () => {
  server = http.createServer(createMaintenanceHandler());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
});

test('maintenance mode serves only the safe notice and health endpoint', async () => {
  const page = await fetch(base + '/');
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /BLACK GOLD BINGO PRO/);
  assert.doesNotMatch(html, /debugOtp|send-otp|bingo_token/);

  const health = await fetch(base + '/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, mode: 'maintenance' });

  const api = await fetch(base + '/api/auth/register', { method: 'POST' });
  assert.equal(api.status, 503);
  assert.equal((await api.json()).error, 'maintenance');
});
