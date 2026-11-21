import { hmacHex } from '../util/crypto.js';
import { generateGrid, newCardCode } from '../game/engine.js';

const BONUS_EVERY = 10;
const BONUS_CARDS_PER_PLAYER = 3;
const BONUS_PRIZE_SANTIM = 1_000_000;

export function createBonusService({ repo, game, config }) {
  const cardSecret = hmacHex(config.jwtSecret, 'card-signing');
  const signCard = (code, round, grid) => hmacHex(cardSecret, `${code}|${round}|${JSON.stringify(grid)}`);
  let stopped = false;
  let queue = Promise.resolve();
  const enqueue = () => {
    queue = queue.then(processState).catch((error) => {
      console.error('automatic bonus cycle failed', error);
    });
    return queue;
  };

  async function countRegularRound(g) {
    if (g.bonusRound || g.lastCountedRegularRound === g.roundNumber) return false;
    const count = Math.min(BONUS_EVERY, Math.max(0, Number(g.regularRoundsSinceBonus) || 0) + 1);
    const next = await repo.casGame(g.version, {
      regularRoundsSinceBonus: count,
      lastCountedRegularRound: g.roundNumber,
      bonusDue: count >= BONUS_EVERY,
    });
    if (!next) return false;
    if (count === BONUS_EVERY - 2) {
      await game.setAnnouncement('🎁 ለነፃው 10,000 ብር የቦነስ ጨዋታ 2 መደበኛ ዙሮች ቀርተዋል። እንዳያመልጥዎ!');
    } else if (count === BONUS_EVERY - 1) {
      await game.setAnnouncement('🎁 አንድ መደበኛ ዙር ብቻ ቀርቷል! ከዚያ በኋላ 10,000 ብር የሚያሸልመው ነፃ የቦነስ ጨዋታ ይጀምራል። እስከ 3 ነፃ ካርቴላ ያግኙ!');
    }
    return true;
  }

  async function prepareBonus(g) {
    const saved = {
      prizeMode: g.prizeMode ?? 'revenue_percent',
      prizePercent: g.prizePercent,
      fixedPrize: g.fixedPrize,
      prizePerPlayer: g.prizePerPlayer,
      maxPrizeCap: g.maxPrizeCap,
    };
    const prepared = await repo.casGame(g.version, {
      bonusDue: false,
      bonusRound: true,
      bonusRoundPrepared: true,
      bonusSavedPrizeSettings: saved,
      prizeMode: 'fixed',
      fixedPrize: BONUS_PRIZE_SANTIM,
      maxPrizeCap: BONUS_PRIZE_SANTIM,
      pot: 0,
      roundPrize: null,
      roundPlayerIds: [],
    });
    if (!prepared) return;
    await game.setAnnouncement('🎉 ነፃ የቦነስ ጨዋታ አሁን ተጀምሯል! የሽልማቱ መጠን 10,000 ብር ነው። ለእያንዳንዱ ተጫዋች እስከ 3 ነፃ ካርቴላ ተሰጥቷል።');
    await grantFreeCards(prepared);
    await game.startRound();
    const running = await repo.getGame();
    if (running.phase === 'running' && running.bonusRound && running.bonusRoundPrepared) {
      await repo.casGame(running.version, { bonusRoundPrepared: false });
    }
  }

  async function grantFreeCards(g) {
    const players = await repo.listPlayerIds();
    const playerIds = [];
    for (const userId of players) {
      const existing = await repo.countCards(userId, g.roundNumber);
      const remaining = Math.max(0, BONUS_CARDS_PER_PLAYER - existing);
      if (!remaining) {
        playerIds.push(userId);
        continue;
      }
      const serials = await repo.reserveCardSerials(g.roundNumber, remaining);
      const cards = serials.map((serial) => {
        const code = newCardCode();
        const grid = generateGrid();
        return { code, serial, grid, sig: signCard(code, g.roundNumber, grid) };
      });
      await repo.insertFreeCards({ userId, round: g.roundNumber, cards });
      playerIds.push(userId);
    }
    const current = await repo.getGame();
    if (current.phase === 'waiting' && current.roundNumber === g.roundNumber) {
      await repo.casGame(current.version, { roundPlayerIds: playerIds });
    }
  }

  async function finishBonus(g) {
    if (g.phase !== 'waiting' || !g.bonusRound || g.bonusRoundPrepared) return false;
    const saved = g.bonusSavedPrizeSettings ?? {};
    const restored = await repo.casGame(g.version, {
      bonusRound: false,
      bonusRoundPrepared: false,
      bonusSavedPrizeSettings: null,
      regularRoundsSinceBonus: 0,
      bonusDue: false,
      prizeMode: saved.prizeMode ?? 'revenue_percent',
      prizePercent: saved.prizePercent ?? g.prizePercent,
      fixedPrize: saved.fixedPrize ?? 0,
      prizePerPlayer: saved.prizePerPlayer ?? 0,
      maxPrizeCap: saved.maxPrizeCap ?? 0,
    });
    if (restored) {
      await game.setAnnouncement('🏁 የቦነስ ጨዋታው ተጠናቋል። የመደበኛ ጨዋታዎች 10 ዙር ዑደት እንደገና ተጀምሯል።');
      return true;
    }
    return false;
  }

  async function processState() {
    if (stopped) return;
    let g = await repo.getGame();
    if (g.phase === 'ended') {
      if (g.bonusRound) return;
      if (await countRegularRound(g)) g = await repo.getGame();
    }
    if (g.phase === 'waiting' && g.bonusRound && !g.bonusRoundPrepared) {
      await finishBonus(g);
      return;
    }
    if (g.phase === 'waiting' && g.bonusDue && !g.bonusRound) {
      await prepareBonus(g);
      return;
    }
    if (g.phase === 'waiting' && g.bonusRound && g.bonusRoundPrepared) {
      await grantFreeCards(g);
      await game.startRound();
      const running = await repo.getGame();
      if (running.phase === 'running' && running.bonusRound && running.bonusRoundPrepared) {
        await repo.casGame(running.version, { bonusRoundPrepared: false });
      }
    }
  }

  const unsubscribe = game.subscribe(() => { void enqueue(); });

  return {
    async resume() { await enqueue(); },
    stop() { stopped = true; unsubscribe(); },
  };
}
