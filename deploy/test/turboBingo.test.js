import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/db/memoryRepo.js';
import { createTurboBingoService } from '../src/services/turboBingoService.js';

async function setup(target = 2) {
  const repo = createMemoryRepo();
  const user = await repo.createUser({
    phone: '251911000001', name: 'Turbo Test', pinHash: 'test-hash',
    role: 'player', phoneVerified: true,
  });
  await repo.getTurboBingoWallet(user.id);
  const game = await repo.createTurboBingoGame({
    id: 'turbo-test-game', status: 'waiting', target,
    drawnNumbers: [], ticketCount: 0, createdAt: Date.now(),
  });
  const ticket = { id: 'turbo-test-ticket', numbers: Array.from({ length: 12 }, (_, i) => i + 1), status: 'active' };
  await repo.purchaseTurboBingoTickets({
    gameId: game.id, userId: user.id, tickets: [ticket], totalCost: 100,
  });
  return { repo, user, game: await repo.getCurrentTurboBingoGame(), ticket };
}

test('Turbo Bingo tickets are charged only to the separate demo wallet and registered once', async () => {
  const { repo, user, game } = await setup();
  const tickets = await repo.listTurboBingoTickets(game.id, user.id);
  const wallet = await repo.getTurboBingoWallet(user.id);
  const otherGamesWallet = await repo.getGameHubWallet(user.id, 'legacy-demo');
  const bingoUser = await repo.findUserById(user.id);
  assert.equal(tickets.length, 1);
  assert.equal(tickets[0].numbers.length, 12);
  assert.equal(wallet.balance, 99_900);
  assert.equal(otherGamesWallet.balance, 100_000);
  assert.equal(bingoUser.balance, 0);
  assert.equal(game.ticketCount, 1);
  assert.equal(game.status, 'waiting');
});

test('Turbo Bingo accepts an exact target only when the latest called number completes the ticket', async () => {
  const { repo, user, game, ticket } = await setup(2);
  const running = await repo.updateTurboBingoGame(game.id, game.version, {
    status: 'running', drawnNumbers: [1, 2], startedAt: Date.now(),
  });
  const result = await repo.claimTurboBingoTicket({
    gameId: game.id, expectedVersion: running.version, ticketId: ticket.id,
    userId: user.id, winner: { userId: user.id, ticketId: ticket.id, at: Date.now() },
  });
  assert.ok(result);
  assert.equal(result.game.status, 'ended');
  assert.equal(result.game.winner.ticketId, ticket.id);
});

test('Turbo Bingo rejects a late claim when another number was called after the ticket reached target', async () => {
  const { repo, user, game, ticket } = await setup(2);
  const running = await repo.updateTurboBingoGame(game.id, game.version, {
    status: 'running', drawnNumbers: [1, 2, 3], startedAt: Date.now(),
  });
  const result = await repo.claimTurboBingoTicket({
    gameId: game.id, expectedVersion: running.version, ticketId: ticket.id,
    userId: user.id, winner: { userId: user.id, ticketId: ticket.id, at: Date.now() },
  });
  assert.equal(result, null);
});

test('Turbo Bingo locks an unclaimed exact-target ticket on the next draw', async () => {
  const { repo, game, ticket } = await setup(2);
  const running = await repo.updateTurboBingoGame(game.id, game.version, {
    status: 'running', drawnNumbers: [1, 2], startedAt: Date.now(),
  });
  const advanced = await repo.updateTurboBingoGame(running.id, running.version, {
    drawnNumbers: [1, 2, 3], lastDrawnAt: Date.now(),
  }, [ticket.id]);
  const saved = await repo.getTurboBingoTicket(game.id, ticket.id, 'unused-user');
  assert.equal(advanced.drawnNumbers.length, 3);
  assert.equal(saved, null);
  const allTickets = await repo.listTurboBingoTickets(game.id);
  assert.equal(allTickets[0].status, 'locked');
});

test('Turbo Bingo enforces the per-player ticket cap inside the repository operation', async () => {
  const repo = createMemoryRepo();
  const user = await repo.createUser({ phone: '251911000002', name: 'Limit Test', pinHash: 'test-hash' });
  await repo.getTurboBingoWallet(user.id);
  const game = await repo.createTurboBingoGame({
    id: 'turbo-limit-game', status: 'waiting', target: 10, maxTicketsPerPlayer: 1,
    drawnNumbers: [], ticketCount: 0, createdAt: Date.now(),
  });
  await repo.purchaseTurboBingoTickets({
    gameId: game.id, userId: user.id,
    tickets: [{ id: 'limit-ticket-1', numbers: Array.from({ length: 25 }, (_, i) => i + 1) }],
    totalCost: 100,
  });
  await assert.rejects(
    repo.purchaseTurboBingoTickets({
      gameId: game.id, userId: user.id,
      tickets: [{ id: 'limit-ticket-2', numbers: Array.from({ length: 12 }, (_, i) => i + 26) }],
      totalCost: 100,
    }),
    (error) => error.code === 'TURBO_BINGO_TICKET_LIMIT',
  );
});


