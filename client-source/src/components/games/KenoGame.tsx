import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { gameUi } from '@/lib/gameUi';

type KenoBet = { id: string; status: string; stakeEtb: number; selectedNumbers: number[]; matchedNumbers: number[]; hits: number; payoutEtb: number; createdAt: number; settledAt?: number | null };
type KenoState = { payoutTable: Record<string, Record<string, number>>; enabled: boolean; balanceEtb: number; walletMode: 'shared' | 'legacy-demo'; game: 'keno'; roundId: string; status: 'betting' | 'settled'; bettingEndsAt: number; serverTime: number; serverSeedHash: string; drawnNumbers?: number[]; serverSeed?: string; myBets: KenoBet[]; minBetEtb: number; maxBetEtb: number; maxPayoutEtb: number; mode: string };
type HistoryRound = { roundId: string; status: string; drawnNumbers?: number[]; serverSeedHash: string; serverSeed?: string; myBets: KenoBet[] };
type Tab = 'game' | 'history' | 'results' | 'statistics' | 'live';

const money = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const requestId = () => 'keno_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);

const copy = {
  am: { title: 'BLACK GOLD KENO', rules: 'ህጎች', sound: 'ድምጽ', turbo: 'ፈጣን', draw: 'የወጡ ቁጥሮች', picks: 'የተመረጡ', hits: 'የተዛመዱ', bet: 'ውርርድ', total: 'ጠቅላላ', game: 'ጨዋታ', history: 'ታሪክ', results: 'ውጤቶች', stats: 'ስታቲስቲክስ', live: 'የእኔ ቲኬቶች', clear: 'አጽዳ', quick: 'ፈጣን ምርጫ', selected: 'የተመረጡ ቁጥሮች', play: 'BET / ተጫወት', waiting: 'ውጤት በመጠበቅ ላይ', noTickets: 'በዚህ ዙር ገና ቲኬት የለም', noHistory: 'ገና የተጠናቀቁ ዙሮች የሉም', rounds: 'ዙሮች', tickets: 'ቲኬቶች', wagered: 'ጠቅላላ ውርርድ', won: 'ጠቅላላ ያሸነፉት', count: 'ብዛት', status: 'ሁኔታ', payout: 'ክፍያ', noWin: 'ሽልማት የለም', minMax: 'የሚፈቀደው', round: 'ዙር', drawComplete: 'ዕጣው ተጠናቋል', recent: 'የቅርብ ውጤቶች', poolNote: 'የመጨረሻ ክፍያ በዙሩ የገንዘብ ገንዳና በከፍተኛ ገደብ ሊስተካከል ይችላል።', simulation: 'የሙከራ ክሬዲት ብቻ' },
  ti: { title: 'BLACK GOLD KENO', rules: 'ሕግታት', sound: 'ድምጺ', turbo: 'ቅልጡፍ', draw: 'ዝወጹ ቁጽሪታት', picks: 'ዝተመርጹ', hits: 'ዝተሰማምዑ', bet: 'ውርርድ', total: 'ጠቕላላ', game: 'ጸወታ', history: 'ታሪኽ', results: 'ውጽኢት', stats: 'ስታቲስቲክስ', live: 'ቲኬታተይ', clear: 'ኣጽርይ', quick: 'ቅልጡፍ ምርጫ', selected: 'ዝተመርጹ ቁጽሪታት', play: 'BET / ተጻወት', waiting: 'ውጽኢት ይጽበ ኣሎ', noTickets: 'ኣብዚ ዙር ገና ቲኬት የለን', noHistory: 'ገና ዝተወድኡ ዙራት የለዉን', rounds: 'ዙራት', tickets: 'ቲኬታት', wagered: 'ጠቕላላ ውርርድ', won: 'ጠቕላላ ዝተዓወትኩም', count: 'ብዝሒ', status: 'ኩነታት', payout: 'ክፍሊት', noWin: 'ሽልማት የለን', minMax: 'ዝፍቀድ', round: 'ዙር', drawComplete: 'ዕጫ ተወዲኡ', recent: 'ናይ ቀረባ ውጽኢታት', poolNote: 'ናይ መወዳእታ ክፍሊት ብገንዘብ ገንዳ ዙርን ዝለዓለ ደረትን ክስተኻኸል ይኽእል።', simulation: 'ናይ ፈተነ ክረዲት ጥራይ' },
  en: { title: 'BLACK GOLD KENO', rules: 'RULES', sound: 'SOUND', turbo: 'TURBO', draw: 'DRAWN NUMBERS', picks: 'PICKS', hits: 'HITS', bet: 'BET', total: 'TOTAL', game: 'GAME', history: 'HISTORY', results: 'RESULTS', stats: 'STATISTICS', live: 'MY TICKETS', clear: 'CLEAR', quick: 'QUICK PICK', selected: 'SELECTED NUMBERS', play: 'BET NOW', waiting: 'Waiting for draw', noTickets: 'No tickets in this round yet', noHistory: 'No completed rounds yet', rounds: 'Rounds', tickets: 'Tickets', wagered: 'Total wagered', won: 'Total returned', count: 'Count', status: 'Status', payout: 'Payout', noWin: 'No prize', minMax: 'Allowed', round: 'Round', drawComplete: 'DRAW COMPLETE', recent: 'RECENT RESULTS', poolNote: 'Final payouts may be adjusted by the round pool and the maximum payout cap.', simulation: 'DEMO CREDITS ONLY' },
} as const;

