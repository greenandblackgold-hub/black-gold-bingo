import { randomToken } from '../util/crypto.js';
import { HttpError, RepoError } from '../util/errors.js';
import { log } from '../util/log.js';
import { parseBankSms } from '../payments/bankSmsParser.js';

const etb = (santim) => santim / 100;
const toSantim = (etbAmount) => Math.round(Number(etbAmount) * 100);

export function createWalletService({ repo, config, chapa }) {
  const service = {
    /** Player submits only the amount and bank transaction reference; the admin phone supplies the SMS independently. */
    async startSmsSimulationDeposit(user, input = {}) {
      const txRef = String(input.reference ?? '').trim();
      const amount = toSantim(input.amount);
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{5,63}$/.test(txRef)) throw new HttpError(400, 'invalid_reference', 'Enter a valid transaction reference (6-64 letters or numbers).');
      if (!Number.isSafeInteger(amount) || amount < config.minDeposit || amount > config.maxDeposit) throw new HttpError(400, 'invalid_amount', `Deposit between ${etb(config.minDeposit)} and ${etb(config.maxDeposit)} ETB`);
      try {
        await repo.createPayment({ txRef, userId: user.id, amount, source: 'automatic-sms' });
        await repo.matchStoredSmsDeposit({ txRef });
      } catch (error) {
        if (error?.code === 'PAYMENT_REFERENCE_TAKEN' || error?.code === 11000 || error?.errorResponse?.code === 11000) throw new HttpError(409, 'reference_used', 'This transaction reference has already been submitted.');
        throw error;
      }
      return { reference: txRef, amount: etb(amount), status: 'pending', currency: 'ETB' };
    },

    async simulationDepositStatus(user, txRef) {
      const payment = await repo.getPayment(String(txRef ?? ''));
      if (!payment || payment.userId !== user.id || !['manual-simulation', 'sms-simulation', 'automatic-sms'].includes(payment.source)) {
        throw new HttpError(404, 'deposit_not_found', 'Unknown simulation deposit reference.');
      }
      return { status: payment.status };
    },

    /** Player-owned deposit history, including pending and terminal states. */
    listUserSimulationDeposits: (user) => repo.listUserSimulationDeposits(user.id, 30),

    /** Admin review queue for simulation deposits. */
    listSimulationDeposits: (filter) => repo.listSimulationDeposits(filter),

    /** Admin queue for simulation-only Bingo prizes. */
    listWinPayouts: (filter) => repo.listWinPayouts(filter),

    async approveWinPayout(id) {
      const result = await repo.approveWinPayout(String(id ?? ''));
      if (!result) throw new HttpError(409, 'wrong_status', 'Win payout is no longer pending.');
      log('simulation_win_payout_admin_approved', { id, credited: result.credited === true });
      return result;
    },

    async rejectWinPayout(id, note) {
      const result = await repo.rejectWinPayout(String(id ?? ''), note);
      if (!result) throw new HttpError(409, 'wrong_status', 'Win payout is no longer pending.');
      log('simulation_win_payout_rejected', { id });
      return result;
    },

    /** Credit a pending simulation request exactly once after an administrator verifies it. */
    async approveSimulationDeposit(txRef) {
      const payment = await repo.getPayment(String(txRef ?? ''));
      if (!payment || !['manual-simulation', 'sms-simulation', 'automatic-sms'].includes(payment.source)) {
        throw new HttpError(404, 'deposit_not_found', 'Unknown simulation deposit request.');
      }
      if (/^TEST-/i.test(payment.txRef)) {
        throw new HttpError(409, 'test_only_reference', 'TEST references must use the isolated test approval action.');
      }
      if (payment.status === 'success') return { status: 'success', credited: false };
      if (payment.source === 'automatic-sms' && payment.smsMatch?.status !== 'matched') throw new HttpError(409, 'sms_not_matched', 'A matching bank SMS must be received before approval.');
      if (payment.status !== 'pending') throw new HttpError(409, 'wrong_status', 'Deposit request is no longer pending.');
      const result = await repo.confirmDeposit({ txRef: payment.txRef, chapaRef: 'manual-admin' });
      if (result.credited) log('simulation_deposit_manually_approved', { txRef: payment.txRef, userId: payment.userId, etb: etb(payment.amount) });
      if (!result.credited) {
        const latest = await repo.getPayment(payment.txRef);
        if (latest?.status !== 'success') throw new HttpError(409, 'wrong_status', 'Deposit request has already been processed.');
      }
      return { status: 'success', credited: result.credited };
    },

    /** Mark a TEST-prefixed request as test-approved without crediting any wallet or ledger. */
    async testApproveSimulationDeposit(txRef) {
      const reference = String(txRef ?? '');
      const payment = await repo.getPayment(reference);
      if (!payment || !['manual-simulation', 'sms-simulation', 'automatic-sms'].includes(payment.source) || !/^TEST-/i.test(payment.txRef)) {
        throw new HttpError(404, 'test_deposit_not_found', 'Only TEST-prefixed simulation requests can use test approval.');
      }
      if (payment.status !== 'pending') throw new HttpError(409, 'wrong_status', 'Test request is no longer pending.');
      const updated = await repo.failPayment(payment.txRef, 'test-approved');
      if (!updated) throw new HttpError(409, 'wrong_status', 'Test request has already been processed.');
      log('simulation_deposit_test_approved_no_credit', { txRef: payment.txRef, userId: payment.userId, etb: etb(payment.amount) });
      return { status: 'test-approved', credited: false };
    },

    /** Reject a pending simulation request without changing the player's balance. */
    async rejectSimulationDeposit(txRef, note) {
      const payment = await repo.getPayment(String(txRef ?? ''));
      if (!payment || !['manual-simulation', 'sms-simulation', 'automatic-sms'].includes(payment.source)) {
        throw new HttpError(404, 'deposit_not_found', 'Unknown simulation deposit request.');
      }
      if (payment.status !== 'pending') throw new HttpError(409, 'wrong_status', 'Deposit request is no longer pending.');
      const rejected = await repo.failPayment(payment.txRef, 'rejected');
      if (!rejected) throw new HttpError(409, 'wrong_status', 'Deposit request has already been processed.');
      log('simulation_deposit_rejected', { txRef: payment.txRef, userId: payment.userId, note: String(note ?? '').slice(0, 120) });
      return { status: 'rejected' };
    },

    /** Match a trusted admin-phone SMS to a pending request. Matching never credits the wallet. */
    async matchSmsSimulationDeposit(event, metadata = {}) {
      const txRef = String(event.reference ?? '').trim();
      const amount = toSantim(event.amount);
      if (!txRef || !Number.isSafeInteger(amount) || amount <= 0) throw new HttpError(400, 'invalid_sms_event', 'Invalid bank SMS event.');
      if (String(event.status ?? '').toLowerCase() !== 'success' || String(event.currency ?? '').toUpperCase() !== 'ETB') throw new HttpError(400, 'invalid_sms_event', 'Only successful ETB bank credits can match a deposit request.');
      const receivedAt = Number(metadata.receivedAt ?? Date.now());
      const transactionAt = Number(event.transactionAt ?? receivedAt);
      const ageMs = Date.now() - transactionAt;
      const maxAgeMs = Number(config.smsMaxAgeMinutes ?? 1440) * 60_000;
      if (!Number.isFinite(transactionAt) || !Number.isFinite(receivedAt) || ageMs > maxAgeMs || ageMs < -5 * 60_000 || receivedAt > Date.now() + 5 * 60_000) {
        throw new HttpError(400, 'stale_sms', 'Bank SMS is too old or has an invalid timestamp.');
      }
      const result = await repo.recordSmsEventAndMatch({
        txRef, eventId: String(event.eventId ?? txRef).slice(0, 120), amount,
        provider: String(event.provider ?? 'unknown'), rawMessage: String(metadata.rawMessage ?? '').slice(0, 4000),
        transactionAt, receivedAt, sender: String(metadata.sender ?? '').slice(0, 80),
        recipientAccount: event.recipientAccount ?? null,
      });
      if (result.matched) log('admin_phone_sms_matched_deposit', { txRef, provider: event.provider, amount: etb(amount) });
      return { ...result, status: result.matched ? 'matched' : result.mismatch ? 'amount-mismatch' : 'unmatched' };
    },

    /** Legacy webhook is deliberately non-crediting; only an administrator can approve a matched request. */
    async confirmSmsSimulationDeposit(event) {
      return this.matchSmsSimulationDeposit(event, { rawMessage: event.rawMessage ?? '', sender: event.sender ?? '', receivedAt: Date.now() });
    },

    /** Step 1 of a deposit: record a pending payment and get the Chapa checkout link. */
    async startDeposit(user, amountEtb) {
      if (!config.realMoneyEnabled) throw new HttpError(503, 'real_money_disabled', 'Real-money deposits are not enabled yet.');
      const amount = toSantim(amountEtb);
      if (!Number.isFinite(amount) || amount < config.minDeposit || amount > config.maxDeposit) {
        throw new HttpError(400, 'invalid_amount', `Deposit between ${etb(config.minDeposit)} and ${etb(config.maxDeposit)} ETB`);
      }
      const txRef = `bgd-${Date.now().toString(36)}-${randomToken(6)}`;
      await repo.createPayment({ txRef, userId: user.id, amount });
      const { checkoutUrl } = await chapa.initialize({
        amount,
        txRef,
        user,
        returnUrl: `${config.clientUrl}/?tx_ref=${encodeURIComponent(txRef)}#wallet`,
        callbackUrl: `${config.publicApiUrl}/api/payments/chapa/callback`,
      });
      return { checkoutUrl, txRef };
    },

    /**
     * Step 2, called from the webhook, the callback and the return page. Safe to call any number of times:
     * the wallet is credited exactly once, and only after OUR OWN verify call to Chapa confirms
     * status, currency and amount.
     */
    async confirmDeposit(txRef) {
      const payment = await repo.getPayment(txRef);
      if (!payment) throw new HttpError(404, 'payment_not_found', 'Unknown payment reference');
      if (payment.status === 'success') return { status: 'success', credited: false };
      const v = await chapa.verify(txRef);
      if (v.status === 'success') {
        if (v.currency !== 'ETB' || v.amount !== payment.amount) {
          await repo.failPayment(txRef, 'amount_mismatch');
          console.error(`deposit ${txRef}: amount/currency mismatch (expected ${payment.amount} ETB-santim, got ${v.amount} ${v.currency})`);
          return { status: 'failed', credited: false };
        }
        try {
          const r = await repo.confirmDeposit({ txRef, chapaRef: v.chapaRef });
          if (r.credited) log('deposit_credited', { txRef, userId: payment.userId, etb: etb(payment.amount) });
          return { status: 'success', credited: r.credited };
        } catch (e) {
          if (e instanceof RepoError) throw new HttpError(404, 'payment_not_found', 'Unknown payment reference');
          throw e;
        }
      }
      if (v.status === 'failed') {
        await repo.failPayment(txRef, 'failed');
        return { status: 'failed', credited: false };
      }
      return { status: 'pending', credited: false };
    },

    async paymentStatus(user, txRef) {
      const p = await repo.getPayment(txRef);
      if (!p || p.userId !== user.id) throw new HttpError(404, 'payment_not_found', 'Unknown payment reference');
      return service.confirmDeposit(txRef);
    },

    /* ───────────── simulation-only withdrawal requests ───────────── */

    async requestSimulationWithdrawal(user, { amount, method, destination }) {
      const a = toSantim(amount);
      if (!Number.isSafeInteger(a) || a <= 0) throw new HttpError(400, 'invalid_amount', 'Enter a positive withdrawal amount.');
      const receiveMethod = String(method ?? '').trim().toLowerCase();
      if (receiveMethod && !['telebirr', 'bank'].includes(receiveMethod)) throw new HttpError(400, 'invalid_method', 'Choose Telebirr or Bank.');
      const target = String(destination ?? '').trim().slice(0, 80);
      const id = 'simwd-' + randomToken(10);
      let w;
      try {
        w = await repo.requestSimulationWithdrawal({ id, userId: user.id, amount: a, method: receiveMethod || '', destination: target });
      } catch (e) {
        if (e instanceof RepoError && e.code === 'INSUFFICIENT_FUNDS') throw new HttpError(402, 'insufficient_funds', 'Not enough simulation balance.');
        throw e;
      }
      log('simulation_withdrawal_requested', { id, userId: user.id, amount: etb(a), method: receiveMethod || 'unspecified', hasDestination: !!target });
      return { id: w.id, amount: etb(a), status: w.status, balance: (await repo.findUserById(user.id)).balance / 100 };
    },

    listMySimulationWithdrawals: (user) => repo.listSimulationWithdrawals({ userId: user.id }),
    listSimulationWithdrawals: (filter) => repo.listSimulationWithdrawals(filter),

    async approveSimulationWithdrawal(id, adminId) {
      const w = await repo.transitionSimulationWithdrawal(id, ['pending'], 'approved', { reviewedBy: adminId });
      if (!w) throw new HttpError(409, 'wrong_status', 'Withdrawal request is no longer pending.');
      log('simulation_withdrawal_admin_approved', { id, adminId, userId: w.userId, amount: etb(w.amount) });
      return { id, status: 'approved' };
    },

    async rejectSimulationWithdrawal(id, note, adminId) {
      const w = await repo.rejectSimulationWithdrawalAndRefund(id, String(note ?? '').slice(0, 200), adminId);
      if (!w) throw new HttpError(409, 'wrong_status', 'Withdrawal request is no longer pending.');
      log('simulation_withdrawal_admin_rejected_refunded', { id, adminId, userId: w.userId, amount: etb(w.amount) });
      return { id, status: 'rejected', refunded: true };
    },

    /* ───────────── manual real-wallet withdrawals ───────────── */

    async requestManualWithdrawal(user, { amount, method, destination }) {
      const a = toSantim(amount);
      if (!Number.isSafeInteger(a) || a < config.minWithdraw) {
        throw new HttpError(400, 'invalid_amount', `Minimum withdrawal is ${etb(config.minWithdraw)} ETB`);
      }
      const receiveMethod = String(method ?? '').trim().toLowerCase();
      if (!['telebirr', 'bank'].includes(receiveMethod)) {
        throw new HttpError(400, 'invalid_method', 'Choose Telebirr or Bank.');
      }
      const target = String(destination ?? '').trim().slice(0, 80);
      if (target.length < 5) throw new HttpError(400, 'invalid_destination', 'Enter a valid account or Telebirr number.');
      const id = 'mwd-' + randomToken(10);
      let w;
      try {
        w = await repo.requestManualWithdrawal({
          id, userId: user.id, amount: a, method: receiveMethod, destination: target,
        });
      } catch (e) {
        if (e instanceof RepoError && e.code === 'INSUFFICIENT_FUNDS') {
          throw new HttpError(402, 'insufficient_funds', 'Not enough wallet balance.');
        }
        throw e;
      }
      log('manual_withdrawal_requested', { id, userId: user.id, amount: etb(a), method: receiveMethod });
      return { id: w.id, amount: etb(a), status: w.status, balance: (await repo.findUserById(user.id)).balance / 100 };
    },

    listMyManualWithdrawals: (user) => repo.listManualWithdrawals({ userId: user.id, status: null }),
    listManualWithdrawals: (filter) => repo.listManualWithdrawals(filter),

    async startManualWithdrawal(id, adminId) {
      const w = await repo.transitionManualWithdrawal(id, ['pending'], 'processing', {
        processingBy: adminId, processingAt: new Date(),
      });
      if (!w) throw new HttpError(409, 'wrong_status', 'Manual withdrawal is no longer pending.');
      log('manual_withdrawal_processing_started', { id, adminId, userId: w.userId, amount: etb(w.amount) });
      return { id, status: 'processing' };
    },

    async confirmManualWithdrawal(id, { externalReference, method }, adminId) {
      const reference = String(externalReference ?? '').trim();
      const payoutMethod = String(method ?? '').trim().toLowerCase();
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{5,63}$/.test(reference)) {
        throw new HttpError(400, 'invalid_external_reference', 'Enter a valid external transaction reference.');
      }
      if (!['telebirr', 'bank'].includes(payoutMethod)) {
        throw new HttpError(400, 'invalid_method', 'Choose Telebirr or Bank.');
      }
      let w;
      try {
        w = await repo.confirmManualWithdrawal({ id, externalReference: reference, payoutMethod, adminId });
      } catch (e) {
        if (e?.code === 'EXTERNAL_PAYOUT_REFERENCE_TAKEN' || e?.code === 11000 || e?.errorResponse?.code === 11000) {
          throw new HttpError(409, 'external_reference_used', 'This external payout reference has already been used.');
        }
        throw e;
      }
      if (!w) throw new HttpError(409, 'wrong_status', 'Withdrawal must be processing before it can be confirmed as paid.');
      log('manual_withdrawal_paid_confirmed', { id, adminId, externalReference: reference, payoutMethod });
      return { id, status: 'paid', externalReference: reference, method: payoutMethod };
    },

    async rejectManualWithdrawal(id, note, adminId) {
      const w = await repo.rejectManualWithdrawalAndRefund(id, String(note ?? '').slice(0, 200), adminId);
      if (!w) throw new HttpError(409, 'wrong_status', 'Only a pending or processing manual withdrawal can be rejected and refunded.');
      log('manual_withdrawal_rejected_refunded', { id, adminId, userId: w.userId, amount: etb(w.amount) });
      return { id, status: 'rejected', refunded: true };
    },

    /* ───────────── cash-out ───────────── */

    async requestWithdrawal(user, { amount, accountName, accountNumber, bankCode }) {
      if (!config.realMoneyEnabled) throw new HttpError(503, 'real_money_disabled', 'Real-money cash-outs are not enabled yet.');
      const a = toSantim(amount);
      if (!Number.isFinite(a) || a < config.minWithdraw) throw new HttpError(400, 'invalid_amount', `Minimum cash-out is ${etb(config.minWithdraw)} ETB`);
      const name = String(accountName ?? '').trim().slice(0, 80);
      const number = String(accountNumber ?? '').replace(/\s/g, '').slice(0, 40);
      if (name.length < 2 || number.length < 5 || !/^\d+$/.test(String(bankCode ?? ''))) {
        throw new HttpError(400, 'invalid_account', 'Check the account name, number and bank');
      }
      const id = randomToken(8);
      let w;
      try {
        w = await repo.requestWithdrawal({ id, userId: user.id, amount: a, accountName: name, accountNumber: number, bankCode: String(bankCode) });
      } catch (e) {
        if (e instanceof RepoError && e.code === 'INSUFFICIENT_FUNDS') throw new HttpError(402, 'insufficient_funds', 'Not enough balance');
        throw e;
      }
      log('withdrawal_requested', { id, userId: user.id, etb: etb(a) });
      if (config.autoPayout) w = await service.approveWithdrawal(id).catch(() => w);
      return w;
    },

    myWithdrawals: (user) => repo.listWithdrawals({ userId: user.id }),

    /** Admin: send the money. pending -> processing -> paid (or failed + automatic refund). */
    async approveWithdrawal(id) {
      if (!config.realMoneyEnabled) throw new HttpError(503, 'real_money_disabled', 'Real-money payouts are not enabled yet.');
      const claimed = await repo.transitionWithdrawal(id, ['pending'], 'processing');
      if (!claimed) throw new HttpError(409, 'wrong_status', 'Withdrawal is not pending');
      try {
        const r = await chapa.transfer({
          accountName: claimed.accountName,
          accountNumber: claimed.accountNumber,
          amount: claimed.amount,
          reference: `wd-${id}`,
          bankCode: claimed.bankCode,
        });
        if (r.status === 'success') {
          log('withdrawal_paid', { id, etb: etb(claimed.amount) });
          return repo.transitionWithdrawal(id, ['processing'], 'paid');
        }
        if (r.status === 'failed') {
          const failed = await repo.transitionWithdrawalAndRefund(id, ['processing'], 'failed', { note: 'Transfer failed' });
          log('withdrawal_failed_refunded', { id });
          return failed;
        }
        return claimed; // still processing: use refreshWithdrawal later
      } catch (e) {
        // The request itself failed (network, bad bank code...). The money state is unknown, so keep it
        // 'processing' for an admin to check with refreshWithdrawal instead of refunding blindly.
        console.error(`withdrawal ${id}: transfer error`, e.message);
        return repo.transitionWithdrawal(id, ['processing'], 'processing', { note: `Error: ${e.message}`.slice(0, 200) });
      }
    },

    /** Admin: ask Chapa for the real outcome of a 'processing' payout. */
    async refreshWithdrawal(id) {
      const w = await repo.getWithdrawal(id);
      if (!w || w.status !== 'processing') throw new HttpError(409, 'wrong_status', 'Withdrawal is not processing');
      const r = await chapa.verifyTransfer(`wd-${id}`);
      if (r.status === 'success') return repo.transitionWithdrawal(id, ['processing'], 'paid');
      if (r.status === 'failed') {
        const failed = await repo.transitionWithdrawalAndRefund(id, ['processing'], 'failed', { note: 'Transfer failed' });
        return failed;
      }
      return w;
    },

    async rejectWithdrawal(id, note) {
      const w = await repo.transitionWithdrawalAndRefund(id, ['pending'], 'rejected', { note: String(note ?? '').slice(0, 200) });
      if (!w) throw new HttpError(409, 'wrong_status', 'Withdrawal is not pending');
      log('withdrawal_rejected_refunded', { id });
      return w;
    },

    listWithdrawals: (filter) => repo.listWithdrawals(filter),
  };
  return service;
}
