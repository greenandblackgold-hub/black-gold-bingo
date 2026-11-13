import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { loadConfig } from '../src/config.js';
import { build } from '../src/index.js';

let ctx, server, base, dir;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bingo-site-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Bingo</title><div id="root"></div>');
  fs.writeFileSync(path.join(dir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  fs.writeFileSync(path.join(os.tmpdir(), 'secret-outside.txt'), 'top secret');
  const config = loadConfig({
    NODE_ENV: 'test', STORAGE: 'memory', CHAPA_MOCK: 'true', STATIC_DIR: dir,
    JWT_SECRET: 'test-secret-test-secret-test-secret-123', ADMIN_PHONE: '+251900000042', ADMIN_PIN: '424242', ADMIN_NAME: 'Boss',
  });
  ctx = await build(config);
  server = http.createServer((req, res) => ctx.app.handle(req, res));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  ctx.game.stop();
  ctx.app.close();
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  fs.rmSync(dir, { recursive: true, force: true });
});

const get = (p, init) => fetch(base + p, { redirect: 'manual', ...init });

test('the server serves the website and falls back to the single page for app routes', async () => {
  const home = await get('/');
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-type'), /text\/html/);
  assert.match(home.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(home.headers.get('x-frame-options'), 'DENY');
  assert.match(await home.text(), /id="root"/);
  assert.match(await (await get('/wallet')).text(), /id="root"/);
  assert.equal((await get('/favicon.svg')).headers.get('content-type'), 'image/svg+xml');
  assert.equal((await get('/nope.js')).status, 404, 'a missing file is a real 404');
});

test('API paths never fall back to the website', async () => {
  const r = await get('/api/does-not-exist');
  assert.equal(r.status, 404);
  assert.equal((await r.json()).error, 'not_found');
  assert.equal((await get('/health')).status, 200);
  assert.equal((await get('/api/game')).headers.get('cache-control'), 'no-store');
});

test('path traversal cannot read files outside the website folder', async () => {
  for (const p of ['/../secret-outside.txt', '/%2e%2e/secret-outside.txt', '/..%2fsecret-outside.txt', '/%00', '/a/../../secret-outside.txt']) {
    const r = await get(p);
    const text = await r.text();
    assert.ok(!text.includes('top secret'), `leaked via ${p}`);
  }
});

test('the owner account is created from the settings, and PIN changes follow the settings', async () => {
  const login = (pin) => get('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '0900000042', pin }) });
  const ok = await login('424242');
  assert.equal(ok.status, 200);
  const j = await ok.json();
  assert.equal(j.user.role, 'admin');
  assert.equal(j.user.name, 'Boss');
  assert.equal(await ctx.auth.ensureAdmin({ phone: '0900000042', pin: '424242', name: 'Boss' }), 'ok', 'second start changes nothing');
  assert.equal(await ctx.auth.ensureAdmin({ phone: '0900000042', pin: '777777', name: 'Boss' }), 'updated', 'new PIN in settings is applied');
  assert.equal((await login('424242')).status, 401);
  assert.equal((await login('777777')).status, 200);
  assert.equal(await ctx.auth.ensureAdmin({ phone: 'abc', pin: '1' }), 'invalid');
});

test('defaults need no configuration on Render, and unsafe production settings are refused', () => {
  const cfg = loadConfig({
    NODE_ENV: 'production', RENDER: 'true', RENDER_EXTERNAL_URL: 'https://bingo.onrender.com', JWT_SECRET: 'x'.repeat(48),
    MONGODB_URI: 'mongodb://x', CHAPA_SECRET_KEY: 'CHASECK_TEST-1', ADMIN_PHONE: '0911223344', ADMIN_PIN: '123456',
  });
  assert.equal(cfg.publicApiUrl, 'https://bingo.onrender.com');
  assert.equal(cfg.clientUrl, 'https://bingo.onrender.com');
  assert.deepEqual(cfg.clientOrigins, ['https://bingo.onrender.com']);
  assert.equal(cfg.trustProxy, true);
  assert.equal(cfg.chapa.emailDomain, 'bingo.onrender.com');
  assert.equal(cfg.prizePercent, 80);
  assert.equal(cfg.autoPayout, false, 'cash-outs wait for the owner by default');
  assert.throws(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(48), MONGODB_URI: 'mongodb://x', CHAPA_SECRET_KEY: 'k', ADMIN_PHONE: '0911223344', ADMIN_PIN: '12' }), /ADMIN_PIN/);
});
