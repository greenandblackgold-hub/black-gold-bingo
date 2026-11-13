import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { api } from '@/lib/api';

const TEXT = {
  am: { checking: 'ክፍያዎ በመረጋገጥ ላይ ነው…', success: 'ገንዘቡ ወደ ቦርሳዎ ገብቷል', pending: 'ክፍያው አልተጠናቀቀም። ከተከፈለ ቦርሳዎ በጥቂት ደቂቃ ውስጥ ይሞላል።', failed: 'ክፍያው አልተሳካም። እባክዎ እንደገና ይሞክሩ።', close: 'ዝጋ' },
  ti: { checking: 'ክፍሊትኩም ይረጋገጽ ኣሎ…', success: 'ገንዘብ ናብ ቦርሳኹም ኣትዩ', pending: 'ክፍሊት ኣይተወድአን። እንተተኸፊሉ ቦርሳኹም ኣብ ውሽጢ ቁሩብ ደቓይቕ ክመልእ እዩ።', failed: 'ክፍሊት ኣይተዓወተን። ደጊምኩም ፈትኑ።', close: 'ዕጸው' },
  en: { checking: 'Confirming your payment…', success: 'Payment received. Your wallet is topped up.', pending: 'Payment not completed yet. If you paid, your wallet will update within a few minutes.', failed: 'Payment failed. Please try again.', close: 'Close' },
} as const;

type State = 'idle' | 'checking' | 'success' | 'pending' | 'failed';

/** Handles Chapa's redirect back to the site: /?tx_ref=...#wallet */
export function PaymentReturnBanner() {
  const { lang } = useLanguage();
  const { refresh } = useAuth();
  const t = TEXT[lang];
  const [state, setState] = useState<State>('idle');

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('tx_ref');
    if (!ref) return;
    // Remove the query string so a refresh does not re-run this, but keep the #wallet hash.
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    setState('checking');
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 6 && !cancelled; i++) {
        try {
          const r = await api.get<{ status: 'success' | 'pending' | 'failed' }>(`/api/payments/status/${encodeURIComponent(ref)}`);
          if (r.status !== 'pending') {
            await refresh();
            if (!cancelled) setState(r.status);
            return;
          }
        } catch {
          /* retry */
        }
        await new Promise((res) => setTimeout(res, 2000));
      }
      if (!cancelled) setState('pending');
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  if (state === 'idle') return null;
  const color = state === 'success' ? 'bg-gold-400 text-darkbg' : state === 'failed' ? 'bg-red-900 text-red-100' : 'bg-cardbg text-gold-300 ring-1 ring-gold-500';
  return (
    <div role="status" aria-live="polite" className={`fixed inset-x-3 top-3 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${color}`}>
      <span>{t[state === 'checking' ? 'checking' : state]}</span>
      {state !== 'checking' && (
        <button type="button" onClick={() => setState('idle')} className="shrink-0 underline underline-offset-2">
          {t.close}
        </button>
      )}
    </div>
  );
}
