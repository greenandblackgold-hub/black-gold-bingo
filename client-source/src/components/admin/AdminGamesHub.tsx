import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { adminGamesLocale } from '@/lib/adminGamesLocalization';

type Overview = {
  settings: { generalEnabled: boolean; announcementText: string; announcementVisible: boolean; bingoEnabled: boolean; kenoEnabled: boolean; aviatorEnabled: boolean; minBetEtb: number; maxBetEtb: number; maxPayoutEtb: number; houseEdgePercent: number; kenoBettingSeconds: number; aviatorBettingSeconds: number };
  games: { keno: { roundId: string | null; status: string; bets: number }; aviator: { roundId: string | null; status: string; bets: number } };
  mode: string;
};

export function AdminGamesHub() {
  const { lang } = useLanguage();
  const t = (key: Parameters<typeof adminGamesLocale>[1]) => adminGamesLocale(lang, key);
  const statusLabel = (status?: string | null) => status === 'betting' ? t('statusBetting') : status === 'settled' ? t('statusSettled') : status === 'crashed' ? t('statusCrashed') : status ?? t('loading');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [minBet, setMinBet] = useState('2');
  const [maxBet, setMaxBet] = useState('1000');
  const [houseEdge, setHouseEdge] = useState('55');
  const [kenoSeconds, setKenoSeconds] = useState('20');
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
      setMaxBet(String(next.settings.maxBetEtb));
      setHouseEdge(String(next.settings.houseEdgePercent ?? 55));
      setKenoSeconds(String(next.settings.kenoBettingSeconds));
      setAviatorSeconds(String(next.settings.aviatorBettingSeconds));
      setAnnouncementText(next.settings.announcementText ?? '');
      setError('');
    } catch (e) { setError(e instanceof ApiError ? e.message : t('loadError')); }
  }, [lang]);
  useEffect(() => { void load(); }, [load]);
  const save = async (patch: Record<string, unknown>) => {
    setBusy(true); setError(''); setNotice('');
    try { await api.post('/api/admin/games/settings', patch); setNotice(t('saved')); await load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : t('saveError')); }
    finally { setBusy(false); }
  };
  const card = 'rounded-xl border border-amber-400/15 bg-black/40 p-3';
  const label = 'block text-xs font-semibold text-amber-100/60';
  const input = 'mt-1 w-full rounded-lg border border-amber-400/20 bg-black px-3 py-2 text-sm text-amber-100';
  return <section className="rounded-2xl border border-amber-400/25 bg-[#0c0c0a] p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.25em] text-amber-500">{t('management')}</p><h2 className="mt-1 text-lg font-black text-amber-100">{t('controls')}</h2></div><span className="rounded-full border border-amber-400/20 px-3 py-1 text-[10px] font-bold text-amber-300">{t('simulation')}</span></div>
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-emerald-300">{notice}</p>}
    <div className={card + ' mt-4'}>
      <p className="text-xs font-semibold text-amber-100/60">{t('maxPayout')}</p>
      <p className="mt-1 text-2xl font-black text-amber-200">{overview ? Number(overview.settings.maxPayoutEtb).toLocaleString() : '20,000'} ETB</p>
      <p className="mt-1 text-[11px] text-amber-100/40">{t('enforced')}</p>
      <p className="mt-2 text-xs text-amber-100/60">{t('commission')}: {overview?.settings.houseEdgePercent ?? 55}% · {t('playerPool')}: {100 - (overview?.settings.houseEdgePercent ?? 55)}%</p>
      <p className="mt-3 text-xs leading-5 text-amber-100/55">{t('poolNote')}</p>
      <p className="mt-2 text-xs leading-5 text-amber-300/80">{t('poolCap')}</p>
    </div>
    <div className={card + ' mt-4'}>
      <p className="font-bold text-amber-100">{t('announcement')}</p>
      <p className="mt-1 text-xs text-amber-100/50">{t('announcementHelp')}</p>
      <textarea maxLength={500} rows={3} value={announcementText} onChange={e => setAnnouncementText(e.target.value)} className={input + ' resize-y'} placeholder={t('announcementPlaceholder')} />
      <button disabled={busy || !overview} onClick={() => void save({ announcementText })} className="mt-2 rounded-lg border border-amber-300/25 px-3 py-2 text-xs font-bold text-amber-200">{t('saveAnnouncement')}</button>
    </div>
    <p className="mt-4 text-xs font-semibold text-amber-100/60">{t('hostControls')}</p>
    <div className={card + ' mt-2'}><div className="flex items-center justify-between gap-3"><div><p className="font-bold text-amber-100">{t('general')}</p><p className="text-xs text-amber-100/45">{overview?.settings.generalEnabled ? t('allOn') : t('allOff')}</p></div><button disabled={busy || !overview} onClick={() => { if (!overview) return; if (overview.settings.generalEnabled && !window.confirm(t('confirmOff'))) return; void save({ generalEnabled: !overview.settings.generalEnabled }); }} className="rounded-lg border border-amber-300/25 px-3 py-2 text-xs font-bold text-amber-200">{overview?.settings.generalEnabled ? t('generalOff') : t('generalOn')}</button></div></div>
    <div className={card + ' mt-2'}><div className="flex items-center justify-between gap-3"><div><p className="font-bold text-amber-100">{t('showAnnouncement')}</p><p className="text-xs text-amber-100/45">{overview?.settings.announcementVisible ? t('visibleOff') : t('hidden')}</p></div><button disabled={busy || !overview} onClick={() => void save({ announcementVisible: !overview?.settings.announcementVisible })} className="rounded-lg border border-amber-300/25 px-3 py-2 text-xs font-bold text-amber-200">{overview?.settings.announcementVisible ? t('hideMessage') : t('showMessage')}</button></div></div>
    <div className="mt-2 grid gap-3 sm:grid-cols-3">
      <div className={card}><div className="flex items-center justify-between gap-2"><div><p className="font-bold text-amber-100">Bingo PRO</p><p className="text-xs text-amber-100/45">{overview?.settings.bingoEnabled ? t('visible') : t('hidden')}</p></div><button disabled={busy || !overview} onClick={() => void save({ bingoEnabled: !overview?.settings.bingoEnabled })} className="rounded-lg border border-amber-300/25 px-3 py-2 text-xs font-bold text-amber-200">{overview?.settings.bingoEnabled ? t('turnOff') : t('turnOn')}</button></div></div>
      <div className={card}><div className="flex items-center justify-between gap-2"><div><p className="font-bold text-amber-100">Keno</p><p className="text-xs text-amber-100/45">{statusLabel(overview?.games.keno.status)} · {overview?.games.keno.bets ?? 0} {t('betsLabel')}</p></div><button disabled={busy || !overview} onClick={() => void save({ kenoEnabled: !overview?.settings.kenoEnabled })} className="rounded-lg border border-amber-300/25 px-3 py-2 text-xs font-bold text-amber-200">{overview?.settings.kenoEnabled ? t('turnOff') : t('turnOn')}</button></div></div>
      <div className={card}><div className="flex items-center justify-between gap-2"><div><p className="font-bold text-amber-100">Aviator</p><p className="text-xs text-amber-100/45">{statusLabel(overview?.games.aviator.status)} · {overview?.games.aviator.bets ?? 0} {t('betsLabel')}</p></div><button disabled={busy || !overview} onClick={() => void save({ aviatorEnabled: !overview?.settings.aviatorEnabled })} className="rounded-lg border border-amber-300/25 px-3 py-2 text-xs font-bold text-amber-200">{overview?.settings.aviatorEnabled ? t('turnOff') : t('turnOn')}</button></div></div>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className={label}>{t('minBet')}<input className={input} type="number" min="2" max="1000" step=".01" value={minBet} onChange={e=>setMinBet(e.target.value)}/></label>
      <label className={label}>{t('maxBet')}<input className={input} type="number" min="1" max="5000" step=".01" value={maxBet} onChange={e=>setMaxBet(e.target.value)}/></label>
      <label className={label}>{t('houseEdge')}<input className={input} type="number" min="50" max="60" step="1" value={houseEdge} onChange={e=>setHouseEdge(e.target.value)}/></label>
      <label className={label}>{t('kenoDuration')}
          <select className={input} value={kenoSeconds} onChange={e=>setKenoSeconds(e.target.value)}>
            <optgroup label={t('seconds')}>
              <option value="10">{10} {t('seconds')}</option><option value="15">{15} {t('seconds')}</option><option value="20">{20} {t('seconds')}</option><option value="30">{30} {t('seconds')}</option><option value="45">{45} {t('seconds')}</option>
            </optgroup>
            <optgroup label={t('minutes')}>
              <option value="60">{1} {t('minutes')}</option><option value="120">{2} {t('minutes')}</option><option value="180">{3} {t('minutes')}</option><option value="300">{5} {t('minutes')}</option><option value="600">{10} {t('minutes')}</option>
            </optgroup>
          </select>
          <span className="mt-1 block text-[10px] font-normal text-amber-100/40">{t('nextKeno')}</span>
        </label>
      <label className={label}>{t('aviatorWindow')}<input className={input} type="number" min="5" max="20" value={aviatorSeconds} onChange={e=>setAviatorSeconds(e.target.value)}/></label>
    </div>
    <button disabled={busy} onClick={() => void save({ minBetEtb: Number(minBet), maxBetEtb: Number(maxBet), houseEdgePercent: Number(houseEdge), kenoBettingSeconds: Number(kenoSeconds), aviatorBettingSeconds: Number(aviatorSeconds) })} className="mt-4 rounded-xl bg-gradient-to-r from-amber-200 to-amber-500 px-5 py-3 text-sm font-black text-black disabled:opacity-50">{busy ? t('saving') : t('saveSettings')}</button>
    <p className="mt-3 text-[11px] leading-5 text-amber-100/40">{t('footer')}</p>
  </section>;
}
