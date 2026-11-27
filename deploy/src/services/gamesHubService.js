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
  minesEnabled: true,
  carRacingEnabled: true,
  carRacingRunning: true,
  minBet: 500,
  kenoMinBet: 200,
  maxBet: 100000,
  kenoBettingSeconds: 20,
  kenoDrawIntervalSeconds: 1,
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
    requestId: bet.requestId ?? null,
    status: bet.status,
    stakeEtb: bet.stake / 100,
    selectedNumbers: bet.selectedNumbers,
    matchedNumbers: bet.matchedNumbers ?? [],
    hits: bet.hits ?? 0,
    multiplier: bet.multiplier ?? null,
    payoutEtb: (bet.payout ?? 0) / 100,
    createdAt: bet.createdAt,
    settledAt: bet.settledAt ?? bet.cashedOutAt ?? null,
    autoCashOutMultiplier: bet.autoCashOutMultiplier ?? null,
  };
}



// Keno outcomes are revealed progressively from the server clock. Never send
// matches, payouts, or the server seed before all 20 numbers have been revealed.
function kenoRevealCount(round, at = Date.now()) {
  if (!round || round.status !== 'settled') return 0;
  const intervalMs = Math.max(1000, Number(round.kenoDrawIntervalSeconds ?? 1) * 1000);
  const settledAt = Number(round.settledAt ?? at);
  return Math.min(20, Math.max(0, Math.floor((at - settledAt) / intervalMs)));
}

