import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import type { Lang } from '@/types/game';

type Ticket = { id: string; numbers: number[]; matchedNumbers: number[]; status: 'active' | 'locked' | 'winner'; lockedAt: number | null };
type State = {
  settings: { enabled: boolean; target: number; ticketPriceEtb: number; prizeEtb: number; drawIntervalSeconds: number; roundDurationSeconds: number; roundType: string; mode?: 'automatic' | 'admin'; maxTicketsPerPlayer: number };
  isAdmin: boolean;
  game: null | { id: string; status: 'waiting' | 'running' | 'ended'; target: number; drawnNumbers: number[]; lastNumber: number | null; winner: { userId: string; ticketId: string; at: number; prizeEtb?: number } | null; ticketCount: number; roundType?: string; prizeEtb?: number; endsAt?: number | null; registrationEndsAt?: number | null; registrationSecondsLeft?: number | null };
  tickets: Ticket[];
  balanceEtb: number | null;
  balanceType: 'SIMULATION_ONLY';
};

const copy = {
  am: {
    back:'← ወደ ጨዋታዎች', live:'ቀጥታ · የሙከራ ክሬዲት', title:'ትርቦ ቢንጎ', subtitle:'80 ኳሶች · ትክክለኛ የድል ቁጥር · የመጀመሪያው ትክክለኛ አሸናፊ', running:'በመጫወት ላይ', endedStatus:'ተጠናቋል', quick:'ፈጣን', standard:'መደበኛ', full_house:'ሙሉ ካርድ', custom:'ብጁ',
    status:'የጨዋታ ሁኔታ', target:'የድል ቁጥር', called:'የወጡ ቁጥሮች', latest:'የመጨረሻ ቁጥር', round:'የዙር አይነት', prize:'የአሸናፊ ሽልማት', time:'የቀረ ጊዜ',
    calledNumbers:'የተጠሩ ኳሶች', noCalledNumbers:'እስካሁን ምንም ኳስ አልተጠራም።', addCards:'ካርዶች ጨምር', packages:'የካርድ ፓኬጆች', choosePackage:'የሚፈልጉትን ፓኬጅ ይምረጡ', cardUnit:'ካርድ', cardsUnit:'ካርዶች', total:'ጠቅላላ', close:'ዝጋ', adminFree:'የAdmin ነፃ ሙከራ', adminNote:'ለAdmin አካውንት ብቻ · 0 ብር · ባላንስ አይቀነስም', adminAdd:'ነፃ የሙከራ ካርዶች ጨምር',
    machine:'ቀጥታ የቁጥር ማውጫ', soundOn:'ድምፅ አብራ', soundOff:'ድምፅ አጥፋ', cage:'GLASS BINGO CAGE', mixing:'ኳሶች እየተዞሩ ነው', waiting:'በመጠበቅ ላይ', lastBall:'የመጨረሻ የወጣ ኳስ', inventory:'በማሽኑ ውስጥ ያሉ ኳሶች', balls:'ኳሶች',
    lastFive:'የመጨረሻ 5 የተጠሩ ቁጥሮች', countdown:'ቆጣሪ', wallet:'የሙከራ ቦርሳ', demo:'ሊወጣ የማይችል የሙከራ ክሬዲት ብቻ', purchase:'ካርድ መግዣ', price:'የአንድ ካርድ ዋጋ', quantity:'የካርድ ብዛት', buy:'ግዛና መዝግብ', busy:'ቆይ…', salesClosed:'አዲስ ዙር ሲከፈት ካርድ መግዛት ይቻላል።',
    tickets:'የተመዘገቡ ካርዶቼ', noTickets:'ለዚህ ጨዋታ ካርድ አልተመዘገበም።', matched:'የተዛመዱ', bingo:'ቢንጎ!', active:'ንቁ', locked:'ተቆልፏል', winner:'አሸናፊ', ended:'ጨዋታው ተጠናቋል', winnerTitle:'አሸናፊው ተረጋግጧል', endedNoWinner:'ዙሩ ያለ ትክክለኛ የድል ጥያቄ ተጠናቋል',
    buySuccess:'ካርዶችህ ተመዝግበዋል።', claimSuccess:'ቢንጎ! ድልህ ተረጋግጧል።', errorLoad:'Turbo Bingo መጫን አልተቻለም።', errorBuy:'ካርድ መግዛት አልተሳካም።', errorClaim:'የቢንጎ ጥያቄው አልተረጋገጠም።', simulation:'Turbo Bingo በአሁኑ ጊዜ የሙከራ ጨዋታ ነው። ክሬዲቶቹ እውነተኛ ገንዘብ አይደሉም።', choose:'ቋንቋ'
  },
  ti: {
    back:'← ናብ ጸወታታት', live:'ቀጥታ · ናይ ፈተነ ክሬዲት', title:'ትርቦ ቢንጎ', subtitle:'80 ኩዕሶታት · ቅኑዕ ቁጽሪ ዓወት · ቀዳማይ ቅኑዕ ዓዋቲ', running:'ይካየድ ኣሎ', endedStatus:'ተወዲኡ', quick:'ቅልጡፍ', standard:'ስሩዕ', full_house:'ምሉእ ካርድ', custom:'ፍሉይ',
    status:'ኩነታት ጸወታ', target:'ቁጽሪ ዓወት', called:'ዝወጹ ቁጽሪታት', latest:'ናይ መወዳእታ ቁጽሪ', round:'ዓይነት ዙር', prize:'ሽልማት ዓዋቲ', time:'ዝተረፈ ግዜ',
    calledNumbers:'ዝተጸውዑ ኩዕሶታት', noCalledNumbers:'ክሳብ ሕጂ ዝተጸውዐ ኩዕሶ የለን።', addCards:'ካርድ ወስኽ', packages:'ፓኬጃት ካርድ', choosePackage:'ዝደለኻዮ ፓኬጅ ምረጽ', cardUnit:'ካርድ', cardsUnit:'ካርዳት', total:'ጠቕላላ', close:'ዕጸው', adminFree:'ናይ Admin ነጻ ፈተነ', adminNote:'ንAdmin ኣካውንት ጥራይ · 0 ብር · ባላንስ ኣይንኪን', adminAdd:'ነጻ ናይ ፈተነ ካርዳት ወስኽ',
    machine:'ቀጥታዊ መውጽኢ ቁጽሪ', soundOn:'ድምጺ ኣብርህ', soundOff:'ድምጺ ኣጥፍእ', cage:'GLASS BINGO CAGE', mixing:'ኩዕሶታት ይዘውራ ኣለዋ', waiting:'ይጽበ ኣሎ', lastBall:'ናይ መወዳእታ ዝወጸት ኩዕሶ', inventory:'ኣብ ማሽን ዘለዋ ኩዕሶታት', balls:'ኩዕሶታት',
    lastFive:'ናይ መወዳእታ 5 ዝተጸውዑ ቁጽሪታት', countdown:'ቆጸራ', wallet:'ናይ ፈተነ ቦርሳ', demo:'ክወጽእ ዘይክእል ናይ ፈተነ ክሬዲት ጥራይ', purchase:'መግዝኢ ካርድ', price:'ዋጋ ሓደ ካርድ', quantity:'ብዝሒ ካርድ', buy:'ግዝእን መዝግብን', busy:'ተጸበ…', salesClosed:'ሓድሽ ዙር ምስ ተኸፍተ ካርድ ምግዛእ ይከኣል።',
    tickets:'ዝተመዝገቡ ካርዳተይ', noTickets:'ንዚ ጸወታ ዝተመዝገበ ካርድ የለን።', matched:'ዝተሰማምዑ', bingo:'ቢንጎ!', active:'ንጡፍ', locked:'ተዓጽዩ', winner:'ዓዋቲ', ended:'ጸወታ ተወዲኡ', winnerTitle:'ዓዋቲ ተረጋጊጹ', endedNoWinner:'ዙር ብዘይ ቅኑዕ ሕቶ ዓወት ተወዲኡ',
    buySuccess:'ካርዳትካ ተመዝጊቦም።', claimSuccess:'ቢንጎ! ዓወትካ ተረጋጊጹ።', errorLoad:'Turbo Bingo ምጽዓን ኣይተኻእለን።', errorBuy:'ካርድ ምግዛእ ኣይተሳኸዐን።', errorClaim:'ሕቶ ቢንጎ ኣይተረጋገጸን።', simulation:'Turbo Bingo ሕጂ ናይ ፈተነ ጸወታ እዩ። ክሬዲታት ሓቀኛ ገንዘብ ኣይኮኑን።', choose:'ቋንቋ'
  },
  en: {
    back:'← Games', live:'LIVE · DEMO CREDITS', title:'TURBO BINGO', subtitle:'80 balls · Exact winning target · First valid winner', running:'RUNNING', endedStatus:'ENDED', quick:'QUICK', standard:'STANDARD', full_house:'FULL HOUSE', custom:'CUSTOM',
    status:'GAME STATUS', target:'WINNING TARGET', called:'NUMBERS CALLED', latest:'LATEST NUMBER', round:'ROUND TYPE', prize:'WINNER PRIZE', time:'TIME LEFT',
    calledNumbers:'CALLED BALLS', noCalledNumbers:'No balls have been called yet.', addCards:'Add cards', packages:'CARD PACKAGES', choosePackage:'Choose a card package', cardUnit:'card', cardsUnit:'cards', total:'Total', close:'Close', adminFree:'ADMIN FREE TEST', adminNote:'Admin account only · 0 ETB · no balance deduction', adminAdd:'ADD FREE TEST CARDS',
    machine:'LIVE NUMBER DRAW', soundOn:'SOUND ON', soundOff:'SOUND OFF', cage:'GLASS BINGO CAGE', mixing:'● MIXING', waiting:'WAITING', lastBall:'LAST BALL', inventory:'BALLS IN THE CAGE', balls:'balls',
    lastFive:'LAST 5 CALLED BALLS', countdown:'Countdown', wallet:'DEMO WALLET', demo:'Non-withdrawable demo credits only', purchase:'TICKET PURCHASE', price:'Price per ticket', quantity:'Number of tickets', buy:'BUY & REGISTER', busy:'Please wait…', salesClosed:'Ticket sales open when a new round is opened.',
    tickets:'MY REGISTERED TICKETS', noTickets:'No tickets registered for this game yet.', matched:'matched', bingo:'BINGO!', active:'active', locked:'locked', winner:'winner', ended:'GAME ENDED', winnerTitle:'WINNER CONFIRMED', endedNoWinner:'This round ended without a valid winning claim.',
    buySuccess:'Your tickets were registered.', claimSuccess:'BINGO! Your win has been verified.', errorLoad:'Unable to load Turbo Bingo.', errorBuy:'Ticket purchase failed.', errorClaim:'Bingo claim could not be verified.', simulation:'Turbo Bingo is currently simulation-only. Demo credits have no cash value and cannot be withdrawn.', choose:'Language'
  }
} satisfies Record<Lang, Record<string, string>>;

