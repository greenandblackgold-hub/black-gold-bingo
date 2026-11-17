import { useEffect, useState } from 'react';
import { translations } from '@/lib/localization';
import type { Lang } from '@/types/game';

const COPY = translations.pinReset;

export function PinResetFlow({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const t = COPY[lang];
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [seconds, setSeconds] = useState(60);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (step !== 2 || seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [step, seconds]);
  const field = 'w-full rounded-xl border border-gold-700/40 bg-black/5 px-4 py-3 text-gold-100 placeholder:text-gold-700/80 outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20';
  const move = () => {
    setNotice(t.unavailable);
    if (step === 1 && /^0[79]\d{8}$/.test(phone)) { setStep(2); setSeconds(60); }
    else if (step === 2 && /^\d{4,6}$/.test(otp)) setStep(3);
    else if (step === 3 && /^\d{6}$/.test(pin) && pin === confirm) setNotice(t.unavailable);
    else setNotice(t.invalid);
  };
  return (
    <section className="rounded-2xl border border-gold-700/40 bg-black/20 p-5 sm:p-6" aria-label={t.title}>
      <h3 className="mb-4 text-xl font-bold text-gold-100">{t.title}</h3>
      <p className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-200">{t.preview}</p>
      <p className="mb-3 text-xs text-gold-500">{t.step} {step} / 3</p>
      {step === 1 && <label className="block text-sm text-gold-300">{t.phone}<input className={field + ' mt-2'} inputMode="tel" placeholder="09******** / 07********" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} /></label>}
      {step === 2 && <div className="space-y-3"><label className="block text-sm text-gold-300">{t.otp}<input className={field + ' mt-2'} inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\\D/g, '').slice(0, 6))} /></label><p className="text-xs text-gold-400">{t.timer}: 00:{String(seconds).padStart(2, '0')}</p><button type="button" disabled={seconds > 0} onClick={() => setNotice(t.unavailable)} className="text-xs text-gold-300 underline disabled:opacity-40">{t.resend}</button></div>}
      {step === 3 && <div className="space-y-3"><label className="block text-sm text-gold-300">{t.newPin}<input className={field + ' mt-2'} type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\\D/g, '').slice(0, 6))} /></label><label className="block text-sm text-gold-300">{t.confirm}<input className={field + ' mt-2'} type="password" inputMode="numeric" maxLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\\D/g, '').slice(0, 6))} /></label></div>}
      {notice && <p role="status" className="mt-4 rounded-lg bg-amber-500/10 p-3 text-xs leading-5 text-amber-200">{notice}</p>}
      <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={onClose} className="rounded-lg border border-gold-700/50 px-4 py-2 text-sm text-gold-300">{t.back}</button><button type="button" onClick={move} className="rounded-lg bg-gradient-to-r from-gold-300 to-gold-500 px-5 py-2 text-sm font-bold text-darkbg">{t.next}</button></div>
    </section>
  );
}
