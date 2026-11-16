import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { ApiError } from '@/lib/api';
import type { Lang } from '@/types/game';
import { useToast } from '@/context/ToastContext';
import { PinResetFlow } from '@/components/auth/PinResetFlow';

const TEXT = {
  am: {
    login: 'ይግቡ', register: 'መለያ ይክፈቱ', phone: 'ስልክ ቁጥር', name: 'ሙሉ ስም', pin: '6 አሃዝ የይለፍ ቁጥር (PIN)', confirmPin: 'የይለፍ ቁጥሩን ድገሙ', pinMismatch: 'ያስገቡት PIN አይመሳሰልም።',
    toRegister: 'መለያ የለዎትም? ይክፈቱ', toLogin: 'መለያ አለዎት? ይግቡ', busy: 'በመጠበቅ ላይ…', phonePlaceholder: '09******** / 07********',
    invalid_phone: 'ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (09… ወይም 07…)', invalid_name: 'ሙሉ ስምዎን ያስገቡ', invalid_pin: 'PIN 6 አሃዝ መሆን አለበት', pin_mismatch: 'ያስገቡት PIN አይመሳሰልም።',
    phone_taken: 'ይህ ስልክ ቁጥር ተመዝግቧል', invalid_credentials: 'ስልክ ቁጥር ወይም PIN ልክ አይደለም',
    locked: 'ብዙ ጊዜ ሞክረዋል። ከ15 ደቂቃ በኋላ ይሞክሩ።', rate_limited: 'በጣም ብዙ ጥያቄዎች። ትንሽ ቆይተው ይሞክሩ።', network: 'ከአገልጋዩ ጋር መገናኘት አልተቻለም።', error: 'የሆነ ችግር ተፈጥሯል። እንደገና ይሞክሩ።',
    age: '18 ዓመት እና ከዚያ በላይ ብቻ። ስልክ ቁጥሩ በSMS አይረጋገጥም፤ የራስዎን ቁጥር ብቻ ይጠቀሙ።',
    forgot: 'የይለፍ ቁጥር ረሱት?', forgotInfo: 'የPIN ማገገሚያ አገልግሎት እስካሁን አልተዘጋጀም። እባክዎ ከአስተዳዳሪ ጋር ይገናኙ።',
    brandLine: 'የቢንጎ ጨዋታዎን በዘመናዊ መንገድ ይደሰቱ።', welcome: 'እንኳን ደህና መጡ', formHint: 'ለመቀጠል የመለያ መረጃዎን ያስገቡ።', show: 'አሳይ', hide: 'ደብቅ',
  },
  ti: {
    login: 'እቶ', register: 'መለያ ክፈት', phone: 'ቁጽሪ ተሌፎን', name: 'ምሉእ ስም', pin: '6 ኣሃዝ ምስጢራዊ ቁጽሪ (PIN)', confirmPin: 'PIN ደግም', pinMismatch: 'እቲ ዘእተኹሞ PIN ኣይመሳሰልን።',
    toRegister: 'መለያ የብልካን? ክፈት', toLogin: 'መለያ ኣለካ? እቶ', busy: 'ይጽበ ኣሎ…', phonePlaceholder: '09******** / 07********',
    invalid_phone: 'ቅኑዕ ናይ ኢትዮጵያ ቁጽሪ ተሌፎን የእትዉ (09… ወይ 07…)', invalid_name: 'ምሉእ ስምኩም የእትዉ', invalid_pin: 'PIN 6 ኣሃዝ ክኸውን ኣለዎ',
    phone_taken: 'እዚ ቁጽሪ ተሌፎን ተመዝጊቡ ኣሎ', invalid_credentials: 'ቁጽሪ ተሌፎን ወይ PIN ቅኑዕ ኣይኮነን',
    locked: 'ብዙሕ ግዜ ፈቲኖም። ድሕሪ 15 ደቓይቕ ፈትኑ።', rate_limited: 'ብዙሕ ሕቶታት። ቁሩብ ደሊኹም ፈትኑ።', network: 'ምስ ኣገልግሎት ምርካብ ኣይተኻኣለን።', error: 'ጸገም ተፈጢሩ። እንደገና ፈትኑ።',
    age: '18 ዓመትን ልዕሊኡን ጥራይ። ቁጽሪ ተሌፎን ብSMS ኣይረጋገጽን፤ ናይ ባዕልኹም ቁጽሪ ጥራይ ተጠቐሙ።',
    forgot: 'PIN ረሲዕካዮ?', forgotInfo: 'ናይ PIN ምምላስ ኣገልግሎት ገና ኣይተዳለወን። በጃኹም ምስ ኣመሓዳሪ ተራኸቡ።',
    brandLine: 'ኣብ ዘመናዊ መንገዲ ቢንጎ ተጻወቱን ተዘናግዑን።', welcome: 'እንቋዕ ብደሓን መጻእኩም', formHint: 'ንምቕጻል ናይ መለያ ሓበሬታኹም የእትዉ።', show: 'ኣርኢ', hide: 'ሕባእ',
  },
  en: {
    login: 'Sign in', register: 'Create account', phone: 'Phone number', name: 'Full name', pin: '6-digit PIN', confirmPin: 'Confirm PIN', pinMismatch: 'The PINs do not match.',
    toRegister: 'New here? Create an account', toLogin: 'Already have an account? Sign in', busy: 'Please wait…', phonePlaceholder: '09******** / 07********',
    invalid_phone: 'Enter a valid Ethiopian mobile number (09… or 07…)', invalid_name: 'Enter your full name', invalid_pin: 'PIN must be 6 digits',
    phone_taken: 'This number is already registered', invalid_credentials: 'Wrong phone number or PIN',
    locked: 'Too many attempts. Try again in 15 minutes.', rate_limited: 'Too many requests. Wait a moment.', network: 'Can’t reach the server.', error: 'Something went wrong. Try again.',
    age: '18+ only. Phone numbers are not SMS-verified; use only your own number.',
    forgot: 'Forgot your PIN?', forgotInfo: 'PIN recovery is not available yet. Please contact the administrator for assistance.',
    brandLine: 'Enjoy your bingo experience with a modern touch.', welcome: 'Welcome back', formHint: 'Enter your account details to continue.', show: 'Show', hide: 'Hide',
  },
} as const;

