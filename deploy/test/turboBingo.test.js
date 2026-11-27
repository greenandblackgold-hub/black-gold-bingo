import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/db/memoryRepo.js';

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
  const ticket = { id: 'turbo-test-ticket', numbers: Array.from({ length: 25 }, (_, i) => i + 1), status: 'active' };
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
      tickets: [{ id: 'limit-ticket-2', numbers: Array.from({ length: 25 }, (_, i) => i + 26) }],
      totalCost: 100,
    }),
    (error) => error.code === 'TURBO_BINGO_TICKET_LIMIT',
  );
});
