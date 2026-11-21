import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/db/memoryRepo.js';
import { createGameService } from '../src/services/gameService.js';
import { createBonusService } from '../src/services/bonusService.js';

test('ten completed regular rounds trigger one free ETB 10,000 bonus round with at most three cards per player', async () => {
  const repo = createMemoryRepo();
  await repo.init();
  const config = {
    jwtSecret: 'bonus-test-secret-bonus-test-secret-123456',
    roomId: 'TEST',
    cardPrice: 1000,
    prizePercent: 80,
    maxCardsPerPurchase: 50,
  };
  const players = [];
  for (let i = 0; i < 2; i++) {
    players.push(await repo.createUser({
      phone: `091000000${i}`, name: `Player ${i}`, pinHash: 'test-hash', role: 'player', phoneVerified: true,
    }));
  }
  const game = createGameService({ repo, config });
  const pushed = [];
  const bonus = createBonusService({ repo, game, config, push: { isEnabled: () => true, notifyPlayers: async (notification) => { pushed.push(notification.body); } } });
  try {
    await bonus.resume();
    for (let round = 1; round <= 10; round++) {
      await game.startRound();
      await game.endRound();
      await game.resetRound();
      await bonus.resume();
    }

    const state = await repo.getGame();
    assert.equal(state.phase, 'running');
    assert.equal(state.bonusRound, true);
    assert.equal(state.bonusRoundPrepared, false);
    assert.equal(state.roundPrize, 1_000_000);
    assert.equal((await game.getPublicState()).roundPrizeEtb, 10_000);
    assert.equal(state.regularRoundsSinceBonus, 10);
    for (const player of players) {
      const cards = await repo.listCards(player.id, state.roundNumber);
      assert.equal(cards.length, 3);
      assert.ok(cards.every((card) => card.bonusFree === true));
      assert.ok(cards.every((card) => card.sig));

      const balanceBefore = (await repo.findUserById(player.id)).balance;
      const addCardResult = await game.buyCards(player, 5);
      const balanceAfter = (await repo.findUserById(player.id)).balance;
      assert.equal(addCardResult.free, true);
      assert.equal(addCardResult.cards.length, 3);
      assert.deepEqual(addCardResult.cards.map((card) => card.id), cards.map((card) => card.code));
      assert.equal(balanceAfter, balanceBefore);
    }
    assert.equal(state.roundPlayerIds.length, 2);
    assert.ok(pushed.some((message) => message.includes('2 መደበኛ ዙሮች')));
    assert.ok(pushed.some((message) => message.includes('አንድ መደበኛ ዙር')));
    assert.ok(pushed.some((message) => message.includes('10 መደበኛ ዙሮች')));
    assert.ok(pushed.some((message) => message.includes('ተጀምሯል')));

    await game.endRound();
    await game.resetRound();
    await bonus.resume();
    const after = await repo.getGame();
    assert.equal(after.phase, 'waiting');
    assert.equal(after.bonusRound, false);
    assert.equal(after.regularRoundsSinceBonus, 0);
    assert.equal(after.prizeMode, 'revenue_percent');
    assert.equal(after.fixedPrize, 0);
  } finally {
    bonus.stop();
    game.stop();
    await repo.close();
  }
});
