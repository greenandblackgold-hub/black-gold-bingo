import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { build } from '../src/index.js';
import { loadConfig } from '../src/config.js';

let ctx;
let server;
let base;
let adminToken;

before(async () => {
  const config = loadConfig({
    NODE_ENV: 'test',
    STORAGE: 'memory',
    JWT_SECRET: 'realtime-test-secret-realtime-test-secret-123',
    RATE_LIMIT_AUTH: '1000',
    RATE_LIMIT_MONEY: '1000',
    RATE_LIMIT_DEFAULT: '1000',
  });
  ctx = await build(config);
  server = http.createServer((req, res) => ctx.app.handle(req, res));
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;

  await ctx.auth.createAdmin({ phone: '0900000001', name: 'Realtime Test Admin', pin: '654321' });
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0900000001', pin: '654321' }),
  });
  assert.equal(login.status, 200);
  adminToken = (await login.json()).token;
});

after(async () => {
  ctx?.game.stop();
  ctx?.bonus.stop();
  ctx?.gamesHub.stop();
  ctx?.app.close();
  server?.closeAllConnections?.();
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  await ctx?.repo.close();
});

test('SSE advertises the active frontend bundle and broadcasts successful admin changes', async () => {
  const controller = new AbortController();
  const response = await fetch(`${base}/api/stream`, { signal: controller.signal });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
  const reader = response.body.getReader();
  let buffered = '';

  const readUntil = async (pattern) => {
    while (!pattern.test(buffered)) {
      const { done, value } = await reader.read();
      if (done) throw new Error(`SSE closed before ${pattern}`);
      buffered += new TextDecoder().decode(value);
    }
  };

  try {
    await readUntil(/event: app-version\n/);
    assert.match(buffered, /"buildPath":/);
    await fetch(`${base}/api/admin/games/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ generalEnabled: false }),
    }).then(async (result) => {
      assert.equal(result.status, 200, await result.text());
    });
    await readUntil(/event: admin-change\n/);
    assert.match(buffered, /"path":"\/api\/admin\/games\/settings"/);
  } finally {
    controller.abort();
    await reader.cancel().catch(() => undefined);
  }
});
