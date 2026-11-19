import { randomToken, randomInt, hmacHex, safeEqual } from '../util/crypto.js';
import { HttpError, RepoError } from '../util/errors.js';
import { log } from '../util/log.js';
import { ALL_NUMBERS, WIN_PATTERNS, findWinningPattern, generateGrid, isValidGrid, isWinPattern, newCardCode } from '../game/engine.js';

const clampSec = (n) => Math.min(60, Math.max(1, Math.round(Number(n) || 5)));

export function createGameService({ repo, config, now = Date.now }) {
  const listeners = new Set();
  const cardSecret = hmacHex(config.jwtSecret, 'card-signing');
  const signCard = (code, round, grid) => hmacHex(cardSecret, `${code}|${round}|${JSON.stringify(grid)}`);
  let timer = null;
  const ROUND_INTERVAL_MS = 10 * 60 * 1000;
  const ROUND_DURATION_MS = 8 * 60 * 1000;
  const AUTO_CALL_SECONDS = 8;
  const randomPattern = () => { const ids = Object.keys(WIN_PATTERNS); return ids[randomInt(ids.length)]; };

  /** What every connected browser may see. Never includes anyone's card grid or user id. */
  const publicState = (g) => ({
    phase: g.phase,
    winPattern: g.winPattern ?? 'any_line',
    roundNumber: g.roundNumber,
    calledNumbers: g.calledNumbers,
    autoCall: g.autoCall,
    callIntervalSec: g.callIntervalSec,
    nextCallAt: g.nextCallAt,
    winner: g.winner ? { cardId: g.winner.cardCode, serial: g.winner.serial, at: g.winner.at } : null,
    roomId: config.roomId,
    cardPrice: config.cardPrice / 100,
    roundPrizeEtb: Math.floor(((g.pot ?? 0) * config.prizePercent) / 100) / 100,
    roundCardCount: config.cardPrice > 0 ? Math.floor((g.pot ?? 0) / config.cardPrice) : 0,
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

  /* ───────────── persistent automatic round + number scheduler ───────────── */

  function schedule(g) {
    if (timer) clearTimeout(timer);
    timer = null;
    let due = null;
    if (g.phase === 'waiting') due = g.nextRoundAt ?? (now() + ROUND_INTERVAL_MS);
    else if (g.phase === 'running') due = g.autoCall
      ? Math.min(g.nextCallAt ?? (now() + g.callIntervalSec * 1000), g.roundEndsAt ?? (now() + ROUND_INTERVAL_MS))
      : (g.roundEndsAt ?? (now() + ROUND_INTERVAL_MS));
    else if (g.phase === 'ended') due = g.nextRoundAt ?? (now() + ROUND_INTERVAL_MS);
    if (due === null) return;
    timer = setTimeout(tick, Math.max(0, due - now()));
    timer.unref?.();
  }

  async function tick() {
    try {
      const g = await repo.getGame();
      if (g.phase === 'waiting') {
        if (!g.nextRoundAt) {
          await mutate('waiting', () => ({ nextRoundAt: now() + ROUND_INTERVAL_MS }));
        } else if (g.nextRoundAt <= now()) {
          await mutate('waiting', () => ({
            phase: 'running', winPattern: randomPattern(), calledNumbers: [], winner: null,
            autoCall: true, callIntervalSec: AUTO_CALL_SECONDS,
            nextCallAt: now() + AUTO_CALL_SECONDS * 1000,
            roundStartedAt: now(), roundEndsAt: now() + ROUND_DURATION_MS, nextRoundAt: null,
          }));
        } else schedule(g);
        return;
      }
      if (g.phase === 'ended' || (g.phase === 'running' && g.roundEndsAt && g.roundEndsAt <= now())) {
        const ending = g.phase === 'running' ? await mutate('running', () => ({ phase: 'ended', autoCall: false, nextCallAt: null })) : g;
        await repo.archiveRound({
          round: ending.roundNumber, calledNumbers: ending.calledNumbers, winner: ending.winner,
          winPattern: ending.winPattern ?? 'any_line', pot: ending.pot, endedAt: new Date(now()),
        });
        await mutate('ended', (current) => ({
          phase: 'waiting', roundNumber: current.roundNumber + 1, calledNumbers: [], winner: null,
          autoCall: false, nextCallAt: null, roundStartedAt: null, roundEndsAt: null,
          nextRoundAt: (current.roundStartedAt ?? now()) + ROUND_INTERVAL_MS, pot: 0,
        }));
        return;
      }
      if (g.phase === 'running' && g.autoCall) {
        await service.draw();
        return;
      }
      schedule(g);
    } catch (e) {
      if (e instanceof HttpError && e.code === 'all_drawn') {
        await service.setAuto(false).catch(() => undefined);
        return;
      }
      if (e instanceof HttpError && e.code === 'wrong_phase') {
        schedule(await repo.getGame());
        return;
      }
      console.error('automatic round scheduler failed', e);
      timer = setTimeout(tick, 2000);
      timer.unref?.();
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
      let g = await repo.getGame();
      if (g.phase === 'waiting' && !g.nextRoundAt) {
        g = await repo.casGame(g.version, { nextRoundAt: now() + ROUND_INTERVAL_MS }) ?? await repo.getGame();
      }
      if (g.phase === 'ended' && !g.nextRoundAt) {
        g = await repo.casGame(g.version, { nextRoundAt: now() + ROUND_INTERVAL_MS }) ?? await repo.getGame();
      }
      schedule(g);
    },
    stop() {
      if (timer) clearTimeout(timer);
      timer = null;
    },

    /* ───────────── host / admin ───────────── */

    startRound: () =>
      mutate('waiting', () => ({
        phase: 'running', winPattern: randomPattern(), calledNumbers: [], winner: null,
        autoCall: true, callIntervalSec: AUTO_CALL_SECONDS, nextCallAt: now() + AUTO_CALL_SECONDS * 1000,
        roundStartedAt: now(), roundEndsAt: now() + ROUND_DURATION_MS, nextRoundAt: null,
      })),

    endRound: () => mutate('running', () => ({ phase: 'ended', autoCall: false, nextCallAt: null })),

    setWinPattern(pattern) {
      if (!isWinPattern(pattern)) throw new HttpError(400, 'invalid_pattern', 'Choose a supported bingo pattern');
      return mutate('waiting', () => ({ winPattern: pattern }));
    },

    async resetRound() {
      const before = await repo.getGame();
      if (before.phase !== 'ended') throw new HttpError(409, 'wrong_phase', `Round is ${before.phase}`);
      await repo.archiveRound({
        round: before.roundNumber,
        calledNumbers: before.calledNumbers,
        winner: before.winner,
        winPattern: before.winPattern ?? 'any_line',
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

    async buyCards(user, count, requestedSerial) {
      const n = Number(count);
      if (!Number.isInteger(n) || n < 1 || n > Math.min(config.maxCardsPerPurchase, 50)) {
        throw new HttpError(400, 'invalid_count', `Buy 1 to ${Math.min(config.maxCardsPerPurchase, 50)} cards`);
      }
      const g = await repo.getGame();
      if (g.phase !== 'waiting') throw new HttpError(409, 'round_not_open', 'Cards can only be bought before a round starts');
      if (requestedSerial !== undefined && requestedSerial !== null && (n !== 1 || !/^\d{5}$/.test(String(requestedSerial)))) {
        throw new HttpError(400, 'invalid_card_number', 'Enter one unique five-digit card number and buy one card at a time');
      }
      let serials;
      try {
        serials = await repo.reserveCardSerials(g.roundNumber, n, requestedSerial);
      } catch (e) {
        if (e instanceof RepoError && e.code === 'ROUND_NOT_OPEN') throw new HttpError(409, 'round_not_open', 'Cards can only be bought before a round starts');
        throw e;
      }
      const cards = Array.from({ length: n }, (_, i) => {
        const code = newCardCode();
        const grid = generateGrid();
        return { code, serial: serials[i], grid, sig: signCard(code, g.roundNumber, grid) };
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
        if (e instanceof RepoError && e.code === 'CARD_NUMBER_TAKEN') throw new HttpError(409, 'card_number_taken', 'That card number is already taken. Choose another number.');
        throw e;
      }
    },

    async myCards(user) {
      const g = await repo.getGame();
      const cards = await repo.listCards(user.id, g.roundNumber);
      return cards.map((c) => ({ id: c.code, serial: c.serial, grid: c.grid, locked: !!c.lockedAt }));
    },

    /**
     * BINGO claim. The server decides from ITS OWN record of the card and the called numbers; the browser's marks
     * are irrelevant. The first valid claim wins atomically; later claims get `already_won`.
     */
    async claim(user, cardCode, expectedCallCount) {
      const g = await repo.getGame();
      if (g.phase !== 'running') throw new HttpError(409, 'wrong_phase', 'No round is running');
      // A claim belongs to the exact called-number snapshot shown when the player clicked BINGO.
      // Any subsequent draw expires that opportunity, even if the card still has a winning pattern.
      if (!Number.isInteger(expectedCallCount) || expectedCallCount !== g.calledNumbers.length) {
        return { ok: false, reason: 'claim_expired' };
      }
      const card = await repo.getCard(String(cardCode ?? '').toUpperCase());
      if (!card || card.round !== g.roundNumber) throw new HttpError(404, 'card_not_found', 'Card not found in this round');
      if (card.userId !== user.id) throw new HttpError(403, 'not_your_card', 'This card belongs to another player');
      if (card.lockedAt) return { ok: false, reason: 'card_locked' };
      if (!safeEqual(card.sig, signCard(card.code, card.round, card.grid)) || !isValidGrid(card.grid)) {
        throw new HttpError(409, 'card_invalid', 'Card failed the integrity check');
      }
      if (findWinningPattern(card.grid, new Set(g.calledNumbers), g.winPattern ?? 'any_line').missing !== 0) {
        const locked = await repo.lockCard({ code: card.code, userId: user.id, round: g.roundNumber, expectedVersion: g.version });
        return locked ? { ok: false, reason: 'false_bingo', cardLocked: true } : { ok: false, reason: 'claim_expired' };
      }

      const prize = Math.floor((g.pot * config.prizePercent) / 100);
      const settled = await repo.settleWin({ round: g.roundNumber, expectedVersion: g.version, card, prize, ref: `win:${g.roundNumber}:${card.code}` });
      if (!settled) return { ok: false, reason: 'already_won' };
      const advanced = await repo.casGame(settled.version, { nextRoundAt: (g.roundStartedAt ?? now()) + ROUND_INTERVAL_MS }) ?? await repo.getGame();
      schedule(advanced);
      broadcast(advanced);
      log('prize_credited_to_wallet', { round: g.roundNumber, card: card.code, userId: user.id, etb: prize / 100, potEtb: g.pot / 100 });
      return { ok: true, prize: prize / 100, payoutStatus: 'paid' };
    },

    async unlockCard(cardCode) {
      const code = String(cardCode ?? '').toUpperCase();
      if (!code) throw new HttpError(400, 'invalid_card_id', 'Card ID is required');
      if (!(await repo.unlockCard(code))) throw new HttpError(404, 'locked_card_not_found', 'Locked card not found');
      return { ok: true, cardId: code, unlocked: true };
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
      let pattern = g.winPattern ?? 'any_line';
      if (card.round === g.roundNumber) {
        called = new Set(g.calledNumbers);
        isWinner = g.winner?.cardCode === code;
      } else {
        const archived = await repo.getArchivedRound(card.round);
        called = new Set(archived?.calledNumbers ?? []);
        isWinner = archived?.winner?.cardCode === code;
        pattern = archived?.winPattern ?? 'any_line';
      }
      const win = findWinningPattern(card.grid, called, pattern);
      const line = win.missing === 0 ? win.positions : null;
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
