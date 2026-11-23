import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

type Overview = {
  settings: { kenoEnabled: boolean; aviatorEnabled: boolean; minBetEtb: number; maxBetEtb: number; maxPayoutEtb: number; houseEdgePercent: number; kenoBettingSeconds: number; aviatorBettingSeconds: number };
  games: { keno: { roundId: string | null; status: string; bets: number }; aviator: { roundId: string | null; status: string; bets: number } };
  mode: string;
};

export function AdminGamesHub() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [minBet, setMinBet] = useState('5');
  const [maxBet, setMaxBet] = useState('1000');
  const [houseEdge, setHouseEdge] = useState('55');
  const [kenoSeconds, setKenoSeconds] = useState('20');
  const [aviatorSeconds, setAviatorSeconds] = useState('8');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    try {
      const next = await api.get<Overview>('/api/admin/games/overview');
      setOverview(next);
      setMinBet(String(next.settings.minBetEtb));
      setMaxBet(String(next.settings.maxBetEtb));
      setHouseEdge(String(next.settings.houseEdgePercent ?? 55));
      setKenoSeconds(String(next.settings.kenoBettingSeconds));
      setAviatorSeconds(String(next.settings.aviatorBettingSeconds));
      setError('');
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Could not load game settings.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async (patch: Record<string, unknown>) => {
    setBusy(true); setError(''); setNotice('');
    try { await api.post('/api/admin/games/settings', patch); setNotice('Games Center settings saved.'); await load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Settings could not be saved.'); }
    finally { setBusy(false); }
  };
  const card = 'rounded-xl border border-amber-400/15 bg-black/40 p-3';
  const label = 'block text-xs font-semibold text-amber-100/60';
  const input = 'mt-1 w-full rounded-lg border border-amber-400/20 bg-black px-3 py-2 text-sm text-amber-100';
  return <section className="rounded-2xl border border-amber-400/25 bg-[#0c0c0a] p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.25em] text-amber-500">Games management</p><h2 className="mt-1 text-lg font-black text-amber-100">Games Center Controls</h2></div><span className="rounded-full border border-amber-400/20 px-3 py-1 text-[10px] font-bold text-amber-300">SIMULATION ONLY</span></div>
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-emerald-300">{notice}</p>}
    <div className={card + ' mt-4'}>
      <p className="text-xs font-semibold text-amber-100/60">Maximum payout per Keno ticket / Aviator bet</p>
      <p className="mt-1 text-2xl font-black text-amber-200">{overview ? Number(overview.settings.maxPayoutEtb).toLocaleString() : '20,000'} ETB</p>
      <p className="mt-1 text-[11px] text-amber-100/40">Enforced server-side per Keno ticket and Aviator bet.</p>
      <p className="mt-2 text-xs text-amber-100/60">Pool commission: {overview?.settings.houseEdgePercent ?? 55}% · player pool: {100 - (overview?.settings.houseEdgePercent ?? 55)}%</p>
      <p className="mt-3 text-xs leading-5 text-amber-100/55">Keno and Aviator pay from the round pool only. Cash Out multipliers are recorded immediately; Aviator wallet credits are settled after the crash. The configured commission is reserved before player payouts.</p>
      <p className="mt-2 text-xs leading-5 text-amber-300/80">Round-level pool cap: enabled server-side; total prizes cannot exceed the configured 40%–50% player share of collected stakes.</p>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className={card}><div className="flex items-center justify-between gap-2"><div><p className="font-bold text-amber-100">Keno</p><p className="text-xs text-amber-100/45">{overview?.games.keno.status ?? 'Loading'} · {overview?.games.keno.bets ?? 0} bets</p></div><button disabled={busy || !overview} onClick={() => void save({ kenoEnabled: !overview?.settings.kenoEnabled })} className="rounded-lg border border-amber-300/25 px-3 py-2 text-xs font-bold text-amber-200">{overview?.settings.kenoEnabled ? 'Disable' : 'Enable'}</button></div></div>
      <div className={card}><div className="flex items-center justify-between gap-2"><div><p className="font-bold text-amber-100">Aviator</p><p className="text-xs text-amber-100/45">{overview?.games.aviator.status ?? 'Loading'} · {overview?.games.aviator.bets ?? 0} bets</p></div><button disabled={busy || !overview} onClick={() => void save({ aviatorEnabled: !overview?.settings.aviatorEnabled })} className="rounded-lg border border-amber-300/25 px-3 py-2 text-xs font-bold text-amber-200">{overview?.settings.aviatorEnabled ? 'Disable' : 'Enable'}</button></div></div>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className={label}>Minimum bet (ETB)<input className={input} type="number" min="1" max="1000" step=".01" value={minBet} onChange={e=>setMinBet(e.target.value)}/></label>
      <label className={label}>Maximum bet (ETB)<input className={input} type="number" min="1" max="5000" step=".01" value={maxBet} onChange={e=>setMaxBet(e.target.value)}/></label>
      <label className={label}>Company commission / House Edge (%)<input className={input} type="number" min="50" max="60" step="1" value={houseEdge} onChange={e=>setHouseEdge(e.target.value)}/></label>
      <label className={label}>Keno round / betting duration
          <select className={input} value={kenoSeconds} onChange={e=>setKenoSeconds(e.target.value)}>
            <optgroup label="Seconds">
              <option value="10">10 seconds</option><option value="15">15 seconds</option><option value="20">20 seconds</option><option value="30">30 seconds</option><option value="45">45 seconds</option>
            </optgroup>
            <optgroup label="Minutes">
              <option value="60">1 minute</option><option value="120">2 minutes</option><option value="180">3 minutes</option><option value="300">5 minutes</option><option value="600">10 minutes</option>
            </optgroup>
          </select>
          <span className="mt-1 block text-[10px] font-normal text-amber-100/40">Applies to the next Keno round.</span>
        </label>
      <label className={label}>Aviator betting window (seconds)<input className={input} type="number" min="5" max="20" value={aviatorSeconds} onChange={e=>setAviatorSeconds(e.target.value)}/></label>
    </div>
    <button disabled={busy} onClick={() => void save({ minBetEtb: Number(minBet), maxBetEtb: Number(maxBet), houseEdgePercent: Number(houseEdge), kenoBettingSeconds: Number(kenoSeconds), aviatorBettingSeconds: Number(aviatorSeconds) })} className="mt-4 rounded-xl bg-gradient-to-r from-amber-200 to-amber-500 px-5 py-3 text-sm font-black text-black disabled:opacity-50">{busy ? 'Saving…' : 'Save game settings'}</button>
    <p className="mt-3 text-[11px] leading-5 text-amber-100/40">Game availability, bet limits, round timers and pool commission (50%–60%). Payout settlement is capped by each round's collected stakes; the crash/draw fairness algorithms remain unchanged.</p>
  </section>;
}
