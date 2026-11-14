import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { ApiError } from '@/lib/api';
import type { Lang } from '@/types/game';

const LANGS: { id: Lang; label: string }[] = [
  { id: 'am', label: 'አማ' },
  { id: 'ti', label: 'ትግ' },
  { id: 'en', label: 'EN' },
];

const TEXT = {
  am: {
    login: 'ግባ', register: 'መለያ ክፈት', phone: 'ስልክ ቁጥር', name: 'ስምዎ', pin: 'ባለ 6 አሃዝ ሚስጥር ቁጥር (PIN)', confirmPin: 'PIN ድገም', pinMismatch: 'ያስገቡት PIN አይመሳሰልም።',
    toRegister: 'መለያ የለዎትም? ይመዝገቡ', toLogin: 'መለያ አለዎት? ይግቡ', busy: 'በመጠበቅ ላይ…',
    invalid_phone: 'ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (09… ወይም 07…)', invalid_name: 'ስምዎን ያስገቡ', invalid_pin: 'PIN 6 አሃዝ መሆን አለበት',
    phone_taken: 'ይህ ስልክ ቁጥር ተመዝግቧል', invalid_credentials: 'ስልክ ቁጥር ወይም PIN ልክ አይደለም',
    locked: 'ብዙ ጊዜ ሞክረዋል። ከ15 ደቂቃ በኋላ ይሞክሩ።', rate_limited: 'በጣም ብዙ ጥያቄዎች። ትንሽ ቆይተው ይሞክሩ።', network: 'ከአገልጋዩ ጋር መገናኘት አልተቻለም።', error: 'የሆነ ችግር ተፈጥሯል። እንደገና ይሞክሩ።',
    age: '18 ዓመት እና ከዚያ በላይ ብቻ። ስልክ ቁጥሩ በSMS አይረጋገጥም፤ የራስዎን ቁጥር ብቻ ይጠቀሙ።',
  },
  ti: {
    login: 'እቶ', register: 'መለያ ክፈት', phone: 'ቁጽሪ ተሌፎን', name: 'ስምካ', pin: 'ናይ 6 ኣሃዝ ሚስጥራዊ ቁጽሪ (PIN)', confirmPin: 'PIN ደግም', pinMismatch: 'እቲ ዘእተኹሞ PIN ኣይመሳሰልን።',
    toRegister: 'መለያ የብልካን? ተመዝገብ', toLogin: 'መለያ ኣለካ? እቶ', busy: 'ይጽበ ኣሎ…',
    invalid_phone: 'ቅኑዕ ናይ ኢትዮጵያ ቁጽሪ ተሌፎን የእትዉ (09… ወይ 07…)', invalid_name: 'ስምኩም የእትዉ', invalid_pin: 'PIN 6 ኣሃዝ ክኸውን ኣለዎ',
    phone_taken: 'እዚ ቁጽሪ ተሌፎን ተመዝጊቡ ኣሎ', invalid_credentials: 'ቁጽሪ ተሌፎን ወይ PIN ቅኑዕ ኣይኮነን',
    locked: 'ብዙሕ ግዜ ፈቲኖም። ድሕሪ 15 ደቓይቕ ፈትኑ።', rate_limited: 'ብዙሕ ሕቶታት። ቁሩብ ደሊኹም ፈትኑ።', network: 'ምስ ኣገልግሎት ምርካብ ኣይተኻኣለን።', error: 'ጸገም ተፈጢሩ። እንደገና ፈትኑ።',
    age: '18 ዓመትን ልዕሊኡን ጥራይ። ቁጽሪ ተሌፎን ብSMS ኣይረጋገጽን፤ ናይ ባዕልኹም ቁጽሪ ጥራይ ተጠቐሙ።',
  },
  en: {
    login: 'Sign in', register: 'Create account', phone: 'Phone number', name: 'Your name', pin: '6-digit PIN', confirmPin: 'Repeat PIN', pinMismatch: 'The PINs do not match.',
    toRegister: 'No account? Register', toLogin: 'Have an account? Sign in', busy: 'Please wait…',
    invalid_phone: 'Enter a valid Ethiopian mobile number (09… or 07…)', invalid_name: 'Enter your name', invalid_pin: 'PIN must be 6 digits',
    phone_taken: 'This number is already registered', invalid_credentials: 'Wrong phone number or PIN',
    locked: 'Too many attempts. Try again in 15 minutes.', rate_limited: 'Too many requests. Wait a moment.', network: 'Can’t reach the server.', error: 'Something went wrong. Try again.',
    age: '18+ only. Phone numbers are not SMS-verified; use only your own number.',
  },
} as const;

export function AuthScreen() {
  const { login, register } = useAuth();
  const { lang, setLang } = useLanguage();
  const t = TEXT[lang];
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError((t as Record<string, string>)[code] ?? t.error);
    } finally {
      setBusy(false);
    }
  };

  const input =
    'w-full rounded-xl bg-white/[0.05] px-4 py-3 text-gold-300 placeholder:text-gold-700 ring-1 ring-gold-700/50 focus:outline-none focus:ring-2 focus:ring-gold-400';

  return (
    <div className="mx-auto grid min-h-screen max-w-sm content-center gap-5 px-5 py-10">
      <div className="flex items-center justify-between">
        <div className="leading-tight">
          <p className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-600 bg-clip-text text-2xl font-black text-transparent">Black Gold PLC</p>
          <p className="text-sm font-semibold text-gold-500">Bingo PRO</p>
        </div>
        <div role="group" aria-label="Language" className="flex overflow-hidden rounded-full ring-1 ring-gold-700/60">
          {LANGS.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={lang === o.id}
              onClick={() => setLang(o.id)}
              className={['px-2.5 py-1.5 text-sm font-semibold', lang === o.id ? 'bg-gold-500 text-darkbg' : 'text-gold-300'].join(' ')}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <section className="space-y-3 rounded-2xl bg-cardbg p-5 ring-1 ring-gold-700/50">
        <h1 className="text-xl font-bold text-gold-300">{mode === 'login' ? t.login : t.register}</h1>
        <div>
          <label htmlFor="auth-phone" className="mb-1.5 block text-sm text-gold-500">{t.phone}</label>
          <input id="auth-phone" inputMode="tel" autoComplete="tel" placeholder="09XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
        </div>
        {mode === 'register' && (
          <div>
            <label htmlFor="auth-name" className="mb-1.5 block text-sm text-gold-500">{t.name}</label>
            <input id="auth-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={input} />
          </div>
        )}
        <div>
          <label htmlFor="auth-pin" className="mb-1.5 block text-sm text-gold-500">{t.pin}</label>
          <input
            id="auth-pin"
            type="password"
            inputMode="numeric"
            maxLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && !busy && void submit()}
            className={input}
          />
        </div>
        {mode === 'register' && (
          <div>
            <label htmlFor="auth-pin-confirm" className="mb-1.5 block text-sm text-gold-500">{t.confirmPin}</label>
            <input id="auth-pin-confirm" type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && !busy && void submit()} className={input} />
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="w-full rounded-xl bg-gradient-to-br from-gold-300 via-gold-500 to-gold-600 py-3.5 font-bold text-darkbg active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? t.busy : mode === 'login' ? t.login : t.register}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
            setPin('');
            setConfirmPin('');
          }}
          className="w-full py-1 text-sm font-medium text-gold-400 underline underline-offset-4"
        >
          {mode === 'login' ? t.toRegister : t.toLogin}
        </button>
        {mode === 'register' && <p className="text-xs text-gold-700">{t.age}</p>}
      </section>
    </div>
  );
}
