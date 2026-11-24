import { useCallback, useEffect, useState } from 'react';
import { translations, formatAmount } from '@/lib/localization';
import { api, ApiError } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';

type Row = {
 id: string; amount: number; method: string; destination: string; status: string;
 userName: string; userPhone: string; at: number; externalPayoutReference?: string;
};
const TEXT = translations.adminWithdrawals;

export function AdminSimulationWithdrawals() {
 const { lang } = useLanguage();
 const t = TEXT[lang] ?? TEXT.en;
 const words = lang === 'am'
  ? { processing: 'በክፍያ ሂደት ላይ', start: 'ክፍያ ጀምር', ref: 'የባንክ/Telebirr ማጣቀሻ', confirm: 'ተከፍሏል ብለህ አረጋግጥ', bank: 'ባንክ', telebirr: 'Telebirr', started: 'የክፍያ ሂደት ተጀምሯል', paid: 'ክፍያው ተመዝግቧል', reject: 'ውድቅ አድርግ'
  }
  : lang === 'ti'
  ? { processing: 'ኣብ ምኽፋል ሂደት', start: 'ክፍሊት ጀምር', ref: 'መወከሲ ባንክ/Telebirr', confirm: 'ተኸፊሉ ኣረጋግጽ', bank: 'ባንኪ', telebirr: 'Telebirr', started: 'ሂደት ክፍሊት ተጀሚሩ', paid: 'ክፍሊት ተመዝጊቡ', reject: 'ንጸግ' }
  : { processing: 'Processing', start: 'Start payout', ref: 'Bank / Telebirr reference', confirm: 'Confirm paid', bank: 'Bank', telebirr: 'Telebirr', started: 'Payout processing started', paid: 'Payout marked as paid', reject: 'Reject' };
 const [rows, setRows] = useState<Row[]>([]);
 const [references, setReferences] = useState<Record<string, string>>({});
 const [methods, setMethods] = useState<Record<string, string>>({});
 const [error, setError] = useState('');
 const [busy, setBusy] = useState('');
 const load = useCallback(async () => {
  try {
   const [pending, processing] = await Promise.all([
    api.get<Row[]>('/api/admin/manual-withdrawals?status=pending'),
    api.get<Row[]>('/api/admin/manual-withdrawals?status=processing'),
   ]);
   setRows([...pending, ...processing]);
   setError('');
  } catch (e) { setError(e instanceof ApiError ? e.message : t.err); }
 }, [t.err]);
 useEffect(() => { void load(); const timer = setInterval(() => void load(), 15000); return () => clearInterval(timer); }, [load]);
 const act = async (id: string, action: 'start' | 'confirm' | 'reject') => {
  setBusy(id); setError('');
  try {
   if (action === 'start') {
    await api.post('/api/admin/manual-withdrawals/' + encodeURIComponent(id) + '/start', {});
   } else if (action === 'confirm') {
    await api.post('/api/admin/manual-withdrawals/' + encodeURIComponent(id) + '/confirm', {
     externalReference: references[id] ?? '', method: methods[id] ?? 'telebirr',
    });
   } else {
    await api.post('/api/admin/manual-withdrawals/' + encodeURIComponent(id) + '/reject', { note: 'Rejected by administrator' });
   }
   await load();
  } catch (e) { setError(e instanceof ApiError ? e.message : t.err); }
  finally { setBusy(''); }
 };
 const btn = 'rounded-lg px-3 py-2 text-sm font-semibold ring-1 active:scale-95 disabled:opacity-50';
 return <section className="rounded-2xl bg-cardbg p-4 ring-1 ring-gold-700/50 sm:p-5">
  <div className="mb-3 flex items-center justify-between gap-3">
   <h2 className="text-lg font-bold text-gold-300">{t.title}</h2>
   <button onClick={() => void load()} className="text-sm text-gold-400 underline">{t.reload}</button>
  </div>
  <p className="mb-3 text-xs text-gold-500">{lang === 'am'
   ? 'በመጀመሪያ ክፍያውን ይጀምሩ። የባንክ/Telebirr ዝውውሩን ከፈጸሙ በኋላ የውጭ ማጣቀሻ ቁጥሩን ያስገቡና ይረጋግጡ።'
   : lang === 'ti' ? 'መጀመርታ ሂደት ክፍሊት ጀምሩ። ዝውውር ባንኪ ወይ Telebirr ብሓቂ ምስ ሰደድኩም፣ ናይ ወጻኢ መወከሲ ቁጽሪ ኣእትዉ እሞ ኣረጋግጹ።' : 'Start processing first. After the bank or Telebirr transfer is actually sent, enter its external reference and confirm.'}</p>
  {error && <p role="alert" className="mb-2 text-sm text-red-300">{error}</p>}
  {!rows.length ? <p className="py-3 text-center text-sm text-gold-700">{t.empty}</p> : <ul className="space-y-2">
   {rows.map(w => <li key={w.id} className="rounded-xl bg-white/[0.04] p-3">
    <div className="flex justify-between gap-2">
     <b className="text-lg text-gold-400">{formatAmount(lang, w.amount)} {t.currency}</b>
     <span className="text-xs text-gold-500">{w.status === 'processing' ? words.processing : t.pending}</span>
    </div>
    <p className="mt-1 text-sm text-gold-300">{t.player}: {w.userName} · {w.userPhone}</p>
    <p className="mt-1 text-xs text-gold-500">{t.method}: {w.method} · {t.destination}: {w.destination}</p>
    <p className="mt-1 break-all font-mono text-[11px] text-gold-700">{w.id}</p>
    {w.status === 'pending' ? <div className="mt-3 flex gap-2">
     <button disabled={!!busy} onClick={() => void act(w.id, 'start')} className={btn + ' flex-1 bg-gold-500 text-darkbg ring-gold-400'}>{busy === w.id ? '…' : words.start}</button>
     <button disabled={!!busy} onClick={() => void act(w.id, 'reject')} className={btn + ' flex-1 text-gold-300 ring-gold-700/60'}>{words.reject}</button>
    </div> : <div className="mt-3 space-y-2">
     <input value={references[w.id] ?? ''} onChange={e => setReferences(v => ({ ...v, [w.id]: e.target.value }))} placeholder={words.ref} maxLength={64} className="w-full rounded-lg bg-white/[0.05] px-3 py-2 text-sm text-gold-200 ring-1 ring-gold-700/50" />
     <select value={methods[w.id] ?? w.method ?? 'telebirr'} onChange={e => setMethods(v => ({ ...v, [w.id]: e.target.value }))} className="w-full rounded-lg bg-cardbg px-3 py-2 text-sm text-gold-200 ring-1 ring-gold-700/50">
      <option value="telebirr">{words.telebirr}</option><option value="bank">{words.bank}</option>
     </select>
     <button disabled={!!busy || !(references[w.id] ?? '').trim()} onClick={() => void act(w.id, 'confirm')} className={btn + ' w-full bg-gold-500 text-darkbg ring-gold-400'}>{busy === w.id ? '…' : words.confirm}</button>
    </div>}
   </li>)}
  </ul>}
 </section>;
}
