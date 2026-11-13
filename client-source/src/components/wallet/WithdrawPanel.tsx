import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { api, ApiError, type ServerWithdrawal } from '@/lib/api';

const TEXT = {
  am: { title: 'ገንዘብ ያውጡ', amount: 'መጠን (ብር)', bank: 'ባንክ / ቴሌብር', name: 'የመለያ ባለቤት ስም', number: 'የመለያ / ስልክ ቁጥር', send: 'የገንዘብ ማውጫ ጥያቄ ላክ', busy: 'በመላክ ላይ…', ok: 'ጥያቄዎ ተልኳል። ከተረጋገጠ በኋላ ገንዘቡ ይላካል።', min: 'ዝቅተኛው የማውጫ መጠን 50 ብር ነው', funds: 'ቀሪ ሂሳብዎ በቂ አይደለም', bad: 'የመለያ መረጃውን ያረጋግጡ', fail: 'ጥያቄውን መላክ አልተቻለም', history: 'የማውጫ ጥያቄዎች', pending: 'በመጠባበቅ ላይ', processing: 'በመላክ ላይ', paid: 'ተከፍሏል', rejected: 'ውድቅ ተደርጓል', failed: 'አልተሳካም', pick: 'ይምረጡ' },
  ti: { title: 'ገንዘብ ኣውጽኡ', amount: 'መጠን (ብር)', bank: 'ባንኪ / ቴሌብር', name: 'ስም ወናኒ መለያ', number: 'ቁጽሪ መለያ / ተሌፎን', send: 'ሕቶ ምውጻእ ገንዘብ ስደድ', busy: 'ይለኣኽ ኣሎ…', ok: 'ሕቶኹም ተላኢኹ። ምስ ተረጋገጸ ገንዘብ ይልኣኽ።', min: 'ዝተሓተ መጠን ምውጻእ 50 ብር እዩ', funds: 'ሒሳብኩም ኣይኣክልን', bad: 'ሓበሬታ መለያ ኣረጋግጹ', fail: 'ሕቶ ምልኣኽ ኣይተኻኣለን', history: 'ሕቶታት ምውጻእ', pending: 'ይጽበ ኣሎ', processing: 'ይለኣኽ ኣሎ', paid: 'ተኸፊሉ', rejected: 'ተነጺጉ', failed: 'ኣይተዓወተን', pick: 'ሕረዩ' },
  en: { title: 'Cash out', amount: 'Amount (ETB)', bank: 'Bank / Telebirr', name: 'Account holder name', number: 'Account or phone number', send: 'Request cash-out', busy: 'Sending…', ok: 'Request sent. The money is paid out once it is approved.', min: 'Minimum cash-out is 50 ETB', funds: 'Your balance doesn’t cover this', bad: 'Check the account details', fail: 'Couldn’t send the request', history: 'Cash-out requests', pending: 'Pending', processing: 'Sending', paid: 'Paid', rejected: 'Rejected', failed: 'Failed', pick: 'Select' },
} as const;

interface Bank {
  id: number | string;
  name: string;
}

const field =
  'w-full rounded-xl bg-white/[0.05] px-4 py-3 text-gold-300 ring-1 ring-gold-700/50 placeholder:text-gold-700 focus:outline-none focus:ring-2 focus:ring-gold-400';

export function WithdrawPanel() {
  const { lang } = useLanguage();
  const { refresh } = useAuth();
  const t = TEXT[lang];
  const [banks, setBanks] = useState<Bank[]>([]);
  const [list, setList] = useState<ServerWithdrawal[]>([]);
  const [amount, setAmount] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    try {
      setList(await api.get<ServerWithdrawal[]>('/api/withdrawals'));
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    void load();
    api.get<Bank[]>('/api/banks').then(setBanks).catch(() => undefined);
  }, []);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/api/withdrawals', { amount: Number(amount), bankCode, accountName, accountNumber });
      setAmount('');
      await Promise.all([load(), refresh()]);
      setMsg({ ok: true, text: t.ok });
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      setMsg({ ok: false, text: code === 'invalid_amount' ? t.min : code === 'insufficient_funds' ? t.funds : code === 'invalid_account' ? t.bad : t.fail });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl bg-cardbg p-4 ring-1 ring-gold-700/50 sm:p-5">
      <h2 className="mb-4 text-lg font-bold text-gold-300">{t.title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="wd-amount" className="mb-1.5 block text-sm text-gold-500">{t.amount}</label>
          <input id="wd-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} className={field} />
        </div>
        <div>
          <label htmlFor="wd-bank" className="mb-1.5 block text-sm text-gold-500">{t.bank}</label>
          {banks.length > 0 ? (
            <select id="wd-bank" value={bankCode} onChange={(e) => setBankCode(e.target.value)} className={field}>
              <option value="">{t.pick}</option>
              {banks.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : (
            <input id="wd-bank" inputMode="numeric" placeholder="bank code" value={bankCode} onChange={(e) => setBankCode(e.target.value.replace(/\D/g, ''))} className={field} />
          )}
        </div>
        <div>
          <label htmlFor="wd-name" className="mb-1.5 block text-sm text-gold-500">{t.name}</label>
          <input id="wd-name" value={accountName} onChange={(e) => setAccountName(e.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor="wd-number" className="mb-1.5 block text-sm text-gold-500">{t.number}</label>
          <input id="wd-number" inputMode="numeric" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))} className={field} />
        </div>
      </div>
      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} className={['mt-3 text-sm', msg.ok ? 'text-gold-400' : 'text-red-300'].join(' ')}>
          {msg.text}
        </p>
      )}
      <button type="button" disabled={busy} onClick={() => void submit()} className="mt-4 w-full rounded-xl bg-gradient-to-br from-gold-300 via-gold-500 to-gold-600 py-3.5 font-bold text-darkbg active:scale-[0.98] disabled:opacity-50">
        {busy ? t.busy : t.send}
      </button>

      {list.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-gold-500">{t.history}</h3>
          <ul className="divide-y divide-gold-700/30">
            {list.slice(0, 5).map((w) => (
              <li key={w.id} className="flex items-center justify-between py-2 text-sm">
                <span className="tabular-nums text-gold-300">{w.amount.toFixed(2)} ETB</span>
                <span className={w.status === 'paid' ? 'font-semibold text-gold-400' : w.status === 'rejected' || w.status === 'failed' ? 'text-red-300' : 'text-gold-500'}>{t[w.status]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
