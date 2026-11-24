import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import type { Lang } from '@/types/game';

const copy = {
  am: { connectionError:t.connectionError, denied:t.denied, permission:t.permission, success:t.success, failed:'ማሳወቂያዎችን ማንቃት አልተሳካም። HTTPS እና የBrowser ፈቃድ ያረጋግጡ።', title:'{t.title}', description:'{t.description}', busy:'በመጫን ላይ…', enable:'ማሳወቂያዎችን አንቃ' },
  ti: { connectionError:'መራኸቢ ምልክታ ንግዚኡ ኣይሰርሐን።', denied:'ምልክታታት ብBrowser ተኸልኪሎም። ካብ Browser Settings ፍቐዱ።', permission:'ምልክታ ንምቕባል ፍቓድ የድሊ።', success:'ምልክታታት ተኸፊቶም። ዜና ቦነስ ክትረኽቡ ኢኹም።', failed:'ምልክታታት ምኽፋት ኣይተኻእለን። HTTPSን ፍቓድ Browserን ኣረጋግጹ።', title:'ምልክታ ቦነስ ተቐበሉ', description:'ኣፕ ዕጹው እኳ እንተኾነ ጸወታ ቦነስ 10,000 ብር ክጅምር ከሎ ምልክታ ክመጸኩም እዩ።', busy:'ይጽዓን ኣሎ…', enable:'ምልክታታት ኣብርህ' },
  en: { connectionError:'The notification connection is temporarily unavailable.', denied:'Notifications are blocked in your browser. Allow them in Browser Settings.', permission:'Permission is required to receive notifications.', success:'Notifications are enabled. You will receive bonus updates.', failed:'Could not enable notifications. Check HTTPS and browser permission.', title:'Get bonus notifications', description:'Get notified when the ETB 10,000 bonus game is approaching and when it starts, even when the app is closed.', busy:'Enabling…', enable:'Enable notifications' },
} satisfies Record<Lang, Record<string,string>>;

type PushConfig = { enabled: boolean; publicKey: string | null };

function decodeKey(value: string): Uint8Array {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export function PushNotificationPrompt() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const t = copy[lang];
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
        if (!cancelled) setMessage(t.connectionError);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.role, user?.phoneVerified]);

  if (!user || user.role !== 'player' || user.phoneVerified !== true || !config?.enabled || !ready) return null;

  if (subscribed) return null;

  const enable = async () => {
    setBusy(true);
    setMessage('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setMessage(permission === 'denied'
          ? t.denied
          : t.permission);
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
      setMessage(t.success);
    } catch {
      setMessage(t.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="fixed bottom-3 left-3 right-3 z-[80] mx-auto max-w-md rounded-2xl border border-amber-400/40 bg-[#111114] p-4 text-white shadow-2xl">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden="true">🔔</span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{t.title}</p>
          <p className="mt-1 text-sm text-white/70">{t.description}</p>
          {message && <p className="mt-2 text-xs text-amber-300">{message}</p>}
          <button type="button" disabled={busy} onClick={() => void enable()} className="mt-3 rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-60">
            {busy ? t.busy : t.enable}
          </button>
        </div>
      </div>
    </aside>
  );
}
