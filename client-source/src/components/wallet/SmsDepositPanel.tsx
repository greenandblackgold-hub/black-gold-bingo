import { useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';

type DepositRequest = {
  reference: string;
  amount: number;
  status: 'pending' | 'success' | 'failed' | 'amount_mismatch' | 'rejected';
  currency: 'ETB';
};

type DepositStatus = 'pending' | 'success' | 'failed' | 'amount_mismatch' | 'rejected' | 'test-approved' | 'unknown';

const copy = {
  am: {
    title: 'የቦርሳ ገንዘብ ማስገቢያ',
    amount: 'መጠን (ብር)',
    reference: 'የቴሌብር / ባንክ ትራንዛክሽን ማጣቀሻ ቁጥር',
    placeholder: 'ለምሳሌ TXN123456789',
    submit: 'የባላንስ ጥያቄ ላክ',
    sending: 'በመላክ ላይ…',
    check: 'ሁኔታውን አድስ',
    pending: 'ጥያቄው ተመዝግቧል፤ አስተዳዳሪው እስኪያረጋግጥ ይጠብቁ።',
    rejected: 'ጥያቄው በአስተዳዳሪው ውድቅ ተደርጓል።',
    testApproved: 'የሙከራ ጥያቄው ተፈቅዷል፤ ይህ ሙከራ ብቻ ስለሆነ ባላንስ አልጨመረም።',
    success: 'ጥያቄው ተረጋግጧል፤ ባላንሱ ተጨምሯል።',
    failed: 'ግብይቱ አልተሳካም።',
    mismatch: 'የተጠየቀው መጠን ከSMS ማረጋገጫው ጋር አልተዛመደም።',
    unknown: 'ሁኔታው አልታወቀም።',
    note: 'አስተዳዳሪው የባንክ/ቴሌብር ማስረጃውን ካረጋገጠ በኋላ ብቻ የመተግበሪያው ቀሪ ሂሳብ ይጨምራል። ይህ የመተግበሪያ ቀሪ ሂሳብ ነው፤ የእውነተኛ ገንዘብ ዝውውር አይደለም።',
    invalid: 'መጠኑ ከ10 እስከ 10,000 ብር እና እስከ 2 የአስርዮሽ ቦታ መሆን አለበት።',
    refInvalid: 'ማጣቀሻው ከ6 እስከ 64 ፊደል/ቁጥር መሆን አለበት።',
    used: 'ይህ ማጣቀሻ ቀድሞ ተጠቅሟል።',
    generic: 'ጥያቄውን መላክ አልተቻለም። እንደገና ይሞክሩ።',
  },
  ti: {
    title: 'ናይ ቦርሳ ገንዘብ ምእታዊ',
    amount: 'መጠን (ብር)',
    reference: 'ቁጽሪ ምጥቃስ ትራንዛክሽን ቴሌብር / ባንኪ',
    placeholder: 'ንኣብነት TXN123456789',
    submit: 'ሕቶ ሚዛን ስደድ',
    sending: 'ይለኣኽ ኣሎ…',
    check: 'ኩነታት ኣሐድስ',
    pending: 'ሕቶኹም ተመዝጊቡ፤ ኣማሓዳሪ ክሳብ ዝረጋግጾ ተጸበዩ።',
    rejected: 'ሕቶኹም ብኣማሓዳሪ ተነጺጉ።',
    testApproved: 'ናይ ሙከራ ሕቶ ተፈቒዱ፤ ሚዛን ኣይወሰኸን።',
    success: 'ሕቶኹም ተረጋጊጹ፤ ሚዛን ተወሲኹ።',
    failed: 'ግብይት ኣይተዓወተን።',
    mismatch: 'መጠን ሕቶን SMS ምርግጋጽን ኣይተሰማምዑን።',
    unknown: 'ኩነታት ኣይተፈልጠን።',
    note: 'ኣማሓዳሪ መረጋገጺ ባንኪ/ቴሌብር ምስ ኣረጋገጸ ጥራይ ናይቲ መተግበሪ ሚዛን ይውሰኽ። እዚ ናይ መተግበሪ ሚዛን እዩ፤ ናይ ገንዘብ ምስግጋር ኣይኮነን።',
    invalid: 'መጠን ካብ 10 ክሳብ 10,000 ብር ክኸውን ኣለዎ።',
    refInvalid: 'ማጣቀሻ ካብ 6 ክሳብ 64 ፊደላት/ቁጽርታት ክኸውን ኣለዎ።',
    used: 'እዚ ማጣቀሻ ቀዲሙ ተጠቒሙ እዩ።',
    generic: 'ሕቶ ምልኣኽ ኣይተኻእለን። እንደገና ፈትኑ።',
  },
  en: {
    title: 'Wallet deposit request',
    amount: 'Amount (ETB)',
    reference: 'Telebirr / bank transaction reference',
    placeholder: 'e.g. TXN123456789',
    submit: 'Submit balance request',
    sending: 'Submitting…',
    check: 'Refresh status',
    pending: 'Request recorded; waiting for an administrator to review it.',
    rejected: 'The administrator rejected this request.',
    testApproved: 'Test request approved for testing only; no wallet balance was credited.',
    success: 'Request verified; the wallet balance has been credited.',
    failed: 'The transaction failed.',
    mismatch: 'The requested amount does not match the SMS confirmation.',
    unknown: 'Status is unavailable.',
    note: 'The in-app balance is updated only after an administrator verifies the bank/Telebirr evidence. This is an in-app balance, not a transfer of real money.',
    invalid: 'Enter an amount from 10 to 10,000 ETB, with at most 2 decimal places.',
    refInvalid: 'Reference must contain 6–64 letters, numbers, hyphens or underscores.',
    used: 'This transaction reference has already been submitted.',
    generic: 'Could not submit the request. Please try again.',
  },
} as const;

const inputClass = 'w-full rounded-xl bg-white/[0.05] px-4 py-3 text-gold-300 placeholder:text-gold-700 ring-1 ring-gold-700/50 focus:outline-none focus:ring-2 focus:ring-gold-400';

export function SmsDepositPanel() {
  const { lang } = useLanguage();
  const t = copy[lang] ?? copy.en;
  const [amount, setAmount] = useState('100');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [request, setRequest] = useState<DepositRequest | null>(null);
  const [status, setStatus] = useState<DepositStatus | null>(null);

  const submit = async () => {
    const numericAmount = Number(amount);
    const cleanReference = reference.trim();
    if (!Number.isFinite(numericAmount) || numericAmount < 10 || numericAmount > 10000 || !/^\d+(\.\d{1,2})?$/.test(amount)) {
      setError(t.invalid);
      return;
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{5,63}$/.test(cleanReference)) {
      setError(t.refInvalid);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await api.post<DepositRequest>('/api/simulation/deposits', {
        amount: numericAmount,
        reference: cleanReference,
      });
      setRequest(created);
      setStatus('pending');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'reference_used') setError(t.used);
      else if (e instanceof ApiError && e.code === 'invalid_amount') setError(t.invalid);
      else if (e instanceof ApiError && e.code === 'invalid_reference') setError(t.refInvalid);
      else setError(t.generic);
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    if (!request) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.get<{ status: DepositStatus }>(`/api/simulation/deposits/${encodeURIComponent(request.reference)}`);
      setStatus(result.status);
      if (result.status === 'success') window.location.reload();
    } catch {
      setError(t.generic);
    } finally {
      setBusy(false);
    }
  };

  const statusText = status === 'success' ? t.success
    : status === 'failed' ? t.failed
    : status === 'amount_mismatch' ? t.mismatch
    : status === 'rejected' ? t.rejected
    : status === 'test-approved' ? t.testApproved
    : status === 'pending' ? t.pending
    : t.unknown;

  return (
    <section className="rounded-2xl border border-gold-700/50 bg-cardbg p-5" aria-labelledby="simulation-wallet-title">
      <h2 id="simulation-wallet-title" className="mb-4 text-lg font-bold text-gold-300">{t.title}</h2>
      {!request ? (
        <div className="space-y-4">
          <div>
            <label htmlFor="simulation-deposit-amount" className="mb-2 block text-sm text-gold-500">{t.amount}</label>
            <input
              id="simulation-deposit-amount"
              className={inputClass}
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))}
              disabled={busy}
            />
          </div>
          <div>
            <label htmlFor="simulation-deposit-reference" className="mb-2 block text-sm text-gold-500">{t.reference}</label>
            <input
              id="simulation-deposit-reference"
              className={inputClass}
              autoComplete="off"
              maxLength={64}
              placeholder={t.placeholder}
              value={reference}
              onChange={(event) => setReference(event.target.value.trimStart())}
              disabled={busy}
            />
          </div>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <button type="button" onClick={submit} disabled={busy} className="w-full rounded-xl bg-gradient-to-br from-gold-300 via-gold-500 to-gold-600 py-3.5 font-bold text-darkbg disabled:opacity-50">
            {busy ? t.sending : t.submit}
          </button>
          <p className="text-xs leading-relaxed text-gold-600">{t.note}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <dl className="space-y-2 rounded-xl bg-white/[0.04] p-4 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-gold-500">{t.reference}</dt><dd className="break-all text-right font-semibold text-gold-300">{request.reference}</dd></div>
            <div className="flex justify-between"><dt className="text-gold-500">{t.amount}</dt><dd className="font-semibold tabular-nums text-gold-300">{request.amount.toFixed(2)}</dd></div>
          </dl>
          <p role="status" aria-live="polite" className="rounded-xl bg-white/[0.04] p-4 text-sm text-gold-300">{statusText}</p>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          {status !== 'success' && (
            <button type="button" onClick={refresh} disabled={busy} className="w-full rounded-xl bg-gradient-to-br from-gold-300 via-gold-500 to-gold-600 py-3.5 font-bold text-darkbg disabled:opacity-50">
              {busy ? t.sending : t.check}
            </button>
          )}
          <p className="text-xs leading-relaxed text-gold-600">{t.note}</p>
        </div>
      )}
    </section>
  );
}

