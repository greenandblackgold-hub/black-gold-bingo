import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { adminGamesLocale } from '@/lib/adminGamesLocalization';

type Overview = {
  settings: { generalEnabled: boolean; announcementText: string; announcementVisible: boolean; bingoEnabled: boolean; kenoEnabled: boolean; aviatorEnabled: boolean; minesEnabled: boolean; carRacingEnabled: boolean; minBetEtb: number; kenoMinBetEtb: number; maxBetEtb: number; maxPayoutEtb: number; houseEdgePercent: number; kenoBettingSeconds: number; kenoDrawIntervalSeconds: number; aviatorBettingSeconds: number };
  games: { keno: { roundId: string | null; status: string; bets: number }; aviator: { roundId: string | null; status: string; bets: number } };
  mode: string;
};

type HostGameSection = 'bingo' | 'keno' | 'aviator' | 'mines' | 'car-racing';

export function AdminGamesHub({ activeGame }: { activeGame: HostGameSection }) {
  const { lang } = useLanguage();
  const t = (key: Parameters<typeof adminGamesLocale>[1]) => adminGamesLocale(lang, key);
  const statusLabel = (status?: string | null) => status === 'betting' ? t('statusBetting') : status === 'settled' ? t('statusSettled') : status === 'crashed' ? t('statusCrashed') : status === 'waiting' ? t('statusWaiting') : status === 'active' ? t('statusActive') : status === 'pending' ? t('statusPending') : status ? t('statusUnknown') : t('loading');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [minBet, setMinBet] = useState('5');
  const [kenoMinBet, setKenoMinBet] = useState('2');
  const [maxBet, setMaxBet] = useState('1000');
  const [houseEdge, setHouseEdge] = useState('55');
  const [kenoSeconds, setKenoSeconds] = useState('20');
  const [kenoDrawSeconds, setKenoDrawSeconds] = useState('1');
  const [aviatorSeconds, setAviatorSeconds] = useState('8');
  const [announcementText, setAnnouncementText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    try {
      const next = await api.get<Overview>('/api/admin/games/overview');
      setOverview(next);
      setMinBet(String(next.settings.minBetEtb));
      setKenoMinBet(String(next.settings.kenoMinBetEtb ?? 2));
      setMaxBet(String(next.settings.maxBetEtb));
      setHouseEdge(String(next.settings.houseEdgePercent ?? 55));
      setKenoSeconds(String(next.settings.kenoBettingSeconds));
      setKenoDrawSeconds(String(next.settings.kenoDrawIntervalSeconds ?? 1));
      setAviatorSeconds(String(next.settings.aviatorBettingSeconds));
      setAnnouncementText(next.settings.announcementText ?? '');
      setError('');
    } catch { setError(t('loadError')); }
  }, [lang]);
  useEffect(() => { void load(); }, [load]);
  const save = async (patch: Record<string, unknown>) => {
    setBusy(true); setError(''); setNotice('');
    try { await api.post('/api/admin/games/settings', patch); setNotice(t('saved')); await load(); }
    catch { setError(t('saveError')); }
    finally { setBusy(false); }
  };
  const card = 'rounded-xl border border-amber-400/15 bg-black/40 p-3';
  const label = 'block text-xs font-semibold text-amber-100/60';
  const input = 'mt-1 w-full rounded-lg border border-amber-400/20 bg-black px-3 py-2 text-sm text-amber-100';
  return <section aria-label={`${activeGame} · ${t('hostControls')}`} className="rounded-2xl border border-amber-400/25 bg-[#0c0c0a] p-3 shadow-lg shadow-black/20 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.25em] text-amber-500">{t('management')}</p><h2 className="mt-1 text-lg font-black text-amber-100">{t('controls')}</h2></div><span className="rounded-full border border-amber-400/20 px-3 py-1 text-[10px] font-bold uppercase text-amber-300">{activeGame}</span></div>
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-emerald-300">{notice}</p>}
    <div className={card + ' mt-4'}><div className="flex items-center justify-between gap-3"><div><p className="font-bold text-amber-100">{t('general')}</p><p className="text-xs text-amber-100/45">{overview?.settings.generalEnabled ? t('allOn') : t('allOff')}</p></div><button disabled={busy || !overview} onClick={() => { if (!overview) return; if (overview.settings.generalEnabled && !window.confirm(t('confirmOff'))) return; void save({ generalEnabled: !overview.settings.generalEnabled }); }} className="rounded-lg border border-amber-300/25 px-3 py-2 text-xs font-bold text-amber-200">{overview?.settings.generalEnabled ? t('generalOff') : t('generalOn')}</button></div></div>
    <div className={card + ' mt-4'}>
      <p className="font-bold text-amber-100">{t('announcement')}</p>
      <p className="mt-1 text-xs text-amber-100/50">{t('announcementHelp')}</p>
      <textarea maxLength={500} rows={3} value={announcementText} onChange={e => setAnnouncementText(e.target.value)} className={input + ' resize-y'} placeholder={t('announcementPlaceholder')} />
      <button disabled={busy || !overview} onClick={() => void save({ announcementText })} className="mt-2 rounded-lg border border-amber-300/25 px-3 py-2 text-xs font-bold text-amber-200">{t('saveAnnouncement')}</button>
    </div>
    <div className={card + ' mt-2'}><div className="flex items-center justify-between gap-3"><div><p className="font-bold text-amber-100">{t('showAnnouncement')}</p><p className="text-xs text-amber-100/45">{overview?.settings.announcementVisible ? t('visibleOff') : t('hidden')}</p></div><button disabled={busy || !overview} onClick={() => void save({ announcementVisible: !overview?.settings.announcementVisible })} className="rounded-lg border border-amber-300/25 px-3 py-2 text-xs font-bold text-amber-200">{overview?.settings.announcementVisible ? t('hideMessage') : t('showMessage')}</button></div></div>
    {activeGame === 'bingo' && <>
    <div className={card + ' mt-4'}>
      <p className="text-xs font-semibold text-amber-100/60">{t('maxPayout')}</p>
      <p className="mt-1 text-2xl font-black text-amber-200">{overview ? Number(overview.settings.maxPayoutEtb).toLocaleString() : '20,000'} {t('currency')}</p>
      <p className="mt-1 text-[11px] text-amber-100/40">{t('enforced')}</p>
      <p className="mt-2 text-xs text-amber-100/60">{t('commission')}: {overview?.settings.houseEdgePercent ?? 55}% · {t('playerPool')}: {100 - (overview?.settings.houseEdgePercent ?? 55)}%</p>
      <p className="mt-3 text-xs leading-5 text-amber-100/55">{t('poolNote')}</p>
      <p className="mt-2 text-xs leading-5 text-amber-300/80">{t('poolCap')}</p>
    </div>
    <p className="mt-4 text-xs font-semibold text-amber-100/60">{t('hostControls')}</p>
    </>}
    <div className="mt-2 grid gap-3 sm:grid-cols-2">
      {activeGame === 'car-racing' && <div className={card + ' sm:col-span-2'}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold text-amber-100">Multiplayer Car Racing</p><p className="mt-1 text-xs text-amber-100/50">{overview?.settings.carRacingEnabled ? t('visible') : t('hidden')} · DEMO ONLY</p><p className="mt-2 max-w-xl text-xs leading-5 text-amber-100/45">Control whether Car Racing appears in the Player Games Center. The General Games Center switch must also be ON for players to access it.</p></div><button type="button" role="switch" aria-checked={overview?.settings.carRacingEnabled === true} aria-label="Multiplayer Car Racing" disabled={busy || !overview} onClick={() => void save({ carRacingEnabled: !overview?.settings.carRacingEnabled })} className={['relative h-9 w-16 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 disabled:opacity-50', overview?.settings.carRacingEnabled ? 'bg-amber-400' : 'bg-white/10 ring-1 ring-amber-700/50'].join(' ')}><span className={['absolute top-1.5 h-6 w-6 rounded-full bg-[#0c0c0a] ring-1 ring-amber-300 transition-all', overview?.settings.carRacingEnabled ? 'left-9' : 'left-1.5'].join(' ')} /></button></div></div>}
      {activeGame === 'bingo' && <div className={card}><div className="flex items-center justify-between gap-2"><div><p className="font-bold text-amber-100">Bingo PRO</p><p className="text-xs text-amber-100/45">{overview?.settings.bingoEnabled ? t('visible') : t('hidden')}</p></div><button disabled={busy || !overview} onClick={() => void save({ bingoEnabled: !overview?.settings.bingoEnabled })} className="rounded-lg border border-amber-300/25 px-3 py-2 text-xs font-bold text-amber-200">{overview?.settings.bingoEnabled ? t('turnOff') : t('turnOn')}</button></div></div>}
      {activeGame === 'keno' && <div className={card}><div className="flex items-center justify-between gap-2"><div><p className="font-bold text-amber-100">Keno</p><p className="text-xs text-amber-100/45">{statusLabel(overview?.games.keno.status)} · {overview?.games.keno.bets ?? 0} {t('betsLabel')}</p></div><button disabled={busy || !overview} onClick={() => void save({ kenoEnabled: !overview?.settings.kenoEnabled })} className="rounded-lg border border-amber-300/25 px-3 py-2 text-xs font-bold text-amber-200">{overview?.settings.kenoEnabled ? t('turnOff') : t('turnOn')}</button></div></div>}
      {activeGame === 'aviator' && <div className={card}><div className="flex items-center justify-between gap-2"><div><p className="font-bold text-amber-100">Aviator</p><p className="text-xs text-amber-100/45">{statusLabel(overview?.games.aviator.status)} · {overview?.games.aviator.bets ?? 0} {t('betsLabel')}</p></div><button disabled={busy || !overview} onClick={() => void save({ aviatorEnabled: !overview?.settings.aviatorEnabled })} className="rounded-lg border border-amber-300/25 px-3 py-2 text-xs font-bold text-amber-200">{overview?.settings.aviatorEnabled ? t('turnOff') : t('turnOn')}</button></div></div>}
      {activeGame === 'mines' && <div className={card}><div className="flex items-center justify-between gap-2"><div><p className="font-bold text-amber-100">Mines</p><p className="text-xs text-amber-100/45">{overview?.settings.minesEnabled ? t('visible') : t('hidden')}</p></div><button disabled={busy || !overview} onClick={() => void save({ minesEnabled: !overview?.settings.minesEnabled })} className="rounded-lg border border-amber-300/25 px-3 py-2 text-xs font-bold text-amber-200">{overview?.settings.minesEnabled ? t('turnOff') : t('turnOn')}</button></div></div>}
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {activeGame === 'aviator' && <label className={label}>{t('aviatorMinBet')}<input className={input} type="number" min="1" max="1000" step=".01" value={minBet} onChange={e=>setMinBet(e.target.value)}/></label>}
      {activeGame === 'keno' && <label className={label}>{t('kenoMinBet')}<input className={input} type="number" min="2" max="1000" step=".01" value={kenoMinBet} onChange={e=>setKenoMinBet(e.target.value)}/><span className="mt-1 block text-[10px] font-normal text-amber-100/40">{t('kenoMinBetHelp')}</span></label>}
      {(activeGame === 'keno' || activeGame === 'aviator') && <label className={label}>{t('maxBet')}<input className={input} type="number" min="1" max="5000" step=".01" value={maxBet} onChange={e=>setMaxBet(e.target.value)}/></label>}
      {activeGame === 'aviator' && <label className={label}>{t('houseEdge')}<input className={input} type="number" min="50" max="60" step="1" value={houseEdge} onChange={e=>setHouseEdge(e.target.value)}/></label>}
      {activeGame === 'keno' && <div className={card}>
        <p className="font-bold text-amber-100">{t('kenoDrawInterval')}</p>
        <p className="mt-1 text-[10px] text-amber-100/45">{t('kenoDrawIntervalHelp')}</p>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" disabled={busy || Number(kenoDrawSeconds) <= 1} onClick={() => setKenoDrawSeconds(value => String(Math.max(1, Number(value) - 1)))} aria-label={t('decreaseSeconds')} className="grid h-11 w-11 place-items-center rounded-lg border border-amber-300/30 bg-black text-2xl font-black text-amber-200 disabled:opacity-35">−</button>
          <output className="min-w-20 text-center text-2xl font-black tabular-nums text-amber-200">{kenoDrawSeconds} {t('seconds')}</output>
          <button type="button" disabled={busy || Number(kenoDrawSeconds) >= 10} onClick={() => setKenoDrawSeconds(value => String(Math.min(10, Number(value) + 1)))} aria-label={t('increaseSeconds')} className="grid h-11 w-11 place-items-center rounded-lg border border-amber-300/30 bg-black text-2xl font-black text-amber-200 disabled:opacity-35">+</button>
        </div>
        <p className="mt-2 text-[10px] text-amber-300/70">{t('kenoDrawIntervalTotal')}: {Number(kenoDrawSeconds) * 20} {t('seconds')}</p>
      </div>}
      {activeGame === 'keno' && <label className={label}>{t('kenoDuration')}
          <select className={input} value={kenoSeconds} onChange={e=>setKenoSeconds(e.target.value)}>
            <optgroup label={t('seconds')}>
              <option value="10">{10} {t('seconds')}</option><option value="15">{15} {t('seconds')}</option><option value="20">{20} {t('seconds')}</option><option value="30">{30} {t('seconds')}</option><option value="45">{45} {t('seconds')}</option>
            </optgroup>
            <optgroup label={t('minutes')}>
              <option value="60">{1} {t('minutes')}</option><option value="120">{2} {t('minutes')}</option><option value="180">{3} {t('minutes')}</option><option value="300">{5} {t('minutes')}</option><option value="600">{10} {t('minutes')}</option>
            </optgroup>
          </select>
          <span className="mt-1 block text-[10px] font-normal text-amber-100/40">{t('nextKeno')}</span>
        </label>}
      {activeGame === 'aviator' && <label className={label}>{t('aviatorWindow')}
        <select className={input} value={aviatorSeconds} onChange={e=>setAviatorSeconds(e.target.value)}>
          <optgroup label={t('seconds')}>
            {[5, 8, 10, 12, 15, 20, 30, 45].map((value) => <option key={value} value={value}>{value} {t('seconds')}</option>)}
          </optgroup>
          <optgroup label={t('minutes')}><option value="60">1 {t('minutes')}</option></optgroup>
        </select>
      </label>}
    </div>
    {activeGame === 'keno' && <button disabled={busy || !overview} onClick={() => void save({ kenoMinBetEtb: Number(kenoMinBet), maxBetEtb: Number(maxBet), kenoBettingSeconds: Number(kenoSeconds), kenoDrawIntervalSeconds: Number(kenoDrawSeconds) })} className="mt-3 rounded-xl bg-gradient-to-r from-amber-200 to-amber-500 px-5 py-3 text-sm font-black text-black disabled:opacity-50">{busy ? t('saving') : t('saveSettings')}</button>}
    {activeGame === 'aviator' && <button disabled={busy || !overview} onClick={() => void save({ minBetEtb: Number(minBet), maxBetEtb: Number(maxBet), houseEdgePercent: Number(houseEdge), aviatorBettingSeconds: Number(aviatorSeconds) })} className="mt-3 rounded-xl bg-gradient-to-r from-amber-200 to-amber-500 px-5 py-3 text-sm font-black text-black disabled:opacity-50">{busy ? t('saving') : t('saveSettings')}</button>}
    {activeGame === 'mines' && <p className="mt-3 text-xs text-amber-100/50">{t('footer')}</p>}
    <p className="mt-3 text-[11px] leading-5 text-amber-100/40">{t('footer')}</p>
  </section>;
}
