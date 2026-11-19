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
  let game = { ...DEFAULT_GAME, calledNumbers: [] };

  const credit = (userId, amount, kind, ref, meta = {}) => {
    const user = users.get(userId);
    if (!user) throw new RepoError('USER_NOT_FOUND');
    if (ledger.has(ref)) return { applied: false, balance: user.balance };
    if (amount < 0 && user.balance + amount < 0) throw new RepoError('INSUFFICIENT_FUNDS');
    user.balance += amount;
    ledger.set(ref, { userId, amount, kind, ref, meta, createdAt: new Date() });
    return { applied: true, balance: user.balance };
  };

  return {
    kind: 'memory',
    async init() {},
    async close() {},

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
    async purchaseCards({ userId, cost, cards: newCards, round, ref }) {
      if (game.phase !== 'waiting' || game.roundNumber !== round) throw new RepoError('ROUND_NOT_OPEN');
      if (newCards.some((c) => typeof c.serial === 'string' && [...cards.values()].some((old) => old.round === round && old.serial === c.serial))) throw new RepoError('CARD_NUMBER_TAKEN');
      const r = credit(userId, -cost, 'card_purchase', ref, { round, count: newCards.length });
      for (const c of newCards) cards.set(c.code, { ...clone(c), userId, round, createdAt: new Date() });
      game = { ...game, pot: game.pot + cost, version: game.version + 1 };
      return { balance: r.balance, game: clone(game) };
    },
    async listCards(userId, round) {
      return [...cards.values()].filter((c) => c.userId === userId && c.round === round).sort((a, b) => a.serial - b.serial).map(clone);
    },
    async countCards(userId, round) {
      return [...cards.values()].filter((c) => c.userId === userId && c.round === round).length;
    },
    async getCard(code) {
      return clone(cards.get(code) ?? null);
    },

    /** End the round and create a pending prize request; never credit the wallet here. */
    async settleWin({ round, expectedVersion, card, prize, ref }) {
      if (game.phase !== 'running' || game.roundNumber !== round || game.version !== expectedVersion) return null;
      const id = ref;
      if (winPayouts.has(id)) return null;
      const at = new Date();
      winPayouts.set(id, { id, round, cardCode: card.code, serial: card.serial, userId: card.userId, amount: prize, status: 'pending', createdAt: at, updatedAt: at });
      game = {
        ...game, phase: 'ended', autoCall: false, nextCallAt: null,
        winner: { cardCode: card.code, serial: card.serial, userId: card.userId, prize, payoutId: id, payoutStatus: 'pending', at: Date.now() },
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
    async listUserSimulationDeposits(userId, limit = 30) {
      return [...payments.values()]
        .filter((p) => p.userId === userId && ['manual-simulation', 'sms-simulation'].includes(p.source))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit)
        .map((p) => ({ reference: p.txRef, amount: p.amount / 100, status: p.status, currency: 'ETB', at: p.createdAt.getTime() }));
    },
    async listSimulationDeposits({ status = 'pending' } = {}) {
      return [...payments.values()]
        .filter((p) => ['manual-simulation', 'sms-simulation'].includes(p.source) && (!status || p.status === status))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 200)
        .map((p) => {
          const user = users.get(p.userId);
          return { id: p.txRef, reference: p.txRef, rawMessage: p.rawMessage ?? '', provider: p.provider ?? '', userId: p.userId, userName: user?.name ?? 'Unknown', userPhone: user?.phone ?? '', amount: p.amount / 100, status: p.status, at: p.createdAt.getTime() };
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
      if (!w || w.mode !== 'manual' || w.status !== 'pending') return null;
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
