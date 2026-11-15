import { useEffect, useState, type FormEvent } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { api, ApiError } from '@/lib/api';

const copy = {
  am: { title: 'የሲሙሌሽን ቦርሳ ያስገቡ', amount: 'መጠን (ብር)', ref: 'የግብይት ማጣቀሻ ቁጥር', submit: 'ጥያቄ ላክ', pending: 'የSMS ማረጋገጫን በመጠበቅ ላይ…', success: 'ባላንሱ ተዘምኗል!', note: 'ይህ የሲሙሌሽን ባላንስ ነው፤ እውነተኛ ገንዘብ አይንቀሳቀስም። ባላንሱ የሚጨምረው የታመነ SMS webhook ሲያረጋግጥ ብቻ ነው።', error: 'ጥያቄውን መላክ አልተቻለም።', mismatch: 'የተላከው መጠን አልተዛመደም። አስተዳዳሪውን ያነጋግሩ።' },
  ti: { title: 'ናይ ሲሙሌሽን ቦርሳ የእትዉ', amount: 'መጠን (ብር)', ref: 'ቁጽሪ መወከሲ ግብይት', submit: 'ሕቶ ስደድ', pending: 'SMS ምርግጋጽ ይጽበ ኣሎ…', success: 'ሒሳብ ተመሓይሹ!', note: 'እዚ ናይ ሲሙሌሽን ሒሳብ እዩ፤ ሓቀኛ ገንዘብ ኣይንቀሳቐስን።', error: 'ሕቶ ምስዳድ ኣይተኻእለን።', mismatch: 'መጠን ኣይተሰማማዐን።' },
  en: { title: 'Simulation wallet top-up', amount: 'Amount (ETB)', ref: 'Transaction reference', submit: 'Submit request', pending: 'Waiting for SMS confirmation…', success: 'Your balance has been updated!', note: 'Simulation credits only. No real money moves. Credits are added only after a trusted SMS webhook verifies the transaction.', error: 'Could not submit the request.', mismatch: 'The SMS amount did not match this request. Contact the host.' },
} as const;

export function SmsDepositPanel() {
  const { lang } = useLanguage();
  const t = copy[lang] ?? copy.en;
  const [amount, setAmount] = useState('100');
  const [reference, setReference] = useState('');
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [submittedRef, setSubmittedRef] = useState('');

  useEffect(() => {
    if (!pending || !submittedRef) return;
    let active = true;
    const check = async () => {
      try {
        const result = await api.get<{ status: string }>(`/api/simulation/deposits/${encodeURIComponent(submittedRef)}`);
        if (!active) return;
        if (result.status === 'success') {
          setPending(false);
          setStatus(t.success);
          window.location.reload();
        } else if (result.status === 'amount_mismatch' || result.status === 'failed') {
          setPending(false);
          setError(t.mismatch);
        }
      } catch { /* temporary network errors are retried */ }
    };
    void check();
    const timer = window.setInterval(check, 4000);
    return () => { active = false; window.clearInterval(timer); };
  }, [pending, submittedRef, t.success, t.mismatch]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(''); setStatus('');
    try {
      const result = await api.post<{ reference: string; status: string }>('/api/simulation/deposits', { amount: Number(amount), reference: reference.trim() });
      setSubmittedRef(result.reference);
      setPending(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.error);
    }
  };

  return <section className="rounded-2xl border border-gold-700/50 bg-cardbg p-5">
    <h2 className="mb-3 text-lg font-bold text-gold-300">{t.title}</h2>
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="sms-deposit-amount" className="block text-sm text-gold-500">{t.amount}</label>
      <input id="sms-deposit-amount" type="number" min="10" max="10000" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full rounded-xl bg-white/[0.05] px-4 py-3 text-gold-300 ring-1 ring-gold-700/50" />
      <label htmlFor="sms-deposit-reference" className="block text-sm text-gold-500">{t.ref}</label>
      <input id="sms-deposit-reference" required minLength={6} maxLength={64} pattern="[A-Za-z0-9][A-Za-z0-9_-]{5,63}" value={reference} onChange={e => setReference(e.target.value)} placeholder="TXN123456789" className="w-full rounded-xl bg-white/[0.05] px-4 py-3 text-gold-300 ring-1 ring-gold-700/50" />
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-gradient-to-br from-gold-300 via-gold-500 to-gold-600 py-3 font-bold text-darkbg disabled:opacity-50">{pending ? t.pending : t.submit}</button>
    </form>
    {pending && <p role="status" className="mt-3 text-sm text-gold-300">{t.pending} ({submittedRef})</p>}
    {status && <p role="status" className="mt-3 text-sm text-green-300">{status}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    <p className="mt-3 text-xs leading-relaxed text-gold-700">{t.note}</p>
  </section>;
}
