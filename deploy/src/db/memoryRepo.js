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
  const rounds = new Map();
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
    async createUser({ phone, name, pinHash, role = 'player' }) {
      for (const u of users.values()) if (u.phone === phone) throw new RepoError('PHONE_TAKEN');
      const user = { id: randomToken(12), phone, name, pinHash, role, balance: 0, failedLogins: 0, lockedUntil: 0, createdAt: new Date() };
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

    /** Atomically end the round with a winner and pay the prize. Returns the new game, or null if the round was already decided. */
    async settleWin({ round, card, prize, ref }) {
      if (game.phase !== 'running' || game.roundNumber !== round) return null;
      game = {
        ...game,
        phase: 'ended',
        autoCall: false,
        nextCallAt: null,
        winner: { cardCode: card.code, serial: card.serial, userId: card.userId, prize, at: Date.now() },
        version: game.version + 1,
      };
      credit(card.userId, prize, 'prize', ref, { round, card: card.code });
      return clone(game);
    },

    /* money */
    async applyLedger({ userId, amount, kind, ref, meta }) {
      return credit(userId, amount, kind, ref, meta);
    },
    async listLedger(userId, limit = 30) {
      return [...ledger.values()].filter((e) => e.userId === userId).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit).map(clone);
    },

    /* deposits */
    async createPayment({ txRef, userId, amount }) {
      payments.set(txRef, { txRef, userId, amount, status: 'pending', createdAt: new Date() });
    },
    async getPayment(txRef) {
      return clone(payments.get(txRef) ?? null);
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
      if (p && p.status === 'pending') p.status = status;
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
