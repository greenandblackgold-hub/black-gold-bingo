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
  am: { title: 'BLACK GOLD KENO', rules: 'ህጎች', sound: 'ድምጽ', turbo: 'ፈጣን', draw: 'የወጡ ቁጥሮች', picks: 'የተመረጡ', hits: 'የተዛመዱ', bet: 'ውርርድ', total: 'ጠቅላላ', game: 'ጨዋታ', history: 'ታሪክ', results: 'ውጤቶች', stats: 'ስታቲስቲክስ', live: 'የእኔ ቲኬቶች', clear: 'አጽዳ', quick: 'ፈጣን ምርጫ', selected: 'የተመረጡ ቁጥሮች', play: 'BET / ተጫወት', waiting: 'ውጤት በመጠበቅ ላይ', noTickets: 'በዚህ ዙር ገና ቲኬት የለም', noHistory: 'ገና የተጠናቀቁ ዙሮች የሉም', rounds: 'ዙሮች', tickets: 'ቲኬቶች', wagered: 'ጠቅላላ ውርርድ', won: 'ጠቅላላ ያሸነፉት', count: 'ብዛት', status: 'ሁኔታ', payout: 'ክፍያ', noWin: 'ሽልማት የለም', minMax: 'የሚፈቀደው', round: 'ዙር', drawComplete: 'ዕጣው ተጠናቋል', recent: 'የቅርብ ውጤቶች', poolNote: 'የመጨረሻ ክፍያ በዙሩ የገንዘብ ገንዳና በከፍተኛ ገደብ ሊስተካከል ይችላል።', simulation: 'የሙከራ ክሬዲት ብቻ', boardClosed: '20ዎቹ ቁጥሮች ወጥተዋል። ቀጣዩ ዙር ሲጀምር ሰሌዳው በራስ-ሰር ይመለሳል።' },
  ti: { title: 'BLACK GOLD KENO', rules: 'ሕግታት', sound: 'ድምጺ', turbo: 'ቅልጡፍ', draw: 'ዝወጹ ቁጽሪታት', picks: 'ዝተመርጹ', hits: 'ዝተሰማምዑ', bet: 'ውርርድ', total: 'ጠቕላላ', game: 'ጸወታ', history: 'ታሪኽ', results: 'ውጽኢት', stats: 'ስታቲስቲክስ', live: 'ቲኬታተይ', clear: 'ኣጽርይ', quick: 'ቅልጡፍ ምርጫ', selected: 'ዝተመርጹ ቁጽሪታት', play: 'BET / ተጻወት', waiting: 'ውጽኢት ይጽበ ኣሎ', noTickets: 'ኣብዚ ዙር ገና ቲኬት የለን', noHistory: 'ገና ዝተወድኡ ዙራት የለዉን', rounds: 'ዙራት', tickets: 'ቲኬታት', wagered: 'ጠቕላላ ውርርድ', won: 'ጠቕላላ ዝተዓወትኩም', count: 'ብዝሒ', status: 'ኩነታት', payout: 'ክፍሊት', noWin: 'ሽልማት የለን', minMax: 'ዝፍቀድ', round: 'ዙር', drawComplete: 'ዕጫ ተወዲኡ', recent: 'ናይ ቀረባ ውጽኢታት', poolNote: 'ናይ መወዳእታ ክፍሊት ብገንዘብ ገንዳ ዙርን ዝለዓለ ደረትን ክስተኻኸል ይኽእል።', simulation: 'ናይ ፈተነ ክረዲት ጥራይ', boardClosed: 'እቶም 20 ቁጽሪታት ወጺኦም። እቲ ሰሌዳ ኣብ ዝቕጽል ዙር ብኣውቶማቲክ ክምለስ እዩ።' },
  en: { title: 'BLACK GOLD KENO', rules: 'RULES', sound: 'SOUND', turbo: 'TURBO', draw: 'DRAWN NUMBERS', picks: 'PICKS', hits: 'HITS', bet: 'BET', total: 'TOTAL', game: 'GAME', history: 'HISTORY', results: 'RESULTS', stats: 'STATISTICS', live: 'MY TICKETS', clear: 'CLEAR', quick: 'QUICK PICK', selected: 'SELECTED NUMBERS', play: 'BET NOW', waiting: 'Waiting for draw', noTickets: 'No tickets in this round yet', noHistory: 'No completed rounds yet', rounds: 'Rounds', tickets: 'Tickets', wagered: 'Total wagered', won: 'Total returned', count: 'Count', status: 'Status', payout: 'Payout', noWin: 'No prize', minMax: 'Allowed', round: 'Round', drawComplete: 'DRAW COMPLETE', recent: 'RECENT RESULTS', poolNote: 'Final payouts may be adjusted by the round pool and the maximum payout cap.', simulation: 'DEMO CREDITS ONLY', boardClosed: 'All 20 numbers have been drawn. The board will return automatically when the next round opens.' },
} as const;

