import { useEffect, useState } from 'react';
import { translations } from '@/lib/localization';
import { api, ApiError } from '@/lib/api';
import type { Lang } from '@/types/game';

const COPY = translations.pinReset;

export function PinResetFlow({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const t = COPY[lang];
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [seconds, setSeconds] = useState(300);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (step !== 2 || seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [step, seconds]);

  const field = 'w-full rounded-xl border border-gold-700/40 bg-black/5 px-4 py-3 text-gold-100 placeholder:text-gold-700/80 outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20';
  const requestCode = async () => {
    setBusy(true);
    setNotice('');
    try {
      await api.post('/api/auth/pin-reset/request', { phone });
      setStep(2);
      setSeconds(300);
      setNotice(t.requested);
    } catch (error) {
      setNotice(error instanceof ApiError ? t.invalid : t.networkError);
    } finally {
      setBusy(false);
    }
  };
  const completeReset = async () => {
    if (!/^\d{6}$/.test(otp) || !/^\d{6}$/.test(pin) || pin !== confirm) {
      setNotice(t.invalid);
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      await api.post('/api/auth/pin-reset/complete', { phone, code: otp, pin, pinConfirm: confirm });
      setNotice(t.success);
      setStep(4);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'network';
      setNotice(code === 'reset_code_expired' || code === 'reset_attempts_exceeded' ? t.expired : code === 'invalid_reset_code' || code === 'invalid_otp' ? t.wrongCode : code === 'network' ? t.networkError : t.invalid);
    } finally {
      setBusy(false);
    }
  };
  const move = () => {
    if (step === 1) void requestCode();
    else if (step === 2) {
      if (!/^\d{6}$/.test(otp)) setNotice(t.invalid);
      else { setStep(3); setNotice(''); }
    } else if (step === 3) void completeReset();
    else onClose();
  };

  return (
    <section className="rounded-2xl border border-gold-700/40 bg-black/20 p-5 sm:p-6" aria-label={t.title}>
      <h3 className="mb-4 text-xl font-bold text-gold-100">{t.title}</h3>
      <p className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-200">{t.adminHelp}</p>
      <p className="mb-3 text-xs text-gold-500">{t.step} {Math.min(step, 3)} / 3</p>
      {step === 1 && <label className="block text-sm text-gold-300">{t.phone}<input className={field + ' mt-2'} inputMode="tel" autoComplete="tel" placeholder="09******** / 07********" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, '').slice(0, 13))} /></label>}
      {step === 2 && <div className="space-y-3">
        <label className="block text-sm text-gold-300">{t.otp}<input className={field + ' mt-2'} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
        <p className="text-xs text-gold-400">{t.timer}: 0{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</p>
        <button type="button" disabled={seconds > 0 || busy} onClick={() => void requestCode()} className="text-xs text-gold-300 underline disabled:opacity-40">{t.resend}</button>
      </div>}
      {step === 3 && <div className="space-y-3">
        <label className="block text-sm text-gold-300">{t.newPin}<input className={field + ' mt-2'} type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
        <label className="block text-sm text-gold-300">{t.confirm}<input className={field + ' mt-2'} type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
      </div>}
      {notice && <p role="status" className="mt-4 rounded-lg bg-amber-500/10 p-3 text-xs leading-5 text-amber-200">{notice}</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-gold-700/50 px-4 py-2 text-sm text-gold-300 disabled:opacity-50">{t.back}</button>
        <button type="button" onClick={move} disabled={busy} className="rounded-lg bg-gradient-to-r from-gold-300 to-gold-500 px-5 py-2 text-sm font-bold text-darkbg disabled:opacity-50">{busy ? t.working : step === 4 ? t.done : t.next}</button>
      </div>
    </section>
  );
}
