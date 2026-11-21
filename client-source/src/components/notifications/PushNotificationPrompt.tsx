import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

type PushConfig = { enabled: boolean; publicKey: string | null };

function decodeKey(value: string): Uint8Array {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export function PushNotificationPrompt() {
  const { user } = useAuth();
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [ready, setReady] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'player' || user.phoneVerified !== true) {
      setConfig(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const result = await api.get<PushConfig>('/api/push/public-key');
        if (cancelled) return;
        setConfig(result);
        if (!result.enabled || !result.publicKey || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
        await navigator.serviceWorker.register('/sw.js');
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (existing && Notification.permission === 'granted') {
          await api.post('/api/push/subscribe', { subscription: existing.toJSON() });
          if (!cancelled) setSubscribed(true);
        }
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setMessage('የማሳወቂያ ግንኙነት ለጊዜው አልተሳካም።');
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.role, user?.phoneVerified]);

  if (!user || user.role !== 'player' || user.phoneVerified !== true || !config?.enabled || !ready || subscribed) return null;

  const enable = async () => {
    setBusy(true);
    setMessage('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setMessage(permission === 'denied'
          ? 'ማሳወቂያዎች በBrowser ተከልክለዋል። ከBrowser Settings ይፍቀዱ።'
          : 'ማሳወቂያ ለመቀበል ፈቃድ ያስፈልጋል።');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeKey(config.publicKey!),
        });
      }
      await api.post('/api/push/subscribe', { subscription: subscription.toJSON() });
      setSubscribed(true);
      setMessage('ማሳወቂያዎች ተከፍተዋል። የቦነስ ዜናዎችን ያገኛሉ።');
    } catch {
      setMessage('ማሳወቂያዎችን ማንቃት አልተሳካም። እባክዎ HTTPS እና Browser ፈቃድ ያረጋግጡ።');
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="fixed bottom-3 left-3 right-3 z-[80] mx-auto max-w-md rounded-2xl border border-amber-400/40 bg-[#111114] p-4 text-white shadow-2xl">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden="true">🔔</span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">የቦነስ ማሳወቂያ ይቀበሉ</p>
          <p className="mt-1 text-sm text-white/70">አፑ ዝግ ሲሆንም የ10,000 ብር ቦነስ ጨዋታ ሲቃረብ እና ሲጀምር ይደርስዎታል።</p>
          {message && <p className="mt-2 text-xs text-amber-300">{message}</p>}
          <button type="button" disabled={busy} onClick={() => void enable()} className="mt-3 rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-60">
            {busy ? 'በመጫን ላይ…' : 'ማሳወቂያዎችን አንቃ'}
          </button>
        </div>
      </div>
    </aside>
  );
}
