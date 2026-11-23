import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';

type AviatorBet = { id: string; status: string; stakeEtb: number; multiplier: number | null; payoutEtb: number; createdAt: number };
type AviatorState = { enabled: boolean; balanceEtb: number; walletMode: 'shared' | 'legacy-demo'; game: 'aviator'; roundId: string; status: 'betting' | 'flying' | 'crashed'; bettingEndsAt: number; serverTime: number; serverSeedHash: string; startedAt?: number; growthPerMs?: number; crashMultiplier?: number; serverSeed?: string; myBets: AviatorBet[]; minBetEtb: number; maxBetEtb: number; maxPayoutEtb: number; mode: string };
type HistoryRound = { roundId: string; status: string; crashMultiplier?: number; serverSeedHash: string; serverSeed?: string; myBets: AviatorBet[] };
const money = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const requestId = () => 'aviator_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);

export function AviatorGame({ onBack, onSwitchGame }: { onBack: () => void; onSwitchGame: (game: 'bingo' | 'keno' | 'aviator') => void }) {
  const [state, setState] = useState<AviatorState | null>(null);
  const [history, setHistory] = useState<HistoryRound[]>([]);
  const [amount, setAmount] = useState('10.00');
  const [clock, setClock] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [betRequestId, setBetRequestId] = useState('');

  const loadState = useCallback(async () => {
    try {
      const next = await api.get<AviatorState>('/api/games/aviator/state');
      setState(next); setOffset(next.serverTime - Date.now()); setError('');
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Could not load Aviator right now.'); }
  }, []);
  const loadHistory = useCallback(async () => {
    try { setHistory(await api.get<HistoryRound[]>('/api/games/aviator/history?limit=8')); } catch { /* optional */ }
  }, []);

  useEffect(() => {
    void loadState(); void loadHistory();
    const poll = window.setInterval(() => void loadState(), 1000);
    const tick = window.setInterval(() => setClock(Date.now()), 50);
    return () => { window.clearInterval(poll); window.clearInterval(tick); };
  }, [loadState, loadHistory]);

  useEffect(() => {
    if (state?.status === 'crashed') void loadHistory();
  }, [state?.status, state?.roundId, loadHistory]);

  const secondsLeft = state?.status === 'betting' ? Math.max(0, Math.ceil((state.bettingEndsAt - (clock + offset)) / 1000)) : 0;
  const activeBet = state?.myBets.find((bet) => bet.status === 'active');
  const multiplier = useMemo(() => {
    if (state?.status === 'crashed') return state.crashMultiplier ?? 1;
    if (state?.status !== 'flying' || !state.startedAt || !state.growthPerMs) return 1;
    const elapsed = Math.max(0, clock + offset - state.startedAt);
    return Math.floor(Math.exp(elapsed * state.growthPerMs) * 100) / 100;
  }, [state, clock, offset]);

  const placeBet = async () => {
    setBusy(true); setError(''); setNotice('');
    const id = betRequestId || requestId();
    setBetRequestId(id);
    try {
      await api.post('/api/games/aviator/bets', { requestId: id, amount: Number(amount) });
      setNotice('Your Aviator bet is confirmed.');
      setBetRequestId('');
      await loadState();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Your bet could not be placed.'); }
    finally { setBusy(false); }
  };

  const cashOut = async () => {
    if (!activeBet) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api.post<{ multiplier: number; bet: AviatorBet }>('/api/games/aviator/cashout', { betId: activeBet.id });
      setNotice('Cash Out recorded at ' + result.multiplier.toFixed(2) + '×. Final pool payout is credited after the round ends.');
      await loadState();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Cash Out was not accepted by the server.'); }
    finally { setBusy(false); }
  };

  const isBetting = state?.enabled === true && state.status === 'betting' && secondsLeft > 0;
  const crashed = state?.status === 'crashed';

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2"><button onClick={onBack} className="rounded-xl border border-amber-400/20 px-3 py-2 text-xs font-bold text-amber-100/70">Games Center</button><button onClick={() => onSwitchGame('bingo')} className="rounded-xl border border-amber-400/20 px-3 py-2 text-xs font-bold text-amber-100/70">Bingo</button><button onClick={() => onSwitchGame('keno')} className="rounded-xl border border-amber-400/20 px-3 py-2 text-xs font-bold text-amber-100/70">Keno</button><button onClick={() => onSwitchGame('aviator')} aria-current="page" className="rounded-xl border border-amber-300/50 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-200">Aviator</button></div><span className="rounded-full border border-amber-400/25 bg-amber-400/5 px-3 py-1.5 text-[10px] font-bold tracking-widest text-amber-300">SIMULATION ONLY</span></div>
      <header className="rounded-3xl border border-amber-400/25 bg-[radial-gradient(ellipse_at_top_right,rgba(202,158,57,.2),transparent_45%),linear-gradient(135deg,#17140c,#080808)] p-5 sm:p-7"><p className="text-[10px] font-black uppercase tracking-[.3em] text-amber-400">BLACK GOLD · MULTIPLIER GAME</p><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-black text-amber-50 sm:text-4xl">AVIATOR</h1><p className="mt-2 text-sm text-amber-100/60">Cash out while the multiplier is rising. The server decides the round result.</p></div><div className="text-right"><p className="text-[10px] uppercase tracking-wider text-amber-500">{state?.walletMode === 'shared' ? 'Shared wallet balance' : 'Demo wallet balance'}</p><p className="text-xl font-black text-amber-200">{money(state?.balanceEtb ?? 0)} ETB</p></div></div></header>
      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-sm text-emerald-200">{notice}</p>}
      <section className="relative flex min-h-[300px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-amber-400/20 bg-[radial-gradient(ellipse_at_50%_80%,rgba(197,145,34,.16),transparent_55%),linear-gradient(180deg,#10100e,#050505)] p-5">
        <div className="absolute inset-x-0 bottom-10 h-px bg-gradient-to-r from-transparent via-amber-400/35 to-transparent" />
        <div className="absolute bottom-10 left-8 h-20 w-20 rounded-full border border-amber-400/10" />
        <p className="relative text-[10px] font-bold uppercase tracking-[.28em] text-amber-500">{state?.status === 'betting' ? 'Bets are open' : state?.status === 'flying' ? 'Plane in flight' : crashed ? 'Round crashed' : 'Connecting'}</p>
        <div className={`relative mt-5 text-6xl font-black tabular-nums tracking-tight sm:text-8xl ${crashed ? 'text-red-400' : 'text-amber-200 drop-shadow-[0_0_28px_rgba(245,190,60,.35)]'}`}>{state?.status === 'flying' ? multiplier.toFixed(2) + '×' : crashed ? (state?.crashMultiplier ?? 1).toFixed(2) + '×' : state?.status === 'betting' ? 'READY' : '—'}</div>
        <div className={`relative mt-7 text-5xl transition-transform duration-100 ${state?.status === 'flying' ? 'translate-x-12 -translate-y-5 rotate-[-8deg]' : ''}`} aria-hidden>✈️</div>
        <p className="relative mt-5 text-xs text-amber-100/45">{state?.status === 'betting' ? 'Round starts in ' + secondsLeft + 's' : state?.status === 'flying' ? 'Cash out before the crash.' : crashed ? 'The round is complete. A new round will open shortly.' : 'Connecting to the game server…'}</p>
      </section>
      <section className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl border border-amber-400/20 bg-[#0c0c0a] p-4 sm:p-5"><h2 className="font-bold text-amber-100">Your bet</h2><label className="mt-4 block text-xs text-amber-100/60">Stake (ETB)</label><input type="number" min={state?.minBetEtb ?? 5} max={state?.maxBetEtb ?? 1000} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-2 w-full rounded-xl border border-amber-400/25 bg-black px-3 py-3 text-lg font-bold text-amber-100 outline-none focus:border-amber-300"/>
          <p className="mt-2 text-[11px] text-amber-100/45">Allowed: {money(state?.minBetEtb ?? 5)}–{money(state?.maxBetEtb ?? 1000)} ETB · demo credits only · max payout {money(state?.maxPayoutEtb ?? 20000)} ETB</p>
          {activeBet ? <button disabled={busy || state?.status !== 'flying'} onClick={() => void cashOut()} className="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-300 to-emerald-500 px-4 py-3 font-black text-black disabled:opacity-40">{busy ? 'Processing…' : 'CASH OUT · ' + multiplier.toFixed(2) + '×'}</button> : <button disabled={!isBetting || busy} onClick={() => void placeBet()} className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600 px-4 py-3 font-black text-black disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Confirming…' : 'Place Aviator Bet'}</button>}
          {state?.myBets.map((bet) => <div key={bet.id} className="mt-3 flex items-center justify-between rounded-lg bg-black/60 p-2 text-xs"><span className="text-amber-100/60">{bet.status.toUpperCase()}{bet.multiplier ? ' · ' + bet.multiplier.toFixed(2) + '×' : ''} · {money(bet.stakeEtb)} ETB</span><b className="text-amber-200">{bet.status === 'cashed_out' ? money(bet.payoutEtb) + ' ETB' : bet.status === 'cashout_pending' ? 'SETTLING' : bet.status === 'lost' ? '0.00 ETB' : 'ACTIVE'}</b></div>)}
        </div>
        <div className="rounded-2xl border border-amber-400/20 bg-[#0c0c0a] p-4 sm:p-5"><h2 className="font-bold text-amber-100">Round information</h2><div className="mt-3 grid grid-cols-2 gap-3"><div className="rounded-xl bg-black/50 p-3"><p className="text-[10px] uppercase text-amber-500">Round ID</p><p className="mt-1 break-all font-mono text-xs text-amber-100">{state?.roundId ?? '—'}</p></div><div className="rounded-xl bg-black/50 p-3"><p className="text-[10px] uppercase text-amber-500">Betting</p><p className="mt-1 text-sm font-bold text-amber-100">{state?.status === 'betting' ? secondsLeft + ' seconds' : state?.status}</p></div></div><p className="mt-4 text-[10px] uppercase tracking-wider text-amber-500">Seed commitment</p><p className="mt-1 break-all font-mono text-[11px] text-amber-100/55">{state?.serverSeedHash ?? '—'}</p>
          {state?.serverSeed && <div className="mt-4 rounded-xl border border-amber-400/15 bg-black/50 p-3"><p className="text-xs font-bold text-amber-300">Revealed fairness seed</p><p className="mt-2 break-all font-mono text-[10px] text-amber-100/55">{state.serverSeed}</p><p className="mt-2 text-xs text-amber-100/45">Verify: commitment = SHA-256(seed). Let u be the first 52 bits of HMAC-SHA256(key=seed, message=aviator-crash-v1) divided by 2^52. Crash multiplier = min(1000, max(1, floor((0.99 / (1 - u)) × 100) / 100)).</p></div>}
        </div>
      </section>
      <section className="rounded-2xl border border-amber-400/15 bg-[#0b0b09] p-4"><h2 className="font-bold text-amber-100">Recent rounds</h2><div className="mt-3 space-y-2">{history.length ? history.map((round) => <div key={round.roundId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[.03] p-3"><div><p className="font-mono text-xs text-amber-200">{round.roundId}</p><p className="mt-1 text-[11px] text-amber-100/45">{round.myBets.length ? round.myBets.length + ' of your bets' : 'No personal bet'}</p></div><span className="text-sm font-black text-amber-300">{round.crashMultiplier ? round.crashMultiplier.toFixed(2) + '×' : round.status}</span></div>) : <p className="text-sm text-amber-100/40">No completed rounds yet.</p>}</div></section>
    </div>
  );
}
