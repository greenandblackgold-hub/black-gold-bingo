import { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { api, ApiError } from '@/lib/api';

const TEXT = {
  am: { title: 'ገንዘብ ያስገቡ', amount: 'መጠን (ብር)', pay: 'በ Chapa ይክፈሉ', busy: 'በመጠበቅ ላይ…', info: 'ወደ Chapa የክፍያ ገጽ ይወሰዳሉ፤ ቴሌብር፣ ሲቢኢ ብር እና ሌሎች አማራጮች አሉ። ክፍያው ከተረጋገጠ በኋላ ቦርሳዎ ይሞላል።', range: 'መጠኑ ከ10 እስከ 10,000 ብር መሆን አለበት', fail: 'ክፍያውን መጀመር አልተቻለም። እንደገና ይሞክሩ።' },
  ti: { title: 'ገንዘብ የእትዉ', amount: 'መጠን (ብር)', pay: 'ብ Chapa ክፈሉ', busy: 'ይጽበ ኣሎ…', info: 'ናብ ገጽ ክፍሊት Chapa ይወስድኩም፤ ቴሌብር፣ ሲቢኢ ብር ከምኡ’ውን ካልኦት ኣማራጺታት ኣለዉ። ክፍሊት ምስ ተረጋገጸ ቦርሳኹም ይመልእ።', range: 'መጠን ካብ 10 ክሳብ 10,000 ብር ክኸውን ኣለዎ', fail: 'ክፍሊት ምጅማር ኣይተኻኣለን። ደጊምኩም ፈትኑ።' },
  en: { title: 'Add money', amount: 'Amount (ETB)', pay: 'Pay with Chapa', busy: 'Please wait…', info: 'You will be taken to Chapa’s secure checkout (Telebirr, CBE Birr and other options). Your wallet is topped up once the payment is confirmed.', range: 'Amount must be between 10 and 10,000 ETB', fail: 'Couldn’t start the payment. Try again.' },
} as const;

const QUICK = [50, 100, 200, 500];

export function ChapaDepositPanel() {
  const { lang } = useLanguage();
  const t = TEXT[lang];
  const [amount, setAmount] = useState('100');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 10 || n > 10000) {
      setError(t.range);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ checkoutUrl: string }>('/api/payments/deposit', { amount: n });
      window.location.assign(r.checkoutUrl);
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'invalid_amount' ? t.range : t.fail);
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl bg-cardbg p-4 ring-1 ring-gold-700/50 sm:p-5">
      <h2 className="mb-4 text-lg font-bold text-gold-300">{t.title}</h2>
      <label htmlFor="chapa-amount" className="mb-2 block text-sm text-gold-500">{t.amount}</label>
      <input
        id="chapa-amount"
        inputMode="numeric"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
        className="w-full rounded-xl bg-white/[0.05] px-4 py-3 text-gold-300 ring-1 ring-gold-700/50 focus:outline-none focus:ring-2 focus:ring-gold-400"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <button key={q} type="button" onClick={() => setAmount(String(q))} className="rounded-full bg-white/[0.05] px-3.5 py-1.5 text-sm font-semibold tabular-nums text-gold-300 ring-1 ring-gold-700/40 active:scale-95">
            {q}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      )}
      <button type="button" disabled={busy} onClick={() => void pay()} className="mt-4 w-full rounded-xl bg-gradient-to-br from-gold-300 via-gold-500 to-gold-600 py-3.5 font-bold text-darkbg active:scale-[0.98] disabled:opacity-50">
        {busy ? t.busy : t.pay}
      </button>
      <p className="mt-3 text-xs text-gold-700">{t.info}</p>
    </section>
  );
}
