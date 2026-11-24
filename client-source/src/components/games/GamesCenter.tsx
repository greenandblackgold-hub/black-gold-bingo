import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { gameUi } from '@/lib/gameUi';
import { minesLocale } from '@/lib/minesLocalization';

const money = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = { onOpenBingo: () => void; onOpenKeno: () => void; onOpenAviator: () => void; onOpenMines: () => void; onOpenHelp: () => void; serverMode: boolean };

function GameCard({ title, subtitle, detail, icon, onClick, openLabel, featured = false, disabled = false, disabledLabel = '' }: {
  title: string; subtitle: string; detail: string; icon: 'bingo' | 'keno' | 'aviator' | 'mines' | 'virtual' | 'live'; onClick: () => void; openLabel: string; featured?: boolean; disabled?: boolean; disabledLabel?: string;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`group relative disabled:cursor-not-allowed disabled:opacity-55 flex min-h-64 w-full flex-col overflow-hidden rounded-3xl border text-left transition duration-300 hover:-translate-y-1 hover:border-amber-300/70 hover:shadow-[0_18px_55px_rgba(212,175,55,.16)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 ${featured ? 'border-amber-300/50 bg-gradient-to-br from-[#28200d] via-[#100f0b] to-black' : 'border-amber-500/20 bg-gradient-to-br from-[#17150f] via-[#0b0b0a] to-black'} p-5 sm:p-6`}>
      <span className="absolute -right-8 -top-12 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl transition group-hover:bg-amber-300/20" />
      {disabled && <span className="absolute right-4 top-4 z-10 rounded-full border border-amber-300/35 bg-amber-300/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-amber-200">{disabledLabel}</span>}
      {icon === 'aviator' ? (
        <span className="relative mt-1 flex h-24 w-full items-center justify-center overflow-hidden" aria-label="Large red Antonov aircraft">
          <span className="absolute inset-x-8 top-1/2 h-12 -translate-y-1/2 rounded-full bg-red-600/15 blur-2xl" />
          <svg viewBox="0 0 360 140" className="relative h-full w-full max-w-[340px] drop-shadow-[0_8px_12px_rgba(220,25,25,.28)]" role="img" aria-label="Red Antonov An-225 cargo aircraft" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="antonov-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff7777"/><stop offset=".42" stopColor="#e32636"/><stop offset="1" stopColor="#8f0718"/></linearGradient>
              <linearGradient id="antonov-wing" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f34b56"/><stop offset="1" stopColor="#970b1d"/></linearGradient>
            </defs>
            <path d="M20 91 L93 82 L145 61 L216 55 L274 64 L329 75 L341 81 L329 87 L270 91 L205 87 L145 93 L92 91 Z" fill="url(#antonov-wing)" stroke="#ff9a9a" strokeWidth="1.5"/>
            <path d="M148 77 L190 15 L205 13 L197 78 L237 113 L222 119 L172 91 L119 118 L105 114 L143 79 Z" fill="url(#antonov-wing)" stroke="#ff9a9a" strokeWidth="1.5"/>
            <path d="M46 69 L63 34 L74 32 L80 71 L103 86 L91 91 L61 81 L35 92 L27 87 Z" fill="url(#antonov-wing)" stroke="#ff9a9a" strokeWidth="1.2"/>
            <path d="M32 76 Q40 65 62 64 L293 67 Q316 68 337 79 L342 84 Q329 94 304 96 L68 97 Q42 96 30 88 Z" fill="url(#antonov-red)" stroke="#ffb0b0" strokeWidth="1.6"/>
            <path d="M302 69 Q322 71 338 80 L342 84 Q337 88 327 90 L302 88 Z" fill="#f4c7c7" opacity=".9"/>
            <path d="M43 72 L63 67 L71 68 L65 78 L43 80 Z" fill="#9de3f5" stroke="#fff" strokeWidth="1"/>
            <path d="M80 70 L286 72" stroke="#ffd1d1" strokeWidth="2" opacity=".8"/>
            <path d="M90 88 L281 88" stroke="#750616" strokeWidth="2" opacity=".55"/>
            {[0,1,2,3,4,5].map((n) => <g key={n}><path d={`M${105+n*27} 91 l-3 12 q8 5 15 0 l-3-12 Z`} fill="#6b0b18" stroke="#ff7777" strokeWidth="1"/><ellipse cx={111+n*27} cy="102" rx="6" ry="2.5" fill="#2b1115"/></g>)}
            <path d="M18 112 H92" stroke="#ff626b" strokeWidth="2" strokeLinecap="round" opacity=".7"/>
            <path d="M7 120 H65" stroke="#ff626b" strokeWidth="1.5" strokeLinecap="round" opacity=".4"/>
          </svg>
        </span>
      ) : (
        <span className={icon === 'keno' ? 'relative block h-28 w-full overflow-hidden rounded-2xl border border-lime-400/35 bg-black/60 shadow-[inset_0_1px_rgba(255,255,255,.08)]' : 'relative grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/30 bg-black/60 text-amber-300 shadow-[inset_0_1px_rgba(255,255,255,.08)]'}>
          {icon === 'bingo' && <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/><path d="m6 6 2 2m8 8 2 2" /></svg>}
          {icon === 'keno' && <img src="/images/fast-keno-card.jpg" alt="FAST KENO — Fairness" className="h-full w-full object-cover" />}
          {icon === 'virtual' && <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 18h18M5 18l2-8 4 4 3-7 5 11"/><path d="M4 6h4M16 4h4"/></svg>}
          {icon === 'live' && <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/><path d="M3 3l2 2M19 19l2 2"/></svg>}
          {icon === 'mines' && <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="6"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M4.9 4.9l2.8 2.8m8.6 8.6 2.8 2.8m0-14.2-2.8 2.8m-8.6 8.6-2.8 2.8"/></svg>}
        </span>
      )}
      <span className="relative mt-6 text-[10px] font-black uppercase tracking-[.28em] text-amber-400">{subtitle}</span>
      <span className="relative mt-2 text-2xl font-black tracking-wide text-amber-50">{title}</span>
      <span className="relative mt-2 max-w-sm text-sm leading-6 text-amber-100/60">{detail}</span>
      {!disabled && <span className="relative mt-auto flex items-center gap-2 pt-6 text-sm font-bold text-amber-300">{openLabel} <span aria-hidden>→</span></span>}
    </button>
  );
}

export function GamesCenter({ onOpenBingo, onOpenKeno, onOpenAviator, onOpenMines, onOpenHelp, serverMode }: Props) {
  const { lang } = useLanguage();
  const t = gameUi.gamesCenter[lang];
  const mt = (key: Parameters<typeof minesLocale>[1]) => minesLocale(lang, key);
  const [availability, setAvailability] = useState<{ generalEnabled: boolean; announcement: string | null; bingoEnabled: boolean; kenoEnabled: boolean; aviatorEnabled: boolean; minesEnabled: boolean; balanceEtb: number; walletMode: 'shared' | 'legacy-demo' } | null>(null);
  const [availabilityError, setAvailabilityError] = useState('');
  useEffect(() => {
    if (!serverMode) return;
    let active = true;
    const refreshAvailability = () => {
      api.get<{ generalEnabled: boolean; announcement: string | null; bingoEnabled: boolean; kenoEnabled: boolean; aviatorEnabled: boolean; minesEnabled: boolean; balanceEtb: number; walletMode: 'shared' | 'legacy-demo' }>('/api/games/settings')
        .then((value) => { if (active) { setAvailability(value); setAvailabilityError(''); } })
        .catch(() => { if (active) setAvailabilityError(t.loadError); });
    };
    refreshAvailability();
    const poll = window.setInterval(refreshAvailability, 5000);
    return () => { active = false; window.clearInterval(poll); };
  }, [serverMode, t.loadError]);
  if (serverMode && availability?.generalEnabled === false) {
    return <main className="mx-auto min-h-[70vh] w-full max-w-6xl px-4 py-8"><section className="mx-auto mb-6 flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-black/45 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">{availability.walletMode === 'shared' ? t.unifiedWallet : t.demoWallet}</p><p className="mt-1 text-xl font-black text-amber-100">{money(availability.balanceEtb)} ETB</p></div><span className="rounded-full border border-amber-300/20 px-3 py-1.5 text-[9px] font-bold tracking-wider text-amber-300">{mt('walletBalance')}</span></section>{availability.announcement && <p role="status" className="mx-auto max-w-2xl rounded-xl border border-amber-300/20 bg-black/40 p-5 text-center text-sm leading-7 text-amber-100">{availability.announcement}</p>}</main>;
  }
  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 pb-8">
      <header className="relative overflow-hidden rounded-3xl border border-amber-400/25 bg-[radial-gradient(ellipse_at_top_right,rgba(202,158,57,.22),transparent_45%),linear-gradient(120deg,#17140c,#090909_58%,#151006)] px-5 py-8 shadow-[0_22px_65px_rgba(0,0,0,.4)] sm:px-8 sm:py-10">
        <div className="absolute -right-12 -top-16 h-64 w-64 rounded-full border border-amber-300/10" />
        <div className="absolute -right-2 -top-6 h-44 w-44 rounded-full border border-amber-300/10" />
        <p className="text-[10px] font-black uppercase tracking-[.34em] text-amber-400">BLACK GOLD PLC</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-amber-50 sm:text-5xl">{t.title}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-amber-100/65 sm:text-base">{t.intro}</p>
        <button type="button" onClick={onOpenHelp} className="relative mt-6 inline-flex min-h-12 items-center gap-3 rounded-xl border border-amber-300/45 bg-gradient-to-r from-amber-300/15 to-yellow-600/10 px-5 py-3 text-sm font-black text-amber-200 shadow-[0_8px_28px_rgba(212,175,55,.10)] transition hover:border-amber-200 hover:bg-amber-300/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">
          <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full border border-amber-300/40 text-base">✦</span>
          <span>Black Gold AI</span>
          <span aria-hidden="true" className="text-amber-400">→</span>
        </button>
        {(!serverMode || availability) && <div className="mt-6 flex flex-wrap items-center gap-2">
          {(!serverMode || availability?.bingoEnabled) && <span className="rounded-full border border-amber-300/25 bg-black/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">Bingo</span>}
          {(!serverMode || availability?.kenoEnabled) && <span className="rounded-full border border-amber-300/25 bg-black/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">Keno</span>}
          {(!serverMode || availability?.aviatorEnabled) && <span className="rounded-full border border-amber-300/25 bg-black/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">Aviator</span>}
          {(!serverMode || availability?.minesEnabled === true) && <span className="rounded-full border border-amber-300/25 bg-black/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">Mines</span>}
        </div>}
      </header>
      {serverMode && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-black/45 px-4 py-3">
        <div><p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">{availability?.walletMode === 'shared' ? t.unifiedWallet : t.demoWallet}</p><p className="mt-1 text-xl font-black text-amber-100">{availability ? money(availability.balanceEtb) + ' ETB' : t.loadingBalance}</p></div>
        <span className="rounded-full border border-amber-300/20 px-3 py-1.5 text-[9px] font-bold tracking-wider text-amber-300">{availability?.walletMode === 'shared' ? t.sharedSimulation : t.separateDemo}</span>
      </div>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-[.25em] text-amber-500">{t.choose}</p><h2 className="mt-1 text-xl font-black text-amber-50 sm:text-2xl">{t.explore}</h2></div>
        <span className="rounded-full border border-amber-500/20 bg-amber-400/5 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-amber-300">{t.demoOnly}</span>
      </div>
      {availabilityError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">{availabilityError}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(!serverMode || availability?.bingoEnabled === true) && <GameCard title="Bingo PRO" subtitle={t.bingoSubtitle} detail={t.bingoDetail} icon="bingo" onClick={onOpenBingo} openLabel={t.openGame} featured />}
        {(!serverMode || availability?.kenoEnabled === true) && <GameCard title="Keno" subtitle={t.kenoSubtitle} detail={t.kenoDetail} icon="keno" onClick={onOpenKeno} openLabel={t.openGame} />}
        {(!serverMode || availability?.aviatorEnabled === true) && <GameCard title="Aviator" subtitle={t.aviatorSubtitle} detail={t.aviatorDetail} icon="aviator" onClick={onOpenAviator} openLabel={t.openGame} />}
        {(!serverMode || availability?.minesEnabled === true) && <GameCard title="Mines" subtitle={mt('cardSubtitle')} detail={mt('cardDetail')} icon="mines" onClick={onOpenMines} openLabel={t.openGame} /> }
        <GameCard title="Virtual Sports" subtitle={t.virtualSportsSubtitle} detail={t.virtualSportsDetail} icon="virtual" onClick={() => {}} openLabel={t.openGame} disabled disabledLabel={t.comingSoon} />
        <GameCard title="Live Sports" subtitle={t.liveSportsSubtitle} detail={t.liveSportsDetail} icon="live" onClick={() => {}} openLabel={t.openGame} disabled disabledLabel={t.comingSoon} />
      </div>
      <p className="text-center text-[11px] leading-5 text-amber-100/40">{t.demoNotice}</p>
    </div>
  );
}
