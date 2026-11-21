/**
 * src/components/wallet/WalletView.tsx
 *
 * Wallet screen: ETB balance, mock Telebirr / CBE deposits, card purchasing,
 * and recent transactions. Reads from usePlayer() and useAppSettings();
 * shared types live in '@/types/game'.
 *
 * The deposit is a DEMO: nothing leaves the device. Replace `runMockPayment`
 * with your real payment API call when you integrate Telebirr / CBE.
 */
import { useState } from 'react';
import { translations, formatAmount, formatNumber } from '@/lib/localization';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useLanguage } from '@/context/LanguageContext';
import { usePlayer } from '@/context/PlayerContext';
import { useRound } from '@/context/RoundContext';
import { SERVER_MODE } from '@/lib/api';
import { SimulationWithdrawalPanel } from '@/components/wallet/SimulationWithdrawalPanel';
import { AccountPanel } from '@/components/wallet/AccountPanel';
import { SmsDepositPanel } from '@/components/wallet/SmsDepositPanel';
import type { Lang, PayMethod as Method } from '@/types/game';

/* ───────────────────────────── CONTEXT WIRING ───────────────────────────── */

function useWalletData() {
  const { lang } = useLanguage();
  const { cardPrice } = useAppSettings();
  const { balance, cards, deposit, buyCards } = usePlayer();
  return {
    lang: lang as Lang,
    cardPrice: cardPrice ?? 10,
    balance,
    ownedCount: cards.length,
    deposit,
    buyCards,
  };
}

/* ─────────────────────────── TRANSLATIONS ─────────────────────────── */
/* Tigrigna strings should be reviewed by a native speaker. */

const STRINGS = translations.wallet;

type StringKey = keyof (typeof STRINGS)['en'];

/* ───────────────────────────── HELPERS ───────────────────────────── */

const QUICK_AMOUNTS = [50, 100, 200, 500];
const MIN_DEPOSIT = 10;
const MAX_DEPOSIT = 10000;
const MAX_CARDS = 20;



/** DEMO ONLY: replace with the real Telebirr / CBE request. */
async function runMockPayment(): Promise<string> {
  await new Promise((r) => setTimeout(r, 1800));
  return `BG-${Date.now().toString(36).toUpperCase()}`;
}

const inputCls =
  'w-full rounded-xl bg-white/[0.05] px-4 py-3 text-gold-300 placeholder:text-gold-700 ' +
  'ring-1 ring-gold-700/50 focus:outline-none focus:ring-2 focus:ring-gold-400';

const primaryBtn =
  'w-full rounded-xl bg-gradient-to-br from-gold-300 via-gold-500 to-gold-600 py-3.5 font-bold text-darkbg ' +
  'active:scale-[0.98] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300';

/* ───────────────────────────── DEPOSIT PANEL ───────────────────────────── */

type Stage = 'form' | 'confirm' | 'processing' | 'done';

