import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { gameUi } from '@/lib/gameUi';
import { useAuth } from '@/context/AuthContext';

type KenoBet = { id: string; status: string; stakeEtb: number; selectedNumbers: number[]; matchedNumbers: number[]; hits: number; payoutEtb: number; createdAt: number; settledAt?: number | null };
type KenoState = { payoutTable: Record<string, Record<string, number>>; enabled: boolean; balanceEtb: number; walletMode: 'shared' | 'legacy-demo'; game: 'keno'; roundId: string; status: 'betting' | 'settled'; bettingEndsAt: number; nextRoundAt?: number | null; serverTime: number; serverSeedHash: string; drawIntervalSeconds?: number; drawnNumbers?: number[]; settledAt?: number; serverSeed?: string; myBets: KenoBet[]; minBetEtb: number; maxBetEtb: number; maxPayoutEtb: number; mode: string };
type HistoryRound = { roundId: string; status: string; drawnNumbers?: number[]; serverSeedHash: string; serverSeed?: string; myBets: KenoBet[] };
type Tab = 'game' | 'history' | 'results' | 'statistics' | 'live';
type KenoTicketDraft = { requestId: string; amount: number; selectedNumbers: number[] };
type KenoBatchResponse = { bets: (KenoBet & { duplicate?: boolean })[]; balanceEtb: number; duplicateCount: number };

const money = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const requestId = () => 'keno_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);

