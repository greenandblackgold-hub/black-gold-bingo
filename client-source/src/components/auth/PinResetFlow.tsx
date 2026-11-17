import { useEffect, useState } from 'react';
import { translations } from '@/lib/localization';
import { api, ApiError } from '@/lib/api';
import type { Lang } from '@/types/game';

const COPY = translations.pinReset;

type NoticeKind = 'info' | 'success' | 'error';

export function PinResetFlow({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const t = COPY[lang];
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [seconds, setSeconds] = useState(300);
  const [notice, setNotice] = useState('');
  const [noticeKind, setNoticeKind] = useState<NoticeKind>('info');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (step !== 2 || seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [step, seconds]);

  const field = 'w-full rounded-xl border border-gold-700/40 bg-[#111116] px-4 py-3.5 text-gold-100 placeholder:text-zinc-600 outline-none transition focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20';
  const setMessage = (message: string, kind: NoticeKind) => {
    setNotice(message);
    setNoticeKind(kind);
  };

  const requestCode = async () => {
    setBusy(true);
    setMessage('', 'info');
    try {
      await api.post('/api/auth/pin-reset/request', { phone });
      setStep(2);
      setOtp('');
      setSeconds(300);
      setMessage(t.requested, 'success');
    } catch (error) {
      setMessage(error instanceof ApiError ? t.invalid : t.networkError, 'error');
    } finally {
      setBusy(false);
    }
  };

  const completeReset = async () => {
    if (!/^\d{6}$/.test(otp) || !/^\d{6}$/.test(pin) || pin !== confirm) {
      setMessage(t.invalid, 'error');
      return;
    }
    setBusy(true);
    setMessage('', 'info');
    try {
      await api.post('/api/auth/pin-reset/complete', { phone, code: otp, pin, pinConfirm: confirm });
      setMessage(t.success, 'success');
      setStep(4);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'network';
      const message = code === 'reset_code_expired' || code === 'reset_attempts_exceeded' ? t.expired : code === 'invalid_reset_code' || code === 'invalid_otp' ? t.wrongCode : code === 'network' ? t.networkError : t.invalid;
      setMessage(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const move = () => {
    if (step === 1) void requestCode();
    else if (step === 2) {
      if (!/^\d{6}$/.test(otp)) setMessage(t.invalid, 'error');
      else { setStep(3); setMessage('', 'info'); }
    } else if (step === 3) void completeReset();
    else onClose();
  };

  const timerText = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  const noticeStyle = noticeKind === 'success'
    ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-200'
    : noticeKind === 'error'
      ? 'border-red-500/30 bg-red-950/40 text-red-200'
      : 'border-gold-500/20 bg-gold-500/5 text-gold-200';

  return (
    <section className="rounded-2xl border border-gold-700/40 bg-[#101014] p-5 shadow-xl shadow-black/20 sm:p-6" aria-label={t.title}>
      <h3 className="mb-4 text-xl font-bold text-white">{t.title}</h3>
      <p className="mb-5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5 text-xs leading-5 text-amber-200">{t.adminHelp}</p>
      <p className="mb-3 text-xs font-semibold tracking-wide text-gold-500">{t.step} {Math.min(step, 3)} / 3</p>
      {step === 1 && <label className="block text-sm font-semibold text-gold-300">{t.phone}<input required className={field + ' mt-2'} inputMode="tel" autoComplete="tel" placeholder="09******** / 07********" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, '').slice(0, 13))} /></label>}
      {step === 2 && <div className="space-y-4">
        <label className="block text-sm font-semibold text-gold-300">{t.otp}<input required className={field + ' mt-2 text-center text-xl tracking-[0.45em]'} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
        <div className="flex items-center justify-between gap-3 text-xs">
          <p className="font-semibold tabular-nums text-gold-300">{t.timer}: {timerText}</p>
          <button type="button" disabled={seconds > 0 || busy} onClick={() => void requestCode()} className="font-semibold text-gold-400 underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-40">{t.resend}</button>
        </div>
      </div>}
      {step === 3 && <div className="space-y-3">
        <label className="block text-sm font-semibold text-gold-300">{t.newPin}<input required className={field + ' mt-2'} type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
        <label className="block text-sm font-semibold text-gold-300">{t.confirm}<input required className={field + ' mt-2'} type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{6}" maxLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
      </div>}
      {notice && <p role={noticeKind === 'error' ? 'alert' : 'status'} aria-live="polite" className={'mt-4 rounded-xl border p-3.5 text-xs leading-5 ' + noticeStyle}>{notice}</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-gold-700/50 px-4 py-3 text-sm font-semibold text-gold-300 transition hover:border-gold-400 disabled:opacity-50">{t.back}</button>
        <button type="button" onClick={move} disabled={busy || (step === 1 && phone.length < 10) || (step === 2 && otp.length !== 6) || (step === 3 && (pin.length !== 6 || confirm.length !== 6))} className="flex-1 rounded-xl bg-gradient-to-r from-gold-300 to-gold-500 px-5 py-3 text-sm font-extrabold text-[#08080b] shadow-lg shadow-gold-900/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">{busy ? t.working : step === 4 ? t.done : t.next}</button>
      </div>
    </section>
  );
}
