/**
 * In-memory repository. For tests and `npm run dev` only: data is lost on restart.
 * Every method mirrors the MongoDB repository, including its atomic multi-step rules.
 */
import { randomToken } from '../util/crypto.js';
import { RepoError } from '../util/errors.js';
import { DEFAULT_GAME } from './defaults.js';

const clone = (v) => (v === undefined ? v : structuredClone(v));

export function createMemoryRepo() {
  const users = new Map();
  const cards = new Map(); // code -> card
  const ledger = new Map(); // ref -> entry
  const payments = new Map();
  const withdrawals = new Map();
  const winPayouts = new Map();
  const rounds = new Map();
  const phoneChallenges = new Map();
  const pinResetChallenges = new Map();
  const pushSubscriptions = new Map();
  const gameHubRounds = new Map();
  const gameHubCurrent = new Map();
  const gameHubWallets = new Map();
  const gameHubLedger = new Map();
  const turboBingoGames = new Map();
  const turboBingoTickets = new Map();
  const turboBingoWallets = new Map();
  const turboBingoLedger = new Map();
  let turboBingoCurrentId = null;
  let turboBingoSettings = {};
  let gameHubSettings = { carRacingEnabled: true, kenoEnabled: true, aviatorEnabled: true, minBet: 500, maxBet: 100000, kenoBettingSeconds: 20, aviatorBettingSeconds: 8 };
  let game = { ...DEFAULT_GAME, calledNumbers: [] };
  let nextCardSerial = 10000;

  const credit = (userId, amount, kind, ref, meta = {}) => {
    const user = users.get(userId);
    if (!user) throw new RepoError('USER_NOT_FOUND');
    if (ledger.has(ref)) return { applied: false, balance: user.balance };
    if (amount < 0 && user.balance + amount < 0) throw new RepoError('INSUFFICIENT_FUNDS');
    user.balance += amount;
    ledger.set(ref, { userId, amount, kind, ref, meta, createdAt: new Date() });
    return { applied: true, balance: user.balance };
  };

  const ensureGameHubWallet = (userId) => {
    if (!users.has(userId)) throw new RepoError('USER_NOT_FOUND');
    if (!gameHubWallets.has(userId)) {
      gameHubWallets.set(userId, { userId, balance: 100000, currency: 'ETB', balanceType: 'SIMULATION_ONLY', createdAt: new Date() });
      const ref = 'games:initial-demo-credit:' + userId;
      gameHubLedger.set(ref, { userId, amount: 100000, kind: 'demo_grant', ref, meta: { reason: 'initial_demo_wallet' }, createdAt: new Date() });
    }
    return gameHubWallets.get(userId);
  };
  const ensureTurboBingoWallet = (userId) => {
    if (!users.has(userId)) throw new RepoError('USER_NOT_FOUND');
    if (!turboBingoWallets.has(userId)) {
      turboBingoWallets.set(userId, { userId, balance: 100000, currency: 'ETB', balanceType: 'TURBO_BINGO_SIMULATION_ONLY', createdAt: new Date() });
      const ref = 'turbo-bingo:initial-demo-credit:' + userId;
      turboBingoLedger.set(ref, { userId, amount: 100000, kind: 'demo_grant', ref, meta: { reason: 'initial_turbo_bingo_demo_wallet' }, createdAt: new Date() });
    }
    return turboBingoWallets.get(userId);
  };
  const moveGameHubCredits = (userId, amount, kind, ref, meta = {}, walletMode = 'shared') => {
    if (walletMode === 'shared') return credit(userId, amount, kind, ref, meta);
    const wallet = ensureGameHubWallet(userId);
    if (gameHubLedger.has(ref)) return { applied: false, balance: wallet.balance };
    if (amount < 0 && wallet.balance + amount < 0) throw new RepoError('INSUFFICIENT_FUNDS');
    wallet.balance += amount;
    gameHubLedger.set(ref, { userId, amount, kind, ref, meta: clone(meta), createdAt: new Date() });
    return { applied: true, balance: wallet.balance };
  };

  const smsEvents = new Map();
  const matchStoredSmsDeposit = (txRef) => {
    const payment = payments.get(txRef);
    if (!payment || payment.source !== 'automatic-sms' || payment.status !== 'pending') return { matched: false, unmatched: true };
    if (payment.smsEventId) return { matched: false, duplicate: true };
    const event = [...smsEvents.values()].filter((item) => item.reference === txRef && !item.consumedBy).sort((a, b) => b.receivedAt - a.receivedAt)[0];
    if (!event) return { matched: false, unmatched: true };
    event.consumedBy = txRef;
    const status = payment.amount === event.amount ? 'matched' : 'amount-mismatch';
    payment.smsEventId = event.eventId;
    payment.smsMatch = { status, provider: event.provider, amount: event.amount, transactionAt: event.transactionAt, receivedAt: event.receivedAt, sender: event.sender, recipientAccount: event.recipientAccount ?? null, matchedAt: new Date() };
    return { matched: status === 'matched', mismatch: status === 'amount-mismatch', reference: txRef };
  };

  return {
    kind: 'memory',
    async init() {},
    async close() {},

    /* Web Push subscriptions: isolated from wallet and game state. */
    async savePushSubscription(userId, subscription) {
      pushSubscriptions.set(subscription.endpoint, { userId, endpoint: subscription.endpoint, subscription: clone(subscription), updatedAt: new Date() });
    },
    async removePushSubscription(userId, endpoint) {
      const saved = pushSubscriptions.get(endpoint);
      if (saved?.userId === userId) pushSubscriptions.delete(endpoint);
    },
    async listPushSubscriptions() { return [...pushSubscriptions.values()].map(clone); },
    /* users */
    async createUser({ phone, name, pinHash, role = 'player', phoneVerified = true }) {
      for (const u of users.values()) if (u.phone === phone) throw new RepoError('PHONE_TAKEN');
      const user = { id: randomToken(12), phone, name, pinHash, role, phoneVerified, balance: 0, failedLogins: 0, lockedUntil: 0, createdAt: new Date() };
      users.set(user.id, user);
      return clone(user);
    },
    async findUserByPhone(phone) {
      for (const u of users.values()) if (u.phone === phone) return clone(u);
      return null;
    },
    async findUserById(id) {
      return clone(users.get(id) ?? null);
    },
    async updateUser(id, patch) {
      const u = users.get(id);
      if (u) Object.assign(u, patch);
    },

    /* phone verification: isolated in-memory challenge store for tests/dev only */
    async createPhoneChallenge({ userId, codeHash, codeEncrypted, expiresAt }) {
      phoneChallenges.set(userId, { userId, codeHash, codeEncrypted, expiresAt, attempts: 0, createdAt: new Date() });
    },
    async getPhoneChallenge(userId) { return clone(phoneChallenges.get(userId) ?? null); },
    async recordPhoneChallengeFailure(userId) {
      const c = phoneChallenges.get(userId);
      if (c && c.expiresAt > new Date() && c.attempts < 5) c.attempts += 1;
    },
    async completePhoneVerification(userId, codeHash) {
      const c = phoneChallenges.get(userId), u = users.get(userId);
      if (!c || !u || u.role !== 'player' || u.phoneVerified === true || c.codeHash !== codeHash || c.expiresAt <= new Date() || c.attempts >= 5) return false;
      phoneChallenges.delete(userId);
      u.phoneVerified = true;
      u.phoneVerifiedAt = new Date();
      return true;
    },
    async listPendingPhoneChallenges() {
      return [...phoneChallenges.values()].filter((c) => c.expiresAt > new Date() && c.attempts < 5).map((c) => {
        const u = users.get(c.userId);
        return u?.role === 'player' ? { userId: c.userId, name: u.name, phone: u.phone, codeEncrypted: c.codeEncrypted, expiresAt: c.expiresAt, attempts: c.attempts } : null;
      }).filter(Boolean);
    },

    /* Admin-assisted PIN recovery, separate from phone verification. */
    async createPinResetChallenge({ userId, codeHash, codeEncrypted, expiresAt }) {
      pinResetChallenges.set(userId, { userId, codeHash, codeEncrypted, expiresAt, attempts: 0, createdAt: new Date() });
    },
    async getPinResetChallenge(userId) { return clone(pinResetChallenges.get(userId) ?? null); },
    async recordPinResetFailure(userId) {
      const c = pinResetChallenges.get(userId);
      if (c && c.expiresAt > new Date() && c.attempts < 5) c.attempts += 1;
    },
    async completePinReset(userId, codeHash, pinHash) {
      const c = pinResetChallenges.get(userId), u = users.get(userId);
      if (!c || !u || u.role !== 'player' || c.codeHash !== codeHash || c.expiresAt <= new Date() || c.attempts >= 5) return false;
      pinResetChallenges.delete(userId);
      Object.assign(u, { pinHash, failedLogins: 0, lockedUntil: 0, pinUpdatedAt: new Date() });
      return true;
    },
    async listPendingPinResets() {
      return [...pinResetChallenges.values()].filter((c) => c.expiresAt > new Date() && c.attempts < 5).map((c) => {
        const u = users.get(c.userId);
        return u?.role === 'player' ? { userId: c.userId, name: u.name, phone: u.phone, codeEncrypted: c.codeEncrypted, expiresAt: c.expiresAt, attempts: c.attempts } : null;
      }).filter(Boolean);
    },

    /* game state (optimistic concurrency on `version`) */
    async getGame() {
      return clone(game);
    },
    async casGame(version, patch) {
      if (game.version !== version) return null;
      game = { ...game, ...clone(patch), version: version + 1 };
      return clone(game);
    },
    async archiveRound(doc) {
      rounds.set(doc.round, clone(doc));
    },
    async getArchivedRound(round) {
      return clone(rounds.get(round) ?? null);
    },

    /* cards */
    async peekNextCardSerial() { return Math.max(10000, nextCardSerial); },
    async cardSerialExists(serial) { return [...cards.values()].some((card) => card.serial === String(serial)); },
    async listUsedCardSerials() { return [...cards.values()].map((card) => String(card.serial)).filter((serial) => Number(serial) >= 10000 && Number(serial) <= 24999); },
    async reserveCardSerials(round, count, requestedSerial) {
      if (game.phase !== 'waiting' || game.roundNumber !== round) throw new RepoError('ROUND_NOT_OPEN');
      if (!Number.isInteger(count) || count < 1) throw new RepoError('CARD_POOL_FULL');
      if (requestedSerial !== undefined && requestedSerial !== null) {
        const serial = String(requestedSerial);
        if (!/^\d{5}$/.test(serial) || Number(serial) < 10000 || Number(serial) > 24999) throw new RepoError('INVALID_CARD_NUMBER');
        if ([...cards.values()].some((card) => card.serial === serial)) throw new RepoError('CARD_NUMBER_TAKEN');
        return [serial];
      }
      const serials = [];
      while (serials.length < count && nextCardSerial <= 24999) {
        const serial = String(nextCardSerial++);
        if (![...cards.values()].some((card) => card.serial === serial)) serials.push(serial);
      }
      if (serials.length !== count) throw new RepoError('CARD_POOL_FULL');
      return serials;
    },
    async purchaseCards({ userId, cost, cards: newCards, round, ref }) {
      if (game.phase !== 'waiting' || game.roundNumber !== round) throw new RepoError('ROUND_NOT_OPEN');
      if (newCards.some((c) => typeof c.serial === 'string' && [...cards.values()].some((old) => old.round === round && old.serial === c.serial))) throw new RepoError('CARD_NUMBER_TAKEN');
      const r = credit(userId, -cost, 'card_purchase', ref, { round, count: newCards.length });
      for (const c of newCards) cards.set(c.code, { ...clone(c), userId, round, createdAt: new Date() });
      game = { ...game, roundPlayerIds: [...new Set([...(game.roundPlayerIds ?? []), userId])], pot: game.pot + cost, version: game.version + 1 };
      return { balance: r.balance, game: clone(game) };
    },
    async listPlayerIds() {
      return [...users.values()].filter((u) => u.role === 'player' && u.phoneVerified).map((u) => u.id);
    },
    async insertFreeCards({ userId, round, cards: newCards }) {
      if (game.phase !== 'waiting' || game.roundNumber !== round) throw new RepoError('ROUND_NOT_OPEN');
      for (const c of newCards) {
        if (cards.has(c.code) || [...cards.values()].some((old) => old.round === round && old.serial === c.serial)) throw new RepoError('CARD_NUMBER_TAKEN');
      }
      for (const c of newCards) cards.set(c.code, { ...clone(c), userId, round, createdAt: new Date(), bonusFree: true });
    },
    async listCards(userId, round) {
      return [...cards.values()].filter((c) => c.userId === userId && c.round === round).sort((a, b) => Number(a.serial) - Number(b.serial)).map(clone);
    },
    async countCards(userId, round) {
      return [...cards.values()].filter((c) => c.userId === userId && c.round === round).length;
    },
    async getCard(code) {
      return clone(cards.get(code) ?? null);
    },
    async lockCard({ code, userId, round, expectedVersion }) {
      if (game.phase !== 'running' || game.roundNumber !== round || game.version !== expectedVersion) return false;
      const card = cards.get(code);
      if (!card || card.userId !== userId || card.round !== round || card.lockedAt) return false;
      cards.set(code, { ...card, lockedAt: new Date(), lockReason: 'false_bingo' });
      return true;
    },
    async unlockCard(code) {
      const card = cards.get(code);
      if (!card || !card.lockedAt) return false;
      const { lockedAt, lockReason, ...unlocked } = card;
      cards.set(code, unlocked);
      return true;
    },

    /** End the round and create a pending prize request; never credit the wallet here. */
    async settleWin({ round, expectedVersion, card, prize, ref }) {
      if (game.phase !== 'running' || game.roundNumber !== round || game.version !== expectedVersion) return null;
      const id = ref;
      if (winPayouts.has(id)) return null;
      const credited = credit(card.userId, prize, 'prize', `win-payout:${id}`, { round, card: card.code });
      if (!credited.applied) return null;
      game = {
        ...game, phase: 'ended', autoCall: false, nextCallAt: null,
        winner: { cardCode: card.code, serial: card.serial, userId: card.userId, prize, payoutId: id, payoutStatus: 'paid', at: Date.now() },
        lastCompletedRoundNumber: round, lastCompletedWasBonus: game.bonusRound === true,
        version: game.version + 1,
      };
      return clone(game);
    },
    async listWinPayouts({ status = 'pending' } = {}) {
      return [...winPayouts.values()].filter((p) => !status || p.status === status).sort((a,b) => b.createdAt-a.createdAt).map((p) => {
        const u = users.get(p.userId);
        return { ...clone(p), amount: p.amount / 100, rawMessage: p.rawMessage ?? '', provider: p.provider ?? '', userName: u?.name ?? 'Unknown', userPhone: u?.phone ?? '' };
      });
    },
    async approveWinPayout(id) {
      const p = winPayouts.get(id);
      if (!p || p.status !== 'pending') return null;
      const r = credit(p.userId, p.amount, 'prize', `win-payout:${id}`, { round: p.round, card: p.cardCode });
      p.status = 'approved'; p.updatedAt = new Date();
      return { ...clone(p), credited: r.applied, balance: r.balance / 100 };
    },
    async rejectWinPayout(id, note = '') {
      const p = winPayouts.get(id);
      if (!p || p.status !== 'pending') return null;
      p.status = 'rejected'; p.note = String(note).slice(0, 200); p.updatedAt = new Date();
      return clone(p);
    },

    /* money */
    async applyLedger({ userId, amount, kind, ref, meta }) {
      return credit(userId, amount, kind, ref, meta);
    },
    async listLedger(userId, limit = 30) {
      return [...ledger.values()].filter((e) => e.userId === userId).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit).map(clone);
    },

    /* deposits */
    async createPayment({ txRef, userId, amount, source = 'chapa', rawMessage, provider }) {
      if (payments.has(txRef)) throw new RepoError('PAYMENT_REFERENCE_TAKEN');
      payments.set(txRef, { txRef, userId, amount, source, rawMessage, provider, status: 'pending', createdAt: new Date() });
    },
    async getPayment(txRef) {
      return clone(payments.get(txRef) ?? null);
    },
    async matchStoredSmsDeposit({ txRef }) { return matchStoredSmsDeposit(txRef); },
    async recordSmsEventAndMatch(event) {
      if (smsEvents.has(event.eventId)) return { matched: false, duplicate: true };
      const { rawMessage, ...safeEvent } = event;
      smsEvents.set(event.eventId, clone({ ...safeEvent, createdAt: new Date() }));
      return matchStoredSmsDeposit(event.reference);
    },
    async listUserSimulationDeposits(userId, limit = 30) {
      return [...payments.values()]
        .filter((p) => p.userId === userId && ['manual-simulation', 'sms-simulation', 'automatic-sms'].includes(p.source))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit)
        .map((p) => ({ reference: p.txRef, amount: p.amount / 100, status: p.status, currency: 'ETB', at: p.createdAt.getTime() }));
    },
    async listSimulationDeposits({ status = 'pending' } = {}) {
      return [...payments.values()]
        .filter((p) => ['manual-simulation', 'sms-simulation', 'automatic-sms'].includes(p.source) && (!status || p.status === status))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 200)
        .map((p) => {
          const user = users.get(p.userId);
          return { id: p.txRef, reference: p.txRef, rawMessage: p.rawMessage ?? '', provider: p.provider ?? '', smsMatch: p.smsMatch ?? null, source: p.source, userId: p.userId, userName: user?.name ?? 'Unknown', userPhone: user?.phone ?? '', amount: p.amount / 100, status: p.status, at: p.createdAt.getTime() };
        });
    },
    /** pending -> success and credit the wallet, exactly once. */
    async confirmDeposit({ txRef, chapaRef }) {
      const p = payments.get(txRef);
      if (!p) throw new RepoError('PAYMENT_NOT_FOUND');
      if (p.status === 'success') return { credited: false, balance: users.get(p.userId).balance };
      p.status = 'success';
      p.chapaRef = chapaRef ?? null;
      const r = credit(p.userId, p.amount, 'deposit', `dep:${txRef}`, { txRef, chapaRef });
      return { credited: r.applied, balance: r.balance };
    },
    async failPayment(txRef, status = 'failed') {
      const p = payments.get(txRef);
      if (!p || p.status !== 'pending') return false;
      p.status = status;
      return true;
    },

    /* Simulation-only withdrawals use a distinct record type and never call a payment provider. */
    async requestSimulationWithdrawal({ id, userId, amount, method, destination }) {
      if (withdrawals.has(id)) throw new RepoError('WITHDRAWAL_ID_TAKEN');
      credit(userId, -amount, 'simulation_withdraw_hold', `simwd:${id}`, { id });
      const w = { id, userId, amount, method, destination, mode: 'simulation', status: 'pending', note: '', createdAt: new Date(), updatedAt: new Date() };
      withdrawals.set(id, w);
      return clone(w);
    },
    async listSimulationWithdrawals({ status = 'pending', userId } = {}) {
      return [...withdrawals.values()].filter((w) => w.mode === 'simulation' && (!status || w.status === status) && (!userId || w.userId === userId))
        .sort((a,b) => b.createdAt-a.createdAt).map((w) => {
          const u = users.get(w.userId);
          return { ...clone(w), amount: w.amount / 100, userName: u?.name ?? 'Unknown', userPhone: u?.phone ?? '', at: w.createdAt.getTime() };
        });
    },
    async transitionSimulationWithdrawal(id, from, to, patch = {}) {
      const w = withdrawals.get(id);
      if (!w || w.mode !== 'simulation' || !from.includes(w.status)) return null;
      Object.assign(w, patch, { status: to, updatedAt: new Date() });
      return clone(w);
    },
    async rejectSimulationWithdrawalAndRefund(id, note, adminId) {
      const w = withdrawals.get(id);
      if (!w || w.mode !== 'simulation' || w.status !== 'pending') return null;
      credit(w.userId, w.amount, 'simulation_withdraw_refund', `simwd-refund:${id}`, { id });
      Object.assign(w, { status: 'rejected', note, reviewedBy: adminId, updatedAt: new Date() });
      return clone(w);
    },

    /* Manual withdrawals: hold real wallet funds until an admin confirms an external payout. */
    async requestManualWithdrawal({ id, userId, amount, method, destination }) {
      if (withdrawals.has(id)) throw new RepoError('WITHDRAWAL_ID_TAKEN');
      credit(userId, -amount, 'manual_withdraw_hold', `manual-wd:${id}`, { id, method });
      const w = {
        id, userId, amount, method, destination, mode: 'manual',
        status: 'pending', note: '', createdAt: new Date(), updatedAt: new Date(),
      };
      withdrawals.set(id, w);
      return clone(w);
    },
    async listManualWithdrawals({ status = 'pending', userId } = {}) {
      return [...withdrawals.values()]
        .filter((w) => w.mode === 'manual' && (!status || w.status === status) && (!userId || w.userId === userId))
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((w) => {
          const u = users.get(w.userId);
          return {
            ...clone(w), id: w.id, amount: w.amount / 100,
            at: w.createdAt.getTime(), userName: u?.name ?? 'Unknown', userPhone: u?.phone ?? '',
          };
        });
    },
    async transitionManualWithdrawal(id, from, to, patch = {}) {
      const w = withdrawals.get(id);
      if (!w || w.mode !== 'manual' || !from.includes(w.status)) return null;
      Object.assign(w, patch, { status: to, updatedAt: new Date() });
      return clone(w);
    },
    async confirmManualWithdrawal({ id, externalReference, payoutMethod, adminId }) {
      const w = withdrawals.get(id);
      if (!w || w.mode !== 'manual' || w.status !== 'processing') return null;
      const duplicate = [...withdrawals.values()].some((other) =>
        other.mode === 'manual' && other.id !== id && other.externalPayoutReference === externalReference
      );
      if (duplicate) throw new RepoError('EXTERNAL_PAYOUT_REFERENCE_TAKEN');
      Object.assign(w, {
        status: 'paid', externalPayoutReference: externalReference,
        payoutMethod, paidBy: adminId, paidAt: new Date(), updatedAt: new Date(),
      });
      return clone(w);
    },
    async rejectManualWithdrawalAndRefund(id, note, adminId) {
      const w = withdrawals.get(id);
      if (!w || w.mode !== 'manual' || !['pending', 'processing'].includes(w.status)) return null;
      credit(w.userId, w.amount, 'manual_withdraw_refund', `manual-wd-refund:${id}`, { id });
      Object.assign(w, { status: 'rejected', note, reviewedBy: adminId, updatedAt: new Date() });
      return clone(w);
    },

    /* withdrawals: the amount is held (debited) when requested */
    async requestWithdrawal({ id, userId, amount, accountName, accountNumber, bankCode }) {
      credit(userId, -amount, 'withdraw_hold', `wd:${id}`, { id });
      const w = { id, userId, amount, accountName, accountNumber, bankCode, status: 'pending', note: '', createdAt: new Date(), updatedAt: new Date() };
      withdrawals.set(id, w);
      return clone(w);
    },
    async getWithdrawal(id) {
      return clone(withdrawals.get(id) ?? null);
    },
    async listWithdrawals({ status, userId } = {}) {
      return [...withdrawals.values()]
        .filter((w) => (!status || w.status === status) && (!userId || w.userId === userId))
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(clone);
    },
    async transitionWithdrawal(id, from, to, patch = {}) {
      const w = withdrawals.get(id);
      if (!w || !from.includes(w.status)) return null;
      Object.assign(w, patch, { status: to, updatedAt: new Date() });
      return clone(w);
    },
    async transitionWithdrawalAndRefund(id, from, to, patch = {}) {
      const w = withdrawals.get(id);
      if (!w || !from.includes(w.status)) return null;
      // Both operations are synchronous in this in-memory test repository.
      credit(w.userId, w.amount, 'withdraw_refund', `wd-refund:${id}`, { id });
      Object.assign(w, patch, { status: to, updatedAt: new Date() });
      return clone(w);
    },
    async refundWithdrawal(id) {
      const w = withdrawals.get(id);
      if (!w) throw new RepoError('WITHDRAWAL_NOT_FOUND');
      return credit(w.userId, w.amount, 'withdraw_refund', `wd-refund:${id}`, { id });
    },

    /* Turbo Bingo is isolated from the legacy Bingo round/card collections. */
    async getTurboBingoWallet(userId) { return clone(ensureTurboBingoWallet(userId)); },
    async getTurboBingoSettings() { return clone(turboBingoSettings); },
    async updateTurboBingoSettings(settings) { turboBingoSettings = clone(settings); return clone(turboBingoSettings); },
    async getCurrentTurboBingoGame() { return clone(turboBingoGames.get(turboBingoCurrentId) ?? null); },
    async createTurboBingoGame(input) {
      const current = turboBingoGames.get(turboBingoCurrentId);
      if (current && current.status !== 'ended') return clone(current);
      const game = { ...clone(input), version: 1 };
      turboBingoGames.set(game.id, game);
      turboBingoCurrentId = game.id;
      return clone(game);
    },
    async updateTurboBingoGame(gameId, expectedVersion, patch, lockedTicketIds = []) {
      const game = turboBingoGames.get(gameId);
      if (!game || game.version !== expectedVersion || !['waiting', 'running'].includes(game.status)) return null;
      Object.assign(game, clone(patch), { version: game.version + 1 });
      for (const id of lockedTicketIds) {
        const ticket = turboBingoTickets.get(id);
        if (ticket?.gameId === gameId && ticket.status === 'active') Object.assign(ticket, { status: 'locked', lockedAt: Date.now() });
      }
      return clone(game);
    },
    async listTurboBingoTickets(gameId, userId) {
      return [...turboBingoTickets.values()].filter((ticket) => ticket.gameId === gameId && (!userId || ticket.userId === userId)).sort((a, b) => a.createdAt - b.createdAt).map(clone);
    },
    async getTurboBingoTicket(gameId, ticketId, userId) {
      const ticket = turboBingoTickets.get(ticketId);
      return ticket?.gameId === gameId && ticket.userId === userId ? clone(ticket) : null;
    },
    async purchaseTurboBingoTickets({ gameId, userId, tickets: newTickets, totalCost }) {
      const game = turboBingoGames.get(gameId);
      if (!game || game.status !== 'waiting') throw new RepoError('TURBO_BINGO_SALES_CLOSED');
      const existingCount = [...turboBingoTickets.values()].filter((ticket) => ticket.gameId === gameId && ticket.userId === userId).length;
      if (existingCount + newTickets.length > (game.maxTicketsPerPlayer ?? 10)) throw new RepoError('TURBO_BINGO_TICKET_LIMIT');
      const wallet = ensureTurboBingoWallet(userId);
      if (wallet.balance < totalCost) throw new RepoError('INSUFFICIENT_FUNDS');
      const ref = 'turbo-bingo:purchase:' + newTickets.map((ticket) => ticket.id).join(':');
      wallet.balance -= totalCost;
      turboBingoLedger.set(ref, { userId, amount: -totalCost, kind: 'ticket_purchase', ref, meta: { gameId, ticketIds: newTickets.map((ticket) => ticket.id) }, createdAt: new Date() });
      for (const ticket of newTickets) turboBingoTickets.set(ticket.id, {
        ...clone(ticket), gameId, userId, status: 'active', createdAt: Date.now(),
      });
      game.ticketCount = (game.ticketCount ?? 0) + newTickets.length;
      game.version += 1;
      return { tickets: clone(newTickets), balance: wallet.balance };
    },
    async claimTurboBingoTicket({ gameId, expectedVersion, ticketId, userId, winner }) {
      const game = turboBingoGames.get(gameId);
      const ticket = turboBingoTickets.get(ticketId);
      if (!game || game.status !== 'running' || game.version !== expectedVersion || !ticket ||
          ticket.gameId !== gameId || ticket.userId !== userId || ticket.status !== 'active') return null;
      const lastNumber = game.drawnNumbers.at(-1);
      const called = new Set(game.drawnNumbers);
      const hits = ticket.numbers.filter((number) => called.has(number));
      if (hits.length !== game.target || lastNumber == null || !ticket.numbers.includes(lastNumber)) return null;
      Object.assign(game, { status: 'ended', endedAt: winner.at, winner, version: game.version + 1 });
      Object.assign(ticket, { status: 'winner', claimedAt: winner.at });
      return { winner: clone(winner), game: clone(game) };
    },

    /* Isolated Keno and Aviator records. Existing Bingo game/card collections are untouched. */
    async getGameHubSettings() { return clone(gameHubSettings); },
    async getGameHubWallet(userId, walletMode = 'shared') {
      if (!users.has(userId)) throw new RepoError('USER_NOT_FOUND');
      if (walletMode === 'shared') return { userId, balance: users.get(userId).balance, currency: 'ETB', balanceType: 'SHARED_BINGO_WALLET' };
      return clone(ensureGameHubWallet(userId));
    },
    async listGameHubLedger(userId, limit = 30) { return [...gameHubLedger.values()].filter((entry) => entry.userId === userId).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit).map(clone); },
    async updateGameHubSettings(settings) { gameHubSettings = { ...gameHubSettings, ...clone(settings) }; return clone(gameHubSettings); },
    async getCurrentGameHubRound(game) {
      const id = gameHubCurrent.get(game);
      return id ? clone(gameHubRounds.get(id) ?? null) : null;
    },
    async createGameHubRound(game, round) {
      const currentId = gameHubCurrent.get(game);
      const current = currentId ? gameHubRounds.get(currentId) : null;
      if (current && !['settled', 'crashed'].includes(current.status)) return clone(current);
      const id = game + ':' + round.roundId;
      const doc = { ...clone(round), _id: id, game, version: 1 };
      gameHubRounds.set(id, doc);
      gameHubCurrent.set(game, id);
      return clone(doc);
    },
    async updateGameHubRound(game, id, expectedVersion, patch) {
      const key = game + ':' + id;
      const round = gameHubRounds.get(key);
      if (!round || round.version !== expectedVersion) return null;
      Object.assign(round, clone(patch), { version: round.version + 1 });
      return clone(round);
    },
    async placeGameHubBet({ game, roundId, bet, amount, ref, acceptedAt }) {
      const round = gameHubRounds.get(game + ':' + roundId);
      if (!round) throw new RepoError('ROUND_NOT_OPEN');
      const existing = (round.bets ?? []).find((item) => item.userId === bet.userId && item.requestId === bet.requestId);
      const walletMode = round.walletMode === 'shared' ? 'shared' : 'legacy-demo';
      const wallet = walletMode === 'shared' ? users.get(bet.userId) : ensureGameHubWallet(bet.userId);
      if (existing) return { bet: clone(existing), balance: wallet.balance, duplicate: true };
      if (game === 'aviator' && (round.bets ?? []).filter((item) => item.userId === bet.userId).length >= 2) {
        throw new RepoError('AVIATOR_BET_LIMIT');
      }
      if (round.status !== 'betting' || round.bettingEndsAt <= acceptedAt) throw new RepoError('ROUND_NOT_OPEN');
      const movement = moveGameHubCredits(bet.userId, -amount, 'game_bet', ref, { game, roundId, betId: bet.id }, walletMode);
      round.bets.push(clone(bet));
      round.version += 1;
      return { bet: clone(bet), balance: movement.balance, duplicate: false };
    },
    async placeGameHubBets({ game, roundId, bets, userId, acceptedAt }) {
      const round = gameHubRounds.get(game + ':' + roundId);
      if (!round) throw new RepoError('ROUND_NOT_OPEN');
      if (game !== 'keno' || round.status !== 'betting' || round.bettingEndsAt <= acceptedAt) {
        throw new RepoError('ROUND_NOT_OPEN');
      }
      const walletMode = round.walletMode === 'shared' ? 'shared' : 'legacy-demo';
      const wallet = walletMode === 'shared' ? users.get(userId) : ensureGameHubWallet(userId);
      const existingByRequest = new Map((round.bets ?? [])
        .filter((item) => item.userId === userId)
        .map((item) => [item.requestId, item]));
      const entries = bets.map((item) => {
        const existing = existingByRequest.get(item.bet.requestId);
        return existing ? { bet: clone(existing), duplicate: true } : { bet: clone(item.bet), duplicate: false };
      });
      const newEntries = entries.filter((entry) => !entry.duplicate);
      const total = newEntries.reduce((sum, entry) => sum + entry.bet.stake, 0);
      if (wallet.balance < total) throw new RepoError('INSUFFICIENT_FUNDS');
      for (const entry of newEntries) {
        moveGameHubCredits(userId, -entry.bet.stake, 'game_bet',
          'games:keno:bet:' + entry.bet.requestId,
          { game, roundId, betId: entry.bet.id, requestId: entry.bet.requestId }, walletMode);
      }
      if (newEntries.length) {
        round.bets.push(...newEntries.map((entry) => clone(entry.bet)));
        round.version += 1;
      }
      const updatedWallet = walletMode === 'shared' ? users.get(userId) : ensureGameHubWallet(userId);
      return { bets: entries, balance: updatedWallet.balance };
    },
    async settleKenoGameHubRound({ roundId, drawnNumbers, results, serverSeed, settledAt, nextRoundAt }) {
      const key = 'keno:' + roundId;
      const round = gameHubRounds.get(key);
      if (!round) throw new RepoError('ROUND_NOT_OPEN');
      if (round.status === 'settled') return clone(round);
      if (round.status !== 'betting') throw new RepoError('ROUND_NOT_OPEN');
      const byId = new Map(results.map((result) => [result.betId, result]));
      const bets = round.bets.map((bet) => {
        const result = byId.get(bet.id) ?? { payout: 0, hits: 0, matchedNumbers: [] };
        if (result.payout > 0) moveGameHubCredits(bet.userId, result.payout, 'game_prize', 'games:keno:win:' + bet.id, { game: 'keno', roundId, betId: bet.id }, round.walletMode === 'shared' ? 'shared' : 'legacy-demo');
        return { ...bet, status: result.payout > 0 ? 'won' : 'lost', hits: result.hits, matchedNumbers: result.matchedNumbers, payout: result.payout, settledAt };
      });
      Object.assign(round, { status: 'settled', drawnNumbers: clone(drawnNumbers), serverSeed, bets, settledAt, nextRoundAt, version: round.version + 1 });
      return clone(round);
    },
    async startAviatorGameHubRound({ roundId, startedAt, crashAt, crashMultiplier }) {
      const round = gameHubRounds.get('aviator:' + roundId);
      if (!round) throw new RepoError('ROUND_NOT_OPEN');
      if (round.status === 'flying') return clone(round);
      if (round.status !== 'betting') throw new RepoError('ROUND_NOT_OPEN');
      Object.assign(round, { status: 'flying', startedAt, crashAt, crashMultiplier, version: round.version + 1 });
      return clone(round);
    },
    async cashOutAviatorGameHubBet({ roundId, betId, userId, multiplier, cashedOutAt }) {
      const round = gameHubRounds.get('aviator:' + roundId);
      if (!round || round.status !== 'flying' || cashedOutAt >= round.crashAt) throw new RepoError('BET_NOT_ACTIVE');
      const bet = round.bets.find((item) => item.id === betId && item.userId === userId);
      if (!bet) throw new RepoError('BET_NOT_ACTIVE');
      const walletMode = round.walletMode === 'shared' ? 'shared' : 'legacy-demo';
      const wallet = walletMode === 'shared' ? users.get(userId) : ensureGameHubWallet(userId);
      if (bet.status === 'cashout_pending' || bet.status === 'cashed_out') return { bet: clone(bet), balance: wallet.balance, duplicate: true };
      if (bet.status !== 'active') throw new RepoError('BET_NOT_ACTIVE');
      Object.assign(bet, { status: 'cashout_pending', multiplier, payout: 0, cashedOutAt });
      round.version += 1;
      return { bet: clone(bet), balance: wallet.balance, duplicate: false };
    },
    async crashAviatorGameHubRound({ roundId, crashedAt, nextRoundAt, settlements = [] }) {
      const round = gameHubRounds.get('aviator:' + roundId);
      if (!round) throw new RepoError('ROUND_NOT_OPEN');
      if (round.status === 'crashed') return clone(round);
      if (round.status !== 'flying') throw new RepoError('ROUND_NOT_OPEN');
      const payoutById = new Map(settlements.map((item) => [item.betId, item.payout]));
      const bets = round.bets.map((bet) => {
        if (bet.status === 'active') return { ...bet, status: 'lost', payout: 0 };
        if (bet.status !== 'cashout_pending') return bet;
        const payout = payoutById.get(bet.id) ?? 0;
        if (payout > 0) moveGameHubCredits(bet.userId, payout, 'game_prize', 'games:aviator:pool-win:' + bet.id, { game: 'aviator', roundId, betId: bet.id, multiplier: bet.multiplier }, round.walletMode === 'shared' ? 'shared' : 'legacy-demo');
        return { ...bet, status: 'cashed_out', payout, settledAt: crashedAt };
      });
      Object.assign(round, { status: 'crashed', crashedAt, nextRoundAt, bets, version: round.version + 1 });
      return clone(round);
    },
    async listGameHubRounds(game, limit = 10) {
      return [...gameHubRounds.values()].filter((round) => round.game === game)
        .sort((a, b) => b.createdAt - a.createdAt).slice(0, limit).map(clone);
    },

    async stats() {
      return {
        users: users.size,
        round: game.roundNumber,
        phase: game.phase,
        pot: game.pot,
        cardsThisRound: [...cards.values()].filter((c) => c.round === game.roundNumber).length,
        pendingWithdrawals: [...withdrawals.values()].filter((w) => w.status === 'pending').length,
      };
    },
  };
}
