import { useState } from 'react';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useLanguage } from '@/context/LanguageContext';
import { usePlayer } from '@/context/PlayerContext';
import { useRound } from '@/context/RoundContext';
import { formatAmount, formatDateTime } from '@/lib/localization';
import { patternMasks } from '@/lib/bingo';
import type { WinPattern } from '@/types/game';
import { SERVER_MODE } from '@/lib/api';

type PatternOption = { label: string; cells: number[] };
const PATTERN_LABELS: Record<string,string> = {
  any_line:'አንድ መስመር', horizontal_line:'አግድም መስመር', vertical_line:'ቁመት መስመር',
  diagonal:'ዲያጎናል', two_lines:'ሁለት መስመሮች', two_horizontal_lines:'ሁለት አግድም መስመሮች',
  four_corners:'አራቱ ማዕዘኖች', rectangle:'2×2 ሬክታንግል', two_rectangles:'ሁለት ሬክታንግሎች',
  half_house:'ግማሽ ቤት (12 ቁጥሮች)', full_house:'ሙሉ ካርድ', x:'X ቅርጽ',
  t:'T ቅርጽ', l:'L ቅርጽ', plus:'ፕላስ (+)', diamond:'ዳይመንድ',
  picture_frame:'ውጫዊ ፍሬም', six_pack:'Six-pack', postage_stamp:'Postage stamp',
  three_lines:'ሶስት መስመሮች', four_lines:'አራት መስመሮች',
  top_bottom:'ላይኛውና ታችኛው መስመር', left_right:'ግራና ቀኝ መስመሮች',
  checkerboard:'ቼከርቦርድ', center_cross:'መካከለኛ መስቀል', coverall:'ሙሉ ካርድ',
};
function getPatternOptions(pattern: WinPattern): PatternOption[] {
  const masks = pattern === 'half_house'
    ? [Array.from({length:25},(_,i)=>i).filter(i=>i!==12).slice(0,12).map(i=>[Math.floor(i/5),i%5] as [number,number])]
    : patternMasks(pattern);
  // Large combinatorial patterns are sampled evenly; every thumbnail is still a real backend rule mask.
  const stride = Math.max(1, Math.ceil(masks.length / 12));
  const samples = masks.filter((_,i)=>i%stride===0).slice(0,12);
  return samples.map((mask,index)=>({
    label: masks.length===1 ? (PATTERN_LABELS[pattern] ?? pattern.replace(/_/g, ' ')) : `${PATTERN_LABELS[pattern] ?? pattern.replace(/_/g, ' ')} · ${index+1}`,
    cells: mask.map(([r,c])=>r*5+c),
  }));
}
const RULES = [
  'ካርቴላ ለመግዛት በአካውንትዎ በቂ ቀሪ ሂሳብ ሊኖር ይገባል።',
  'የጨዋታ ቁጥሮችን በጥንቃቄ ይከታተሉ፤ የወጣ ቁጥር ብቻ በካርቴላዎ ላይ ምልክት ያድርጉ።',
  'BINGO ሲሞላ የBINGO ጥያቄ ያቅርቡ፤ የአሸናፊነት ማረጋገጫ በስርዓቱ ይከናወናል።',
  'የገንዘብ ግብይት ማስረጃዎን ሙሉ በሙሉ ያስገቡ።',
];

