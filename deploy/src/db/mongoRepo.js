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
  const smsEvents = db.collection('adminBankSmsEvents');
  const withdrawals = db.collection('withdrawals');
  const winPayouts = db.collection('winPayouts');
  const rounds = db.collection('rounds');
  const phoneChallenges = db.collection('phoneVerificationChallenges');
  const pinResetChallenges = db.collection('pinResetChallenges');
  const pushSubscriptions = db.collection('pushSubscriptions');
  const gameHubRounds = db.collection('gameHubRounds');
  const gameHubState = db.collection('gameHubState');
  const gameHubSettings = db.collection('gameHubSettings');
  const gameHubWallets = db.collection('gameHubWallets');
  const gameHubLedger = db.collection('gameHubLedger');

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

  /** Separate non-withdrawable simulation credits for Keno and Aviator. */
  async function moveGameHubCredits(session, { userId, amount, kind, ref, meta }) {
    const filter = amount < 0 ? { _id: userId, balance: { $gte: -amount } } : { _id: userId };
    const r = await gameHubWallets.updateOne(filter, { $inc: { balance: amount } }, { session });
    if (!r.matchedCount) {
      const exists = await gameHubWallets.findOne({ _id: userId }, { session, projection: { _id: 1 } });
      throw new RepoError(exists ? 'INSUFFICIENT_FUNDS' : 'GAME_WALLET_NOT_FOUND');
    }
    await gameHubLedger.insertOne({ userId, amount, kind, ref, meta: meta ?? {}, createdAt: new Date() }, { session });
  }

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
        payments.createIndex({ smsEventId: 1 }, { unique: true, sparse: true }),
        smsEvents.createIndex({ eventId: 1 }, { unique: true }),
        smsEvents.createIndex({ reference: 1, receivedAt: -1 }),
        smsEvents.createIndex({ createdAt: 1 }, { expireAfterSeconds: 604800 }),
        withdrawals.createIndex({ status: 1, createdAt: -1 }),
        withdrawals.createIndex({ userId: 1, createdAt: -1 }),
        withdrawals.createIndex({ externalPayoutReference: 1 }, { unique: true, partialFilterExpression: { externalPayoutReference: { $type: 'string' } } }),
        winPayouts.createIndex({ status: 1, createdAt: -1 }),
        rounds.createIndex({ round: 1 }, { unique: true }),
        phoneChallenges.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        pinResetChallenges.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        pushSubscriptions.createIndex({ endpoint: 1 }, { unique: true }),
        pushSubscriptions.createIndex({ userId: 1 }),
        gameHubRounds.createIndex({ game: 1, createdAt: -1 }),
        gameHubRounds.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
        gameHubRounds.createIndex({ game: 1, roundId: 1 }, { unique: true }),
        gameHubLedger.createIndex({ ref: 1 }, { unique: true }),
        gameHubLedger.createIndex({ userId: 1, createdAt: -1 }),
      ]);
      await games.updateOne({ _id: 'state' }, { $setOnInsert: { ...DEFAULT_GAME } }, { upsert: true });
    },
    async close() {
      await client.close();
    },
    /** Tests only: remove the throwaway database. */
    async dropDatabase() {
      await db.dropDatabase();
    },

    /* Web Push: device subscriptions are isolated from wallet and game records. */
    async savePushSubscription(userId, subscription) {
      await pushSubscriptions.updateOne({ endpoint: subscription.endpoint }, { $set: { userId, endpoint: subscription.endpoint, subscription, updatedAt: new Date() } }, { upsert: true });
    },
    async removePushSubscription(userId, endpoint) {
      await pushSubscriptions.deleteOne({ userId, endpoint });
    },
    async listPushSubscriptions() {
      return pushSubscriptions.find({}, { projection: { _id: 0, userId: 1, endpoint: 1, subscription: 1 } }).toArray();
    },
    /* users */
    async createUser({ phone, name, pinHash, role = 'player', phoneVerified = true }) {
      const doc = { _id: randomToken(12), phone, name, pinHash, role, phoneVerified, balance: 0, failedLogins: 0, lockedUntil: 0, createdAt: new Date() };
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

    /* phone verification: isolated collection; no wallet/game records are touched */
    async createPhoneChallenge({ userId, codeHash, codeEncrypted, expiresAt }) {
      await phoneChallenges.updateOne({ _id: userId }, { $set: { codeHash, codeEncrypted, expiresAt, attempts: 0, createdAt: new Date() } }, { upsert: true });
    },
    async getPhoneChallenge(userId) {
      return phoneChallenges.findOne({ _id: userId });
    },
    async recordPhoneChallengeFailure(userId) {
      await phoneChallenges.updateOne({ _id: userId, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }, { $inc: { attempts: 1 } });
    },
    async completePhoneVerification(userId, codeHash) {
      return tx(async (session) => {
        const challenge = await phoneChallenges.findOne({ _id: userId, codeHash, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }, { session });
        if (!challenge) return false;
        const removed = await phoneChallenges.deleteOne({ _id: userId, codeHash, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }, { session });
        if (removed.deletedCount !== 1) return false;
        const updated = await users.updateOne({ _id: userId, role: 'player', phoneVerified: { $ne: true } }, { $set: { phoneVerified: true, phoneVerifiedAt: new Date() } }, { session });
        return updated.modifiedCount === 1;
      });
    },
    async listPendingPhoneChallenges() {
      const rows = await phoneChallenges.find({ expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }).sort({ createdAt: 1 }).limit(200).toArray();
      return Promise.all(rows.map(async (c) => {
        const u = await users.findOne({ _id: c._id }, { projection: { name: 1, phone: 1, role: 1 } });
        return u?.role === 'player' ? { userId: c._id, name: u.name, phone: u.phone, codeEncrypted: c.codeEncrypted, expiresAt: c.expiresAt, attempts: c.attempts } : null;
      })).then((items) => items.filter(Boolean));
    },

    /* Admin-assisted PIN recovery, separate from phone verification. */
    async createPinResetChallenge({ userId, codeHash, codeEncrypted, expiresAt }) {
      await pinResetChallenges.updateOne({ _id: userId }, { $set: { codeHash, codeEncrypted, expiresAt, attempts: 0, createdAt: new Date() } }, { upsert: true });
    },
    async getPinResetChallenge(userId) {
      return pinResetChallenges.findOne({ _id: userId });
    },
    async recordPinResetFailure(userId) {
      await pinResetChallenges.updateOne({ _id: userId, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }, { $inc: { attempts: 1 } });
    },
    async completePinReset(userId, codeHash, pinHash) {
      return tx(async (session) => {
        const challenge = await pinResetChallenges.findOne({ _id: userId, codeHash, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }, { session });
        if (!challenge) return false;
        const removed = await pinResetChallenges.deleteOne({ _id: userId, codeHash, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }, { session });
        if (removed.deletedCount !== 1) return false;
        const updated = await users.updateOne({ _id: userId, role: 'player' }, { $set: { pinHash, failedLogins: 0, lockedUntil: 0, pinUpdatedAt: new Date() } }, { session });
        return updated.modifiedCount === 1;
      });
    },
    async listPendingPinResets() {
      const rows = await pinResetChallenges.find({ expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }).sort({ createdAt: 1 }).limit(200).toArray();
      return Promise.all(rows.map(async (c) => {
        const u = await users.findOne({ _id: c._id }, { projection: { name: 1, phone: 1, role: 1 } });
        return u?.role === 'player' ? { userId: c._id, name: u.name, phone: u.phone, codeEncrypted: c.codeEncrypted, expiresAt: c.expiresAt, attempts: c.attempts } : null;
      })).then((items) => items.filter(Boolean));
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
    async reserveCardSerials(round, count, requestedSerial) {
      const update = requestedSerial !== undefined && requestedSerial !== null
        ? { $max: { nextCardSerial: Number(requestedSerial) + 1 } }
        : { $inc: { nextCardSerial: count } };
      const game = await games.findOneAndUpdate(
        { _id: 'state', phase: 'waiting', roundNumber: round },
        update,
        { returnDocument: 'after', projection: { nextCardSerial: 1 } },
      );
      if (!game) throw new RepoError('ROUND_NOT_OPEN');
      if (requestedSerial !== undefined && requestedSerial !== null) return [String(requestedSerial)];
      const first = game.nextCardSerial - count + 1;
      return Array.from({ length: count }, (_, i) => String(first + i).padStart(5, '0'));
    },
    async purchaseCards({ userId, cost, cards: newCards, round, ref }) {
      return tx(async (session) => {
        const g = await games.findOneAndUpdate(
          { _id: 'state', phase: 'waiting', roundNumber: round },
          { $inc: { pot: cost, version: 1 }, $addToSet: { roundPlayerIds: userId } },
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
    async listPlayerIds() {
      return (await users.find({ role: 'player', phoneVerified: true }, { projection: { _id: 1 } }).toArray()).map((u) => u._id);
    },
    async insertFreeCards({ userId, round, cards: newCards }) {
      const game = await games.findOne({ _id: 'state', phase: 'waiting', roundNumber: round }, { projection: { _id: 1 } });
      if (!game) throw new RepoError('ROUND_NOT_OPEN');
      if (!newCards.length) return;
      try {
        await cards.insertMany(newCards.map((c) => ({ ...c, userId, round, createdAt: new Date(), bonusFree: true })), { ordered: true });
      } catch (e) {
        if (isDuplicate(e)) throw new RepoError('CARD_NUMBER_TAKEN');
        throw e;
      }
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
    async lockCard({ code, userId, round, expectedVersion }) {
      return tx(async (session) => {
        const game = await games.updateOne(
          { _id: 'state', phase: 'running', roundNumber: round, version: expectedVersion },
          { $inc: { version: 1 } },
          { session },
        );
        if (!game.matchedCount) return false;
        const result = await cards.updateOne(
          { code, userId, round, lockedAt: { $exists: false } },
          { $set: { lockedAt: new Date(), lockReason: 'false_bingo' } },
          { session },
        );
        return result.modifiedCount === 1;
      });
    },
    async unlockCard(code) {
      const result = await cards.updateOne({ code, lockedAt: { $exists: true } }, { $unset: { lockedAt: '', lockReason: '' } });
      return result.modifiedCount === 1;
    },

    /** End the round and enqueue a prize; wallet credit is deferred until admin approval. */
    async settleWin({ round, expectedVersion, card, prize, ref }) {
      return tx(async (session) => {
        const before = await games.findOne(
          { _id: 'state', phase: 'running', roundNumber: round, version: expectedVersion },
          { session, projection: { bonusRound: 1 } },
        );
        if (!before) return null;
        const g = await games.findOneAndUpdate(
          { _id: 'state', phase: 'running', roundNumber: round, version: expectedVersion },
          { $set: { phase: 'ended', autoCall: false, nextCallAt: null,
            winner: { cardCode: card.code, serial: card.serial, userId: card.userId, prize, payoutId: ref, payoutStatus: 'paid', at: Date.now() }, lastCompletedRoundNumber: round, lastCompletedWasBonus: before.bonusRound === true },
            $inc: { version: 1 } },
          { returnDocument: 'after', session },
        );
        if (!g) return null;
        await moveMoney(session, {
          userId: card.userId,
          amount: prize,
          kind: 'prize',
          ref: `win-payout:${ref}`,
          meta: { round, card: card.code },
        });
        const { _id, ...game } = g;
        return game;
      });
    },
    async listWinPayouts({ status = 'pending' } = {}) {
      const filter = status ? { status } : {};
      const rows = await winPayouts.find(filter).sort({ createdAt: -1 }).limit(200).toArray();
      return Promise.all(rows.map(async (p) => {
        const u = await users.findOne({ _id: p.userId }, { projection: { name: 1, phone: 1 } });
        return { id: p._id, round: p.round, cardCode: p.cardCode, serial: p.serial, userId: p.userId, amount: p.amount / 100, status: p.status, note: p.note ?? '', at: new Date(p.createdAt).getTime(), userName: u?.name ?? 'Unknown', userPhone: u?.phone ?? '' };
      }));
    },
    async approveWinPayout(id) {
      return tx(async (session) => {
        const p = await winPayouts.findOneAndUpdate({ _id: id, status: 'pending' }, { $set: { status: 'approved', updatedAt: new Date() } }, { returnDocument: 'after', session });
        if (!p) return null;
        await moveMoney(session, { userId: p.userId, amount: p.amount, kind: 'prize', ref: `win-payout:${id}`, meta: { round: p.round, card: p.cardCode } });
        const u = await users.findOne({ _id: p.userId }, { session, projection: { balance: 1 } });
        return { id, status: 'approved', credited: true, balance: (u?.balance ?? 0) / 100 };
      });
    },
    async rejectWinPayout(id, note = '') {
      const p = await winPayouts.findOneAndUpdate({ _id: id, status: 'pending' }, { $set: { status: 'rejected', note: String(note).slice(0, 200), updatedAt: new Date() } }, { returnDocument: 'after' });
      return p ? { id, status: 'rejected' } : null;
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
    async createPayment({ txRef, userId, amount, source = 'chapa', rawMessage, provider }) {
      await payments.insertOne({ txRef, userId, amount, source, rawMessage, provider, status: 'pending', createdAt: new Date() });
    },
    async getPayment(txRef) {
      return payments.findOne({ txRef });
    },
    async matchStoredSmsDeposit({ txRef }) {
      const payment = await payments.findOne({ txRef, source: 'automatic-sms', status: 'pending', smsEventId: { $exists: false } });
      if (!payment) return { matched: false, unmatched: true };
      const event = await smsEvents.findOneAndUpdate(
        { reference: txRef, consumedBy: { $exists: false } },
        { $set: { consumedBy: txRef } },
        { sort: { receivedAt: -1 }, returnDocument: 'after' },
      );
      if (!event) return { matched: false, unmatched: true };
      const status = payment.amount === event.amount ? 'matched' : 'amount-mismatch';
      const updated = await payments.updateOne(
        { txRef, source: 'automatic-sms', status: 'pending', smsEventId: { $exists: false } },
        { $set: { smsEventId: event.eventId, smsMatch: { status, provider: event.provider, amount: event.amount, transactionAt: event.transactionAt, receivedAt: event.receivedAt, sender: event.sender, recipientAccount: event.recipientAccount ?? null, matchedAt: new Date() } } },
      );
      if (updated.modifiedCount !== 1) return { matched: false, duplicate: true };
      return { matched: status === 'matched', mismatch: status === 'amount-mismatch', reference: txRef };
    },
    async recordSmsEventAndMatch(event) {
      const { rawMessage, ...safeEvent } = event;
      try { await smsEvents.insertOne({ ...safeEvent, createdAt: new Date() }); }
      catch (error) { if (isDuplicate(error)) return { matched: false, duplicate: true }; throw error; }
      return this.matchStoredSmsDeposit({ txRef: event.reference });
    },
    async listUserSimulationDeposits(userId, limit = 30) {
      const rows = await payments.find({ userId, source: { $in: ['manual-simulation', 'sms-simulation', 'automatic-sms'] } })
        .sort({ createdAt: -1 }).limit(limit).toArray();
      return rows.map((p) => ({
        reference: p.txRef, amount: p.amount / 100, status: p.status, currency: 'ETB',
        at: new Date(p.createdAt).getTime(),
      }));
    },
    async listSimulationDeposits({ status = 'pending' } = {}) {
      const filter = { source: { $in: ['manual-simulation', 'sms-simulation', 'automatic-sms'] } };
      if (status) filter.status = status;
      const rows = await payments.find(filter).sort({ createdAt: -1 }).limit(200).toArray();
      return Promise.all(rows.map(async (p) => {
        const user = await users.findOne({ _id: p.userId }, { projection: { name: 1, phone: 1 } });
        return { id: p.txRef, reference: p.txRef, rawMessage: p.rawMessage ?? '', provider: p.provider ?? '', smsMatch: p.smsMatch ?? null, source: p.source, userId: p.userId, userName: user?.name ?? 'Unknown', userPhone: user?.phone ?? '', amount: p.amount / 100, status: p.status, at: new Date(p.createdAt).getTime() };
      }));
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
      const result = await payments.updateOne({ txRef, status: 'pending' }, { $set: { status } });
      return result.modifiedCount === 1;
    },

    /* Simulation-only withdrawals: reserve/refund the simulated wallet in transactions; never transfer funds. */
    async requestSimulationWithdrawal({ id, userId, amount, method, destination }) {
      return tx(async (session) => {
        await moveMoney(session, { userId, amount: -amount, kind: 'simulation_withdraw_hold', ref: `simwd:${id}`, meta: { id } });
        const doc = { _id: id, userId, amount, method, destination, mode: 'simulation', status: 'pending', note: '', createdAt: new Date(), updatedAt: new Date() };
        await withdrawals.insertOne(doc, { session });
        return toDoc(doc);
      });
    },
    async listSimulationWithdrawals({ status = 'pending', userId } = {}) {
      const q = { mode: 'simulation' };
      if (status) q.status = status;
      if (userId) q.userId = userId;
      const rows = await withdrawals.find(q).sort({ createdAt: -1 }).limit(200).toArray();
      return Promise.all(rows.map(async (w) => {
        const u = await users.findOne({ _id: w.userId }, { projection: { name: 1, phone: 1 } });
        return { id: w._id, userId: w.userId, amount: w.amount / 100, method: w.method ?? '', destination: w.destination ?? '', status: w.status, note: w.note ?? '', at: new Date(w.createdAt).getTime(), userName: u?.name ?? 'Unknown', userPhone: u?.phone ?? '' };
      }));
    },
    async transitionSimulationWithdrawal(id, from, to, patch = {}) {
      const w = await withdrawals.findOneAndUpdate(
        { _id: id, mode: 'simulation', status: { $in: from } },
        { $set: { ...patch, status: to, updatedAt: new Date() } },
        { returnDocument: 'after' },
      );
      return toDoc(w);
    },
    async rejectSimulationWithdrawalAndRefund(id, note, adminId) {
      return tx(async (session) => {
        const w = await withdrawals.findOneAndUpdate(
          { _id: id, mode: 'simulation', status: 'pending' },
          { $set: { status: 'rejected', note, reviewedBy: adminId, updatedAt: new Date() } },
          { returnDocument: 'after', session },
        );
        if (!w) return null;
        await moveMoney(session, { userId: w.userId, amount: w.amount, kind: 'simulation_withdraw_refund', ref: `simwd-refund:${id}`, meta: { id } });
        return toDoc(w);
      });
    },

    /* Manual withdrawals: real wallet funds are held until an admin records an external payout reference. */
    async requestManualWithdrawal({ id, userId, amount, method, destination }) {
      return tx(async (session) => {
        await moveMoney(session, { userId, amount: -amount, kind: 'manual_withdraw_hold', ref: `manual-wd:${id}`, meta: { id, method } });
        const doc = {
          _id: id, userId, amount, method, destination, mode: 'manual',
          status: 'pending', note: '', createdAt: new Date(), updatedAt: new Date(),
        };
        await withdrawals.insertOne(doc, { session });
        return toDoc(doc);
      });
    },
    async listManualWithdrawals({ status = 'pending', userId } = {}) {
      const q = { mode: 'manual' };
      if (status) q.status = status;
      if (userId) q.userId = userId;
      const rows = await withdrawals.find(q).sort({ createdAt: -1 }).limit(200).toArray();
      return Promise.all(rows.map(async (w) => {
        const u = await users.findOne({ _id: w.userId }, { projection: { name: 1, phone: 1 } });
        return {
          id: w._id, userId: w.userId, amount: w.amount / 100,
          method: w.method ?? '', destination: w.destination ?? '',
          status: w.status, note: w.note ?? '',
          externalPayoutReference: w.externalPayoutReference ?? '',
          payoutMethod: w.payoutMethod ?? '',
          processingBy: w.processingBy ?? null, paidBy: w.paidBy ?? null,
          at: new Date(w.createdAt).getTime(),
          userName: u?.name ?? 'Unknown', userPhone: u?.phone ?? '',
        };
      }));
    },
    async transitionManualWithdrawal(id, from, to, patch = {}) {
      const w = await withdrawals.findOneAndUpdate(
        { _id: id, mode: 'manual', status: { $in: from } },
        { $set: { ...patch, status: to, updatedAt: new Date() } },
        { returnDocument: 'after' },
      );
      return toDoc(w);
    },
    async confirmManualWithdrawal({ id, externalReference, payoutMethod, adminId }) {
      const w = await withdrawals.findOneAndUpdate(
        { _id: id, mode: 'manual', status: 'processing' },
        { $set: {
          status: 'paid', externalPayoutReference: externalReference,
          payoutMethod, paidBy: adminId, paidAt: new Date(), updatedAt: new Date(),
        } },
        { returnDocument: 'after' },
      );
      return toDoc(w);
    },
    async rejectManualWithdrawalAndRefund(id, note, adminId) {
      return tx(async (session) => {
        const w = await withdrawals.findOneAndUpdate(
          { _id: id, mode: 'manual', status: { $in: ['pending', 'processing'] } },
          { $set: { status: 'rejected', note, reviewedBy: adminId, updatedAt: new Date() } },
          { returnDocument: 'after', session },
        );
        if (!w) return null;
        await moveMoney(session, {
          userId: w.userId, amount: w.amount, kind: 'manual_withdraw_refund',
          ref: `manual-wd-refund:${id}`, meta: { id },
        });
        return toDoc(w);
      });
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
    /** Change a withdrawal state and refund its held balance in the same transaction. */
    async transitionWithdrawalAndRefund(id, from, to, patch = {}) {
      return tx(async (session) => {
        const w = await withdrawals.findOneAndUpdate(
          { _id: id, status: { $in: from } },
          { $set: { ...patch, status: to, updatedAt: new Date() } },
          { returnDocument: 'after', session },
        );
        if (!w) return null;
        await moveMoney(session, { userId: w.userId, amount: w.amount, kind: 'withdraw_refund', ref: `wd-refund:${id}`, meta: { id } });
        return toDoc(w);
      });
    },
    async refundWithdrawal(id) {
      const w = await withdrawals.findOne({ _id: id });
      if (!w) throw new RepoError('WITHDRAWAL_NOT_FOUND');
      return this.applyLedger({ userId: w.userId, amount: w.amount, kind: 'withdraw_refund', ref: `wd-refund:${id}`, meta: { id } });
    },

    /* Isolated Keno and Aviator persistence; the existing Bingo collections and methods remain unchanged. */
    async getGameHubSettings() {
      const saved = await gameHubSettings.findOne({ _id: 'settings' });
      if (!saved) return {};
      const { _id, ...settings } = saved;
      return settings;
    },
    async getGameHubWallet(userId) {
      if (!(await users.findOne({ _id: userId }, { projection: { _id: 1 } }))) throw new RepoError('USER_NOT_FOUND');
      const shape = (wallet) => ({ userId: wallet._id, balance: wallet.balance, currency: wallet.currency, balanceType: wallet.balanceType, createdAt: wallet.createdAt });
      const existing = await gameHubWallets.findOne({ _id: userId });
      if (existing) return shape(existing);
      try {
        return await tx(async (session) => {
          const createdAt = new Date();
          const upsert = await gameHubWallets.updateOne(
            { _id: userId },
            { $setOnInsert: { balance: 100000, currency: 'ETB', balanceType: 'SIMULATION_ONLY', createdAt } },
            { upsert: true, session },
          );
          if (upsert.upsertedCount) {
            const ref = 'games:initial-demo-credit:' + userId;
            await gameHubLedger.insertOne({ userId, amount: 100000, kind: 'demo_grant', ref, meta: { reason: 'initial_demo_wallet' }, createdAt }, { session });
          }
          const wallet = await gameHubWallets.findOne({ _id: userId }, { session });
          return shape(wallet);
        });
      } catch (error) {
        // Concurrent first visits can race to create the same wallet; read the winner after the transaction conflict.
        if ([11000, 112].includes(error?.code) || error?.codeName === 'WriteConflict') {
          const created = await gameHubWallets.findOne({ _id: userId });
          if (created) return shape(created);
        }
        throw error;
      }
    },
    async listGameHubLedger(userId, limit = 30) {
      return gameHubLedger.find({ userId }).sort({ createdAt: -1 }).limit(limit).toArray();
    },
    async updateGameHubSettings(settings) {
      await gameHubSettings.updateOne({ _id: 'settings' }, { $set: { ...settings, updatedAt: new Date() } }, { upsert: true });
      return this.getGameHubSettings();
    },
    async getCurrentGameHubRound(game) {
      const state = await gameHubState.findOne({ _id: game });
      if (!state?.currentRoundId) return null;
      return toDoc(await gameHubRounds.findOne({ _id: state.currentRoundId }));
    },
    async createGameHubRound(game, round) {
      return tx(async (session) => {
        const state = await gameHubState.findOne({ _id: game }, { session });
        if (state?.currentRoundId) {
          const current = await gameHubRounds.findOne({ _id: state.currentRoundId }, { session });
          if (current && !['settled', 'crashed'].includes(current.status)) return toDoc(current);
        }
        const doc = { ...round, _id: game + ':' + round.roundId, game, version: 1 };
        await gameHubRounds.insertOne(doc, { session });
        await gameHubState.updateOne({ _id: game }, { $set: { currentRoundId: doc._id, updatedAt: new Date() } }, { upsert: true, session });
        return toDoc(doc);
      });
    },
    async updateGameHubRound(game, id, expectedVersion, patch) {
      const updated = await gameHubRounds.findOneAndUpdate(
        { _id: game + ':' + id, version: expectedVersion },
        { $set: patch, $inc: { version: 1 } },
        { returnDocument: 'after' },
      );
      return toDoc(updated);
    },
    async placeGameHubBet({ game, roundId, bet, amount, ref, acceptedAt }) {
      return tx(async (session) => {
        const key = game + ':' + roundId;
        const round = await gameHubRounds.findOne({ _id: key }, { session });
        if (!round) throw new RepoError('ROUND_NOT_OPEN');
        await gameHubWallets.updateOne(
          { _id: bet.userId },
          { $setOnInsert: { balance: 100000, currency: 'ETB', balanceType: 'SIMULATION_ONLY', createdAt: new Date() } },
          { upsert: true, session },
        );
        const existing = (round.bets ?? []).find((item) => item.userId === bet.userId && item.requestId === bet.requestId);
        if (existing) {
          const wallet = await gameHubWallets.findOne({ _id: bet.userId }, { session, projection: { balance: 1 } });
          return { bet: existing, balance: wallet?.balance ?? 0, duplicate: true };
        }
        if (round.status !== 'betting' || round.bettingEndsAt <= acceptedAt) throw new RepoError('ROUND_NOT_OPEN');
        await moveGameHubCredits(session, { userId: bet.userId, amount: -amount, kind: 'game_bet', ref, meta: { game, roundId, betId: bet.id } });
        const updated = await gameHubRounds.findOneAndUpdate(
          { _id: key, version: round.version, status: 'betting' },
          { $push: { bets: bet }, $inc: { version: 1 } },
          { returnDocument: 'after', session },
        );
        if (!updated) throw new RepoError('ROUND_NOT_OPEN');
        const wallet = await gameHubWallets.findOne({ _id: bet.userId }, { session, projection: { balance: 1 } });
        return { bet, balance: wallet?.balance ?? 0, duplicate: false };
      });
    },
    async settleKenoGameHubRound({ roundId, drawnNumbers, results, serverSeed, settledAt, nextRoundAt }) {
      return tx(async (session) => {
        const key = 'keno:' + roundId;
        const round = await gameHubRounds.findOne({ _id: key }, { session });
        if (!round) throw new RepoError('ROUND_NOT_OPEN');
        if (round.status === 'settled') return toDoc(round);
        if (round.status !== 'betting') throw new RepoError('ROUND_NOT_OPEN');
        const byId = new Map(results.map((result) => [result.betId, result]));
        const bets = (round.bets ?? []).map((bet) => {
          const result = byId.get(bet.id) ?? { payout: 0, hits: 0, matchedNumbers: [] };
          return { ...bet, status: result.payout > 0 ? 'won' : 'lost', hits: result.hits, matchedNumbers: result.matchedNumbers, payout: result.payout, settledAt };
        });
        for (const bet of bets) {
          if (bet.payout > 0) await moveGameHubCredits(session, {
            userId: bet.userId, amount: bet.payout, kind: 'game_prize',
            ref: 'games:keno:win:' + bet.id, meta: { game: 'keno', roundId, betId: bet.id },
          });
        }
        const updated = await gameHubRounds.findOneAndUpdate(
          { _id: key, version: round.version, status: 'betting' },
          { $set: { status: 'settled', drawnNumbers, serverSeed, bets, settledAt, nextRoundAt }, $inc: { version: 1 } },
          { returnDocument: 'after', session },
        );
        if (!updated) throw new RepoError('ROUND_NOT_OPEN');
        return toDoc(updated);
      });
    },
    async startAviatorGameHubRound({ roundId, startedAt, crashAt, crashMultiplier }) {
      const updated = await gameHubRounds.findOneAndUpdate(
        { _id: 'aviator:' + roundId, status: 'betting' },
        { $set: { status: 'flying', startedAt, crashAt, crashMultiplier }, $inc: { version: 1 } },
        { returnDocument: 'after' },
      );
      if (updated) return toDoc(updated);
      const current = await gameHubRounds.findOne({ _id: 'aviator:' + roundId });
      if (current?.status === 'flying') return toDoc(current);
      throw new RepoError('ROUND_NOT_OPEN');
    },
    async cashOutAviatorGameHubBet({ roundId, betId, userId, multiplier, payout, cashedOutAt, ref }) {
      return tx(async (session) => {
        const key = 'aviator:' + roundId;
        const round = await gameHubRounds.findOne({ _id: key }, { session });
        if (!round || round.status !== 'flying' || cashedOutAt >= round.crashAt) throw new RepoError('BET_NOT_ACTIVE');
        const bet = (round.bets ?? []).find((item) => item.id === betId && item.userId === userId);
        if (!bet) throw new RepoError('BET_NOT_ACTIVE');
        if (bet.status === 'cashed_out') {
          const wallet = await gameHubWallets.findOne({ _id: userId }, { session, projection: { balance: 1 } });
          return { bet, balance: wallet?.balance ?? 0, duplicate: true };
        }
        if (bet.status !== 'active') throw new RepoError('BET_NOT_ACTIVE');
        await moveGameHubCredits(session, { userId, amount: payout, kind: 'game_prize', ref, meta: { game: 'aviator', roundId, betId, multiplier } });
        const bets = round.bets.map((item) => item.id === betId
          ? { ...item, status: 'cashed_out', multiplier, payout, cashedOutAt }
          : item);
        const updated = await gameHubRounds.findOneAndUpdate(
          { _id: key, version: round.version, status: 'flying', crashAt: { $gt: cashedOutAt } },
          { $set: { bets }, $inc: { version: 1 } },
          { returnDocument: 'after', session },
        );
        if (!updated) throw new RepoError('BET_NOT_ACTIVE');
        const wallet = await gameHubWallets.findOne({ _id: userId }, { session, projection: { balance: 1 } });
        return { bet: bets.find((item) => item.id === betId), balance: wallet?.balance ?? 0, duplicate: false };
      });
    },
    async crashAviatorGameHubRound({ roundId, crashedAt, nextRoundAt }) {
      return tx(async (session) => {
        const key = 'aviator:' + roundId;
        const round = await gameHubRounds.findOne({ _id: key }, { session });
        if (!round) throw new RepoError('ROUND_NOT_OPEN');
        if (round.status === 'crashed') return toDoc(round);
        if (round.status !== 'flying') throw new RepoError('ROUND_NOT_OPEN');
        const bets = (round.bets ?? []).map((bet) => bet.status === 'active' ? { ...bet, status: 'lost' } : bet);
        const updated = await gameHubRounds.findOneAndUpdate(
          { _id: key, version: round.version, status: 'flying' },
          { $set: { status: 'crashed', crashedAt, nextRoundAt, bets }, $inc: { version: 1 } },
          { returnDocument: 'after', session },
        );
        if (!updated) throw new RepoError('ROUND_NOT_OPEN');
        return toDoc(updated);
      });
    },
    async listGameHubRounds(game, limit = 10) {
      return (await gameHubRounds.find({ game }).sort({ createdAt: -1 }).limit(limit).toArray()).map(toDoc);
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
