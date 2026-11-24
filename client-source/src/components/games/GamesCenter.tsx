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
        <span className="relative mt-1 block h-36 w-full overflow-hidden rounded-2xl border-[3px] border-lime-400 bg-[#050606] shadow-[0_0_24px_rgba(132,204,22,.24)]" aria-label="Aviator icon with large red Antonov aircraft">
          <span className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(255,255,255,.18),transparent_55%),linear-gradient(145deg,#282828,#050505_72%)]" />
          <svg viewBox="0 0 360 220" className="relative h-full w-full" role="img" aria-label="Large red Antonov aircraft, Aviator, SPRIBE" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="aviator-card-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff8a8a"/><stop offset=".45" stopColor="#f21b2b"/><stop offset="1" stopColor="#850817"/></linearGradient>
              <linearGradient id="aviator-card-wing" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ff737b"/><stop offset="1" stopColor="#8b0919"/></linearGradient>
              <filter id="aviator-card-shadow"><feGaussianBlur stdDeviation="5"/></filter>
            </defs>
            <path d="M18 101 L95 81 L158 52 L246 43 L329 63 L347 75 L329 87 L246 81 L164 88 L97 105 Z" fill="url(#aviator-card-wing)" stroke="#ffaaaa" strokeWidth="2"/>
            <path d="M142 86 L182 18 L203 12 L198 87 L257 128 L237 137 L174 103 L111 140 L91 132 L137 89 Z" fill="url(#aviator-card-wing)" stroke="#ffaaaa" strokeWidth="2"/>
            <path d="M40 86 L60 47 L76 43 L84 88 L111 107 L93 113 L59 99 L24 119 L12 109 Z" fill="url(#aviator-card-wing)" stroke="#ffaaaa" strokeWidth="1.6"/>
            <path d="M29 91 Q43 76 70 75 L282 63 Q316 64 342 79 L350 86 Q332 102 303 106 L77 119 Q46 117 27 105 Z" fill="url(#aviator-card-red)" stroke="#ffc2c2" strokeWidth="2"/>
            <path d="M48 88 L76 78 L91 80 L82 95 L49 99 Z" fill="#b8efff" stroke="#fff" strokeWidth="1.5"/>
            <path d="M94 83 L285 73" stroke="#ffe4e4" strokeWidth="3" opacity=".9"/>
            <path d="M83 108 L288 91" stroke="#6d0714" strokeWidth="2.5" opacity=".7"/>
            {[0,1,2,3,4,5].map((n) => <g key={n}><path d={`M${108+n*27} 104 l-4 15 q9 6 18 0 l-4-15 Z`} fill="#790918" stroke="#ff9a9a" strokeWidth="1.5"/><ellipse cx={117+n*27} cy="118" rx="7" ry="3.2" fill="#160c0e" stroke="#ffb4b4" strokeWidth="1"/></g>)}
            <path d="M57 94 L92 90" stroke="#fff" strokeWidth="2" opacity=".8"/>
            <text x="180" y="166" textAnchor="middle" fill="#f0182a" fontSize="44" fontWeight="900" fontStyle="italic" letterSpacing="-2">Aviator</text>
            <text x="180" y="198" textAnchor="middle" fill="#fff" fontSize="21" fontWeight="800" letterSpacing="2">SPRIBE</text>
          </svg>
        </span>
      ) : (
        <span className={icon === 'keno' ? 'relative block h-28 w-full overflow-hidden rounded-2xl border border-lime-400/35 bg-black/60 shadow-[inset_0_1px_rgba(255,255,255,.08)]' : 'relative grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/30 bg-black/60 text-amber-300 shadow-[inset_0_1px_rgba(255,255,255,.08)]'}>
          {icon === 'bingo' && <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/><path d="m6 6 2 2m8 8 2 2" /></svg>}
          {icon === 'keno' && <img src="/images/fast-keno-card-v2.jpg" alt="FAST KENO — Fairness" className="h-full w-full object-cover" />}
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
