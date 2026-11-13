import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

const TEXT = { am: { out: 'ውጣ' }, ti: { out: 'ውጻእ' }, en: { out: 'Sign out' } } as const;

export function AccountPanel() {
  const { user, logout } = useAuth();
  const { lang } = useLanguage();
  if (!user) return null;
  return (
    <section className="flex items-center justify-between rounded-2xl bg-cardbg p-4 ring-1 ring-gold-700/50">
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