function publicKenoBet(bet, revealComplete) {
  const result = publicBet(bet);
  if (revealComplete) return result;
  return { ...result, status: 'pending_reveal', matchedNumbers: [], hits: 0, multiplier: null, payoutEtb: 0 };
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

export function createGamesHubService({ repo, config, now = Date.now, onCarRacingRunningChanged = () => {} }) {
  let timer = null;
  let ticking = false;
  const gameTickLocks = new Map();
  // The Mongo transaction remains authoritative for every bet. This process-local
  // round ID cache avoids a preflight read on the Keno submit path.
  const currentRoundIds = new Map();
  let nextKenoTickAt = 0;
  const settingsDefaults = { ...DEFAULT_SETTINGS };
  let settingsCache = null;
  let settingsCacheExpiresAt = 0;
  let settingsLoad = null;

  // The game scheduler ticks every 250ms for Aviator. Settings are admin-managed,
  // so a short cache avoids repeatedly reading the same Mongo document on every tick
  // and on every Keno state request. Admin writes refresh this cache immediately.
  async function settings() {
    const at = Date.now();
    if (settingsCache && at < settingsCacheExpiresAt) return settingsCache;
    if (settingsLoad) return settingsLoad;
    settingsLoad = (async () => {
      const stored = await repo.getGameHubSettings();
      settingsCache = { ...settingsDefaults, ...stored };
      settingsCacheExpiresAt = Date.now() + 5000;
      return settingsCache;
    })();
    try { return await settingsLoad; }
    finally { settingsLoad = null; }
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
      ...(game === 'keno' ? { kenoDrawIntervalSeconds: currentSettings.kenoDrawIntervalSeconds } : {}),
    };
    return repo.createGameHubRound(game, round);
  }

  async function runGameTick(game, settingsSnapshot) {
    const currentSettings = settingsSnapshot ?? await settings();
    let round = await repo.getCurrentGameHubRound(game);
    // Extend an already-settled Keno round created before paced reveals were enabled,
    // so the full 20-number display is not cut short during the first deployment.
    if (game === 'keno' && round?.status === 'settled') {
      const intervalSeconds = round.kenoDrawIntervalSeconds ?? currentSettings.kenoDrawIntervalSeconds;
      const revealCompleteAt = Number(round.settledAt ?? round.createdAt ?? now()) + intervalSeconds * 20 * 1000 + 2000;
      if (Number(round.nextRoundAt ?? 0) < revealCompleteAt) {
        round = await repo.updateGameHubRound('keno', round.roundId, round.version, { nextRoundAt: revealCompleteAt })
          ?? await repo.getCurrentGameHubRound('keno');
      }
    }
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
        settledAt: now(), nextRoundAt: now() + ((round.kenoDrawIntervalSeconds ?? currentSettings.kenoDrawIntervalSeconds) * 20 * 1000) + 2000,
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

  async function tickGame(game, settingsSnapshot) {
    const pending = gameTickLocks.get(game);
    if (pending) return pending;
    const task = runGameTick(game, settingsSnapshot).then((round) => {
      if (round?.roundId) currentRoundIds.set(game, round.roundId);
      else currentRoundIds.delete(game);
      if (game === 'keno') {
        if (round?.status === 'betting') nextKenoTickAt = Number(round.bettingEndsAt);
        else if (round?.status === 'settled' && Number(round.nextRoundAt) > now()) nextKenoTickAt = Number(round.nextRoundAt);
        else nextKenoTickAt = now() + 5000;
      }
      return round;
    });
    gameTickLocks.set(game, task);
    try { return await task; }
    finally { if (gameTickLocks.get(game) === task) gameTickLocks.delete(game); }
  }

  async function tickAll() {
    if (ticking) return;
    ticking = true;
    try {
      const dueGames = ['aviator'];
      // Keno only needs a scheduler tick when betting closes or the reveal window ends.
      // The 250ms Aviator scheduler must not cause four Keno Mongo reads per second.
      if (now() >= nextKenoTickAt) dueGames.push('keno');
      await Promise.all(dueGames.map((game) => tickGame(game)));
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
    if (currentSettings.generalEnabled === false && user?.role !== 'admin') throw new HttpError(503, 'games_center_disabled', 'Games Center is temporarily unavailable.');
    const round = game === 'keno' && now() < nextKenoTickAt
      ? await repo.getCurrentGameHubRound('keno')
      : await tickGame(game, currentSettings);
    if (!round) throw new HttpError(503, game === 'keno' ? 'keno_round_unavailable' : 'game_round_unavailable', game === 'keno' ? 'Keno is preparing the next round. Please try again.' : 'This game is preparing the next round. Please try again.');
    const serverTime = now();
    const revealCount = game === 'keno' ? kenoRevealCount(round, serverTime) : 20;
    const revealComplete = game !== 'keno' || revealCount >= 20;
    const myBets = (round.bets ?? []).filter((bet) => bet.userId === user.id)
      .map((bet) => game === 'keno' ? publicKenoBet(bet, revealComplete) : publicBet(bet));
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
      minBetEtb: (game === 'keno' ? currentSettings.kenoMinBet : currentSettings.minBet) / 100,
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
      state.drawIntervalSeconds = round.kenoDrawIntervalSeconds ?? currentSettings.kenoDrawIntervalSeconds;
      state.selectedNumberLimit = 10;
      state.nextRoundAt = round.nextRoundAt ?? null;
      if (round.status === 'settled') {
        state.drawnNumbers = (round.drawnNumbers ?? []).slice(0, revealCount);
        state.settledAt = round.settledAt;
        if (revealComplete) state.serverSeed = round.serverSeed;
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
    const round = await tickGame(game, currentSettings);
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
    const stake = amountToSantim(input.amount, { ...currentSettings, minBet: game === 'keno' ? currentSettings.kenoMinBet : currentSettings.minBet });
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

  async function placeKenoBets(user, input = {}) {
    const startedAt = Date.now();
    ensureSimulationMode();
    assertVerifiedPlayer(user);
    const settingsStartedAt = Date.now();
    const currentSettings = await settings();
    const settingsMs = Date.now() - settingsStartedAt;
    if (currentSettings.generalEnabled === false) throw new HttpError(503, 'games_center_disabled', 'Games Center is temporarily unavailable.');
    if (!currentSettings.kenoEnabled) throw new HttpError(503, 'game_disabled', 'This game is temporarily unavailable.');

    const tickets = input.tickets;
    if (!Array.isArray(tickets) || tickets.length < 1 || tickets.length > 20) {
      throw new HttpError(400, 'invalid_keno_batch', 'Submit between 1 and 20 Keno tickets at a time.');
    }
    const seenRequestIds = new Set();
    const bets = tickets.map((ticket) => {
      const requestId = String(ticket?.requestId ?? '');
      if (!/^[A-Za-z0-9_-]{8,80}$/.test(requestId) || seenRequestIds.has(requestId)) {
        throw new HttpError(400, 'invalid_request_id', 'Refresh the game and try again.');
      }
      seenRequestIds.add(requestId);
      const stake = amountToSantim(ticket.amount, { ...currentSettings, minBet: currentSettings.kenoMinBet });
      const selected = ticket.selectedNumbers;
      if (!Array.isArray(selected) || selected.length < 1 || selected.length > 10 ||
          selected.some((n) => !Number.isInteger(n) || n < 1 || n > 80) ||
          new Set(selected).size !== selected.length) {
        throw new HttpError(400, 'invalid_keno_numbers', 'Choose 1–10 different numbers from 1 to 80.');
      }
      return {
        bet: {
          id: randomBytes(12).toString('hex'),
          requestId,
          userId: user.id,
          username: user.name,
          stake,
          status: 'active',
          createdAt: now(),
          selectedNumbers: [...selected].sort((a, b) => a - b),
        },
        amount: stake,
        ref: 'games:keno:bet:' + requestId,
      };
    });

    // The round-boundary scheduler keeps this ID warm. The Mongo transaction
    // still checks round status/deadline atomically, so a stale cache cannot
    // accept a ticket into a closed round.
    let targetRoundId = currentRoundIds.get('keno');
    if (!targetRoundId) {
      const currentRound = await tickGame('keno', currentSettings);
      targetRoundId = currentRound?.roundId;
    }
    if (!targetRoundId) throw new HttpError(503, 'keno_round_unavailable', 'Keno is preparing the next round. Please try again.');

    const submitBatch = (roundId) => repo.placeGameHubBets({
      game: 'keno',
      roundId,
      bets,
      userId: user.id,
      acceptedAt: now(),
    });

    let transactionMs = 0;
    try {
      let result;
      const transactionStartedAt = Date.now();
      try {
        result = await submitBatch(targetRoundId);
      } catch (error) {
        // If the scheduler rolled the round between cache refreshes, refresh once
        // and retry only when a different, currently-open round is available.
        if (!(error instanceof RepoError && error.code === 'ROUND_NOT_OPEN')) throw error;
        const freshRound = await tickGame('keno', currentSettings);
        if (!freshRound || freshRound.roundId === targetRoundId ||
            freshRound.status !== 'betting' || now() >= freshRound.bettingEndsAt) {
          throw error;
        }
        targetRoundId = freshRound.roundId;
        result = await submitBatch(targetRoundId);
      }
      transactionMs = Date.now() - transactionStartedAt;

      const response = {
        bets: result.bets.map((entry) => ({ ...publicBet(entry.bet), duplicate: entry.duplicate === true })),
        balanceEtb: result.balance / 100,
        duplicateCount: result.bets.filter((entry) => entry.duplicate).length,
      };
      const durationMs = Date.now() - startedAt;
      if (durationMs >= 250) {
        log('games_hub_keno_bet_timing', {
          ticketCount: tickets.length,
          duplicateCount: response.duplicateCount,
          settingsMs,
          transactionMs,
          serviceMs: durationMs,
        });
      }
      return response;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      transactionMs ||= Math.max(0, durationMs - settingsMs);
      if (durationMs >= 250) {
        log('games_hub_keno_bet_timing', {
          ticketCount: tickets.length,
          settingsMs,
          transactionMs,
          serviceMs: durationMs,
          failed: true,
        });
      }
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
    if (input.minesEnabled !== undefined) next.minesEnabled = input.minesEnabled === true;
    if (input.carRacingEnabled !== undefined) next.carRacingEnabled = input.carRacingEnabled === true;
    if (input.carRacingRunning !== undefined) next.carRacingRunning = input.carRacingRunning === true;
    if (input.minBetEtb !== undefined) {
      const n = Number(input.minBetEtb);
      if (!Number.isFinite(n) || n < 1 || n > 1000 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-7) {
        throw new HttpError(400, 'invalid_min_bet', 'Minimum bet must be 1–1,000 ETB with up to two decimal places.');
      }
      next.minBet = Math.round(n * 100);
    }
    if (input.kenoMinBetEtb !== undefined) {
      const n = Number(input.kenoMinBetEtb);
      if (!Number.isFinite(n) || n < 2 || n > 1000 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-7) {
        throw new HttpError(400, 'invalid_keno_min_bet', 'Keno minimum bet must be 2–1,000 ETB with up to two decimal places.');
      }
      next.kenoMinBet = Math.round(n * 100);
    }
    if (input.maxBetEtb !== undefined) {
      const n = Number(input.maxBetEtb);
      if (!Number.isFinite(n) || n < 1 || n > 5000 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-7) {
        throw new HttpError(400, 'invalid_max_bet', 'Maximum bet must be 1–5,000 ETB with up to two decimal places.');
      }
      next.maxBet = Math.round(n * 100);
    }
    if (next.minBet > next.maxBet || next.kenoMinBet > next.maxBet) throw new HttpError(400, 'invalid_bet_range', 'Game minimum bet cannot exceed maximum bet.');
    if (input.kenoDrawIntervalSeconds !== undefined) {
      const n = Number(input.kenoDrawIntervalSeconds);
      if (!Number.isInteger(n) || n < 1 || n > 10) throw new HttpError(400, 'invalid_keno_draw_interval', 'Keno number reveal interval must be 1–10 seconds.');
      next.kenoDrawIntervalSeconds = n;
    }
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
      if (!Number.isInteger(n) || n < 5 || n > 60) throw new HttpError(400, 'invalid_aviator_timer', 'Aviator betting time must be 5–60 seconds.');
      next.aviatorBettingSeconds = n;
    }
    const saved = await repo.updateGameHubSettings(next);
    settingsCache = { ...settingsDefaults, ...saved };
    settingsCacheExpiresAt = Date.now() + 5000;
    if (current.carRacingRunning !== settingsCache.carRacingRunning) onCarRacingRunningChanged(settingsCache.carRacingRunning === true);
    return settingsCache;
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
      if (!['bingo', 'keno', 'aviator', 'mines', 'car-racing'].includes(game)) throw new HttpError(404, 'game_not_found', 'Unknown game.');
      if (game === 'car-racing' && config.realMoneyEnabled === true) throw new HttpError(503, 'car_racing_demo_only', 'Car Racing is unavailable while real-money play is enabled.');
      const current = await settings();
      if (current.generalEnabled === false) throw new HttpError(503, 'games_center_disabled', 'Games Center is temporarily unavailable.');
      const settingKey = game === 'car-racing' ? 'carRacingEnabled' : game + 'Enabled';
      if (current[settingKey] !== true) throw new HttpError(503, 'game_disabled', 'This game is temporarily unavailable.');
    },
    async getPublicSettings(user) {
      ensureSimulationMode();
      const current = await settings();
      const walletMode = !config.prod && config.gamesHubSharedWalletEnabled === true ? 'shared' : 'legacy-demo';
      const wallet = await repo.getGameHubWallet(user.id, walletMode);
      const adminMaintenanceAccess = user?.role === 'admin' && current.generalEnabled === false;
      return {
        // Admin-only preview bypasses the General OFF gate without changing saved Host switches.
        generalEnabled: adminMaintenanceAccess || current.generalEnabled !== false,
        adminPreview: adminMaintenanceAccess,
        announcement: !adminMaintenanceAccess && current.generalEnabled === false && current.announcementVisible === true && current.announcementText ? current.announcementText : null,
        bingoEnabled: adminMaintenanceAccess || current.bingoEnabled === true,
        kenoEnabled: adminMaintenanceAccess || current.kenoEnabled === true,
        aviatorEnabled: adminMaintenanceAccess || current.aviatorEnabled === true,
        minesEnabled: adminMaintenanceAccess || current.minesEnabled === true,
        carRacingEnabled: (adminMaintenanceAccess || (current.generalEnabled !== false && current.carRacingEnabled === true)) && config.realMoneyEnabled !== true,
        minBetEtb: current.minBet / 100,
        maxBetEtb: current.maxBet / 100,
        balanceEtb: wallet.balance / 100,
        walletMode,
        mode: 'SIMULATION_ONLY',
      };
    },
    getState,
    placeKenoBet: (user, input) => placeBet('keno', user, input),
    placeKenoBets,
    placeAviatorBet: (user, input) => placeBet('aviator', user, input),
    cashOutAviator,
    updateSettings,
    async getHistory(game, user, limit = 10) {
      if (!GAME_IDS.includes(game)) throw new HttpError(404, 'game_not_found', 'Unknown game.');
      const rounds = await repo.listGameHubRounds(game, Math.min(30, Math.max(1, Number(limit) || 10)));
      const currentRound = game === 'keno' ? await repo.getCurrentGameHubRound('keno') : null;
      const serverTime = now();
      return rounds.map((round) => {
        const isCurrentKenoRound = game === 'keno' && round.roundId === currentRound?.roundId && round.status === 'settled';
        const revealCount = isCurrentKenoRound ? kenoRevealCount(round, serverTime) : 20;
        const revealComplete = !isCurrentKenoRound || revealCount >= 20;
        return ({
        roundId: round.roundId,
        status: round.status,
        createdAt: round.createdAt,
        settledAt: round.settledAt ?? round.crashedAt ?? null,
        drawnNumbers: game === 'keno' ? (round.drawnNumbers ?? []).slice(0, revealCount) : undefined,
        crashMultiplier: game === 'aviator' && round.status === 'crashed' ? round.crashMultiplier : undefined,
        serverSeedHash: round.serverSeedHash,
        serverSeed: ['settled', 'crashed'].includes(round.status) && revealComplete ? round.serverSeed : undefined,
        myBets: (round.bets ?? []).filter((bet) => bet.userId === user.id)
          .map((bet) => game === 'keno' ? publicKenoBet(bet, revealComplete) : publicBet(bet)),
      });
      });
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
          carRacingRunning: currentSettings.carRacingRunning !== false,
          announcementText: currentSettings.announcementText ?? '',
          announcementVisible: currentSettings.announcementVisible === true,
          minBetEtb: currentSettings.minBet / 100,
          kenoMinBetEtb: currentSettings.kenoMinBet / 100,
          maxBetEtb: currentSettings.maxBet / 100,
          maxPayoutEtb: MAX_GAMES_HUB_PAYOUT_SANTIM / 100,
          houseEdgePercent: currentSettings.houseEdgePercent ?? DEFAULT_HOUSE_EDGE_PERCENT,
          minBet: undefined,
          kenoMinBet: undefined,
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
