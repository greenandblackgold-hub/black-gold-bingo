import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { loadConfig } from '../src/config.js';
import { build } from '../src/index.js';

let ctx, server, base;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let seq = 0;
const newPhone = () => `09${String(10000000 + ++seq * 7919).slice(0, 8)}`;

async function api(method, path, { token, body, headers } = {}) {
  const res = await fetch(base + path, {
    method,
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, headers: res.headers };
}

async function newPlayer(name = 'Test Player', fund = 0) {
  const phone = newPhone();
  const r = await api('POST', '/api/auth/register', { body: { phone, name, pin: '123456' } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  if (fund) await ctx.repo.applyLedger({ userId: r.json.user.id, amount: fund * 100, kind: 'deposit', ref: `seed:${r.json.user.id}` });
  return { ...r.json, phone };
}

before(async () => {
  // Set TEST_MONGODB_URI to run this whole suite against a real MongoDB (a throwaway database is created and dropped).
  const mongo = process.env.TEST_MONGODB_URI;
  const config = loadConfig({
    NODE_ENV: 'test', STORAGE: mongo ? 'mongo' : 'memory', MONGODB_URI: mongo ?? '', DB_NAME: `bingo_test_${Date.now()}`, CHAPA_MOCK: 'true', CARD_PRICE_ETB: '10', PRIZE_PERCENT: '80',
    MIN_WITHDRAW_ETB: '50', RATE_LIMIT_AUTH: '100000', RATE_LIMIT_MONEY: '100000', RATE_LIMIT_DEFAULT: '100000', JWT_SECRET: 'test-secret-test-secret-test-secret-123', CLIENT_URL: 'http://web.test', CLIENT_ORIGINS: 'http://web.test',
  });
  ctx = await build(config);
  ctx.config = config;
  server = http.createServer((req, res) => ctx.app.handle(req, res));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
  config.publicApiUrl = base;
  ctx.chapa.publicApiUrl = base;
  const admin = await ctx.auth.createAdmin({ phone: '0900000001', name: 'Owner', pin: '654321' });
  ctx.adminToken = (await api('POST', '/api/auth/login', { body: { phone: '0900000001', pin: '654321' } })).json.token;
  assert.equal(admin.role, 'admin');
});

after(async () => {
  ctx.game.stop();
  if (ctx.repo.dropDatabase) await ctx.repo.dropDatabase();
  await ctx.repo.close();
  ctx.app.close();
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
});

/** Drive a fresh round to the "waiting" phase. */
async function freshRound() {
  const g = (await api('GET', '/api/game')).json;
  if (g.phase === 'running') await api('POST', '/api/admin/round/end', { token: ctx.adminToken });
  if ((await api('GET', '/api/game')).json.phase === 'ended') await api('POST', '/api/admin/round/reset', { token: ctx.adminToken });
}
const drawAll = async () => { for (let i = 0; i < 75; i++) await ctx.game.draw(); };

test('register, login, wrong PIN, lockout after 5 failures', async () => {
  const phone = newPhone();
  assert.equal((await api('POST', '/api/auth/register', { body: { phone, name: 'A', pin: '123456' } })).json.error, 'invalid_name');
  assert.equal((await api('POST', '/api/auth/register', { body: { phone: '123', name: 'Abebe', pin: '123456' } })).json.error, 'invalid_phone');
  assert.equal((await api('POST', '/api/auth/register', { body: { phone, name: 'Abebe', pin: '12' } })).json.error, 'invalid_pin');
  const ok = await api('POST', '/api/auth/register', { body: { phone, name: 'Abebe', pin: '123456' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.user.balance, 0);
  assert.equal(ok.json.user.role, 'player');
  assert.equal(ok.json.user.pinHash, undefined);
  assert.equal((await api('POST', '/api/auth/register', { body: { phone: '+251' + phone.slice(1), name: 'Dup', pin: '123456' } })).json.error, 'phone_taken');
  assert.equal((await api('POST', '/api/auth/login', { body: { phone, pin: '123456' } })).status, 200);
  for (let i = 0; i < 5; i++) assert.equal((await api('POST', '/api/auth/login', { body: { phone, pin: '000000' } })).status, 401);
  const locked = await api('POST', '/api/auth/login', { body: { phone, pin: '123456' } });
  assert.equal(locked.status, 429);
  assert.equal(locked.json.error, 'locked');
});

test('authorization: no token = 401, player on admin route = 403, forged token = 401', async () => {
  const p = await newPlayer();
  assert.equal((await api('GET', '/api/me')).status, 401);
  assert.equal((await api('POST', '/api/admin/draw', { token: p.token })).status, 403);
  assert.equal((await api('POST', '/api/admin/round/start', { token: p.token })).status, 403);
  assert.equal((await api('GET', '/api/admin/withdrawals', { token: p.token })).status, 403);
  assert.equal((await api('GET', '/api/me', { token: p.token + 'x' })).status, 401);
  const parts = p.token.split('.');
  const forged = [parts[0], Buffer.from(JSON.stringify({ sub: p.user.id, role: 'admin', exp: 9999999999 })).toString('base64url'), parts[2]].join('.');
  assert.equal((await api('POST', '/api/admin/draw', { token: forged })).status, 401);
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.role, 'player');
});

test('deposit via mock Chapa: credited once, replays and wrong amounts are harmless', async () => {
  const p = await newPlayer();
  const d = await api('POST', '/api/payments/deposit', { token: p.token, body: { amount: 100 } });
  assert.equal(d.status, 200);
  assert.match(d.json.checkoutUrl, /\/mock\/chapa\/checkout/);
  assert.equal((await api('POST', '/api/payments/deposit', { token: p.token, body: { amount: 5 } })).json.error, 'invalid_amount');
  assert.equal((await api('POST', '/api/payments/deposit', { token: p.token, body: { amount: 999999 } })).json.error, 'invalid_amount');

  // Before paying: still pending, nothing credited.
  assert.equal((await api('GET', `/api/payments/status/${d.json.txRef}`, { token: p.token })).json.status, 'pending');
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 0);

  // The player pays at the (fake) provider; the provider redirects back.
  const pay = await api('GET', `/mock/chapa/pay?tx_ref=${d.json.txRef}`);
  assert.equal(pay.status, 302);
  assert.match(pay.headers.get('location'), /tx_ref=/);

  // Callback + webhook + return-page polling all race: exactly one credit.
  await Promise.all([
    api('GET', `/api/payments/chapa/callback?trx_ref=${d.json.txRef}&status=success`),
    api('POST', '/api/payments/chapa/webhook', { body: { event: 'charge.success', tx_ref: d.json.txRef } }),
    api('GET', `/api/payments/status/${d.json.txRef}`, { token: p.token }),
    api('GET', `/api/payments/status/${d.json.txRef}`, { token: p.token }),
  ]);
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 100);
  await api('POST', '/api/payments/chapa/webhook', { body: { tx_ref: d.json.txRef } });
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 100);
  assert.equal((await api('GET', `/api/payments/status/${d.json.txRef}`, { token: p.token })).json.status, 'success');

  // Someone else cannot poll your payment.
  const other = await newPlayer();
  assert.equal((await api('GET', `/api/payments/status/${d.json.txRef}`, { token: other.token })).status, 404);

  // A "paid" confirmation with a different amount than we recorded is rejected.
  const d2 = await api('POST', '/api/payments/deposit', { token: p.token, body: { amount: 200 } });
  const mp = ctx.chapa.mockPayments.get(d2.json.txRef);
  mp.amount = 100; mp.paid = true;
  await api('GET', `/api/payments/chapa/callback?trx_ref=${d2.json.txRef}`);
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 100);
});