type DepositHistoryRow = {
  reference: string;
  amount: number;
  status: DepositStatus;
  currency: 'ETB';
  at: number;
};

const historyCopy = {
  am: {
    title: 'የዲፖዚት ጥያቄዎቼ',
    empty: 'እስካሁን የዲፖዚት ጥያቄ የለም።',
    pending: 'በመጠባበቅ ላይ',
    success: 'ተጸድቋል · ባላንስ ጨምሯል',
    rejected: 'ውድቅ ተደርጓል',
    test: 'የሙከራ ማጽደቅ · ባላንስ አልጨመረም',
    failed: 'አልተሳካም',
    mismatch: 'መጠን አልተዛመደም',
    unknown: 'ያልታወቀ',
    refresh: 'ዝርዝሩ በየ15 ሰከንዱ ይታደሳል።',
  },
  ti: {
    title: 'ናይ ዲፖዚት ሕቶታተይ',
    empty: 'ገና ናይ ዲፖዚት ሕቶ የለን።',
    pending: 'ይጽበ ኣሎ',
    success: 'ጸዲቑ · ሚዛን ተወሲኹ',
    rejected: 'ተነጺጉ',
    test: 'ሙከራ ጥራይ · ሚዛን ኣይወሰኸን',
    failed: 'ኣይተዓወተን',
    mismatch: 'መጠን ኣይተሰማምዐን',
    unknown: 'ዘይፍለጥ',
    refresh: 'ዝርዝር ኣብ ነፍሲ ወከፍ 15 ካልኢት ይሕደስ።',
  },
  en: {
    title: 'My deposit requests',
    empty: 'No deposit requests yet.',
    pending: 'Pending review',
    success: 'Approved · balance credited',
    rejected: 'Rejected',
    test: 'Test approved · no balance credited',
    failed: 'Failed',
    mismatch: 'Amount mismatch',
    unknown: 'Unknown status',
    refresh: 'This list refreshes every 15 seconds.',
  },
} as const;

