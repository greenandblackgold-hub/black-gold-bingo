import { useState } from 'react';
import { translations } from '@/lib/localization';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { ApiError } from '@/lib/api';
import type { Lang } from '@/types/game';
import { useToast } from '@/context/ToastContext';
import { PinResetFlow } from '@/components/auth/PinResetFlow';

const TEXT = translations.auth;
const LANG_LABELS: Record<Lang, string> = { am: 'አማርኛ', ti: 'ትግርኛ', en: 'English' };
const BINGO_LETTERS = [
  { letter: 'B', color: 'bg-emerald-500', shadow: 'shadow-emerald-500/30' },
  { letter: 'I', color: 'bg-cyan-500', shadow: 'shadow-cyan-500/30' },
  { letter: 'N', color: 'bg-indigo-500', shadow: 'shadow-indigo-500/30' },
  { letter: 'G', color: 'bg-pink-600', shadow: 'shadow-pink-600/30' },
  { letter: 'O', color: 'bg-orange-500', shadow: 'shadow-orange-500/30' },
];

export function AuthScreen() {
  const { login, register } = useAuth();
  const { showToast } = useToast();
  const { lang, setLang } = useLanguage();
  const t = TEXT[lang];
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPinReset, setShowPinReset] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login(phone, pin);
        showToast('success', lang === 'am' ? 'በተሳካ ሁኔታ ገብተዋል።' : lang === 'ti' ? 'ብዓወት ኣቲኹም።' : 'Signed in successfully.');
      } else {
        if (pin !== confirmPin) {
          setError(t.pinMismatch);
          showToast('error', t.pinMismatch);
          return;
        }
        await register(phone, name, pin, confirmPin);
        showToast('success', lang === 'am' ? 'መለያዎ በተሳካ ሁኔታ ተፈጥሯል።' : lang === 'ti' ? 'መለያኹም ብዓወት ተፈጢሩ።' : 'Account created successfully.');
      }
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'error';
      const message = (t as Record<string, string>)[code] ?? t.error;
      setError(message);
      showToast('error', message);
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded-xl border border-gold-700/40 bg-[#111116] px-4 py-3.5 text-gold-100 placeholder:text-gold-700/80 outline-none transition focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20';
  const passwordType = showPin ? 'text' : 'password';
  const pinStrength = pin.length < 4 ? 0 : new Set(pin).size <= 2 ? 1 : pin.length < 6 ? 1 : new Set(pin).size <= 3 ? 2 : 3;
  const strengthLabels = lang === 'am' ? ['PIN ያስገቡ', 'ደካማ', 'መካከለኛ', 'ጥሩ'] : lang === 'ti' ? ['PIN የእትዉ', 'ድኹም', 'ማእከላይ', 'ጽቡቕ'] : ['Enter a PIN', 'Weak', 'Fair', 'Good'];

  const branding = (
    <div className="relative flex flex-col items-center text-center">
      <div className="flex items-center justify-center gap-2.5 sm:gap-3" aria-label="BINGO">
        {BINGO_LETTERS.map(({ letter, color, shadow }) => (
          <span key={letter} className={['grid h-11 w-11 place-items-center rounded-full text-lg font-black text-white shadow-lg sm:h-14 sm:w-14 sm:text-xl', color, shadow].join(' ')}>{letter}</span>
        ))}
      </div>
      <p className="mt-5 text-xs font-semibold tracking-[0.32em] text-gold-400/80">BLACK GOLD BINGO PRO</p>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#08080b] lg:grid lg:grid-cols-2">
      <section className="relative hidden min-h-screen flex-col items-center justify-center overflow-hidden border-r border-gold-500/15 bg-[radial-gradient(ellipse_at_50%_38%,#202027_0%,#101014_42%,#050507_100%)] px-10 py-16 lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,215,0,0.10),transparent_30%,transparent_70%,rgba(255,215,0,0.07))]" />
        <div className="pointer-events-none absolute -left-40 top-[-8rem] h-[34rem] w-[34rem] rounded-full bg-gold-400/10 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-48 -right-36 h-[34rem] w-[34rem] rounded-full bg-gold-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute inset-x-16 top-1/2 h-px bg-gradient-to-r from-transparent via-gold-400/25 to-transparent" />
        {branding}
        <div className="relative mt-14 max-w-lg text-center">
          <h1 className="text-4xl font-black leading-tight tracking-wide text-white xl:text-5xl">BLACK GOLD</h1>
          <p className="mt-3 text-sm font-semibold tracking-[0.28em] text-gold-400">BINGO PRO</p>
          <p className="mx-auto mt-6 max-w-sm text-sm leading-7 text-zinc-300/75">{t.brandLine}</p>
        </div>
        <p className="absolute bottom-8 text-[11px] tracking-[0.24em] text-gold-500/55">© BLACK GOLD BINGO PRO</p>
      </section>

      <section className="relative flex min-h-screen flex-col px-5 py-5 sm:px-8 lg:px-12 xl:px-20">
        <div className="mb-5 flex items-center justify-between gap-3 lg:mb-0">
          <div className="lg:hidden">{branding}</div>
          <label className="ml-auto">
            <span className="sr-only">{t.languageLabel}</span>
            <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="rounded-xl border border-gold-700/50 bg-[#141419] px-3 py-2.5 text-sm text-gold-300 outline-none transition focus:border-gold-400">
              {(['am', 'ti', 'en'] as Lang[]).map((code) => <option key={code} value={code}>{LANG_LABELS[code]}</option>)}
            </select>
          </label>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-7 sm:py-10">
          <div className="mb-7">
            <p className="mb-2 text-xs font-bold tracking-[0.24em] text-gold-500">BLACK GOLD BINGO PRO</p>
            <h2 className="text-3xl font-bold text-white">{mode === 'login' ? t.welcome : t.register}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{t.formHint}</p>
          </div>

          <div className="mb-7 grid grid-cols-2 rounded-2xl border border-gold-700/30 bg-[#111116] p-1.5">
            <button type="button" aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError(null); setShowPinReset(false); }} className={['rounded-xl px-3 py-3.5 text-sm font-bold transition', mode === 'login' ? 'bg-gradient-to-r from-gold-300 to-gold-500 text-[#08080b] shadow-lg shadow-gold-900/20' : 'text-zinc-400 hover:text-white'].join(' ')}>
              {t.login}
            </button>
            <button type="button" aria-pressed={mode === 'register'} onClick={() => { setMode('register'); setError(null); setShowPinReset(false); }} className={['rounded-xl px-3 py-3.5 text-sm font-bold transition', mode === 'register' ? 'bg-gradient-to-r from-gold-300 to-gold-500 text-[#08080b] shadow-lg shadow-gold-900/20' : 'text-zinc-400 hover:text-white'].join(' ')}>
              {t.register}
            </button>
          </div>

          {showPinReset ? <PinResetFlow lang={lang} onClose={() => setShowPinReset(false)} /> : <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (!busy) void submit(); }}>
            <div>
              <label htmlFor="auth-phone" className="mb-2 block text-sm font-semibold text-gold-300">{t.phone}</label>
              <input id="auth-phone" required inputMode="tel" autoComplete="tel" placeholder={t.phonePlaceholder} value={phone} onChange={(e) => { setPhone(e.target.value.replace(/[^0-9+]/g, '').slice(0, 13)); setError(null); }} className={input} />
            </div>
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-name" className="mb-2 block text-sm font-semibold text-gold-300">{t.name}</label>
                <input id="auth-name" required autoComplete="name" placeholder={t.name} value={name} onChange={(e) => { setName(e.target.value); setError(null); }} className={input} />
              </div>
            )}
            <div>
              <label htmlFor="auth-pin" className="mb-2 block text-sm font-semibold text-gold-300">{t.pin}</label>
              <div className="relative">
                <input id="auth-pin" required type={passwordType} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null); }} className={input + ' pr-16'} />
                <button type="button" aria-label={showPin ? t.hide : t.show} aria-pressed={showPin} onClick={() => setShowPin((v) => !v)} className="absolute inset-y-0 right-0 px-4 text-sm font-medium text-gold-400 hover:text-gold-200">{showPin ? '◉' : '◎'}</button>
              </div>
              {mode === 'register' && (
                <div className="mt-2" aria-live="polite">
                  <div className="mb-1.5 flex gap-1.5">
                    {[1, 2, 3].map((level) => <span key={level} className={['h-1.5 flex-1 rounded-full transition-colors', pinStrength >= level ? level === 1 ? 'bg-red-400' : level === 2 ? 'bg-amber-400' : 'bg-emerald-400' : 'bg-zinc-700'].join(' ')} />)}
                  </div>
                  <p className="text-xs text-zinc-400">{strengthLabels[pinStrength]}{pin.length === 6 ? '' : ' · ' + (lang === 'am' ? '6 አሃዝ ያስፈልጋል' : lang === 'ti' ? '6 ኣሃዝ የድሊ' : '6 digits required')}</p>
                </div>
              )}
              {mode === 'login' && (
                <div className="mt-2 text-right">
                  <button type="button" onClick={() => setShowPinReset(true)} className="text-xs font-semibold text-gold-400 underline decoration-gold-500/50 underline-offset-4 hover:text-gold-200">{t.forgot}</button>
                </div>
              )}
            </div>
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-pin-confirm" className="mb-2 block text-sm font-semibold text-gold-300">{t.confirmPin}</label>
                <div className="relative">
                  <input id="auth-pin-confirm" required type={showConfirmPin ? 'text' : 'password'} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="new-password" value={confirmPin} onChange={(e) => { setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null); }} className={input + ' pr-16'} />
                  <button type="button" aria-label={showConfirmPin ? t.hide : t.show} aria-pressed={showConfirmPin} onClick={() => setShowConfirmPin((v) => !v)} className="absolute inset-y-0 right-0 px-4 text-sm font-medium text-gold-400 hover:text-gold-200">{showConfirmPin ? '◉' : '◎'}</button>
                </div>
              </div>
            )}
            {error && <p role="alert" aria-live="assertive" className="rounded-xl border border-red-500/30 bg-red-950/40 p-3.5 text-sm text-red-200">{error}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 py-4 font-extrabold text-[#08080b] shadow-lg shadow-gold-900/25 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? t.busy : mode === 'login' ? t.login : t.register}
            </button>
          </form>}

          {mode === 'register' && <p className="mt-5 text-center text-xs leading-5 text-zinc-500">{t.age}</p>}
          {!showPinReset && <p className="mt-8 text-center text-xs tracking-wide text-zinc-600">© BLACK GOLD BINGO PRO</p>}
        </div>
      </section>
    </main>
  );
}