const money = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function TurboBingoGame({ onBack }: { onBack: () => void }) {
  const { lang, setLang } = useLanguage();
  const t: Record<string, string> = copy[lang];
  const [state, setState] = useState<State | null>(null);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [extractedNumber, setExtractedNumber] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [packagesOpen, setPackagesOpen] = useState(false);
  const calledNumbersRef = useRef<HTMLDivElement | null>(null);
  const ticketBoardRef = useRef<HTMLElement | null>(null);
  const followLatestRef = useRef(true);

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

  const drawnNumbers = state?.game?.drawnNumbers ?? [];
  const maxTickets = Math.max(1, state?.settings.maxTicketsPerPlayer ?? 10);
  const selectedCount = Math.min(count, maxTickets);
  const packageCounts = [...new Set([1, 3, 5, 10, maxTickets].filter((value) => value >= 1 && value <= maxTickets))].sort((a, b) => a - b);
  const ballColors: Record<string, string> = {
    B: 'from-sky-300 via-blue-500 to-blue-800',
    I: 'from-rose-300 via-red-500 to-red-800',
    N: 'from-emerald-300 via-green-500 to-green-800',
    G: 'from-amber-200 via-yellow-400 to-amber-700',
    O: 'from-violet-300 via-purple-500 to-purple-800'
  };
  const ballLetter = (number: number) => number <= 16 ? 'B' : number <= 32 ? 'I' : number <= 48 ? 'N' : number <= 64 ? 'G' : 'O';

  const drawn = useMemo(() => new Set(drawnNumbers), [drawnNumbers]);
  const lastNumber = state?.game?.lastNumber ?? null;
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
  const ballPaint = [
    'radial-gradient(circle at 30% 24%,#fff,#fb7185 26%,#be123c 78%)',
    'radial-gradient(circle at 30% 24%,#fff,#60a5fa 26%,#1d4ed8 78%)',
    'radial-gradient(circle at 30% 24%,#fff,#4ade80 26%,#15803d 78%)',
    'radial-gradient(circle at 30% 24%,#fff,#c084fc 26%,#7e22ce 78%)',
    'radial-gradient(circle at 30% 24%,#fff,#facc15 26%,#b45309 78%)',
    'radial-gradient(circle at 30% 24%,#fff,#67e8f9 26%,#92400e 78%)'
  ];
  const cageBalls = useMemo(() => Array.from({ length: 80 }, (_, index) => index + 1)
    .filter((number) => !drawn.has(number))
    .map((number, index, remaining) => {
      const angle = index * 2.399963229728653;
      const radius = 13 + (index % 5) * 2.7;
      return { number, left: 50 + Math.cos(angle) * radius, top: 50 + Math.sin(angle) * radius * 0.78,
        delay: -((index * 0.173) % 4.8), color: ballPaint[number % ballPaint.length], size: remaining.length > 55 ? 27 : 31 };
    }), [drawn]);


  useEffect(() => {
    const strip = calledNumbersRef.current;
    if (strip && followLatestRef.current) strip.scrollTo({ left: strip.scrollWidth, behavior: 'smooth' });
  }, [drawnNumbers.length]);

  const buy = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      await api.post('/api/games/turbo-bingo/tickets', { count: selectedCount });
      setNotice(t.buySuccess);
      setPackagesOpen(false);
      await refresh();
      window.requestAnimationFrame(() => ticketBoardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
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
  const unitTicketPrice = state?.isAdmin ? 0 : (state?.settings.ticketPriceEtb ?? 0);
  const cardBoardRows = Math.max(5, ...(state?.tickets ?? []).map((ticket) =>
    Math.max(...Array.from({ length: 5 }, (_, column) => ticket.numbers.filter((number) => Math.floor((number - 1) / 16) === column).length))
  ));
  const langNames: Record<Lang, string> = { am: 'አማርኛ', ti: 'ትግርኛ', en: 'English' };

  return (
    <main className="turbo-player mx-auto min-h-screen w-full max-w-6xl space-y-4 bg-[#09090b] px-3 pb-28 pt-3 text-white sm:px-5 sm:pt-5">
<header className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200/20 bg-[#111111] px-3 py-3 shadow-lg sm:px-5">
        <button type="button" onClick={onBack} className="rounded-xl border border-white/20 px-3 py-2 text-xs font-bold text-amber-50 hover:bg-white/10 sm:text-sm">{t.back}</button>
        <div className="min-w-0 text-center"><p className="text-[9px] font-black tracking-[.2em] text-amber-200/70">BLACK GOLD GAME CENTER</p><h1 className="text-lg font-black tracking-wide sm:text-2xl">{t.title}</h1></div>
        <label className="flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-100/20 bg-black/20 px-2 py-2 text-[10px] font-bold text-white">
          <span className="sr-only">{t.choose}</span><select aria-label={t.choose} value={lang} onChange={(event) => setLang(event.target.value as Lang)} className="max-w-[92px] bg-transparent text-white outline-none sm:max-w-none">{(['am','ti','en'] as Lang[]).map((key) => <option key={key} value={key} className="bg-[#111111] text-white">{langNames[key]}</option>)}</select>
        </label>
      </header>

      <section className="rounded-2xl border border-amber-200/20 bg-[#111111] p-4 shadow-[0_10px_30px_rgba(0,0,0,.28)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${state?.game?.status === 'running' ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]' : state?.game?.status === 'ended' ? 'bg-zinc-500' : 'bg-amber-300'}`} />
            <span className="text-xs font-black tracking-wider text-amber-100">{state?.game?.status === 'running' ? t.running : state?.game?.status === 'ended' ? t.endedStatus : t.waiting}</span>
            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold text-amber-100">{t.live}</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div><span className="text-amber-100/55">{t.target}</span><strong className="ml-2 text-lg text-white">{state?.game?.target ?? state?.settings.target ?? '—'}</strong></div>
            <div><span className="text-amber-100/55">{t.prize}</span><strong className="ml-2 text-sm text-amber-200">{money(state?.game?.prizeEtb ?? state?.settings.prizeEtb ?? 0)} ETB</strong></div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-xs text-amber-100/65">
          <span>{t.calledNumbers}</span><span className="font-black tabular-nums text-white">{drawnNumbers.length}/80</span>
        </div>
      </section>

      <style>{`
        @keyframes turbo-ball-float { 0%,100% { transform:translate(0,0) rotate(0); } 12% { transform:translate(22px,-24px) rotate(75deg); } 27% { transform:translate(-26px,17px) rotate(-95deg); } 43% { transform:translate(18px,29px) rotate(125deg); } 59% { transform:translate(-30px,-18px) rotate(-145deg); } 76% { transform:translate(25px,-28px) rotate(190deg); } 90% { transform:translate(-15px,20px) rotate(-225deg); } }
        @keyframes turbo-ball-exit { 0% { opacity:0; transform:translate(-50%,185px) scale(.48) rotate(-100deg); } 10% { opacity:1; } 34% { opacity:1; transform:translate(-50%,-42px) scale(1.22) rotate(150deg); } 48% { transform:translate(-50%,-66px) scale(1.12) rotate(245deg); } 63% { opacity:1; transform:translate(-50%,8px) scale(1.08) rotate(330deg); } 82% { opacity:1; transform:translate(-50%,150px) scale(1) rotate(470deg); } 100% { opacity:0; transform:translate(-50%,225px) scale(.82) rotate(560deg); } }
        .turbo-ball-float { animation:turbo-ball-float .48s ease-in-out infinite; will-change:transform; }
        .turbo-ball-exit { animation:turbo-ball-exit 1.65s cubic-bezier(.12,.72,.18,1) both; }
        @media(prefers-reduced-motion:reduce) { .turbo-ball-float,.turbo-ball-exit { animation:none!important; } }
      `}</style>

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

      <section className="rounded-2xl border border-white/10 bg-[#0d0d0f] p-3 shadow-[0_8px_24px_rgba(0,0,0,.25)] sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-black tracking-wide text-amber-100">{t.calledNumbers}</h2>
          <span className="text-[10px] font-bold text-amber-200/60">{drawnNumbers.length}/80</span>
        </div>
        <div
          ref={calledNumbersRef}
          onScroll={(event) => {
            const element = event.currentTarget;
            followLatestRef.current = element.scrollLeft + element.clientWidth >= element.scrollWidth - 48;
          }}
          className="flex min-h-[118px] items-start gap-3 overflow-x-auto overscroll-x-contain pb-3 [scrollbar-width:thin] snap-x snap-mandatory touch-pan-x"
          aria-label={t.calledNumbers}
        >
          {drawnNumbers.map((number) => {
            const letter = ballLetter(number);
            return (
              <div key={number} className="flex w-[76px] shrink-0 snap-start flex-col items-center rounded-2xl border border-white/10 bg-[#151515] px-2 py-2">
                <span className="mb-1 text-[11px] font-black tracking-[.2em] text-amber-100">{letter}</span>
                <span className={`grid h-14 w-14 place-items-center rounded-full border-[5px] border-[#050505] bg-gradient-to-br ${ballColors[letter]} text-lg font-black text-white shadow-[inset_2px_2px_4px_rgba(255,255,255,.55),inset_-3px_-4px_7px_rgba(0,0,0,.35),0_4px_10px_rgba(0,0,0,.45)]`}>{number}</span>
              </div>
            );
          })}
          {drawnNumbers.length === 0 && <p className="self-center px-2 py-6 text-xs text-amber-100/45">{t.noCalledNumbers}</p>}
        </div>
        <p className="px-1 text-[10px] text-amber-100/40">{t.calledNumbers} · 1–80</p>
      </section>

      {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-950/50 p-3 text-sm text-red-100">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-amber-300/30 bg-amber-950/40 p-3 text-sm text-amber-100">{notice}</p>}



      <section ref={ticketBoardRef} className="scroll-mt-4 space-y-3">
        <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-black text-white">{t.tickets}</h2><span className="text-xs text-amber-200">{state?.tickets.length ?? 0}</span></div>
        {!state?.tickets.length && <p className="rounded-xl border border-white/10 bg-[#111111] p-5 text-center text-sm text-amber-50/55">{t.noTickets}</p>}
        <div className="grid grid-cols-1 items-stretch gap-3 min-[430px]:grid-cols-2 xl:grid-cols-3">
          {state?.tickets.map((ticket,index) => {
            const eligible = ticket.status === 'active' && state.game?.status === 'running' && ticket.matchedNumbers.length === state.game.target && state.game.lastNumber !== null && ticket.numbers.includes(state.game.lastNumber);
            const statusLabel = ticket.status === 'locked' ? t.locked : ticket.status === 'winner' ? t.winner : t.active;
            const columns = Array.from({ length: 5 }, (_, column) =>
              ticket.numbers.filter((number) => Math.floor((number - 1) / 16) === column).sort((a, b) => a - b)
            );
            const columnHeaders = ['B', 'I', 'N', 'G', 'O'];
            const headerColors = ['bg-blue-700', 'bg-red-600', 'bg-emerald-700', 'bg-amber-500', 'bg-orange-600'];
            return <article key={ticket.id} className="flex h-full min-w-0 flex-col overflow-hidden rounded-[1.2rem] border-2 border-amber-500/70 bg-black p-0 text-slate-900 shadow-[0_8px_24px_rgba(0,0,0,.35)]">
              <div className="flex min-h-9 items-center justify-between gap-1 bg-gradient-to-r from-amber-800 via-amber-500 to-amber-800 px-2 py-1 text-white">
                <span className="truncate text-xs font-black tabular-nums">▣ TURBO · {String(index + 1).padStart(2, '0')}</span>
                <span className={`shrink-0 rounded-full border border-white/25 bg-black/25 px-2 py-0.5 text-[9px] font-black uppercase ${ticket.status==='locked'?'text-red-100':ticket.status==='winner'?'text-yellow-100':'text-white'}`}>{statusLabel}</span>
              </div>
              <div className="flex min-h-7 w-full items-center justify-center bg-emerald-700 px-2 py-1 text-xs font-black text-white">BINGO</div>
              <div className="grid grid-cols-5 gap-px overflow-hidden bg-zinc-300">
                {columnHeaders.map((letter, column) => <div key={letter} className={`grid min-h-8 place-items-center py-1 text-center text-sm font-black text-white sm:text-lg ${headerColors[column]}`}>{letter}</div>)}
                {Array.from({ length: cardBoardRows * 5 }, (_, cellIndex) => {
                  const row = Math.floor(cellIndex / 5);
                  const column = cellIndex % 5;
                  const number = columns[column][row];
                  const center = row === Math.floor(cardBoardRows / 2) && column === 2;
                  const matched = number !== undefined && ticket.matchedNumbers.includes(number);
                  return <div key={cellIndex} className={`relative grid aspect-square min-w-0 place-items-center border border-zinc-300 text-[clamp(12px,2.8vw,20px)] font-black leading-none tabular-nums ${center ? 'bg-amber-100 text-amber-800' : matched ? 'bg-amber-300 text-black ring-1 ring-amber-500' : 'bg-white text-slate-900'}`}>
                    {number ?? (center ? '★' : '')}
                    {center && number !== undefined && <span aria-hidden="true" className="absolute right-1 top-0.5 text-[8px] text-amber-700">★</span>}
                  </div>;
                })}
              </div>
              <p className="px-2 pt-2 text-[10px] font-bold text-amber-100/75">{ticket.matchedNumbers.length}/{state.game?.target ?? state.settings.target} {t.matched}</p>
              <button type="button" disabled={!eligible || busy} onClick={() => void claim(ticket.id)} className="mx-2 mb-2 mt-2 rounded-lg border border-amber-200 bg-gradient-to-r from-yellow-200 to-amber-500 px-2 py-2.5 text-xs font-black tracking-wider text-black shadow-[0_3px_0_#785719] disabled:cursor-not-allowed disabled:opacity-35">{t.bingo}</button>
            </article>;
          })}
        </div>
      </section>

      {state?.game?.status === 'ended' && <section className="rounded-2xl border border-amber-300/30 bg-amber-950/30 p-4 text-center"><h2 className="text-xl font-black text-amber-100">{state.game.winner ? t.winnerTitle : t.ended}</h2><p className="mt-1 text-sm text-amber-50/70">{state.game.winner ? t.claimSuccess : t.endedNoWinner}</p></section>}
      <p className="text-center text-[10px] text-amber-100/40">{t.simulation}</p>

      <button type="button" aria-label={t.addCards} title={t.addCards} onClick={() => setPackagesOpen(true)} className="fixed bottom-[calc(6.25rem+env(safe-area-inset-bottom))] right-4 z-50 grid h-16 w-16 place-items-center rounded-full sm:right-6 border-4 border-[#09090b] bg-gradient-to-br from-[#ffe08a] via-[#f5b928] to-[#d4af37] text-4xl font-black leading-none text-[#09090b] shadow-[0_8px_28px_rgba(212,175,55,.38)] transition-transform hover:scale-105 active:scale-95">+</button>

      {packagesOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setPackagesOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="turbo-card-packages-title" className="w-full max-w-md rounded-t-3xl border border-amber-300/25 bg-[#111111] p-5 shadow-2xl sm:rounded-3xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div><p className="text-[10px] font-black tracking-[.2em] text-amber-300/70">TURBO BINGO</p><h2 id="turbo-card-packages-title" className="mt-1 text-xl font-black text-white">{t.packages}</h2><p className="mt-1 text-xs text-amber-100/55">{t.choosePackage}</p>{state?.isAdmin && <p className="mt-1 text-[10px] font-black tracking-wide text-emerald-300">{t.adminFree}</p>}</div>
              <button type="button" aria-label={t.close} onClick={() => setPackagesOpen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 bg-black/30 text-lg text-white">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {packageCounts.map((packageCount) => (
                <button key={packageCount} type="button" aria-pressed={selectedCount === packageCount} onClick={() => setCount(packageCount)} className={`rounded-2xl border p-4 text-left transition-colors ${selectedCount === packageCount ? 'border-amber-300 bg-amber-300/15 ring-2 ring-amber-300/20' : 'border-white/10 bg-black/25 hover:border-amber-200/40'}`}>
                  <span className="block text-2xl font-black text-amber-200">{packageCount}</span>
                  <span className="mt-1 block text-xs font-bold text-white">{packageCount === 1 ? t.cardUnit : t.cardsUnit}</span>
                  <span className="mt-2 block text-[11px] text-amber-100/55">{money(packageCount * unitTicketPrice)} ETB</span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-4 py-3">
              <span className="text-xs text-amber-100/65">{t.total}</span>
              <strong className="text-lg text-amber-200">{money(selectedCount * unitTicketPrice)} ETB</strong>
            </div>
            {state?.isAdmin && <p className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-950/30 px-3 py-2 text-xs font-bold text-emerald-200">{t.adminNote}</p>}
            {!canBuy && <p className="mt-3 text-xs text-amber-100/50">{t.salesClosed}</p>}
            <button type="button" disabled={!canBuy || busy} onClick={() => void buy()} className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#f5c451] to-[#d4af37] px-4 py-3.5 text-sm font-black text-[#09090b] shadow-lg disabled:cursor-not-allowed disabled:opacity-40">{busy ? t.busy : state?.isAdmin ? t.adminAdd : t.buy}</button>
          </section>
        </div>
      )}
    </main>
  );
}