export function PlayerFeatures({ onGoToWallet, settingsOnly = false }: { onGoToWallet: () => void; settingsOnly?: boolean }) {
  const { lang, setLang } = useLanguage();
  const { balance, cards, transactions } = usePlayer();
  const { cardPrice, audioVolume, setAudioVolume } = useAppSettings();
  const { calledNumbers, roundNumber, phase, winner, winPattern, roundPrizeEtb, roundCardCount } = useRound();
  const { soundEnabled, setSoundEnabled, voiceEnabled, setVoiceEnabled } = useAppSettings();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return localStorage.getItem('bgb.playerTheme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
  });
  const [notifications, setNotifications] = useState(() => {
    try { return localStorage.getItem('bgb.playerNotifications') === 'on'; } catch { return false; }
  });
  const [expanded, setExpanded] = useState<string | null>(settingsOnly ? 'settings' : null);
  const [historyExpanded, setHistoryExpanded] = useState<'wallet' | 'game' | null>(null);
  const [showPatternOptions, setShowPatternOptions] = useState(false);
  const [selectedPatternOption, setSelectedPatternOption] = useState(0);
  const light = theme === 'light';
  const patternNames = PATTERN_LABELS;
  const patternOptions = getPatternOptions(winPattern);
  const activePatternOption = patternOptions[selectedPatternOption % patternOptions.length] ?? patternOptions[0];
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
    { id: 'settings', label: 'ሴቲንግ', icon: '⚙' },
    { id: 'contact', label: 'ያግኙን', icon: '☎' },
    { id: 'rules', label: 'የጨዋታ ደንቦችና ሕጎች', icon: '▤' },
    { id: 'app', label: 'መተግበሪያ', icon: '▣' },
  ];

  return (
    <section className="mt-6 space-y-4" aria-label="Player information and settings">
      {settingsOnly && <h2 className="text-lg font-black text-gold-300">⚙ ሴቲንግ</h2>}
      {!settingsOnly && <div className={`overflow-hidden rounded-2xl border ${panel} shadow-xl`}>
        <div className="relative overflow-hidden bg-gradient-to-r from-zinc-950 via-zinc-900 to-amber-950 px-4 py-5 sm:px-6">
          <div className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full border-[18px] border-amber-300/10" />
          <div className="relative flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.28em] text-amber-300">BLACK GOLD BINGO</p>
              <h2 className="mt-1 text-xl font-black text-amber-100 sm:text-2xl">የአሁኑ ዙር የBingo ዓይነት</h2>
              <p className="mt-1 text-base font-extrabold text-amber-300">{patternNames[winPattern] ?? winPattern.replace(/_/g, ' ')}</p>
              <p className="mt-1 text-xs text-amber-200/70">ዙር #{roundNumber} · {phase === 'running' ? 'በጨዋታ ላይ' : phase === 'waiting' ? 'በመጠባበቅ ላይ' : 'ተጠናቋል'}</p>
            </div>
            <button type="button" onClick={() => setShowPatternOptions(true)} aria-label="የሚቻሉ የአሸናፊነት ቅርጾችን አሳይ" className="group shrink-0 rounded-2xl border border-amber-300/50 bg-black/40 p-2 text-left shadow-lg shadow-amber-900/30 focus:outline-none focus:ring-2 focus:ring-amber-300">
              <span className="grid h-16 w-16 grid-cols-5 gap-1 sm:h-20 sm:w-20" aria-hidden="true">{Array.from({length:25},(_,i)=><span key={i} className={`rounded-[2px] ${activePatternOption.cells.includes(i)?'bg-sky-400 ring-1 ring-white/80':'bg-white/10'}`}/>)}</span>
              <span className="mt-1 block text-center text-[9px] font-bold text-amber-200">ሊነካ ይችላል · ዝርዝር</span>
            </button>
          </div>
        </div>
        {showPatternOptions && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="የBingo አሸናፊነት ቅርጾች">
          <div className="max-h-[82vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-amber-400/50 bg-zinc-950 p-4 text-amber-50 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-base font-black text-amber-200">የሚቻሉ የአሸናፊነት ቅርጾች</h3><p className="mt-1 text-xs text-amber-100/60">{patternNames[winPattern] ?? winPattern.replace(/_/g, ' ')} · {patternOptions.length} አማራጮች</p></div><button type="button" onClick={() => setShowPatternOptions(false)} className="rounded-lg border border-amber-300/30 px-3 py-2 text-sm font-bold">ዝጋ ✕</button></div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{patternOptions.map((option,index)=><button key={option.label} type="button" onClick={()=>setSelectedPatternOption(index)} aria-pressed={selectedPatternOption===index} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${selectedPatternOption===index?'border-sky-300 bg-sky-950/60':'border-amber-900 bg-black/30'}`}>
              <span className="grid h-14 w-14 shrink-0 grid-cols-5 gap-0.5 rounded-lg bg-black p-1">{Array.from({length:25},(_,i)=><span key={i} className={`rounded-[1px] ${option.cells.includes(i)?'bg-sky-400':'bg-white/10'}`}/>)}</span><span className="text-xs font-bold leading-5">{option.label}{selectedPatternOption===index&&<span className="mt-1 block text-[10px] text-sky-300">የተመረጠ ማሳያ</span>}</span>
            </button>)}</div><p className="mt-3 text-[11px] leading-5 text-amber-100/60">እነዚህ የሚቻሉ የአሸናፊነት ቅርጾች ምሳሌዎች ናቸው፤ ትክክለኛው ማረጋገጫ በስርዓቱ ይከናወናል።</p>
          </div></div>}
        <div className="space-y-2 p-3 sm:p-4">
          <div className="flex items-center gap-2"><span className="text-lg">ⓘ</span><h3 className={`font-bold ${title}`}>መረጃ</h3></div>
          <p className={`text-xs leading-5 ${muted}`}>በቴሌብር (0978202822 — ኣሊክሳንደር ደጀን) ወይም በንግድ ባንክ (1000737138686 — ቤተሊሄም ፍጹም) ሙሉ ደረሰኝ በማስገባት ገቢ (Deposit) ማድረግ ትችላላችሁ። iPhone የምትጠቀሙ ደንበኞች Google Chrome ላይ www.blackgoldbingo.com በመፈለግ መጠቀም ትችላላችሁ። <strong>☎ ያግኙን</strong> − ተጨማሪ መረጃ ከፈለጉ 0978202822 ወይም 0998974422 ይደዉሉ።</p>
          <div className="mb-2 flex justify-end"><button type="button" onClick={() => toggle('history')} aria-expanded={expanded === 'history'} className="rounded-xl border border-amber-400/40 bg-black/35 px-4 py-2 text-xs font-bold text-amber-200 shadow-lg hover:bg-amber-400/10">▤ ታሪክ <span className="ml-2">{expanded === 'history' ? '−' : '+'}</span></button></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {[
              ['ዋጋ', `${formatAmount(lang, cardPrice)} ETB`],
              ['የዙሩ የተሸጡ ካርዶች', SERVER_MODE && roundCardCount !== undefined ? String(roundCardCount) : '—'],
              ['የአሁኑ ዋና ሽልማት', SERVER_MODE && roundPrizeEtb !== undefined ? `${formatAmount(lang, roundPrizeEtb)} ETB` : '—'],
              ['አካውንት ቀሪ ሂሳብ', `${formatAmount(lang, balance)} ETB`],
              ['ጠቅላላ ካርቴላ', String(cards.length)],
            ].map(([label, value]) => (
              <div key={label} className={`rounded-lg border p-2 ${light ? 'border-amber-200 bg-white' : 'border-gold-700/30 bg-black/25'}`}>
                <p className={`text-[10px] leading-4 ${muted}`}>{label}</p><p className={`mt-0.5 text-xs font-black tabular-nums ${title}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm ${light ? 'border-amber-200 bg-white' : 'border-gold-700/30 bg-black/25'}`}>
            <span className={muted}>የዙሩ ሁኔታ</span>
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

          {expanded === 'history' && <div className="space-y-2 rounded-xl border border-amber-400/25 bg-black/25 p-3">
            <button type="button" onClick={() => setHistoryExpanded(v => v === 'wallet' ? null : 'wallet')} aria-expanded={historyExpanded === 'wallet'} className="flex w-full items-center justify-between rounded-lg border border-gold-700/30 px-3 py-3 text-left text-sm font-semibold text-gold-200">◈ ማስገባት · ማውጣት · የግብይት ታሪክ <span>{historyExpanded === 'wallet' ? '−' : '+'}</span></button>
            {historyExpanded === 'wallet' && <div className="space-y-2 px-2 py-1">
              {(transactions ?? []).length === 0 ? <p className="py-3 text-center text-xs text-gold-600">ገና የግብይት ታሪክ የለም።</p> : (transactions ?? []).slice().sort((a,b)=>b.at-a.at).map(tx => <div key={tx.id} className="flex items-center justify-between gap-3 border-b border-gold-700/20 py-2 text-xs"><div className="min-w-0"><p className="font-semibold text-gold-200">{tx.label ?? (tx.kind === 'deposit' ? 'ማስገባት' : 'ካርድ ግዢ')}</p><p className="text-[10px] text-gold-700">{formatDateTime(lang, tx.at)}</p></div><strong className={tx.amount >= 0 ? 'shrink-0 text-emerald-300' : 'shrink-0 text-amber-300'}>{tx.amount >= 0 ? '+' : '−'}{formatAmount(lang, Math.abs(tx.amount))} ETB</strong></div>)}
              <button type="button" onClick={onGoToWallet} className="w-full rounded-lg bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-200">ወደ ቦርሳ ዝርዝር ሂድ</button>
            </div>}
            <button type="button" onClick={() => setHistoryExpanded(v => v === 'game' ? null : 'game')} aria-expanded={historyExpanded === 'game'} className="flex w-full items-center justify-between rounded-lg border border-gold-700/30 px-3 py-3 text-left text-sm font-semibold text-gold-200">◷ የጨዋታ ታሪክ <span>{historyExpanded === 'game' ? '−' : '+'}</span></button>
            {historyExpanded === 'game' && <p className="px-3 py-3 text-xs leading-5 text-gold-600">የቀደሙ ዙሮች ዝርዝር በBackend ላይ ስላልተቀመጠ አሁን ማሳየት አይቻልም።</p>}
          </div>}
        </div>
      </div>}
      <div className={`overflow-hidden rounded-2xl border ${panel}`}>
        {rows.filter(row => settingsOnly ? row.id === 'settings' : row.id !== 'settings').map((row) => (
          <div key={row.id} className="border-b border-current/10 last:border-0">
            <button type="button" onClick={() => toggle(row.id)} aria-expanded={expanded === row.id} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left">
              <span className="flex items-center gap-3 font-semibold"><span className={`grid h-9 w-9 place-items-center rounded-xl ${light ? 'bg-amber-100 text-amber-800' : 'bg-gold-500/10 text-gold-300'}`}>{row.icon}</span>{row.label}</span>
              <span className={muted}>{expanded === row.id ? '−' : '+'}</span>
            </button>
            {expanded === row.id && (
              <div className="space-y-3 px-4 pb-4">
                {row.id === 'messages' && <p className={`text-sm ${muted}`}>የአስተዳዳሪ መልዕክቶች የሚታዩበት ክፍል።</p>}
                {row.id === 'wallet' && <button type="button" onClick={onGoToWallet} className="w-full rounded-xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-bold text-zinc-950">ወደ አካውንት ሂድ — ማስገባት / ማውጣት</button>}
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
                {row.id === 'rules' && <ol className={`list-decimal space-y-2 pl-5 text-sm leading-6 ${muted}`}>{RULES.map((rule) => <li key={rule}>{rule}</li>)}</ol>}
                
              </div>
            )}
          </div>
        ))}
      </div>
      {!settingsOnly && <p className="pb-2 text-center text-xs text-gold-700">Black Gold Bingo · ደንበኛ አገልግሎት</p>}
    </section>
  );
}
