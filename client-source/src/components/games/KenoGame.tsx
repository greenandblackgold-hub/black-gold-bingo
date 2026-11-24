import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { gameUi } from '@/lib/gameUi';
import { useAuth } from '@/context/AuthContext';

type KenoBet = { id: string; status: string; stakeEtb: number; selectedNumbers: number[]; matchedNumbers: number[]; hits: number; payoutEtb: number; createdAt: number; settledAt?: number | null };
type KenoState = { payoutTable: Record<string, Record<string, number>>; enabled: boolean; balanceEtb: number; walletMode: 'shared' | 'legacy-demo'; game: 'keno'; roundId: string; status: 'betting' | 'settled'; bettingEndsAt: number; serverTime: number; serverSeedHash: string; drawnNumbers?: number[]; serverSeed?: string; myBets: KenoBet[]; minBetEtb: number; maxBetEtb: number; maxPayoutEtb: number; mode: string };
type HistoryRound = { roundId: string; status: string; drawnNumbers?: number[]; serverSeedHash: string; serverSeed?: string; myBets: KenoBet[] };
type Tab = 'game' | 'history' | 'results' | 'statistics' | 'live';

const money = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const requestId = () => 'keno_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);

const copy = {
  am: { title: 'BLACK GOLD KENO', rules: 'ህጎች', sound: 'ድምጽ', turbo: 'ፈጣን', draw: 'የወጡ ቁጥሮች', picks: 'የተመረጡ', hits: 'የተዛመዱ', bet: 'ውርርድ', total: 'ጠቅላላ', game: 'ጨዋታ', history: 'ታሪክ', results: 'ውጤቶች', stats: 'ስታቲስቲክስ', live: 'የእኔ ቲኬቶች', clear: 'አጽዳ', quick: 'ፈጣን ምርጫ', selected: 'የተመረጡ ቁጥሮች', play: 'BET / ተጫወት', waiting: 'ውጤት በመጠበቅ ላይ', noTickets: 'በዚህ ዙር ገና ቲኬት የለም', noHistory: 'ገና የተጠናቀቁ ዙሮች የሉም', rounds: 'ዙሮች', tickets: 'ቲኬቶች', wagered: 'ጠቅላላ ውርርድ', won: 'ጠቅላላ ያሸነፉት', count: 'ብዛት', status: 'ሁኔታ', payout: 'ክፍያ', noWin: 'ሽልማት የለም', minMax: 'የሚፈቀደው', round: 'ዙር', drawComplete: 'ዕጣው ተጠናቋል', recent: 'የቅርብ ውጤቶች', poolNote: 'የመጨረሻ ክፍያ በዙሩ የገንዘብ ገንዳና በከፍተኛ ገደብ ሊስተካከል ይችላል።', simulation: 'የሙከራ ክሬዲት ብቻ', boardClosed: '20ዎቹ ቁጥሮች ወጥተዋል። ቀጣዩ ዙር ሲጀምር ሰሌዳው በራስ-ሰር ይመለሳል።', fast:'ፈጣን', chooseTen:'10 ቁጥሮችን ይምረጡ', fromTo:'ከ1 እስከ 80', selectedCount:'ተመርጠዋል', decreaseBet:'ውርርድ ቀንስ', increaseBet:'ውርርድ ጨምር', openMenu:'የተጫዋች ሜኑ ክፈት', timeRemaining:'በዚህ ዙር የቀረ ጊዜ', drawnNumbersAria:'የKeno የወጡ ቁጥሮች', number:'ቁጥር', selectedState:'ተመርጧል', betButton:'ውርርድ', all:'ሁሉም', myTickets:'የእኔ ቲኬቶች', myBets:'ውርርዶቼ', ticket:'ቲኬት', waitingBet:'በመጠበቅ ላይ' },
  ti: { title: 'BLACK GOLD KENO', rules: 'ሕግታት', sound: 'ድምጺ', turbo: 'ቅልጡፍ', draw: 'ዝወጹ ቁጽሪታት', picks: 'ዝተመርጹ', hits: 'ዝተሰማምዑ', bet: 'ውርርድ', total: 'ጠቕላላ', game: 'ጸወታ', history: 'ታሪኽ', results: 'ውጽኢት', stats: 'ስታቲስቲክስ', live: 'ቲኬታተይ', clear: 'ኣጽርይ', quick: 'ቅልጡፍ ምርጫ', selected: 'ዝተመርጹ ቁጽሪታት', play: 'BET / ተጻወት', waiting: 'ውጽኢት ይጽበ ኣሎ', noTickets: 'ኣብዚ ዙር ገና ቲኬት የለን', noHistory: 'ገና ዝተወድኡ ዙራት የለዉን', rounds: 'ዙራት', tickets: 'ቲኬታት', wagered: 'ጠቕላላ ውርርድ', won: 'ጠቕላላ ዝተዓወትኩም', count: 'ብዝሒ', status: 'ኩነታት', payout: 'ክፍሊት', noWin: 'ሽልማት የለን', minMax: 'ዝፍቀድ', round: 'ዙር', drawComplete: 'ዕጫ ተወዲኡ', recent: 'ናይ ቀረባ ውጽኢታት', poolNote: 'ናይ መወዳእታ ክፍሊት ብገንዘብ ገንዳ ዙርን ዝለዓለ ደረትን ክስተኻኸል ይኽእል።', simulation: 'ናይ ፈተነ ክረዲት ጥራይ', boardClosed: 'እቶም 20 ቁጽሪታት ወጺኦም። እቲ ሰሌዳ ኣብ ዝቕጽል ዙር ብኣውቶማቲክ ክምለስ እዩ።', fast:'ቅልጡፍ', chooseTen:'10 ቁጽሪታት ምረጹ', fromTo:'ካብ 1 ክሳብ 80', selectedCount:'ተመሪጾም', decreaseBet:'ውርርድ ኣጉድል', increaseBet:'ውርርድ ወስኽ', openMenu:'ሜኑ ተጻዋታይ ክፈት', timeRemaining:'ኣብዚ ዙር ዝተረፈ ግዜ', drawnNumbersAria:'ዝወጹ ቁጽሪታት Keno', number:'ቁጽሪ', selectedState:'ተመሪጹ', betButton:'ውርርድ', all:'ኩሉ', myTickets:'ቲኬታተይ', myBets:'ውርርደይ', ticket:'ቲኬት', waitingBet:'ይጽበ ኣሎ' },
  en: { title: 'BLACK GOLD KENO', rules: 'RULES', sound: 'SOUND', turbo: 'TURBO', draw: 'DRAWN NUMBERS', picks: 'PICKS', hits: 'HITS', bet: 'BET', total: 'TOTAL', game: 'GAME', history: 'HISTORY', results: 'RESULTS', stats: 'STATISTICS', live: 'MY TICKETS', clear: 'CLEAR', quick: 'QUICK PICK', selected: 'SELECTED NUMBERS', play: 'BET NOW', waiting: 'Waiting for draw', noTickets: 'No tickets in this round yet', noHistory: 'No completed rounds yet', rounds: 'Rounds', tickets: 'Tickets', wagered: 'Total wagered', won: 'Total returned', count: 'Count', status: 'Status', payout: 'Payout', noWin: 'No prize', minMax: 'Allowed', round: 'Round', drawComplete: 'DRAW COMPLETE', recent: 'RECENT RESULTS', poolNote: 'Final payouts may be adjusted by the round pool and the maximum payout cap.', simulation: 'DEMO CREDITS ONLY', boardClosed: 'All 20 numbers have been drawn. The board will return automatically when the next round opens.', fast:'FAST', chooseTen:'Choose 10 numbers', fromTo:'From 1 to 80', selectedCount:'selected', decreaseBet:'Decrease bet', increaseBet:'Increase bet', openMenu:'Open player menu', timeRemaining:'Time remaining in this round', drawnNumbersAria:'Drawn Keno numbers', number:'Number', selectedState:'selected', betButton:'BET', all:'All', myTickets:'My Tickets', myBets:'My Bets', ticket:'Ticket', waitingBet:'Waiting' },
} as const;

