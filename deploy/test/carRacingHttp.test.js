import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/http/app.js';
import { createCarRacingDemoService } from '../src/services/carRacingDemoService.js';

test('two distinct authenticated accounts complete the real Car Racing HTTP room flow', async (t) => {
  let clock = 1_800_000_000_000;
  const drivers = new Map([
    ['token-driver-a', { id: 'driver-a', name: 'Driver A', role: 'player', phoneVerified: true }],
    ['token-driver-b', { id: 'driver-b', name: 'Driver B', role: 'player', phoneVerified: true }],
  ]);
  const carRacing = createCarRacingDemoService({ isRealMoneyEnabled: () => false, now: () => clock });
  const app = createApp({
    config: {
      prod: false, registrationEnabled: true, trustProxy: false, clientOrigins: [],
      rateLimits: { default: 1000, auth: 1000, money: 1000, 'car-racing': 2000 },
    },
    auth: { authenticate: async (token) => drivers.get(token) ?? null },
    game: {}, wallet: {}, chapa: {}, repo: { kind: 'test' }, push: {},
    gamesHub: { assertGameEnabled: async () => true },
    carRacing,
  });
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    app.close();
    await new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (token, method, path, body) => {
    const response = await fetch(base + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json();
    assert.equal(response.status, 200, `${method} ${path}: ${JSON.stringify(payload)}`);
    return payload;
  };

  const created = await request('token-driver-a', 'POST', '/api/games/car-racing/rooms', { entryFeeEtb: 10 });
  assert.equal(created.players.length, 1);
  assert.equal(created.players[0].userId, 'driver-a');

  const joined = await request('token-driver-b', 'POST', '/api/games/car-racing/join', { code: created.code });
  assert.equal(joined.players.length, 2);
  assert.deepEqual(new Set(joined.players.map((player) => player.userId)), new Set(['driver-a', 'driver-b']));

  const firstReady = await request('token-driver-a', 'POST', '/api/games/car-racing/ready', { roomId: created.roomId, ready: true });
  assert.equal(firstReady.status, 'lobby');
  const secondReady = await request('token-driver-b', 'POST', '/api/games/car-racing/ready', { roomId: created.roomId, ready: true });
  assert.equal(secondReady.status, 'countdown');
  assert.equal(secondReady.players.length, 2);
  assert.ok(secondReady.players.every((player) => player.ready));

  clock += 3_100;
  const stateA = await request('token-driver-a', 'GET', '/api/games/car-racing/state');
  const stateB = await request('token-driver-b', 'GET', '/api/games/car-racing/state');
  assert.equal(stateA.room.status, 'racing');
  assert.equal(stateB.room.status, 'racing');
  assert.equal(stateA.room.players.length, 2);
  assert.equal(stateB.room.players.length, 2);
  assert.equal(stateA.room.players.find((player) => player.isMe).userId, 'driver-a');
  assert.equal(stateB.room.players.find((player) => player.isMe).userId, 'driver-b');

  assert.deepEqual(await request('token-driver-a', 'POST', '/api/games/car-racing/control', {
    roomId: created.roomId, throttle: 1, steer: 0.25, boost: true,
  }), { ok: true });
  assert.deepEqual(await request('token-driver-b', 'POST', '/api/games/car-racing/control', {
    roomId: created.roomId, throttle: 1, steer: -0.25,
  }), { ok: true });
});
