import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHmac } from 'node:crypto';
import { loadConfig } from '../src/config.js';
import { build } from '../src/index.js';
import { findWinningPattern, patternMasks } from '../src/game/engine.js';

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
  const r = await api('POST', '/api/auth/register', { body: { phone, name, pin: '123456', pinConfirm: '123456' } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const queue = await api('GET', '/api/admin/phone-verifications', { token: ctx.adminToken });
  const pending = queue.json.find((item) => item.phone === phone);
  assert.ok(pending, 'new player OTP must appear in the admin verification queue');
  const verified = await api('POST', '/api/auth/phone-otp/verify', { token: r.json.token, body: { code: pending.code } });
  assert.equal(verified.status, 200, JSON.stringify(verified.json));
  if (fund) await ctx.repo.applyLedger({ userId: r.json.user.id, amount: fund * 100, kind: 'deposit', ref: `seed:${r.json.user.id}` });
  return { ...r.json, user: verified.json.user, phone };
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


test('directional winning patterns accept all rotated and mirrored orientations', () => {
  const grid = Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 5 }, (_, col) => r === 2 && col === 2 ? null : r * 5 + col + 1),
  );
  for (const pattern of ['t', 'l', 'z', 'u', 's', 'arrow_up', 'arrow_down', 'letter_h', 'letter_e', 'letter_c', 'letter_n', 'letter_w', 'lucky_seven']) {
    const masks = patternMasks(pattern);
    assert.ok(masks.length > 1, `${pattern} should expose multiple orientations`);
    for (const mask of masks) {
      const called = new Set(mask.map(([r, col]) => grid[r][col]).filter((value) => value !== null));
      assert.equal(findWinningPattern(grid, called, pattern).missing, 0, `${pattern} orientation should be accepted`);
    }
  }
  assert.equal(patternMasks('t').length, 4, 'T has four distinct rotations');
  assert.equal(patternMasks('l').length, 4, 'L has four distinct board orientations');
});

test('General Games Center OFF hides the player center, blocks new entries, and preserves announcement opt-in', async () => {
  const p = await newPlayer('General maintenance player', 100);
  const saved = await api('POST', '/api/admin/games/settings', { token: ctx.adminToken, body: { announcementText: 'Scheduled maintenance. Please return shortly.', announcementVisible: false } });
  assert.equal(saved.status, 200);
  const hiddenMessage = await api('POST', '/api/admin/games/settings', { token: ctx.adminToken, body: { generalEnabled: false } });
  assert.equal(hiddenMessage.status, 200);
  let settings = await api('GET', '/api/games/settings', { token: p.token });
  assert.equal(settings.json.generalEnabled, false);
  assert.equal(settings.json.announcement, null);
  const blockedCard = await api('POST', '/api/cards/buy', { token: p.token, body: { count: 1 } });
  assert.equal(blockedCard.status, 503);
  assert.equal(blockedCard.json.error, 'games_center_disabled');
  const blockedKeno = await api('POST', '/api/games/keno/bets', { token: p.token, body: { requestId: 'maintenance_keno_01', amount: 2, selectedNumbers: [1] } });
  assert.equal(blockedKeno.status, 503);
  assert.equal(blockedKeno.json.error, 'games_center_disabled');
  const blockedAviator = await api('POST', '/api/games/aviator/bets', { token: p.token, body: { requestId: 'maintenance_av_01', amount: 5 } });
  assert.equal(blockedAviator.status, 503);
  assert.equal(blockedAviator.json.error, 'games_center_disabled');
  await api('POST', '/api/admin/games/settings', { token: ctx.adminToken, body: { announcementVisible: true } });
  settings = await api('GET', '/api/games/settings', { token: p.token });
  assert.equal(settings.json.announcement, 'Scheduled maintenance. Please return shortly.');
  await api('POST', '/api/admin/games/settings', { token: ctx.adminToken, body: { generalEnabled: true, announcementVisible: false, announcementText: '' } });
  settings = await api('GET', '/api/games/settings', { token: p.token });
  assert.equal(settings.json.generalEnabled, true);
  assert.equal(settings.json.announcement, null);
});

test('Host can hide Bingo, Keno and Aviator from player access while keeping the existing game engines intact', async () => {
  const p = await newPlayer('Game availability player', 100);
  const before = await api('GET', '/api/games/settings', { token: p.token });
  assert.equal(before.status, 200);
  assert.equal(before.json.bingoEnabled, true);
  assert.equal(before.json.kenoEnabled, true);
  assert.equal(before.json.aviatorEnabled, true);
  const disabled = await api('POST', '/api/admin/games/settings', { token: ctx.adminToken, body: { bingoEnabled: false, kenoEnabled: false, aviatorEnabled: false } });
  assert.equal(disabled.status, 200);
  const after = await api('GET', '/api/games/settings', { token: p.token });
  assert.equal(after.json.bingoEnabled, false);
  assert.equal(after.json.kenoEnabled, false);
  assert.equal(after.json.aviatorEnabled, false);
  const blockedBingoPurchase = await api('POST', '/api/cards/buy', { token: p.token, body: { count: 1 } });
  assert.equal(blockedBingoPurchase.status, 503);
  assert.equal(blockedBingoPurchase.json.error, 'game_disabled');
  const blockedKenoBet = await api('POST', '/api/games/keno/bets', { token: p.token, body: { requestId: 'keno_closed_001', amount: 2, selectedNumbers: [1] } });
  assert.equal(blockedKenoBet.status, 503);
  assert.equal(blockedKenoBet.json.error, 'game_disabled');
  const blockedAviatorBet = await api('POST', '/api/games/aviator/bets', { token: p.token, body: { requestId: 'aviator_closed_001', amount: 5 } });
  assert.equal(blockedAviatorBet.status, 503);
  assert.equal(blockedAviatorBet.json.error, 'game_disabled');
  const enabled = await api('POST', '/api/admin/games/settings', { token: ctx.adminToken, body: { bingoEnabled: true, kenoEnabled: true, aviatorEnabled: true } });
  assert.equal(enabled.status, 200);
  const restored = await api('GET', '/api/games/settings', { token: p.token });
  assert.equal(restored.json.bingoEnabled, true);
  assert.equal(restored.json.kenoEnabled, true);
  assert.equal(restored.json.aviatorEnabled, true);
});

