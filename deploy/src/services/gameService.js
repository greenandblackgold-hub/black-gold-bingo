import { randomToken, randomInt, hmacHex, safeEqual } from '../util/crypto.js';
import { HttpError, RepoError } from '../util/errors.js';
import { log } from '../util/log.js';
import { ALL_NUMBERS, findWinningLine, generateGrid, isValidGrid, newCardCode } from '../game/engine.js';

const clampSec = (n) => Math.min(60, Math.max(1, Math.round(Number(n) || 5)));

export function createGameService({ repo, config, now = Date.now }) {
  const listeners = new Set();
  const cardSecret = hmacHex(config.jwtSecret, 'card-signing');
  const signCard = (code, round, grid) => hmacHex(cardSecret, `${code}|${round}|${JSON.stringify(grid)}`);
  let timer = null;

  /** What every connected browser may see. Never includes anyone's card grid or user id. */
  const publicState = (g) => ({
    phase: g.phase,
    roundNumber: g.roundNumber,
    calledNumbers: g.calledNumbers,
    autoCall: g.autoCall,
    callIntervalSec: g.callIntervalSec,
    nextCallAt: g.nextCallAt,
    winner: g.winner ? { cardId: g.winner.cardCode, serial: g.winner.serial, at: g.winner.at } : null,
    roomId: config.roomId,
    cardPrice: config.cardPrice / 100,
    serverTime: now(),
  });

  const broadcast = (g) => {
    const state = publicState(g);
    for (const fn of listeners) fn(state);
  };

  /** Compare-and-set with retry: concurrent requests can never both apply to the same version. */
  async function mutate(expectPhase, build) {
    for (let i = 0; i < 6; i++) {
      const g = await repo.getGame();
      if (expectPhase && g.phase !== expectPhase) throw new HttpError(409, 'wrong_phase', `Round is ${g.phase}`);
      const patch = build(g);
      const next = await repo.casGame(g.version, patch);
      if (next) {
        schedule(next);
        broadcast(next);
        return next;
      }
    }
    throw new HttpError(409, 'conflict', 'Please retry');
  }

  /* ───────────── auto-call scheduler (survives restarts: its state lives in the database) ───────────── */

  function schedule(g) {
    if (timer) clearTimeout(timer);
    timer = null;
    if (g.phase !== 'running' || !g.autoCall) return;
    const due = g.nextCallAt ?? now() + g.callIntervalSec * 1000;
    timer = setTimeout(tick, Math.max(0, due - now()));
    timer.unref?.();
  }

  async function tick() {
    try {
      await service.draw();
    } catch (e) {
      if (e instanceof HttpError && e.code === 'all_drawn') {
        await service.setAuto(false).catch(() => undefined);
      } else if (!(e instanceof HttpError)) {
        console.error('auto-call tick failed', e);
        // Try again shortly rather than silently stopping the game.
        timer = setTimeout(tick, 2000);
        timer.unref?.();
      }
    }
  }

  const service = {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async getPublicState() {
      return publicState(await repo.getGame());
    },
    /** Call once at boot to continue an interrupted auto-call. */
    async resume() {
      schedule(await repo.getGame());
    },
    stop() {
      if (timer) clearTimeout(timer);
      timer = null;
    },

    /* ───────────── host / admin ───────────── */

    startRound: () =>
      mutate('waiting', () => ({ phase: 'running', calledNumbers: [], winner: null, autoCall: false, nextCallAt: null })),

    endRound: () => mutate('running', () => ({ phase: 'ended', autoCall: false, nextCallAt: null })),

    async resetRound() {
      const before = await repo.getGame();
      if (before.phase !== 'ended') throw new HttpError(409, 'wrong_phase', `Round is ${before.phase}`);
      await repo.archiveRound({
        round: before.roundNumber,
        calledNumbers: before.calledNumbers,
        winner: before.winner,
        pot: before.pot,
        endedAt: new Date(),
      });
      return mutate('ended', (g) => ({
        phase: 'waiting',
        roundNumber: g.roundNumber + 1,
        calledNumbers: [],
        winner: null,
        autoCall: false,
        nextCallAt: null,
        pot: 0,
      }));
    },

    draw: () =>
      mutate('running', (g) => {
        const remaining = ALL_NUMBERS.filter((n) => !g.calledNumbers.includes(n));
        if (remaining.length === 0) throw new HttpError(409, 'all_drawn', 'All 75 numbers have been drawn');
        const n = remaining[randomInt(remaining.length)];
        return {
          calledNumbers: [...g.calledNumbers, n],
          nextCallAt: g.autoCall ? now() + g.callIntervalSec * 1000 : null,
        };
      }),

    setAuto: (on, sec) =>
      mutate(null, (g) => {
        if (on && g.phase !== 'running') throw new HttpError(409, 'wrong_phase', 'Start the round first');
        const interval = sec === undefined ? g.callIntervalSec : clampSec(sec);
        return { autoCall: !!on, callIntervalSec: interval, nextCallAt: on ? now() + interval * 1000 : null };
      }),

    /* ───────────── players ───────────── */

    async buyCards(user, count) {
      if (!config.realMoneyEnabled) throw new HttpError(503, 'real_money_disabled', 'Paid card purchases are not enabled yet.');
      const n = Number(count);
      if (!Number.isInteger(n) || n < 1 || n > config.maxCardsPerPurchase) {
        throw new HttpError(400, 'invalid_count', `Buy 1 to ${config.maxCardsPerPurchase} cards`);
      }
      const g = await repo.getGame();
      if (g.phase !== 'waiting') throw new HttpError(409, 'round_not_open', 'Cards can only be bought before a round starts');
      const owned = await repo.countCards(user.id, g.roundNumber);
      const cards = Array.from({ length: n }, (_, i) => {
        const code = newCardCode();
        const grid = generateGrid();
        return { code, serial: owned + i + 1, grid, sig: signCard(code, g.roundNumber, grid) };
      });
      try {
        const res = await repo.purchaseCards({
          userId: user.id,
          cost: n * config.cardPrice,
          cards,
          round: g.roundNumber,
          ref: `buy:${g.roundNumber}:${user.id}:${randomToken(6)}`,
        });
        broadcast(res.game);
        return { balance: res.balance / 100, cards: cards.map((c) => ({ id: c.code, serial: c.serial, grid: c.grid })) };
      } catch (e) {
        if (e instanceof RepoError && e.code === 'INSUFFICIENT_FUNDS') throw new HttpError(402, 'insufficient_funds', 'Not enough balance');
        if (e instanceof RepoError && e.code === 'ROUND_NOT_OPEN') throw new HttpError(409, 'round_not_open', 'Cards can only be bought before a round starts');
        throw e;
      }
    },

    async myCards(user) {
      const g = await repo.getGame();
      const cards = await repo.listCards(user.id, g.roundNumber);
      return cards.map((c) => ({ id: c.code, serial: c.serial, grid: c.grid }));
    },

    /**
     * BINGO claim. The server decides from ITS OWN record of the card and the called numbers; the browser's marks
     * are irrelevant. The first valid claim wins atomically; later claims get `already_won`.
     */
    async claim(user, cardCode) {
      const g = await repo.getGame();
      if (g.phase !== 'running') throw new HttpError(409, 'wrong_phase', 'No round is running');
      const card = await repo.getCard(String(cardCode ?? '').toUpperCase());
      if (!card || card.round !== g.roundNumber) throw new HttpError(404, 'card_not_found', 'Card not found in this round');
      if (card.userId !== user.id) throw new HttpError(403, 'not_your_card', 'This card belongs to another player');
      if (!safeEqual(card.sig, signCard(card.code, card.round, card.grid)) || !isValidGrid(card.grid)) {
        throw new HttpError(409, 'card_invalid', 'Card failed the integrity check');
      }
      if (!findWinningLine(card.grid, new Set(g.calledNumbers))) return { ok: false, reason: 'no_line' };

      const prize = Math.floor((g.pot * config.prizePercent) / 100);
      const settled = await repo.settleWin({ round: g.roundNumber, card, prize, ref: `prize:${g.roundNumber}` });
      if (!settled) return { ok: false, reason: 'already_won' };
      schedule(settled);
      broadcast(settled);
      log('prize_paid', { round: g.roundNumber, card: card.code, userId: user.id, etb: prize / 100, potEtb: g.pot / 100 });
      return { ok: true, prize: prize / 100 };
    },

    /** Anyone logged in may verify a card ID. Only the owner or an admin gets the grid. */
    async verify(user, cardCode) {
      const code = String(cardCode ?? '').toUpperCase();
      const card = await repo.getCard(code);
      if (!card) return { status: 'not_found' };
      if (!safeEqual(card.sig, signCard(card.code, card.round, card.grid))) return { status: 'tampered' };
      const g = await repo.getGame();
      let called;
      let isWinner;
      if (card.round === g.roundNumber) {
        called = new Set(g.calledNumbers);
        isWinner = g.winner?.cardCode === code;
      } else {
        const archived = await repo.getArchivedRound(card.round);
        called = new Set(archived?.calledNumbers ?? []);
        isWinner = archived?.winner?.cardCode === code;
      }
      const line = findWinningLine(card.grid, called);
      const mayView = user.role === 'admin' || card.userId === user.id;
      return {
        status: 'valid',
        isWinner,
        winningLine: mayView && line ? line : undefined,
        card: mayView ? { id: card.code, serial: card.serial, grid: card.grid } : { id: card.code, serial: card.serial },
      };
    },
  };

  return service;
}
