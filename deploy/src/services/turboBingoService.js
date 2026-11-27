import { randomInt, randomUUID } from 'node:crypto';
import { HttpError, RepoError } from '../util/errors.js';

const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  target: 10,
  ticketPriceEtb: 1,
  drawIntervalSeconds: 2,
  maxTicketsPerPlayer: 10,
});
const TARGET_MIN = 1;
const TARGET_MAX = 25;
const NUMBER_MAX = 80;

const shuffle = (values) => {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const matchedNumbers = (ticket, calledNumbers) => {
  const called = new Set(calledNumbers);
  return ticket.numbers.filter((number) => called.has(number));
};

export function createTurboBingoService({ repo }) {
  let timer = null;
  let ticking = false;
  const listeners = new Set();

  async function settings() {
    return { ...DEFAULT_SETTINGS, ...(await repo.getTurboBingoSettings()) };
  }
  async function publish() {
    const state = await getState();
    for (const listener of listeners) {
      try { listener(state); } catch { /* a disconnected subscriber cannot stop the game */ }
    }
  }
  async function openGame() {
    const config = await settings();
    if (!config.enabled) throw new HttpError(503, 'turbo_bingo_disabled', 'Turbo Bingo is disabled.');
    const current = await repo.getCurrentTurboBingoGame();
    if (current && current.status !== 'ended') throw new HttpError(409, 'game_already_open', 'A Turbo Bingo game is already open.');
    const game = await repo.createTurboBingoGame({
      id: randomUUID(), status: 'waiting', target: config.target,
      ticketPriceEtb: config.ticketPriceEtb, maxTicketsPerPlayer: config.maxTicketsPerPlayer,
      drawnNumbers: [], ticketCount: 0, createdAt: Date.now(),
    });
    await publish();
    return getState();
  }

  async function getState(user) {
    const [config, game] = await Promise.all([settings(), repo.getCurrentTurboBingoGame()]);
    let tickets = [];
    let wallet = null;
    if (user) {
      tickets = game ? await repo.listTurboBingoTickets(game.id, user.id) : [];
      wallet = await repo.getGameHubWallet(user.id, 'legacy-demo');
    }
    return {
      settings: {
        enabled: config.enabled,
        target: config.target,
        ticketPriceEtb: game?.ticketPriceEtb ?? config.ticketPriceEtb,
        drawIntervalSeconds: config.drawIntervalSeconds,
        maxTicketsPerPlayer: game?.maxTicketsPerPlayer ?? config.maxTicketsPerPlayer,
      },
      game: game ? {
        id: game.id,
        status: game.status,
        target: game.target,
        drawnNumbers: game.drawnNumbers,
        lastNumber: game.drawnNumbers.at(-1) ?? null,
        startedAt: game.startedAt ?? null,
        nextDrawAt: game.nextDrawAt ?? null,
        endedAt: game.endedAt ?? null,
        winner: game.winner ?? null,
        ticketCount: game.ticketCount ?? 0,
      } : null,
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        numbers: ticket.numbers,
        matchedNumbers: game ? matchedNumbers(ticket, game.drawnNumbers) : [],
        status: ticket.status,
        lockedAt: ticket.lockedAt ?? null,
      })),
      balanceEtb: wallet ? wallet.balance / 100 : null,
      balanceType: 'SIMULATION_ONLY',
    };
  }

  async function buyTickets(user, count = 1) {
    const config = await settings();
    if (!config.enabled) throw new HttpError(503, 'turbo_bingo_disabled', 'Turbo Bingo is temporarily unavailable.');
    if (user?.role !== 'player' || user.phoneVerified !== true) {
      throw new HttpError(403, 'player_verification_required', 'Verify your player account before buying tickets.');
    }
    const game = await repo.getCurrentTurboBingoGame();
    if (!Number.isInteger(count) || count < 1 || count > (game?.maxTicketsPerPlayer ?? config.maxTicketsPerPlayer)) {
      throw new HttpError(400, 'invalid_ticket_count', 'Choose a valid number of tickets.');
    }
    if (!game || game.status !== 'waiting') throw new HttpError(409, 'ticket_sales_closed', 'Ticket sales are closed for this game.');
    const existingTickets = await repo.listTurboBingoTickets(game.id, user.id);
    if (existingTickets.length + count > (game.maxTicketsPerPlayer ?? config.maxTicketsPerPlayer)) throw new HttpError(400, 'ticket_limit', 'You have reached the ticket limit for this game.');
    await repo.getGameHubWallet(user.id, 'legacy-demo');
    const price = Math.round((game.ticketPriceEtb ?? config.ticketPriceEtb) * 100);
    const tickets = Array.from({ length: count }, () => ({
      id: randomUUID(),
      numbers: shuffle(Array.from({ length: NUMBER_MAX }, (_, index) => index + 1)).slice(0, 25).sort((a, b) => a - b),
      status: 'active',
    }));
    try {
      const result = await repo.purchaseTurboBingoTickets({
        gameId: game.id, userId: user.id, tickets, totalCost: price * count,
      });
      return { ...result, balanceEtb: result.balance / 100 };
    } catch (error) {
      if (error instanceof RepoError && error.code === 'INSUFFICIENT_FUNDS') {
        throw new HttpError(409, 'insufficient_demo_credits', 'Not enough simulation credits for these tickets.');
      }
      if (error instanceof RepoError && error.code === 'TURBO_BINGO_SALES_CLOSED') {
        throw new HttpError(409, 'ticket_sales_closed', 'Ticket sales are closed for this game.');
      }
      throw error;
    }
  }

  async function startGame() {
    const config = await settings();
    if (!config.enabled) throw new HttpError(503, 'turbo_bingo_disabled', 'Turbo Bingo is disabled.');
    const game = await repo.getCurrentTurboBingoGame();
    if (!game || game.status === 'ended') throw new HttpError(409, 'sales_not_open', 'Open ticket sales before starting the draw.');
    if (game.status !== 'waiting') throw new HttpError(409, 'game_already_running', 'A Turbo Bingo game is already running.');
    if (!game.ticketCount) throw new HttpError(409, 'no_tickets', 'At least one ticket must be registered before starting.');
    const startedAt = Date.now();
    const updated = await repo.updateTurboBingoGame(game.id, game.version, {
      status: 'running', startedAt, nextDrawAt: startedAt + config.drawIntervalSeconds * 1000,
    });
    if (!updated) throw new HttpError(409, 'game_changed', 'The game changed. Refresh and try again.');
    await publish();
    return getState();
  }

  async function stopGame() {
    const game = await repo.getCurrentTurboBingoGame();
    if (!game || game.status !== 'running') throw new HttpError(409, 'game_not_running', 'There is no running Turbo Bingo game.');
    const updated = await repo.updateTurboBingoGame(game.id, game.version, {
      status: 'ended', endedAt: Date.now(), endReason: 'admin_stopped',
    });
    if (!updated) throw new HttpError(409, 'game_changed', 'The game changed. Refresh and try again.');
    await publish();
    return getState();
  }

  async function drawNext() {
    const config = await settings();
    const game = await repo.getCurrentTurboBingoGame();
    if (!game || game.status !== 'running' || Date.now() < Number(game.nextDrawAt ?? 0)) return false;
    const tickets = await repo.listTurboBingoTickets(game.id);
    const previousLast = game.drawnNumbers.at(-1);
    const lockedTicketIds = tickets.filter((ticket) => {
      if (ticket.status !== 'active' || previousLast == null) return false;
      const hits = matchedNumbers(ticket, game.drawnNumbers);
      return hits.length === game.target;
    }).map((ticket) => ticket.id);
    const remaining = Array.from({ length: NUMBER_MAX }, (_, index) => index + 1)
      .filter((number) => !game.drawnNumbers.includes(number));
    if (!remaining.length) {
      await repo.updateTurboBingoGame(game.id, game.version, { status: 'ended', endedAt: Date.now(), endReason: 'numbers_exhausted' }, []);
      await publish();
      return true;
    }
    const nextNumber = remaining[randomInt(remaining.length)];
    const drawnNumbers = [...game.drawnNumbers, nextNumber];
    const status = drawnNumbers.length === NUMBER_MAX ? 'ended' : 'running';
    const updated = await repo.updateTurboBingoGame(game.id, game.version, {
      drawnNumbers,
      lastDrawnAt: Date.now(),
      nextDrawAt: status === 'running' ? Date.now() + config.drawIntervalSeconds * 1000 : null,
      ...(status === 'ended' ? { status, endedAt: Date.now(), endReason: 'numbers_exhausted' } : {}),
    }, lockedTicketIds);
    if (updated) await publish();
    return Boolean(updated);
  }

  async function claim(user, ticketId) {
    if (typeof ticketId !== 'string' || ticketId.length > 80) {
      throw new HttpError(400, 'invalid_ticket', 'Select a valid ticket.');
    }
    const game = await repo.getCurrentTurboBingoGame();
    if (!game || game.status !== 'running') throw new HttpError(409, 'game_not_running', 'There is no active Turbo Bingo game.');
    const ticket = await repo.getTurboBingoTicket(game.id, ticketId, user.id);
    if (!ticket) throw new HttpError(404, 'ticket_not_found', 'This ticket was not found in your account.');
    if (ticket.status !== 'active') throw new HttpError(409, 'ticket_locked', 'This ticket is no longer eligible to claim.');
    const hits = matchedNumbers(ticket, game.drawnNumbers);
    const lastNumber = game.drawnNumbers.at(-1);
    if (hits.length !== game.target || lastNumber == null || !ticket.numbers.includes(lastNumber)) {
      throw new HttpError(409, 'not_a_winner', 'Your ticket does not meet the exact target on the latest called number.');
    }
    const winner = { userId: user.id, ticketId, at: Date.now() };
    const result = await repo.claimTurboBingoTicket({ gameId: game.id, expectedVersion: game.version, ticketId, userId: user.id, winner });
    if (!result) throw new HttpError(409, 'claim_too_late', 'The game changed before your claim was accepted. The ticket may be locked.');
    await publish();
    return { ok: true, winner: result.winner, game: await getState() };
  }

  async function updateSettings(input) {
    const current = await settings();
    const next = { ...current };
    if (input.enabled !== undefined) next.enabled = input.enabled === true;
    if (input.target !== undefined) {
      if (!Number.isInteger(input.target) || input.target < TARGET_MIN || input.target > TARGET_MAX) {
        throw new HttpError(400, 'invalid_target', 'Winning target must be a whole number from 1 to 25.');
      }
      next.target = input.target;
    }
    if (input.ticketPriceEtb !== undefined) {
      const price = Number(input.ticketPriceEtb);
      if (!Number.isFinite(price) || price < 0.1 || price > 1000 || Math.round(price * 100) !== price * 100) {
        throw new HttpError(400, 'invalid_ticket_price', 'Ticket price must be ETB 0.10–1,000 in whole cents.');
      }
      next.ticketPriceEtb = price;
    }
    if (input.drawIntervalSeconds !== undefined) {
      if (!Number.isInteger(input.drawIntervalSeconds) || input.drawIntervalSeconds < 1 || input.drawIntervalSeconds > 30) {
        throw new HttpError(400, 'invalid_draw_interval', 'Draw interval must be 1–30 seconds.');
      }
      next.drawIntervalSeconds = input.drawIntervalSeconds;
    }
    return repo.updateTurboBingoSettings(next);
  }

  async function getAdminOverview() {
    const [config, game] = await Promise.all([settings(), repo.getCurrentTurboBingoGame()]);
    return { settings: config, game, tickets: game ? await repo.listTurboBingoTickets(game.id) : [] };
  }

  async function tick() {
    if (ticking) return;
    ticking = true;
    try { await drawNext(); } catch { /* the next tick retries transient repository errors */ }
    finally { ticking = false; }
  }

  return {
    getState, getSettings: settings, buyTickets, startGame, stopGame, claim,
    updateSettings, getAdminOverview, openGame,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async resume() {
      const current = await repo.getCurrentTurboBingoGame();
      if (!current) {
        const config = await settings();
        await repo.createTurboBingoGame({ id: randomUUID(), status: 'waiting', target: config.target, ticketPriceEtb: config.ticketPriceEtb, maxTicketsPerPlayer: config.maxTicketsPerPlayer, drawnNumbers: [], ticketCount: 0, createdAt: Date.now() });
      }
      if (!timer) { timer = setInterval(() => void tick(), 200); timer.unref?.(); }
    },
    stop() { if (timer) clearInterval(timer); timer = null; listeners.clear(); },
  };
}