test('cards: buying, balance checks, round gating, server-issued grids', async () => {
  await freshRound();
  const p = await newPlayer('Buyer', 35);
  assert.equal((await api('POST', '/api/cards/buy', { token: p.token, body: { count: 0 } })).json.error, 'invalid_count');
  assert.equal((await api('POST', '/api/cards/buy', { token: p.token, body: { count: 21 } })).json.error, 'invalid_count');
  const poor = await api('POST', '/api/cards/buy', { token: p.token, body: { count: 4 } });
  assert.equal(poor.status, 402);
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 35);
  const bought = await api('POST', '/api/cards/buy', { token: p.token, body: { count: 3 } });
  assert.equal(bought.status, 200);
  assert.equal(bought.json.balance, 5);
  assert.equal(bought.json.cards.length, 3);
  assert.deepEqual(bought.json.cards.map((c) => c.serial), [1, 2, 3]);
  const mine = (await api('GET', '/api/cards', { token: p.token })).json;
  assert.equal(mine.length, 3);
  assert.equal((await api('GET', '/api/ledger', { token: p.token })).json.some((e) => e.kind === 'purchase' && e.amount === -30), true);
  await api('POST', '/api/admin/round/start', { token: ctx.adminToken });
  assert.equal((await api('POST', '/api/cards/buy', { token: p.token, body: { count: 1 } })).json.error, 'round_not_open');
  await api('POST', '/api/admin/round/end', { token: ctx.adminToken });
  await api('POST', '/api/admin/round/reset', { token: ctx.adminToken });
  assert.equal((await api('GET', '/api/cards', { token: p.token })).json.length, 0, 'cards belong to the round they were bought for');
});

