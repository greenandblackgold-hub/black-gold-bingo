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
import { useMemo, useState } from 'react';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useLanguage } from '@/context/LanguageContext';
import { usePlayer } from '@/context/PlayerContext';
import { useRound } from '@/context/RoundContext';
import { SERVER_MODE } from '@/lib/api';
import { AccountPanel } from '@/components/wallet/AccountPanel';
import { ChapaDepositPanel } from '@/components/wallet/ChapaDepositPanel';
import { WithdrawPanel } from '@/components/wallet/WithdrawPanel';
import type { Lang, PayMethod as Method } from '@/types/game';

/* ───────────────────────────── CONTEXT WIRING ───────────────────────────── */

function useWalletData() {
  const { lang } = useLanguage();
  const { cardPrice } = useAppSettings();
  const { balance, cards, transactions, deposit, buyCards } = usePlayer();
  return {
    lang: lang as Lang,
    cardPrice: cardPrice ?? 10,
    balance,
    ownedCount: cards.length,
    transactions: transactions ?? [],
    deposit,
    buyCards,
  };
}

/* ─────────────────────────── TRANSLATIONS ─────────────────────────── */
/* Tigrigna strings should be reviewed by a native speaker. */

const STRINGS = {
  am: {
    balance: 'ቀሪ ሂሳብ',
    owned: 'ያሉዎት ካርዶች',
    deposit: 'ገንዘብ ያስገቡ',
    method: 'የክፍያ መንገድ',
    telebirr: 'ቴሌብር',
    cbe: 'የኢትዮጵያ ንግድ ባንክ',
    amount: 'መጠን (ብር)',
    phone: 'የቴሌብር ስልክ ቁጥር',
    account: 'የባንክ ሂሳብ ቁጥር',
    continue: 'ቀጥል',
    confirm: 'አረጋግጥና አስገባ',
    back: 'ተመለስ',
    processing: 'ክፍያው በመከናወን ላይ…',
    success: 'ገንዘቡ ገቢ ሆኗል',
    reference: 'የማጣቀሻ ቁጥር',
    demo: 'ይህ የሙከራ ክፍያ ነው፤ እውነተኛ ገንዘብ አይንቀሳቀስም።',
    buy: 'ካርድ ይግዙ',
    price: 'የአንድ ካርድ ዋጋ',
    count: 'የካርድ ብዛት',
    total: 'ጠቅላላ',
    buyBtn: 'ካርዶቹን ግዛ',
    buying: 'በመግዛት ላይ…',
    bought: 'ካርዶቹ ተገዝተዋል',
    short: 'ቀሪ ሂሳብዎ በቂ አይደለም። ከላይ ገንዘብ ያስገቡ።',
    lockedMsg: 'ካርድ መግዛት የሚቻለው ዙሩ ከመጀመሩ በፊት ነው።',
    goPlay: 'ወደ ጨዋታ ሂድ',
    history: 'የቅርብ ግብይቶች',
    empty: 'እስካሁን ምንም ግብይት የለም',
    errPhone: 'ስልክ ቁጥሩ በ09 ወይም 07 ጀምሮ 10 አሃዝ መሆን አለበት',
    errAccount: 'የሂሳብ ቁጥሩ 13 አሃዝ መሆን አለበት',
    errAmount: 'መጠኑ ከ10 እስከ 10,000 ብር መሆን አለበት',
    etb: 'ብር',
    depositTx: 'ገቢ',
    purchaseTx: 'ካርድ ግዢ',
  },
  ti: {
    balance: 'ሽሕ ሒሳብ',
    owned: 'ዘለውኩም ካርዳት',
    deposit: 'ገንዘብ የእትዉ',
    method: 'መንገዲ ክፍሊት',
    telebirr: 'ቴሌብር',
    cbe: 'ንግዲ ባንክ ኢትዮጵያ',
    amount: 'መጠን (ብር)',
    phone: 'ቁጽሪ ተሌፎን ቴሌብር',
    account: 'ቁጽሪ ሒሳብ ባንክ',
    continue: 'ቀጽል',
    confirm: 'ኣረጋግጽን የእቱ',
    back: 'ተመለስ',
    processing: 'ክፍሊት ይካየድ ኣሎ…',
    success: 'ገንዘብ ኣትዩ',
    reference: 'ቁጽሪ ምጥቃስ',
    demo: 'እዚ ናይ ፈተነ ክፍሊት እዩ፤ ሓቀኛ ገንዘብ ኣይንቀሳቐስን።',
    buy: 'ካርድ ግዝኡ',
    price: 'ዋጋ ሓደ ካርድ',
    count: 'ብዝሒ ካርድ',
    total: 'ድምር',
    buyBtn: 'ካርዳት ግዛእ',
    buying: 'ይግዛእ ኣሎ…',
    bought: 'ካርዳት ተገዚኦም',
    short: 'ሒሳብኩም ኣይኣክልን። ኣብ ላዕሊ ገንዘብ የእትዉ።',
    lockedMsg: 'ካርድ ምግዛእ ዙር ቅድሚ ምጅማሩ እዩ ዝከኣል።',
    goPlay: 'ናብ ጸወታ ኺድ',
    history: 'ናይ ቀረባ መዘወዚታት',
    empty: 'ክሳብ ሕጂ ዝኾነ መዘወዚ የለን',
    errPhone: 'ቁጽሪ ተሌፎን ብ09 ወይ 07 ጀሚሩ 10 ኣሃዝ ክኸውን ኣለዎ',
    errAccount: 'ቁጽሪ ሒሳብ 13 ኣሃዝ ክኸውን ኣለዎ',
    errAmount: 'መጠን ካብ 10 ክሳብ 10,000 ብር ክኸውን ኣለዎ',
    etb: 'ብር',
    depositTx: 'ኣታዊ',
    purchaseTx: 'ግዛእ ካርድ',
  },
  en: {
    balance: 'Balance',
    owned: 'Cards you own',
    deposit: 'Add money',
    method: 'Pay with',
    telebirr: 'Telebirr',
    cbe: 'Commercial Bank of Ethiopia',
    amount: 'Amount (ETB)',
    phone: 'Telebirr phone number',
    account: 'CBE account number',
    continue: 'Continue',
    confirm: 'Confirm and deposit',
    back: 'Back',
    processing: 'Processing payment…',
    success: 'Deposit received',
    reference: 'Reference',
    demo: 'This is a demo payment. No real money moves.',
    buy: 'Buy cards',
    price: 'Price per card',
    count: 'Number of cards',
    total: 'Total',
    buyBtn: 'Buy cards',
    buying: 'Buying…',
    bought: 'Cards purchased',
    short: "Your balance doesn't cover this. Add money above.",
    lockedMsg: 'Cards can only be bought before a round starts.',
    goPlay: 'Go to play',
    history: 'Recent activity',
    empty: 'No activity yet',
    errPhone: 'Enter 10 digits starting with 09 or 07',
    errAccount: 'Account number must be 13 digits',
    errAmount: 'Amount must be between 10 and 10,000 ETB',
    etb: 'ETB',
    depositTx: 'Deposit',
    purchaseTx: 'Card purchase',
  },
} as const;

