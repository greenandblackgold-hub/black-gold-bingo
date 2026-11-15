import { useLanguage } from '@/context/LanguageContext';

const copy = {
  am: {
    title: 'የሲሙሌሽን ቦርሳ ማውጫ',
    notice: 'የገንዘብ ማውጣት በዚህ የሙከራ ስሪት አልተከፈተም። ምንም እውነተኛ ገንዘብ ወደ ባንክ ወይም ቴሌብር አይላክም።',
    detail: 'የቦርሳ ባላንስ ለሙከራ ብቻ ነው፤ ሊወጣ ወይም ሊከፈል አይችልም።',
  },
  ti: {
    title: 'ምውጻእ ናይ ሲሙሌሽን ቦርሳ',
    notice: 'ምውጻእ ገንዘብ ኣብዚ ናይ ፈተነ ስሪት ኣይተኸፍተን። ሓቀኛ ገንዘብ ናብ ባንኪ ወይ ቴሌብር ኣይለኣኽን።',
    detail: 'ሚዛን ቦርሳ ንፈተነ ጥራይ እዩ፤ ክወጽእ ወይ ክኽፈል ኣይክእልን።',
  },
  en: {
    title: 'Simulation wallet cash-out',
    notice: 'Cash-outs are not available in this test version. No real money is sent to a bank or Telebirr account.',
    detail: 'Wallet balances are test credits only; they cannot be withdrawn or paid out.',
  },
} as const;

export function WithdrawPanel() {
  const { lang } = useLanguage();
  const t = copy[lang] ?? copy.en;

  return (
    <section className="rounded-2xl border border-gold-700/50 bg-cardbg p-5" aria-labelledby="simulation-cashout-title">
      <h2 id="simulation-cashout-title" className="mb-3 text-lg font-bold text-gold-300">{t.title}</h2>
      <p role="note" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-200">
        {t.notice}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-gold-500">{t.detail}</p>
    </section>
  );
}
