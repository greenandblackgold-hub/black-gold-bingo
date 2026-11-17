import { useAuth } from '@/context/AuthContext';
import { translations } from '@/lib/localization';
import { useLanguage } from '@/context/LanguageContext';

const TEXT = translations.account;

export function AccountPanel() {
  const { user, logout } = useAuth();
  const { lang } = useLanguage();
  if (!user) return null;
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-700/25 bg-cardbg p-4 shadow-lg shadow-black/10 ring-1 ring-gold-700/40">
      <div className="leading-tight">
        <p className="font-semibold text-gold-300">{user.name}</p>
        <p className="text-sm tabular-nums text-gold-500">{user.phone}</p>
      </div>
      <button type="button" onClick={logout} className="rounded-full px-4 py-2 text-sm font-semibold text-gold-300 ring-1 ring-gold-700/60">
        {TEXT[lang].out}
      </button>
    </section>
  );
}
