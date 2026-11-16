import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { api, ApiError } from '@/lib/api';

const TEXT = {
  am: { title: 'የቢንጎ አሸናፊ ሽልማቶች', empty: 'በመጠባበቅ ላይ ያለ የሽልማት ጥያቄ የለም', pending: 'በመጠባበቅ ላይ', approve: 'አጽድቅ', reject: 'ውድቅ አድርግ', reload: 'አድስ', round: 'ዙር', card: 'ካርድ', player: 'ተጫዋች', notice: 'ሽልማቱ ከአስተዳዳሪ ማረጋገጫ በኋላ ወደ ቦርሳ ባላንስ ብቻ ይጨመራል።', err: 'ስህተት ተፈጥሯል' },
  ti: { title: 'ሽልማት ኣሸነፍቲ ቢንጎ', empty: 'ዝጽበ ዘሎ ሕቶ ሽልማት የለን', pending: 'ይጽበ ኣሎ', approve: 'ኣጽድቕ', reject: 'ንጸግ', reload: 'ኣሐድስ', round: 'ዙር', card: 'ካርድ', player: 'ተጻዋታይ', notice: 'ሽልማት ድሕሪ ምርግጋጽ ኣማሓዳሪ ናብ ሚዛን ቦርሳ ጥራይ ይውሰኽ።', err: 'ጌጋ ተፈጢሩ' },
  en: { title: 'Bingo winner prizes', empty: 'No pending prize requests', pending: 'Pending', approve: 'Approve', reject: 'Reject', reload: 'Reload', round: 'Round', card: 'Card', player: 'Player', notice: 'Prizes are credited to the wallet balance after administrator review.', err: 'Something went wrong' },
} as const;

interface WinPayout {
  id: string;
  round: number;
  cardCode: string;
  serial: string | number;
  amount: number;
  status: string;
  userName: string;
  userPhone: string;
  at: number;
}

export function AdminWinPayouts() {
  const { lang } = useLanguage();
  const t = TEXT[lang];
  const [rows, setRows] = useState<WinPayout[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setRows(await api.get<WinPayout[]>('/api/admin/win-payouts?status=pending'));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.err);
    }
  }, [t.err]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  const act = async (id: string, action: 'approve' | 'reject') => {
    setError(null);
    try {
      await api.post(`/api/admin/win-payouts/${encodeURIComponent(id)}/${action}`, {});
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.err);
    }
  };
  const btn = 'rounded-lg px-3.5 py-2 text-sm font-semibold ring-1 active:scale-95';
  return (
    <section className="rounded-2xl bg-cardbg p-4 ring-1 ring-gold-700/50 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gold-300">{t.title}</h2>
        <button type="button" onClick={() => void load()} className="text-sm font-medium text-gold-400 underline underline-offset-4">{t.reload}</button>
      </div>
      <p className="mb-3 text-xs text-gold-500">{t.notice}</p>
      {error && <p role="alert" className="mb-2 text-sm text-red-300">{error}</p>}
      {rows.length === 0 ? <p className="py-3 text-center text-sm text-gold-700">{t.empty}</p> : (
        <ul className="space-y-2">
          {rows.map((w) => (
            <li key={w.id} className="rounded-xl bg-white/[0.04] p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-lg font-black tabular-nums text-gold-400">{w.amount.toFixed(2)} ETB</span>
                <span className="text-xs text-gold-500">{t.pending}</span>
              </div>
              <p className="mt-1 text-sm text-gold-300">{t.player}: {w.userName} · {w.userPhone}</p>
              <p className="mt-1 text-xs text-gold-500">{t.round} #{w.round} · {t.card} #{w.serial} · {w.cardCode}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => void act(w.id, 'approve')} className={`${btn} flex-1 bg-gold-500 text-darkbg ring-gold-400`}>{t.approve}</button>
                <button type="button" onClick={() => void act(w.id, 'reject')} className={`${btn} flex-1 text-gold-300 ring-gold-700/60`}>{t.reject}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
