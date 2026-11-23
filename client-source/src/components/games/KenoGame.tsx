import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const stateRequestInFlight = useRef(false);
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
    if (stateRequestInFlight.current) return;
    stateRequestInFlight.current = true;
    try {
      const next = await api.get<KenoState>('/api/games/keno/state');
      setState(next);
      setOffset(next.serverTime - Date.now());
      setError('');
    } catch { setError(t.loadError); }
    finally { stateRequestInFlight.current = false; }
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
  const drawSequenceKey = (state?.drawnNumbers ?? []).slice(0, 20).join(',');
  const [visibleDrawCount, setVisibleDrawCount] = useState(0);
  useEffect(() => {
    setVisibleDrawCount(0);
    if (!drawSequenceKey) return;
    let count = 0;
    const reveal = window.setInterval(() => {
      count += 1;
      setVisibleDrawCount(count);
      if (count >= 20) window.clearInterval(reveal);
    }, 110);
    return () => window.clearInterval(reveal);
  }, [drawSequenceKey]);
  const visibleDrawnNumbers = (state?.drawnNumbers ?? []).slice(0, visibleDrawCount);


  const secondsLeft = state?.status === 'betting' ? Math.max(0, Math.ceil((state.bettingEndsAt - (clock + offset)) / 1000)) : 0;
  const isBetting = state?.enabled === true && state.status === 'betting' && secondsLeft > 0;
  const drawSet = useMemo(() => new Set(state?.drawnNumbers ?? []), [state?.drawnNumbers]);
  const latestBet = state?.myBets?.[state.myBets.length - 1];
  const hitSet = useMemo(() => new Set(latestBet?.matchedNumbers ?? []), [latestBet?.id, latestBet?.matchedNumbers]);
  const minBet = state?.minBetEtb ?? 2;
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
    <main className="keno-reference-page mx-auto w-full max-w-5xl space-y-2 px-2 pb-8 text-slate-100 sm:px-3">
      <section className="relative isolate overflow-hidden rounded-xl border border-emerald-400/15 bg-[#07130f] px-2 pb-3 pt-2 shadow-[0_12px_35px_rgba(0,0,0,.45)]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 -translate-y-1/3 rounded-full border border-emerald-300/10" />
          <div className="absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 -translate-y-1/3 rounded-full border border-emerald-300/10" />
          <div className="absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 -translate-y-1/3 rounded-full border border-emerald-300/10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_8%,rgba(16,185,129,.14),transparent_58%)]" />
        </div>
        <div className="relative flex items-start justify-between gap-2">
          <div><p className="text-[10px] font-black italic leading-none text-white">FAST</p><h1 className="text-lg font-black italic leading-none text-emerald-300">KENO</h1></div>
          <div className="rounded-full border border-emerald-400/20 bg-black/35 px-3 py-1 text-center"><p className="font-mono text-[10px] font-bold text-emerald-100">{isBetting ? "00:" + String(secondsLeft).padStart(2, '0') : c.drawComplete}</p></div>
          <button type="button" onClick={() => document.getElementById('keno-rules')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} aria-label={c.rules} className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-300/20 bg-black/30 text-base font-black text-emerald-300">☰</button>
        </div>
        <div className="relative mt-2 flex justify-end"><span className="font-mono text-xs font-black text-white">{visibleDrawnNumbers.length} <span className="text-emerald-300">/</span> 20</span></div>
        <div aria-label="Drawn Keno numbers" aria-live="polite" className="relative mt-16 grid grid-cols-10 gap-1.5 sm:gap-2">
          {visibleDrawnNumbers.map((n,i)=><span key={n} className="keno-drawn-ball grid aspect-square min-w-0 place-items-center rounded-full border border-slate-500/70 bg-[radial-gradient(circle_at_35%_25%,#536873,#1c303b_58%,#07141b)] text-[11px] font-black tabular-nums text-white shadow-[inset_0_2px_4px_rgba(255,255,255,.18),0_3px_8px_rgba(0,0,0,.45)] sm:text-sm" style={{animationDelay:(i%10)*18+'ms'}}>{n}</span>)}
          {Array.from({length:Math.max(0,20-visibleDrawnNumbers.length)},(_,i)=><span key={'empty-'+i} aria-hidden="true" className="aspect-square min-w-0 rounded-full border border-emerald-300/5 bg-black/10"/>)}
        </div>
        {!visibleDrawnNumbers.length && <p className="relative mt-2 text-center text-[10px] text-emerald-100/45">{t.waitingDraw}</p>}
      </section>

      <nav aria-label="Keno sections" className="flex items-center gap-4 overflow-x-auto border-b border-emerald-400/20 px-1 py-2 text-[11px] font-black uppercase tracking-wide [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map(item=><button key={item.id} type="button" onClick={()=>setTab(item.id)} aria-current={tab===item.id?'page':undefined} className={'flex shrink-0 items-center gap-1 whitespace-nowrap border-b-2 pb-1 '+(tab===item.id?'border-emerald-300 text-emerald-300':'border-transparent text-emerald-100/55')}><span aria-hidden="true">{item.id==='game'?'▶':item.id==='history'?'◴':item.id==='results'?'✓':item.id==='statistics'?'▥':'♛'}</span>{item.label}</button>)}
      </nav>

      <div className="grid grid-cols-3 items-center px-2 py-1 text-[10px] text-emerald-100/65">
        <div><span className="block text-[9px]">All rounds</span><b className="font-mono text-emerald-300">{history.length}</b></div>
        <div className="text-center"><span className="block text-[9px]">My Tickets</span><b className="font-mono text-emerald-300">{state?.myBets.length??0}</b></div>
        <div className="text-right"><span className="block text-[9px]">My Bets</span><b className="font-mono text-emerald-300">{state?.myBets.length??0}</b></div>
      </div>

      {tab==='game' && <section className="space-y-1.5">{state?.myBets?.length?state.myBets.slice().reverse().map(bet=><BetCard key={bet.id} bet={bet} labels={c}/>):<div className="rounded-lg border border-dashed border-emerald-400/20 bg-[#0b1915] px-3 py-5 text-center text-xs font-bold text-emerald-100/70">{c.noTickets}</div>}</section>}
      {tab==='live' && <section className="space-y-1.5">{state?.myBets?.length?state.myBets.slice().reverse().map(bet=><BetCard key={bet.id} bet={bet} labels={c}/>):<p className="rounded-lg bg-[#0b1915] p-5 text-center text-xs text-slate-500">{c.noTickets}</p>}</section>}
      {tab==='history' && <section className="space-y-2">{history.length?history.map(round=><article key={round.roundId} className="rounded-lg border border-emerald-400/15 bg-[#0b1915] p-3"><div className="flex items-center justify-between gap-2"><span className="truncate font-mono text-[10px] font-bold text-emerald-300">{round.roundId}</span><span className="text-[10px] text-slate-400">{round.status}</span></div><div className="mt-2 grid grid-cols-10 gap-1">{(round.drawnNumbers??[]).slice(0,20).map(n=><span key={n} className="grid aspect-square place-items-center rounded-full border border-emerald-400/20 bg-[#1c3430] text-[10px] font-black text-white">{n}</span>)}</div><p className="mt-2 text-[10px] text-slate-400">{c.tickets}: {round.myBets.length} · {c.payout}: {money(round.myBets.reduce((sum,b)=>sum+b.payoutEtb,0))} ETB</p></article>):<p className="rounded-lg bg-[#0b1915] p-5 text-center text-xs text-slate-500">{c.noHistory}</p>}</section>}
      {tab==='results' && <section className="space-y-2">{history.filter(round=>round.drawnNumbers?.length).length?history.filter(round=>round.drawnNumbers?.length).map(round=><article key={round.roundId} className="rounded-lg border border-emerald-400/15 bg-[#0b1915] p-3"><p className="font-mono text-[10px] text-emerald-300">{round.roundId}</p><div className="mt-2 grid grid-cols-10 gap-1">{(round.drawnNumbers??[]).slice(0,20).map(n=><span key={n} className="grid aspect-square place-items-center rounded-full bg-[#1c3430] text-[10px] font-bold text-emerald-100">{n}</span>)}</div></article>):<p className="rounded-lg bg-[#0b1915] p-5 text-center text-xs text-slate-500">{c.noHistory}</p>}</section>}
      {tab==='statistics' && <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">{[[c.rounds,stats.rounds],[c.tickets,stats.tickets],[c.wagered,money(stats.wagered)+' ETB'],[c.won,money(stats.won)+' ETB'],[c.hits,stats.hits]].map(([label,value])=><div key={String(label)} className="rounded-lg border border-emerald-400/15 bg-[#0b1915] p-3"><p className="text-[10px] text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-emerald-300">{value}</p></div>)}</section>}

      <details className="rounded-lg border border-emerald-400/20 bg-[#0b1915]">
        <summary className="cursor-pointer px-3 py-3 text-xs font-black text-emerald-300">{c.selected} · {selected.length}/10 <span className="float-right text-emerald-100/50">＋</span></summary>
        <div className="space-y-3 border-t border-emerald-400/10 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] text-slate-400">{lang==='am'?'ከ1 እስከ 80 ያሉ 10 ቁጥሮችን ይምረጡ':lang==='ti'?'ካብ 1 ክሳብ 80 ዘለዉ 10 ቁጽሪታት ምረጹ':'Choose up to 10 numbers from 1–80'}</p><button type="button" disabled={!isBetting} onClick={quickPick} className="rounded-md border border-emerald-300/30 bg-emerald-950/50 px-3 py-1.5 text-[10px] font-black text-emerald-200 disabled:opacity-40">{c.quick}</button></div>
          {state?.status !== 'settled' && <div className="grid grid-cols-10 gap-1">{Array.from({length:80},(_,i)=>i+1).map(n=>{const chosen=selected.includes(n)||(!isBetting&&(latestBet?.selectedNumbers.includes(n)??false));const drawn=drawSet.has(n);const hit=hitSet.has(n)||(chosen&&drawn);return <button key={n} type="button" disabled={!isBetting||!!drawSet.size} onClick={()=>toggle(n)} aria-pressed={chosen} aria-label={'Number '+n+(hit?', hit':drawn?', drawn':chosen?', selected':'')} className={'relative grid aspect-square min-w-0 place-items-center rounded-md border text-[10px] font-black tabular-nums '+(hit?'border-emerald-100 bg-emerald-400 text-[#04120b]':drawn?'border-sky-300/70 bg-sky-500/25 text-sky-100':chosen?'border-amber-100 bg-amber-400 text-[#171307]':'border-slate-600/70 bg-[#17231f] text-slate-100')}>{n}{hit&&<span className="absolute -right-0.5 -top-1 text-[8px] text-white">★</span>}</button>})}</div>}
          <div className="grid grid-cols-[40px_minmax(66px,1fr)_40px_54px_58px] items-center gap-1.5">
            <button type="button" disabled={!isBetting||Number(amount)<=minBet} onClick={()=>adjustBet(-1)} aria-label="Decrease bet" className="rounded-lg border border-emerald-400/20 bg-[#172923] py-2 text-xl font-black text-emerald-200 disabled:opacity-35">−</button>
            <div className="min-w-0 text-center"><label htmlFor="keno-bet" className="block text-[8px] font-bold uppercase tracking-widest text-slate-500">{c.bet} (ETB)</label><input id="keno-bet" type="number" inputMode="decimal" min={minBet} max={maxBet} step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full bg-transparent text-center text-base font-black tabular-nums text-white outline-none"/></div>
            <button type="button" disabled={!isBetting||Number(amount)>=maxBet} onClick={()=>adjustBet(1)} aria-label="Increase bet" className="rounded-lg border border-emerald-400/20 bg-[#172923] py-2 text-xl font-black text-emerald-200 disabled:opacity-35">+</button>
            <button type="button" disabled={!isBetting} onClick={()=>adjustBet(numericAmount)} className="rounded-lg border border-emerald-300/40 bg-emerald-950/60 py-2 text-xs font-black text-emerald-200 disabled:opacity-35">X2</button>
            <button type="button" disabled={!isBetting} onClick={()=>setAmount(maxBet.toFixed(2))} className="rounded-lg border border-amber-300/40 bg-amber-300/10 py-2 text-[10px] font-black text-amber-200 disabled:opacity-35">MAX</button>
          </div>
          <p className="text-center text-[9px] text-slate-500">{c.minMax}: {money(minBet)} – {money(maxBet)} ETB</p>
          <button type="button" disabled={!isBetting||!selected.length||!validAmount||busy} onClick={()=>void submit()} className="w-full rounded-lg border border-emerald-200/70 bg-gradient-to-r from-emerald-600 to-emerald-400 py-3 text-base font-black tracking-widest text-[#04120b] disabled:opacity-40">{busy?t.confirming:c.play}</button>
          {(error||notice)&&<p role={error?'alert':'status'} className={'rounded-lg px-3 py-2 text-center text-xs '+(error?'bg-red-950/40 text-red-200':'bg-emerald-950/40 text-emerald-200')}>{error||notice}</p>}
          <div className="rounded-lg border border-amber-300/10 bg-[#101d18] p-2"><p className="mb-2 text-[9px] font-black uppercase tracking-wide text-amber-300">{t.payoutTable}</p>{selected.length&&state?.payoutTable[String(selected.length)]?<div className="flex gap-2 overflow-x-auto pb-1">{Object.entries(state.payoutTable[String(selected.length)]).sort(([a],[b])=>Number(a)-Number(b)).map(([matches,multiplier])=><div key={matches} className="min-w-[60px] rounded-md border border-amber-300/10 bg-[#18271e] px-2 py-1.5 text-center"><p className="text-[9px] text-slate-400">{matches} {c.hits}</p><p className="text-sm font-black text-amber-300">{(multiplier/100).toFixed(2)}×</p></div>)}</div>:<p className="text-[10px] text-slate-500">{c.selected} · {t.intro}</p>}</div>
        </div>
      </details>

      <details id="keno-rules" className="rounded-lg border border-amber-400/20 bg-[#0b1915] p-3 text-xs text-slate-300">
        <summary className="cursor-pointer font-black text-amber-300">{c.rules} · {t.payoutTable}</summary>
        <div className="mt-3 space-y-2"><p>{t.intro}</p><p>{t.drawInfo}</p><p>{t.multiplierInfo}</p><p className="text-amber-200/80">{c.poolNote}</p><p className="text-emerald-300">{c.simulation}</p></div>
        {state?.payoutTable&&<div className="mt-3 max-h-64 overflow-auto"><table className="w-full border-collapse text-left"><thead className="sticky top-0 bg-[#0b1915] text-emerald-300"><tr><th className="p-2">{t.numbersPicked}</th><th className="p-2">{t.matchesHeader}</th><th className="p-2">{t.returnMultiplier}</th></tr></thead><tbody>{Object.entries(state.payoutTable).flatMap(([picked,hits])=>Object.entries(hits).map(([matched,multiplier])=><tr key={picked+'-'+matched} className="border-t border-white/5"><td className="p-2">{picked}</td><td className="p-2">{matched}</td><td className="p-2 font-bold text-amber-200">{(multiplier/100).toFixed(2)}×</td></tr>))}</tbody></table></div>}
        <p className="mt-2 text-[10px] text-slate-500">{t.allowed}: {money(minBet)}–{money(maxBet)} ETB · {t.maxPayout}: {money(state?.maxPayoutEtb??20000)} ETB</p>
      </details>
      {state?.serverSeedHash&&<details className="rounded-lg border border-emerald-400/10 bg-[#0b1915] p-3 text-xs text-slate-400"><summary className="cursor-pointer font-bold text-emerald-300">{t.fairness}</summary><p className="mt-2 break-all">{t.commitment}: {state.serverSeedHash}</p>{state.serverSeed?<><p className="mt-1 break-all">{t.revealedSeed}: {state.serverSeed}</p><p className="mt-2">{t.reproducible}</p></>:<p className="mt-2">{t.seedAfter}</p>}</details>}
      <p className="text-center text-[9px] font-bold tracking-[.2em] text-emerald-300/35">{c.simulation}</p>
    </main>
  );
}

