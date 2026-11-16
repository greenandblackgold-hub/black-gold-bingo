import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';

const TXT = {
  am: { title: 'የገንዘብ ማውጫ ጥያቄ', amount: 'መጠን (ETB)', method: 'የመቀበያ ዘዴ (አማራጭ)', telebirr: 'Telebirr', bank: 'Bank', destination: 'የስልክ/አካውንት ቁጥር (አማራጭ)', send: 'ጥያቄ ላክ', busy: 'በመላክ ላይ…', ok: 'ጥያቄው ተልኳል። ሂሳቡ ተይዟል።', note: 'ጥያቄው በአስተዳዳሪ ይገመገማል። ሲጸድቅ የጥያቄው ሁኔታ ይቀየራል፤ በዚህ መተግበሪያ የባንክ ወይም የTelebirr ዝውውር አይፈጸምም። ካልተቀበለ የተያዘው ሂሳብ ይመለሳል።', err: 'ጥያቄውን መላክ አልተቻለም' },
  ti: { title: 'ሕቶ ምውጻእ', amount: 'መጠን (ETB)', method: 'መንገዲ ተቐባሊ (ኣማራጺ)', telebirr: 'Telebirr', bank: 'Bank', destination: 'ቁጽሪ ስልኪ/ሕሳብ (ኣማራጺ)', send: 'ሕቶ ስደድ', busy: 'ይስደድ ኣሎ…', ok: 'ሕቶ ተላኢኹ። ሒሳብ ተሓዚ።', note: 'ሕቶ ብኣማሓዳሪ ይግምገም። ምስ ጸደቐ ኩነታት ሕቶ ይቕየር፤ ብእዚ መተግበሪ ባንክ ወይ Telebirr ምስግጋር ኣይፍጸምን። እንተተነጺጉ እቲ ዝተሓዝ ሚዛን ይምለስ።', err: 'ሕቶ ምስዳድ ኣይተኻእለን' },
  en: { title: 'Withdrawal request', amount: 'Amount (ETB)', method: 'Destination method (optional)', telebirr: 'Telebirr', bank: 'Bank', destination: 'Phone / account number (optional)', send: 'Submit request', busy: 'Submitting…', ok: 'Request submitted. Balance has been reserved.', note: 'Requests are reviewed by an administrator. Approval updates the request status only; this app does not initiate bank or Telebirr transfers. Rejection returns the reserved balance.', err: 'Could not submit request' },
} as const;

type WithdrawalRow = { id: string; amount: number; method: string; destination: string; status: string; at: number };

export function SimulationWithdrawalPanel() {
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [amount, setAmount] = useState('10');
  const [method, setMethod] = useState('');
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { lang } = useLanguage();
  const t = TXT[lang] ?? TXT.en;
  const load = async () => { try { setRows(await api.get<WithdrawalRow[]>('/api/simulation/withdrawals')); } catch { /* request form remains usable */ } };
  useEffect(() => { void load(); }, []);
  const submit = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      await api.post('/api/simulation/withdrawals', { amount: Number(amount), method, destination });
      await load();
      setMessage(t.ok); setAmount('10'); setDestination('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.err);
    } finally { setBusy(false); }
  };
  return <section className="rounded-2xl bg-cardbg p-4 ring-1 ring-gold-700/50 sm:p-5">
    <h2 className="mb-2 text-lg font-bold text-gold-300">{t.title}</h2>
    <p className="mb-3 text-xs text-gold-500">{t.note}</p>
    <div className="space-y-3">
      <label className="block text-sm text-gold-500">{t.amount}
        <input aria-label={t.amount} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1 w-full rounded-xl bg-white/[0.05] px-4 py-3 text-gold-300 ring-1 ring-gold-700/50" />
      </label>
      <label className="block text-sm text-gold-500">{t.method}
        <select value={method} onChange={e => setMethod(e.target.value)} className="mt-1 w-full rounded-xl bg-cardbg px-4 py-3 text-gold-300 ring-1 ring-gold-700/50">
          <option value="">—</option><option value="telebirr">{t.telebirr}</option><option value="bank">{t.bank}</option>
        </select>
      </label>
      <label className="block text-sm text-gold-500">{t.destination}
        <input value={destination} maxLength={80} onChange={e => setDestination(e.target.value)} placeholder="09XXXXXXXX / account" className="mt-1 w-full rounded-xl bg-white/[0.05] px-4 py-3 text-gold-300 ring-1 ring-gold-700/50" />
      </label>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {message && <p role="status" className="text-sm text-gold-300">{message}</p>}
      <button type="button" disabled={busy || !Number.isFinite(Number(amount)) || Number(amount) <= 0} onClick={() => void submit()} className="w-full rounded-xl bg-gold-500 py-3 font-bold text-darkbg disabled:opacity-50">{busy ? t.busy : t.send}</button>
      {rows.length > 0 && <div className="border-t border-gold-700/40 pt-3"><h3 className="mb-2 text-sm font-semibold text-gold-300">{lang === 'am' ? 'የመውጫ ጥያቄ ታሪክ' : lang === 'ti' ? 'ታሪኽ ሕቶታት ምውጻእ' : 'Withdrawal request history'}</h3><ul className="space-y-2">{rows.map(row => <li key={row.id} className="flex items-center justify-between gap-2 text-xs"><span className="text-gold-500">{row.amount.toFixed(2)} ETB · {row.method || '—'}</span><span className="font-semibold text-gold-300">{row.status}</span></li>)}</ul></div>}
    </div>
  </section>;
}