test('Turbo Bingo Admin can add free test tickets with a zero balance and without player phone verification', async () => {
  const repo = createMemoryRepo();
  const admin = await repo.createUser({
    phone: '251911000097', name: 'Turbo Admin Free Test', pinHash: 'test-hash',
    role: 'admin', phoneVerified: false,
  });
  const walletBefore = await repo.getTurboBingoWallet(admin.id);
  const game = await repo.createTurboBingoGame({
    id: 'turbo-admin-free-game', status: 'waiting', target: 10,
    maxTicketsPerPlayer: 11, drawnNumbers: [], ticketCount: 0, createdAt: Date.now(),
  });
  const paidTickets = Array.from({ length: 10 }, (_, index) => ({
    id: `admin-prepaid-${index}`, numbers: Array.from({ length: 12 }, (_, number) => number + 1),
  }));
  await repo.purchaseTurboBingoTickets({
    gameId: game.id, userId: admin.id, tickets: paidTickets, totalCost: walletBefore.balance,
  });
  assert.equal((await repo.getTurboBingoWallet(admin.id)).balance, 0);

  const service = createTurboBingoService({ repo });
  const state = await service.getState(admin);
  assert.equal(state.isAdmin, true);
  const result = await service.buyTickets(admin, 1);
  const tickets = await repo.listTurboBingoTickets(game.id, admin.id);
  const walletAfter = await repo.getTurboBingoWallet(admin.id);
  assert.equal(result.tickets.length, 1);
  assert.equal(tickets.length, 11);
  assert.equal(walletAfter.balance, 0, 'Admin free test ticket must not require or deduct balance');
  service.stop();
});


test('Turbo Bingo Host can pause, resume and end a round without drawing while paused', async () => {
  const repo = createMemoryRepo();
  const service = createTurboBingoService({ repo });
  await service.updateSettings({ mode: 'admin', drawIntervalSeconds: 1 });
  await service.openGame();
  const game = await repo.getCurrentTurboBingoGame();
  const admin = await repo.createUser({
    phone: '251911000096', name: 'Turbo Host Pause Test', pinHash: 'test-hash',
    role: 'admin', phoneVerified: false,
  });
  await repo.getTurboBingoWallet(admin.id);
  await repo.purchaseTurboBingoTickets({
    gameId: game.id, userId: admin.id,
    tickets: [{ id: 'turbo-pause-ticket', numbers: Array.from({ length: 12 }, (_, i) => i + 1) }],
    totalCost: 0,
  });
  await service.startGame();
  const paused = await service.pauseGame();
  assert.equal(paused.game.status, 'running', 'pause preserves the running round state');
  assert.equal(paused.game.isPaused, true);
  assert.ok(paused.game.pausedAt);
  await assert.rejects(service.drawNextManually(), /resume the round/i);
  await assert.rejects(service.claim(admin, 'turbo-pause-ticket'), /active Turbo Bingo game/i);
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal((await repo.getCurrentTurboBingoGame()).drawnNumbers.length, 0, 'no numbers are drawn while paused');
  const resumed = await service.startGame();
  assert.equal(resumed.game.status, 'running');
  assert.equal(resumed.game.isPaused, false);
  assert.equal(resumed.game.pausedAt, null);
  await service.drawNextManually();
  assert.equal((await repo.getCurrentTurboBingoGame()).drawnNumbers.length, 1);
  const ended = await service.stopGame();
  assert.equal(ended.game.status, 'ended');
  assert.equal(ended.game.isPaused, false);
  assert.equal(ended.game.endReason, 'admin_stopped');
  await service.resume();
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal((await repo.getCurrentTurboBingoGame()).status, 'ended', 'Admin-ended round remains ended until Host explicitly opens ticket sales');
  service.stop();
});