test('a full round: server decides the winner, pays 80% of the pot once, and handles simultaneous claims', async () => {
  await freshRound();
  const a = await newPlayer('Alice', 100);
  const b = await newPlayer('Bob', 100);
  const ca = (await api('POST', '/api/cards/buy', { token: a.token, body: { count: 2 } })).json.cards;
  const cb = (await api('POST', '/api/cards/buy', { token: b.token, body: { count: 3 } })).json.cards;
  assert.equal((await api('GET', '/api/game')).json.phase, 'waiting');
  assert.equal((await api('POST', '/api/claim', { token: a.token, body: { cardId: ca[0].id } })).json.error, 'wrong_phase');

  await api('POST', '/api/admin/round/start', { token: ctx.adminToken });
  assert.equal((await api('POST', '/api/claim', { token: a.token, body: { cardId: ca[0].id } })).json.reason, 'no_line');
  await drawAll();
  assert.equal((await api('POST', '/api/admin/draw', { token: ctx.adminToken })).json.error, 'all_drawn');
  assert.equal((await api('GET', '/api/game')).json.calledNumbers.length, 75);

  // Cannot claim someone else's card or a card that does not exist.
  assert.equal((await api('POST', '/api/claim', { token: a.token, body: { cardId: cb[0].id } })).json.error, 'not_your_card');
  assert.equal((await api('POST', '/api/claim', { token: a.token, body: { cardId: 'BG-ZZZZZZ' } })).json.error, 'card_not_found');

  // Both claim at the same instant: exactly one wins.
  const [ra, rb] = await Promise.all([
    api('POST', '/api/claim', { token: a.token, body: { cardId: ca[0].id } }),
    api('POST', '/api/claim', { token: b.token, body: { cardId: cb[0].id } }),
  ]);
  const wins = [ra, rb].filter((r) => r.json.ok === true);
  assert.equal(wins.length, 1, `expected one winner, got ${JSON.stringify([ra.json, rb.json])}`);
  const prize = wins[0].json.prize;
  assert.equal(prize, 40); // pot = 5 cards x 10 = 50 ETB, 80% = 40
  const g = (await api('GET', '/api/game')).json;
  assert.equal(g.phase, 'ended');
  assert.ok(g.winner.cardId.startsWith('BG-'));
  assert.equal(g.winner.userId, undefined);

  const aWon = ra.json.ok === true;
  assert.equal((await api('GET', '/api/me', { token: a.token })).json.balance, aWon ? 100 - 20 + 40 : 100 - 20);
  assert.equal((await api('GET', '/api/me', { token: b.token })).json.balance, aWon ? 100 - 30 : 100 - 30 + 40);

  // Verify: owner sees the grid and winner flag; others only the status.
  const winnerCard = g.winner.cardId;
  const winnerToken = ra.json.ok ? a.token : b.token;
  const loserToken = ra.json.ok ? b.token : a.token;
  const mineV = (await api('POST', '/api/verify', { token: winnerToken, body: { cardId: winnerCard } })).json;
  assert.equal(mineV.status, 'valid');
  assert.equal(mineV.isWinner, true);
  assert.ok(Array.isArray(mineV.card.grid));
  const theirsV = (await api('POST', '/api/verify', { token: loserToken, body: { cardId: winnerCard } })).json;
  assert.equal(theirsV.status, 'valid');
  assert.equal(theirsV.card.grid, undefined);
  assert.equal((await api('POST', '/api/verify', { token: loserToken, body: { cardId: 'BG-NOPE22' } })).json.status, 'not_found');

  // Reset: the finished round is archived and its cards still verify.
  await api('POST', '/api/admin/round/reset', { token: ctx.adminToken });
  const after = (await api('POST', '/api/verify', { token: winnerToken, body: { cardId: winnerCard } })).json;
  assert.equal(after.status, 'valid');
  assert.equal(after.isWinner, true);
  assert.equal((await api('GET', '/api/game')).json.roundNumber > 1, true);
});

