import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import type { Lang } from '@/types/game';

type Ticket = { id: string; numbers: number[]; matchedNumbers: number[]; status: 'active' | 'locked' | 'winner'; lockedAt: number | null };
type State = {
  settings: { enabled: boolean; target: number; ticketPriceEtb: number; prizeEtb: number; drawIntervalSeconds: number; roundDurationSeconds: number; roundType: string; mode?: 'automatic' | 'admin'; maxTicketsPerPlayer: number };
  game: null | { id: string; status: 'waiting' | 'running' | 'ended'; target: number; drawnNumbers: number[]; lastNumber: number | null; winner: { userId: string; ticketId: string; at: number; prizeEtb?: number } | null; ticketCount: number; roundType?: string; prizeEtb?: number; endsAt?: number | null; registrationEndsAt?: number | null; registrationSecondsLeft?: number | null };
  tickets: Ticket[];
  balanceEtb: number | null;
  balanceType: 'SIMULATION_ONLY';
};

const copy = {
  am: {
    back:'← ወደ ጨዋታዎች', live:'ቀጥታ · የሙከራ ክሬዲት', title:'ትርቦ ቢንጎ', subtitle:'80 ኳሶች · ትክክለኛ የድል ቁጥር · የመጀመሪያው ትክክለኛ አሸናፊ', running:'በመጫወት ላይ', endedStatus:'ተጠናቋል', quick:'ፈጣን', standard:'መደበኛ', full_house:'ሙሉ ካርድ', custom:'ብጁ',
    status:'የጨዋታ ሁኔታ', target:'የድል ቁጥር', called:'የወጡ ቁጥሮች', latest:'የመጨረሻ ቁጥር', round:'የዙር አይነት', prize:'የአሸናፊ ሽልማት', time:'የቀረ ጊዜ',
    machine:'ቀጥታ የቁጥር ማውጫ', soundOn:'ድምፅ አብራ', soundOff:'ድምፅ አጥፋ', cage:'GLASS BINGO CAGE', mixing:'ኳሶች እየተዞሩ ነው', waiting:'በመጠበቅ ላይ', lastBall:'የመጨረሻ የወጣ ኳስ', inventory:'በማሽኑ ውስጥ ያሉ ኳሶች', balls:'ኳሶች',
    lastFive:'የመጨረሻ 5 የተጠሩ ቁጥሮች', countdown:'ቆጣሪ', wallet:'የሙከራ ቦርሳ', demo:'ሊወጣ የማይችል የሙከራ ክሬዲት ብቻ', purchase:'ካርድ መግዣ', price:'የአንድ ካርድ ዋጋ', quantity:'የካርድ ብዛት', buy:'ግዛና መዝግብ', busy:'ቆይ…', salesClosed:'አዲስ ዙር ሲከፈት ካርድ መግዛት ይቻላል።',
    tickets:'የተመዘገቡ ካርዶቼ', noTickets:'ለዚህ ጨዋታ ካርድ አልተመዘገበም።', matched:'የተዛመዱ', bingo:'ቢንጎ!', active:'ንቁ', locked:'ተቆልፏል', winner:'አሸናፊ', ended:'ጨዋታው ተጠናቋል', winnerTitle:'አሸናፊው ተረጋግጧል', endedNoWinner:'ዙሩ ያለ ትክክለኛ የድል ጥያቄ ተጠናቋል',
    buySuccess:'ካርዶችህ ተመዝግበዋል።', claimSuccess:'ቢንጎ! ድልህ ተረጋግጧል።', errorLoad:'Turbo Bingo መጫን አልተቻለም።', errorBuy:'ካርድ መግዛት አልተሳካም።', errorClaim:'የቢንጎ ጥያቄው አልተረጋገጠም።', simulation:'Turbo Bingo በአሁኑ ጊዜ የሙከራ ጨዋታ ነው። ክሬዲቶቹ እውነተኛ ገንዘብ አይደሉም።', choose:'ቋንቋ'
  },
  ti: {
    back:'← ናብ ጸወታታት', live:'ቀጥታ · ናይ ፈተነ ክሬዲት', title:'ትርቦ ቢንጎ', subtitle:'80 ኩዕሶታት · ቅኑዕ ቁጽሪ ዓወት · ቀዳማይ ቅኑዕ ዓዋቲ', running:'ይካየድ ኣሎ', endedStatus:'ተወዲኡ', quick:'ቅልጡፍ', standard:'ስሩዕ', full_house:'ምሉእ ካርድ', custom:'ፍሉይ',
    status:'ኩነታት ጸወታ', target:'ቁጽሪ ዓወት', called:'ዝወጹ ቁጽሪታት', latest:'ናይ መወዳእታ ቁጽሪ', round:'ዓይነት ዙር', prize:'ሽልማት ዓዋቲ', time:'ዝተረፈ ግዜ',
    machine:'ቀጥታዊ መውጽኢ ቁጽሪ', soundOn:'ድምጺ ኣብርህ', soundOff:'ድምጺ ኣጥፍእ', cage:'GLASS BINGO CAGE', mixing:'ኩዕሶታት ይዘውራ ኣለዋ', waiting:'ይጽበ ኣሎ', lastBall:'ናይ መወዳእታ ዝወጸት ኩዕሶ', inventory:'ኣብ ማሽን ዘለዋ ኩዕሶታት', balls:'ኩዕሶታት',
    lastFive:'ናይ መወዳእታ 5 ዝተጸውዑ ቁጽሪታት', countdown:'ቆጸራ', wallet:'ናይ ፈተነ ቦርሳ', demo:'ክወጽእ ዘይክእል ናይ ፈተነ ክሬዲት ጥራይ', purchase:'መግዝኢ ካርድ', price:'ዋጋ ሓደ ካርድ', quantity:'ብዝሒ ካርድ', buy:'ግዝእን መዝግብን', busy:'ተጸበ…', salesClosed:'ሓድሽ ዙር ምስ ተኸፍተ ካርድ ምግዛእ ይከኣል።',
    tickets:'ዝተመዝገቡ ካርዳተይ', noTickets:'ንዚ ጸወታ ዝተመዝገበ ካርድ የለን።', matched:'ዝተሰማምዑ', bingo:'ቢንጎ!', active:'ንጡፍ', locked:'ተዓጽዩ', winner:'ዓዋቲ', ended:'ጸወታ ተወዲኡ', winnerTitle:'ዓዋቲ ተረጋጊጹ', endedNoWinner:'ዙር ብዘይ ቅኑዕ ሕቶ ዓወት ተወዲኡ',
    buySuccess:'ካርዳትካ ተመዝጊቦም።', claimSuccess:'ቢንጎ! ዓወትካ ተረጋጊጹ።', errorLoad:'Turbo Bingo ምጽዓን ኣይተኻእለን።', errorBuy:'ካርድ ምግዛእ ኣይተሳኸዐን።', errorClaim:'ሕቶ ቢንጎ ኣይተረጋገጸን።', simulation:'Turbo Bingo ሕጂ ናይ ፈተነ ጸወታ እዩ። ክሬዲታት ሓቀኛ ገንዘብ ኣይኮኑን።', choose:'ቋንቋ'
  },
  en: {
    back:'← Games', live:'LIVE · DEMO CREDITS', title:'TURBO BINGO', subtitle:'80 balls · Exact winning target · First valid winner', running:'RUNNING', endedStatus:'ENDED', quick:'QUICK', standard:'STANDARD', full_house:'FULL HOUSE', custom:'CUSTOM',
    status:'GAME STATUS', target:'WINNING TARGET', called:'NUMBERS CALLED', latest:'LATEST NUMBER', round:'ROUND TYPE', prize:'WINNER PRIZE', time:'TIME LEFT',
    machine:'LIVE NUMBER DRAW', soundOn:'SOUND ON', soundOff:'SOUND OFF', cage:'GLASS BINGO CAGE', mixing:'● MIXING', waiting:'WAITING', lastBall:'LAST BALL', inventory:'BALLS IN THE CAGE', balls:'balls',
    lastFive:'LAST 5 CALLED BALLS', countdown:'Countdown', wallet:'DEMO WALLET', demo:'Non-withdrawable demo credits only', purchase:'TICKET PURCHASE', price:'Price per ticket', quantity:'Number of tickets', buy:'BUY & REGISTER', busy:'Please wait…', salesClosed:'Ticket sales open when a new round is opened.',
    tickets:'MY REGISTERED TICKETS', noTickets:'No tickets registered for this game yet.', matched:'matched', bingo:'BINGO!', active:'active', locked:'locked', winner:'winner', ended:'GAME ENDED', winnerTitle:'WINNER CONFIRMED', endedNoWinner:'This round ended without a valid winning claim.',
    buySuccess:'Your tickets were registered.', claimSuccess:'BINGO! Your win has been verified.', errorLoad:'Unable to load Turbo Bingo.', errorBuy:'Ticket purchase failed.', errorClaim:'Bingo claim could not be verified.', simulation:'Turbo Bingo is currently simulation-only. Demo credits have no cash value and cannot be withdrawn.', choose:'Language'
  }
} satisfies Record<Lang, Record<string, string>>;