test('Turbo Bingo Admin mode manually calls server-random numbers and credits only its isolated demo wallet', async () => {
  const repo = createMemoryRepo();
  const user = await repo.createUser({
    phone: '251911000099', name: 'Turbo Admin Mode Test', pinHash: 'test-hash',
    role: 'player', phoneVerified: true,
  });
  await repo.getTurboBingoWallet(user.id);
  const service = createTurboBingoService({ repo });
  await service.updateSettings({
    mode: 'admin', roundType: 'quick', target: 5, ticketPriceEtb: 1,
    prizeEtb: 12.5, drawIntervalSeconds: 4, roundDurationSeconds: 120,
  });
  await service.openGame();
  let game = await repo.getCurrentTurboBingoGame();
  assert.equal(game.mode, 'admin');
  assert.equal(game.roundType, 'quick');
  assert.equal(game.target, 5);
  assert.equal(game.prizeEtb, 12.5);
  assert.equal(game.roundDurationSeconds, 120);

  const ticket = { id: 'turbo-manual-ticket', numbers: Array.from({ length: 25 }, (_, i) => i + 1), status: 'active' };
  await repo.purchaseTurboBingoTickets({ gameId: game.id, userId: user.id, tickets: [ticket], totalCost: 100 });
  await service.startGame();
  game = await repo.getCurrentTurboBingoGame();
  assert.equal(game.status, 'running');
  assert.equal(game.nextDrawAt, null, 'manual mode must not schedule automatic calls');

  let won = false;
  for (let i = 0; i < 80 && !won; i += 1) {
    await service.drawNextManually();
    const state = await service.getState(user);
    assert.equal(state.game.drawnNumbers.length, i + 1);
    const ownedTicket = state.tickets[0];
    if (ownedTicket.matchedNumbers.length === 5) {
      await service.claim(user, ownedTicket.id);
      won = true;
    }
  }
  assert.equal(won, true, 'the server-random draw sequence eventually completes the quick target');
  const wallet = await repo.getTurboBingoWallet(user.id);
  assert.equal(wallet.balance, 101150, 'ticket debit and ETB 12.50 demo prize must reconcile exactly');
  service.stop();
});

test('Turbo Bingo Automatic mode schedules server draws and validates timing and prize bounds', async () => {
  const repo = createMemoryRepo();
  const service = createTurboBingoService({ repo });
  await service.updateSettings({ mode: 'automatic', roundType: 'standard', target: 10, drawIntervalSeconds: 3, roundDurationSeconds: 180, prizeEtb: 25 });
  await service.openGame();
  const game = await repo.getCurrentTurboBingoGame();
  const user = await repo.createUser({ phone: '251911000098', name: 'Turbo Auto Test', pinHash: 'test-hash', role: 'player', phoneVerified: true });
  await repo.getTurboBingoWallet(user.id);
  await repo.purchaseTurboBingoTickets({ gameId: game.id, userId: user.id, tickets: [{ id: 'turbo-auto-ticket', numbers: Array.from({ length: 25 }, (_, i) => i + 1) }], totalCost: 100 });
  await service.startGame();
  const running = await repo.getCurrentTurboBingoGame();
  assert.equal(running.mode, 'automatic');
  assert.ok(running.nextDrawAt >= running.startedAt + 3000);
  await assert.rejects(service.updateSettings({ roundDurationSeconds: 29 }), /Round duration/);
  await assert.rejects(service.updateSettings({ prizeEtb: 10000.001 }), /Prize/);
  service.stop();
});


test('Turbo Bingo history retains ended rounds', async () => { const { repo, game } = await setup(12); await repo.updateTurboBingoGame(game.id, game.version, { status: 'ended', endedAt: Date.now(), endReason: 'test_complete' }); const history = await repo.listTurboBingoHistory(10); assert.equal(history.length, 1); assert.equal(history[0].target, 12); });
test('Turbo Bingo Full House is 12 and target 13 is rejected', async () => { const repo = createMemoryRepo(); const service = createTurboBingoService({ repo }); await service.updateSettings({ roundType: 'full_house' }); assert.equal((await service.getSettings()).target, 12); await assert.rejects(service.updateSettings({ target: 13 }), /1 to 12/); service.stop(); });

test('Turbo Bingo automatic draw continues after the configured round timer expires', async () => {
  const repo = createMemoryRepo();
  const service = createTurboBingoService({ repo });
  await service.updateSettings({ mode: 'automatic', drawIntervalSeconds: 1, roundDurationSeconds: 30 });
  await service.openGame();
  const waiting = await repo.getCurrentTurboBingoGame();
  assert.equal(waiting.ticketCount, 0);
  const started = await service.startGame();
  assert.equal(started.game.status, 'running');
  assert.equal(started.game.ticketCount, 0);
  const running = await repo.getCurrentTurboBingoGame();
  const expired = await repo.updateTurboBingoGame(running.id, running.version, {
    endsAt: Date.now() - 1000,
    nextDrawAt: Date.now() - 1,
  });
  assert.ok(expired);
  await service.resume();
  await new Promise((resolve) => setTimeout(resolve, 300));
  const afterExpiry = await repo.getCurrentTurboBingoGame();
  assert.equal(afterExpiry.status, 'running', 'timer expiry must not end an active draw');
  assert.equal(afterExpiry.drawnNumbers.length, 1, 'the next server draw must still be called');
  service.stop();
});

