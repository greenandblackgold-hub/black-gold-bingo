import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { createMemoryRepo } from '../src/db/memoryRepo.js';
import { createGamesHubService } from '../src/services/gamesHubService.js';
import { HttpError } from '../src/util/errors.js';

async function fixture() {
  let clock = Date.now();
  const repo = createMemoryRepo();
  const user = await repo.createUser({
    phone: '0912345678', name: 'Games Test', pinHash: 'not-used',
    role: 'player', phoneVerified: true,
  });
  await repo.applyLedger({ userId: user.id, amount: 100000, kind: 'deposit', ref: 'seed:games-test' });
  const service = createGamesHubService({
    repo,
    config: { prod: false, realMoneyEnabled: false, gamesHubSharedWalletEnabled: true },
    now: () => clock,
  });
  return { repo, user, service, advance: (ms) => { clock += ms; }, time: () => clock };
}

test('Keno accepts a valid selection, debits once and settles a committed 20-number draw', async () => {
  const f = await fixture();
  const initial = await f.service.getState('keno', f.user);
  assert.equal(initial.status, 'betting');
  assert.equal(initial.balanceEtb, 1000);
  assert.equal(initial.walletMode, 'shared');
  assert.equal(initial.payoutTable['4']['4'], 4000, 'published Keno payout table is fixed and exposed');
  assert.equal((await f.repo.listGameHubLedger(f.user.id)).length, 0, 'new rounds do not create separate demo-wallet credits');
  assert.match(initial.serverSeedHash, /^[a-f0-9]{64}$/);

  const placed = await f.service.placeKenoBet(f.user, {
    requestId: 'keno_test_request_01',
    amount: 10,
    selectedNumbers: [1, 8, 23, 80],
  });
  assert.equal(placed.balanceEtb, 990);
  assert.equal(placed.bet.stakeEtb, 10);
  assert.equal((await f.repo.findUserById(f.user.id)).balance, 99000, 'Keno debits the shared balance used by Bingo');
  assert.equal((await f.repo.getGameHubWallet(f.user.id)).balance, 99000, 'Games Center reads the shared Bingo wallet');
  assert.ok((await f.repo.listLedger(f.user.id)).some((entry) => entry.ref.startsWith('games:keno:bet:')), 'Keno debit is recorded in the common ledger');

  const duplicate = await f.service.placeKenoBet(f.user, {
    requestId: 'keno_test_request_01',
    amount: 10,
    selectedNumbers: [1, 8, 23, 80],
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.balanceEtb, 990);

  f.advance(21_000);
  const settled = await f.service.getState('keno', f.user);
  assert.equal(settled.status, 'settled');
  assert.equal(settled.drawnNumbers.length, 20);
  assert.equal(new Set(settled.drawnNumbers).size, 20);
  assert.ok(settled.drawnNumbers.every((n) => Number.isInteger(n) && n >= 1 && n <= 80));
  assert.equal(settled.serverSeed.length, 64);
  assert.equal(settled.myBets.length, 1);
  assert.ok(['won', 'lost'].includes(settled.myBets[0].status));
  assert.equal((await f.repo.listGameHubRounds('keno', 1))[0].status, 'settled');
});

test('legacy Keno rounds finish on their original demo wallet without touching Bingo balance', async () => {
  const f = await fixture();
  await f.repo.createGameHubRound('keno', {
    roundId: 'legacy-round-01', game: 'keno', status: 'betting', version: 1, bets: [],
    serverSeed: 'a'.repeat(64), serverSeedHash: 'b'.repeat(64), createdAt: f.time(),
    expireAt: new Date(f.time() + 30 * 24 * 60 * 60 * 1000), bettingEndsAt: f.time() + 20_000,
  });
  const state = await f.service.getState('keno', f.user);
  assert.equal(state.walletMode, 'legacy-demo');
  await f.service.placeKenoBet(f.user, { requestId: 'legacy_keno_request_01', amount: 10, selectedNumbers: [1] });
  assert.equal((await f.repo.findUserById(f.user.id)).balance, 100000, 'legacy round cannot debit Bingo wallet');
  assert.equal((await f.repo.getGameHubWallet(f.user.id, 'legacy-demo')).balance, 99000);
});

test('Keno rejects duplicate or out-of-range selections and insufficient balance', async () => {
  const f = await fixture();
  await f.service.getState('keno', f.user);
  await assert.rejects(
    f.service.placeKenoBet(f.user, { requestId: 'keno_bad_request_1', amount: 10, selectedNumbers: [1, 1] }),
    (e) => e instanceof HttpError && e.code === 'invalid_keno_numbers',
  );
  await assert.rejects(
    f.service.placeKenoBet(f.user, { requestId: 'keno_bad_request_2', amount: 1001, selectedNumbers: [1] }),
    (e) => e instanceof HttpError && e.code === 'invalid_bet_amount',
  );
});

test('Aviator commits a round before betting and reveals its seed only after crash', async () => {
  const f = await fixture();
  const initial = await f.service.getState('aviator', f.user);
  assert.equal(initial.status, 'betting');
  assert.equal(initial.balanceEtb, 1000);
  assert.equal(initial.walletMode, 'shared');
  assert.match(initial.serverSeedHash, /^[a-f0-9]{64}$/);
  assert.equal(initial.serverSeed, undefined);

  const placed = await f.service.placeAviatorBet(f.user, {
    requestId: 'aviator_test_request_01',
    amount: 5,
  });
  assert.equal(placed.balanceEtb, 995);
  assert.equal((await f.repo.findUserById(f.user.id)).balance, 99500, 'Aviator debits the shared balance used by Bingo');
  assert.equal((await f.repo.getGameHubWallet(f.user.id)).balance, 99500, 'Aviator reads the shared Bingo wallet');
  assert.ok((await f.repo.listLedger(f.user.id)).some((entry) => entry.ref.startsWith('games:aviator:bet:')), 'Aviator debit is recorded in the common ledger');
  const duplicate = await f.service.placeAviatorBet(f.user, {
    requestId: 'aviator_test_request_01',
    amount: 5,
  });
  assert.equal(duplicate.duplicate, true);
  await assert.rejects(
    f.service.placeAviatorBet(f.user, { requestId: 'aviator_test_request_02', amount: 5 }),
    (e) => e instanceof HttpError && e.code === 'aviator_bet_already_placed',
  );

  f.advance(9_000);
  const flyingOrCrashed = await f.service.getState('aviator', f.user);
  assert.ok(['flying', 'crashed'].includes(flyingOrCrashed.status));
  if (flyingOrCrashed.status === 'flying') {
    const current = await f.repo.getCurrentGameHubRound('aviator');
    assert.ok(current.crashAt >= current.startedAt);
    assert.equal(flyingOrCrashed.serverSeed, undefined);
    const cashed = await f.service.cashOutAviator(f.user, placed.bet.id);
    assert.ok(cashed.multiplier >= 1);
    assert.ok(cashed.bet.payoutEtb >= 5);
    assert.ok((await f.repo.findUserById(f.user.id)).balance >= 100000, 'cash-out credits the same Bingo wallet');
    assert.ok((await f.repo.listLedger(f.user.id)).some((entry) => entry.ref === `games:aviator:cashout:${placed.bet.id}`), 'cash-out is recorded in the common ledger');
  }

  f.advance(120_000);
  const completed = await f.service.getState('aviator', f.user);
  assert.equal(completed.status, 'crashed');
  assert.equal(completed.serverSeed.length, 64);
  assert.equal(completed.serverSeedHash, createHash('sha256').update(completed.serverSeed).digest('hex'));
  const crashDigest = createHmac('sha256', Buffer.from(completed.serverSeed, 'hex')).update('aviator-crash-v1').digest('hex');
  const fraction = Number(BigInt('0x' + crashDigest.slice(0, 13))) / 0x1_0000_0000_0000_0;
  const expectedCrash = Math.min(1000, Math.max(1, Math.floor((0.99 / Math.max(1e-12, 1 - fraction)) * 100) / 100));
  assert.equal(completed.crashMultiplier, expectedCrash);
  assert.equal(completed.crashMultiplier >= 1, true);
});

test('Admin settings are validated and persist independently of Bingo settings', async () => {
  const f = await fixture();
  const settings = await f.service.updateSettings({ kenoEnabled: false, minBetEtb: 8, maxBetEtb: 200, kenoBettingSeconds: 30 });
  assert.equal(settings.kenoEnabled, false);
  assert.equal(settings.minBet, 800);
  assert.equal(settings.maxBet, 20000);
  assert.equal(settings.kenoBettingSeconds, 30);
  await assert.rejects(
    f.service.updateSettings({ minBetEtb: 500, maxBetEtb: 10 }),
    (e) => e instanceof HttpError && e.code === 'invalid_bet_range',
  );
  const pausedState = await f.service.getState('keno', f.user);
  assert.equal(pausedState.enabled, false);
  await assert.rejects(
    f.service.placeKenoBet(f.user, { requestId: 'keno_paused_request_01', amount: 10, selectedNumbers: [1] }),
    (e) => e instanceof HttpError && e.code === 'game_disabled',
  );
});

test('Production keeps the separate demo wallet until the shared-wallet flag and approvals are enabled', async () => {
  const repo = createMemoryRepo();
  const user = await repo.createUser({ phone: '0912222222', name: 'Production Demo', pinHash: 'x', role: 'player', phoneVerified: true });
  const service = createGamesHubService({ repo, config: { prod: true, realMoneyEnabled: false, gamesHubSharedWalletEnabled: false } });
  const state = await service.getState('keno', user);
  assert.equal(state.walletMode, 'legacy-demo');
  assert.equal(state.balanceEtb, 1000);
  assert.equal((await repo.findUserById(user.id)).balance, 0, 'production demo play cannot spend the Bingo wallet before opt-in');
});

test('Keno and Aviator remain blocked if production real-money mode is enabled', async () => {
  const repo = createMemoryRepo();
  const user = await repo.createUser({ phone: '0911111111', name: 'Locked', pinHash: 'x', role: 'player', phoneVerified: true });
  const service = createGamesHubService({ repo, config: { prod: true, realMoneyEnabled: true } });
  await assert.rejects(
    service.getState('keno', user),
    (e) => e instanceof HttpError && e.code === 'games_hub_demo_only',
  );
});