const copy = {
  am: { title: 'BLACK GOLD KENO', rules: 'ህጎች', sound: 'ድምጽ', turbo: 'ፈጣን', draw: 'የወጡ ቁጥሮች', picks: 'የተመረጡ', hits: 'የተዛመዱ', bet: 'ውርርድ', total: 'ጠቅላላ', game: 'ጨዋታ', history: 'ታሪክ', results: 'ውጤቶች', stats: 'ስታቲስቲክስ', live: 'የእኔ ቲኬቶች', clear: 'አጽዳ', quick: 'ፈጣን ምርጫ', selected: 'የተመረጡ ቁጥሮች', play: 'BET / ተጫወት', waiting: 'ውጤት በመጠበቅ ላይ', noTickets: 'በዚህ ዙር ገና ቲኬት የለም', noHistory: 'ገና የተጠናቀቁ ዙሮች የሉም', rounds: 'ዙሮች', tickets: 'ቲኬቶች', wagered: 'ጠቅላላ ውርርድ', won: 'ጠቅላላ ያሸነፉት', count: 'ብዛት', status: 'ሁኔታ', payout: 'ክፍያ', noWin: 'ሽልማት የለም', minMax: 'የሚፈቀደው', round: 'ዙር', drawComplete: 'ዕጣው ተጠናቋል', recent: 'የቅርብ ውጤቶች', poolNote: 'የመጨረሻ ክፍያ በዙሩ የገንዘብ ገንዳና በከፍተኛ ገደብ ሊስተካከል ይችላል።', simulation: 'የሙከራ ክሬዲት ብቻ', boardClosed: '20ዎቹ ቁጥሮች ወጥተዋል። ቀጣዩ ዙር ሲጀምር ሰሌዳው በራስ-ሰር ይመለሳል።', fast:'ፈጣን', chooseTen:'10 ቁጥሮችን ይምረጡ', fromTo:'ከ1 እስከ 80', selectedCount:'ተመርጠዋል', decreaseBet:'ውርርድ ቀንስ', increaseBet:'ውርርድ ጨምር', openMenu:'የተጫዋች ሜኑ ክፈት', timeRemaining:'በዚህ ዙር የቀረ ጊዜ', drawnNumbersAria:'የKeno የወጡ ቁጥሮች', number:'ቁጥር', selectedState:'ተመርጧል', betButton:'ውርርድ', all:'ሁሉም', myTickets:'የእኔ ቲኬቶች', myBets:'ውርርዶቼ', ticket:'ቲኬት', waitingBet:'በመጠበቅ ላይ', addTicket:'ቲኬት ጨምር', queued:'የተዘጋጁ ቲኬቶች', placeBets:'ውርርዶችን አስገባ', betsConfirmed:'ውርርዶች ተረጋግጠዋል' },
  ti: { title: 'BLACK GOLD KENO', rules: 'ሕግታት', sound: 'ድምጺ', turbo: 'ቅልጡፍ', draw: 'ዝወጹ ቁጽሪታት', picks: 'ዝተመርጹ', hits: 'ዝተሰማምዑ', bet: 'ውርርድ', total: 'ጠቕላላ', game: 'ጸወታ', history: 'ታሪኽ', results: 'ውጽኢት', stats: 'ስታቲስቲክስ', live: 'ቲኬታተይ', clear: 'ኣጽርይ', quick: 'ቅልጡፍ ምርጫ', selected: 'ዝተመርጹ ቁጽሪታት', play: 'BET / ተጻወት', waiting: 'ውጽኢት ይጽበ ኣሎ', noTickets: 'ኣብዚ ዙር ገና ቲኬት የለን', noHistory: 'ገና ዝተወድኡ ዙራት የለዉን', rounds: 'ዙራት', tickets: 'ቲኬታት', wagered: 'ጠቕላላ ውርርድ', won: 'ጠቕላላ ዝተዓወትኩም', count: 'ብዝሒ', status: 'ኩነታት', payout: 'ክፍሊት', noWin: 'ሽልማት የለን', minMax: 'ዝፍቀድ', round: 'ዙር', drawComplete: 'ዕጫ ተወዲኡ', recent: 'ናይ ቀረባ ውጽኢታት', poolNote: 'ናይ መወዳእታ ክፍሊት ብገንዘብ ገንዳ ዙርን ዝለዓለ ደረትን ክስተኻኸል ይኽእል።', simulation: 'ናይ ፈተነ ክረዲት ጥራይ', boardClosed: 'እቶም 20 ቁጽሪታት ወጺኦም። እቲ ሰሌዳ ኣብ ዝቕጽል ዙር ብኣውቶማቲክ ክምለስ እዩ።', fast:'ቅልጡፍ', chooseTen:'10 ቁጽሪታት ምረጹ', fromTo:'ካብ 1 ክሳብ 80', selectedCount:'ተመሪጾም', decreaseBet:'ውርርድ ኣጉድል', increaseBet:'ውርርድ ወስኽ', openMenu:'ሜኑ ተጻዋታይ ክፈት', timeRemaining:'ኣብዚ ዙር ዝተረፈ ግዜ', drawnNumbersAria:'ዝወጹ ቁጽሪታት Keno', number:'ቁጽሪ', selectedState:'ተመሪጹ', betButton:'ውርርድ', all:'ኩሉ', myTickets:'ቲኬታተይ', myBets:'ውርርደይ', ticket:'ቲኬት', waitingBet:'ይጽበ ኣሎ', addTicket:'ቲኬት ወስኽ', queued:'ዝተዳለዉ ቲኬታት', placeBets:'ውርርድ ኣእቱ', betsConfirmed:'ውርርድ ተረጋጊጹ' },
  en: { title: 'BLACK GOLD KENO', rules: 'RULES', sound: 'SOUND', turbo: 'TURBO', draw: 'DRAWN NUMBERS', picks: 'PICKS', hits: 'HITS', bet: 'BET', total: 'TOTAL', game: 'GAME', history: 'HISTORY', results: 'RESULTS', stats: 'STATISTICS', live: 'MY TICKETS', clear: 'CLEAR', quick: 'QUICK PICK', selected: 'SELECTED NUMBERS', play: 'BET NOW', waiting: 'Waiting for draw', noTickets: 'No tickets in this round yet', noHistory: 'No completed rounds yet', rounds: 'Rounds', tickets: 'Tickets', wagered: 'Total wagered', won: 'Total returned', count: 'Count', status: 'Status', payout: 'Payout', noWin: 'No prize', minMax: 'Allowed', round: 'Round', drawComplete: 'DRAW COMPLETE', recent: 'RECENT RESULTS', poolNote: 'Final payouts may be adjusted by the round pool and the maximum payout cap.', simulation: 'DEMO CREDITS ONLY', boardClosed: 'All 20 numbers have been drawn. The board will return automatically when the next round opens.', fast:'FAST', chooseTen:'Choose 10 numbers', fromTo:'From 1 to 80', selectedCount:'selected', decreaseBet:'Decrease bet', increaseBet:'Increase bet', openMenu:'Open player menu', timeRemaining:'Time remaining in this round', drawnNumbersAria:'Drawn Keno numbers', number:'Number', selectedState:'selected', betButton:'BET', all:'All', myTickets:'My Tickets', myBets:'My Bets', ticket:'Ticket', waitingBet:'Waiting', addTicket:'ADD TICKET', queued:'QUEUED TICKETS', placeBets:'PLACE BETS', betsConfirmed:'bets confirmed' },
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
  const [queuedTickets, setQueuedTickets] = useState<KenoTicketDraft[]>([]);
  const queuedRoundId = useRef<string | null>(null);
  const [displayedDrawnNumbers, setDisplayedDrawnNumbers] = useState<number[]>([]);
  const [drawQueue, setDrawQueue] = useState<number[]>([]);
  const activeDrawRound = useRef<string | null>(null);
  const drawStartedRound = useRef<string | null>(null);
  const lastDrawAt = useRef(0);
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
  useEffect(() => {
    if (!state) return;
    if (queuedRoundId.current === null) queuedRoundId.current = state.roundId;
    else if (queuedRoundId.current !== state.roundId) {
      queuedRoundId.current = state.roundId;
      setQueuedTickets([]);
    }
  }, [state?.roundId]);

  const loadHistory = useCallback(async () => {
    try { setHistory(await api.get<HistoryRound[]>('/api/games/keno/history?limit=8')); } catch { /* history is optional */ }
  }, []);

  useEffect(() => {
    void loadState(); void loadHistory();
    const onAdminChange = () => { void loadState(); void loadHistory(); };
    window.addEventListener('bgb:admin-change', onAdminChange);
    // Countdown is local. Do not poll MongoDB every second while betting:
    // refresh at the round boundary, then once per reveal while results are hidden.
    const tick = window.setInterval(() => setClock(Date.now()), 1000);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener('bgb:admin-change', onAdminChange);
    };
  }, [loadState, loadHistory]);

  useEffect(() => {
    if (!state) return;
    const serverNow = Date.now() + offset;
    let delayMs = 1000;
    if (state.status === 'betting') {
      const untilClose = state.bettingEndsAt - serverNow;
      delayMs = untilClose > 0 ? untilClose + 150 : 1000;
    } else {
      const revealed = state.drawnNumbers?.length ?? 0;
      if (revealed < 20) delayMs = 1000;
      else {
        const untilNextRound = (state.nextRoundAt ?? serverNow + 1000) - serverNow;
        delayMs = untilNextRound > 0 ? untilNextRound + 150 : 1000;
      }
    }
    const timer = window.setTimeout(() => void loadState(), Math.max(250, Math.min(delayMs, 30_000)));
    return () => window.clearTimeout(timer);
  }, [state?.roundId, state?.status, state?.bettingEndsAt, state?.nextRoundAt, state?.drawnNumbers?.length, offset, loadState]);

  // Buffer server catch-up responses and reveal each ball separately. A delayed poll,
  // background tab, or reconnect must never paint two or more new balls together.
  useEffect(() => {
    if (!state) return;
    const roundChanged = activeDrawRound.current !== state.roundId;
    if (roundChanged) {
      activeDrawRound.current = state.roundId;
      drawStartedRound.current = null;
      lastDrawAt.current = 0;
      setDisplayedDrawnNumbers([]);
      setDrawQueue([]);
    }
    if (state.status !== 'settled') return;
    if (drawStartedRound.current !== state.roundId) {
      drawStartedRound.current = state.roundId;
      const elapsed = Math.max(0, state.serverTime - Number(state.settledAt ?? state.serverTime));
      lastDrawAt.current = Date.now() - elapsed;
    }
    setDrawQueue(current => {
      const known = new Set([...(roundChanged ? [] : displayedDrawnNumbers), ...(roundChanged ? [] : current)]);
      const additions = (state.drawnNumbers ?? []).filter(number => !known.has(number));
      if (!additions.length) return current;
      return roundChanged ? additions : [...current, ...additions];
    });
  }, [state?.roundId, state?.status, state?.drawnNumbers, state?.serverTime, state?.settledAt, displayedDrawnNumbers]);

  useEffect(() => {
    if (!drawQueue.length) return;
    const delay = Math.max(0, 1000 - (Date.now() - lastDrawAt.current));
    const timer = window.setTimeout(() => {
      const next = drawQueue[0];
      setDisplayedDrawnNumbers(current => current.includes(next) ? current : [...current, next]);
      setDrawQueue(current => current[0] === next ? current.slice(1) : current.filter(number => number !== next));
      lastDrawAt.current = Date.now();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [drawQueue]);

  const visibleDrawnNumbers = displayedDrawnNumbers;
  const visibleDrawCount = visibleDrawnNumbers.length;
  const revealComplete = state?.status === 'settled' && visibleDrawCount >= 20;
  useEffect(() => { if (state?.status === 'settled') void loadHistory(); }, [state?.status, state?.roundId, revealComplete, loadHistory]);
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

  const toggle = useCallback((n: number) => setSelected(old => old.includes(n) ? old.filter(v => v !== n) : old.length >= 10 ? old : [...old,n].sort((a,b)=>a-b)), []);
  const quickPick = () => {
    const pool = Array.from({length:80},(_,i)=>i+1);
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    setSelected(pool.slice(0,10).sort((a,b)=>a-b));
  };
  const betRequestInFlight = useRef(false);
  const addTicket = () => {
    // Allow the next ticket to be prepared while the previous server transaction
    // is confirming. The in-flight submit snapshots its own queue, so new tickets
    // remain queued for the next tap and cannot be lost or double-submitted.
    if (!selected.length || !validAmount || !isBetting || queuedTickets.length >= 19) return;
    setQueuedTickets(current => [...current, { requestId: requestId(), amount: numericAmount, selectedNumbers: [...selected] }]);
    setSelected([]);
    setError(''); setNotice('');
  };
  const submit = async () => {
    // Freeze this submission's ticket data, then clear the live selection immediately.
    // Any numbers picked while the request is in flight belong to the next ticket only.
    const selectedSnapshot = selected.length && validAmount ? [...selected] : [];
    const queuedSnapshot = [...queuedTickets];
    const tickets = [
      ...queuedSnapshot,
      ...(selectedSnapshot.length ? [{ requestId: requestId(), amount: numericAmount, selectedNumbers: selectedSnapshot }] : []),
    ];
    if (!tickets.length || tickets.length > 20 || !isBetting || busy || betRequestInFlight.current) return;
    betRequestInFlight.current = true;
    if (selectedSnapshot.length) setSelected([]);
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await api.post<KenoBatchResponse>('/api/games/keno/bets/batch', { tickets });
      const queuedIds = new Set(queuedSnapshot.map(ticket => ticket.requestId));
      setQueuedTickets(current => current.filter(ticket => !queuedIds.has(ticket.requestId)));
      setNotice(`${response.bets.length} ${c.betsConfirmed}`);
      void loadState();
      void loadHistory();
    } catch {
      // Restore the submitted picks only when the player has not started a new ticket.
      if (selectedSnapshot.length) setSelected(current => current.length ? current : selectedSnapshot);
      setError(t.betError);
    }
    finally { betRequestInFlight.current = false; setBusy(false); }
  };
  const adjustBet = (delta:number) => setAmount(old => {
    const current=Number(old); const next=(Number.isFinite(current)?current:minBet)+delta;
    return Math.min(maxBet,Math.max(minBet,next)).toFixed(2);
  });
  const tabs: {id:Tab;label:string}[] = [
    {id:'game',label:c.game},{id:'history',label:c.history},{id:'results',label:c.results},{id:'statistics',label:c.stats},{id:'live',label:c.live}
  ];

  return (
    <main className="keno-reference-page mx-auto min-h-[100dvh] w-full max-w-[480px] space-y-2 bg-[#050505] px-2 text-[#f3dfad] sm:px-3">
      <header className="keno-topbar">
        <div className="keno-brand"><span>FAST</span><strong>KENO</strong></div>
        <div className="keno-account">
          <span>{money(state?.balanceEtb ?? user?.balance ?? 0)} ETB</span>
          <i />
          <span>ID: {user?.id ? user.id.slice(-9) : '—'}</span>
          <b aria-label={c.verified}>✓</b>
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
        <KenoNumberGrid selected={selected} isBetting={isBetting} previousDrawnNumbers={history[0]?.drawnNumbers} onToggle={toggle} labels={c} />
        <div className="keno-stake-controls grid grid-cols-[minmax(0,1fr)_66px_66px] items-stretch gap-[3px] bg-[#090909] p-[3px]">
          <div className="flex h-[58px] items-center justify-between rounded-sm bg-[#253330] px-3">
            <button type="button" disabled={!isBetting||Number(amount)<=minBet} onClick={()=>adjustBet(-1)} aria-label={c.decreaseBet} className="text-3xl font-black text-slate-300 disabled:opacity-30">−</button>
            <span className="text-[25px] font-black tabular-nums text-white">{Number(amount).toLocaleString(undefined,{maximumFractionDigits:2})}</span>
            <button type="button" disabled={!isBetting||Number(amount)>=maxBet} onClick={()=>adjustBet(1)} aria-label={c.increaseBet} className="text-3xl font-black text-slate-300 disabled:opacity-30">+</button>
          </div>
          <button type="button" disabled={!isBetting} onClick={()=>adjustBet(numericAmount)} className="rounded-sm bg-[#263b34] text-[12px] font-black text-emerald-300 disabled:opacity-40">X2</button>
          <button type="button" disabled={!isBetting} onClick={()=>setAmount(maxBet.toFixed(2))} className="rounded-sm bg-[#263b34] text-[12px] font-black text-emerald-300 disabled:opacity-40">MAX</button>
        </div>
        {queuedTickets.length > 0 && <div className="space-y-1 border-t border-emerald-200/10 bg-[#0b1915] p-2 text-[11px]">
          <div className="flex items-center justify-between font-black text-emerald-200"><span>{c.queued} ({queuedTickets.length}/20)</span><span>{money(queuedTickets.reduce((sum, ticket) => sum + ticket.amount, 0))} ETB</span></div>
          {queuedTickets.map((ticket, index) => <div key={ticket.requestId} className="flex items-center justify-between gap-2 rounded bg-black/20 px-2 py-1 text-emerald-100/80"><span className="min-w-0 flex-1 truncate">#{index + 1} · {ticket.selectedNumbers.join(", ")}</span><span className="shrink-0">{money(ticket.amount)} ETB</span><button type="button" disabled={busy} onClick={() => setQueuedTickets(current => current.filter(item => item.requestId !== ticket.requestId))} aria-label={c.removeQueuedTicket} className="px-2 font-black text-amber-300">×</button></div>)}
        </div>}
        {selected.length > 0 && <button type="button" disabled={!isBetting||!validAmount||queuedTickets.length>=19} onClick={addTicket} className="w-full border-t border-emerald-200/10 bg-[#172d23] py-2 text-xs font-black text-emerald-100 disabled:opacity-40">{c.addTicket}</button>}
        <button type="button" disabled={!isBetting||(!queuedTickets.length&&(!selected.length||!validAmount))||busy} onClick={()=>void submit()} className="keno-bet-submit w-full rounded-b-md border-t border-emerald-200/15 bg-gradient-to-b from-[#276b4b] to-[#17432f] py-3 text-[25px] font-black text-slate-200 shadow-inner disabled:opacity-45">{busy?t.confirming:(queuedTickets.length?c.placeBets:c.betButton)+(queuedTickets.length+(selected.length&&validAmount?1:0)>1?" ("+(queuedTickets.length+(selected.length&&validAmount?1:0))+")":"")}</button>
        {(error||notice)&&<p role={error?'alert':'status'} className={'px-3 py-2 text-center text-xs '+(error?'bg-red-950/50 text-red-200':'bg-emerald-950/50 text-emerald-200')}>{error||notice}</p>}
        <div className="flex justify-between px-2 py-1 text-[9px] text-emerald-100/50"><span>Minimum {money(minBet)} ETB</span><span>Maximum {money(maxBet)} ETB</span><button type="button" onClick={()=>document.getElementById('keno-rules')?.scrollIntoView({behavior:'smooth',block:'center'})}>{c.rules}</button></div>
      </section>}

      {!isBetting && state?.status === 'settled' && <section className="keno-draw-stage relative overflow-hidden rounded-lg bg-[#101b19] px-2 py-3">
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[-110px] h-64 w-64 -translate-x-1/2 rounded-full border border-emerald-300/10 shadow-[0_0_0_22px_rgba(16,185,129,.025),0_0_0_44px_rgba(16,185,129,.02)]"/>
        <div className="relative mb-3 flex items-center justify-between px-1 font-mono text-xs font-black text-white">
          <span>{c.draw}</span>
          <span>{visibleDrawnNumbers.length} <i className="px-1 text-emerald-300">/</i> 20</span>
        </div>
        <div aria-label={c.drawnNumbersAria} aria-live="polite" className="relative grid grid-cols-10 gap-1.5 sm:gap-2">
          {Array.from({length:20},(_,i)=>visibleDrawnNumbers[i] ?? null).map((n,i)=><span key={i} className={'keno-drawn-ball grid aspect-square min-w-0 place-items-center rounded-full border text-[11px] font-black tabular-nums shadow-[inset_0_2px_4px_rgba(255,255,255,.18),0_3px_8px_rgba(0,0,0,.45)] sm:text-sm '+(n===null?'border-emerald-300/10 bg-[#0a1210]/60 text-transparent':'border-slate-500/70 bg-[radial-gradient(circle_at_35%_25%,#536873,#1c303b_58%,#07141b)] text-white')+(n!==null&&i===visibleDrawCount-1?' is-latest':'')}>{n ?? '·'}</span>)}
        </div>
      </section>}

      {!isBetting && state?.status !== 'settled' && <section className="grid min-h-[120px] place-items-center rounded-lg bg-[#101b19] text-sm text-emerald-100/60">{t.waitingDraw}</section>}

      <nav aria-label={c.sectionsAria} className="keno-tabs flex items-center gap-4 overflow-x-auto border-b border-emerald-400/20 bg-[#101b19] px-1 py-2 text-[11px] font-black uppercase tracking-wide [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map(item=><button key={item.id} type="button" onClick={()=>setTab(item.id)} aria-current={tab===item.id?'page':undefined} className={'flex shrink-0 items-center gap-1 whitespace-nowrap border-b-2 pb-1 '+(tab===item.id?'border-emerald-300 text-emerald-300':'border-transparent text-emerald-100/55')}><span aria-hidden="true">{item.id==='game'?'▶':item.id==='history'?'◴':item.id==='results'?'✓':item.id==='statistics'?'▥':'♛'}</span>{item.label}</button>)}
      </nav>

      <div className="keno-counts grid grid-cols-3 items-center bg-[#101b19] px-2 py-1 text-[10px] text-emerald-100/65">
        <div><span className="block text-[9px]">{c.all}</span><b className="font-mono text-emerald-300">{history.length}</b></div>
        <div className="text-center"><span className="block text-[9px]">{c.myTickets}</span><b className="font-mono text-emerald-300">{state?.myBets.length??0}</b></div>
        <div className="text-right"><span className="block text-[9px]">{c.myBets}</span><b className="font-mono text-emerald-300">{state?.myBets.length??0}</b></div>
      </div>

      {tab==='game' && <section className="space-y-1.5">{state?.myBets?.length?state.myBets.slice().reverse().map(bet=><BetCard key={bet.id} bet={bet} labels={c} revealedNumbers={visibleDrawnNumbers} revealComplete={revealComplete}/>):<div className="rounded-lg border border-dashed border-emerald-400/20 bg-[#0b1915] px-3 py-5 text-center text-xs font-bold text-emerald-100/70">{c.noTickets}</div>}</section>}
      {tab==='live' && <section className="space-y-1.5">{state?.myBets?.length?state.myBets.slice().reverse().map(bet=><BetCard key={bet.id} bet={bet} labels={c} revealedNumbers={visibleDrawnNumbers} revealComplete={revealComplete}/>):<p className="rounded-lg bg-[#0b1915] p-5 text-center text-xs text-slate-500">{c.noTickets}</p>}</section>}
      {tab==='history' && <section className="space-y-2">{history.length?history.map(round=><article key={round.roundId} className="rounded-lg border border-emerald-400/15 bg-[#0b1915] p-3"><div className="flex items-center justify-between gap-2"><span className="truncate font-mono text-[10px] font-bold text-emerald-300">{round.roundId}</span><span className="text-[10px] text-slate-400">{round.roundId === state?.roundId ? (revealComplete ? c.drawComplete : c.waiting) : round.status === 'settled' ? c.drawComplete : round.status === 'active' ? c.statusActive : round.status === 'pending' ? c.statusPending : round.status === 'waiting' ? c.statusWaiting : round.status === 'pending_reveal' ? c.statusRevealing : round.status}</span></div>{round.roundId === state?.roundId && !revealComplete ? <p className="mt-2 rounded bg-[#101b19] px-2 py-3 text-center text-xs text-emerald-200/70">{c.waiting} · {visibleDrawCount}/20</p> : <div className="mt-2 grid grid-cols-10 gap-1">{(round.roundId === state?.roundId ? visibleDrawnNumbers : (round.drawnNumbers??[])).slice(0,20).map(n=><span key={n} className="grid aspect-square place-items-center rounded-full border border-emerald-400/20 bg-[#1c3430] text-[10px] font-black text-white">{n}</span>)}</div>}<p className="mt-2 text-[10px] text-slate-400">{c.tickets}: {round.myBets.length}{round.roundId === state?.roundId && !revealComplete ? '' : ' · '+c.payout+': '+money((round.roundId === state?.roundId ? (state?.myBets ?? []) : round.myBets).reduce((sum,b)=>sum+b.payoutEtb,0))+' ETB'}</p></article>):<p className="rounded-lg bg-[#0b1915] p-5 text-center text-xs text-slate-500">{c.noHistory}</p>}</section>}
      {tab==='results' && <section className="space-y-2">{history.filter(round=>round.drawnNumbers?.length || round.roundId === state?.roundId).length?history.filter(round=>round.drawnNumbers?.length || round.roundId === state?.roundId).map(round=><article key={round.roundId} className="rounded-lg border border-emerald-400/15 bg-[#0b1915] p-3"><p className="font-mono text-[10px] text-emerald-300">{round.roundId}</p>{round.roundId === state?.roundId && !revealComplete ? <p className="mt-2 rounded bg-[#101b19] px-2 py-3 text-center text-xs text-emerald-200/70">{c.waiting} · {visibleDrawCount}/20</p> : <div className="mt-2 grid grid-cols-10 gap-1">{(round.roundId === state?.roundId ? visibleDrawnNumbers : (round.drawnNumbers??[])).slice(0,20).map(n=><span key={n} className="grid aspect-square place-items-center rounded-full bg-[#1c3430] text-[10px] font-bold text-emerald-100">{n}</span>)}</div>}</article>):<p className="rounded-lg bg-[#0b1915] p-5 text-center text-xs text-slate-500">{c.noHistory}</p>}</section>}
      {tab==='statistics' && <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">{[[c.rounds,stats.rounds],[c.tickets,stats.tickets],[c.wagered,money(stats.wagered)+' ETB'],[c.won,money(stats.won)+' ETB'],[c.hits,stats.hits]].map(([label,value])=><div key={String(label)} className="rounded-lg border border-emerald-400/15 bg-[#0b1915] p-3"><p className="text-[10px] text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-emerald-300">{value}</p></div>)}</section>}

      <details id="keno-rules" className="rounded-lg border border-emerald-400/15 bg-[#0b1915] p-3 text-xs text-slate-300">
        <summary className="cursor-pointer font-black text-emerald-300">{c.rules} · {t.payoutTable}</summary>
        <div className="mt-3 space-y-2"><p>{t.intro}</p><p>{t.drawInfo}</p><p>{t.multiplierInfo}</p><p className="text-emerald-300/80">{c.poolNote}</p><p className="text-emerald-300">{c.simulation}</p></div>
        {state?.payoutTable&&<div className="mt-3 max-h-64 overflow-auto"><table className="w-full border-collapse text-left"><thead className="sticky top-0 bg-[#0b1915] text-emerald-300"><tr><th className="p-2">{t.numbersPicked}</th><th className="p-2">{t.matchesHeader}</th><th className="p-2">{t.returnMultiplier}</th></tr></thead><tbody>{Object.entries(state.payoutTable).flatMap(([picked,hits])=>Object.entries(hits).map(([matched,multiplier])=><tr key={picked+'-'+matched} className="border-t border-white/5"><td className="p-2">{picked}</td><td className="p-2">{matched}</td><td className="p-2 font-bold text-emerald-200">{(multiplier/100).toFixed(2)}×</td></tr>))}</tbody></table></div>}
        <p className="mt-2 text-[10px] text-slate-500">{t.allowed}: {money(minBet)}–{money(maxBet)} ETB · {t.maxPayout}: {money(state?.maxPayoutEtb??20000)} ETB</p>
      </details>
      {state?.serverSeedHash&&<details className="rounded-lg border border-emerald-400/10 bg-[#0b1915] p-3 text-xs text-slate-400"><summary className="cursor-pointer font-bold text-emerald-300">{t.fairness}</summary><p className="mt-2 break-all">{t.commitment}: {state.serverSeedHash}</p>{state.serverSeed && revealComplete?<><p className="mt-1 break-all">{t.revealedSeed}: {state.serverSeed}</p><p className="mt-2">{t.reproducible}</p></>:<p className="mt-2">{t.seedAfter}</p>}</details>}
      <p className="text-center text-[9px] font-bold tracking-[.2em] text-emerald-300/35">{c.simulation}</p>
    </main>
  );
}


type KenoNumberGridProps = {
  selected: number[];
  isBetting: boolean;
  previousDrawnNumbers?: number[];
  onToggle: (number: number) => void;
  labels: { number: string; selectedState: string };
};

const KENO_NUMBERS = Array.from({ length: 80 }, (_, index) => index + 1);

type KenoNumberCellProps = {
  number: number;
  selected: boolean;
  previous: boolean;
  isBetting: boolean;
  onToggle: (number: number) => void;
  numberLabel: string;
  selectedLabel: string;
};

// Each cell is isolated: a tap updates only the old and new selection, not all 80 buttons.
const KenoNumberCell = memo(function KenoNumberCell({
  number, selected, previous, isBetting, onToggle, numberLabel, selectedLabel,
}: KenoNumberCellProps) {
  const className = 'relative grid aspect-square min-w-0 touch-manipulation select-none place-items-center border text-[clamp(11px,3.6vw,17px)] font-black tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,.05)] ' +
    (selected
      ? 'border-emerald-200 bg-emerald-400 text-[#061c14]'
      : 'border-[#35413f] bg-[linear-gradient(145deg,#394442,#242d2b)] text-slate-300 hover:bg-[#46524f]');
  return (
    <button
      type="button"
      disabled={!isBetting}
      onClick={() => onToggle(number)}
      aria-pressed={selected}
      aria-label={numberLabel + ' ' + number + (selected ? ', ' + selectedLabel : '')}
      className={className}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {number}
      {previous && <span aria-hidden="true" className="pointer-events-none absolute right-[2px] top-[2px] h-[5px] w-[5px] rounded-full bg-sky-300 shadow-[0_0_5px_rgba(125,211,252,.6)]" />}
    </button>
  );
});

const KenoNumberGrid = memo(function KenoNumberGrid({
  selected, isBetting, previousDrawnNumbers, onToggle, labels,
}: KenoNumberGridProps) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const previousSet = useMemo(() => new Set(previousDrawnNumbers ?? []), [previousDrawnNumbers]);

  return (
    <div className="keno-number-grid grid grid-cols-10 gap-[3px] bg-[#090909] p-[3px]">
      {KENO_NUMBERS.map(number => (
        <KenoNumberCell
          key={number}
          number={number}
          selected={selectedSet.has(number)}
          previous={previousSet.has(number)}
          isBetting={isBetting}
          onToggle={onToggle}
          numberLabel={labels.number}
          selectedLabel={labels.selectedState}
        />
      ))}
    </div>
  );
});

function BetCard({ bet, labels, revealedNumbers, revealComplete }: { bet: KenoBet; labels: (typeof copy)['en'] | (typeof copy)['am'] | (typeof copy)['ti']; revealedNumbers: number[]; revealComplete: boolean }) {
  // Highlight ticket matches as each ball is visibly revealed, not only after ball #20.
  // The displayed sequence is the progressive client-side reveal, so future hits stay hidden.
  const revealedSet = useMemo(() => new Set(revealedNumbers), [revealedNumbers]);
  return <article className={'overflow-hidden rounded-lg border p-1.5 '+(bet.payoutEtb>0?'border-emerald-400/40 bg-[#16432f]':'border-white/5 bg-[#172421]')}>
    <div className="px-1 pb-1 text-[11px] font-black text-emerald-300">{labels.ticket} {bet.id.slice(0,1)}***{bet.id.slice(-1)}</div>
    <div className="grid grid-cols-10 gap-1">{Array.from({length:10},(_,i)=>{const n=bet.selectedNumbers[i];const matched=n!==undefined&&revealedSet.has(n);return <div key={i} aria-label={n===undefined?undefined:(matched?String(n)+' '+labels.matchedState:String(n))} className={'grid aspect-square min-w-0 place-items-center rounded-sm border border-white/5 text-xs font-black tabular-nums transition-colors duration-200 '+(n===undefined?'bg-[#101b19]':matched?'bg-emerald-400 text-[#062014] shadow-[0_0_9px_rgba(52,211,153,.45)]':'bg-[#34484a] text-white')}>{n??''}</div>})}</div>
    <div className="mt-1 flex items-center justify-between gap-2 border-t border-white/5 px-1 pt-1 text-[10px]"><span className="font-bold text-slate-100">{labels.bet} {money(bet.stakeEtb)} ETB</span><span className="font-black text-emerald-300">{!revealComplete?labels.waitingBet:bet.payoutEtb>0?money(bet.payoutEtb):['active','pending','waiting','pending_reveal'].includes(bet.status.toLowerCase())?labels.waitingBet:bet.hits+' '+labels.hits}</span></div>
  </article>;
}
