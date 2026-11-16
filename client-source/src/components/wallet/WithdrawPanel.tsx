import { useLanguage } from '@/context/LanguageContext';

const copy = {
  am: {
    title: 'ገንዘብ ማውጣት',
    notice: 'የሙከራ ባላንስ ገንዘብ ማውጣት አይፈቅድም።',
  },
  ti: {
    title: 'ምውጻእ ገንዘብ',
    notice: 'ሚዛን ፈተነ ገንዘብ ምውጻእ ኣይፈቅድን።',
  },
  en: {
    title: 'Cash out',
    notice: 'Test credits cannot be withdrawn.',
  },
} as const;

export function WithdrawPanel() {
  const { lang } = useLanguage();
  const t = copy[lang] ?? copy.en;

  return (
    <section className="rounded-2xl border border-gold-700/35 bg-gradient-to-r from-white/[0.045] to-transparent px-4 py-4 shadow-[0_12px_35px_rgba(0,0,0,0.18)] sm:px-5" aria-labelledby="simulation-cashout-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="simulation-cashout-title" className="text-sm font-semibold text-gold-300">{t.title}</h2>
        <p role="note" className="text-xs leading-relaxed text-gold-400">{t.notice}</p>
      </div>
    </section>
  );
}
