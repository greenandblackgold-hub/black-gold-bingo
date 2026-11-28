import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Mode = 'automatic' | 'admin';
type RoundType = 'quick' | 'standard' | 'full_house' | 'custom';
type Overview = {
  settings: { enabled: boolean; mode: Mode; roundType: RoundType; target: number; ticketPriceEtb: number; prizeEtb: number; drawIntervalSeconds: number; roundDurationSeconds: number; maxTicketsPerPlayer: number };
  game: null | { id: string; status: string; target: number; drawnNumbers: number[]; ticketCount: number; mode?: Mode; roundType?: RoundType; prizeEtb?: number; roundDurationSeconds?: number; endsAt?: number | null; registrationEndsAt?: number | null; pausedAt?: number | null };
  tickets: Array<{ id: string; userId: string; status: string }>;
  history?: Array<{ id: string; target: number; drawnNumbers: number[]; endReason?: string; winner?: { userId: string; ticketId: string } | null }>;
};
const field = 'mt-1 w-full rounded-lg border border-amber-400/20 bg-black px-3 py-2.5 text-sm font-bold text-amber-100';
const card = 'rounded-xl border border-amber-200/15 bg-black/40 p-3';
const label = 'block text-xs font-semibold text-amber-300';

export function AdminTurboBingo() {
  const [data, setData] = useState<Overview | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState<Mode>('automatic');
  const [roundType, setRoundType] = useState<RoundType>('standard');
  const [target, setTarget] = useState('10');
  const [price, setPrice] = useState('10');
  const [prize, setPrize] = useState('50');
  const [interval, setInterval] = useState('10');
  const [duration, setDuration] = useState('300');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    const next = await api.get<Overview>('/api/admin/turbo-bingo/overview');
    setData(next); setEnabled(next.settings.enabled); setMode(next.settings.mode ?? 'automatic');
    setRoundType(next.settings.roundType ?? 'standard'); setTarget(String(next.settings.target));
    setPrice(String(next.settings.ticketPriceEtb)); setPrize(String(next.settings.prizeEtb ?? 50));
    setInterval(String(next.settings.drawIntervalSeconds)); setDuration(String(next.settings.roundDurationSeconds ?? 300));
  }, []);
  useEffect(() => {
    let active = true;
    void load().catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Unable to load settings.'); });
    const poll = window.setInterval(() => {
      void api.get<Overview>('/api/admin/turbo-bingo/overview').then((next) => { if (active) setData(next); }).catch(() => undefined);
    }, 1000);
    return () => { active = false; window.clearInterval(poll); };
  }, [load]);
  const action = async (path: string, body: unknown = {}) => {
    setBusy(true); setError(''); setNotice('');
    try { await api.post(path, body); await load(); setNotice('Saved successfully.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Action failed.'); }
    finally { setBusy(false); }
  };
  const save = () => void action('/api/admin/turbo-bingo/settings', {
    enabled, mode, roundType, target: Number(target), ticketPriceEtb: Number(price),
    prizeEtb: Number(prize), drawIntervalSeconds: Number(interval), roundDurationSeconds: Number(duration),
  });
  const game = data?.game;
  const activeMode = game?.mode ?? mode;
  const activePrize = game?.prizeEtb ?? Number(prize);
  const activeRoundType = game?.roundType ?? roundType;
  const chooseRound = (value: RoundType) => {
    setRoundType(value);
    if (value === 'quick') setTarget('5');
    else if (value === 'standard') setTarget('10');
    else if (value === 'full_house') setTarget('12');
  };
  return (
    <section className="space-y-4 rounded-2xl border border-amber-400/30 bg-[#090907] p-4 sm:p-5">
      <header><p className="text-[10px] font-black uppercase tracking-[.25em] text-amber-500">HOST GAME CONTROL · 06</p><h2 className="mt-1 text-xl font-black text-amber-100">TURBO BINGO · ትርቦ ቢንጎ</h2><p className="mt-1 text-xs text-amber-100/50">Admin-controlled or automatic · Server-random numbers · Simulation-only prize wallet</p></header>
      {error && <p role="alert" className="rounded-lg bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-950/30 p-3 text-sm text-emerald-200">{notice}</p>}
      <div className={card + ' flex items-center justify-between gap-4'}>
        <div><p className="text-sm font-bold text-amber-100">Turbo Bingo · Player Visibility</p><p className="mt-1 text-xs text-amber-100/50">{enabled ? 'ON · Visible to players when Games Center is ON' : 'OFF · Hidden from players'}</p></div>
        <button type="button" role="switch" aria-checked={enabled} aria-label="Turbo Bingo player visibility" disabled={busy || !data} onClick={() => setEnabled(!enabled)} className={['relative h-10 w-[4.5rem] shrink-0 rounded-full transition-colors disabled:opacity-50', enabled ? 'bg-emerald-500' : 'bg-red-900 ring-1 ring-red-500/60'].join(' ')}><span className={['absolute top-2 h-6 w-6 rounded-full bg-[#090907] ring-1 ring-white/70 transition-all', enabled ? 'left-10' : 'left-2'].join(' ')} /></button>
      </div>
      <div className={card + ' space-y-3'}>
        <div><h3 className="font-black text-amber-100">1. GAME CONTROL MODE</h3><p className="mt-1 text-xs text-amber-100/50">Choose who controls when numbers are called. The server always selects numbers randomly.</p></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" aria-pressed={mode === 'admin'} onClick={() => setMode('admin')} className={['rounded-xl border p-3 text-left', mode === 'admin' ? 'border-amber-300 bg-amber-300/15 text-amber-100' : 'border-amber-200/15 text-amber-100/60'].join(' ')}><b className="block text-sm">ADMIN MANUAL MODE</b><span className="mt-1 block text-xs opacity-70">Admin starts the round and presses CALL NEXT NUMBER for each draw.</span></button>
          <button type="button" aria-pressed={mode === 'automatic'} onClick={() => setMode('automatic')} className={['rounded-xl border p-3 text-left', mode === 'automatic' ? 'border-amber-300 bg-amber-300/15 text-amber-100' : 'border-amber-200/15 text-amber-100/60'].join(' ')}><b className="block text-sm">AUTOMATIC MODE</b><span className="mt-1 block text-xs opacity-70">Server starts drawing automatically at the selected interval.</span></button>
        </div>
      </div>
      <div className={card + ' space-y-3'}>
        <h3 className="font-black text-amber-100">2. ROUND SETTINGS</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>Round Type<select value={roundType} onChange={e => chooseRound(e.target.value as RoundType)} className={field}><option value="quick">Quick Round · 5 matches</option><option value="standard">Standard Round · 10 matches</option><option value="full_house">Full House · 12 matches</option><option value="custom">Custom Target</option></select></label>
          <label className={label}>Winning Target (1–12)<input type="number" min="1" max="12" value={target} onChange={e => { setTarget(e.target.value); setRoundType('custom'); }} className={field} /></label>
          <label className={label}>Ticket Price (ETB)<input type="number" min="0.1" max="1000" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className={field} /></label>
          <label className={label}>Winner Prize (ETB · demo credits)<input type="number" min="0" max="10000" step="0.01" value={prize} onChange={e => setPrize(e.target.value)} className={field} /></label>
          <label className={label}>Draw Interval (seconds)<input type="number" min="1" max="30" value={interval} onChange={e => setInterval(e.target.value)} className={field} /></label>
          <label className={label}>Round Duration (seconds)<input type="number" min="30" max="3600" value={duration} onChange={e => setDuration(e.target.value)} className={field} /></label>
        </div>
        <p className="text-[10px] leading-4 text-amber-100/45">Settings are saved for the next round. Current round rules and prize stay fixed once ticket sales open. Duration: 30–3,600 seconds. Prize: non-withdrawable Turbo Bingo demo credits only.</p>
      </div>
      <button type="button" disabled={busy || !data} onClick={save} className="w-full rounded-xl bg-amber-300 px-4 py-3 font-black text-black disabled:opacity-50">SAVE TURBO BINGO SETTINGS</button>
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-black text-amber-100">CURRENT GAME · HOST CONTROL</h3><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${game?.pausedAt ? 'bg-amber-300/15 text-amber-200' : game?.status === 'running' ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-300/10 text-amber-300'}`}>{game?.pausedAt ? 'PAUSED' : game?.status ?? 'NOT OPEN'}</span></div>
        <div className="my-4 flex flex-col items-center gap-3 rounded-xl border border-amber-300/20 bg-gradient-to-b from-amber-300/[.08] to-black/40 p-4">
          <div className="grid h-36 w-36 place-items-center rounded-full border-2 border-amber-300/70 bg-[radial-gradient(circle_at_30%_25%,#fff0b3,#d4af37_55%,#3b2600)] p-4 text-center text-black shadow-[0_0_35px_rgba(212,175,55,.2)]">
            {game?.drawnNumbers?.length ? <div><span className="block text-sm font-black tracking-widest">{game.drawnNumbers.at(-1)! <= 16 ? 'B' : game.drawnNumbers.at(-1)! <= 32 ? 'I' : game.drawnNumbers.at(-1)! <= 48 ? 'N' : game.drawnNumbers.at(-1)! <= 64 ? 'G' : 'O'}</span><strong className="block text-5xl font-black tabular-nums">{game.drawnNumbers.at(-1)}</strong></div> : <span className="text-sm font-black leading-6">እስካሁን አልተጠራም</span>}
          </div>
          <p className="text-xs font-bold tracking-wide text-amber-200">{game?.pausedAt ? 'ROUND PAUSED' : game?.drawnNumbers?.length ? 'LATEST CALLED NUMBER' : 'WAITING FOR FIRST CALL'}</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="TARGET" value={String(game?.target ?? target)} /><Metric label="TICKETS" value={String(game?.ticketCount ?? 0)} /><Metric label="CALLED" value={String(game?.drawnNumbers.length ?? 0)} /><Metric label="PRIZE ETB" value={String(activePrize)} />
        </div>
        <p className="mt-3 text-xs text-amber-100/60">Round: {activeRoundType.replace('_', ' ')} · Control: {activeMode === 'admin' ? 'Admin manual' : 'Automatic'}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button type="button" disabled={busy || (game != null && game.status !== 'ended')} onClick={() => void action('/api/admin/turbo-bingo/open')} className="rounded-lg border border-amber-300/40 px-3 py-3 text-xs font-black text-amber-200 disabled:opacity-30">{game?.status === 'ended' ? 'NEW ROUND' : 'OPEN ROUND'}</button>
          <button type="button" disabled={busy || game?.status !== 'waiting'} onClick={() => void action('/api/admin/turbo-bingo/start')} className="rounded-lg bg-emerald-400 px-3 py-3 text-xs font-black text-black disabled:opacity-30">START ROUND</button>
          <button type="button" disabled={busy || !game || game.status === 'ended'} onClick={() => void action('/api/admin/turbo-bingo/stop')} className="rounded-lg border border-zinc-500/50 bg-zinc-950 px-3 py-3 text-xs font-black text-zinc-200 disabled:opacity-30">ዙር ጨርስ · END ROUND</button>
        </div>
        <button type="button" disabled={busy} onClick={() => void action('/api/admin/turbo-bingo/draw')} className="mt-3 w-full rounded-lg bg-amber-300 px-4 py-3 text-sm font-black text-black shadow-[0_0_18px_rgba(212,175,55,.18)] disabled:opacity-40">ቀጣይ ቁጥር ጥራ · CALL NEXT NUMBER</button>
        <div className="mt-4 space-y-2">
          <h4 className="text-xs font-black uppercase tracking-widest text-amber-300">የተጠሩ ቁጥሮች · LAST CALLED BALLS</h4>
          {game?.drawnNumbers?.length ? <div className="flex flex-wrap gap-2">{game.drawnNumbers.slice(-7).reverse().map((number) => <span key={number} className="rounded-lg border border-amber-300/35 bg-amber-300/10 px-3 py-2 text-sm font-black tabular-nums text-amber-100">{number <= 16 ? 'B' : number <= 32 ? 'I' : number <= 48 ? 'N' : number <= 64 ? 'G' : 'O'}-{number}</span>)}</div> : <p className="rounded-lg border border-dashed border-amber-300/25 bg-black/30 px-3 py-3 text-center text-sm text-amber-100/55">እስካሁን ምንም ቁጥር አልተጠራም</p>}
        </div>
        <div className="mt-4 space-y-2">
          <h4 className="text-xs font-black uppercase tracking-widest text-amber-300">የወጡ ቁጥሮች · CALLED NUMBERS (1–80)</h4>
          <div className="overflow-x-auto rounded-lg border border-amber-300/20">
            <table className="w-full table-fixed border-collapse text-center text-xs">
              <thead><tr>{['B','I','N','G','O'].map((letter) => <th key={letter} className="border border-amber-300/20 bg-amber-300/15 py-2 font-black text-amber-200">{letter}</th>)}</tr></thead>
              <tbody>{Array.from({ length: 16 }, (_, row) => <tr key={row}>{[0,1,2,3,4].map((column) => { const number = column * 16 + row + 1; const wasCalled = (game?.drawnNumbers ?? []).includes(number); return <td key={number} aria-label={`${number}${wasCalled ? ' called' : ''}`} className={`border border-amber-300/10 py-2 font-bold tabular-nums ${wasCalled ? 'bg-amber-300 text-black shadow-[inset_0_0_0_1px_rgba(0,0,0,.15)]' : 'bg-black/25 text-amber-100/45'}`}>{number}</td>; })}</tr>)}</tbody>
            </table>
          </div>
          <p className="text-[10px] leading-4 text-amber-100/40">Turbo Bingo 80-ball columns: B 1–16 · I 17–32 · N 33–48 · G 49–64 · O 65–80. Winning target remains 1–12.</p>
        </div>
      </div>
      <div className={card}><h3 className="font-black text-amber-100">ROUND HISTORY</h3><div className="mt-2 space-y-2">{(data?.history ?? []).length ? (data?.history ?? []).slice(0, 10).map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-2 border-b border-amber-200/10 pb-2 text-xs text-amber-100/65"><span>{item.id.slice(0, 8)} · Target {item.target} · {item.drawnNumbers.length} balls</span><span>{item.winner ? 'Winner confirmed' : item.endReason ?? 'Ended'}</span></div>) : <p className="text-xs text-amber-100/45">No completed rounds yet.</p>}</div></div>
      <p className="text-[10px] leading-5 text-amber-100/40">All tickets and prizes use the separate non-withdrawable Turbo Bingo demo wallet. No legacy Bingo wallet, deposit, withdrawal, or payment flow is used.</p>
    </section>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white/[.04] p-2"><p className="text-[9px] uppercase text-amber-400/60">{label}</p><p className="mt-1 text-lg font-black text-amber-100">{value}</p></div>;
}