const LANG_LABELS: Record<Lang, string> = { am: 'አማርኛ', ti: 'ትግርኛ', en: 'English' };

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
      if (mode === 'login') await login(phone, pin);
      else {
        if (pin !== confirmPin) { setError(t.pinMismatch); return; }
        await register(phone, name, pin, confirmPin);
      }
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'error';
      const message = (t as Record<string, string>)[code] ?? t.error;\n      setError(message);\n      showToast('error', message);
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded-xl border border-gold-700/40 bg-black/5 px-4 py-3 text-gold-100 placeholder:text-gold-700/80 outline-none transition focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20';
  const passwordType = showPin ? 'text' : 'password';

  return (
    <main className="min-h-screen bg-darkbg lg:grid lg:grid-cols-2">
      <section className="relative hidden min-h-screen flex-col justify-between overflow-hidden border-r border-gold-700/20 bg-gradient-to-br from-[#090806] via-[#171209] to-[#2a1e0b] p-12 lg:flex xl:p-16">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl" />
        <div className="relative">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-gold-400/40 bg-gold-400/10 text-2xl text-gold-300 shadow-lg shadow-black/30">♛</div>
          <p className="bg-gradient-to-r from-gold-200 via-gold-400 to-gold-600 bg-clip-text text-3xl font-black tracking-[0.12em] text-transparent">BLACK GOLD</p>
          <p className="mt-1 text-sm font-bold tracking-[0.38em] text-gold-400">BINGO PRO</p>
        </div>
        <div className="relative max-w-lg">
          <div className="mb-5 h-px w-20 bg-gold-500/70" />
          <h1 className="text-4xl font-bold leading-tight text-gold-100 xl:text-5xl">BLACK GOLD BINGO PRO</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-gold-200/65">{t.brandLine}</p>
        </div>
        <p className="relative text-xs tracking-widest text-gold-500/60">© BLACK GOLD BINGO PRO</p>
      </section>

      <section className="relative flex min-h-screen flex-col px-5 py-5 sm:px-8 lg:px-12 xl:px-20">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 lg:invisible">
            <span className="text-xl text-gold-400">♛</span>
            <span className="text-sm font-black tracking-wider text-gold-300">BLACK GOLD</span>
          </div>
          <label className="ml-auto">
            <span className="sr-only">Choose language</span>
            <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="rounded-lg border border-gold-700/50 bg-cardbg px-3 py-2 text-sm text-gold-300 outline-none transition focus:border-gold-400">
              {(['am', 'ti', 'en'] as Lang[]).map((code) => <option key={code} value={code}>{LANG_LABELS[code]}</option>)}
            </select>
          </label>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <div className="mb-8">
            <p className="mb-2 text-sm font-semibold tracking-wide text-gold-500">BLACK GOLD BINGO PRO</p>
            <h2 className="text-3xl font-bold text-gold-100">{mode === 'login' ? t.welcome : t.register}</h2>
            <p className="mt-2 text-sm text-gold-300/60">{t.formHint}</p>
          </div>

          <div className="mb-7 grid grid-cols-2 rounded-xl border border-gold-700/40 bg-black/20 p-1">
            <button type="button" aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError(null); setShowPinReset(false); }} className={['rounded-lg px-3 py-3 text-sm font-semibold transition', mode === 'login' ? 'bg-gradient-to-r from-gold-300 to-gold-500 text-darkbg shadow-md shadow-black/20' : 'text-gold-300/70 hover:text-gold-200'].join(' ')}>
              {t.login}
            </button>
            <button type="button" aria-pressed={mode === 'register'} onClick={() => { setMode('register'); setError(null); setForgotInfo(false); }} className={['rounded-lg px-3 py-3 text-sm font-semibold transition', mode === 'register' ? 'bg-gradient-to-r from-gold-300 to-gold-500 text-darkbg shadow-md shadow-black/20' : 'text-gold-300/70 hover:text-gold-200'].join(' ')}>
              {t.register}
            </button>
          </div>

          {showPinReset ? <PinResetFlow lang={lang} onClose={() => setShowPinReset(false)} /> : <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (!busy) void submit(); }}>
            <div>
              <label htmlFor="auth-phone" className="mb-2 block text-sm font-medium text-gold-300">{t.phone}</label>
              <input id="auth-phone" inputMode="tel" autoComplete="tel" placeholder={t.phonePlaceholder} value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
            </div>
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-name" className="mb-2 block text-sm font-medium text-gold-300">{t.name}</label>
                <input id="auth-name" autoComplete="name" placeholder={t.name} value={name} onChange={(e) => setName(e.target.value)} className={input} />
              </div>
            )}
            <div>
              <label htmlFor="auth-pin" className="mb-2 block text-sm font-medium text-gold-300">{t.pin}</label>
              <div className="relative">
                <input id="auth-pin" type={passwordType} inputMode="numeric" maxLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} className={input + ' pr-16'} />
                <button type="button" aria-label={showPin ? t.hide : t.show} aria-pressed={showPin} onClick={() => setShowPin((v) => !v)} className="absolute inset-y-0 right-0 px-4 text-sm font-medium text-gold-400 hover:text-gold-200">{showPin ? '◉' : '◎'}</button>
              </div>
              {mode === 'login' && (
                <div className="mt-2 text-right">
                  <button type="button" onClick={() => setShowPinReset(true)} className="text-xs font-medium text-gold-400 underline decoration-gold-500/50 underline-offset-4 hover:text-gold-200">{t.forgot}</button>
                </div>
              )}
              
            </div>
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-pin-confirm" className="mb-2 block text-sm font-medium text-gold-300">{t.confirmPin}</label>
                <div className="relative">
                  <input id="auth-pin-confirm" type={showConfirmPin ? 'text' : 'password'} inputMode="numeric" maxLength={6} autoComplete="new-password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))} className={input + ' pr-16'} />
                  <button type="button" aria-label={showConfirmPin ? t.hide : t.show} aria-pressed={showConfirmPin} onClick={() => setShowConfirmPin((v) => !v)} className="absolute inset-y-0 right-0 px-4 text-sm font-medium text-gold-400 hover:text-gold-200">{showConfirmPin ? '◉' : '◎'}</button>
                </div>
              </div>
            )}
            {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 py-3.5 font-bold text-darkbg shadow-lg shadow-gold-900/20 transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? t.busy : mode === 'login' ? t.login : t.register}
            </button>
          </form>

          {mode === 'register' && <p className="mt-5 text-center text-xs leading-5 text-gold-500/70">{t.age}</p>}
          {!showPinReset && <p className="mt-8 text-center text-xs text-gold-700/70">© BLACK GOLD BINGO PRO</p>}
        </div>
      </section>
    </main>
  );
}
