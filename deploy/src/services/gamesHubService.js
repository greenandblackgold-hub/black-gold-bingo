import { createHash, createHmac, randomBytes } from 'node:crypto';
import { HttpError, RepoError } from '../util/errors.js';
import { log } from '../util/log.js';

const GAME_IDS = ['keno', 'aviator'];
const BETTING_GROWTH_PER_MS = 0.00007;
const MAX_MULTIPLIER = 1000;
// Hard server-side ceiling: ETB 20,000 per Keno ticket or Aviator bet.
export const MAX_GAMES_HUB_PAYOUT_SANTIM = 2_000_000;
const DEFAULT_HOUSE_EDGE_PERCENT = 55;

function poolBudget(totalStake, houseEdgePercent) {
  return Math.floor(totalStake * (100 - houseEdgePercent) / 100);
}

function allocateProportionalPool(bets, houseEdgePercent, maxPayout = MAX_GAMES_HUB_PAYOUT_SANTIM) {
  const totalStake = bets.reduce((sum, bet) => sum + bet.stake, 0);
  const budget = poolBudget(totalStake, houseEdgePercent);
  const eligible = bets.filter((bet) => bet.status === 'cashout_pending');
  const totalWeight = eligible.reduce((sum, bet) => sum + bet.stake * Math.max(100, Math.round((bet.multiplier ?? 1) * 100)), 0);
  if (!totalWeight || !budget) return eligible.map((bet) => ({ betId: bet.id, payout: 0 }));
  return eligible.map((bet) => ({
    betId: bet.id,
    payout: Math.min(maxPayout, Math.floor(budget * (bet.stake * Math.max(100, Math.round((bet.multiplier ?? 1) * 100))) / totalWeight)),
  }));
}
export const capGamesHubPayout = (payout) => Math.min(MAX_GAMES_HUB_PAYOUT_SANTIM, Math.max(0, Math.floor(Number(payout) || 0)));
const DEFAULT_SETTINGS = Object.freeze({
  generalEnabled: true,
  announcementText: '',
  announcementVisible: false,
  bingoEnabled: true,
  kenoEnabled: true,
  aviatorEnabled: true,
  minBet: 200,
  maxBet: 100000,
  kenoBettingSeconds: 20,
  aviatorBettingSeconds: 8,
  houseEdgePercent: DEFAULT_HOUSE_EDGE_PERCENT,
});
const KENO_PAYOUTS = Object.freeze({
  1: { 1: 350 },
  2: { 1: 100, 2: 800 },
  3: { 2: 200, 3: 1800 },
  4: { 2: 100, 3: 500, 4: 4000 },
  5: { 2: 50, 3: 300, 4: 1500, 5: 8000 },
  6: { 2: 50, 3: 200, 4: 800, 5: 3000, 6: 15000 },
  7: { 3: 100, 4: 500, 5: 1500, 6: 6000, 7: 30000 },
  8: { 3: 100, 4: 300, 5: 1000, 6: 3000, 7: 10000, 8: 50000 },
  9: { 3: 50, 4: 200, 5: 500, 6: 2000, 7: 6000, 8: 20000, 9: 100000 },
  10: { 3: 50, 4: 100, 5: 300, 6: 1000, 7: 3000, 8: 10000, 9: 50000, 10: 200000 },
});

const seedHash = (seed) => createHash('sha256').update(seed).digest('hex');
const newSeed = () => randomBytes(32).toString('hex');
const roundId = () => randomBytes(8).toString('hex');