type StringKey = keyof (typeof STRINGS)['en'];

/* ───────────────────────────── HELPERS ───────────────────────────── */

const QUICK_AMOUNTS = [50, 100, 200, 500];
const MIN_DEPOSIT = 10;
const MAX_DEPOSIT = 10000;
const MAX_CARDS = 20;

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

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
}: {
  t: (k: StringKey) => string;
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
    <section className="rounded-2xl bg-cardbg p-4 ring-1 ring-gold-700/50 sm:p-5">
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
              <dd className="text-lg font-black tabular-nums text-gold-400">{fmt(amount)}</dd>
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
            +{fmt(amount)} <span className="text-base font-semibold text-gold-500">{t('etb')}</span>
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
}: {
  t: (k: StringKey) => string;
  price: number;
  balance: number;
  onBuy: (count: number) => Promise<{ ok: boolean; error?: string }>;
  onGoToPlay?: () => void;
  locked: boolean;
}) {
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const total = count * price;
  const short = total > balance;

  const buy = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await onBuy(count);
      setResult({ ok: res.ok, text: res.ok ? t('bought') : res.error ?? t('short') });
    } catch {
      setResult({ ok: false, text: t('short') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl bg-cardbg p-4 ring-1 ring-gold-700/50 sm:p-5">
      <h2 className="mb-4 text-lg font-bold text-gold-300">{t('buy')}</h2>

      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="text-gold-500">{t('price')}</span>
        <span className="font-semibold tabular-nums text-gold-300">
          {fmt(price)} {t('etb')}
        </span>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-gold-500" id="count-label">
          {t('count')}
        </span>
        <div className="flex items-center gap-3" role="group" aria-labelledby="count-label">
          <button
            type="button"
            aria-label="−"
            disabled={count <= 1}
            onClick={() => setCount((c) => Math.max(1, c - 1))}
            className="h-11 w-11 rounded-full bg-white/[0.06] text-2xl font-bold text-gold-300 ring-1 ring-gold-700/50 active:scale-90 disabled:opacity-40"
          >
            −
          </button>
          <span className="w-8 text-center text-2xl font-black tabular-nums text-gold-400" aria-live="polite">
            {count}
          </span>
          <button
            type="button"
            aria-label="+"
            disabled={count >= MAX_CARDS}
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
          {fmt(total)} <span className="text-sm font-semibold text-gold-500">{t('etb')}</span>
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

      <button type="button" onClick={buy} disabled={busy || short || locked} className={primaryBtn}>
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
  const { lang, cardPrice, balance, ownedCount, transactions, deposit, buyCards } = useWalletData();
  const t = (k: StringKey) => (STRINGS[lang] ?? STRINGS.en)[k];
  const { phase } = useRound();

  const recent = useMemo(() => [...transactions].sort((a, b) => b.at - a.at).slice(0, 8), [transactions]);

  return (
    <div className="space-y-5">
      {/* Balance */}
      <section className="rounded-3xl bg-gradient-to-br from-gold-700/40 via-cardbg to-cardbg p-5 ring-1 ring-gold-500/60 sm:p-7">
        <p className="text-sm text-gold-300">{t('balance')}</p>
        <p className="mt-1 text-5xl font-black tabular-nums text-gold-400 sm:text-6xl" aria-live="polite">
          {fmt(balance)}
          <span className="ml-2 text-xl font-bold text-gold-500">{t('etb')}</span>
        </p>
        <p className="mt-3 text-sm text-gold-500">
          {t('owned')}: <span className="font-bold tabular-nums text-gold-300">{ownedCount}</span>
        </p>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        {SERVER_MODE ? <ChapaDepositPanel /> : <DepositPanel t={t} onDeposit={deposit} />}
        <PurchasePanel t={t} price={cardPrice} balance={balance} onBuy={buyCards} onGoToPlay={onGoToPlay} locked={phase !== 'waiting'} />
      </div>

      {SERVER_MODE && <WithdrawPanel />}

      {/* History */}
      <section className="rounded-2xl bg-cardbg p-4 ring-1 ring-gold-700/50 sm:p-5">
        <h2 className="mb-3 text-lg font-bold text-gold-300">{t('history')}</h2>
        {recent.length === 0 ? (
          <p className="py-4 text-center text-sm text-gold-700">{t('empty')}</p>
        ) : (
          <ul className="divide-y divide-gold-700/30">
            {recent.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-semibold text-gold-300">
                    {tx.label ?? (tx.kind === 'deposit' ? t('depositTx') : t('purchaseTx'))}
                  </p>
                  <p className="text-xs text-gold-700">{new Date(tx.at).toLocaleString()}</p>
                </div>
                <p
                  className={[
                    'font-bold tabular-nums',
                    tx.amount >= 0 ? 'text-gold-400' : 'text-gold-600',
                  ].join(' ')}
                >
                  {tx.amount >= 0 ? '+' : '−'}
                  {fmt(Math.abs(tx.amount))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      {SERVER_MODE && <AccountPanel />}
    </div>
  );
}

export default WalletView;
