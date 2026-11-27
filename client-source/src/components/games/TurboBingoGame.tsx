import { useCallback, useEffect, useMemo, useState } from 'react';
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
    machine:'ቀጥታ የቁጥር ማውጫ', cage:'GLASS BINGO CAGE', mixing:'ኳሶች እየተዞሩ ነው', waiting:'በመጠበቅ ላይ', lastBall:'የመጨረሻ የወጣ ኳስ', inventory:'በማሽኑ ውስጥ ያሉ ኳሶች', balls:'ኳሶች',
    lastFive:'የመጨረሻ 5 የተጠሩ ቁጥሮች', countdown:'ቆጣሪ', wallet:'የሙከራ ቦርሳ', demo:'ሊወጣ የማይችል የሙከራ ክሬዲት ብቻ', purchase:'ካርድ መግዣ', price:'የአንድ ካርድ ዋጋ', quantity:'የካርድ ብዛት', buy:'ግዛና መዝግብ', busy:'ቆይ…', salesClosed:'አዲስ ዙር ሲከፈት ካርድ መግዛት ይቻላል።',
    tickets:'የተመዘገቡ ካርዶቼ', noTickets:'ለዚህ ጨዋታ ካርድ አልተመዘገበም።', matched:'የተዛመዱ', bingo:'ቢንጎ!', active:'ንቁ', locked:'ተቆልፏል', winner:'አሸናፊ', ended:'ጨዋታው ተጠናቋል', winnerTitle:'አሸናፊው ተረጋግጧል', endedNoWinner:'ዙሩ ያለ ትክክለኛ የድል ጥያቄ ተጠናቋል',
    buySuccess:'ካርዶችህ ተመዝግበዋል።', claimSuccess:'ቢንጎ! ድልህ ተረጋግጧል።', errorLoad:'Turbo Bingo መጫን አልተቻለም።', errorBuy:'ካርድ መግዛት አልተሳካም።', errorClaim:'የቢንጎ ጥያቄው አልተረጋገጠም።', simulation:'Turbo Bingo በአሁኑ ጊዜ የሙከራ ጨዋታ ነው። ክሬዲቶቹ እውነተኛ ገንዘብ አይደሉም።', choose:'ቋንቋ'
  },
  ti: {
    back:'← ናብ ጸወታታት', live:'ቀጥታ · ናይ ፈተነ ክሬዲት', title:'ትርቦ ቢንጎ', subtitle:'80 ኩዕሶታት · ቅኑዕ ቁጽሪ ዓወት · ቀዳማይ ቅኑዕ ዓዋቲ', running:'ይካየድ ኣሎ', endedStatus:'ተወዲኡ', quick:'ቅልጡፍ', standard:'ስሩዕ', full_house:'ምሉእ ካርድ', custom:'ፍሉይ',
    status:'ኩነታት ጸወታ', target:'ቁጽሪ ዓወት', called:'ዝወጹ ቁጽሪታት', latest:'ናይ መወዳእታ ቁጽሪ', round:'ዓይነት ዙር', prize:'ሽልማት ዓዋቲ', time:'ዝተረፈ ግዜ',
    machine:'ቀጥታዊ መውጽኢ ቁጽሪ', cage:'GLASS BINGO CAGE', mixing:'ኩዕሶታት ይዘውራ ኣለዋ', waiting:'ይጽበ ኣሎ', lastBall:'ናይ መወዳእታ ዝወጸት ኩዕሶ', inventory:'ኣብ ማሽን ዘለዋ ኩዕሶታት', balls:'ኩዕሶታት',
    lastFive:'ናይ መወዳእታ 5 ዝተጸውዑ ቁጽሪታት', countdown:'ቆጸራ', wallet:'ናይ ፈተነ ቦርሳ', demo:'ክወጽእ ዘይክእል ናይ ፈተነ ክሬዲት ጥራይ', purchase:'መግዝኢ ካርድ', price:'ዋጋ ሓደ ካርድ', quantity:'ብዝሒ ካርድ', buy:'ግዝእን መዝግብን', busy:'ተጸበ…', salesClosed:'ሓድሽ ዙር ምስ ተኸፍተ ካርድ ምግዛእ ይከኣል።',
    tickets:'ዝተመዝገቡ ካርዳተይ', noTickets:'ንዚ ጸወታ ዝተመዝገበ ካርድ የለን።', matched:'ዝተሰማምዑ', bingo:'ቢንጎ!', active:'ንጡፍ', locked:'ተዓጽዩ', winner:'ዓዋቲ', ended:'ጸወታ ተወዲኡ', winnerTitle:'ዓዋቲ ተረጋጊጹ', endedNoWinner:'ዙር ብዘይ ቅኑዕ ሕቶ ዓወት ተወዲኡ',
    buySuccess:'ካርዳትካ ተመዝጊቦም።', claimSuccess:'ቢንጎ! ዓወትካ ተረጋጊጹ።', errorLoad:'Turbo Bingo ምጽዓን ኣይተኻእለን።', errorBuy:'ካርድ ምግዛእ ኣይተሳኸዐን።', errorClaim:'ሕቶ ቢንጎ ኣይተረጋገጸን።', simulation:'Turbo Bingo ሕጂ ናይ ፈተነ ጸወታ እዩ። ክሬዲታት ሓቀኛ ገንዘብ ኣይኮኑን።', choose:'ቋንቋ'
  },
  en: {
    back:'← Games', live:'LIVE · DEMO CREDITS', title:'TURBO BINGO', subtitle:'80 balls · Exact winning target · First valid winner', running:'RUNNING', endedStatus:'ENDED', quick:'QUICK', standard:'STANDARD', full_house:'FULL HOUSE', custom:'CUSTOM',
    status:'GAME STATUS', target:'WINNING TARGET', called:'NUMBERS CALLED', latest:'LATEST NUMBER', round:'ROUND TYPE', prize:'WINNER PRIZE', time:'TIME LEFT',
    machine:'LIVE NUMBER DRAW', cage:'GLASS BINGO CAGE', mixing:'● MIXING', waiting:'WAITING', lastBall:'LAST BALL', inventory:'BALLS IN THE CAGE', balls:'balls',
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
  'radial-gradient(circle at 30% 24%,#fff,#67e8f9 26%,#0e7490 78%)'
];

