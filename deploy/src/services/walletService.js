import { randomToken } from '../util/crypto.js';
import { HttpError, RepoError } from '../util/errors.js';
import { log } from '../util/log.js';

const etb = (santim) => santim / 100;
const toSantim = (etbAmount) => Math.round(Number(etbAmount) * 100);

export function createWalletService({ repo, config, chapa }) {
  const service = {
    /** Step 1 of a deposit: record a pending payment and get the Chapa checkout link. */
    async startDeposit(user, amountEtb) {
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

    /* ───────────── cash-out ───────────── */

    async requestWithdrawal(user, { amount, accountName, accountNumber, bankCode }) {
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
          const failed = await repo.transitionWithdrawal(id, ['processing'], 'failed', { note: 'Transfer failed' });
          await repo.refundWithdrawal(id);
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
        const failed = await repo.transitionWithdrawal(id, ['processing'], 'failed', { note: 'Transfer failed' });
        await repo.refundWithdrawal(id);
        return failed;
      }
      return w;
    },

    async rejectWithdrawal(id, note) {
      const w = await repo.transitionWithdrawal(id, ['pending'], 'rejected', { note: String(note ?? '').slice(0, 200) });
      if (!w) throw new HttpError(409, 'wrong_status', 'Withdrawal is not pending');
      await repo.refundWithdrawal(id);
      log('withdrawal_rejected_refunded', { id });
      return w;
    },

    listWithdrawals: (filter) => repo.listWithdrawals(filter),
  };
  return service;
}
