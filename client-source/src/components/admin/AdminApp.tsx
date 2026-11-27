import { useState } from 'react';
import { AdminWinPayouts } from '@/components/admin/AdminWinPayouts';
import { AdminPhoneVerifications } from '@/components/admin/AdminPhoneVerifications';
import { AdminPinResets } from '@/components/admin/AdminPinResets';
import { translations } from '@/lib/localization';
import { AdminSimulationWithdrawals } from '@/components/admin/AdminSimulationWithdrawals';
import { AdminDeposits } from '@/components/admin/AdminDeposits';
import { AdminSmsSync } from '@/components/admin/AdminSmsSync';
import { AdminGamesHub } from '@/components/admin/AdminGamesHub';
import { AdminTurboBingo } from '@/components/admin/AdminTurboBingo';
import { HostView } from '@/components/host/HostView';
import { useBackend } from '@/context/BackendContext';
import { useLanguage } from '@/context/LanguageContext';
import { SERVER_MODE } from '@/lib/api';
import type { Lang } from '@/types/game';

const LANGS: { id: Lang; label: string }[] = [
  { id: 'am', label: 'አማ' },
  { id: 'ti', label: 'ትግ' },
  { id: 'en', label: 'EN' },
];

const TEXT = translations.admin;

export function AdminApp({ onExit }: { onExit: () => void }) {
  const backend = useBackend();
  const { lang, setLang } = useLanguage();
  const t = TEXT[lang];
  const [activeGame, setActiveGame] = useState<'bingo' | 'keno' | 'aviator' | 'mines' | 'car-racing' | 'turbo-bingo'>('bingo');

  const backBtn = (
    <button
      type="button"
      onClick={onExit}
      className="shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold text-gold-300 ring-1 ring-gold-700/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300"
    >
      {t.back}
    </button>
  );

  // Players never get any control, only this notice.
  if (!backend.canHost && !SERVER_MODE) {
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <div className="max-w-sm space-y-4 text-center">
          <p className="text-lg font-semibold text-gold-300">{t.denied}</p>
          {backBtn}
        </div>
      </div>
    );
  }

  return (
    <div className="premium-ui min-h-screen pb-10">
      <header className="sticky top-0 z-30 border-b border-gold-700/40 bg-darkbg/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 leading-tight">
            <p className="whitespace-nowrap bg-gradient-to-r from-gold-300 via-gold-400 to-gold-600 bg-clip-text text-base font-black text-transparent sm:text-lg">
              {t.title}
            </p>
            <p className="hidden text-xs font-semibold text-gold-500 sm:block">Black Gold PLC · {t.brandSubtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div role="group" aria-label={t.languageLabel} className="flex overflow-hidden rounded-full ring-1 ring-gold-700/60">
              {LANGS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={lang === o.id}
                  onClick={() => setLang(o.id)}
                  className={[
                    'px-2.5 py-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300',
                    lang === o.id ? 'bg-gold-500 text-darkbg' : 'text-gold-300',
                  ].join(' ')}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {backBtn}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-5 sm:pt-8">
        {backend.kind === 'local' && (
          <p role="note" className="mb-5 rounded-xl bg-red-900/40 px-4 py-3 text-sm text-red-100 ring-1 ring-red-500/50">
            {t.demo}
          </p>
        )}
        <div className="space-y-4">
          {SERVER_MODE && (
            <div className="grid gap-3">
              <AdminPhoneVerifications />
              <AdminPinResets />
              <AdminSmsSync />
              <AdminDeposits />
              <AdminWinPayouts />
              <AdminSimulationWithdrawals />
            </div>
          )}

          <section className="rounded-2xl border border-gold-500/30 bg-cardbg p-3 shadow-lg shadow-black/20 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.24em] text-gold-500">{t.hostControlCenter}</p>
                <h2 className="mt-1 text-lg font-black text-gold-100">{t.gameManagement}</h2>
              </div>
              <span className="rounded-full border border-gold-500/25 bg-black/30 px-3 py-1 text-[10px] font-bold text-gold-300">{t.gamesCount}</span>
            </div>
            <nav aria-label={t.gameSections} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {([
                ['bingo', '01', 'BINGO'],
                ['keno', '02', 'KENO'],
                ['aviator', '03', 'AVIATOR'],
                ['mines', '04', 'MINES'],
                ['car-racing', '05', 'CAR RACING'],
                ['turbo-bingo', '06', 'TURBO BINGO'],
              ] as const).map(([id, number, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={activeGame === id}
                  onClick={() => setActiveGame(id)}
                  className={[
                    'flex min-h-14 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-300',
                    activeGame === id
                      ? 'border-gold-300/70 bg-gradient-to-br from-gold-400/20 to-gold-700/10 text-gold-100 shadow-[inset_0_0_0_1px_rgba(212,175,55,.12)]'
                      : 'border-gold-700/40 bg-black/30 text-gold-500 hover:border-gold-500/50 hover:bg-white/[0.03]',
                  ].join(' ')}
                >
                  <span className="text-[10px] font-black tracking-[.18em] opacity-70">{number}</span>
                  <span className="text-sm font-black tracking-wide">{label}</span>
                  <span aria-hidden="true" className={activeGame === id ? 'text-gold-300' : 'text-gold-800'}>›</span>
                </button>
              ))}
            </nav>
          </section>

          <div className="min-w-0">
            {SERVER_MODE && <AdminGamesHub activeGame={activeGame} />}
            {activeGame === 'bingo' && <div className="mt-3"><HostView /></div>}
            {activeGame === 'turbo-bingo' && <div className="mt-3"><AdminTurboBingo /></div>}
          </div>
        </div>
      </main>
    </div>
  );
}