export function SimulationDepositHistory() {
  const { lang } = useLanguage();
  const t = historyCopy[lang] ?? historyCopy.en;
  const [rows, setRows] = useState<DepositHistoryRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await api.get<DepositHistoryRow[]>('/api/simulation/deposits');
        if (active) setRows(result);
      } catch {
        // Keep the last successfully loaded history visible during temporary network errors.
      } finally {
        if (active) setLoaded(true);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const statusLabel = (status: DepositStatus) => status === 'pending' ? t.pending
    : status === 'success' ? t.success
    : status === 'rejected' ? t.rejected
    : status === 'test-approved' ? t.test
    : status === 'failed' ? t.failed
    : status === 'amount_mismatch' ? t.mismatch
    : t.unknown;

  return (
    <div className="mb-4 rounded-xl border border-gold-700/40 bg-white/[0.03] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-gold-300">{t.title}</h3>
        <span className="text-xs text-gold-700">{t.refresh}</span>
      </div>
      {!loaded && <p className="py-2 text-sm text-gold-600">…</p>}
      {loaded && rows.length === 0 && <p className="py-2 text-sm text-gold-600">{t.empty}</p>}
      {rows.length > 0 && (
        <ul className="divide-y divide-gold-700/30">
          {rows.map((row) => (
            <li key={row.reference} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="break-all font-mono text-sm text-gold-300">{row.reference}</p>
                <p className="mt-1 text-xs text-gold-600">{new Date(row.at).toLocaleString()}</p>
                <p className="mt-1 text-xs font-semibold text-gold-400">{statusLabel(row.status)}</p>
              </div>
              <p className="shrink-0 font-bold tabular-nums text-gold-300">{row.amount.toFixed(2)} ETB</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
