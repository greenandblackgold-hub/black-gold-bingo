import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

type Ticket = { id: string; numbers: number[]; matchedNumbers: number[]; status: 'active' | 'locked' | 'winner'; lockedAt: number | null };
type State = {
  settings: { enabled: boolean; target: number; ticketPriceEtb: number; drawIntervalSeconds: number; maxTicketsPerPlayer: number };
  game: null | { id: string; status: 'waiting' | 'running' | 'ended'; target: number; drawnNumbers: number[]; lastNumber: number | null; winner: { userId: string; ticketId: string; at: number } | null; ticketCount: number };
  tickets: Ticket[];
  balanceEtb: number | null;
  balanceType: 'SIMULATION_ONLY';
};
const money = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function TurboBingoGame({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<State | null>(null);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [extractedNumber, setExtractedNumber] = useState<number | null>(null);
  const refresh = useCallback(async () => {
    try { setState(await api.get<State>('/api/games/turbo-bingo/state')); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load Turbo Bingo.'); }
  }, []);
  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => void refresh(), 5000);
    const stream = new EventSource('/api/stream');
    stream.addEventListener('turbo-bingo', () => void refresh());
    return () => { window.clearInterval(poll); stream.close(); };
  }, [refresh]);
  const drawn = useMemo(() => new Set(state?.game?.drawnNumbers ?? []), [state?.game?.drawnNumbers]);
  const lastNumber = state?.game?.lastNumber ?? null;
  useEffect(() => {
    if (lastNumber === null) return;
    setExtractedNumber(lastNumber);
    const timeout = window.setTimeout(() => setExtractedNumber(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [lastNumber]);
  const cageBalls = useMemo(() => Array.from({ length: 24 }, (_, index) => ({ number: index * 3 + 2, delay: `${(index % 8) * -0.37}s`, x: `${12 + ((index * 29) % 76)}%`, y: `${18 + ((index * 17) % 62)}%` })), []);
  const buy = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      await api.post('/api/games/turbo-bingo/tickets', { count });
      setNotice('ካርቴላዎችህ ተመዝግበዋል። Tickets registered successfully.');
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Ticket purchase failed.'); }
    finally { setBusy(false); }
  };
  const claim = async (ticketId: string) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await api.post('/api/games/turbo-bingo/claim', { ticketId });
      setNotice('BINGO! ድልህ በServer ተረጋግጧል።');
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Bingo claim failed.'); await refresh(); }
    finally { setBusy(false); }
  };
  const canBuy = state?.settings.enabled && state.game?.status === 'waiting';
  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 pb-10 text-amber-50">
      <header className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="rounded-xl border border-amber-300/30 px-4 py-2 text-sm font-bold text-amber-200">← Games Center</button>
        <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-[10px] font-black tracking-wider text-amber-300">LIVE · DEMO CREDITS</span>
      </header>
      <section className="rounded-3xl border border-amber-400/30 bg-[radial-gradient(ellipse_at_top_right,rgba(202,158,57,.24),transparent_45%),linear-gradient(120deg,#17140c,#090909_58%,#151006)] p-5 sm:p-7">
        <p className="text-[10px] font-black uppercase tracking-[.3em] text-amber-400">BLACK GOLD GAME CENTER</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">TURBO BINGO</h1>
        <p className="mt-1 text-sm text-amber-100/65">ትርቦ ቢንጎ · One game · One exact target · First valid winner</p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="GAME STATUS" value={state?.game?.status?.toUpperCase() ?? 'LOADING'} />
          <Stat label="WINNING TARGET" value={String(state?.game?.target ?? state?.settings.target ?? '—')} />
          <Stat label="NUMBERS CALLED" value={String(state?.game?.drawnNumbers.length ?? 0)} />
          <Stat label="LATEST NUMBER" value={String(state?.game?.lastNumber ?? '—')} />
        </div>
      </section>

      <section aria-label="Live bingo ball machine" className="relative overflow-hidden rounded-3xl border border-cyan-200/30 bg-[radial-gradient(ellipse_at_50%_38%,rgba(40,104,210,.34),transparent_58%),linear-gradient(145deg,#07132b,#090b19_58%,#17102a)] p-3 shadow-[inset_0_1px_25px_rgba(111,190,255,.12),0_15px_40px_rgba(0,0,0,.35)] sm:p-5">
        <style>{'@keyframes turbo-drum-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes turbo-ball-bob{0%,100%{translate:0 0}50%{translate:7px -12px}}@keyframes turbo-extract{0%{opacity:0;transform:translate(-50%,-35px) scale(.45)}16%{opacity:1}52%{transform:translate(-50%,30px) scale(1.08)}100%{opacity:0;transform:translate(-50%,150px) scale(.82)}}.turbo-drum-spin{animation:turbo-drum-spin 7s linear infinite;transform-origin:center}.turbo-ball-bob{animation:turbo-ball-bob 2.4s ease-in-out infinite}.turbo-extract{animation:turbo-extract 1.8s cubic-bezier(.2,.72,.25,1) both}@media(prefers-reduced-motion:reduce){.turbo-drum-spin,.turbo-ball-bob,.turbo-extract{animation-duration:.01ms!important;animation-iteration-count:1!important}}'}</style>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div><p className="text-[10px] font-black tracking-[.24em] text-cyan-200/80">LIVE DRAW MACHINE</p><h2 className="text-lg font-black text-white sm:text-xl">GLASS BINGO CAGE</h2></div>
          <span className="rounded-full border border-cyan-200/25 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-bold text-cyan-100">{state?.game?.status === 'running' ? '● MIXING' : state?.game?.status?.toUpperCase() ?? 'WAITING'}</span>
        </div>
        <div className="relative mx-auto h-[220px] max-w-[520px] sm:h-[280px]">
          <div className="absolute bottom-2 left-[12%] right-[12%] h-5 rounded-[50%] bg-cyan-300/20 blur-xl" />
          <div className="absolute bottom-4 left-[14%] right-[14%] h-5 rounded-full border border-blue-200/30 bg-gradient-to-b from-blue-200/25 to-blue-950/80 shadow-lg" />
          <div className="absolute bottom-7 left-[17%] right-[17%] top-5 rounded-[42%_42%_30%_30%] border-[3px] border-cyan-100/65 bg-gradient-to-br from-white/20 via-blue-300/10 to-indigo-500/20 shadow-[inset_12px_0_22px_rgba(255,255,255,.18),inset_-12px_0_24px_rgba(70,120,255,.2),0_0_30px_rgba(70,170,255,.2)] backdrop-blur-[2px]">
            <div className="turbo-drum-spin absolute inset-[8%] rounded-full border border-cyan-100/20">
              {cageBalls.map((ball, index) => <span key={index} className="turbo-ball-bob absolute grid h-8 w-8 place-items-center rounded-full border border-white/70 text-[10px] font-black text-white shadow-[inset_2px_3px_5px_rgba(255,255,255,.75),inset_-3px_-4px_7px_rgba(0,0,0,.35),0_3px_8px_rgba(0,0,0,.5)] sm:h-10 sm:w-10 sm:text-xs" style={{left:ball.x,top:ball.y,animationDelay:ball.delay,background:['radial-gradient(circle at 30% 25%,#fff,#fb7185 25%,#be123c 75%)','radial-gradient(circle at 30% 25%,#fff,#60a5fa 25%,#1d4ed8 75%)','radial-gradient(circle at 30% 25%,#fff,#4ade80 25%,#15803d 75%)','radial-gradient(circle at 30% 25%,#fff,#c084fc 25%,#7e22ce 75%)','radial-gradient(circle at 30% 25%,#fff,#facc15 25%,#b45309 75%)','radial-gradient(circle at 30% 25%,#fff,#67e8f9 25%,#0e7490 75%)'][index%6]}}>{ball.number}</span>)}
            </div>
            <div className="absolute left-1/2 top-1/2 h-[3px] w-[86%] -translate-x-1/2 -translate-y-1/2 rotate-[-12deg] rounded-full bg-gradient-to-r from-blue-200/10 via-blue-100/75 to-blue-200/10 shadow-[0_0_10px_rgba(130,190,255,.8)]" />
            <div className="absolute -top-3 left-1/2 z-20 h-5 w-16 -translate-x-1/2 rounded-t-xl border-2 border-cyan-100/80 bg-gradient-to-b from-slate-200/80 to-blue-800/80 shadow-lg sm:w-20" />
            <div className="absolute -top-1 left-1/2 z-30 h-3 w-10 -translate-x-1/2 rounded-b-full border-x-2 border-b-2 border-cyan-100 bg-[#07152e] shadow-[0_0_12px_rgba(125,211,252,.65)] sm:w-14" />
          </div>
          <div className="absolute bottom-5 left-[10%] h-[72%] w-3 rotate-[12deg] rounded-full border border-blue-200/60 bg-gradient-to-r from-blue-300/60 to-indigo-900/90 shadow-lg" />
          <div className="absolute bottom-5 right-[10%] h-[72%] w-3 -rotate-[12deg] rounded-full border border-blue-200/60 bg-gradient-to-r from-blue-300/60 to-indigo-900/90 shadow-lg" />
          {extractedNumber !== null && <div key={extractedNumber} className="turbo-extract absolute left-1/2 top-0 z-40 grid h-14 w-14 place-items-center rounded-full border-[3px] border-white bg-[radial-gradient(circle_at_30%_24%,#fff,#fca5a5_18%,#ef4444_55%,#991b1b)] text-xl font-black text-white shadow-[0_0_0_5px_rgba(248,113,113,.18),0_0_28px_rgba(248,113,113,.9)] sm:h-16 sm:w-16 sm:text-2xl" aria-live="polite">{extractedNumber}</div>}
        </div>
        <div className="relative z-10 mx-auto mt-1 flex max-w-[520px] items-center justify-center gap-3 rounded-2xl border border-amber-300/30 bg-black/45 px-3 py-2">
          <span className="text-[10px] font-black tracking-wider text-amber-200/70">LAST BALL</span>
          <span className="grid h-11 w-11 place-items-center rounded-full border-2 border-white/80 bg-[radial-gradient(circle_at_30%_25%,#fff,#fca5a5_18%,#ef4444_55%,#991b1b)] text-xl font-black text-white shadow-[0_0_18px_rgba(248,113,113,.45)]">{lastNumber ?? '—'}</span>
          <span className="text-xs text-amber-100/65">{state?.game?.drawnNumbers.length ?? 0} / 80 called</span>
        </div>
      </section>
      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-sm text-emerald-200">{notice}</p>}
      <section className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="rounded-2xl border border-amber-400/20 bg-black/50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-black text-amber-100">LIVE NUMBER BOARD · 1–80</h2>
            <span className="text-xs text-amber-400">{state?.game?.drawnNumbers.length ?? 0}/80</span>
          </div>
          <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
            {Array.from({ length: 80 }, (_, index) => index + 1).map((number) => (
              <div key={number} className={`grid aspect-square place-items-center rounded-lg border text-xs font-black tabular-nums sm:text-sm ${state?.game?.lastNumber === number ? 'border-amber-200 bg-amber-300 text-black shadow-[0_0_18px_rgba(245,190,70,.5)]' : drawn.has(number) ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200' : 'border-white/10 bg-white/[.035] text-white/40'}`}>{number}</div>
            ))}
          </div>
        </div>
        <aside className="space-y-3">
          <div className="rounded-2xl border border-amber-400/20 bg-black/50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-400">SIMULATION WALLET</p>
            <p className="mt-2 text-2xl font-black">{state?.balanceEtb == null ? '—' : money(state.balanceEtb)} <span className="text-sm text-amber-300">ETB</span></p>
            <p className="mt-1 text-[10px] text-amber-100/45">Non-withdrawable demo credits only</p>
          </div>
          <div className="rounded-2xl border border-amber-400/20 bg-black/50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-400">TICKET PURCHASE</p>
            <p className="mt-2 text-sm text-amber-100/70">Price: {state ? money(state.settings.ticketPriceEtb) : '—'} ETB each</p>
            <label className="mt-3 block text-xs text-amber-100/60">Number of tickets</label>
            <input type="number" min={1} max={state?.settings.maxTicketsPerPlayer ?? 10} value={count} onChange={(event) => setCount(Math.max(1, Math.min(10, Number(event.target.value) || 1)))} className="mt-1 w-full rounded-xl border border-amber-300/20 bg-black px-3 py-3 text-lg font-bold text-amber-100" />
            <button type="button" disabled={!canBuy || busy} onClick={() => void buy()} className="mt-3 w-full rounded-xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-black text-black disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Please wait…' : 'BUY & REGISTER TICKETS'}</button>
            {!canBuy && <p className="mt-2 text-[11px] text-amber-100/45">Ticket sales open when the Admin opens a new game.</p>}
          </div>
        </aside>
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-lg font-black">MY REGISTERED TICKETS</h2><span className="text-xs text-amber-400">{state?.tickets.length ?? 0} tickets</span></div>
        {!state?.tickets.length && <p className="rounded-xl border border-white/10 bg-black/40 p-5 text-center text-sm text-amber-100/50">No tickets registered for this game yet.</p>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {state?.tickets.map((ticket, index) => {
            const eligible = ticket.status === 'active' && state.game?.status === 'running' &&
              ticket.matchedNumbers.length === state.game.target &&
              state.game.lastNumber !== null && ticket.numbers.includes(state.game.lastNumber);
            return (
              <article key={ticket.id} className="rounded-2xl border border-amber-300/20 bg-[#0c0b08] p-3">
                <div className="mb-2 flex items-center justify-between"><span className="text-xs font-black text-amber-300">TICKET {index + 1}</span><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${ticket.status === 'locked' ? 'bg-red-500/15 text-red-300' : ticket.status === 'winner' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-300/10 text-amber-200'}`}>{ticket.status}</span></div>
                <div className="grid grid-cols-5 gap-1">
                  {ticket.numbers.map((number) => <div key={number} className={`grid aspect-square place-items-center rounded-md text-xs font-black tabular-nums ${ticket.matchedNumbers.includes(number) ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/50' : 'bg-white/[.06] text-amber-100/75'}`}>{number}</div>)}
                </div>
                <p className="mt-2 text-[10px] text-amber-100/50">{ticket.matchedNumbers.length}/{state.game?.target ?? state.settings.target} matched</p>
                <button type="button" disabled={!eligible || busy} onClick={() => void claim(ticket.id)} className="mt-2 w-full rounded-lg bg-amber-300 px-3 py-2.5 text-xs font-black text-black disabled:cursor-not-allowed disabled:opacity-30">BINGO</button>
              </article>
            );
          })}
        </div>
      </section>
      {state?.game?.status === 'ended' && <section className="rounded-2xl border border-emerald-400/30 bg-emerald-950/20 p-4 text-center"><h2 className="text-xl font-black text-emerald-200">{state.game.winner ? 'BINGO WINNER CONFIRMED' : 'GAME ENDED'}</h2><p className="mt-1 text-sm text-emerald-100/70">{state.game.winner ? 'The first valid exact-target claim ended this game.' : 'This game ended without a valid claim.'}</p></section>}
      <p className="text-center text-[10px] text-amber-100/35">Turbo Bingo is currently simulation-only. Demo credits have no cash value and cannot be withdrawn.</p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-amber-200/15 bg-black/35 p-3"><p className="text-[9px] font-bold tracking-wider text-amber-400/70">{label}</p><p className="mt-1 text-xl font-black tabular-nums">{value}</p></div>;
}