const money = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ballPaint = [
  'radial-gradient(circle at 30% 24%,#fff,#fb7185 26%,#be123c 78%)',
  'radial-gradient(circle at 30% 24%,#fff,#60a5fa 26%,#1d4ed8 78%)',
  'radial-gradient(circle at 30% 24%,#fff,#4ade80 26%,#15803d 78%)',
  'radial-gradient(circle at 30% 24%,#fff,#c084fc 26%,#7e22ce 78%)',
  'radial-gradient(circle at 30% 24%,#fff,#facc15 26%,#b45309 78%)',
  'radial-gradient(circle at 30% 24%,#fff,#67e8f9 26%,#92400e 78%)'
];

export function TurboBingoGame({ onBack }: { onBack: () => void }) {
  const { lang, setLang } = useLanguage();
  const t: Record<string, string> = copy[lang];
  const [state, setState] = useState<State | null>(null);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [extractedNumber, setExtractedNumber] = useState<number | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const refresh = useCallback(async () => {
    try { setState(await api.get<State>('/api/games/turbo-bingo/state')); setError(''); }
    catch { setError(t.errorLoad); }
  }, [t.errorLoad]);

  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => void refresh(), 5000);
    const stream = new EventSource('/api/stream');
    stream.addEventListener('turbo-bingo', () => void refresh());
    return () => { window.clearInterval(poll); stream.close(); };
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const drawnNumbers = state?.game?.drawnNumbers ?? [];
  const drawn = useMemo(() => new Set(drawnNumbers), [drawnNumbers]);
  const lastNumber = state?.game?.lastNumber ?? null;
  const secondsLeft = state?.game?.status === 'waiting' && state.game.registrationEndsAt
    ? Math.max(0, Math.ceil((state.game.registrationEndsAt - clock) / 1000))
    : null;

  const toggleMachineSound = async () => {
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
    if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
    setSoundEnabled((enabled) => !enabled);
  };

  useEffect(() => {
    const context = audioContextRef.current;
    if (!soundEnabled || state?.game?.status !== 'running' || !context) return;
    // Filtered white noise creates a continuous blower / rushing-air sound.
    const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++) channel[i] = (Math.random() * 2 - 1) * 0.7;
    const blower = context.createBufferSource(); blower.buffer = noiseBuffer; blower.loop = true;
    const highPass = context.createBiquadFilter(); highPass.type = 'highpass'; highPass.frequency.value = 95;
    const lowPass = context.createBiquadFilter(); lowPass.type = 'lowpass'; lowPass.frequency.value = 820;
    const airGain = context.createGain(); airGain.gain.value = 0.34;
    const pulse = context.createOscillator(); pulse.type = 'sine'; pulse.frequency.value = 3.8;
    const pulseDepth = context.createGain(); pulseDepth.gain.value = 0.10;
    pulse.connect(pulseDepth); pulseDepth.connect(airGain.gain);
    blower.connect(highPass); highPass.connect(lowPass); lowPass.connect(airGain); airGain.connect(context.destination);
    blower.start(); pulse.start();
    return () => { blower.stop(); pulse.stop(); airGain.disconnect(); };
  }, [soundEnabled, state?.game?.status]);

  useEffect(() => {
    if (lastNumber === null) return;
    if (soundEnabled && audioContextRef.current) {
      const context = audioContextRef.current;
      const now = context.currentTime;
      const drop = context.createOscillator();
      const gain = context.createGain();
      drop.type = 'sawtooth';
      drop.frequency.setValueAtTime(420, now);
      drop.frequency.exponentialRampToValueAtTime(72, now + 0.34);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.65, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      drop.connect(gain); gain.connect(context.destination); drop.start(now); drop.stop(now + 0.44);
    }
    setExtractedNumber(lastNumber);
    const timeout = window.setTimeout(() => setExtractedNumber(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [lastNumber, soundEnabled]);

  // The full 1–80 inventory is visual only. Actual calls always come from the server state.
  const cageBalls = useMemo(() => Array.from({ length: 80 }, (_, index) => index + 1)
    .filter((number) => !drawn.has(number))
    .map((number, index, remaining) => {
      const angle = index * 2.399963229728653;
      const radius = 13 + (index % 5) * 2.7;
      return {
        number,
        left: 50 + Math.cos(angle) * radius,
        top: 50 + Math.sin(angle) * radius * 0.78,
        delay: -((index * 0.173) % 4.8),
        color: ballPaint[number % ballPaint.length],
        size: remaining.length > 55 ? 27 : 31
      };
    }), [drawn]);

  const buy = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      await api.post('/api/games/turbo-bingo/tickets', { count });
      setNotice(t.buySuccess);
      await refresh();
    } catch { setError(t.errorBuy); }
    finally { setBusy(false); }
  };

  const claim = async (ticketId: string) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await api.post('/api/games/turbo-bingo/claim', { ticketId });
      setNotice(t.claimSuccess);
      await refresh();
    } catch { setError(t.errorClaim); await refresh(); }
    finally { setBusy(false); }
  };

  const canBuy = state?.settings.enabled && state.game?.status === 'waiting';
  const langNames: Record<Lang, string> = { am: 'አማርኛ', ti: 'ትግርኛ', en: 'English' };

  return (
    <main className="turbo-player mx-auto min-h-screen w-full max-w-6xl space-y-4 bg-[#09090b] px-3 pb-28 pt-3 text-white sm:px-5 sm:pt-5">
      <style>{`
        @keyframes turbo-ball-float { 0%,100% { transform:translate(0,0) rotate(0); } 12% { transform:translate(22px,-24px) rotate(75deg); } 27% { transform:translate(-26px,17px) rotate(-95deg); } 43% { transform:translate(18px,29px) rotate(125deg); } 59% { transform:translate(-30px,-18px) rotate(-145deg); } 76% { transform:translate(25px,-28px) rotate(190deg); } 90% { transform:translate(-15px,20px) rotate(-225deg); } }
        @keyframes turbo-ball-exit { 0% { opacity:0; transform:translate(-50%,185px) scale(.48) rotate(-100deg); } 10% { opacity:1; } 34% { opacity:1; transform:translate(-50%,-42px) scale(1.22) rotate(150deg); } 48% { transform:translate(-50%,-66px) scale(1.12) rotate(245deg); } 63% { opacity:1; transform:translate(-50%,8px) scale(1.08) rotate(330deg); } 82% { opacity:1; transform:translate(-50%,150px) scale(1) rotate(470deg); } 100% { opacity:0; transform:translate(-50%,225px) scale(.82) rotate(560deg); } }
        .turbo-ball-float { animation:turbo-ball-float .48s ease-in-out infinite; will-change:transform; }
        .turbo-ball-exit { animation:turbo-ball-exit 1.65s cubic-bezier(.12,.72,.18,1) both; }
        @media(prefers-reduced-motion:reduce) { .turbo-ball-float,.turbo-ball-exit { animation:none!important; } }
      `}</style>

      <header className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200/20 bg-[#111111] px-3 py-3 shadow-lg sm:px-5">
        <button type="button" onClick={onBack} className="rounded-xl border border-white/20 px-3 py-2 text-xs font-bold text-amber-50 hover:bg-white/10 sm:text-sm">{t.back}</button>
        <div className="min-w-0 text-center"><p className="text-[9px] font-black tracking-[.2em] text-amber-200/70">BLACK GOLD GAME CENTER</p><h1 className="text-lg font-black tracking-wide sm:text-2xl">{t.title}</h1></div>
        <label className="flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-100/20 bg-black/20 px-2 py-2 text-[10px] font-bold text-white">
          <span className="sr-only">{t.choose}</span><select aria-label={t.choose} value={lang} onChange={(event) => setLang(event.target.value as Lang)} className="max-w-[92px] bg-transparent text-white outline-none sm:max-w-none">{(['am','ti','en'] as Lang[]).map((key) => <option key={key} value={key} className="bg-[#111111] text-white">{langNames[key]}</option>)}</select>
        </label>
      </header>

      <section className="rounded-2xl border border-amber-200/20 bg-gradient-to-br from-[#292929] via-[#111111] to-[#09090b] p-4 shadow-[0_12px_35px_rgba(0,0,0,.25)] sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-black tracking-[.24em] text-amber-200/75">TURBO BINGO · 1–80</p><span className="rounded-full border border-amber-200/25 bg-amber-300/10 px-3 py-1 text-[10px] font-bold text-amber-100">{t.live}</span></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {[
            [t.status, (state?.game?.status === 'running' ? t.running : state?.game?.status === 'ended' ? t.endedStatus : state?.game?.status === 'waiting' ? t.waiting : '—')],
            [t.target, String(state?.game?.target ?? state?.settings.target ?? '—')],
            [t.called, String(drawnNumbers.length)],
            [t.latest, String(lastNumber ?? '—')],
            [t.round, (t[String(state?.game?.roundType ?? state?.settings.roundType ?? '')] ?? String(state?.game?.roundType ?? state?.settings.roundType ?? '—').replace('_',' ').toUpperCase())],
            [t.prize, `${money(state?.game?.prizeEtb ?? state?.settings.prizeEtb ?? 0)} ETB`],
            [t.time, secondsLeft === null ? '—' : `${secondsLeft}s`]
          ].map(([label,value]) => <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-2.5"><p className="text-[9px] font-bold tracking-wide text-amber-100/60">{label}</p><p className="mt-1 truncate text-base font-black tabular-nums text-white sm:text-lg">{value}</p></div>)}
        </div>
      </section>

      <section aria-label={t.cage} className="overflow-hidden rounded-3xl border-2 border-[#d4af37] bg-gradient-to-b from-[#181818] via-[#09090b] to-[#050505] p-3 shadow-[0_14px_40px_rgba(0,0,0,.55)] sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div><p className="text-[10px] font-black tracking-[.22em] text-amber-200">{t.cage}</p><p className="mt-1 text-[10px] text-amber-100/70">{state?.game?.status === 'running' ? t.mixing : t.waiting}</p></div>
          <button type="button" onClick={() => void toggleMachineSound()} className="rounded-full border border-amber-100/30 bg-black/30 px-3 py-2 text-[10px] font-black text-white">{soundEnabled ? t.soundOff : t.soundOn}</button>
        </div>
        <div className="relative mx-auto w-full max-w-[560px] rounded-[2rem] border-[10px] border-[#d4af37] bg-gradient-to-b from-[#292929] via-[#111111] to-[#050505] p-3 shadow-[inset_0_3px_10px_rgba(255,255,255,.25),0_8px_0_#09090b,0_15px_28px_rgba(0,0,0,.5)]">
          <div className="pointer-events-none absolute inset-x-5 top-1 h-2 rounded-full bg-gradient-to-r from-transparent via-amber-200/80 to-transparent" />
          <div className="relative h-[290px] overflow-hidden rounded-[1.5rem] border-[5px] border-[#d4af37] bg-[radial-gradient(ellipse_at_50%_35%,rgba(255,255,255,.35),rgba(160,210,230,.16)_40%,rgba(5,12,24,.75)_100%)] shadow-[inset_0_0_30px_rgba(255,255,255,.28)] sm:h-[340px]">
            <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/30" />
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#09090b]/80 to-transparent" />
            {cageBalls.map((ball) => <span key={ball.number} className={state?.game?.status === 'running' ? 'turbo-ball-float absolute grid place-items-center rounded-full border border-white/70 text-[10px] font-black text-white shadow-[inset_2px_2px_4px_rgba(255,255,255,.8),inset_-3px_-4px_7px_rgba(0,0,0,.35),0_3px_7px_rgba(0,0,0,.45)]' : 'absolute grid place-items-center rounded-full border border-white/70 text-[10px] font-black text-white shadow-[inset_2px_2px_4px_rgba(255,255,255,.8),inset_-3px_-4px_7px_rgba(0,0,0,.35),0_3px_7px_rgba(0,0,0,.45)]'} style={{left:`${ball.left}%`,top:`${ball.top}%`,width:ball.size,height:ball.size,background:ball.color,animationDelay:`${ball.delay}s`}}>{ball.number}</span>)}
            {extractedNumber !== null && <div key={extractedNumber} className="turbo-ball-exit absolute left-1/2 top-1/2 z-20 grid h-16 w-16 place-items-center rounded-full border-[3px] border-white bg-[radial-gradient(circle_at_30%_25%,#fff,#fef3c7_24%,#b8860b_85%)] text-xl font-black text-white shadow-[0_0_25px_rgba(255,220,120,.9)]">{extractedNumber}</div>}
            <div className="pointer-events-none absolute inset-y-0 left-4 w-5 rotate-12 bg-gradient-to-r from-white/25 to-transparent blur-sm" />
          </div>
          <div className="mx-auto mt-3 flex h-7 w-3/4 items-center justify-center rounded-b-2xl border-x-4 border-b-4 border-[#d4af37] bg-gradient-to-b from-[#f59e0b] to-[#8a6418] shadow-lg"><span className="text-[9px] font-black tracking-[.3em] text-[#09090b]">TURBO BINGO</span></div>
          <div className="mt-3 flex items-center justify-center gap-2"><span className="h-2 w-2 rounded-full bg-[#d4af37] shadow-[0_0_8px_#fecaca]" /><span className="text-[9px] font-bold tracking-[.18em] text-amber-100/80">{drawnNumbers.length}/80 {t.called}</span><span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_8px_#fcd34d]" /></div>
        </div>
      </section>

      {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-950/50 p-3 text-sm text-red-100">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-amber-300/30 bg-amber-950/40 p-3 text-sm text-amber-100">{notice}</p>}

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="rounded-2xl border border-amber-100/15 bg-[#111111] p-4">
          <h2 className="mb-3 font-black text-amber-50">{t.lastFive}</h2>
          <div className="flex min-h-14 flex-wrap items-center gap-2">{drawnNumbers.slice(-5).reverse().map((number,index) => <span key={number} className={`grid h-11 w-11 place-items-center rounded-full border-2 border-white/75 font-black text-white shadow-md ${index===0?'bg-[#d4af37]':'bg-[#292929]'}`}>{number}</span>)}</div>
          <p className="mt-3 text-xs text-amber-100/65">{t.countdown}: {secondsLeft === null ? '—' : `${secondsLeft}s`}</p>
        </div>
        <aside className="space-y-3">
          <div className="rounded-2xl border border-amber-100/15 bg-[#111111] p-4"><p className="text-xs font-bold uppercase tracking-wider text-amber-200">{t.wallet}</p><p className="mt-2 text-2xl font-black">{state?.balanceEtb == null ? '—' : money(state.balanceEtb)} <span className="text-sm text-amber-200">ETB</span></p><p className="mt-1 text-[10px] text-amber-100/50">{t.demo}</p></div>
          <div className="rounded-2xl border border-amber-100/15 bg-[#111111] p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-200">{t.purchase}</p><p className="mt-2 text-sm text-amber-50/75">{t.price}: {state ? money(state.settings.ticketPriceEtb) : '—'} ETB</p>
            <label className="mt-3 block text-xs text-amber-100/70">{t.quantity}</label><input type="number" min={1} max={state?.settings.maxTicketsPerPlayer ?? 10} value={count} onChange={(event) => setCount(Math.max(1,Math.min(state?.settings.maxTicketsPerPlayer ?? 10,Number(event.target.value)||1)))} className="mt-1 w-full rounded-xl border border-amber-100/20 bg-[#09090b] px-3 py-3 text-lg font-bold text-white" />
            <button type="button" disabled={!canBuy || busy} onClick={() => void buy()} className="mt-3 w-full rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d4af37] px-3 py-3 text-sm font-black text-[#09090b] shadow-lg disabled:cursor-not-allowed disabled:opacity-40">{busy ? t.busy : t.buy}</button>
            {!canBuy && <p className="mt-2 text-[10px] text-amber-100/45">{t.salesClosed}</p>}
          </div>
        </aside>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-black text-white">{t.tickets}</h2><span className="text-xs text-amber-200">{state?.tickets.length ?? 0}</span></div>
        {!state?.tickets.length && <p className="rounded-xl border border-white/10 bg-[#111111] p-5 text-center text-sm text-amber-50/55">{t.noTickets}</p>}
        <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 xl:grid-cols-3">
          {state?.tickets.map((ticket,index) => {
            const eligible = ticket.status === 'active' && state.game?.status === 'running' && ticket.matchedNumbers.length === state.game.target && state.game.lastNumber !== null && ticket.numbers.includes(state.game.lastNumber);
            const statusLabel = ticket.status === 'locked' ? t.locked : ticket.status === 'winner' ? t.winner : t.active;
            return <article key={ticket.id} className="min-w-0 rounded-2xl border-2 border-amber-600/40 bg-gradient-to-b from-white to-[#fff7e6] p-3 text-slate-900 shadow-[0_6px_20px_rgba(0,0,0,.25)]">
              <div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs font-black text-amber-800">TICKET {index+1}</span><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${ticket.status==='locked'?'bg-red-100 text-amber-900':ticket.status==='winner'?'bg-amber-100 text-amber-800':'bg-slate-100 text-slate-600'}`}>{statusLabel}</span></div>
              <div className="grid grid-cols-2 grid-rows-6 gap-2">
                {ticket.numbers.map((number) => <div key={number} className={`grid aspect-square place-items-center rounded-full border border-white/90 text-sm font-black tabular-nums shadow-[inset_1px_2px_4px_rgba(255,255,255,.85),inset_-2px_-3px_6px_rgba(0,0,0,.18),0_3px_5px_rgba(0,0,0,.12)] sm:text-base ${ticket.matchedNumbers.includes(number)?'bg-[radial-gradient(circle_at_30%_25%,#fff,#fef3c7_25%,#b8860b_85%)] text-white ring-2 ring-amber-500/50':'bg-[radial-gradient(circle_at_30%_25%,#fff,#fef3c7_24%,#b8860b_85%)] text-white'}`}>{number}</div>)}
              </div>
              <p className="mt-2 text-[10px] font-bold text-slate-600">{ticket.matchedNumbers.length}/{state.game?.target ?? state.settings.target} {t.matched}</p>
              <button type="button" disabled={!eligible || busy} onClick={() => void claim(ticket.id)} className="mt-2 w-full rounded-xl border border-red-200 bg-gradient-to-b from-[#f59e0b] to-[#b8860b] px-2 py-3 text-xs font-black tracking-wider text-white shadow-[0_3px_0_#785719,0_5px_12px_rgba(212,175,55,.22)] disabled:cursor-not-allowed disabled:opacity-35">{t.bingo}</button>
            </article>;
          })}
        </div>
      </section>

      {state?.game?.status === 'ended' && <section className="rounded-2xl border border-amber-300/30 bg-amber-950/30 p-4 text-center"><h2 className="text-xl font-black text-amber-100">{state.game.winner ? t.winnerTitle : t.ended}</h2><p className="mt-1 text-sm text-amber-50/70">{state.game.winner ? t.claimSuccess : t.endedNoWinner}</p></section>}
      <p className="text-center text-[10px] text-amber-100/40">{t.simulation}</p>
    </main>
  );
}
