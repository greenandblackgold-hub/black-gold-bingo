import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { api, API_URL } from '@/lib/api';
import { SmsBridge } from '@/lib/smsBridge';

type State = 'checking' | 'connected' | 'permission' | 'browser' | 'error';

export function AdminSmsSync() {
  const [state, setState] = useState<State>('checking');
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    if (!Capacitor.isNativePlatform()) {
      setState('browser');
      return;
    }
    setBusy(true);
    setState('checking');
    try {
      const permission = await SmsBridge.requestPermission();
      if (!permission.granted) {
        setState('permission');
        return;
      }
      const credentials = await api.post<{ token: string }>('/api/admin/sms-device/token', {});
      await SmsBridge.configure({ apiUrl: API_URL || window.location.origin, token: credentials.token });
      setState('connected');
    } catch {
      setState('error');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void connect(); }, []);

  const message = state === 'checking' ? 'የSMS ማገናኛን በማዘጋጀት ላይ…'
    : state === 'connected' ? 'የAdmin ስልክ SMS ማገናኛ ተገናኝቷል። የባንክ/Telebirr SMS በራስ-ሰር ይላካል።'
    : state === 'permission' ? 'SMS ለማንበብ ፈቃድ አልተሰጠም። ፈቃዱን ከAndroid Settings ያብሩ።'
    : state === 'browser' ? 'ራስ-ሰር SMS ማገናኛ በAdmin Android APK ላይ ብቻ ይሰራል። በWeb ላይ Admin APK-ን ይጠቀሙ።'
    : 'SMS ማገናኛው አልተገናኘም። ኢንተርኔትንና የAdmin መግቢያን ያረጋግጡ።';

  return (
    <section className="rounded-2xl bg-cardbg p-4 ring-1 ring-gold-700/50 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gold-300">Automatic Bank SMS Sync</h2>
          <p className="mt-1 text-sm text-gold-500">{message}</p>
        </div>
        <button type="button" onClick={() => void connect()} disabled={busy || state === 'checking'} className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-bold text-darkbg disabled:opacity-50">
          {busy || state === 'checking' ? 'በመገናኘት ላይ…' : 'Reconnect'}
        </button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-gold-700">SMS-ዎች የባንክ/Telebirr መለያ ከሆኑ ብቻ ይላካሉ። መልዕክቱ ከDeposit ጥያቄ ጋር ቢዛመድም Wallet የሚጨምረው Admin Approve ካደረገ ብቻ ነው።</p>
    </section>
  );
}