function deterministicKenoDraw(seed, count = 20) {
  const key = Buffer.from(seed, 'hex');
  let counter = 0;
  const next = (max) => {
    const range = 0x1_0000_0000;
    const limit = Math.floor(range / max) * max;
    let value;
    do {
      value = createHmac('sha256', key).update('keno:' + counter++).digest().readUInt32BE(0);
    } while (value >= limit);
    return value % max;
  };
  const pool = Array.from({ length: 80 }, (_, i) => i + 1);
  for (let i = 0; i < count; i++) {
    const j = i + next(pool.length - i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function deterministicCrashPoint(seed) {
  // Domain-separated HMAC keeps the crash result secret even though SHA-256(seed) is public as the commitment.
  const digest = createHmac('sha256', Buffer.from(seed, 'hex')).update('aviator-crash-v1').digest('hex');
  const fraction = Number(BigInt('0x' + digest.slice(0, 13))) / 0x1_0000_0000_0000_0;
  const raw = Math.floor((0.99 / Math.max(1e-12, 1 - fraction)) * 100) / 100;
  return Math.min(MAX_MULTIPLIER, Math.max(1, raw));
}

function publicBet(bet) {
  return {
    id: bet.id,
    status: bet.status,
    stakeEtb: bet.stake / 100,
    selectedNumbers: bet.selectedNumbers,
    matchedNumbers: bet.matchedNumbers ?? [],
    hits: bet.hits ?? 0,
    multiplier: bet.multiplier ?? null,
    payoutEtb: (bet.payout ?? 0) / 100,
    createdAt: bet.createdAt,
    settledAt: bet.settledAt ?? bet.cashedOutAt ?? null,
  };
}

function amountToSantim(value, settings) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(Math.round(amount * 100))) {
    throw new HttpError(400, 'invalid_bet_amount', 'Enter a valid ETB amount with up to two decimal places.');
  }
  const santim = Math.round(amount * 100);
  if (Math.abs(amount * 100 - santim) > 1e-7 || santim < settings.minBet || santim > settings.maxBet) {
    throw new HttpError(400, 'invalid_bet_amount', `Bet must be between ${settings.minBet / 100} and ${settings.maxBet / 100} ETB.`);
  }
  return santim;
}

function assertVerifiedPlayer(user) {
  if (!user || user.role !== 'player' || user.phoneVerified !== true) {
    throw new HttpError(403, 'verified_player_required', 'A verified player account is required to play.');
  }
}

function mapRepoError(error) {
  if (error instanceof RepoError && error.code === 'INSUFFICIENT_FUNDS') {
    throw new HttpError(402, 'insufficient_funds', 'Your available wallet balance is not enough for this bet.');
  }
  if (error instanceof RepoError && error.code === 'ROUND_NOT_OPEN') {
    throw new HttpError(409, 'betting_closed', 'Betting for this round has closed.');
  }
  if (error instanceof RepoError && error.code === 'AVIATOR_BET_LIMIT') {
    throw new HttpError(409, 'aviator_bet_limit_reached', 'You can place up to two Aviator bets per round.');
  }
  if (error instanceof RepoError && error.code === 'BET_NOT_ACTIVE') {
    throw new HttpError(409, 'bet_not_active', 'This bet is no longer available to cash out.');
  }
  throw error;
}

export function createGamesHubService({ repo, config, now = Date.now }) {
  let timer = null;
  let ticking = false;
  const gameTickLocks = new Map();
  const settingsDefaults = { ...DEFAULT_SETTINGS };

  async function settings() {
    const stored = await repo.getGameHubSettings();
    const merged = { ...settingsDefaults, ...stored };
    // The former default was ETB 5. Move that untouched default to ETB 2;
    // explicitly configured minimums remain unchanged.
    if (Number(stored?.minBet) === 500) merged.minBet = 200;
    return merged;
  }

  async function createRound(game, currentSettings) {
    const seed = newSeed();
    const createdAt = now();
    const round = {
      roundId: roundId(),
      game,
      walletMode: !config.prod && config.gamesHubSharedWalletEnabled === true ? 'shared' : 'legacy-demo',
      status: 'betting',
      version: 1,
      bets: [],
      serverSeedHash: seedHash(seed),
      serverSeed: seed,
      createdAt,
      expireAt: new Date(createdAt + 30 * 24 * 60 * 60 * 1000),
      bettingEndsAt: createdAt + (game === 'keno' ? currentSettings.kenoBettingSeconds : currentSettings.aviatorBettingSeconds) * 1000,
    };
    return repo.createGameHubRound(game, round);
  }

  async function runGameTick(game) {
    const currentSettings = await settings();
    let round = await repo.getCurrentGameHubRound(game);
    if (!round || (['settled', 'crashed'].includes(round.status) && Number(round.nextRoundAt ?? 0) <= now())) {
      if (currentSettings.generalEnabled === false) return round;
      round = await createRound(game, currentSettings);
    }
    if (game === 'keno' && round.status === 'betting' && now() >= round.bettingEndsAt) {
      const drawnNumbers = deterministicKenoDraw(round.serverSeed, 20);
      const rawResults = (round.bets ?? []).map((bet) => {
        const matchedNumbers = bet.selectedNumbers.filter((n) => drawnNumbers.includes(n));
        const multiplierHundredths = KENO_PAYOUTS[bet.selectedNumbers.length]?.[matchedNumbers.length] ?? 0;
        return {
          betId: bet.id,
          hits: matchedNumbers.length,
          matchedNumbers,
          payout: capGamesHubPayout(Math.floor((bet.stake * multiplierHundredths) / 100)),
        };
      });
      const totalStake = (round.bets ?? []).reduce((sum, bet) => sum + bet.stake, 0);
      const rawTotal = rawResults.reduce((sum, result) => sum + result.payout, 0);
      const payoutBudget = poolBudget(totalStake, currentSettings.houseEdgePercent ?? DEFAULT_HOUSE_EDGE_PERCENT);
      const scale = rawTotal > payoutBudget && rawTotal > 0 ? payoutBudget / rawTotal : 1;
      const results = rawResults.map((result) => ({ ...result, payout: Math.min(MAX_GAMES_HUB_PAYOUT_SANTIM, Math.floor(result.payout * scale)) }));
      round = await repo.settleKenoGameHubRound({
        roundId: round.roundId, drawnNumbers, results, serverSeed: round.serverSeed,
        settledAt: now(), nextRoundAt: now() + 6000,
      });
      log('games_hub_keno_round_settled', { roundId: round.roundId, bets: results.length });
    }
    if (game === 'aviator' && round.status === 'betting' && now() >= round.bettingEndsAt) {
      const crashMultiplier = deterministicCrashPoint(round.serverSeed);
      const startedAt = now();
      const crashAt = startedAt + Math.ceil(Math.log(crashMultiplier) / BETTING_GROWTH_PER_MS);
      round = await repo.startAviatorGameHubRound({
        roundId: round.roundId, startedAt, crashAt, crashMultiplier,
      });
    }
    if (game === 'aviator' && round.status === 'flying') {
      // Auto Cash Out is evaluated by the server scheduler, not by client polling.
      // Record the exact threshold-crossing time so scheduler jitter cannot lose a
      // valid auto cash-out merely because the next tick arrived after the crash.
      const dueAutoCashouts = (round.bets ?? []).filter((bet) =>
        bet.status === 'active' && Number.isFinite(bet.autoCashOutMultiplier) &&
        bet.autoCashOutMultiplier > 1 && bet.autoCashOutMultiplier <= round.crashMultiplier
      );
      for (const bet of dueAutoCashouts) {
        const thresholdAt = round.startedAt + Math.ceil(Math.log(bet.autoCashOutMultiplier) / BETTING_GROWTH_PER_MS);
        if (thresholdAt >= round.crashAt || thresholdAt > now()) continue;
        const reachedMultiplier = Math.floor(Math.exp((thresholdAt - round.startedAt) * BETTING_GROWTH_PER_MS) * 100) / 100;
        try {
          await repo.cashOutAviatorGameHubBet({
            roundId: round.roundId, betId: bet.id, userId: bet.userId,
            multiplier: reachedMultiplier, cashedOutAt: thresholdAt,
          });
        } catch (error) {
          if (!(error instanceof RepoError && error.code === 'BET_NOT_ACTIVE')) throw error;
        }
      }
      round = await repo.getCurrentGameHubRound('aviator');
    }
    if (game === 'aviator' && round.status === 'flying' && now() >= round.crashAt) {
      const settlements = allocateProportionalPool(round.bets ?? [], currentSettings.houseEdgePercent ?? DEFAULT_HOUSE_EDGE_PERCENT);
      round = await repo.crashAviatorGameHubRound({
        roundId: round.roundId, crashedAt: round.crashAt, nextRoundAt: now() + 6000, settlements,
      });
      log('games_hub_aviator_round_crashed', { roundId: round.roundId, multiplier: round.crashMultiplier });
    }
    return round;
  }

  async function tickGame(game) {
    const pending = gameTickLocks.get(game);
    if (pending) return pending;
    const task = runGameTick(game);
    gameTickLocks.set(game, task);
    try { return await task; }
    finally { if (gameTickLocks.get(game) === task) gameTickLocks.delete(game); }
  }

  async function tickAll() {
    if (ticking) return;
    ticking = true;
    try {
      await Promise.all(GAME_IDS.map((game) => tickGame(game)));
    } finally {
      ticking = false;
    }
  }

  function ensureSimulationMode() {
    // Keno and Aviator are still simulation-only. In production, fail closed if
    // either real-money mode OR the shared Bingo wallet is switched on: otherwise
    // demo-labelled rounds could debit real customer balances before their own
    // approved real-money settlement/risk controls exist.
    if (config.prod && (config.realMoneyEnabled || config.gamesHubSharedWalletEnabled === true)) {
      throw new HttpError(503, 'games_hub_demo_only', 'Keno and Aviator remain demo-only in production. Keep GAMES_HUB_SHARED_WALLET_ENABLED=false until their approved real-money flow is ready.');
    }
  }

  async function getState(game, user) {
    if (!GAME_IDS.includes(game)) throw new HttpError(404, 'game_not_found', 'Unknown game.');
    ensureSimulationMode();
    const currentSettings = await settings();
    if (currentSettings.generalEnabled === false) throw new HttpError(503, 'games_center_disabled', 'Games Center is temporarily unavailable.');
    const round = await tickGame(game);
    const serverTime = now();
    const myBets = (round.bets ?? []).filter((bet) => bet.userId === user.id).map(publicBet);
    const liveBets = game === 'aviator' ? (round.bets ?? []).map((bet) => ({ player: String(bet.username || 'Player').slice(0, 32), stakeEtb: bet.stake / 100, status: bet.status, multiplier: bet.multiplier ?? null, payoutEtb: (bet.payout ?? 0) / 100 })) : undefined;
    const playerCount = game === 'aviator' ? new Set((round.bets ?? []).map((bet) => bet.userId)).size : undefined;
    const wallet = await repo.getGameHubWallet(user.id, round.walletMode === 'shared' ? 'shared' : 'legacy-demo');
    const state = {
      game,
      roundId: round.roundId,
      status: round.status,
      bettingEndsAt: round.bettingEndsAt,
      serverTime,
      serverSeedHash: round.serverSeedHash,
      myBets,
      ...(game === 'aviator' ? { liveBets, playerCount } : {}),
      minBetEtb: currentSettings.minBet / 100,
      maxBetEtb: currentSettings.maxBet / 100,
      maxPayoutEtb: MAX_GAMES_HUB_PAYOUT_SANTIM / 100,
      houseEdgePercent: currentSettings.houseEdgePercent ?? DEFAULT_HOUSE_EDGE_PERCENT,
      mode: 'SIMULATION_ONLY',
      walletMode: round.walletMode === 'shared' ? 'shared' : 'legacy-demo',
      enabled: currentSettings[game + 'Enabled'] === true,
      balanceEtb: wallet.balance / 100,
    };
    if (game === 'keno') {
      state.payoutTable = KENO_PAYOUTS;
      state.drawCount = 20;
      state.selectedNumberLimit = 10;
      if (round.status === 'settled') {
        state.drawnNumbers = round.drawnNumbers;
        state.serverSeed = round.serverSeed;
        state.settledAt = round.settledAt;
      }
    } else {
      if (round.status === 'flying' || round.status === 'crashed') {
        state.startedAt = round.startedAt;
        state.growthPerMs = BETTING_GROWTH_PER_MS;
      }
      if (round.status === 'crashed') {
        state.crashMultiplier = round.crashMultiplier;
        state.serverSeed = round.serverSeed;
        state.crashedAt = round.crashedAt;
      }
    }
    return state;
  }

  async function placeBet(game, user, input = {}) {
    ensureSimulationMode();
    assertVerifiedPlayer(user);
    const currentSettings = await settings();
    if (currentSettings.generalEnabled === false) throw new HttpError(503, 'games_center_disabled', 'Games Center is temporarily unavailable.');
    if (!currentSettings[game + 'Enabled']) throw new HttpError(503, 'game_disabled', 'This game is temporarily unavailable.');
    const round = await tickGame(game);
    if (round.status !== 'betting' || now() >= round.bettingEndsAt) {
      throw new HttpError(409, 'betting_closed', 'Betting for this round has closed.');
    }
    const requestId = String(input.requestId ?? '');
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(requestId)) {
      throw new HttpError(400, 'invalid_request_id', 'Refresh the game and try again.');
    }
    if (game === 'aviator') {
      const playerBets = (round.bets ?? []).filter((item) => item.userId === user.id);
      const isDuplicateRequest = playerBets.some((item) => item.requestId === requestId);
      if (!isDuplicateRequest && playerBets.length >= 2) {
        throw new HttpError(409, 'aviator_bet_limit_reached', 'You can place up to two Aviator bets per round.');
      }
    }
    const stake = amountToSantim(input.amount, currentSettings);
    let autoCashOutMultiplier;
    if (game === 'aviator' && input.autoCashOutMultiplier !== undefined && input.autoCashOutMultiplier !== null && input.autoCashOutMultiplier !== '') {
      const target = Number(input.autoCashOutMultiplier);
      if (!Number.isFinite(target) || target < 1.01 || target > MAX_MULTIPLIER || Math.abs(target * 100 - Math.round(target * 100)) > 1e-7) {
        throw new HttpError(400, 'invalid_auto_cashout', 'Auto Cash Out must be between 1.01× and 1,000× with up to two decimal places.');
      }
      autoCashOutMultiplier = Math.round(target * 100) / 100;
    }
    const bet = {
      id: randomBytes(12).toString('hex'),
      requestId,
      userId: user.id,
      username: user.name,
      stake,
      status: 'active',
      createdAt: now(),
      ...(autoCashOutMultiplier ? { autoCashOutMultiplier } : {}),
    };
    if (game === 'keno') {
      const selected = input.selectedNumbers;
      if (!Array.isArray(selected) || selected.length < 1 || selected.length > 10 ||
          selected.some((n) => !Number.isInteger(n) || n < 1 || n > 80) ||
          new Set(selected).size !== selected.length) {
        throw new HttpError(400, 'invalid_keno_numbers', 'Choose 1–10 different numbers from 1 to 80.');
      }
      bet.selectedNumbers = [...selected].sort((a, b) => a - b);
    }
    try {
      const result = await repo.placeGameHubBet({ game, roundId: round.roundId, bet, amount: stake, ref: `games:${game}:bet:${bet.id}`, acceptedAt: now() });
      return { bet: publicBet(result.bet), balanceEtb: result.balance / 100, duplicate: result.duplicate === true };
    } catch (error) {
      mapRepoError(error);
    }
  }

  async function cashOutAviator(user, betId) {
    ensureSimulationMode();
    assertVerifiedPlayer(user);
    const round = await tickGame('aviator');
    const at = now();
    if (round.status !== 'flying' || at >= round.crashAt) {
      throw new HttpError(409, 'round_crashed', 'The plane has already crashed. This bet can no longer be cashed out.');
    }
    const bet = (round.bets ?? []).find((item) => item.id === String(betId) && item.userId === user.id);
    if (!bet) throw new HttpError(404, 'bet_not_found', 'Your bet was not found in this round.');
    const multiplier = Math.max(1, Math.floor(Math.exp((at - round.startedAt) * BETTING_GROWTH_PER_MS) * 100) / 100);
    try {
      const result = await repo.cashOutAviatorGameHubBet({
        roundId: round.roundId, betId: bet.id, userId: user.id,
        multiplier, payout: 0, cashedOutAt: at, ref: `games:aviator:cashout:${bet.id}`,
      });
      return { bet: publicBet(result.bet), balanceEtb: result.balance / 100, multiplier, payoutPending: true };
    } catch (error) {
      mapRepoError(error);
    }
  }

  async function updateSettings(input = {}) {
    const current = await settings();
    const next = { ...current };
    if (input.generalEnabled !== undefined) next.generalEnabled = input.generalEnabled === true;
    if (input.announcementVisible !== undefined) next.announcementVisible = input.announcementVisible === true;
    if (input.announcementText !== undefined) {
      const message = String(input.announcementText).trim();
      if (message.length > 500) throw new HttpError(400, 'announcement_too_long', 'Announcement must be 500 characters or fewer.');
      next.announcementText = message;
    }
    if (input.bingoEnabled !== undefined) next.bingoEnabled = input.bingoEnabled === true;
    if (input.kenoEnabled !== undefined) next.kenoEnabled = input.kenoEnabled === true;
    if (input.aviatorEnabled !== undefined) next.aviatorEnabled = input.aviatorEnabled === true;
    if (input.minBetEtb !== undefined) {
      const n = Number(input.minBetEtb);
      if (!Number.isFinite(n) || n < 1 || n > 1000 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-7) {
        throw new HttpError(400, 'invalid_min_bet', 'Minimum bet must be 1–1,000 ETB with up to two decimal places.');
      }
      next.minBet = Math.round(n * 100);
    }
    if (input.maxBetEtb !== undefined) {
      const n = Number(input.maxBetEtb);
      if (!Number.isFinite(n) || n < 1 || n > 5000 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-7) {
        throw new HttpError(400, 'invalid_max_bet', 'Maximum bet must be 1–5,000 ETB with up to two decimal places.');
      }
      next.maxBet = Math.round(n * 100);
    }
    if (next.minBet > next.maxBet) throw new HttpError(400, 'invalid_bet_range', 'Minimum bet cannot exceed maximum bet.');
    if (input.kenoBettingSeconds !== undefined) {
      const n = Number(input.kenoBettingSeconds);
      if (!Number.isInteger(n) || n < 10 || n > 600) throw new HttpError(400, 'invalid_keno_timer', 'Keno round duration must be 10–600 seconds (up to 10 minutes).');
      next.kenoBettingSeconds = n;
    }
    if (input.houseEdgePercent !== undefined) {
      const n = Number(input.houseEdgePercent);
      if (!Number.isInteger(n) || n < 50 || n > 60) throw new HttpError(400, 'invalid_house_edge', 'House edge must be a whole percentage from 50 to 60.');
      next.houseEdgePercent = n;
    }
    if (input.aviatorBettingSeconds !== undefined) {
      const n = Number(input.aviatorBettingSeconds);
      if (!Number.isInteger(n) || n < 5 || n > 20) throw new HttpError(400, 'invalid_aviator_timer', 'Aviator betting time must be 5–20 seconds.');
      next.aviatorBettingSeconds = n;
    }
    return repo.updateGameHubSettings(next);
  }

  return {
    async resume() {
      if (config.prod && config.realMoneyEnabled) return;
      await tickAll();
      timer = setInterval(() => { void tickAll().catch((error) => log('games_hub_tick_failed', { message: String(error?.message ?? error) })); }, 250);
      timer.unref?.();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    getSettings: settings,
    async assertGameEnabled(game) {
      if (!['bingo', 'keno', 'aviator'].includes(game)) throw new HttpError(404, 'game_not_found', 'Unknown game.');
      const current = await settings();
      if (current.generalEnabled === false) throw new HttpError(503, 'games_center_disabled', 'Games Center is temporarily unavailable.');
      if (current[game + 'Enabled'] !== true) throw new HttpError(503, 'game_disabled', 'This game is temporarily unavailable.');
    },
    async getPublicSettings(user) {
      ensureSimulationMode();
      const current = await settings();
      const walletMode = !config.prod && config.gamesHubSharedWalletEnabled === true ? 'shared' : 'legacy-demo';
      const wallet = await repo.getGameHubWallet(user.id, walletMode);
      return {
        generalEnabled: current.generalEnabled !== false,
        announcement: current.generalEnabled === false && current.announcementVisible === true && current.announcementText ? current.announcementText : null,
        bingoEnabled: current.bingoEnabled === true,
        kenoEnabled: current.kenoEnabled === true,
        aviatorEnabled: current.aviatorEnabled === true,
        minBetEtb: current.minBet / 100,
        maxBetEtb: current.maxBet / 100,
        balanceEtb: wallet.balance / 100,
        walletMode,
        mode: 'SIMULATION_ONLY',
      };
    },
    getState,
    placeKenoBet: (user, input) => placeBet('keno', user, input),
    placeAviatorBet: (user, input) => placeBet('aviator', user, input),
    cashOutAviator,
    updateSettings,
    async getHistory(game, user, limit = 10) {
      if (!GAME_IDS.includes(game)) throw new HttpError(404, 'game_not_found', 'Unknown game.');
      const rounds = await repo.listGameHubRounds(game, Math.min(30, Math.max(1, Number(limit) || 10)));
      return rounds.map((round) => ({
        roundId: round.roundId,
        status: round.status,
        createdAt: round.createdAt,
        settledAt: round.settledAt ?? round.crashedAt ?? null,
        drawnNumbers: game === 'keno' ? round.drawnNumbers ?? [] : undefined,
        crashMultiplier: game === 'aviator' && round.status === 'crashed' ? round.crashMultiplier : undefined,
        serverSeedHash: round.serverSeedHash,
        serverSeed: ['settled', 'crashed'].includes(round.status) ? round.serverSeed : undefined,
        myBets: (round.bets ?? []).filter((bet) => bet.userId === user.id).map(publicBet),
      }));
    },
    async getAdminOverview() {
      const currentSettings = await settings();
      const [keno, aviator] = await Promise.all([
        repo.getCurrentGameHubRound('keno'),
        repo.getCurrentGameHubRound('aviator'),
      ]);
      return {
        settings: {
          ...currentSettings,
          generalEnabled: currentSettings.generalEnabled !== false,
          announcementText: currentSettings.announcementText ?? '',
          announcementVisible: currentSettings.announcementVisible === true,
          minBetEtb: currentSettings.minBet / 100,
          maxBetEtb: currentSettings.maxBet / 100,
          maxPayoutEtb: MAX_GAMES_HUB_PAYOUT_SANTIM / 100,
          houseEdgePercent: currentSettings.houseEdgePercent ?? DEFAULT_HOUSE_EDGE_PERCENT,
          minBet: undefined,
          maxBet: undefined,
        },
        games: {
          keno: { roundId: keno?.roundId ?? null, status: keno?.status ?? 'starting', bets: keno?.bets?.length ?? 0 },
          aviator: { roundId: aviator?.roundId ?? null, status: aviator?.status ?? 'starting', bets: aviator?.bets?.length ?? 0 },
        },
        mode: 'SIMULATION_ONLY',
      };
    },
  };
}