test('register, login, wrong PIN, lockout after 5 failures', async () => {
  const phone = newPhone();
  assert.equal((await api('POST', '/api/auth/register', { body: { phone, name: 'A', pin: '123456', pinConfirm: '123456' } })).json.error, 'invalid_name');
  assert.equal((await api('POST', '/api/auth/register', { body: { phone: '123', name: 'Abebe', pin: '123456', pinConfirm: '123456' } })).json.error, 'invalid_phone');
  assert.equal((await api('POST', '/api/auth/register', { body: { phone, name: 'Abebe', pin: '12', pinConfirm: '12' } })).json.error, 'invalid_pin');
  const ok = await api('POST', '/api/auth/register', { body: { phone, name: 'Abebe', pin: '123456', pinConfirm: '123456' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.user.balance, 0);
  assert.equal(ok.json.user.role, 'player');
  assert.equal(ok.json.user.pinHash, undefined);
  assert.equal((await api('POST', '/api/auth/register', { body: { phone: '+251' + phone.slice(1), name: 'Dup', pin: '123456', pinConfirm: '123456' } })).json.error, 'phone_taken');
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

const telebirrReceipt = (reference, ageHours = 0, account = '1000737138686') => {
  const local = new Date(Date.now() + 3 * 60 * 60_000 - ageHours * 60 * 60_000);
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`;
  return `ውድ Customer ከቴሌ ብር አካውንትዎ 251900000000 ለ Commercial Bank of Ethiopia አካውንት ቁጥር ${account} 125.50 ብር በቀን ${stamp} በተሳካ ሁኔታ አስተላልፈዋል። የቴሌብር ሂሳብ እንቅስቃሴ ቁጥርዎ DKK7G8RIQH እና የባንክ ሂሳብ እንቅስቃሴ ቁጥርዎ ${reference} ነው።`;
};

test('admin phone SMS automatically matches deposit requests but wallet credit still requires admin approval', async () => {
  const p = await newPlayer();
  const request = await api('POST', '/api/simulation/deposits', {
    token: p.token, body: { amount: 125.5, reference: 'FT26325ZWP2R', provider: 'Telebirr' },
  });
  assert.equal(request.status, 200, JSON.stringify(request.json));
  assert.equal(request.json.status, 'pending');
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 0);


  const device = await api('POST', '/api/admin/sms-device/token', { token: ctx.adminToken, body: {} });
  assert.equal(device.status, 200, JSON.stringify(device.json));
  assert.ok(device.json.token);
  const smsBody = 'Your account is credited with ETB 125.50. Available balance is ETB 2,450.00. Ref No: FT26325ZWP2R';
  const matched = await api('POST', '/api/webhooks/sms/device', {
    headers: { Authorization: `Bearer ${device.json.token}` },
    body: { sender: 'CBE', text: smsBody, eventId: 'admin-phone-sms-001', receivedAt: Date.now() },
  });
  assert.equal(matched.status, 200, JSON.stringify(matched.json));
  assert.equal(matched.json.status, 'matched');
  assert.equal(matched.json.matched, true);
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 0,
    'SMS matching must never credit the wallet automatically');

  const duplicate = await api('POST', '/api/webhooks/sms/device', {
    headers: { Authorization: `Bearer ${device.json.token}` },
    body: { sender: 'CBE', text: smsBody, eventId: 'admin-phone-sms-001', receivedAt: Date.now() },
  });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.json.duplicate, true);

  const approved = await api('POST', '/api/admin/deposits/FT26325ZWP2R/approve', { token: ctx.adminToken });
  assert.equal(approved.status, 200, JSON.stringify(approved.json));
  assert.equal(approved.json.credited, true);
  const replay = await api('POST', '/api/admin/deposits/FT26325ZWP2R/approve', { token: ctx.adminToken });
  assert.equal(replay.json.credited, false);
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 125.5);

  const mismatchRequest = await api('POST', '/api/simulation/deposits', {
    token: p.token, body: { amount: 50, reference: 'TXN-MISMATCH-123' },
  });
  assert.equal(mismatchRequest.status, 200);
  const mismatch = await api('POST', '/api/webhooks/sms/device', {
    headers: { Authorization: `Bearer ${device.json.token}` },
    body: { sender: 'CBE', text: 'Your account is credited with ETB 60.00. Ref No: TXN-MISMATCH-123', eventId: 'admin-phone-sms-002', receivedAt: Date.now() },
  });
  assert.equal(mismatch.status, 200);
  assert.equal(mismatch.json.status, 'amount-mismatch');
  await api('POST', '/api/admin/deposits/TXN-MISMATCH-123/reject', { token: ctx.adminToken });
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 125.5);

  // The admin SMS may arrive just before the player submits the request; keep it briefly and match later.
  const earlySms = await api('POST', '/api/webhooks/sms/device', {
    headers: { Authorization: `Bearer ${device.json.token}` },
    body: { sender: 'CBE', text: 'Your account is credited with ETB 75.00. Ref No: TXN-EARLY-12345', eventId: 'admin-phone-sms-early', receivedAt: Date.now() },
  });
  assert.equal(earlySms.status, 200);
  assert.equal(earlySms.json.status, 'unmatched');
  const lateRequest = await api('POST', '/api/simulation/deposits', {
    token: p.token, body: { amount: 75, reference: 'TXN-EARLY-12345' },
  });
  assert.equal(lateRequest.status, 200);
  const earlyRow = (await api('GET', '/api/admin/deposits?status=pending', { token: ctx.adminToken })).json.find((row) => row.reference === 'TXN-EARLY-12345');
  assert.equal(earlyRow.smsMatch.status, 'matched');
  const earlyApproved = await api('POST', '/api/admin/deposits/TXN-EARLY-12345/approve', { token: ctx.adminToken });
  assert.equal(earlyApproved.status, 200);
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 200.5);
});



test('trusted Telebirr-to-configured-CBE SMS auto-approves exact deposits once, including SMS-first transition', async () => {
  const p = await newPlayer();
  const device = await api('POST', '/api/admin/sms-device/token', { token: ctx.adminToken, body: {} });
  assert.equal(device.status, 200);

  const first = await api('POST', '/api/simulation/deposits', {
    token: p.token, body: { amount: 125.5, reference: 'FT-AUTO-EXACT-001' },
  });
  assert.equal(first.status, 200);
  assert.equal(first.json.status, 'pending');

  const sms = await api('POST', '/api/webhooks/sms/device', {
    headers: { Authorization: `Bearer ${device.json.token}` },
    body: { sender: 'Telebirr', text: telebirrReceipt('FT-AUTO-EXACT-001'), eventId: 'trusted-telebirr-auto-001', receivedAt: Date.now() },
  });
  assert.equal(sms.status, 200, JSON.stringify(sms.json));
  assert.equal(sms.json.status, 'auto-approved');
  assert.equal(sms.json.credited, true);
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 125.5);

  const replay = await api('POST', '/api/webhooks/sms/device', {
    headers: { Authorization: `Bearer ${device.json.token}` },
    body: { sender: 'Telebirr', text: telebirrReceipt('FT-AUTO-EXACT-001'), eventId: 'trusted-telebirr-auto-001', receivedAt: Date.now() },
  });
  assert.equal(replay.json.duplicate, true);
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 125.5);
  assert.equal((await api('GET', '/api/ledger', { token: p.token })).json.filter((row) => row.kind === 'deposit').length, 1);

  // Transition case: trusted SMS arrives before the player creates the request.
  const early = await api('POST', '/api/webhooks/sms/device', {
    headers: { Authorization: `Bearer ${device.json.token}` },
    body: { sender: 'Telebirr', text: telebirrReceipt('FT-AUTO-EARLY-002'), eventId: 'trusted-telebirr-auto-early-002', receivedAt: Date.now() },
  });
  assert.equal(early.status, 200);
  assert.equal(early.json.status, 'unmatched');

  const late = await api('POST', '/api/simulation/deposits', {
    token: p.token, body: { amount: 125.5, reference: 'FT-AUTO-EARLY-002' },
  });
  assert.equal(late.status, 200, JSON.stringify(late.json));
  assert.equal(late.json.status, 'success');
  assert.equal(late.json.approved, true);
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 251);
  assert.equal((await api('GET', '/api/ledger', { token: p.token })).json.filter((row) => row.kind === 'deposit').length, 2);
});

test('Admin can manually approve an unmatched deposit only through the explicit exception action', async () => {
  const p = await newPlayer();
  const request = await api('POST', '/api/simulation/deposits', {
    token: p.token, body: { amount: 45, reference: 'TXN-MANUAL-EXCEPTION-1' },
  });
  assert.equal(request.status, 200);
  assert.equal(request.json.status, 'pending');
  const approved = await api('POST', '/api/admin/deposits/TXN-MANUAL-EXCEPTION-1/approve', { token: ctx.adminToken });
  assert.equal(approved.status, 200);
  assert.equal(approved.json.credited, true);
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 45);
});

test('simulation deposits require admin review and credit exactly once', async () => {
  const p = await newPlayer();
  const created = await api('POST', '/api/simulation/deposits', { token: p.token, body: { amount: 125.50, reference: 'TXN-ADMIN-12345' } });
  assert.equal(created.status, 200, JSON.stringify(created.json));
  assert.equal(created.json.status, 'pending');
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 0);
  assert.equal((await api('GET', '/api/simulation/deposits/TXN-ADMIN-12345', { token: p.token })).json.status, 'pending');

  assert.equal((await api('GET', '/api/admin/deposits', { token: p.token })).status, 403);
  const listed = await api('GET', '/api/admin/deposits?status=pending', { token: ctx.adminToken });
  assert.equal(listed.status, 200);
  assert.ok(listed.json.some((row) => row.reference === 'TXN-ADMIN-12345' && row.amount === 125.5 && row.userId === p.user.id));

  const smsDevice = await api('POST', '/api/admin/sms-device/token', { token: ctx.adminToken, body: {} });
  const smsMatch = await api('POST', '/api/webhooks/sms/device', {
    headers: { Authorization: `Bearer ${smsDevice.json.token}` },
    body: { sender: 'CBE', text: 'Your account is credited with ETB 125.50. Ref No: TXN-ADMIN-12345', eventId: 'admin-queue-sms-12345', receivedAt: Date.now() },
  });
  assert.equal(smsMatch.status, 200, JSON.stringify(smsMatch.json));
  assert.equal(smsMatch.json.status, 'matched');

  const approved = await api('POST', '/api/admin/deposits/TXN-ADMIN-12345/approve', { token: ctx.adminToken });
  assert.equal(approved.status, 200, JSON.stringify(approved.json));
  assert.equal(approved.json.status, 'success');
  assert.equal(approved.json.credited, true);
  const replay = await api('POST', '/api/admin/deposits/TXN-ADMIN-12345/approve', { token: ctx.adminToken });
  assert.equal(replay.json.status, 'success');
  assert.equal(replay.json.credited, false);
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 125.5);
  assert.equal((await api('GET', '/api/simulation/deposits/TXN-ADMIN-12345', { token: p.token })).json.status, 'success');
  const history = await api('GET', '/api/simulation/deposits', { token: p.token });
  assert.equal(history.status, 200);
  assert.ok(history.json.some((row) => row.reference === 'TXN-ADMIN-12345' && row.status === 'success' && row.amount === 125.5));
  assert.equal((await api('GET', '/api/ledger', { token: p.token })).json.filter((row) => row.kind === 'deposit').length, 1);

  const other = await newPlayer();
  assert.equal((await api('GET', '/api/simulation/deposits/TXN-ADMIN-12345', { token: other.token })).status, 404);
  assert.equal((await api('POST', '/api/simulation/deposits', { token: other.token, body: { amount: 125.5, reference: 'TXN-ADMIN-12345' } })).json.error, 'reference_used');

  const rejected = await api('POST', '/api/simulation/deposits', { token: p.token, body: { amount: 50, reference: 'TXN-REJECT-1234' } });
  assert.equal(rejected.status, 200);
  const denied = await api('POST', '/api/admin/deposits/TXN-REJECT-1234/reject', { token: ctx.adminToken, body: { note: 'Not found in statement' } });
  assert.equal(denied.status, 200);
  assert.equal(denied.json.status, 'rejected');
  assert.equal((await api('GET', '/api/simulation/deposits/TXN-REJECT-1234', { token: p.token })).json.status, 'rejected');
  const rejectedHistory = await api('GET', '/api/simulation/deposits', { token: p.token });
  assert.ok(rejectedHistory.json.some((row) => row.reference === 'TXN-REJECT-1234' && row.status === 'rejected'));
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 125.5);
  assert.equal((await api('POST', '/api/admin/deposits/TXN-REJECT-1234/approve', { token: ctx.adminToken })).json.error, 'wrong_status');
});

test('TEST-prefixed deposits can be test-approved without ever crediting the wallet', async () => {
  const p = await newPlayer();
  const reference = 'TEST-APPROVAL-1234';
  const created = await api('POST', '/api/simulation/deposits', { token: p.token, body: { amount: 100, reference } });
  assert.equal(created.status, 200);
  assert.equal((await api('POST', `/api/admin/deposits/${reference}/approve`, { token: ctx.adminToken })).status, 409,
    'normal approval must refuse TEST references');
  const result = await api('POST', `/api/admin/deposits/${reference}/test-approve`, { token: ctx.adminToken });
  assert.equal(result.status, 200);
  assert.deepEqual(result.json, { status: 'test-approved', credited: false });
  assert.equal((await api('GET', `/api/simulation/deposits/${reference}`, { token: p.token })).json.status, 'test-approved');
  const testHistory = await api('GET', '/api/simulation/deposits', { token: p.token });
  assert.ok(testHistory.json.some((row) => row.reference === reference && row.status === 'test-approved'));
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 0);
  assert.equal((await api('GET', '/api/ledger', { token: p.token })).json.length, 0);
  assert.equal((await api('POST', `/api/admin/deposits/${reference}/test-approve`, { token: ctx.adminToken })).json.error, 'wrong_status');
});

test('legacy SMS webhook cannot approve new manual-review simulation requests', async () => {
  const p = await newPlayer();
  ctx.config.smsWebhookSecret = 'test-sms-webhook-secret-at-least-32-characters';
  const pending = await api('POST', '/api/simulation/deposits', { token: p.token, body: { amount: 42.5, reference: 'TXN-MANUAL-1234' } });
  assert.equal(pending.status, 200);
  const payload = { eventId: 'legacy-event-001', reference: 'TXN-MANUAL-1234', amount: 42.5, currency: 'ETB', status: 'success' };
  const raw = JSON.stringify(payload);
  const signature = createHmac('sha256', ctx.config.smsWebhookSecret).update(raw, 'utf8').digest('hex');
  const response = await api('POST', '/api/webhooks/sms', { body: payload, headers: { 'x-sms-signature': signature } });
  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.equal(response.json.status, 'matched');
  assert.equal((await api('GET', '/api/simulation/deposits/TXN-MANUAL-1234', { token: p.token })).json.status, 'pending');
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 0);
});

test('simulation withdrawals reserve balance, expose test destination to admins, approve without payout, and refund on rejection', async () => {
  const p = await newPlayer('Withdrawal Player', 100);
  assert.equal((await api('POST', '/api/simulation/withdrawals', { token: p.token, body: { amount: 0 } })).json.error, 'invalid_amount');
  assert.equal((await api('POST', '/api/simulation/withdrawals', { token: p.token, body: { amount: 101, method: 'telebirr', destination: '0912345678' } })).status, 402);
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 100);

  const request = await api('POST', '/api/simulation/withdrawals', { token: p.token, body: { amount: 40, method: 'telebirr', destination: '0912345678' } });
  assert.equal(request.status, 200, JSON.stringify(request.json));
  assert.equal(request.json.status, 'pending');
  assert.equal(request.json.balance, 60);
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 60);
  assert.equal((await api('GET', '/api/simulation/withdrawals', { token: p.token })).json[0].status, 'pending');
  assert.equal((await api('GET', '/api/admin/withdrawals/simulation', { token: p.token })).status, 403);

  const queue = await api('GET', '/api/admin/withdrawals/simulation?status=pending', { token: ctx.adminToken });
  const row = queue.json.find((w) => w.id === request.json.id);
  assert.ok(row);
  assert.equal(row.amount, 40);
  assert.equal(row.method, 'telebirr');
  assert.equal(row.destination, '0912345678');
  assert.equal(row.userPhone, p.phone);

  const approved = await api('POST', `/api/admin/withdrawals/simulation/${request.json.id}/approve`, { token: ctx.adminToken });
  assert.equal(approved.status, 200);
  assert.equal(approved.json.status, 'approved');
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 60, 'approval must not send or credit real money');
  assert.equal((await api('POST', `/api/admin/withdrawals/simulation/${request.json.id}/approve`, { token: ctx.adminToken })).status, 409);

  const rejectedRequest = await api('POST', '/api/simulation/withdrawals', { token: p.token, body: { amount: 25, method: 'bank', destination: '1000123456789' } });
  assert.equal(rejectedRequest.status, 200);
  assert.equal(rejectedRequest.json.balance, 35);
  const rejected = await api('POST', `/api/admin/withdrawals/simulation/${rejectedRequest.json.id}/reject`, { token: ctx.adminToken, body: { note: 'Test rejection' } });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.json.refunded, true);
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 60);
  assert.equal((await api('POST', `/api/admin/withdrawals/simulation/${rejectedRequest.json.id}/reject`, { token: ctx.adminToken })).status, 409);
  assert.equal((await api('GET', '/api/admin/withdrawals/simulation?status=pending', { token: ctx.adminToken })).json.some((w) => w.id === rejectedRequest.json.id), false);
});

test('manual real-wallet withdrawals require processing and a unique external payout reference', async () => {
  const p = await newPlayer('Manual Cashout Player', 100);
  const invalid = await api('POST', '/api/manual/withdrawals', {
    token: p.token, body: { amount: 20, method: 'telebirr', destination: '0912345678' },
  });
  assert.equal(invalid.status, 400);
  const request = await api('POST', '/api/manual/withdrawals', {
    token: p.token, body: { amount: 50, method: 'telebirr', destination: '0912345678' },
  });
  assert.equal(request.status, 200, JSON.stringify(request.json));
  assert.equal(request.json.status, 'pending');
  assert.equal(request.json.balance, 50);
  assert.equal((await api('GET', '/api/manual/withdrawals', { token: p.token })).json[0].status, 'pending');

  const premature = await api('POST', `/api/admin/manual-withdrawals/${request.json.id}/confirm`, {
    token: ctx.adminToken, body: { externalReference: 'BANK-REF-000001', method: 'telebirr' },
  });
  assert.equal(premature.status, 409);

  const started = await api('POST', `/api/admin/manual-withdrawals/${request.json.id}/start`, { token: ctx.adminToken });
  assert.equal(started.status, 200);
  assert.equal(started.json.status, 'processing');

  const paid = await api('POST', `/api/admin/manual-withdrawals/${request.json.id}/confirm`, {
    token: ctx.adminToken, body: { externalReference: 'BANK-REF-000001', method: 'telebirr' },
  });
  assert.equal(paid.status, 200, JSON.stringify(paid.json));
  assert.equal(paid.json.status, 'paid');
  assert.equal(paid.json.externalReference, 'BANK-REF-000001');
  const paidHistory = (await api('GET', '/api/manual/withdrawals', { token: p.token })).json.find((w) => w.id === request.json.id);
  assert.equal(paidHistory.status, 'paid');
  assert.equal(paidHistory.externalPayoutReference, 'BANK-REF-000001');
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 50, 'confirming paid must not debit the already-held amount again');

  const second = await api('POST', '/api/manual/withdrawals', {
    token: p.token, body: { amount: 50, method: 'bank', destination: '1000123456789' },
  });
  assert.equal(second.status, 200);
  const startSecond = await api('POST', `/api/admin/manual-withdrawals/${second.json.id}/start`, { token: ctx.adminToken });
  assert.equal(startSecond.status, 200);
  const duplicate = await api('POST', `/api/admin/manual-withdrawals/${second.json.id}/confirm`, {
    token: ctx.adminToken, body: { externalReference: 'BANK-REF-000001', method: 'bank' },
  });
  assert.equal(duplicate.status, 409);
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 0);
});

test('manual withdrawal rejection refunds pending and processing holds exactly once', async () => {
  const pendingPlayer = await newPlayer('Pending Refund Player', 100);
  const pending = await api('POST', '/api/manual/withdrawals', {
    token: pendingPlayer.token, body: { amount: 50, method: 'telebirr', destination: '0912345678' },
  });
  assert.equal(pending.status, 200);
  assert.equal(pending.json.balance, 50);
  const pendingReject = await api('POST', `/api/admin/manual-withdrawals/${pending.json.id}/reject`, {
    token: ctx.adminToken, body: { note: 'Pending refund test' },
  });
  assert.equal(pendingReject.status, 200, JSON.stringify(pendingReject.json));
  assert.equal(pendingReject.json.refunded, true);
  assert.equal((await api('GET', '/api/me', { token: pendingPlayer.token })).json.balance, 100);
  assert.equal((await api('POST', `/api/admin/manual-withdrawals/${pending.json.id}/reject`, {
    token: ctx.adminToken,
  })).status, 409);
  const pendingHistory = (await api('GET', '/api/manual/withdrawals', { token: pendingPlayer.token })).json.find((w) => w.id === pending.json.id);
  assert.equal(pendingHistory.status, 'rejected');

  const processingPlayer = await newPlayer('Processing Refund Player', 100);
  const processing = await api('POST', '/api/manual/withdrawals', {
    token: processingPlayer.token, body: { amount: 50, method: 'bank', destination: '1000123456789' },
  });
  assert.equal(processing.status, 200);
  assert.equal(processing.json.balance, 50);
  const started = await api('POST', `/api/admin/manual-withdrawals/${processing.json.id}/start`, { token: ctx.adminToken });
  assert.equal(started.status, 200);
  assert.equal(started.json.status, 'processing');
  const processingReject = await api('POST', `/api/admin/manual-withdrawals/${processing.json.id}/reject`, {
    token: ctx.adminToken, body: { note: 'Processing refund test' },
  });
  assert.equal(processingReject.status, 200, JSON.stringify(processingReject.json));
  assert.equal(processingReject.json.refunded, true);
  assert.equal((await api('GET', '/api/me', { token: processingPlayer.token })).json.balance, 100);
  assert.equal((await api('POST', `/api/admin/manual-withdrawals/${processing.json.id}/reject`, {
    token: ctx.adminToken,
  })).status, 409);
  const processingHistory = (await api('GET', '/api/manual/withdrawals', { token: processingPlayer.token })).json.find((w) => w.id === processing.json.id);
  assert.equal(processingHistory.status, 'rejected');
});

test('cards: buying, balance checks, round gating, server-issued grids', async () => {
  await freshRound();
  const p = await newPlayer('Buyer', 35);
  assert.equal((await api('POST', '/api/cards/buy', { token: p.token, body: { count: 0 } })).json.error, 'invalid_count');
  assert.equal((await api('POST', '/api/cards/buy', { token: p.token, body: { count: 51 } })).json.error, 'invalid_count');
  const poor = await api('POST', '/api/cards/buy', { token: p.token, body: { count: 4 } });
  assert.equal(poor.status, 402);
  assert.equal((await api('GET', '/api/me', { token: p.token })).json.balance, 35);
  const bought = await api('POST', '/api/cards/buy', { token: p.token, body: { count: 3 } });
  assert.equal(bought.status, 200);
  assert.equal(bought.json.balance, 5);
  assert.equal(bought.json.cards.length, 3);
  assert.equal(new Set(bought.json.cards.map((c) => c.serial)).size, 3);
  for (const card of bought.json.cards) assert.match(String(card.serial), /^\d{5}$/);
  const mine = (await api('GET', '/api/cards', { token: p.token })).json;
  assert.equal(mine.length, 3);
  assert.equal((await api('GET', '/api/ledger', { token: p.token })).json.some((e) => e.kind === 'purchase' && e.amount === -30), true);
  await api('POST', '/api/admin/round/start', { token: ctx.adminToken });
  assert.equal((await api('POST', '/api/cards/buy', { token: p.token, body: { count: 1 } })).json.error, 'round_not_open');
  await api('POST', '/api/admin/round/end', { token: ctx.adminToken });
  await api('POST', '/api/admin/round/reset', { token: ctx.adminToken });
  assert.equal((await api('GET', '/api/cards', { token: p.token })).json.length, 0, 'cards belong to the round they were bought for');
});

test('card purchase supports up to fifty cards per request', async () => {
  await freshRound();
  const p = await newPlayer('Fifty Card Buyer', 520);
  const tooMany = await api('POST', '/api/cards/buy', { token: p.token, body: { count: 51 } });
  assert.equal(tooMany.status, 400);
  assert.equal(tooMany.json.error, 'invalid_count');
  const bought = await api('POST', '/api/cards/buy', { token: p.token, body: { count: 50 } });
  assert.equal(bought.status, 200, JSON.stringify(bought.json));
  assert.equal(bought.json.cards.length, 50);
  assert.equal(bought.json.balance, 20);
});

test('false BINGO locks only the claimed card until an admin unlocks it', async () => {
  await freshRound();
  const p = await newPlayer('False Bingo Player', 20);
  const bought = await api('POST', '/api/cards/buy', { token: p.token, body: { count: 2 } });
  assert.equal(bought.status, 200);
  const [falseCard, activeCard] = bought.json.cards;
  await api('POST', '/api/admin/round/start', { token: ctx.adminToken });

  const falseClaim = await api('POST', '/api/claim', {
    token: p.token, body: { cardId: falseCard.id, expectedCallCount: 0 },
  });
  assert.equal(falseClaim.status, 200);
  assert.equal(falseClaim.json.reason, 'false_bingo');
  assert.equal(falseClaim.json.cardLocked, true);

  const cards = await api('GET', '/api/cards', { token: p.token });
  assert.equal(cards.status, 200);
  assert.equal(cards.json.find((c) => c.id === falseCard.id).locked, true);
  assert.equal(cards.json.find((c) => c.id === activeCard.id).locked, false);
  const replay = await api('POST', '/api/claim', {
    token: p.token, body: { cardId: falseCard.id, expectedCallCount: 0 },
  });
  assert.equal(replay.json.reason, 'card_locked');

  assert.equal((await api('POST', `/api/admin/cards/${encodeURIComponent(falseCard.id)}/unlock`, { token: p.token })).status, 403);
  const unlocked = await api('POST', `/api/admin/cards/${encodeURIComponent(falseCard.id)}/unlock`, { token: ctx.adminToken });
  assert.equal(unlocked.status, 200);
  assert.equal(unlocked.json.unlocked, true);
  assert.equal((await api('GET', '/api/cards', { token: p.token })).json.find((c) => c.id === falseCard.id).locked, false);
  await api('POST', '/api/admin/round/end', { token: ctx.adminToken });
});

test('players can choose a unique five-digit card number', async () => {
  await freshRound();
  const first = await newPlayer('Custom Number One', 20);
  const bought = await api('POST', '/api/cards/buy', { token: first.token, body: { count: 1, serial: '12345' } });
  assert.equal(bought.status, 200, JSON.stringify(bought.json));
  assert.equal(bought.json.cards[0].serial, '12345');

  const second = await newPlayer('Custom Number Two', 20);
  const duplicate = await api('POST', '/api/cards/buy', { token: second.token, body: { count: 1, serial: '12345' } });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.json.error, 'card_number_taken');

  const many = await api('POST', '/api/cards/buy', { token: second.token, body: { count: 2, serial: '23456' } });
  assert.equal(many.status, 400);
  assert.equal(many.json.error, 'invalid_card_number');
});

test('only the host can select a winning pattern, and only before a round starts', async () => {
  await freshRound();
  const player = await newPlayer('Pattern Player');
  assert.equal((await api('POST', '/api/admin/pattern', { token: player.token, body: { pattern: 'diagonal' } })).status, 403);

  const selected = await api('POST', '/api/admin/pattern', { token: ctx.adminToken, body: { pattern: 'two_horizontal_lines' } });
  assert.equal(selected.status, 200);
  assert.equal(selected.json.winPattern, 'two_horizontal_lines');
  assert.equal((await api('POST', '/api/admin/pattern', { token: ctx.adminToken, body: { pattern: 'not-a-pattern' } })).status, 400);

  await api('POST', '/api/admin/round/start', { token: ctx.adminToken });
  assert.equal((await api('GET', '/api/game')).json.winPattern, 'two_horizontal_lines',
    'the host-selected upcoming pattern must remain active when the round starts');
  assert.equal((await api('POST', '/api/admin/pattern', { token: ctx.adminToken, body: { pattern: 'diagonal' } })).status, 409);
  await api('POST', '/api/admin/round/end', { token: ctx.adminToken });
  await api('POST', '/api/admin/round/reset', { token: ctx.adminToken });
  await api('POST', '/api/admin/pattern', { token: ctx.adminToken, body: { pattern: 'any_line' } });
});

test('a full round: a valid BINGO claim automatically credits the winner wallet exactly once', async () => {
  await freshRound();
  const a = await newPlayer('Alice', 100);
  const b = await newPlayer('Bob', 100);
  const ca = (await api('POST', '/api/cards/buy', { token: a.token, body: { count: 2 } })).json.cards;
  const cb = (await api('POST', '/api/cards/buy', { token: b.token, body: { count: 3 } })).json.cards;
  assert.equal((await api('GET', '/api/game')).json.phase, 'waiting');
  assert.equal((await api('POST', '/api/claim', { token: a.token, body: { cardId: ca[0].id } })).json.error, 'wrong_phase');

  await api('POST', '/api/admin/round/start', { token: ctx.adminToken });
  // A premature BINGO claim now locks only that card; keep the second card for the real win.
  const falseClaim = await api('POST', '/api/claim', { token: a.token, body: { cardId: ca[0].id, expectedCallCount: 0 } });
  assert.equal(falseClaim.json.reason, 'false_bingo');
  assert.equal(falseClaim.json.cardLocked, true);
  await drawAll();
  assert.equal((await api('POST', '/api/admin/draw', { token: ctx.adminToken })).json.error, 'all_drawn');
  assert.equal((await api('GET', '/api/game')).json.calledNumbers.length, 75);

  // A claim tied to the previous call snapshot expires as soon as another number is called.
  assert.equal((await api('POST', '/api/claim', { token: a.token, body: { cardId: ca[1].id, expectedCallCount: 74 } })).json.reason, 'claim_expired');

  // Cannot claim someone else's card or a card that does not exist.
  assert.equal((await api('POST', '/api/claim', { token: a.token, body: { cardId: cb[0].id, expectedCallCount: 75 } })).json.error, 'not_your_card');
  assert.equal((await api('POST', '/api/claim', { token: a.token, body: { cardId: 'BG-ZZZZZZ', expectedCallCount: 75 } })).json.error, 'card_not_found');

  // Both claim at the same instant: exactly one wins.
  const [ra, rb] = await Promise.all([
    api('POST', '/api/claim', { token: a.token, body: { cardId: ca[1].id, expectedCallCount: 75 } }),
    api('POST', '/api/claim', { token: b.token, body: { cardId: cb[0].id, expectedCallCount: 75 } }),
  ]);
  const wins = [ra, rb].filter((r) => r.json.ok === true);
  assert.equal(wins.length, 1, `expected one winner, got ${JSON.stringify([ra.json, rb.json])}`);
  const prize = wins[0].json.prize;
  assert.equal(prize, 40); // pot = 5 cards x 10 = 50 ETB, 80% = 40
  assert.equal(wins[0].json.payoutStatus, 'paid');
  const g = (await api('GET', '/api/game')).json;
  assert.equal(g.phase, 'ended');
  assert.ok(g.winner.cardId.startsWith('BG-'));
  assert.equal(g.winner.userId, undefined);

  const aWon = ra.json.ok === true;
  const winnerCard = g.winner.cardId;
  const winnerToken = aWon ? a.token : b.token;
  const loserToken = aWon ? b.token : a.token;
  assert.equal((await api('GET', '/api/me', { token: a.token })).json.balance, aWon ? 100 - 20 + 40 : 100 - 20);
  assert.equal((await api('GET', '/api/me', { token: b.token })).json.balance, aWon ? 100 - 30 : 100 - 30 + 40);
  assert.equal((await api('GET', '/api/admin/win-payouts', { token: a.token })).status, 403);
  const queue = await api('GET', '/api/admin/win-payouts?status=pending', { token: ctx.adminToken });
  assert.equal(queue.status, 200);
  assert.equal(queue.json.length, 0, 'new automatic wins must not enter the legacy admin approval queue');

  const duplicateClaim = await api('POST', '/api/claim', { token: winnerToken, body: { cardId: winnerCard, expectedCallCount: 75 } });
  assert.equal(duplicateClaim.status, 409);
  assert.equal(duplicateClaim.json.error, 'wrong_phase');
  const winnerBalance = (await api('GET', '/api/me', { token: winnerToken })).json.balance;
  assert.equal(winnerBalance, aWon ? 100 - 20 + 40 : 100 - 30 + 40);
  const prizeLedger = await api('GET', '/api/ledger', { token: winnerToken });
  assert.equal(prizeLedger.json.filter((row) => row.label === 'Prize' && row.amount === 40).length, 1);

  // Verify: owner sees the grid and winner flag; others only the status.
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

test('production safety gates block registration and all real-money routes until approvals are enabled', async () => {
  const previous = {
    prod: ctx.config.prod,
    registrationEnabled: ctx.config.registrationEnabled,
    realMoneyEnabled: ctx.config.realMoneyEnabled,
    lotteryLicenseApproved: ctx.config.lotteryLicenseApproved,
    chapaMerchantApproved: ctx.config.chapaMerchantApproved,
    authLimit: ctx.config.rateLimits.auth,
  };
  try {
    // The preceding rate-limit test intentionally lowers this limit; reset it before creating this test player.
    ctx.config.rateLimits.auth = 100000;
    ctx.app.resetLimits();
    const p = await newPlayer('Safety Gate Player', 10);
    ctx.config.prod = true;
    ctx.config.registrationEnabled = false;
    ctx.config.realMoneyEnabled = false;
    ctx.config.lotteryLicenseApproved = false;
    ctx.config.chapaMerchantApproved = false;
    ctx.app.resetLimits();
    // Previous tests may leave the shared game in an ended phase; reopen it for the free-card assertion.
    await freshRound();

    assert.equal((await api('POST', '/api/auth/register', { body: { phone: newPhone(), name: 'Blocked', pin: '123456', pinConfirm: '123456' } })).status, 503);
    assert.equal((await api('POST', '/api/payments/deposit', { token: p.token, body: { amount: 100 } })).status, 503);
    assert.equal((await api('POST', '/api/simulation/deposits', { token: p.token, body: { amount: 100, reference: 'TXN-LICENSE-BLOCK-01' } })).status, 503);
    assert.equal((await api('POST', '/api/cards/buy', { token: p.token, body: { count: 1 } })).status, 200);
    assert.equal((await api('POST', '/api/claim', { token: p.token, body: { cardId: 'BG-TEST22' } })).status, 409);
    assert.equal((await api('POST', '/api/withdrawals', { token: p.token, body: { amount: 50, accountName: 'Test Name', accountNumber: '0911000111', bankCode: '1' } })).status, 503);
    assert.equal((await api('POST', '/api/admin/withdrawals/fake-id/approve', { token: ctx.adminToken })).status, 503);
    assert.equal((await api('POST', '/api/payments/manual', { token: p.token, body: { txnId: 'FAKE-123', amount: 100 } })).status, 404);
  } finally {
    Object.assign(ctx.config, previous);
    ctx.config.rateLimits.auth = previous.authLimit;
    ctx.app.resetLimits();
  }
});


// Prize settings use collected gross revenue and unique players, never card count.
test('admin prize modes are capped by gross revenue and count each unique player once', async () => {
  let initial = (await api('GET', '/api/game')).json;
  if (initial.phase === 'waiting') await api('POST', '/api/admin/round/start', { token: ctx.adminToken });
  initial = (await api('GET', '/api/game')).json;
  if (initial.phase === 'running') await api('POST', '/api/admin/round/end', { token: ctx.adminToken });
  await api('POST', '/api/admin/round/reset', { token: ctx.adminToken });
  const a = await newPlayer('Prize Player A', 100);
  const b = await newPlayer('Prize Player B', 100);
  const configured = await api('POST', '/api/admin/prize-schedule', {
    token: ctx.adminToken,
    body: { prizeMode: 'revenue_percent', prizePercent: 50, prizePerPlayer: 4, maxPrizeCap: 12, roundIntervalMinutes: 4 },
  });
  assert.equal(configured.status, 200, JSON.stringify(configured.json));
  assert.equal((await api('POST', '/api/cards/buy', { token: a.token, body: { count: 2 } })).status, 200);
  assert.equal((await api('POST', '/api/cards/buy', { token: a.token, body: { count: 1 } })).status, 200);
  assert.equal((await api('POST', '/api/cards/buy', { token: b.token, body: { count: 1 } })).status, 200);
  let state = (await api('GET', '/api/game')).json;
  assert.equal(state.roundPlayerCount, 2, 'multiple purchases by one player count once');
  assert.equal(state.roundPrizeEtb, 12, '50% of 40 ETB gross is 20 ETB, capped at 12 ETB');
  assert.equal(Object.hasOwn(state, 'roundPlayerIds'), false, 'private participant IDs are never public');
  assert.equal(state.roundIntervalMinutes, 4);

  const perPlayer = await api('POST', '/api/admin/prize-schedule', {
    token: ctx.adminToken,
    body: { prizeMode: 'per_player', prizePercent: 50, prizePerPlayer: 4, maxPrizeCap: 7.5, roundIntervalMinutes: 5 },
  });
  assert.equal(perPlayer.status, 200, JSON.stringify(perPlayer.json));
  state = (await api('GET', '/api/game')).json;
  assert.equal(state.roundPrizeEtb, 7.5, 'per-player amount multiplies two unique players then respects cap');
  assert.equal(state.roundPlayerCount, 2);

  assert.equal((await api('POST', '/api/admin/prize-schedule', {
    token: a.token, body: { prizeMode: 'per_player', prizePercent: 50, prizePerPlayer: 4, maxPrizeCap: 7.5, roundIntervalMinutes: 5 },
  })).status, 403);
  assert.equal((await api('POST', '/api/admin/prize-schedule', {
    token: ctx.adminToken, body: { prizeMode: 'per_player', prizePercent: 50, prizePerPlayer: 4, maxPrizeCap: 7.5, roundIntervalMinutes: 6 },
  })).status, 400);
});


test('fixed prize is announced, frozen at round start, capped by gross revenue, and paid exactly once', async () => {
  await freshRound();
  const player = await newPlayer('Fixed Prize Player', 100);
  const configured = await api('POST', '/api/admin/prize-schedule', {
    token: ctx.adminToken,
    body: { prizeMode: 'fixed', fixedPrize: 15, prizePercent: 80, prizePerPlayer: 4, maxPrizeCap: 0, roundIntervalMinutes: 4 },
  });
  assert.equal(configured.status, 200, JSON.stringify(configured.json));
  assert.equal(configured.json.prizeMode, 'fixed');
  assert.equal(configured.json.fixedPrizeEtb, 15);
  let state = (await api('GET', '/api/game')).json;
  assert.equal(state.roundPrizeEtb, 15, 'the configured fixed prize is visible before any player buys cards');
  const bought = await api('POST', '/api/cards/buy', { token: player.token, body: { count: 3 } });
  assert.equal(bought.status, 200, JSON.stringify(bought.json));
  state = (await api('GET', '/api/game')).json;
  assert.equal(state.roundPrizeEtb, 15, 'the configured fixed prize remains visible before the round starts');
  assert.equal((await api('POST', '/api/admin/round/start', { token: ctx.adminToken })).status, 200);
  state = (await api('GET', '/api/game')).json;
  assert.equal(state.roundPrizeEtb, 15, 'the prize remains fixed after the round starts');
  const changedDuringRound = await api('POST', '/api/admin/prize-schedule', {
    token: ctx.adminToken,
    body: { prizeMode: 'fixed', fixedPrize: 20, prizePercent: 80, prizePerPlayer: 4, maxPrizeCap: 0, roundIntervalMinutes: 4 },
  });
  assert.equal(changedDuringRound.status, 409, 'active-round prize settings cannot be changed');
  await drawAll();
  const won = await api('POST', '/api/claim', { token: player.token, body: { cardId: bought.json.cards[0].id, expectedCallCount: 75 } });
  assert.equal(won.status, 200, JSON.stringify(won.json));
  assert.equal(won.json.ok, true);
  assert.equal(won.json.prize, 15);
  state = (await api('GET', '/api/game')).json;
  assert.equal(state.phase, 'ended');
  assert.equal(state.roundPrizeEtb, 15, 'the frozen prize remains visible after a winner ends the round');
  const balance = await api('GET', '/api/me', { token: player.token });
  assert.equal(balance.json.balance, 100 - 30 + 15);
});