function DepositPanel({
  t,
  onDeposit,
  formatAmount,
}: {
  t: (k: StringKey) => string;
  formatAmount: (n: number) => string;
  onDeposit: (amount: number, method: Method, ref: string) => Promise<void>;
}) {
  const [method, setMethod] = useState<Method>('telebirr');
  const [amountText, setAmountText] = useState('100');
  const [identifier, setIdentifier] = useState('');
  const [stage, setStage] = useState<Stage>('form');
  const [ref, setRef] = useState('');
  const [error, setError] = useState<string | null>(null);

  const amount = Number(amountText);

  const validate = (): string | null => {
    if (!Number.isFinite(amount) || amount < MIN_DEPOSIT || amount > MAX_DEPOSIT) return t('errAmount');
    if (method === 'telebirr' && !/^(09|07)\d{8}$/.test(identifier)) return t('errPhone');
    if (method === 'cbe' && !/^\d{13}$/.test(identifier)) return t('errAccount');
    return null;
  };

  const next = () => {
    const err = validate();
    setError(err);
    if (!err) setStage('confirm');
  };

  const submit = async () => {
    setStage('processing');
    const reference = await runMockPayment();
    await onDeposit(amount, method, reference);
    setRef(reference);
    setStage('done');
  };

  const reset = () => {
    setStage('form');
    setIdentifier('');
    setError(null);
  };

  const methodLabel = method === 'telebirr' ? t('telebirr') : t('cbe');

  return (
    <section className="rounded-2xl border border-gold-700/30 bg-gradient-to-b from-[#17140e] to-[#0b0b0a] p-4 shadow-[0_18px_44px_rgba(0,0,0,.24)] sm:p-5">
      <h2 className="mb-4 text-lg font-bold text-gold-300">{t('deposit')}</h2>

      {stage === 'form' && (
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm text-gold-500">{t('method')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['telebirr', 'cbe'] as Method[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={method === m}
                  onClick={() => {
                    setMethod(m);
                    setIdentifier('');
                    setError(null);
                  }}
                  className={[
                    'rounded-xl px-3 py-3 text-sm font-semibold ring-1 transition-colors',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300',
                    method === m
                      ? 'bg-gold-500/15 text-gold-300 ring-gold-400'
                      : 'bg-white/[0.03] text-gold-500 ring-gold-700/40',
                  ].join(' ')}
                >
                  {m === 'telebirr' ? t('telebirr') : t('cbe')}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="dep-amount" className="mb-2 block text-sm text-gold-500">
              {t('amount')}
            </label>
            <input
              id="dep-amount"
              inputMode="numeric"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value.replace(/\D/g, ''))}
              className={inputCls}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmountText(String(q))}
                  className="rounded-full bg-white/[0.05] px-3.5 py-1.5 text-sm font-semibold tabular-nums text-gold-300 ring-1 ring-gold-700/40 active:scale-95"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="dep-id" className="mb-2 block text-sm text-gold-500">
              {method === 'telebirr' ? t('phone') : t('account')}
            </label>
            <input
              id="dep-id"
              inputMode="numeric"
              maxLength={method === 'telebirr' ? 10 : 13}
              placeholder={method === 'telebirr' ? '09XXXXXXXX' : '1000XXXXXXXXX'}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value.replace(/\D/g, ''))}
              className={inputCls}
              aria-invalid={!!error}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}
          <button type="button" onClick={next} className={primaryBtn}>
            {t('continue')}
          </button>
          <p className="text-center text-xs text-gold-700">{t('demo')}</p>
        </div>
      )}

      {stage === 'confirm' && (
        <div className="space-y-4">
          <dl className="space-y-2 rounded-xl bg-white/[0.04] p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-gold-500">{t('method')}</dt>
              <dd className="font-semibold text-gold-300">{methodLabel}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gold-500">{method === 'telebirr' ? t('phone') : t('account')}</dt>
              <dd className="font-semibold tabular-nums text-gold-300">{identifier}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gold-500">{t('amount')}</dt>
              <dd className="text-lg font-black tabular-nums text-gold-400">{formatAmount(amount)}</dd>
            </div>
          </dl>
          <button type="button" onClick={submit} className={primaryBtn}>
            {t('confirm')}
          </button>
          <button
            type="button"
            onClick={() => setStage('form')}
            className="w-full py-2 text-sm font-medium text-gold-500 hover:text-gold-300"
          >
            {t('back')}
          </button>
        </div>
      )}

      {stage === 'processing' && (
        <div className="flex flex-col items-center gap-4 py-8" role="status" aria-live="polite">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gold-700 border-t-gold-400 motion-reduce:animate-none" />
          <p className="text-gold-300">{t('processing')}</p>
        </div>
      )}

      {stage === 'done' && (
        <div className="space-y-4 py-2 text-center" role="status" aria-live="polite">
          <p className="text-xl font-black text-gold-400">{t('success')}</p>
          <p className="text-3xl font-black tabular-nums text-gold-300">
            +{formatAmount(amount)} <span className="text-base font-semibold text-gold-500">{t('etb')}</span>
          </p>
          <p className="text-sm text-gold-500">
            {t('reference')}: <span className="font-mono text-gold-300">{ref}</span>
          </p>
          <button type="button" onClick={reset} className={primaryBtn}>
            {t('deposit')}
          </button>
        </div>
      )}
    </section>
  );
}

/* ───────────────────────────── PURCHASE PANEL ───────────────────────────── */

