/**
 * MongoDB repository (official driver). Money-moving operations run inside a
 * multi-document transaction, so a crash can never leave "charged but no cards"
 * or "round ended but prize not paid". Transactions need a replica set: MongoDB
 * Atlas (including the free tier) provides one.
 */
import { MongoClient } from 'mongodb';
import { randomToken } from '../util/crypto.js';
import { RepoError } from '../util/errors.js';
import { DEFAULT_GAME } from './defaults.js';

const isDuplicate = (e) => e?.code === 11000 || e?.errorResponse?.code === 11000;
const toUser = (d) => (d ? { ...d, id: d._id } : null);
const toDoc = (d) => (d ? { ...d, id: d._id } : null);

export async function createMongoRepo({ uri, dbName }) {
  const client = new MongoClient(uri, { retryWrites: true, w: 'majority' });
  await client.connect();
  const db = client.db(dbName);
  const users = db.collection('users');
  const games = db.collection('game');
  const cards = db.collection('cards');
  const ledger = db.collection('ledger');
  const payments = db.collection('payments');
  const withdrawals = db.collection('withdrawals');
  const rounds = db.collection('rounds');
  const maintenance = db.collection('maintenance');

  async function tx(fn) {
    const session = client.startSession();
    try {
      let out;
      await session.withTransaction(async () => {
        out = await fn(session);
      });
      return out;
    } finally {
      await session.endSession();
    }
  }

  /** Debit/credit + ledger row inside an existing transaction. A repeated `ref` throws a duplicate-key error. */
  async function moveMoney(session, { userId, amount, kind, ref, meta }) {
    const filter = amount < 0 ? { _id: userId, balance: { $gte: -amount } } : { _id: userId };
    const r = await users.updateOne(filter, { $inc: { balance: amount } }, { session });
    if (!r.matchedCount) {
      const exists = await users.findOne({ _id: userId }, { session, projection: { _id: 1 } });
      throw new RepoError(exists ? 'INSUFFICIENT_FUNDS' : 'USER_NOT_FOUND');
    }
    await ledger.insertOne({ userId, amount, kind, ref, meta: meta ?? {}, createdAt: new Date() }, { session });
  }

  const balanceOf = async (userId) => (await users.findOne({ _id: userId }, { projection: { balance: 1 } }))?.balance ?? 0;

  return {
    kind: 'mongo',

    async init() {
      await Promise.all([
        users.createIndex({ phone: 1 }, { unique: true }),
        cards.createIndex({ code: 1 }, { unique: true }),
        cards.createIndex({ round: 1, serial: 1 }, { unique: true, partialFilterExpression: { serial: { $type: 'string' } } }),
        cards.createIndex({ userId: 1, round: 1 }),
        ledger.createIndex({ ref: 1 }, { unique: true }),
        ledger.createIndex({ userId: 1, createdAt: -1 }),
        payments.createIndex({ txRef: 1 }, { unique: true }),
        withdrawals.createIndex({ status: 1, createdAt: -1 }),
        withdrawals.createIndex({ userId: 1, createdAt: -1 }),
        rounds.createIndex({ round: 1 }, { unique: true }),
      ]);
      await games.updateOne({ _id: 'state' }, { $setOnInsert: { ...DEFAULT_GAME } }, { upsert: true });
    },
    /** One-time fresh-start reset: preserve admin accounts, remove player accounts and their data. */
    async resetPlayerAccountsOnce() {
      const markerId = 'player-accounts-reset-2026-11';
      if (await maintenance.findOne({ _id: markerId })) return { alreadyDone: true };
      await users.deleteMany({ role: { $ne: 'admin' } });
      await Promise.all([
        cards.deleteMany({}),
        ledger.deleteMany({}),
        payments.deleteMany({}),
        withdrawals.deleteMany({}),
        rounds.deleteMany({}),
      ]);
      await games.updateOne({ _id: 'state' }, { $set: { ...DEFAULT_GAME } }, { upsert: true });
      await maintenance.insertOne({ _id: markerId, completedAt: new Date(), preservedRole: 'admin' });
      return { alreadyDone: false };
    },

    async close() {
      await client.close();
    },
    /** Tests only: remove the throwaway database. */
    async dropDatabase() {
      await db.dropDatabase();
    },

    /* users */
    async createUser({ phone, name, pinHash, role = 'player' }) {
      const doc = { _id: randomToken(12), phone, name, pinHash, role, balance: 0, failedLogins: 0, lockedUntil: 0, createdAt: new Date() };
      try {
        await users.insertOne(doc);
      } catch (e) {
        if (isDuplicate(e)) throw new RepoError('PHONE_TAKEN');
        throw e;
      }
      return toUser(doc);
    },
    async findUserByPhone(phone) {
      return toUser(await users.findOne({ phone }));
    },
    async findUserById(id) {
      return toUser(await users.findOne({ _id: id }));
    },
    async updateUser(id, patch) {
      await users.updateOne({ _id: id }, { $set: patch });
    },

    /* game state */
    async getGame() {
      const g = await games.findOne({ _id: 'state' });
      const { _id, ...rest } = g;
      return rest;
    },
    async casGame(version, patch) {
      const g = await games.findOneAndUpdate(
        { _id: 'state', version },
        { $set: patch, $inc: { version: 1 } },
        { returnDocument: 'after' },
      );
      if (!g) return null;
      const { _id, ...rest } = g;
      return rest;
    },
    async archiveRound(doc) {
      await rounds.updateOne({ round: doc.round }, { $set: doc }, { upsert: true });
    },
    async getArchivedRound(round) {
      const r = await rounds.findOne({ round });
      return r ? { ...r, _id: undefined } : null;
    },

    /* cards */
    async purchaseCards({ userId, cost, cards: newCards, round, ref }) {
      return tx(async (session) => {
        const g = await games.findOneAndUpdate(
          { _id: 'state', phase: 'waiting', roundNumber: round },
          { $inc: { pot: cost, version: 1 } },
          { returnDocument: 'after', session },
        );
        if (!g) throw new RepoError('ROUND_NOT_OPEN');
        await moveMoney(session, { userId, amount: -cost, kind: 'card_purchase', ref, meta: { round, count: newCards.length } });
        try {
          await cards.insertMany(newCards.map((c) => ({ ...c, userId, round, createdAt: new Date() })), { session });
        } catch (e) {
          if (isDuplicate(e)) throw new RepoError('CARD_NUMBER_TAKEN');
          throw e;
        }
        const { _id, ...game } = g;
        const user = await users.findOne({ _id: userId }, { session, projection: { balance: 1 } });
        return { balance: user.balance, game };
      });
    },
    async listCards(userId, round) {
      return (await cards.find({ userId, round }).sort({ serial: 1 }).toArray()).map(toDoc);
    },
    async countCards(userId, round) {
      return cards.countDocuments({ userId, round });
    },
    async getCard(code) {
      return toDoc(await cards.findOne({ code }));
    },

    async settleWin({ round, card, prize, ref }) {
      return tx(async (session) => {
        const g = await games.findOneAndUpdate(
          { _id: 'state', phase: 'running', roundNumber: round },
          {
            $set: {
              phase: 'ended',
              autoCall: false,
              nextCallAt: null,
              winner: { cardCode: card.code, serial: card.serial, userId: card.userId, prize, at: Date.now() },
            },
            $inc: { version: 1 },
          },
          { returnDocument: 'after', session },
        );
        if (!g) return null; // somebody else already won this round
        await moveMoney(session, { userId: card.userId, amount: prize, kind: 'prize', ref, meta: { round, card: card.code } });
        const { _id, ...game } = g;
        return game;
      });
    },

    /* money */
    async applyLedger({ userId, amount, kind, ref, meta }) {
      try {
        await tx((session) => moveMoney(session, { userId, amount, kind, ref, meta }));
        return { applied: true, balance: await balanceOf(userId) };
      } catch (e) {
        if (isDuplicate(e)) return { applied: false, balance: await balanceOf(userId) };
        throw e;
      }
    },
    async listLedger(userId, limit = 30) {
      return ledger.find({ userId }).sort({ createdAt: -1 }).limit(limit).toArray();
    },

    /* deposits */
    async createPayment({ txRef, userId, amount }) {
      await payments.insertOne({ txRef, userId, amount, status: 'pending', createdAt: new Date() });
    },
    async getPayment(txRef) {
      return payments.findOne({ txRef });
    },
    async confirmDeposit({ txRef, chapaRef }) {
      const result = await tx(async (session) => {
        const p = await payments.findOneAndUpdate(
          { txRef, status: 'pending' },
          { $set: { status: 'success', chapaRef: chapaRef ?? null, confirmedAt: new Date() } },
          { returnDocument: 'after', session },
        );
        if (!p) return { credited: false };
        await moveMoney(session, { userId: p.userId, amount: p.amount, kind: 'deposit', ref: `dep:${txRef}`, meta: { txRef, chapaRef } });
        return { credited: true };
      }).catch((e) => {
        if (isDuplicate(e)) return { credited: false };
        throw e;
      });
      const payment = await payments.findOne({ txRef });
      if (!payment) throw new RepoError('PAYMENT_NOT_FOUND');
      return { credited: result.credited, balance: await balanceOf(payment.userId) };
    },
    async failPayment(txRef, status = 'failed') {
      await payments.updateOne({ txRef, status: 'pending' }, { $set: { status } });
    },

    /* withdrawals */
    async requestWithdrawal({ id, userId, amount, accountName, accountNumber, bankCode }) {
      return tx(async (session) => {
        await moveMoney(session, { userId, amount: -amount, kind: 'withdraw_hold', ref: `wd:${id}`, meta: { id } });
        const doc = { _id: id, userId, amount, accountName, accountNumber, bankCode, status: 'pending', note: '', createdAt: new Date(), updatedAt: new Date() };
        await withdrawals.insertOne(doc, { session });
        return toDoc(doc);
      });
    },
    async getWithdrawal(id) {
      return toDoc(await withdrawals.findOne({ _id: id }));
    },
    async listWithdrawals({ status, userId } = {}) {
      const q = {};
      if (status) q.status = status;
      if (userId) q.userId = userId;
      return (await withdrawals.find(q).sort({ createdAt: -1 }).limit(200).toArray()).map(toDoc);
    },
    async transitionWithdrawal(id, from, to, patch = {}) {
      const w = await withdrawals.findOneAndUpdate(
        { _id: id, status: { $in: from } },
        { $set: { ...patch, status: to, updatedAt: new Date() } },
        { returnDocument: 'after' },
      );
      return toDoc(w);
    },
    async refundWithdrawal(id) {
      const w = await withdrawals.findOne({ _id: id });
      if (!w) throw new RepoError('WITHDRAWAL_NOT_FOUND');
      return this.applyLedger({ userId: w.userId, amount: w.amount, kind: 'withdraw_refund', ref: `wd-refund:${id}`, meta: { id } });
    },

    async stats() {
      const g = await games.findOne({ _id: 'state' });
      return {
        users: await users.countDocuments(),
        round: g.roundNumber,
        phase: g.phase,
        pot: g.pot,
        cardsThisRound: await cards.countDocuments({ round: g.roundNumber }),
        pendingWithdrawals: await withdrawals.countDocuments({ status: 'pending' }),
      };
    },
  };
}
