import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

const TXT = {
  am: { title: 'የSimulation መውጫ ጥያቄ', amount: 'መጠን (ETB)', method: 'የመቀበያ ዘዴ (አማራጭ)', telebirr: 'Telebirr', bank: 'Bank', destination: 'የስልክ/አካውንት ቁጥር (አማራጭ)', send: 'ጥያቄ ላክ', busy: 'በመላክ ላይ…', ok: 'ጥያቄው ተልኳል። የSimulation ሂሳቡ ተይዟል።', note: 'ሙከራ ብቻ፦ እውነተኛ ገንዘብ አይላክም። Admin ካጸደቀ የSimulation ጥያቄው Approved ይሆናል፤ ካልተቀበለ ሂሳቡ ይመለሳል።', err: 'ጥያቄውን መላክ አልተቻለም' },
  ti: { title: 'ሕቶ ምውጻእ Simulation', amount: 'መጠን (ETB)', method: 'መንገዲ ተቐባሊ (ኣማራጺ)', telebirr: 'Telebirr', bank: 'Bank', destination: 'ቁጽሪ ስልኪ/ሕሳብ (ኣማራጺ)', send: 'ሕቶ ስደድ', busy: 'ይስደድ ኣሎ…', ok: 'ሕቶ ተላኢኹ። Simulation ሒሳብ ተዓጽዩ።', note: 'ፈተነ ጥራይ፦ ሓቀኛ ገንዘብ ኣይስደድን። Admin እንተኣጽደቖ እቲ Simulation ሕቶ Approved ይኸውን፤ እንተነጺግዎ ሒሳብ ይምለስ።', err: 'ሕቶ ምስዳድ ኣይተኻእለን' },
  en: { title: 'Simulation withdrawal request', amount: 'Amount (ETB)', method: 'Destination method (optional)', telebirr: 'Telebirr', bank: 'Bank', destination: 'Phone / account number (optional)', send: 'Submit request', busy: 'Submitting…', ok: 'Request submitted. Simulation balance has been reserved.', note: 'TEST ONLY: no real money is sent. Admin approval only marks this simulation request Approved; rejection refunds the simulation balance.', err: 'Could not submit request' },
} as const;

export function SimulationWithdrawalPanel() {
  const [amount, setAmount] = useState('10');
  const [method, setMethod] = useState('');
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const lang = (localStorage.getItem('bgb.lang') || 'en') as keyof typeof TXT;
  const t = TXT[TXT[lang] ? lang : 'en'];
  const submit = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      await api.post('/api/simulation/withdrawals', { amount: Number(amount), method, destination });
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
    </div>
  </section>;
}