export function KenoGame({ onBack, onSwitchGame }: { onBack: () => void; onSwitchGame: (game: 'bingo' | 'keno' | 'aviator') => void }) {
  const { lang } = useLanguage();
  const t = gameUi.keno[lang];
  const c = copy[lang];
  const [state, setState] = useState<KenoState | null>(null);
  const [history, setHistory] = useState<HistoryRound[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [amount, setAmount] = useState('10.00');
  const [clock, setClock] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('game');

  const loadState = useCallback(async () => {
    try {
      const next = await api.get<KenoState>('/api/games/keno/state');
      setState(next);
      setOffset(next.serverTime - Date.now());
      setError('');
    } catch { setError(t.loadError); }
  }, [t.loadError]);
  const loadHistory = useCallback(async () => {
    try { setHistory(await api.get<HistoryRound[]>('/api/games/keno/history?limit=8')); } catch { /* history is optional */ }
  }, []);

  useEffect(() => {
    void loadState(); void loadHistory();
    const poll = window.setInterval(() => void loadState(), 1200);
    const tick = window.setInterval(() => setClock(Date.now()), 200);
    return () => { window.clearInterval(poll); window.clearInterval(tick); };
  }, [loadState, loadHistory]);
  useEffect(() => { if (state?.status === 'settled') void loadHistory(); }, [state?.status, state?.roundId, loadHistory]);

  const secondsLeft = state?.status === 'betting' ? Math.max(0, Math.ceil((state.bettingEndsAt - (clock + offset)) / 1000)) : 0;
  const isBetting = state?.enabled === true && state.status === 'betting' && secondsLeft > 0;
  const drawSet = useMemo(() => new Set(state?.drawnNumbers ?? []), [state?.drawnNumbers]);
  const latestBet = state?.myBets?.[state.myBets.length - 1];
  const hitSet = useMemo(() => new Set(latestBet?.matchedNumbers ?? []), [latestBet?.id, latestBet?.matchedNumbers]);
  const minBet = state?.minBetEtb ?? 5;
  const maxBet = state?.maxBetEtb ?? 1000;
  const numericAmount = Number(amount);
  const validAmount = Number.isFinite(numericAmount) && numericAmount >= minBet && numericAmount <= maxBet;
  const totalWager = numericAmount;
  const stats = useMemo(() => {
    const bets = history.flatMap((round) => round.myBets ?? []);
    return { rounds: history.length, tickets: bets.length, wagered: bets.reduce((s, b) => s + b.stakeEtb, 0), won: bets.reduce((s, b) => s + b.payoutEtb, 0), hits: bets.reduce((s, b) => s + b.hits, 0) };
  }, [history]);

  const toggle = (n: number) => setSelected((old) => old.includes(n) ? old.filter((v) => v !== n) : old.length >= 10 ? old : [...old, n].sort((a, b) => a - b));
  const quickPick = () => {
    const pool = Array.from({ length: 80 }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    setSelected(pool.slice(0, 10).sort((a, b) => a - b));
  };
  const submit = async () => {
    if (!selected.length || !validAmount || !isBetting || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api.post('/api/games/keno/bets', { requestId: requestId(), amount: numericAmount, selectedNumbers: selected });
      setNotice(t.betConfirmed);
      setSelected([]);
      await Promise.all([loadState(), loadHistory()]);
    } catch { setError(t.betError); }
    finally { setBusy(false); }
  };
  const adjustBet = (delta: number) => setAmount((old) => {
    const current = Number(old);
    const next = (Number.isFinite(current) ? current : minBet) + delta;
    return Math.min(maxBet, Math.max(minBet, next)).toFixed(2);
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'game', label: c.game }, { id: 'history', label: c.history }, { id: 'results', label: c.results },
    { id: 'statistics', label: c.stats }, { id: 'live', label: c.live },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-3 pb-8 text-slate-100">
      <header className="sticky top-0 z-20 -mx-2 flex items-center justify-between gap-2 border-b border-emerald-400/20 bg-[#07110f]/95 px-3 py-2 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button onClick={onBack} aria-label={t.games} className="rounded-lg border border-emerald-300/20 px-2.5 py-2 text-sm font-bold text-emerald-200">‹</button>
          <div className="min-w-0"><p className="text-[10px] font-black italic leading-none tracking-wider text-emerald-300">BLACK GOLD</p><h1 className="truncate text-base font-black tracking-wide text-white">KENO</h1></div>
        </div>
        <div className="text-right"><p className="text-[9px] uppercase tracking-widest text-emerald-300/70">{state?.walletMode === 'shared' ? t.sharedBalance : t.demoBalance}</p><p className="text-sm font-black tabular-nums text-amber-300">{money(state?.balanceEtb ?? 0)} ETB</p></div>
        <button onClick={() => setTab('history')} aria-label={c.history} className="rounded-lg border border-emerald-300/20 px-2.5 py-2 text-lg text-emerald-300">☰</button>
      </header>

      <div className="flex items-center justify-between rounded-xl border border-emerald-400/15 bg-[#0b1916] px-3 py-2">
        <div className="min-w-0"><p className="text-[9px] uppercase tracking-widest text-emerald-300/65">{c.round}</p><p className="truncate font-mono text-[11px] text-slate-300">{state?.roundId ?? t.connecting}</p></div>
        <div className="text-right"><p className="text-[9px] uppercase tracking-widest text-emerald-300/65">{t.bettingCloses}</p><p className="font-mono text-xl font-black tabular-nums text-emerald-300">{isBetting ? `00:${String(secondsLeft).padStart(2, '0')}` : state?.status === 'settled' ? c.drawComplete : t.waiting}</p></div>
        <button onClick={() => document.getElementById('keno-rules')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="rounded-full border border-emerald-300/30 px-3 py-1.5 text-xs font-bold text-emerald-300">? {c.rules}</button>
      </div>

      {(error || notice) && <p role={error ? 'alert' : 'status'} className={`rounded-lg border p-3 text-sm ${error ? 'border-red-500/30 bg-red-950/40 text-red-200' : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200'}`}>{error || notice}</p>}

      <section className="rounded-xl border border-emerald-400/15 bg-[#0b1916] p-3">
        <div className="mb-2 flex items-center justify-between"><h2 className="text-[10px] font-black tracking-widest text-emerald-300">{c.draw}</h2><span className="text-[10px] text-slate-400">{state?.drawnNumbers?.length ?? 0} / 20</span></div>
        {state?.drawnNumbers?.length ? <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">{state.drawnNumbers.map((n, i) => <span key={n} className={`grid aspect-square place-items-center rounded-full border text-sm font-black tabular-nums ${i === state.drawnNumbers!.length - 1 ? 'border-amber-200 bg-amber-300 text-black shadow-[0_0_16px_rgba(252,211,77,.45)]' : 'border-emerald-300/40 bg-emerald-500/20 text-emerald-200'}`}>{n}</span>)}</div> : <p className="rounded-lg border border-dashed border-emerald-400/20 py-4 text-center text-xs text-slate-500">{t.waitingDraw}</p>}
        {history[0]?.drawnNumbers?.length ? <div className="mt-3 flex items-center gap-2 overflow-x-auto border-t border-white/5 pt-2"><span className="shrink-0 text-[9px] font-bold text-slate-500">{c.recent}</span>{history.slice(0, 4).map((r) => <span key={r.roundId} className="shrink-0 rounded-md bg-white/5 px-2 py-1 text-[10px] text-slate-300">{r.drawnNumbers?.slice(0, 5).join(' · ')}</span>)}</div> : null}
      </section>

      <section className="rounded-xl border border-emerald-400/15 bg-[#0b1916] p-2.5">
        <div className="mb-2 flex items-center justify-between px-1"><h2 className="text-xs font-black tracking-widest text-emerald-300">01 — 80</h2><span className="text-xs font-bold text-amber-300">{selected.length} / 10 {c.picks}</span></div>
        <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
          {Array.from({ length: 80 }, (_, i) => i + 1).map((n) => {
            const chosen = selected.includes(n);
            const drawn = drawSet.has(n);
            const hit = hitSet.has(n);
            return <button key={n} type="button" disabled={!isBetting || !!drawSet.size} onClick={() => toggle(n)} aria-pressed={chosen} className={`aspect-square min-w-0 rounded-md border text-[11px] font-black tabular-nums transition sm:rounded-lg sm:text-sm ${hit ? 'border-emerald-200 bg-emerald-400 text-black shadow-[0_0_10px_rgba(52,211,153,.45)]' : drawn ? 'border-sky-300/50 bg-sky-500/25 text-sky-100' : chosen ? 'border-amber-100 bg-gradient-to-br from-amber-200 to-amber-500 text-black shadow-[0_0_12px_rgba(245,190,60,.3)]' : 'border-white/10 bg-[#172522] text-slate-300 hover:border-amber-300/60'} disabled:cursor-not-allowed disabled:opacity-90`}>{n}</button>;
          })}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[10px] text-slate-400">{selected.length} {t.selected}</span><div className="flex gap-2"><button disabled={!isBetting} onClick={quickPick} className="rounded-lg border border-emerald-300/30 px-3 py-2 text-[10px] font-black text-emerald-300 disabled:opacity-40">{c.quick}</button><button disabled={!isBetting} onClick={() => setSelected([])} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-black text-slate-300 disabled:opacity-40">{c.clear}</button></div></div>
      </section>

      <section className="rounded-xl border border-amber-400/15 bg-[#111812] px-3 py-2">
        <div className="mb-2 flex items-center justify-between"><h2 className="text-[10px] font-black tracking-widest text-amber-300">{t.payoutTable}</h2><span className="text-[10px] text-slate-500">{selected.length}/10</span></div>
        {selected.length && state?.payoutTable[String(selected.length)] ? <div className="flex gap-2 overflow-x-auto pb-1">{Object.entries(state.payoutTable[String(selected.length)]).sort(([a], [b]) => Number(a) - Number(b)).map(([matches, multiplier]) => <div key={matches} className="min-w-[76px] rounded-lg bg-[#1b2921] px-2 py-2 text-center"><p className="text-[9px] text-slate-400">{matches} {c.hits}</p><p className="text-sm font-black text-amber-300">{(multiplier / 100).toFixed(2)}×</p></div>)}</div> : <p className="text-[10px] text-slate-500">{c.selected} · {t.intro}</p>}
      </section>

      <section className="rounded-xl border border-emerald-400/15 bg-[#0b1916] p-2.5">
        <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-1.5">
          <button disabled={!isBetting || Number(amount) <= minBet} onClick={() => adjustBet(-1)} className="rounded-lg bg-[#1a2b28] py-3 text-2xl font-black text-slate-300 disabled:opacity-35">−</button>
          <div className="min-w-0 text-center"><label htmlFor="keno-bet" className="block text-[9px] font-bold uppercase tracking-widest text-emerald-300/70">{c.bet} (ETB)</label><input id="keno-bet" type="number" inputMode="decimal" min={minBet} max={maxBet} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-24 bg-transparent text-center text-xl font-black tabular-nums text-white outline-none" /></div>
          <button disabled={!isBetting || Number(amount) >= maxBet} onClick={() => adjustBet(1)} className="rounded-lg bg-[#1a2b28] py-3 text-2xl font-black text-slate-300 disabled:opacity-35">+</button>
          <button disabled={!isBetting} onClick={() => adjustBet(Math.max(1, numericAmount))} className="rounded-lg border border-emerald-300/30 px-3 py-3 text-xs font-black text-emerald-300 disabled:opacity-35">×2</button>
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400"><span>{c.minMax}: {money(minBet)}–{money(maxBet)} ETB</span><span>{c.total}: <b className="text-amber-300">{money(totalWager)} ETB</b></span></div>
        <button disabled={!isBetting || !selected.length || !validAmount || busy} onClick={() => void submit()} className="mt-2 w-full rounded-lg border border-emerald-200/40 bg-gradient-to-r from-emerald-800 to-emerald-700 py-3.5 text-lg font-black tracking-wide text-white shadow-[0_5px_18px_rgba(16,185,129,.15)] disabled:cursor-not-allowed disabled:opacity-40">{busy ? t.confirming : c.play}</button>
      </section>

      <div className="grid grid-cols-5 gap-1 border-b border-emerald-400/20 pb-1">
        {tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`rounded-t-lg px-1 py-2 text-[9px] font-black uppercase tracking-wide sm:text-[11px] ${tab === item.id ? 'border-b-2 border-emerald-300 bg-emerald-400/10 text-emerald-300' : 'text-slate-500 hover:text-slate-200'}`}>{item.label}</button>)}
      </div>

      {tab === 'game' && <section className="space-y-2">
        <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-[#0b1916] p-2"><p className="text-[9px] text-slate-500">ALL</p><p className="text-sm font-black text-emerald-300">{history.length}</p></div><div className="rounded-lg bg-[#0b1916] p-2"><p className="text-[9px] text-slate-500">{c.tickets}</p><p className="text-sm font-black text-emerald-300">{state?.myBets.length ?? 0}</p></div><div className="rounded-lg bg-[#0b1916] p-2"><p className="text-[9px] text-slate-500">{c.hits}</p><p className="text-sm font-black text-emerald-300">{latestBet?.hits ?? 0}</p></div></div>
        {state?.myBets?.length ? state.myBets.slice().reverse().map((bet) => <BetCard key={bet.id} bet={bet} labels={c} />) : <p className="rounded-lg bg-[#0b1916] p-4 text-center text-xs text-slate-500">{c.noTickets}</p>}
      </section>}

      {tab === 'live' && <section className="space-y-2">{state?.myBets?.length ? state.myBets.map((bet) => <BetCard key={bet.id} bet={bet} labels={c} />) : <p className="rounded-lg bg-[#0b1916] p-4 text-center text-xs text-slate-500">{c.noTickets}</p>}</section>}

      {tab === 'history' && <section className="space-y-2">{history.length ? history.map((round) => <div key={round.roundId} className="rounded-lg border border-white/5 bg-[#0b1916] p-3"><div className="flex items-center justify-between gap-2"><span className="truncate font-mono text-[10px] text-emerald-300">{round.roundId}</span><span className="text-[10px] text-slate-500">{round.status}</span></div><div className="mt-2 flex flex-wrap gap-1">{(round.drawnNumbers ?? []).map((n) => <span key={n} className="grid h-7 w-7 place-items-center rounded bg-[#1b302b] text-[10px] font-bold text-slate-200">{n}</span>)}</div><p className="mt-2 text-[10px] text-slate-400">{c.tickets}: {round.myBets.length} · {c.payout}: {money(round.myBets.reduce((s, b) => s + b.payoutEtb, 0))} ETB</p></div>) : <p className="rounded-lg bg-[#0b1916] p-4 text-center text-xs text-slate-500">{c.noHistory}</p>}</section>}

      {tab === 'results' && <section className="space-y-2">{history.filter((round) => round.drawnNumbers?.length).map((round) => <div key={round.roundId} className="rounded-lg bg-[#0b1916] p-3"><p className="font-mono text-[10px] text-emerald-300">{round.roundId}</p><div className="mt-2 grid grid-cols-10 gap-1">{round.drawnNumbers!.map((n) => <span key={n} className="grid aspect-square place-items-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-200">{n}</span>)}</div></div>)}</section>}

      {tab === 'statistics' && <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">{[[c.rounds, stats.rounds], [c.tickets, stats.tickets], [c.wagered, money(stats.wagered) + ' ETB'], [c.won, money(stats.won) + ' ETB'], [c.hits, stats.hits]].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-emerald-400/10 bg-[#0b1916] p-3"><p className="text-[10px] text-slate-500">{label}</p><p className="mt-1 text-lg font-black text-emerald-300">{value}</p></div>)}</section>}

      <details id="keno-rules" className="rounded-xl border border-amber-400/20 bg-[#0b1916] p-3 text-xs text-slate-300">
        <summary className="cursor-pointer font-black text-amber-300">{c.rules} · {t.payoutTable}</summary>
        <div className="mt-3 space-y-2"><p>{t.intro}</p><p>{t.drawInfo}</p><p>{t.multiplierInfo}</p><p className="text-amber-200/80">{c.poolNote}</p><p className="text-emerald-300">{c.simulation}</p></div>
        {state?.payoutTable && <div className="mt-3 max-h-64 overflow-auto"><table className="w-full border-collapse text-left"><thead className="sticky top-0 bg-[#0b1916] text-emerald-300"><tr><th className="p-2">{t.numbersPicked}</th><th className="p-2">{t.matchesHeader}</th><th className="p-2">{t.returnMultiplier}</th></tr></thead><tbody>{Object.entries(state.payoutTable).flatMap(([picked, hits]) => Object.entries(hits).map(([matched, multiplier]) => <tr key={picked + '-' + matched} className="border-t border-white/5"><td className="p-2">{picked}</td><td className="p-2">{matched}</td><td className="p-2 font-bold text-amber-200">{(multiplier / 100).toFixed(2)}×</td></tr>))}</tbody></table></div>}
        <p className="mt-2 text-[10px] text-slate-500">{t.allowed}: {money(minBet)}–{money(maxBet)} ETB · {t.maxPayout}: {money(state?.maxPayoutEtb ?? 20000)} ETB</p>
      </details>
      {state?.serverSeedHash && <details className="rounded-xl border border-emerald-400/10 bg-[#0b1916] p-3 text-xs text-slate-400"><summary className="cursor-pointer font-bold text-emerald-300">{t.fairness}</summary><p className="mt-2 break-all">{t.commitment}: {state.serverSeedHash}</p>{state.serverSeed ? <><p className="mt-1 break-all">{t.revealedSeed}: {state.serverSeed}</p><p className="mt-2">{t.reproducible}</p></> : <p className="mt-2">{t.seedAfter}</p>}</details>}
      <p className="text-center text-[9px] font-bold tracking-widest text-emerald-300/50">{c.simulation}</p>
    </div>
  );
}

function BetCard({ bet, labels }: { bet: KenoBet; labels: (typeof copy)['en'] | (typeof copy)['am'] | (typeof copy)['ti'] }) {
  return <div className="rounded-lg border border-white/5 bg-[#0b1916] p-2.5"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black text-emerald-300">{labels.picks}: {bet.selectedNumbers.length}</span><span className="text-[10px] font-bold text-amber-300">{bet.status}</span></div><div className="mt-2 grid grid-cols-10 gap-1">{bet.selectedNumbers.map((n) => <span key={n} className={`grid aspect-square place-items-center rounded bg-[#1b302b] text-[10px] font-bold ${bet.matchedNumbers.includes(n) ? 'bg-emerald-400 text-black' : 'text-slate-200'}`}>{n}</span>)}</div><div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-[10px]"><span>{labels.bet}: {money(bet.stakeEtb)} ETB · {labels.hits}: {bet.hits}</span><b className="text-amber-300">{labels.payout}: {money(bet.payoutEtb)} ETB</b></div></div>;
}