export function TurboBingoGame({ onBack }: { onBack: () => void }) {
  const { lang, setLang } = useLanguage();
  const t = copy[lang];
  const [state, setState] = useState<State | null>(null);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [extractedNumber, setExtractedNumber] = useState<number | null>(null);
  const [clock, setClock] = useState(Date.now());

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
    : state?.game?.endsAt ? Math.max(0, Math.ceil((state.game.endsAt - clock) / 1000)) : null;

  useEffect(() => {
    if (lastNumber === null) return;
    setExtractedNumber(lastNumber);
    const timeout = window.setTimeout(() => setExtractedNumber(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [lastNumber]);

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
    <main className="turbo-player mx-auto min-h-screen w-full max-w-6xl space-y-4 px-3 pb-28 pt-3 text-white sm:px-5 sm:pt-5">
      <style>{`
        @keyframes turbo-cage-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes turbo-ball-float { 0%,100% { translate:0 0; } 50% { translate:5px -9px; } }
        @keyframes turbo-ball-exit { 0% { opacity:0; transform:translate(-50%,-30px) scale(.45); } 18% { opacity:1; } 55% { transform:translate(-50%,24px) scale(1.08); } 100% { opacity:0; transform:translate(-50%,135px) scale(.82); } }
        .turbo-cage-rotate { animation:turbo-cage-rotate 7s linear infinite; transform-origin:center; }
        .turbo-ball-float { animation:turbo-ball-float 2.5s ease-in-out infinite; }
        .turbo-ball-exit { animation:turbo-ball-exit 1.8s cubic-bezier(.2,.72,.25,1) both; }
        @media(prefers-reduced-motion:reduce) { .turbo-cage-rotate,.turbo-ball-float,.turbo-ball-exit { animation:none!important; } }
      `}</style>

      <header className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200/20 bg-[#073b2b] px-3 py-3 shadow-lg sm:px-5">
        <button type="button" onClick={onBack} className="rounded-xl border border-white/20 px-3 py-2 text-xs font-bold text-emerald-50 hover:bg-white/10 sm:text-sm">{t.back}</button>
        <div className="min-w-0 text-center"><p className="text-[9px] font-black tracking-[.2em] text-emerald-200/70">BLACK GOLD GAME CENTER</p><h1 className="text-lg font-black tracking-wide sm:text-2xl">{t.title}</h1></div>
        <label className="flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-100/20 bg-black/20 px-2 py-2 text-[10px] font-bold text-white">
          <span className="sr-only">{t.choose}</span><select aria-label={t.choose} value={lang} onChange={(event) => setLang(event.target.value as Lang)} className="max-w-[92px] bg-transparent text-white outline-none sm:max-w-none">{(['am','ti','en'] as Lang[]).map((key) => <option key={key} value={key} className="bg-[#073b2b] text-white">{langNames[key]}</option>)}</select>
        </label>
      </header>

      <section className="rounded-2xl border border-emerald-200/20 bg-gradient-to-br from-[#0b563d] via-[#073b2b] to-[#041f18] p-4 shadow-[0_12px_35px_rgba(0,0,0,.25)] sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-black tracking-[.24em] text-emerald-200/75">TURBO BINGO · 1–80</p><span className="rounded-full border border-emerald-200/25 bg-emerald-300/10 px-3 py-1 text-[10px] font-bold text-emerald-100">{t.live}</span></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {[
            [t.status, (state?.game?.status === 'running' ? t.running : state?.game?.status === 'ended' ? t.endedStatus : state?.game?.status === 'waiting' ? t.waiting : '—')],
            [t.target, String(state?.game?.target ?? state?.settings.target ?? '—')],
            [t.called, String(drawnNumbers.length)],
            [t.latest, String(lastNumber ?? '—')],
            [t.round, (t[String(state?.game?.roundType ?? state?.settings.roundType ?? '')] ?? String(state?.game?.roundType ?? state?.settings.roundType ?? '—').replace('_',' ').toUpperCase())],
            [t.prize, `${money(state?.game?.prizeEtb ?? state?.settings.prizeEtb ?? 0)} ETB`],
            [t.time, secondsLeft === null ? '—' : `${secondsLeft}s`]
          ].map(([label,value]) => <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-2.5"><p className="text-[9px] font-bold tracking-wide text-emerald-100/60">{label}</p><p className="mt-1 truncate text-base font-black tabular-nums text-white sm:text-lg">{value}</p></div>)}
        </div>
      </section>

      <section aria-label={t.cage} className="overflow-hidden rounded-3xl border border-cyan-100/30 bg-[radial-gradient(ellipse_at_50%_35%,rgba(57,180,203,.25),transparent_58%),linear-gradient(145deg,#062c29,#071b25_60%,#101a2a)] p-3 shadow-[inset_0_1px_25px_rgba(111,230,255,.12),0_15px_40px_rgba(0,0,0,.28)] sm:p-5">
        <div className="mb-2 flex items-center justify-between gap-2"><div><p className="text-[9px] font-black tracking-[.22em] text-cyan-100/70">{t.machine}</p><h2 className="text-lg font-black text-white sm:text-xl">{t.cage}</h2></div><span className="rounded-full border border-cyan-100/25 bg-cyan-200/10 px-2.5 py-1 text-[9px] font-bold text-cyan-50">{state?.game?.status === 'running' ? t.mixing : (state?.game?.status === 'running' ? t.running : state?.game?.status === 'ended' ? t.endedStatus : t.waiting)}</span></div>
        <div className="relative mx-auto h-[235px] max-w-[560px] sm:h-[300px]">
          <div className="absolute bottom-2 left-[10%] right-[10%] h-7 rounded-[50%] bg-cyan-300/20 blur-xl" />
          <div className="absolute bottom-3 left-[12%] right-[12%] h-7 rounded-[50%] border border-cyan-100/35 bg-gradient-to-b from-slate-200/40 via-slate-700/70 to-slate-950 shadow-xl" />
          <div className="absolute bottom-7 left-[14%] right-[14%] top-3 overflow-hidden rounded-[48%_48%_34%_34%] border-[3px] border-cyan-50/65 bg-gradient-to-br from-white/20 via-cyan-100/10 to-blue-500/20 shadow-[inset_14px_0_25px_rgba(255,255,255,.18),inset_-14px_0_28px_rgba(70,180,255,.2),0_0_35px_rgba(70,210,255,.18)] backdrop-blur-[2px]">
            <div className={`turbo-cage-rotate absolute inset-[5%] rounded-full ${state?.game?.status === 'running' ? '' : ''}`}>
              {cageBalls.map((ball) => <span key={ball.number} className="turbo-ball-float absolute grid place-items-center rounded-full border border-white/80 text-[9px] font-black text-white shadow-[inset_2px_3px_5px_rgba(255,255,255,.75),inset_-3px_-4px_7px_rgba(0,0,0,.38),0_3px_8px_rgba(0,0,0,.45)] sm:text-[10px]" style={{left:`${ball.left}%`,top:`${ball.top}%`,width:ball.size,height:ball.size,marginLeft:-ball.size/2,marginTop:-ball.size/2,animationDelay:`${ball.delay}s`,background:ball.color}}>{ball.number}</span>)}
            </div>
            <div className="absolute left-1/2 top-1/2 h-[3px] w-[88%] -translate-x-1/2 -translate-y-1/2 rotate-[-12deg] rounded-full bg-gradient-to-r from-cyan-100/10 via-cyan-50/75 to-cyan-100/10 shadow-[0_0_10px_rgba(130,230,255,.8)]" />
            <div className="absolute -top-2 left-1/2 z-20 h-5 w-16 -translate-x-1/2 rounded-t-xl border-2 border-cyan-50/80 bg-gradient-to-b from-slate-100/80 to-cyan-900/80 shadow-lg sm:w-20" />
          </div>
          <div className="absolute bottom-5 left-[8%] h-[70%] w-3 rotate-[12deg] rounded-full border border-cyan-100/60 bg-gradient-to-r from-cyan-200/60 to-blue-950/90 shadow-lg" />
          <div className="absolute bottom-5 right-[8%] h-[70%] w-3 -rotate-[12deg] rounded-full border border-cyan-100/60 bg-gradient-to-r from-cyan-200/60 to-blue-950/90 shadow-lg" />
          {extractedNumber !== null && <div key={extractedNumber} className="turbo-ball-exit absolute left-1/2 top-0 z-40 grid h-14 w-14 place-items-center rounded-full border-[3px] border-white bg-[radial-gradient(circle_at_30%_24%,#fff,#fca5a5_18%,#ef4444_55%,#991b1b)] text-xl font-black text-white shadow-[0_0_0_5px_rgba(248,113,113,.18),0_0_28px_rgba(248,113,113,.9)] sm:h-16 sm:w-16 sm:text-2xl" aria-live="polite">{extractedNumber}</div>}
        </div>
        <div className="mx-auto mt-1 flex max-w-[560px] items-center justify-between gap-2 rounded-2xl border border-cyan-100/20 bg-black/40 px-3 py-2">
          <div className="min-w-0"><p className="text-[9px] font-black tracking-wider text-cyan-50/60">{t.lastBall}</p><p className="text-xs text-cyan-50/50">{drawnNumbers.length} / 80 {t.called.toLowerCase()}</p></div>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-white/80 bg-[radial-gradient(circle_at_30%_25%,#fff,#fca5a5_18%,#ef4444_55%,#991b1b)] text-xl font-black text-white shadow-[0_0_18px_rgba(248,113,113,.45)]">{lastNumber ?? '—'}</span>
          <div className="text-right"><p className="text-[9px] font-black tracking-wider text-cyan-50/60">{t.inventory}</p><p className="text-sm font-black text-white">{cageBalls.length} / 80 {t.balls}</p></div>
        </div>
      </section>

      {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-950/50 p-3 text-sm text-red-100">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-300/30 bg-emerald-950/40 p-3 text-sm text-emerald-100">{notice}</p>}

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="rounded-2xl border border-emerald-100/15 bg-[#082a20] p-4">
          <h2 className="mb-3 font-black text-emerald-50">{t.lastFive}</h2>
          <div className="flex min-h-14 flex-wrap items-center gap-2">{drawnNumbers.slice(-5).reverse().map((number,index) => <span key={number} className={`grid h-11 w-11 place-items-center rounded-full border-2 border-white/75 font-black text-white shadow-md ${index===0?'bg-red-600':'bg-blue-700'}`}>{number}</span>)}</div>
          <p className="mt-3 text-xs text-emerald-100/65">{t.countdown}: {secondsLeft === null ? '—' : `${secondsLeft}s`}</p>
        </div>
        <aside className="space-y-3">
          <div className="rounded-2xl border border-emerald-100/15 bg-[#082a20] p-4"><p className="text-xs font-bold uppercase tracking-wider text-emerald-200">{t.wallet}</p><p className="mt-2 text-2xl font-black">{state?.balanceEtb == null ? '—' : money(state.balanceEtb)} <span className="text-sm text-emerald-200">ETB</span></p><p className="mt-1 text-[10px] text-emerald-100/50">{t.demo}</p></div>
          <div className="rounded-2xl border border-emerald-100/15 bg-[#082a20] p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-200">{t.purchase}</p><p className="mt-2 text-sm text-emerald-50/75">{t.price}: {state ? money(state.settings.ticketPriceEtb) : '—'} ETB</p>
            <label className="mt-3 block text-xs text-emerald-100/70">{t.quantity}</label><input type="number" min={1} max={state?.settings.maxTicketsPerPlayer ?? 10} value={count} onChange={(event) => setCount(Math.max(1,Math.min(state?.settings.maxTicketsPerPlayer ?? 10,Number(event.target.value)||1)))} className="mt-1 w-full rounded-xl border border-emerald-100/20 bg-[#041b14] px-3 py-3 text-lg font-bold text-white" />
            <button type="button" disabled={!canBuy || busy} onClick={() => void buy()} className="mt-3 w-full rounded-xl bg-gradient-to-r from-emerald-300 to-green-500 px-3 py-3 text-sm font-black text-[#052217] shadow-lg disabled:cursor-not-allowed disabled:opacity-40">{busy ? t.busy : t.buy}</button>
            {!canBuy && <p className="mt-2 text-[10px] text-emerald-100/45">{t.salesClosed}</p>}
          </div>
        </aside>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-black text-white">{t.tickets}</h2><span className="text-xs text-emerald-200">{state?.tickets.length ?? 0}</span></div>
        {!state?.tickets.length && <p className="rounded-xl border border-white/10 bg-[#082a20] p-5 text-center text-sm text-emerald-50/55">{t.noTickets}</p>}
        <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 xl:grid-cols-3">
          {state?.tickets.map((ticket,index) => {
            const eligible = ticket.status === 'active' && state.game?.status === 'running' && ticket.matchedNumbers.length === state.game.target && state.game.lastNumber !== null && ticket.numbers.includes(state.game.lastNumber);
            const statusLabel = ticket.status === 'locked' ? t.locked : ticket.status === 'winner' ? t.winner : t.active;
            return <article key={ticket.id} className="min-w-0 rounded-2xl border-2 border-emerald-600/40 bg-gradient-to-b from-white to-[#e9f5ed] p-3 text-slate-900 shadow-[0_6px_20px_rgba(0,0,0,.25)]">
              <div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs font-black text-emerald-800">TICKET {index+1}</span><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${ticket.status==='locked'?'bg-red-100 text-red-700':ticket.status==='winner'?'bg-emerald-100 text-emerald-800':'bg-slate-100 text-slate-600'}`}>{statusLabel}</span></div>
              <div className="grid grid-cols-2 grid-rows-6 gap-2">
                {ticket.numbers.map((number) => <div key={number} className={`grid aspect-square place-items-center rounded-full border border-white/90 text-sm font-black tabular-nums shadow-[inset_1px_2px_4px_rgba(255,255,255,.85),inset_-2px_-3px_6px_rgba(0,0,0,.18),0_3px_5px_rgba(0,0,0,.12)] sm:text-base ${ticket.matchedNumbers.includes(number)?'bg-[radial-gradient(circle_at_30%_25%,#fff,#86efac_25%,#059669_85%)] text-white ring-2 ring-emerald-500/50':'bg-[radial-gradient(circle_at_30%_25%,#fff,#fecaca_24%,#dc2626_85%)] text-white'}`}>{number}</div>)}
              </div>
              <p className="mt-2 text-[10px] font-bold text-slate-600">{ticket.matchedNumbers.length}/{state.game?.target ?? state.settings.target} {t.matched}</p>
              <button type="button" disabled={!eligible || busy} onClick={() => void claim(ticket.id)} className="mt-2 w-full rounded-xl border border-red-200 bg-gradient-to-b from-red-500 to-red-700 px-2 py-3 text-xs font-black tracking-wider text-white shadow-[0_3px_0_#7f1d1d,0_5px_12px_rgba(127,29,29,.25)] disabled:cursor-not-allowed disabled:opacity-35">{t.bingo}</button>
            </article>;
          })}
        </div>
      </section>

      {state?.game?.status === 'ended' && <section className="rounded-2xl border border-emerald-300/30 bg-emerald-950/30 p-4 text-center"><h2 className="text-xl font-black text-emerald-100">{state.game.winner ? t.winnerTitle : t.ended}</h2><p className="mt-1 text-sm text-emerald-50/70">{state.game.winner ? t.claimSuccess : t.endedNoWinner}</p></section>}
      <p className="text-center text-[10px] text-emerald-100/40">{t.simulation}</p>
    </main>
  );
}