export function KenoGame({}: { onBack: () => void; onSwitchGame: (game: 'bingo' | 'keno' | 'aviator') => void }) {
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
    <main className="mx-auto w-full max-w-5xl space-y-3 px-2 pb-8 text-slate-100 sm:px-4">
      <header className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-400/20 bg-gradient-to-r from-[#07130f] via-[#0b2118] to-[#07130f] px-3 py-3 shadow-[0_10px_30px_rgba(0,0,0,.25)] sm:px-5">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[.32em] text-emerald-300/70">BLACK GOLD</p>
          <h1 className="text-2xl font-black italic tracking-[.12em] text-amber-300 sm:text-3xl">KENO</h1>
        </div>
        <div className="rounded-full border border-emerald-400/30 bg-black/30 px-4 py-2 text-center shadow-inner">
          <p className="font-mono text-lg font-black tabular-nums text-white sm:text-2xl">{isBetting ? `00:${String(secondsLeft).padStart(2, '0')}` : `${state?.drawnNumbers?.length ?? 0} / 20`}</p>
          <p className="text-[8px] font-bold uppercase tracking-[.2em] text-emerald-300/70">{state?.status === 'settled' ? c.drawComplete : t.bettingCloses}</p>
        </div>
        <button type="button" onClick={() => document.getElementById('keno-rules')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} aria-label={c.rules} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-amber-300/50 bg-black/30 text-xl font-black text-amber-300 shadow-[0_0_16px_rgba(245,190,60,.12)]">?</button>
      </header>

      <section className="rounded-xl border border-amber-300/50 bg-gradient-to-r from-[#173c2a] via-[#0b2118] to-[#173c2a] px-3 py-3 text-center shadow-[0_0_18px_rgba(16,185,129,.12)]">
        <p className="text-sm font-black tracking-wide text-amber-200 sm:text-base">{lang === 'am' ? 'ከ1 እስከ 80 ያሉ 10 ቁጥሮችን ይምረጡ' : lang === 'ti' ? 'ካብ 1 ክሳብ 80 ዘለዉ 10 ቁጽሪታት ምረጹ' : 'Choose 10 numbers — From 1 to 80'}</p>
        <p className="mt-1 text-[9px] font-bold uppercase tracking-[.2em] text-emerald-200/60">{selected.length} / 10 {c.picks}</p>
      </section>

      <section className="rounded-2xl border border-emerald-400/25 bg-[#081712] p-3 shadow-[inset_0_0_24px_rgba(16,185,129,.06)]">
        <div className="grid grid-cols-[minmax(88px,.72fr)_minmax(0,2fr)] items-center gap-3">
          <div className="flex flex-col items-center">
            <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-emerald-300/70">{c.draw}</p>
            <div className="grid aspect-square w-full max-w-[116px] place-items-center rounded-full border-[3px] border-amber-300 bg-[radial-gradient(circle_at_35%_28%,#fff3b0,#eab308_38%,#78350f_78%)] text-4xl font-black tabular-nums text-[#11150c] shadow-[0_0_24px_rgba(250,204,21,.32),inset_0_2px_10px_rgba(255,255,255,.65)] sm:text-5xl">{state?.drawnNumbers?.length ? state.drawnNumbers[state.drawnNumbers.length - 1] : '—'}</div>
          </div>
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-2"><p className="text-[9px] font-black uppercase tracking-widest text-emerald-300/70">{c.recent}</p><span className="shrink-0 font-mono text-[10px] font-bold text-amber-300">{state?.drawnNumbers?.length ?? 0} / 20</span></div>
            {state?.drawnNumbers?.length ? <div className="flex flex-wrap gap-1.5">{state.drawnNumbers.slice().reverse().map((n, i) => <span key={n} className={`grid h-8 w-8 place-items-center rounded-full border text-xs font-black tabular-nums sm:h-9 sm:w-9 ${i === 0 ? 'border-amber-200 bg-amber-300 text-black shadow-[0_0_12px_rgba(250,204,21,.35)]' : 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100'}`}>{n}</span>)}</div> : <p className="rounded-lg border border-dashed border-emerald-400/20 px-2 py-4 text-center text-[10px] text-slate-500">{t.waitingDraw}</p>}
          </div>
        </div>
        {latestBet && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2 text-xs"><span className="font-bold text-emerald-200">{c.hits}: <b className="text-amber-300">{latestBet.hits}</b></span><span className="font-black text-amber-300">{c.payout}: {money(latestBet.payoutEtb)} ETB</span></div>}
      </section>

      <section className="rounded-2xl border border-emerald-400/25 bg-[#081410] p-2 shadow-[0_8px_24px_rgba(0,0,0,.22)] sm:p-3">
        <div className="mb-2 flex items-center justify-between px-1"><h2 className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-300">01 — 80</h2><span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-[10px] font-black text-amber-300">{selected.length} / 10</span></div>
        <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
          {Array.from({ length: 80 }, (_, i) => i + 1).map((n) => {
            const chosen = selected.includes(n) || (!isBetting && (latestBet?.selectedNumbers.includes(n) ?? false));
            const drawn = drawSet.has(n);
            const hit = hitSet.has(n) || (chosen && drawn);
            return <button key={n} type="button" disabled={!isBetting || !!drawSet.size} onClick={() => toggle(n)} aria-pressed={chosen} aria-label={`Number ${n}${hit ? ', hit' : drawn ? ', drawn' : chosen ? ', selected' : ''}`} className={`relative grid aspect-square min-w-0 place-items-center rounded-md border text-[11px] font-black tabular-nums transition-all duration-150 active:scale-95 sm:rounded-lg sm:text-sm ${hit ? 'border-emerald-100 bg-gradient-to-br from-emerald-300 to-emerald-600 text-[#04120b] shadow-[0_0_12px_rgba(52,211,153,.5)]' : drawn ? 'border-sky-300/70 bg-sky-500/25 text-sky-100' : chosen ? 'border-amber-100 bg-gradient-to-br from-amber-200 to-amber-500 text-[#171307] shadow-[0_0_12px_rgba(245,190,60,.35)]' : 'border-slate-600/70 bg-gradient-to-b from-[#1b2926] to-[#101a18] text-slate-100 hover:border-emerald-300/70'} disabled:cursor-not-allowed disabled:opacity-90`}>{n}{!chosen && !drawn && <span className="absolute right-1 top-1 h-1 w-1 rounded-full bg-emerald-300/0" />}{hit && <span className="absolute -right-0.5 -top-1 text-[8px] text-white">★</span>}</button>;
          })}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-slate-400"><span>● <span className="text-amber-300">{lang === 'am' ? 'የተመረጠ' : 'Selected'}</span>　● <span className="text-sky-300">{lang === 'am' ? 'የወጣ' : 'Drawn'}</span>　★ <span className="text-emerald-300">{c.hits}</span></span><span className="font-bold text-emerald-300/70">{isBetting ? t.bettingCloses : c.drawComplete}</span></div>
      </section>

      <section className="rounded-xl border border-emerald-400/20 bg-[#0b1915] p-2.5">
        <div className="mb-2 flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-[.2em] text-amber-300">{t.payoutTable}</p><span className="text-[9px] text-slate-500">{selected.length}/10</span></div>
        {selected.length && state?.payoutTable[String(selected.length)] ? <div className="flex gap-2 overflow-x-auto pb-1">{Object.entries(state.payoutTable[String(selected.length)]).sort(([a], [b]) => Number(a) - Number(b)).map(([matches, multiplier]) => <div key={matches} className="min-w-[64px] rounded-lg border border-amber-300/10 bg-[#18271e] px-2 py-1.5 text-center"><p className="text-[9px] text-slate-400">{matches} {c.hits}</p><p className="text-sm font-black text-amber-300">{(multiplier / 100).toFixed(2)}×</p></div>)}</div> : <p className="text-[10px] text-slate-500">{c.selected} · {t.intro}</p>}
      </section>

      <section className="rounded-2xl border border-emerald-400/20 bg-[#081410] p-2.5">
        <div className="grid grid-cols-[40px_minmax(66px,1fr)_40px_54px_58px] items-center gap-1.5 sm:grid-cols-[52px_minmax(100px,1fr)_52px_72px_76px] sm:gap-2">
          <button type="button" disabled={!isBetting || Number(amount) <= minBet} onClick={() => adjustBet(-1)} aria-label="Decrease bet" className="rounded-lg border border-emerald-400/20 bg-[#172923] py-2.5 text-xl font-black text-emerald-200 disabled:opacity-35">−</button>
          <div className="min-w-0 text-center"><label htmlFor="keno-bet" className="block text-[8px] font-bold uppercase tracking-widest text-slate-500">{c.bet} (ETB)</label><input id="keno-bet" type="number" inputMode="decimal" min={minBet} max={maxBet} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-transparent text-center text-lg font-black tabular-nums text-white outline-none sm:text-xl" /></div>
          <button type="button" disabled={!isBetting || Number(amount) >= maxBet} onClick={() => adjustBet(1)} aria-label="Increase bet" className="rounded-lg border border-emerald-400/20 bg-[#172923] py-2.5 text-xl font-black text-emerald-200 disabled:opacity-35">+</button>
          <button type="button" disabled={!isBetting} onClick={() => adjustBet(numericAmount)} className="rounded-lg border border-emerald-300/40 bg-emerald-950/60 py-3 text-xs font-black text-emerald-200 disabled:opacity-35">X2</button>
          <button type="button" disabled={!isBetting} onClick={() => setAmount(maxBet.toFixed(2))} className="rounded-lg border border-amber-300/40 bg-amber-300/10 py-3 text-[10px] font-black text-amber-200 disabled:opacity-35">MAX</button>
        </div>
        <p className="mt-2 text-center text-[9px] text-slate-500">{c.minMax}: {money(minBet)} – {money(maxBet)} ETB</p>
        <button type="button" disabled={!isBetting || !selected.length || !validAmount || busy} onClick={() => void submit()} className="mt-2 w-full rounded-xl border border-amber-200/70 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-3.5 text-lg font-black tracking-[.18em] text-[#171307] shadow-[0_5px_18px_rgba(245,190,60,.2)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">{busy ? t.confirming : 'BET'}</button>
        {(error || notice) && <p role={error ? 'alert' : 'status'} className={`mt-2 rounded-lg px-3 py-2 text-center text-xs ${error ? 'bg-red-950/40 text-red-200' : 'bg-emerald-950/40 text-emerald-200'}`}>{error || notice}</p>}
      </section>

      <nav aria-label="Keno sections" className="grid grid-cols-4 overflow-hidden rounded-xl border border-emerald-400/25 bg-[#07130f]">
        {tabs.filter((item) => item.id !== 'live').map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} aria-current={tab === item.id ? 'page' : undefined} className={`border-r border-emerald-400/10 px-1 py-3 text-[9px] font-black uppercase tracking-wide last:border-r-0 sm:text-[11px] ${tab === item.id ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-[#171307]' : 'text-slate-400 hover:bg-emerald-400/10 hover:text-emerald-200'}`}>{item.label}</button>)}
      </nav>

      <section className="space-y-2">
        <div className="flex items-center justify-between rounded-xl border border-emerald-400/20 bg-[#0b1915] px-3 py-3">
          <div><p className="text-[9px] font-black uppercase tracking-[.2em] text-emerald-300/70">{c.live}</p><p className="text-lg font-black text-white">{state?.myBets.length ?? 0}</p></div>
          <div className="text-right"><p className="text-[9px] uppercase tracking-widest text-slate-500">{c.round}</p><p className="max-w-[150px] truncate font-mono text-[10px] text-amber-300">{state?.roundId ?? t.connecting}</p></div>
        </div>
        {tab === 'game' && (state?.myBets?.length ? state.myBets.slice().reverse().map((bet) => <BetCard key={bet.id} bet={bet} labels={c} />) : <p className="rounded-xl border border-dashed border-emerald-400/20 bg-[#0b1915] p-5 text-center text-xs text-slate-500">{c.noTickets}</p>)}
        {tab === 'live' && (state?.myBets?.length ? state.myBets.slice().reverse().map((bet) => <BetCard key={bet.id} bet={bet} labels={c} />) : <p className="rounded-xl bg-[#0b1915] p-5 text-center text-xs text-slate-500">{c.noTickets}</p>)}
        {tab === 'history' && (history.length ? history.map((round) => <div key={round.roundId} className="rounded-xl border border-white/5 bg-[#0b1915] p-3"><div className="flex items-center justify-between gap-2"><span className="truncate font-mono text-[10px] text-emerald-300">{round.roundId}</span><span className="text-[10px] text-slate-500">{round.status}</span></div><div className="mt-2 flex flex-wrap gap-1">{(round.drawnNumbers ?? []).map((n) => <span key={n} className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-100">{n}</span>)}</div><p className="mt-2 text-[10px] text-slate-400">{c.tickets}: {round.myBets.length} · {c.payout}: {money(round.myBets.reduce((s, b) => s + b.payoutEtb, 0))} ETB</p></div>) : <p className="rounded-xl bg-[#0b1915] p-5 text-center text-xs text-slate-500">{c.noHistory}</p>)}
        {tab === 'results' && (history.filter((round) => round.drawnNumbers?.length).length ? history.filter((round) => round.drawnNumbers?.length).map((round) => <div key={round.roundId} className="rounded-xl bg-[#0b1915] p-3"><p className="font-mono text-[10px] text-emerald-300">{round.roundId}</p><div className="mt-2 grid grid-cols-10 gap-1">{round.drawnNumbers!.map((n) => <span key={n} className="grid aspect-square place-items-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-100">{n}</span>)}</div></div>) : <p className="rounded-xl bg-[#0b1915] p-5 text-center text-xs text-slate-500">{c.noHistory}</p>)}
        {tab === 'statistics' && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{[[c.rounds, stats.rounds], [c.tickets, stats.tickets], [c.wagered, money(stats.wagered) + ' ETB'], [c.won, money(stats.won) + ' ETB'], [c.hits, stats.hits]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-emerald-400/10 bg-[#0b1915] p-3"><p className="text-[10px] text-slate-500">{label}</p><p className="mt-1 text-lg font-black text-emerald-300">{value}</p></div>)}</div>}
      </section>

      <details id="keno-rules" className="rounded-xl border border-amber-400/20 bg-[#0b1915] p-3 text-xs text-slate-300">
        <summary className="cursor-pointer font-black text-amber-300">{c.rules} · {t.payoutTable}</summary>
        <div className="mt-3 space-y-2"><p>{t.intro}</p><p>{t.drawInfo}</p><p>{t.multiplierInfo}</p><p className="text-amber-200/80">{c.poolNote}</p><p className="text-emerald-300">{c.simulation}</p></div>
        {state?.payoutTable && <div className="mt-3 max-h-64 overflow-auto"><table className="w-full border-collapse text-left"><thead className="sticky top-0 bg-[#0b1915] text-emerald-300"><tr><th className="p-2">{t.numbersPicked}</th><th className="p-2">{t.matchesHeader}</th><th className="p-2">{t.returnMultiplier}</th></tr></thead><tbody>{Object.entries(state.payoutTable).flatMap(([picked, hits]) => Object.entries(hits).map(([matched, multiplier]) => <tr key={picked + '-' + matched} className="border-t border-white/5"><td className="p-2">{picked}</td><td className="p-2">{matched}</td><td className="p-2 font-bold text-amber-200">{(multiplier / 100).toFixed(2)}×</td></tr>))}</tbody></table></div>}
        <p className="mt-2 text-[10px] text-slate-500">{t.allowed}: {money(minBet)}–{money(maxBet)} ETB · {t.maxPayout}: {money(state?.maxPayoutEtb ?? 20000)} ETB</p>
      </details>
      {state?.serverSeedHash && <details className="rounded-xl border border-emerald-400/10 bg-[#0b1915] p-3 text-xs text-slate-400"><summary className="cursor-pointer font-bold text-emerald-300">{t.fairness}</summary><p className="mt-2 break-all">{t.commitment}: {state.serverSeedHash}</p>{state.serverSeed ? <><p className="mt-1 break-all">{t.revealedSeed}: {state.serverSeed}</p><p className="mt-2">{t.reproducible}</p></> : <p className="mt-2">{t.seedAfter}</p>}</details>}
      <p className="text-center text-[9px] font-bold tracking-[.2em] text-emerald-300/40">{c.simulation}</p>
    </main>
  );
}

function BetCard({ bet, labels }: { bet: KenoBet; labels: (typeof copy)['en'] | (typeof copy)['am'] | (typeof copy)['ti'] }) {
  return <div className={`rounded-lg border p-2.5 ${bet.payoutEtb > 0 ? "border-emerald-400/40 bg-gradient-to-r from-[#0b2819] to-[#0b1915]" : "border-white/5 bg-[#0b1915]"}` }><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black text-emerald-300">{labels.picks}: {bet.selectedNumbers.length}</span><span className={`text-[10px] font-black ${bet.payoutEtb > 0 ? "text-emerald-300" : "text-amber-300"}`}>{bet.payoutEtb > 0 ? "WIN" : bet.status}</span></div><div className="mt-2 grid grid-cols-10 gap-1">{bet.selectedNumbers.map((n) => <span key={n} className={`grid aspect-square place-items-center rounded bg-[#1b302b] text-[10px] font-bold ${bet.matchedNumbers.includes(n) ? 'bg-emerald-400 text-black' : 'text-slate-200'}`}>{n}</span>)}</div><div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-[10px]"><span>{labels.bet}: {money(bet.stakeEtb)} ETB · {labels.hits}: {bet.hits}</span><b className="text-amber-300">{labels.payout}: {money(bet.payoutEtb)} ETB</b></div></div>;
}
