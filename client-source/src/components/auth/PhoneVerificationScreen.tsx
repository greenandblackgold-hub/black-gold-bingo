import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { ApiError } from '@/lib/api';

export function PhoneVerificationScreen() {
  const { user, requestPhoneVerification, verifyPhoneVerification, logout } = useAuth();
  const { lang } = useLanguage();
  const am = lang === 'am';
  const ti = lang === 'ti';
  const [code, setCode] = useState('');
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const t = {
    title: am ? 'ስልክ ቁጥርዎን ያረጋግጡ' : ti ? 'ቁጽሪ ስልክኩም ኣረጋግጹ' : 'Verify your phone number',
    hint: am ? 'አስተዳዳሪው በስልክ ደውሎ የሚነግርዎትን 6 አሃዝ ኮድ ያስገቡ። SMS አይላክም።' : ti ? 'Admin ብስልኪ ዝነግረኩም 6 ኣሃዝ ኮድ ኣእትዉ። SMS ኣይለኣኽን።' : 'Enter the 6-digit code the admin reads to you on a phone call. No SMS is sent.',
    request: am ? 'የማረጋገጫ ኮድ ጠይቅ' : ti ? 'ኮድ ሕተት' : 'Request verification code',
    code: am ? '6 አሃዝ ኮድ' : ti ? '6 ኣሃዝ ኮድ' : '6-digit code',
    verify: am ? 'አረጋግጥ' : ti ? 'ኣረጋግጽ' : 'Verify',
    logout: am ? 'ውጣ' : ti ? 'ውጻእ' : 'Sign out',
    sent: am ? 'ጥያቄዎ ተልኳል። አስተዳዳሪው በስልክ ያነጋግርዎታል።' : ti ? 'ሕቶኹም ተላኢኹ። Admin ብስልኪ ክድውለልኩም እዩ።' : 'Request sent. An admin will call you.',
    wait: am ? 'ትንሽ ይጠብቁና እንደገና ይሞክሩ።' : ti ? 'ቁሩብ ተጸበዩ።' : 'Please wait before requesting another code.',
  };

  const request = async () => {
    setBusy(true); setError(''); setMessage('');
    try { await requestPhoneVerification(); setRequested(true); setMessage(t.sent); }
    catch (e) { setError(e instanceof ApiError && e.code === 'otp_wait' ? t.wait : (e as Error).message); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setError(''); setMessage('');
    try { await verifyPhoneVerification(code); }
    catch (e) { setError((e as Error).message || 'Verification failed'); }
    finally { setBusy(false); }
  };

  return <main className="grid min-h-screen place-items-center bg-darkbg px-5 py-10 text-gold-100">
    <section className="w-full max-w-md space-y-5 rounded-2xl border border-gold-700/50 bg-cardbg p-6">
      <h1 className="text-2xl font-bold text-gold-300">{t.title}</h1>
      <p className="text-sm text-gold-400">{user?.phone}</p>
      <p className="text-sm leading-6 text-gold-200/80">{t.hint}</p>
      <button type="button" disabled={busy} onClick={() => void request()} className="w-full rounded-xl bg-gold-500 px-4 py-3 font-bold text-black disabled:opacity-50">{t.request}</button>
      {requested && <div className="space-y-3">
        <label className="block text-sm text-gold-300" htmlFor="phone-otp">{t.code}</label>
        <input id="phone-otp" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="w-full rounded-xl border border-gold-700 bg-black/30 px-4 py-3 text-center text-2xl tracking-[0.5em]" />
        <button type="button" disabled={busy || code.length !== 6} onClick={() => void verify()} className="w-full rounded-xl bg-gold-500 px-4 py-3 font-bold text-black disabled:opacity-50">{t.verify}</button>
      </div>}
      {message && <p role="status" className="text-sm text-green-300">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button type="button" onClick={logout} className="w-full py-2 text-sm text-gold-500 underline">{t.logout}</button>
    </section>
  </main>;
}
