import { useAuth } from '@/context/AuthContext';
import { translations } from '@/lib/localization';
import { useLanguage } from '@/context/LanguageContext';

const TEXT = translations.account;

export function AccountPanel() {
  const { user, logout } = useAuth();
  const { lang } = useLanguage();
  if (!user) return null;
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-[1.35rem] border border-gold-500/20 bg-[#0b0b0b] p-4 shadow-[0_14px_40px_rgba(0,0,0,.24)] ring-1 ring-white/[0.035] sm:px-5">
      <div className="leading-tight">
        <p className="font-bold tracking-wide text-gold-200">{user.name}</p>
        <p className="mt-1 text-xs tabular-nums text-gold-600">{user.phone}</p>
      </div>
      <button type="button" onClick={logout} className="rounded-full px-4 py-2 text-sm font-semibold text-gold-300 ring-1 ring-gold-700/60">
        {TEXT[lang].out}
      </button>
    </section>
  );
}
