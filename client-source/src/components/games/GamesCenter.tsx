import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { gameUi } from '@/lib/gameUi';

const money = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = { onOpenBingo: () => void; onOpenKeno: () => void; onOpenAviator: () => void; onOpenMines: () => void; serverMode: boolean };

function GameCard({ title, subtitle, detail, icon, onClick, openLabel, featured = false, disabled = false, disabledLabel = '' }: {
  title: string; subtitle: string; detail: string; icon: 'bingo' | 'keno' | 'aviator' | 'mines' | 'virtual' | 'live'; onClick: () => void; openLabel: string; featured?: boolean; disabled?: boolean; disabledLabel?: string;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`group relative disabled:cursor-not-allowed disabled:opacity-55 flex min-h-64 w-full flex-col overflow-hidden rounded-3xl border text-left transition duration-300 hover:-translate-y-1 hover:border-amber-300/70 hover:shadow-[0_18px_55px_rgba(212,175,55,.16)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 ${featured ? 'border-amber-300/50 bg-gradient-to-br from-[#28200d] via-[#100f0b] to-black' : 'border-amber-500/20 bg-gradient-to-br from-[#17150f] via-[#0b0b0a] to-black'} p-5 sm:p-6`}>
      <span className="absolute -right-8 -top-12 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl transition group-hover:bg-amber-300/20" />
      <span className="relative grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/30 bg-black/60 text-amber-300 shadow-[inset_0_1px_rgba(255,255,255,.08)]">
        {icon === 'bingo' && <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/><path d="m6 6 2 2m8 8 2 2" /></svg>}
        {icon === 'keno' && <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="6" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="18" r="2.2"/></svg>}
        {icon === 'aviator' && <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m3 14 8-2 7-8 2 1-4 8 5 3-1 2-7-2-5 4-2-1 3-5-6 1z"/><path d="M3 20h18"/></svg>}
        {icon === 'virtual' && <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 18h18M5 18l2-8 4 4 3-7 5 11"/><path d="M4 6h4M16 4h4"/></svg>}
        {icon === 'live' && <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/><path d="M3 3l2 2M19 19l2 2"/></svg>}
        {icon === 'mines' && <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="6"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M4.9 4.9l2.8 2.8m8.6 8.6 2.8 2.8m0-14.2-2.8 2.8m-8.6 8.6-2.8 2.8"/></svg>}
      </span>
      <span className="relative mt-6 text-[10px] font-black uppercase tracking-[.28em] text-amber-400">{subtitle}</span>
      <span className="relative mt-2 text-2xl font-black tracking-wide text-amber-50">{title}</span>
      <span className="relative mt-2 max-w-sm text-sm leading-6 text-amber-100/60">{detail}</span>
      <span className="relative mt-auto flex items-center gap-2 pt-6 text-sm font-bold text-amber-300">{disabled ? disabledLabel : openLabel} <span aria-hidden>{disabled ? '•' : '→'}</span></span>
    </button>
  );
}

export function GamesCenter({ onOpenBingo, onOpenKeno, onOpenAviator, onOpenMines, serverMode }: Props) {
  const { lang } = useLanguage();
  const t = gameUi.gamesCenter[lang];
  const [availability, setAvailability] = useState<{ generalEnabled: boolean; announcement: string | null; bingoEnabled: boolean; kenoEnabled: boolean; aviatorEnabled: boolean; balanceEtb: number; walletMode: 'shared' | 'legacy-demo' } | null>(null);
  const [availabilityError, setAvailabilityError] = useState('');
  useEffect(() => {
    if (!serverMode) return;
    let active = true;
    const refreshAvailability = () => {
      api.get<{ generalEnabled: boolean; announcement: string | null; bingoEnabled: boolean; kenoEnabled: boolean; aviatorEnabled: boolean; balanceEtb: number; walletMode: 'shared' | 'legacy-demo' }>('/api/games/settings')
        .then((value) => { if (active) { setAvailability(value); setAvailabilityError(''); } })
        .catch(() => { if (active) setAvailabilityError(t.loadError); });
    };
    refreshAvailability();
    const poll = window.setInterval(refreshAvailability, 5000);
    return () => { active = false; window.clearInterval(poll); };
  }, [serverMode, t.loadError]);
  if (serverMode && availability?.generalEnabled === false) {
    return <main className="mx-auto min-h-[70vh] w-full max-w-6xl px-4 py-8"><section className="mx-auto mb-6 flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-black/45 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">{availability.walletMode === 'shared' ? t.unifiedWallet : t.demoWallet}</p><p className="mt-1 text-xl font-black text-amber-100">{money(availability.balanceEtb)} ETB</p></div><span className="rounded-full border border-amber-300/20 px-3 py-1.5 text-[9px] font-bold tracking-wider text-amber-300">Wallet Balance</span></section>{availability.announcement && <p role="status" className="mx-auto max-w-2xl rounded-xl border border-amber-300/20 bg-black/40 p-5 text-center text-sm leading-7 text-amber-100">{availability.announcement}</p>}</main>;
  }
  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 pb-8">
      <header className="relative overflow-hidden rounded-3xl border border-amber-400/25 bg-[radial-gradient(ellipse_at_top_right,rgba(202,158,57,.22),transparent_45%),linear-gradient(120deg,#17140c,#090909_58%,#151006)] px-5 py-8 shadow-[0_22px_65px_rgba(0,0,0,.4)] sm:px-8 sm:py-10">
        <div className="absolute -right-12 -top-16 h-64 w-64 rounded-full border border-amber-300/10" />
        <div className="absolute -right-2 -top-6 h-44 w-44 rounded-full border border-amber-300/10" />
        <p className="text-[10px] font-black uppercase tracking-[.34em] text-amber-400">BLACK GOLD PLC</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-amber-50 sm:text-5xl">{t.title}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-amber-100/65 sm:text-base">{t.intro}</p>
        {(!serverMode || availability) && <div className="mt-6 flex flex-wrap items-center gap-2">
          {(!serverMode || availability?.bingoEnabled) && <span className="rounded-full border border-amber-300/25 bg-black/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">Bingo</span>}
          {(!serverMode || availability?.kenoEnabled) && <span className="rounded-full border border-amber-300/25 bg-black/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">Keno</span>}
          {(!serverMode || availability?.aviatorEnabled) && <span className="rounded-full border border-amber-300/25 bg-black/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">Aviator</span>}
          <span className="rounded-full border border-amber-300/25 bg-black/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">Mines</span>
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
        <GameCard title="Mines" subtitle="FIND THE GEMS" detail="Open safe tiles, grow your multiplier and cash out your demo credits." icon="mines" onClick={onOpenMines} openLabel={t.openGame} />
        <GameCard title="Virtual Sports" subtitle={t.virtualSportsSubtitle} detail={t.virtualSportsDetail} icon="virtual" onClick={() => {}} openLabel={t.openGame} disabled disabledLabel={t.comingSoon} />
        <GameCard title="Live Sports" subtitle={t.liveSportsSubtitle} detail={t.liveSportsDetail} icon="live" onClick={() => {}} openLabel={t.openGame} disabled disabledLabel={t.comingSoon} />
      </div>
      {serverMode && availability && !availability.bingoEnabled && !availability.kenoEnabled && !availability.aviatorEnabled && <p className="rounded-xl border border-amber-300/20 bg-black/40 p-4 text-center text-sm text-amber-100/70">All games are currently unavailable. Please check again later.</p>}
      <p className="text-center text-[11px] leading-5 text-amber-100/40">{t.demoNotice}</p>
    </div>
  );
}