test('cash-out: hold on request, admin approves (paid) or rejects (refunded), balance guards', async () => {
  const p = await newPlayer('Winner', 200);
  const acct = { accountName: 'Winner Name', accountNumber: '0911000111', bankCode: '2' };
  assert.equal((await api('POST', '/api/withdrawals', { token: p.token, body: { ...acct, amount: 10 } })).json.error, 'invalid_amount');
  assert.equal((await api('POST', '/api/withdrawals', { token: p.token, body: { ...acct, amount: 500 } })).status, 402);
  assert.equal((await api('POST', '/api/withdrawals', { token: p.token, body: { ...acct, bankCode: 'x', amount: 60 } })).json.error, 'invalid_account');

  const w1 = (await api('POST', '/api/withdrawals', { token: p.token, body: { ...acct, amount: 60 } })).json;
  assert.equal(w1.status, 'pending');
  assert.equal(w1.balance, 140);
  const w2 = (await api('POST', '/api/withdrawals', { token: p.token, body: { ...acct, amount: 70 } })).json;
  assert.equal(w2.balance, 70);

  assert.equal((await api('POST', `/api/admin/withdrawals/${w1.id}/approve`, { token: p.token })).status, 403);
  const listed = (await api('GET', '/api/admin/withdrawals?status=pending', { token: ctx.adminToken })).json;
  assert.ok(listed.some((w) => w.id === w1.id));

  assert.equal((await api('POST', `/api/admin/withdrawals/${w1.id}/approve`, { token: ctx.adminToken })).json.status, 'paid');
  assert.equal((await api('POST', `/api/admin/withdrawals/${w1.id}/approve`, { token: ctx.adminToken })).json.error, 'wrong_status', 'cannot pay twice');
  assert.equal((await api('POST', `/api/admin/withdrawals/${w2.id}/reject`, { token: ctx.adminToken, body: { note: 'ID mismatch' } })).json.status, 'rejected');
  assert.equal((await api('POST', `/api/admin/withdrawals/${w2.id}/reject`, { token: ctx.adminToken })).json.error, 'wrong_status', 'cannot refund twice');
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 140, 'paid cash-out stays debited, rejected one is refunded');
  assert.deepEqual((await api('GET', '/api/withdrawals', { token: p.token })).json.map((w) => w.status).sort(), ['paid', 'rejected']);
});

test('live stream: clients receive the new state when the host draws', async () => {
  await freshRound();
  await api('POST', '/api/admin/round/start', { token: ctx.adminToken });
  const events = [];
  const ac = new AbortController();
  const res = await fetch(base + '/api/stream', { signal: ac.signal });
  assert.equal(res.headers.get('content-type'), 'text/event-stream');
  const reader = res.body.getReader();
  (async () => {
    const dec = new TextDecoder();
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value);
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          const m = chunk.match(/^data: (.*)$/m);
          if (m) events.push(JSON.parse(m[1]));
        }
      }
    } catch { /* aborted */ }
  })();
  await sleep(150);
  assert.ok(events.length >= 1, 'initial state is sent on connect');
  const before = events.at(-1).calledNumbers.length;
  await api('POST', '/api/admin/draw', { token: ctx.adminToken });
  await sleep(150);
  assert.equal(events.at(-1).calledNumbers.length, before + 1);
  assert.equal(events.at(-1).roomId, 'BINGO-99');
  ac.abort();
  await api('POST', '/api/admin/round/end', { token: ctx.adminToken });
});

test('auto-call runs on the server and resumes after a restart', async () => {
  await freshRound();
  await api('POST', '/api/admin/round/start', { token: ctx.adminToken });
  await api('POST', '/api/admin/auto', { token: ctx.adminToken, body: { on: true, intervalSec: 1 } });
  await sleep(2400);
  const n1 = (await api('GET', '/api/game')).json.calledNumbers.length;
  assert.ok(n1 >= 2, `auto-call drew ${n1} numbers`);

  // "Restart": stop the timer, build a fresh service on the same database, resume.
  ctx.game.stop();
  const frozen = (await api('GET', '/api/game')).json.calledNumbers.length;
  await sleep(1300);
  assert.equal((await api('GET', '/api/game')).json.calledNumbers.length, frozen, 'nothing draws while the process is down');
  await ctx.game.resume();
  await sleep(1500);
  assert.ok((await api('GET', '/api/game')).json.calledNumbers.length > frozen, 'drawing continues after resume');

  await api('POST', '/api/admin/auto', { token: ctx.adminToken, body: { on: false } });
  const stopped = (await api('GET', '/api/game')).json.calledNumbers.length;
  await sleep(1300);
  assert.equal((await api('GET', '/api/game')).json.calledNumbers.length, stopped);
  await api('POST', '/api/admin/round/end', { token: ctx.adminToken });
});

test('rate limiting and CORS', async () => {
  ctx.config.rateLimits.auth = 10;
  ctx.app.resetLimits();
  const bad = await api('POST', '/api/auth/login', { body: { phone: '0900000099', pin: '000000' }, headers: { Origin: 'http://web.test' } });
  assert.equal(bad.headers.get('access-control-allow-origin'), 'http://web.test');
  const evil = await api('GET', '/health', { headers: { Origin: 'http://evil.test' } });
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
  let limited = false;
  for (let i = 0; i < 15; i++) {
    const r = await api('POST', '/api/auth/login', { body: { phone: '0900000098', pin: '000000' } });
    if (r.status === 429 && r.json.error === 'rate_limited') limited = true;
  }
  assert.equal(limited, true);
});