function BetCard({ bet, labels }: { bet: KenoBet; labels: (typeof copy)['en'] | (typeof copy)['am'] | (typeof copy)['ti'] }) {
  return <article className={'overflow-hidden rounded-lg border p-1.5 '+(bet.payoutEtb>0?'border-emerald-400/40 bg-[#16432f]':'border-white/5 bg-[#172421]')}>
    <div className="px-1 pb-1 text-[11px] font-black text-emerald-300">{bet.id.slice(-5)}</div>
    <div className="grid grid-cols-10 gap-1">{Array.from({length:10},(_,i)=>{const n=bet.selectedNumbers[i];return <div key={i} className={'grid aspect-square min-w-0 place-items-center rounded-sm border border-white/5 text-xs font-black tabular-nums '+(n===undefined?'bg-[#101b19]':bet.matchedNumbers.includes(n)?'bg-emerald-400 text-[#062014]':'bg-[#34484a] text-white')}>{n??''}</div>})}</div>
    <div className="mt-1 flex items-center justify-between gap-2 border-t border-white/5 px-1 pt-1 text-[10px]"><span className="font-bold text-slate-100">{labels.bet} {money(bet.stakeEtb)} ETB</span><span className="font-black text-emerald-300">{bet.payoutEtb>0?money(bet.payoutEtb):bet.hits+' '+labels.hits}</span></div>
  </article>;
}
