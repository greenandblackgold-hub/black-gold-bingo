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
    <button type="button" disabled={disabled} onClick={onClick} className={`games-center-card group relative disabled:cursor-not-allowed disabled:opacity-100 flex min-h-64 w-full flex-col overflow-hidden rounded-3xl border text-left ${featured ? 'border-amber-300/50 bg-gradient-to-br from-[#28200d] via-[#100f0b] to-black' : 'border-amber-500/20 bg-gradient-to-br from-[#17150f] via-[#0b0b0a] to-black'} p-5 sm:p-6`}>
      <span className="absolute -right-8 -top-12 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl transition group-hover:bg-amber-300/20" />
      {icon === 'aviator' || icon === 'bingo' || icon === 'virtual' || icon === 'live' || icon === 'mines' ? (
        <span className={`games-center-artwork relative mt-1 flex h-36 w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl p-1 sm:h-40 ${icon === 'bingo' ? 'bg-[#12052b] shadow-[0_0_24px_rgba(168,85,247,.28)]' : icon === 'aviator' ? 'bg-[#050606] shadow-[0_0_24px_rgba(132,204,22,.24)]' : icon === 'live' ? 'bg-[#08132a] shadow-[0_0_24px_rgba(250,190,55,.24)]' : icon === 'mines' ? 'bg-[#090b18] shadow-[0_0_24px_rgba(59,130,246,.28)]' : 'bg-[#09072c] shadow-[0_0_24px_rgba(34,211,238,.24)]'}`} aria-label={icon === 'bingo' ? 'Bingo PRO premium emblem' : icon === 'aviator' ? 'Aviator Antonov aircraft game artwork' : icon === 'live' ? 'Live Sports floodlit stadium and football artwork' : icon === 'mines' ? 'Selected premium MINES cave, diamond and gold artwork' : 'Virtual Sports holographic arena artwork'}>
          <img loading="eager" decoding="async" draggable={false} src={icon === 'bingo' ? '/images/bingo-pro-premium-emblem.svg?v=2' : icon === 'aviator' ? '/images/aviator-antonov-card.webp' : icon === 'live' ? '/images/live-sports-premium.svg?v=3' : icon === 'mines' ? '/images/mines-premium-selected.jpg?v=1' : '/images/virtual-sports-premium.svg?v=4'} alt={icon === 'bingo' ? 'Bingo PRO premium crown and numbered balls emblem' : icon === 'aviator' ? 'Red Antonov aircraft with Aviator and SPRIBE branding' : icon === 'live' ? 'Live sports football in a floodlit stadium' : icon === 'mines' ? 'MINES premium cave artwork with gold title and glowing blue diamond' : 'Virtual sports glowing holographic football in a futuristic arena'} className="block h-full w-full min-h-0 min-w-0 object-contain" />
        </span>
      ) : (
        <span className={icon === 'keno' ? 'games-center-artwork relative mt-1 block h-36 w-full shrink-0 overflow-hidden rounded-2xl border border-lime-400/35 bg-[#00110f] p-1 shadow-[inset_0_1px_rgba(255,255,255,.08)] sm:h-40' : 'relative mt-1 grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-amber-300/30 bg-black/60 text-amber-300 shadow-[inset_0_1px_rgba(255,255,255,.08)]'}>
          {icon === 'keno' && <img loading="eager" decoding="async" draggable={false} src="/images/fast-keno-card-v4.jpg" alt="FAST KENO — Kiza.bet" className="block h-full w-full min-h-0 min-w-0 object-contain" />}
          {icon === 'mines' && <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="6"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M4.9 4.9l2.8 2.8m8.6 8.6 2.8 2.8m0-14.2-2.8 2.8m-8.6 8.6-2.8 2.8"/></svg>}
        </span>
      )}
      {disabled && <span className="relative mt-3 self-start rounded-full border border-amber-300/35 bg-amber-300/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-amber-200">{disabledLabel}</span>}
      <span className="relative mt-3 text-[10px] font-black uppercase tracking-[.28em] text-amber-400">{subtitle}</span>
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
    let pending = false;
    const refreshAvailability = async () => {
      // Never overlap settings requests: a slow response must not race a newer poll.
      if (pending) return;
      pending = true;
      try {
        const value = await api.get<{ generalEnabled: boolean; announcement: string | null; bingoEnabled: boolean; kenoEnabled: boolean; aviatorEnabled: boolean; minesEnabled: boolean; balanceEtb: number; walletMode: 'shared' | 'legacy-demo' }>('/api/games/settings');
        if (!active) return;
        setAvailability((previous) => {
          if (previous &&
            previous.generalEnabled === value.generalEnabled &&
            previous.announcement === value.announcement &&
            previous.bingoEnabled === value.bingoEnabled &&
            previous.kenoEnabled === value.kenoEnabled &&
            previous.aviatorEnabled === value.aviatorEnabled &&
            previous.minesEnabled === value.minesEnabled &&
            previous.balanceEtb === value.balanceEtb &&
            previous.walletMode === value.walletMode) return previous;
          return value;
        });
        setAvailabilityError('');
      } catch {
        if (active) setAvailabilityError(t.loadError);
      } finally {
        pending = false;
      }
    };
    void refreshAvailability();
    const poll = window.setInterval(() => void refreshAvailability(), 5000);
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