function PurchasePanel({
  t,
  price,
  balance,
  onBuy,
  onGoToPlay,
  locked,
  formatAmount,
  formatNumber,
}: {
  t: (k: StringKey) => string;
  formatAmount: (n: number) => string;
  formatNumber: (n: number) => string;
  price: number;
  balance: number;
  onBuy: (count: number, serial?: string) => Promise<{ ok: boolean; error?: string }>;
  onGoToPlay?: () => void;
  locked: boolean;
}) {
  const [count, setCount] = useState(1);
  const [cardNumber, setCardNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const total = count * price;
  const short = total > balance;

  const buy = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await onBuy(count, cardNumber || undefined);
      setResult({ ok: res.ok, text: res.ok ? t('bought') : res.error ?? t('short') });
    } catch {
      setResult({ ok: false, text: t('short') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gold-700/30 bg-gradient-to-b from-[#17140e] to-[#0b0b0a] p-4 shadow-[0_18px_44px_rgba(0,0,0,.24)] sm:p-5">
      <h2 className="mb-4 text-lg font-bold text-gold-300">{t('buy')}</h2>

      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="text-gold-500">{t('price')}</span>
        <span className="font-semibold tabular-nums text-gold-300">
          {formatAmount(price)} {t('etb')}
        </span>
      </div>

      <div className="mb-4">
        <label htmlFor="chosen-card-number" className="mb-2 block text-sm text-gold-500">{t('chosenCard')}</label>
        <input id="chosen-card-number" inputMode="numeric" maxLength={5} placeholder={t('chosenCardPlaceholder')} value={cardNumber}
          onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 5); setCardNumber(v); if (v) setCount(1); }}
          className={inputCls} />
        <p className="mt-1 text-xs text-gold-700">{t('chosenCardHelp')}</p>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-gold-500" id="count-label">
          {t('count')}
        </span>
        <div className="flex items-center gap-3" role="group" aria-labelledby="count-label">
          <button
            type="button"
            aria-label="−"
            disabled={count <= 1 || !!cardNumber}
            onClick={() => setCount((c) => Math.max(1, c - 1))}
            className="h-11 w-11 rounded-full bg-white/[0.06] text-2xl font-bold text-gold-300 ring-1 ring-gold-700/50 active:scale-90 disabled:opacity-40"
          >
            −
          </button>
          <span className="w-8 text-center text-2xl font-black tabular-nums text-gold-400" aria-live="polite">
            {formatNumber(count)}
          </span>
          <button
            type="button"
            aria-label="+"
            disabled={count >= MAX_CARDS || !!cardNumber}
            onClick={() => setCount((c) => Math.min(MAX_CARDS, c + 1))}
            className="h-11 w-11 rounded-full bg-white/[0.06] text-2xl font-bold text-gold-300 ring-1 ring-gold-700/50 active:scale-90 disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-baseline justify-between border-t border-gold-700/40 pt-4">
        <span className="text-gold-500">{t('total')}</span>
        <span className="text-2xl font-black tabular-nums text-gold-400">
          {formatAmount(total)} <span className="text-sm font-semibold text-gold-500">{t('etb')}</span>
        </span>
      </div>

      {locked && (
        <p role="status" className="mb-3 text-sm text-gold-500">
          {t('lockedMsg')}
        </p>
      )}

      {short && (
        <p role="alert" className="mb-3 text-sm text-red-300">
          {t('short')}
        </p>
      )}

      <button type="button" onClick={buy} disabled={busy || short || locked || (!!cardNumber && cardNumber.length !== 5)} className={primaryBtn}>
        {busy ? t('buying') : t('buyBtn')}
      </button>

      {result && (
        <div role="status" className="mt-3 space-y-2 text-center">
          <p className={result.ok ? 'font-semibold text-gold-400' : 'text-sm text-red-300'}>{result.text}</p>
          {result.ok && onGoToPlay && (
            <button type="button" onClick={onGoToPlay} className="text-sm font-semibold text-gold-300 underline underline-offset-4">
              {t('goPlay')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/* ───────────────────────────── MAIN VIEW ───────────────────────────── */

export function WalletView({ onGoToPlay }: { onGoToPlay?: () => void }) {
  const { lang, cardPrice, balance, ownedCount, deposit, buyCards } = useWalletData();
  const t = (k: StringKey) => (STRINGS[lang] ?? STRINGS.en)[k];
  const fmt = (n: number) => formatAmount(lang, n);
  const fmtNumber = (n: number) => formatNumber(lang, n);
  const { phase } = useRound();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 pb-4 sm:space-y-5">
      {/* Balance */}
      <section className="relative isolate overflow-hidden rounded-3xl border border-gold-400/30 bg-[radial-gradient(ellipse_at_top_right,rgba(214,173,69,.18),transparent_55%),linear-gradient(135deg,#201a0d_0%,#11100c_48%,#090909_100%)] p-5 shadow-[0_22px_55px_rgba(0,0,0,.34)] sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full border-[22px] border-gold-300/[0.06]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[.28em] text-gold-500">BLACK GOLD BINGO</p>
            <p className="mt-2 text-sm font-semibold text-gold-300">{t('balance')}</p>
            <p className="mt-1 break-words text-4xl font-black tracking-tight tabular-nums text-gold-200 sm:text-5xl" aria-live="polite">
              {fmt(balance)}
              <span className="ml-2 text-base font-bold text-gold-500 sm:text-lg">{t('etb')}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-gold-400/20 bg-black/30 px-3 py-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold-400/10 text-gold-300" aria-hidden="true">▦</span>
            <span>
              <span className="block text-[10px] text-gold-600">{t('owned')}</span>
              <span className="block text-lg font-black tabular-nums text-gold-200">{formatNumber(lang, ownedCount)}</span>
            </span>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-5">
        <div className="min-w-0">{SERVER_MODE ? <SmsDepositPanel /> : <DepositPanel t={t} formatAmount={fmt} onDeposit={deposit} />}</div>
        <div className="min-w-0"><PurchasePanel t={t} formatAmount={fmt} formatNumber={fmtNumber} price={cardPrice} balance={balance} onBuy={buyCards} onGoToPlay={onGoToPlay} locked={phase !== 'waiting'} /></div>
        {SERVER_MODE && <div className="min-w-0 lg:col-span-2"><SimulationWithdrawalPanel /></div>}
      </div>

      {SERVER_MODE && <div className="border-t border-gold-700/25 pt-3"><AccountPanel /></div>}
    </div>
  );
}

export default WalletView;
