import { useState, type FormEvent } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { api, ApiError } from '@/lib/api';

const TEXT = {
  am: {
    title: 'በChapa ገንዘብ ያስገቡ',
    amount: 'የሚያስገቡት መጠን (ብር)',
    pay: 'ወደ ደህንነቱ የተጠበቀ ክፍያ ይቀጥሉ',
    waiting: 'በመጠበቅ ላይ…',
    note: 'ክፍያው በChapa የራሱ የክፍያ ገጽ ይፈጸማል። ክፍያ ከተረጋገጠ ብቻ ቦርሳዎ ይሞላል።',
    disabled: 'እውነተኛ ክፍያ ለጊዜው አልተከፈተም።',
    error: 'ክፍያውን መጀመር አልተቻለም። እባክዎ ቆይተው ይሞክሩ።',
  },
  ti: {
    title: 'ብChapa ገንዘብ የእትዉ',
    amount: 'መጠን (ብር)',
    pay: 'ናብ ውሑስ ክፍሊት ቀጽሉ',
    waiting: 'ይጽበ ኣሎ…',
    note: 'ክፍሊት ብChapa ኣብ ውሑስ ገጽ ይፍጸም። ክፍሊት ምስ ተረጋገጸ ጥራይ ቦርሳኹም ይመልእ።',
    disabled: 'ሓቀኛ ክፍሊት ንግዚኡ ኣይተኸፍተን።',
    error: 'ክፍሊት ምጅማር ኣይተኻእለን። ደጊምኩም ፈትኑ።',
  },
  en: {
    title: 'Add funds with Chapa',
    amount: 'Amount (ETB)',
    pay: 'Continue to secure checkout',
    waiting: 'Please wait…',
    note: 'Payment takes place on Chapa’s hosted checkout page. Your wallet is credited only after the server verifies the payment.',
    disabled: 'Real-money payments are not enabled yet.',
    error: 'Could not start the payment. Please try again later.',
  },
} as const;

export function ChapaDepositPanel() {
  const { lang } = useLanguage();
  const t = TEXT[lang];
  const [amount, setAmount] = useState('50');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api.post<{ checkoutUrl: string; txRef: string }>('/api/payments/deposit', {
        amount: Number(amount),
      });
      if (!result.checkoutUrl || !/^https:\/\//i.test(result.checkoutUrl)) {
        throw new Error(t.error);
      }
      window.location.assign(result.checkoutUrl);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'real_money_disabled') setError(t.disabled);
      else setError(err instanceof ApiError ? err.message : t.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gold-700/50 bg-cardbg p-5">
      <h2 className="mb-3 text-lg font-bold text-gold-300">{t.title}</h2>
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-950/50 p-3 text-sm text-red-200">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <label htmlFor="chapa-amount" className="block text-sm text-gold-500">{t.amount}</label>
        <input
          id="chapa-amount"
          type="number"
          inputMode="decimal"
          min="10"
          max="10000"
          step="0.01"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="w-full rounded-xl bg-white/[0.05] px-4 py-3 text-gold-300 ring-1 ring-gold-700/50 focus:outline-none focus:ring-2 focus:ring-gold-400"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-br from-gold-300 via-gold-500 to-gold-600 py-3 font-bold text-darkbg disabled:opacity-50"
        >
          {loading ? t.waiting : t.pay}
        </button>
      </form>
      <p className="mt-3 text-xs leading-relaxed text-gold-700">{t.note}</p>
    </section>
  );
}