export function KenoGame({ onOpenMenu }: { onBack: () => void; onSwitchGame: (game: 'bingo' | 'keno' | 'aviator' | 'mines') => void; onOpenMenu: () => void }) {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const t = gameUi.keno[lang];
  const c = copy[lang];
  const [state, setState] = useState<KenoState | null>(null);
  const stateRequestInFlight = useRef(false);
  const [history, setHistory] = useState<HistoryRound[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [amount, setAmount] = useState('2.00');
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
    const poll = window.setInterval(() => void loadState(), 1000);
    const tick = window.setInterval(() => setClock(Date.now()), 100);
    return () => { window.clearInterval(poll); window.clearInterval(tick); };
  }, [loadState, loadHistory]);
  useEffect(() => { if (state?.status === 'settled') void loadHistory(); }, [state?.status, state?.roundId, loadHistory]);

  const drawSequenceKey = (state?.drawnNumbers ?? []).slice(0, 20).join(',');
  const [visibleDrawCount, setVisibleDrawCount] = useState(0);
  const revealRoundRef = useRef('');
  useEffect(() => {
    if (!state) return;
    if (revealRoundRef.current !== state.roundId) {
      revealRoundRef.current = state.roundId;
      setVisibleDrawCount(0);
    }
    const target = Math.min(20, state.drawnNumbers?.length ?? 0);
    if (!target) { setVisibleDrawCount(0); return; }
    const reveal = window.setInterval(() => setVisibleDrawCount(current => Math.min(target, current + 1)), 115);
    return () => window.clearInterval(reveal);
  }, [state?.roundId, drawSequenceKey]);

  const visibleDrawnNumbers = (state?.drawnNumbers ?? []).slice(0, visibleDrawCount);
  const secondsLeft = state?.status === 'betting' ? Math.max(0, Math.ceil((state.bettingEndsAt - (clock + offset)) / 1000)) : 0;
  const isBetting = state?.enabled === true && state.status === 'betting' && secondsLeft > 0;
  const minBet = state?.minBetEtb ?? 2;
  const maxBet = state?.maxBetEtb ?? 1000;
  const numericAmount = Number(amount);
  const validAmount = Number.isFinite(numericAmount) && numericAmount >= minBet && numericAmount <= maxBet;
  const stats = useMemo(() => {
    const bets = history.flatMap(round => round.myBets ?? []);
    return { rounds: history.length, tickets: bets.length, wagered: bets.reduce((sum,b) => sum+b.stakeEtb,0), won: bets.reduce((sum,b) => sum+b.payoutEtb,0), hits: bets.reduce((sum,b) => sum+b.hits,0) };
  }, [history]);

  const toggle = (n: number) => setSelected(old => old.includes(n) ? old.filter(v => v !== n) : old.length >= 10 ? old : [...old,n].sort((a,b)=>a-b));
  const quickPick = () => {
    const pool = Array.from({length:80},(_,i)=>i+1);
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    setSelected(pool.slice(0,10).sort((a,b)=>a-b));
  };
  const betRequestInFlight = useRef(false);
  const submit = async () => {
    if (!selected.length || !validAmount || !isBetting || busy || betRequestInFlight.current) return;
    betRequestInFlight.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      await api.post('/api/games/keno/bets',{requestId:requestId(),amount:numericAmount,selectedNumbers:selected});
      setNotice(t.betConfirmed); setSelected([]);
      // Release the betting control as soon as the bet is accepted.
      // Balance and ticket refreshes continue without blocking the next entry.
      setBusy(false);
      void loadState();
      void loadHistory();
    } catch { setError(t.betError); }
    finally { betRequestInFlight.current = false; setBusy(false); }
  };
  const adjustBet = (delta:number) => setAmount(old => {
    const current=Number(old); const next=(Number.isFinite(current)?current:minBet)+delta;
    return Math.min(maxBet,Math.max(minBet,next)).toFixed(2);
  });
  const tabs: {id:Tab;label:string}[] = [
    {id:'game',label:c.game},{id:'history',label:c.history},{id:'results',label:c.results},{id:'statistics',label:c.stats},{id:'live',label:c.live}
  ];
  const inDrawPhase = !isBetting && visibleDrawnNumbers.length > 0;
  const liveBall = visibleDrawnNumbers[visibleDrawnNumbers.length-1];
  const previousBalls = visibleDrawnNumbers.slice(-8,-1);

  return (
    <main className="keno-reference-page mx-auto min-h-[100dvh] w-full max-w-[480px] space-y-2 bg-[#050505] px-2 text-[#f3dfad] sm:px-3">
      <header className="keno-topbar">
        <div className="keno-brand"><span>{c.fast}</span><strong>KENO</strong></div>
        <div className="keno-account">
          <span>{money(state?.balanceEtb ?? user?.balance ?? 0)} ETB</span>
          <i />
          <span>ID: {user?.id ? user.id.slice(-9) : '—'}</span>
          <b aria-label="Verified">✓</b>
        </div>
        <button type="button" onClick={onOpenMenu} aria-label={c.openMenu} className="keno-menu">☰</button>
      </header>

      {isBetting && <div aria-label={c.timeRemaining} className="h-5 text-center font-mono text-[17px] font-black leading-5 tracking-wider text-emerald-100">{'00:' + String(secondsLeft).padStart(2, '0')}</div>}

      {isBetting && <section className="keno-bet-panel overflow-hidden rounded-lg border border-emerald-300/10 bg-[#11100c] shadow-inner">
        <div className="relative flex min-h-[164px] items-center gap-3 overflow-hidden px-3 py-3">
          <div aria-hidden="true" className="pointer-events-none absolute -left-8 top-[-100px] h-64 w-64 rounded-full border border-emerald-200/10 shadow-[0_0_0_22px_rgba(16,185,129,.025),0_0_0_44px_rgba(16,185,129,.02)]" />
          <div className="relative flex w-[92px] shrink-0 flex-col items-center justify-center">
            <div className="flex h-9 items-center gap-1">{selected.slice(-2).map(n=><span key={n} className="keno-mini-ball grid h-8 w-8 place-items-center rounded-full border border-slate-400/50 bg-[radial-gradient(circle_at_30%_25%,#71858c,#243943_65%,#101c22)] text-[11px] font-black shadow-lg">{n}</span>)}</div>
            <span className="keno-selection-count mt-1 grid h-[58px] w-[58px] place-items-center rounded-full border-2 border-emerald-200/80 bg-[radial-gradient(circle_at_30%_25%,#8fffd0,#16885e_55%,#063e30)] text-4xl font-black italic text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,.25),inset_0_2px_8px_rgba(255,255,255,.35)]">{selected.length}</span>
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="absolute right-0 top-0 grid h-7 w-7 place-items-center rounded-full border border-emerald-300/15 bg-emerald-950/30 text-lg font-bold text-emerald-300/70">?</div>
            <h2 className="pr-8 text-[20px] font-black leading-tight text-white">{c.chooseTen}</h2>
            <p className="mt-1 text-[17px] font-black text-emerald-300">{c.fromTo}</p>
            <p className="mt-2 text-[10px] font-semibold text-emerald-100/55">{selected.length}/10 {c.selectedCount}</p>
          </div>
        </div>
        <div className="keno-number-grid grid grid-cols-10 gap-[3px] bg-[#090909] p-[3px]">
          {Array.from({length:80},(_,i)=>i+1).map(n=>{
            const chosen=selected.includes(n);
            const previous=history[0]?.drawnNumbers?.includes(n) ?? false;
            return <button key={n} type="button" disabled={!isBetting} onClick={()=>toggle(n)} aria-pressed={chosen} aria-label={c.number+' '+n+(chosen?', '+c.selectedState:'')} className={'relative grid aspect-square min-w-0 place-items-center border text-[clamp(11px,3.6vw,17px)] font-black tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,.05)] '+(chosen?'border-emerald-200 bg-emerald-400 text-[#061c14]':'border-[#35413f] bg-[linear-gradient(145deg,#394442,#242d2b)] text-slate-300 hover:bg-[#46524f]')}>
              {n}{previous&&<span className="absolute right-[2px] top-[2px] h-[5px] w-[5px] rounded-full bg-sky-300 shadow-[0_0_5px_rgba(125,211,252,.6)]"/>}
            </button>;
          })}
        </div>
        <div className="keno-stake-controls grid grid-cols-[minmax(0,1fr)_66px_66px] items-stretch gap-[3px] bg-[#090909] p-[3px]">
          <div className="flex h-[58px] items-center justify-between rounded-sm bg-[#253330] px-3">
            <button type="button" disabled={!isBetting||Number(amount)<=minBet} onClick={()=>adjustBet(-1)} aria-label={c.decreaseBet} className="text-3xl font-black text-slate-300 disabled:opacity-30">−</button>
            <span className="text-[25px] font-black tabular-nums text-white">{Number(amount).toLocaleString(undefined,{maximumFractionDigits:2})}</span>
            <button type="button" disabled={!isBetting||Number(amount)>=maxBet} onClick={()=>adjustBet(1)} aria-label={c.increaseBet} className="text-3xl font-black text-slate-300 disabled:opacity-30">+</button>
          </div>
          <button type="button" disabled={!isBetting} onClick={()=>adjustBet(numericAmount)} className="rounded-sm bg-[#263b34] text-[12px] font-black text-emerald-300 disabled:opacity-40">X2</button>
          <button type="button" disabled={!isBetting} onClick={()=>setAmount(maxBet.toFixed(2))} className="rounded-sm bg-[#263b34] text-[12px] font-black text-emerald-300 disabled:opacity-40">MAX</button>
        </div>
        <button type="button" disabled={!isBetting||!selected.length||!validAmount||busy} onClick={()=>void submit()} className="keno-bet-submit w-full rounded-b-md border-t border-emerald-200/15 bg-gradient-to-b from-[#276b4b] to-[#17432f] py-3 text-[25px] font-black text-slate-200 shadow-inner disabled:opacity-45">{busy?t.confirming:c.betButton}</button>
        {(error||notice)&&<p role={error?'alert':'status'} className={'px-3 py-2 text-center text-xs '+(error?'bg-red-950/50 text-red-200':'bg-emerald-950/50 text-emerald-200')}>{error||notice}</p>}
        <div className="flex justify-between px-2 py-1 text-[9px] text-emerald-100/50"><span>Minimum {money(minBet)} ETB</span><span>Maximum {money(maxBet)} ETB</span><button type="button" onClick={()=>document.getElementById('keno-rules')?.scrollIntoView({behavior:'smooth',block:'center'})}>{c.rules}</button></div>
      </section>}

      {inDrawPhase && <section className="keno-draw-stage relative flex min-h-[188px] flex-col items-center justify-center overflow-hidden rounded-lg bg-[#101b19] px-2 py-2">
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/10 shadow-[0_0_0_18px_rgba(16,185,129,.025),0_0_0_38px_rgba(16,185,129,.02),0_0_0_58px_rgba(16,185,129,.015)]"/>
        <div className="relative mb-1 flex h-[90px] w-full items-center justify-center"><span key={liveBall} className="keno-live-ball grid h-[88px] w-[88px] place-items-center rounded-full border border-slate-500/70 bg-[radial-gradient(circle_at_32%_22%,#84949a,#304550_48%,#0b1720_76%)] text-[42px] font-black text-white shadow-[inset_0_3px_8px_rgba(255,255,255,.3),0_8px_25px_rgba(0,0,0,.65)]">{liveBall}</span><span className="absolute right-2 top-0 font-mono text-xs font-black text-white">{visibleDrawnNumbers.length} <i className="text-emerald-300">/</i> 20</span></div>
        <div className="relative flex min-h-9 max-w-full items-center justify-center gap-1.5 overflow-hidden">{previousBalls.map((n,i)=><span key={n} className="keno-drawn-preview-ball grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-500/60 bg-[radial-gradient(circle_at_35%_25%,#536873,#1c303b_58%,#07141b)] text-[11px] font-black text-white">{n}</span>)}</div>
      </section>}

      {!isBetting && state?.status === 'settled' && <section className="keno-draw-stage relative overflow-hidden rounded-lg bg-[#101b19] px-1 py-3">
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[-110px] h-64 w-64 -translate-x-1/2 rounded-full border border-emerald-300/10 shadow-[0_0_0_22px_rgba(16,185,129,.025),0_0_0_44px_rgba(16,185,129,.02)]"/>
        <div className="relative mb-2 flex justify-end pr-2 font-mono text-xs font-black text-white">{visibleDrawnNumbers.length} <span className="px-1 text-emerald-300">/</span> 20</div>
        <div aria-label={c.drawnNumbersAria} aria-live="polite" className="relative grid grid-cols-10 gap-1.5 sm:gap-2">
          {visibleDrawnNumbers.map((n,i)=><span key={n} className="keno-drawn-ball grid aspect-square min-w-0 place-items-center rounded-full border border-slate-500/70 bg-[radial-gradient(circle_at_35%_25%,#536873,#1c303b_58%,#07141b)] text-[11px] font-black tabular-nums text-white shadow-[inset_0_2px_4px_rgba(255,255,255,.18),0_3px_8px_rgba(0,0,0,.45)] sm:text-sm" style={{animationDelay:(i%10)*18+'ms'}}>{n}</span>)}
        </div>
      </section>}

      {!isBetting && !inDrawPhase && state?.status !== 'settled' && <section className="grid min-h-[120px] place-items-center rounded-lg bg-[#101b19] text-sm text-emerald-100/60">{t.waitingDraw}</section>}

      <nav aria-label="Keno sections" className="keno-tabs flex items-center gap-4 overflow-x-auto border-b border-emerald-400/20 bg-[#101b19] px-1 py-2 text-[11px] font-black uppercase tracking-wide [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map(item=><button key={item.id} type="button" onClick={()=>setTab(item.id)} aria-current={tab===item.id?'page':undefined} className={'flex shrink-0 items-center gap-1 whitespace-nowrap border-b-2 pb-1 '+(tab===item.id?'border-emerald-300 text-emerald-300':'border-transparent text-emerald-100/55')}><span aria-hidden="true">{item.id==='game'?'▶':item.id==='history'?'◴':item.id==='results'?'✓':item.id==='statistics'?'▥':'♛'}</span>{item.label}</button>)}
      </nav>

      <div className="keno-counts grid grid-cols-3 items-center bg-[#101b19] px-2 py-1 text-[10px] text-emerald-100/65">
        <div><span className="block text-[9px]">{c.all}</span><b className="font-mono text-emerald-300">{history.length}</b></div>
        <div className="text-center"><span className="block text-[9px]">{c.myTickets}</span><b className="font-mono text-emerald-300">{state?.myBets.length??0}</b></div>
        <div className="text-right"><span className="block text-[9px]">{c.myBets}</span><b className="font-mono text-emerald-300">{state?.myBets.length??0}</b></div>
      </div>

      {tab==='game' && <section className="space-y-1.5">{state?.myBets?.length?state.myBets.slice().reverse().map(bet=><BetCard key={bet.id} bet={bet} labels={c}/>):<div className="rounded-lg border border-dashed border-emerald-400/20 bg-[#0b1915] px-3 py-5 text-center text-xs font-bold text-emerald-100/70">{c.noTickets}</div>}</section>}
      {tab==='live' && <section className="space-y-1.5">{state?.myBets?.length?state.myBets.slice().reverse().map(bet=><BetCard key={bet.id} bet={bet} labels={c}/>):<p className="rounded-lg bg-[#0b1915] p-5 text-center text-xs text-slate-500">{c.noTickets}</p>}</section>}
      {tab==='history' && <section className="space-y-2">{history.length?history.map(round=><article key={round.roundId} className="rounded-lg border border-emerald-400/15 bg-[#0b1915] p-3"><div className="flex items-center justify-between gap-2"><span className="truncate font-mono text-[10px] font-bold text-emerald-300">{round.roundId}</span><span className="text-[10px] text-slate-400">{round.status === 'settled' ? c.drawComplete : round.status}</span></div><div className="mt-2 grid grid-cols-10 gap-1">{(round.drawnNumbers??[]).slice(0,20).map(n=><span key={n} className="grid aspect-square place-items-center rounded-full border border-emerald-400/20 bg-[#1c3430] text-[10px] font-black text-white">{n}</span>)}</div><p className="mt-2 text-[10px] text-slate-400">{c.tickets}: {round.myBets.length} · {c.payout}: {money(round.myBets.reduce((sum,b)=>sum+b.payoutEtb,0))} ETB</p></article>):<p className="rounded-lg bg-[#0b1915] p-5 text-center text-xs text-slate-500">{c.noHistory}</p>}</section>}
      {tab==='results' && <section className="space-y-2">{history.filter(round=>round.drawnNumbers?.length).length?history.filter(round=>round.drawnNumbers?.length).map(round=><article key={round.roundId} className="rounded-lg border border-emerald-400/15 bg-[#0b1915] p-3"><p className="font-mono text-[10px] text-emerald-300">{round.roundId}</p><div className="mt-2 grid grid-cols-10 gap-1">{(round.drawnNumbers??[]).slice(0,20).map(n=><span key={n} className="grid aspect-square place-items-center rounded-full bg-[#1c3430] text-[10px] font-bold text-emerald-100">{n}</span>)}</div></article>):<p className="rounded-lg bg-[#0b1915] p-5 text-center text-xs text-slate-500">{c.noHistory}</p>}</section>}
      {tab==='statistics' && <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">{[[c.rounds,stats.rounds],[c.tickets,stats.tickets],[c.wagered,money(stats.wagered)+' ETB'],[c.won,money(stats.won)+' ETB'],[c.hits,stats.hits]].map(([label,value])=><div key={String(label)} className="rounded-lg border border-emerald-400/15 bg-[#0b1915] p-3"><p className="text-[10px] text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-emerald-300">{value}</p></div>)}</section>}

      <details id="keno-rules" className="rounded-lg border border-emerald-400/15 bg-[#0b1915] p-3 text-xs text-slate-300">
        <summary className="cursor-pointer font-black text-emerald-300">{c.rules} · {t.payoutTable}</summary>
        <div className="mt-3 space-y-2"><p>{t.intro}</p><p>{t.drawInfo}</p><p>{t.multiplierInfo}</p><p className="text-emerald-300/80">{c.poolNote}</p><p className="text-emerald-300">{c.simulation}</p></div>
        {state?.payoutTable&&<div className="mt-3 max-h-64 overflow-auto"><table className="w-full border-collapse text-left"><thead className="sticky top-0 bg-[#0b1915] text-emerald-300"><tr><th className="p-2">{t.numbersPicked}</th><th className="p-2">{t.matchesHeader}</th><th className="p-2">{t.returnMultiplier}</th></tr></thead><tbody>{Object.entries(state.payoutTable).flatMap(([picked,hits])=>Object.entries(hits).map(([matched,multiplier])=><tr key={picked+'-'+matched} className="border-t border-white/5"><td className="p-2">{picked}</td><td className="p-2">{matched}</td><td className="p-2 font-bold text-emerald-200">{(multiplier/100).toFixed(2)}×</td></tr>))}</tbody></table></div>}
        <p className="mt-2 text-[10px] text-slate-500">{t.allowed}: {money(minBet)}–{money(maxBet)} ETB · {t.maxPayout}: {money(state?.maxPayoutEtb??20000)} ETB</p>
      </details>
      {state?.serverSeedHash&&<details className="rounded-lg border border-emerald-400/10 bg-[#0b1915] p-3 text-xs text-slate-400"><summary className="cursor-pointer font-bold text-emerald-300">{t.fairness}</summary><p className="mt-2 break-all">{t.commitment}: {state.serverSeedHash}</p>{state.serverSeed?<><p className="mt-1 break-all">{t.revealedSeed}: {state.serverSeed}</p><p className="mt-2">{t.reproducible}</p></>:<p className="mt-2">{t.seedAfter}</p>}</details>}
      <p className="text-center text-[9px] font-bold tracking-[.2em] text-emerald-300/35">{c.simulation}</p>
    </main>
  );
}

function BetCard({ bet, labels }: { bet: KenoBet; labels: (typeof copy)['en'] | (typeof copy)['am'] | (typeof copy)['ti'] }) {
  return <article className={'overflow-hidden rounded-lg border p-1.5 '+(bet.payoutEtb>0?'border-emerald-400/40 bg-[#16432f]':'border-white/5 bg-[#172421]')}>
    <div className="px-1 pb-1 text-[11px] font-black text-emerald-300">{labels.ticket} {bet.id.slice(0,1)}***{bet.id.slice(-1)}</div>
    <div className="grid grid-cols-10 gap-1">{Array.from({length:10},(_,i)=>{const n=bet.selectedNumbers[i];return <div key={i} className={'grid aspect-square min-w-0 place-items-center rounded-sm border border-white/5 text-xs font-black tabular-nums '+(n===undefined?'bg-[#101b19]':bet.matchedNumbers.includes(n)?'bg-emerald-400 text-[#062014]':'bg-[#34484a] text-white')}>{n??''}</div>})}</div>
    <div className="mt-1 flex items-center justify-between gap-2 border-t border-white/5 px-1 pt-1 text-[10px]"><span className="font-bold text-slate-100">{labels.bet} {money(bet.stakeEtb)} ETB</span><span className="font-black text-emerald-300">{bet.payoutEtb>0?money(bet.payoutEtb):['active','pending','waiting'].includes(bet.status.toLowerCase())?labels.waitingBet:bet.hits+' '+labels.hits}</span></div>
  </article>;
}
