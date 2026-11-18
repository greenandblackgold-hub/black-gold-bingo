import { useState } from 'react';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useLanguage } from '@/context/LanguageContext';
import { usePlayer } from '@/context/PlayerContext';
import { useRound } from '@/context/RoundContext';
import { formatAmount } from '@/lib/localization';

const TELEBIRR = ['0914708903', '0983931020', '0908725881'];
const RULES = [
  'ካርቴላ ለመግዛት በአካውንትዎ በቂ ቀሪ ሂሳብ ሊኖር ይገባል።',
  'የጨዋታ ቁጥሮችን በጥንቃቄ ይከታተሉ፤ የወጣ ቁጥር ብቻ በካርቴላዎ ላይ ምልክት ያድርጉ።',
  'BINGO ሲሞላ የBINGO ጥያቄ ያቅርቡ፤ የአሸናፊነት ማረጋገጫ በስርዓቱ ይከናወናል።',
  'የገንዘብ ግብይት ማስረጃዎን ሙሉ በሙሉ ያስገቡ።',
];

export function PlayerFeatures({ onGoToWallet }: { onGoToWallet: () => void }) {
  const { lang, setLang } = useLanguage();
  const { balance, cards } = usePlayer();
  const { cardPrice, audioVolume, setAudioVolume } = useAppSettings();
  const { calledNumbers, roundNumber, phase, winner } = useRound();
  const { soundEnabled, setSoundEnabled, voiceEnabled, setVoiceEnabled } = useAppSettings();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return localStorage.getItem('bgb.playerTheme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
  });
  const [notifications, setNotifications] = useState(() => {
    try { return localStorage.getItem('bgb.playerNotifications') === 'on'; } catch { return false; }
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const light = theme === 'light';
  const panel = light ? 'border-amber-300 bg-amber-50 text-zinc-900' : 'border-gold-700/40 bg-zinc-950/70 text-gold-100';
  const muted = light ? 'text-zinc-600' : 'text-gold-600';
  const title = light ? 'text-amber-800' : 'text-gold-300';
  const toggle = (key: string) => setExpanded((v) => v === key ? null : key);
  const setPlayerTheme = (value: 'dark' | 'light') => {
    setTheme(value);
    try { localStorage.setItem('bgb.playerTheme', value); } catch { /* ignore */ }
  };
  const enableNotifications = async (on: boolean) => {
    if (!on) {
      setNotifications(false);
      try { localStorage.setItem('bgb.playerNotifications', 'off'); } catch { /* ignore */ }
      return;
    }
    if (!('Notification' in window)) return;
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    const enabled = permission === 'granted';
    setNotifications(enabled);
    try { localStorage.setItem('bgb.playerNotifications', enabled ? 'on' : 'off'); } catch { /* ignore */ }
  };

  const rows = [
    { id: 'messages', label: 'መልዕክቶች', icon: '✉' },
    { id: 'wallet', label: 'ማስገባት · ማውጣት · የግብይት ታሪክ', icon: '◈' },
    { id: 'gameHistory', label: 'የጨዋታ ታሪክ', icon: '◷' },
    { id: 'settings', label: 'ሴቲንግ', icon: '⚙' },
    { id: 'contact', label: 'ያግኙን', icon: '☎' },
    { id: 'rules', label: 'የጨዋታ ደንቦችና ሕጎች', icon: '▤' },
    { id: 'app', label: 'መተግበሪያ', icon: '▣' },
  ];

  return (
    <section className="mt-6 space-y-4" aria-label="Player information and settings">
      <div className={`overflow-hidden rounded-2xl border ${panel} shadow-xl`}>
        <div className="relative overflow-hidden bg-gradient-to-r from-zinc-950 via-zinc-900 to-amber-950 px-4 py-5 sm:px-6">
          <div className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full border-[18px] border-amber-300/10" />
          <div className="relative flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.28em] text-amber-300">BLACK GOLD BINGO</p>
              <h2 className="mt-1 text-2xl font-black text-amber-100 sm:text-3xl">ግማሽ ቤት <span className="text-base font-semibold text-amber-300">(Half House)</span></h2>
              <p className="mt-1 text-xs text-amber-200/70">የቀጥታ የBingo ጨዋታ</p>
            </div>
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border border-amber-300/40 bg-black/40 text-4xl shadow-lg shadow-amber-900/30 sm:h-24 sm:w-24">🎱</div>
          </div>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center gap-2"><span className="text-lg">ⓘ</span><h3 className={`font-bold ${title}`}>መረጃ</h3></div>
          <p className={`text-sm leading-7 ${muted}`}>በቴሌብር ({TELEBIRR.join(', ')}) ወይም በንግድ ባንክ (1000795392347 — ተስፋይ ኣለም ገብረ) ሙሉ ደረሰኝ በማስገባት ገቢ (Deposit) ማድረግ ትችላላችሁ። iPhone የምትጠቀሙ ደንበኞች Google Chrome ላይ www.bingo1020.com በመፈለግ መጠቀም ትችላላችሁ።</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['ዋጋ', `${formatAmount(lang, cardPrice)} ETB`],
              ['የጨዋታ ብዛት', String(cards.length)],
              ['ዋና ሽልማት', '65,000 ETB'],
              ['በማሰርያ ሽልማት', '8,000 ETB'],
            ].map(([label, value]) => (
              <div key={label} className={`rounded-xl border p-3 ${light ? 'border-amber-200 bg-white' : 'border-gold-700/30 bg-black/25'}`}>
                <p className={`text-[11px] ${muted}`}>{label}</p><p className={`mt-1 text-sm font-black tabular-nums ${title}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm ${light ? 'border-amber-200 bg-white' : 'border-gold-700/30 bg-black/25'}`}>
            <span className={muted}>ዙር #{roundNumber} · {phase === 'running' ? 'በጨዋታ ላይ' : phase === 'waiting' ? 'በመጠባበቅ ላይ' : 'ተጠናቋል'}</span>
            <strong className={title}>{calledNumbers.length} / 75 ኳሶች</strong>
          </div>
          <div className="space-y-1.5">
            {['B','I','N','G','O'].map((letter, i) => (
              <div key={letter} className="grid grid-cols-[1.4rem_repeat(15,minmax(0,1fr))] items-center gap-1 rounded-lg border border-gold-700/30 bg-black/25 p-1">
                <span className="text-center text-xs font-black text-gold-300">{letter}</span>
                {Array.from({length:15},(_,j)=>i*15+j+1).map((n)=>(<span key={n} className={["grid h-6 min-w-0 place-items-center rounded text-[9px] font-semibold tabular-nums",calledNumbers.includes(n) ? "border border-white bg-blue-600 text-white" : "bg-white/[0.035] text-gold-600"].join(" ")}>{n}</span>))}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-xl border border-gold-700/30 bg-black/25 px-3 py-3">
            <div><p className="text-xs text-gold-600">አካውንት ቀሪ ሂሳብ</p><p className="text-xl font-black text-gold-300">{formatAmount(lang, balance)} <span className="text-xs">ETB</span></p></div>
            <div className="text-right"><p className="text-xs text-gold-600">ጠቅላላ ካርቴላ</p><p className="text-xl font-black text-gold-300">{cards.length}</p></div>
          </div>
        </div>
      </div>

      <div className={`overflow-hidden rounded-2xl border ${panel}`}>
        {rows.map((row) => (
          <div key={row.id} className="border-b border-current/10 last:border-0">
            <button type="button" onClick={() => toggle(row.id)} aria-expanded={expanded === row.id} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left">
              <span className="flex items-center gap-3 font-semibold"><span className={`grid h-9 w-9 place-items-center rounded-xl ${light ? 'bg-amber-100 text-amber-800' : 'bg-gold-500/10 text-gold-300'}`}>{row.icon}</span>{row.label}</span>
              <span className={muted}>{expanded === row.id ? '−' : '+'}</span>
            </button>
            {expanded === row.id && (
              <div className="space-y-3 px-4 pb-4">
                {row.id === 'messages' && <p className={`text-sm ${muted}`}>የአስተዳዳሪ መልዕክቶች የሚታዩበት ክፍል።</p>}
                {row.id === 'wallet' && <button type="button" onClick={onGoToWallet} className="w-full rounded-xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-bold text-zinc-950">ወደ አካውንት ሂድ — ማስገባት / ማውጣት / የግብይት ታሪክ</button>}
                {row.id === 'gameHistory' && <p className={`text-sm ${muted}`}>የቀደሙ ዙሮች ታሪክ በBackend ላይ ስላልተቀመጠ አሁን ማሳየት አይቻልም።</p>}
                {row.id === 'settings' && (
                  <div className="space-y-4 text-sm">
                    <div><p className={`mb-2 font-semibold ${title}`}>ገጽታ</p><div className="flex gap-2"><button type="button" onClick={() => setPlayerTheme('light')} aria-pressed={light} className={`rounded-lg border px-4 py-2 ${light ? 'border-amber-500 bg-amber-100 text-amber-900' : 'border-current/20'}`}>ብርሃን</button><button type="button" onClick={() => setPlayerTheme('dark')} aria-pressed={!light} className={`rounded-lg border px-4 py-2 ${!light ? 'border-amber-400 bg-zinc-900 text-amber-200' : 'border-current/20'}`}>ጨለማ</button></div></div>
                    <label className="flex items-center justify-between gap-3"><span>ድምጽ ውጤቶች</span><input type="checkbox" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} /></label>
                    <label className="flex items-center justify-between gap-3"><span>የቁጥር ድምጽ</span><input type="checkbox" checked={voiceEnabled} onChange={(e) => setVoiceEnabled(e.target.checked)} /></label>
                    <label className="block"><span className="mb-2 block">የድምጽ መጠን</span><input type="range" min="0" max="1" step="0.05" value={audioVolume} onChange={(e) => setAudioVolume(Number(e.target.value))} className="w-full accent-yellow-500" /></label>
                    <div><p className={`mb-2 font-semibold ${title}`}>ቋንቋ</p><div className="flex flex-wrap gap-2">{[['am','አማርኛ'],['ti','ትግርኛ'],['en','English']].map(([id,label]) => <button key={id} type="button" onClick={() => setLang(id as 'am'|'ti'|'en')} aria-pressed={lang === id} className={`rounded-lg border px-3 py-2 ${lang === id ? 'border-amber-400 bg-amber-400/15' : 'border-current/20'}`}>{label}</button>)}</div></div>
                    <label className="flex items-center justify-between gap-3"><span>ማሳወቂያዎች</span><input type="checkbox" checked={notifications} onChange={(e) => void enableNotifications(e.target.checked)} /></label>
                    {'Notification' in window && Notification.permission === 'denied' && <p className="text-xs text-amber-600">ማሳወቂያ በbrowser ቅንብርዎ ተዘግቷል። በጣቢያ ቅንብሮች ውስጥ ይፍቀዱ።</p>}
                    <p className={`text-xs ${muted}`}>ካርቴላ ካስመዘገቡ ብቻ ማሳወቂያ ለማግኘት የbrowser ፈቃድ ያስፈልጋል።</p>
                  </div>
                )}
                {row.id === 'contact' && <div className="space-y-2 text-sm"><p className={title}>ስልክ</p>{TELEBIRR.map((phone) => <a key={phone} href={`tel:${phone}`} className="block font-mono text-amber-500 underline">{phone}</a>)}<p className={`pt-2 ${muted}`}>Telegram · TikTok</p></div>}
                {row.id === 'rules' && <ol className={`list-decimal space-y-2 pl-5 text-sm leading-6 ${muted}`}>{RULES.map((rule) => <li key={rule}>{rule}</li>)}</ol>}
                {row.id === 'app' && <div className="text-sm"><p className={title}>የAndroid መተግበሪያ አውርድ</p><p className={`mt-1 text-xs ${muted}`}>የማውረጃ አገናኝ ሲገኝ ከዚህ ይቀርባል።</p></div>}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="pb-2 text-center text-xs text-gold-700">Black Gold Bingo · ደንበኛ አገልግሎት</p>
    </section>
  );
}
