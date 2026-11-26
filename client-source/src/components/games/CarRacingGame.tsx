import { useCallback, useEffect, useRef, useState } from 'react';
import { CarRacing3DPreview, CarRacing3DViewport } from './CarRacing3D';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';

type Car = { id: string; name: string; length: number; width: number; speed: number; handling: number; color: string; bodyStyle?: string };
type Track = { id: string; name: string; terrain: string; surface: string; environment: 'city' | 'country' | 'rocky' | 'coastal'; scenery: string[]; speedFactor: number; grip: number; curveType: 'straight' | 'left' | 'right' | 's-bend'; curveIntensity: number; wallLimit: number; obstacles: { at: number; lane: number; width: number; type: string }[] };
type Player = { userId: string; name: string; car: string; carId: string; plateNumber: string; ready: boolean; progress: number; lane: number; speed: number; finished: boolean; damage: number; collisionEvent: { id: string; at: number; type: string; severity: 'light' | 'medium' | 'severe'; participants: string[] } | null; eliminated: boolean; eliminationReason: string | null; eliminatedAt: number | null; isMe: boolean };
type Room = { roomId: string; code: string; status: 'lobby' | 'countdown' | 'racing' | 'finished'; track: Track; entryFeeEtb: number; playerCount: number; maxPlayers: number; poolEtb: number; companyShareEtb: number; prizePoolEtb: number; countdownEndsAt: number | null; startedAt: number | null; winner: { userId: string; name: string; plateNumber: string; payoutEtb: number } | null; endReason?: string; collisionEvents?: { id: string; at: number; type: string; severity: 'light' | 'medium' | 'severe'; participants: string[] }[]; settlement?: { resultId: string; verified: boolean; verificationMethod: string; reason: string; settledAt: number; winnerUserId: string; winnerPlateNumber: string; totalEntryPoolEtb: number; companyShareEtb: number; prizePoolEtb: number; companyPercent: number; poolPercent: number; payoutCapEtb: number; finishOrder: { position: number; plateNumber: string; progress: number; status: string }[] } | null; players: Player[] };
type State = { enabled: boolean; simulationOnly: boolean; balanceEtb: number; maxPrizeEtb: number; companyPercent: number; poolPercent: number; cars: Car[]; tracks: Track[]; openRooms: { code: string; track: string; players: number; entryFeeEtb: number }[]; room: Room | null };
type DrivingView = 'chase' | 'cockpit';
const labels = {
  am: { title: 'BLACK GOLD RACING', subtitle: 'በአንድ ተጫዋች የሙከራ ውድድር', create: 'ውድድር ፍጠር', join: 'በኮድ ግባ', fee: 'የመግቢያ ክሬዲት (ETB)', code: 'የውድድር ኮድ', choose: 'መኪና ምረጥ', exterior: 'የውጭ እይታ', interior: 'የውስጥ እይታ', chase: 'የውጭ መንጃ እይታ', cockpit: 'የካቢና መንጃ እይታ', reverse: 'ኋላ', boost: 'ናይትሮ', eliminated: 'ከውድድሩ ውጪ ሆኗል', collision: 'ግጭት ተፈጥሯል', wall: 'የመንገድ ግድግዳ', barrier: 'መሰናክል', rocks: 'ድንጋይ', boulder: 'ትልቅ ድንጋይ', logs: 'እንጨት', debris: 'የመንገድ ቆሻሻ', rockfall: 'የድንጋይ መውደቅ', allEliminated: 'ሁሉም ተወዳዳሪዎች ከውድድሩ ውጪ ሆነዋል', stopped: 'ውድድሩ በሆስት ትእዛዝ ተቋርጧል። አሸናፊ ወይም ክፍያ አልተመዘገበም።', plate: 'የታርጋ ቁጥር', ready: 'ዝግጁ ነኝ', waiting: 'ሌሎችን በመጠበቅ ላይ', start: 'ውድድሩ ይጀምራል', drive: 'ጋዝ', left: 'ግራ', right: 'ቀኝ', back: 'ተመለስ', rooms: 'ክፍት ውድድሮች', balance: 'የሙከራ ክሬዲት', pool: 'የሽልማት Pool', company: 'የድርጅት ድርሻ', result: 'አሸናፊ', payout: 'የሙከራ ሽልማት', demo: 'SIMULATION ብቻ · እውነተኛ ገንዘብ የለም', full: 'ውድድሩ ሞልቷል', leave: 'ውጣ', error: 'ጨዋታውን ማስኬድ አልተቻለም', countdown: 'ይጀምራል…' },
  ti: { title: 'BLACK GOLD RACING', subtitle: 'ናይ ሓደ ተጻዋታይ ፈተነ ውድድር', create: 'ውድድር ፍጠር', join: 'ብኮድ እቶ', fee: 'ናይ ምእታዊ ክረዲት', code: 'ኮድ ውድድር', choose: 'መኪና ምረጽ', exterior: 'ደጋዊ ርእይቶ', interior: 'ውሽጣዊ ርእይቶ', chase: 'ደጋዊ ኣነዳድራ', cockpit: 'ናይ ካቢና ኣነዳድራ', reverse: 'ድሕሪት', boost: 'ናይትሮ', eliminated: 'ካብ ውድድር ወጺኡ', collision: 'ግጭት ኣጋጢሙ', wall: 'መንደቕ መንገዲ', barrier: 'ዕንቅፋት', rocks: 'ኣእማን', boulder: 'ዓቢ እምኒ', logs: 'ዕንጸይቲ', debris: 'ፍርስራስ', rockfall: 'ምውዳቕ ኣእማን', allEliminated: 'ኩሎም ተወዳደርቲ ካብ ውድድር ወጺኦም', stopped: 'ውድድር ብትእዛዝ ሆስት ተቋሪጹ። ተዓዋቲ ወይ ክፍሊት ኣይተመዝገበን።', plate: 'ቁጽሪ ታርጋ', ready: 'ድሉው እየ', waiting: 'ካልኦት ይጽበ', start: 'ውድድር ይጅምር', drive: 'ጋዝ', left: 'ጸጋም', right: 'የማን', back: 'ተመለስ', rooms: 'ክፉታት ውድድራት', balance: 'ናይ ፈተነ ክረዲት', pool: 'Prize Pool', company: 'ናይ ትካል ክፋል', result: 'ተዓዋቲ', payout: 'ናይ ፈተነ ሽልማት', demo: 'SIMULATION ጥራይ · ሓቀኛ ገንዘብ የለን', full: 'ውድድር መሊኡ', leave: 'ውጻእ', error: 'ጸወታ ምክያድ ኣይተኻእለን', countdown: 'ይጅምር…' },
  en: { title: 'BLACK GOLD RACING', subtitle: 'Single-player test drive', create: 'Create race', join: 'Join with code', fee: 'Entry credits (ETB)', code: 'Race code', choose: 'Choose your car', exterior: 'Exterior view', interior: 'Interior view', chase: 'Outside / Chase', cockpit: 'Inside / Cockpit', reverse: 'REVERSE', boost: 'BOOST', eliminated: 'ELIMINATED', collision: 'Crash', wall: 'Track wall', barrier: 'Barrier', rocks: 'Rocks', boulder: 'Boulder', logs: 'Logs', debris: 'Road debris', rockfall: 'Rockfall', allEliminated: 'All drivers were eliminated', stopped: 'The host stopped this race. No winner or payout was recorded.', plate: 'Plate number', ready: "I'm ready", waiting: 'Waiting for other drivers', start: 'Race starts', drive: 'THROTTLE', left: 'LEFT', right: 'RIGHT', back: 'Back', rooms: 'Open races', balance: 'Demo credits', pool: 'Prize pool', company: 'Company share', result: 'Winner', payout: 'Simulation prize', demo: 'SIMULATION ONLY · NO REAL MONEY', full: 'Room is full', leave: 'Leave', error: 'Could not load the race', countdown: 'Starting…' },
};

export function CarRacingGame({ onBack }: { onBack: () => void }) {
  const { lang } = useLanguage();
  const t = labels[lang] ?? labels.en;
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [throttle, setThrottle] = useState(0);
  const [steer, setSteer] = useState(0);
  const [reverse, setReverse] = useState(false);
  const [boost, setBoost] = useState(false);
  const [brake, setBrake] = useState(false);
  const [drivingView, setDrivingView] = useState<DrivingView>('chase');
  const [clock, setClock] = useState(Date.now());
  const [soloRoom,setSoloRoom]=useState<Room|null>(null);
  const [selectedCarId,setSelectedCarId]=useState('striker-r');
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [settingsLoaded,setSettingsLoaded]=useState(false);
  const [audioVolume,setAudioVolume]=useState(.82);
  const [graphicsQuality,setGraphicsQuality]=useState<'performance'|'balanced'|'ultra'>('balanced');
  const [nitroPercent,setNitroPercent]=useState(100);
  const nitroRef=useRef(100);nitroRef.current=nitroPercent;
  const stateRequestVersion = useRef(0);
  const stateRequestInFlight = useRef(false);
  const room = soloRoom;
  const me = room?.players.find((p) => p.isMe);
  const load = useCallback(async () => {
    // Never overlap state polls: a slow response must not be invalidated by a
    // faster timer tick, which previously could starve room updates indefinitely.
    if (stateRequestInFlight.current) return;
    stateRequestInFlight.current = true;
    const requestVersion = ++stateRequestVersion.current;
    try {
      const nextState = await api.get<State>('/api/games/car-racing/state');
      if (requestVersion === stateRequestVersion.current) {
        setState(nextState);
        setError('');
      }
    } catch (e) {
      if (requestVersion === stateRequestVersion.current) setError(e instanceof Error ? e.message : t.error);
    } finally {
      stateRequestInFlight.current = false;
    }
  }, [t.error]);
  useEffect(()=>{try{const saved=localStorage.getItem('black-gold-racing-settings');if(saved){const value=JSON.parse(saved);if(typeof value.audioVolume==='number')setAudioVolume(Math.max(0,Math.min(1,value.audioVolume)));if(['performance','balanced','ultra'].includes(value.graphicsQuality))setGraphicsQuality(value.graphicsQuality);if(value.drivingView==='chase'||value.drivingView==='cockpit')setDrivingView(value.drivingView);}}catch{/* Invalid local settings are ignored. */}finally{setSettingsLoaded(true);}},[]);
  useEffect(()=>{if(!settingsLoaded)return;try{localStorage.setItem('black-gold-racing-settings',JSON.stringify({audioVolume,graphicsQuality,drivingView}));}catch{/* Settings remain active for this session if storage is unavailable. */}},[settingsLoaded,audioVolume,graphicsQuality,drivingView]);
  useEffect(() => {
    let stopped = false;
    let timer = 0;
    const poll = async () => {
      await load();
      if (!stopped) timer = window.setTimeout(() => { setClock(Date.now()); void poll(); }, 700);
    };
    void poll();
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [load]);
  useEffect(() => {
    if(soloRoom || !room || room.status !== 'racing' || me?.eliminated) { if(!room || room.status!=='racing'){setThrottle(0);setSteer(0);setReverse(false);setBoost(false);setBrake(false);} return; }
    const send = () => void api.post('/api/games/car-racing/control', { roomId: room.roomId, throttle, steer, reverse, boost, brake }).catch(() => undefined);
    send();
    const timer = window.setInterval(send, 650);
    return () => window.clearInterval(timer);
  }, [soloRoom,room?.roomId, room?.status, me?.eliminated, throttle, steer, reverse, boost, brake]);
  useEffect(()=>{
    if(!soloRoom||soloRoom.status!=='racing')return;
    let previous=Date.now();
    const timer=window.setInterval(()=>{
      const now=Date.now(),dt=Math.min(.12,(now-previous)/1000);previous=now;
      setNitroPercent(value=>Math.max(0,Math.min(100,value+(boost?-24:10)*dt)));
      setSoloRoom(current=>{
        if(!current||current.status!=='racing'||!current.startedAt)return current;
        const elapsed=(now-current.startedAt)/1000;const driver=current.players[0];if(!driver)return current;
        if(elapsed>=600)return {...current,status:'finished',players:[{...driver,progress:100,finished:true,speed:0}],finishedAt:now};
        const acceleration=throttle>0?(boost&&nitroRef.current>0?105:58):0;const drag=brake?185:throttle===0?8:0;
        const speed=Math.max(0,Math.min(240,driver.speed+(acceleration-drag)*dt));
        const direction=reverse?-1:1;const progress=Math.max(0,Math.min(99.9,driver.progress+direction*(speed/240)*(100/600)*2*dt));
        const lane=Math.max(-.88,Math.min(.88,driver.lane+steer*dt*.72));
        return {...current,players:[{...driver,speed,progress,lane,finished:false}]};
      });
    },80);
    return()=>window.clearInterval(timer);
  },[soloRoom?.status,soloRoom?.startedAt,throttle,steer,reverse,boost,brake]);
  useEffect(()=>{if(nitroPercent<=0&&boost)setBoost(false);},[nitroPercent,boost]);
  const startSolo=()=>{
    const selected=state?.cars.find(car=>car.id===selectedCarId)||state?.cars.find(car=>car.id==='striker-r')||state?.cars[0];
    const track=state?.tracks.find(item=>item.id==='city')||state?.tracks[0];
    if(!selected||!track){setError('የመኪና ዝርዝር እስኪጫን ይጠብቁ');return;}
    const startedAt=Date.now();const player:Player={userId:'solo-driver',name:'YOU',car:selected.name,carId:selected.id,plateNumber:'BGB-SOLO-01',ready:true,progress:0,lane:0,speed:0,finished:false,damage:0,collisionEvent:null,eliminated:false,eliminationReason:null,eliminatedAt:null,isMe:true};
    setDrivingView('chase');setThrottle(0);setSteer(0);setReverse(false);setBoost(false);setBrake(false);setNitroPercent(100);
    setSoloRoom({roomId:'solo-practice',code:'SOLO',status:'racing',track,entryFeeEtb:0,playerCount:1,maxPlayers:1,poolEtb:0,companyShareEtb:0,prizePoolEtb:0,countdownEndsAt:null,startedAt,winner:null,players:[player]});
  };
  const act = async (path: string, body: unknown) => {
    // Invalidate in-flight polling before a room mutation so an old GET cannot
    // overwrite the authoritative room returned by create/join/ready.
    stateRequestVersion.current += 1;
    setBusy(true); setError('');
    try {
      const result = await api.post<Room | { ok: boolean }>(path, body);
      if (result && 'roomId' in result) {
        setState((current) => current ? { ...current, room: result } : current);
      }
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : t.error); }
    finally { setBusy(false); }
  };
  const progress = me?.progress ?? 0;
  const countdown = room?.countdownEndsAt ? Math.max(0, Math.ceil((room.countdownEndsAt - clock) / 1000)) : 0;
  return (
    <main className={room?.status === 'racing' ? "fixed inset-0 z-[80] h-[100dvh] w-[100vw] overflow-hidden bg-[#030609] p-0 text-amber-50" : "mx-auto min-h-[calc(100dvh-7rem)] w-full max-w-5xl space-y-4 px-3 pb-28 pt-4 text-amber-50 sm:px-5"}>
      {room?.status!=='racing'&&<header className="rounded-3xl border border-amber-300/25 bg-[radial-gradient(ellipse_at_top_right,rgba(202,158,57,.2),transparent_48%),linear-gradient(120deg,#19150b,#080808)] p-5">
        <button onClick={onBack} className="mb-4 text-xs font-bold text-amber-300">← {t.back}</button>
        <p className="text-[10px] font-black tracking-[.3em] text-amber-400">BLACK GOLD · RACING LEAGUE</p>
        <h1 className="mt-2 text-2xl font-black sm:text-4xl">{t.title}</h1>
        <p className="mt-2 text-sm text-amber-100/60">{t.subtitle}</p>
        <p className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-center text-[10px] font-black tracking-wider text-amber-200">{t.demo}</p>
      </header>}
      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
      {!room ? (
        <section className="rounded-3xl border border-amber-300/25 bg-[#080b12] p-4 shadow-[0_0_45px_rgba(0,174,255,.08)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black tracking-[.28em] text-sky-300">SOLO TEST DRIVE · CITY NIGHT CIRCUIT</p><h2 className="mt-1 text-xl font-black text-white sm:text-2xl">Choose your racing car</h2><p className="mt-1 text-xs text-amber-100/60">Single-player test mode · 10-minute session · no multiplayer room</p></div><button type="button" onClick={()=>setSettingsOpen(true)} className="rounded-xl border border-amber-300/50 bg-black/70 px-4 py-2 text-sm font-black text-amber-200">⚙ SETTINGS</button></div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(state?.cars??[]).map(car=><button key={car.id} type="button" onClick={()=>setSelectedCarId(car.id)} aria-pressed={selectedCarId===car.id} className={'overflow-hidden rounded-2xl border text-left transition '+(selectedCarId===car.id?'border-yellow-300 bg-yellow-300/10 ring-2 ring-yellow-300/40':'border-white/15 bg-black/60')}>
              <div className="relative h-24 bg-[radial-gradient(ellipse_at_50%_85%,rgba(0,174,255,.24),transparent_65%),linear-gradient(145deg,#101a2c,#030609)] p-2"><svg viewBox="0 0 180 90" className="h-full w-full" aria-hidden="true"><path d="M16 61 L27 42 L56 35 L74 20 L119 20 L144 39 L163 48 L168 64 L154 72 L25 72Z" fill={car.id===selectedCarId?'#f5c400':car.color} stroke="#ffe8a1" strokeWidth="2"/><path d="M62 36 L79 23 L116 23 L137 39Z" fill="#8bd5f0" fillOpacity=".8"/><path d="M17 60 L166 60 L156 70 L26 70Z" fill="#10141b"/><circle cx="48" cy="70" r="11" fill="#020307" stroke="#9ca3af" strokeWidth="4"/><circle cx="139" cy="70" r="11" fill="#020307" stroke="#9ca3af" strokeWidth="4"/><path d="M28 54 L46 52 M140 52 L160 55" stroke="#fff3c4" strokeWidth="4" strokeLinecap="round"/></svg>{selectedCarId===car.id&&<span className="absolute right-2 top-2 rounded-full bg-yellow-300 px-2 py-0.5 text-[8px] font-black text-black">SELECTED</span>}</div>
              <div className="p-3"><b className="block truncate text-xs text-white">{car.name}</b><div className="mt-1 flex justify-between text-[9px] text-amber-100/60"><span>Speed {Math.round(car.speed*100)}</span><span>Handling {Math.round(car.handling*100)}</span></div></div>
            </button>)}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-300/20 bg-sky-950/20 p-4"><div><p className="text-xs font-black text-sky-200">RACE SETTINGS</p><p className="mt-1 text-[10px] text-sky-100/65">Night neon city · Chase camera · 10:00 timer · Single player</p></div><button type="button" disabled={!state?.cars.length||busy} onClick={startSolo} className="rounded-xl bg-gradient-to-r from-yellow-300 to-amber-500 px-7 py-3 text-sm font-black text-black shadow-[0_0_22px_rgba(255,190,30,.25)] disabled:opacity-50">START SOLO RACE</button></div>
        </section>
      ) : (       <section className={room.status === 'racing' ? "h-full w-full" : "space-y-4"}>
          <div className={room.status === 'racing' ? "h-full w-full overflow-hidden bg-[#030609]" : "rounded-3xl border border-amber-300/25 bg-[#0b0b09] p-4 sm:p-6"}>
            <div className={room.status === 'racing' ? "hidden" : "flex flex-wrap items-center justify-between gap-3"}><div><p className="text-[10px] uppercase tracking-[.25em] text-amber-400">{room.track.terrain} · {room.track.surface}</p><h2 className="text-xl font-black">{room.track.name}</h2><p className="mt-1 text-[10px] uppercase tracking-wider text-amber-100/45">{room.track.curveType.toUpperCase()} TRACK · GRIP {Math.round(room.track.grip * 100)}%</p></div><div className="text-right text-xs"><p>{t.pool}: <b>{room.prizePoolEtb.toFixed(2)} ETB</b></p><p className="text-amber-100/50">{t.company}: {room.companyShareEtb.toFixed(2)} ETB</p></div></div>
            <div className={room.status === 'racing' ? "hidden" : "mt-5 h-3 overflow-hidden rounded-full bg-white/10"}><div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-200 transition-all" style={{ width: progress + '%' }} /></div>
            {me && <div className={room.status === 'racing' ? "hidden" : "mt-3"}><div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-amber-100/60"><span>Vehicle damage</span><span>{me.damage}%</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full transition-all ${me.damage >= 70 ? 'bg-red-500' : me.damage >= 35 ? 'bg-orange-400' : 'bg-emerald-400'}`} style={{ width: me.damage + '%' }} /></div></div>}
            <div className={room.status === 'racing' ? "hidden" : "mt-2 flex justify-between text-[10px] text-amber-100/45"}><span>START</span><span>{progress}%</span><span>FINISH</span></div>
            <div className={room.status === 'racing' ? "hidden" : "mt-5 rounded-2xl border border-amber-300/20 bg-gradient-to-r from-amber-300/10 via-black/60 to-black/40 p-3"}><div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-300">GRID STATUS</p><p className="mt-1 text-sm font-black text-white">{room.players.length} / 8 DRIVERS · {room.players.filter((p) => p.ready).length} READY</p></div><span className={`rounded-full border px-3 py-1 text-[10px] font-black tracking-wider ${room.status === 'racing' ? 'border-emerald-400/40 bg-emerald-950/60 text-emerald-300' : room.status === 'countdown' ? 'border-amber-300/50 bg-amber-300/15 text-amber-200' : 'border-white/15 bg-white/5 text-amber-100/70'}`}>{room.status.toUpperCase()}</span></div><div className="mt-3 grid grid-cols-8 gap-1">{Array.from({length:8},(_,i)=>{const driver=room.players[i];return <div key={i} className={`h-1.5 rounded-full ${driver ? driver.ready ? 'bg-emerald-400' : 'bg-amber-300/60' : 'bg-white/10'}`} />;})}</div></div>
            <div className={room.status === 'racing' ? "hidden" : "mt-5 space-y-2"}>{room.players.map((p) => <div key={p.userId} className="rounded-xl border border-white/10 bg-black/40 p-3"><div className="flex justify-between gap-2 text-xs"><b>{p.name} · {p.car}</b><span className="font-mono text-amber-300">{p.plateNumber}</span><span>{p.eliminated ? `${t.eliminated} · ${t[p.eliminationReason as keyof typeof t] ?? t.collision}` : p.finished ? 'FINISHED' : p.ready ? 'READY' : 'WAITING'}</span></div><div className="mt-2 h-2 overflow-hidden rounded bg-white/10"><div className="h-full bg-amber-400" style={{ width: p.progress + '%' }} /></div></div>)}</div>
            {room.status === 'lobby' && <div className="mt-5"><h3 className="font-bold text-lg">{t.choose} · {state?.cars.length ?? 0} MODERN CARS</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{state?.cars.map((c,i) => <button key={c.id} onClick={() => void act('/api/games/car-racing/car', { roomId: room.roomId, carId: c.id })} aria-pressed={me?.carId === c.id} className={`group overflow-hidden rounded-2xl border text-left transition-all ${me?.carId === c.id ? 'border-amber-300 bg-amber-300/10 ring-2 ring-amber-300/30' : 'border-white/10 bg-black/45 hover:border-amber-200/50'}`}>
                <div className="relative flex h-20 items-center justify-center overflow-hidden" style={{background:`radial-gradient(ellipse at 50% 90%, ${c.color}66, transparent 68%),linear-gradient(145deg,#17212c,#05080c)`}}>
                  <div className="absolute inset-x-4 bottom-4 h-5 rounded-[50%] blur-md" style={{background:c.color,opacity:.3}}/>
                  <svg viewBox="0 0 160 76" className="relative z-10 h-[68px] w-full drop-shadow-xl" aria-hidden="true"><path d={i===5?"M25 49 L31 29 Q35 23 52 22 L65 12 L105 12 L120 23 L132 26 L139 49 L132 56 L28 56Z":i===7?"M18 49 L31 33 L50 30 L66 17 L105 17 L125 31 L141 38 L145 51 L133 57 L25 57Z":"M18 48 L28 32 L49 28 L64 17 L103 17 L124 30 L140 36 L145 50 L134 57 L25 57Z"} fill={c.color} stroke="#e5e7eb" strokeOpacity=".6" strokeWidth="1.5"/><path d="M56 29 L68 19 L101 19 L116 30Z" fill="#8bd5f0" fillOpacity=".85"/><path d="M18 46 L143 46 L138 54 L25 54Z" fill="#111827"/><circle cx="43" cy="54" r="9" fill="#050608" stroke="#9ca3af" strokeWidth="3"/><circle cx="119" cy="54" r="9" fill="#050608" stroke="#9ca3af" strokeWidth="3"/><path d="M22 39 L35 37 M135 39 L143 40" stroke="#fff3c4" strokeWidth="3" strokeLinecap="round"/></svg>
                  <span className="absolute right-2 top-2 rounded bg-black/65 px-1.5 py-0.5 text-[8px] font-black text-white">#{String(i+1).padStart(2,'0')}</span>
                </div>
                <div className="p-2.5"><b className="block truncate text-xs text-white">{c.name}</b><div className="mt-1 flex justify-between text-[9px] text-amber-100/55"><span>Speed {Math.round(c.speed*100)}</span><span>Grip {Math.round(c.handling*100)}</span></div></div>
              </button>)}</div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-300/20 bg-sky-950/20 p-3"><div><b className="block text-xs text-sky-100">DRIVING CAMERA</b><span className="text-[10px] text-sky-100/55">Choose inside the car or outside chase view</span></div><div className="flex gap-2"><button type="button" aria-pressed={drivingView==='cockpit'} onClick={()=>setDrivingView('cockpit')} className={`rounded-lg border px-3 py-2 text-[10px] font-black ${drivingView==='cockpit'?'border-sky-300 bg-sky-300 text-slate-950':'border-white/15 text-sky-100'}`}>INSIDE · COCKPIT</button><button type="button" aria-pressed={drivingView==='chase'} onClick={()=>setDrivingView('chase')} className={`rounded-lg border px-3 py-2 text-[10px] font-black ${drivingView==='chase'?'border-sky-300 bg-sky-300 text-slate-950':'border-white/15 text-sky-100'}`}>OUTSIDE · CHASE</button></div></div>{me && state?.cars.find((c) => c.id === me.carId) && <div className="mt-4 rounded-2xl border border-amber-300/20 bg-black/35 p-3 sm:p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-black text-amber-100">{state.cars.find((c) => c.id === me.carId)?.name}</h4><span className="rounded-lg border border-amber-300/35 bg-amber-300/10 px-3 py-1.5 font-mono text-sm font-black tracking-widest text-amber-200">{me.plateNumber}</span></div><div className="mt-3"><CarRacing3DPreview car={state.cars.find((c) => c.id === me.carId)!} plateNumber={me.plateNumber} /></div><p className="mt-2 text-center text-[10px] text-amber-100/45">{t.plate}: {me.plateNumber}</p></div>}<button type="button" disabled={busy || me?.ready === true} onClick={() => void act('/api/games/car-racing/ready', { roomId: room.roomId, ready: true })} className="mt-4 w-full rounded-xl bg-amber-300 p-3 font-black text-black disabled:opacity-50">{me?.ready ? (lang === 'am' ? 'ዝግጁ ነው · ሌሎችን በመጠበቅ ላይ' : lang === 'ti' ? 'ድሉው እየ · ካልኦት ይጽበ' : 'Ready · waiting for others') : t.ready}</button><p className="mt-2 text-center text-xs text-amber-100/45">{room.players.length < 2 ? (lang === 'am' ? 'ቢያንስ 2 ተጫዋቾች ያስፈልጋሉ፤ ዝግጁነትህ ተመዝግቧል' : lang === 'ti' ? 'ብውሑድ 2 ተጻወትቲ የድሊ፤ ድሉውነትካ ተመዝጊቡ' : 'At least 2 drivers are required; your readiness is saved') : room.players.every((p) => p.ready) ? t.countdown : t.start}</p></div>}
            {room.status === 'countdown' && <p className="mt-6 text-center text-4xl font-black text-amber-300">{countdown || t.countdown}</p>}
            {room.status === 'racing' && me && <div className="h-full w-full"><CarRacing3DViewport view={drivingView} throttle={throttle} brake={brake} players={room.players} me={me} cars={state?.cars ?? []} speed={me.speed} steer={steer} reverse={reverse} track={room.track} boost={boost} rank={1} startedAt={room.startedAt??Date.now()} nitroPercent={nitroPercent} audioVolume={audioVolume} graphicsQuality={graphicsQuality} soloMode onSettings={()=>setSettingsOpen(true)} onViewChange={setDrivingView} onSteer={setSteer} onGearChange={(isReverse) => { setThrottle(0); setBoost(false); setBrake(false); setReverse(isReverse); }} onThrottle={(value, isReverse = false, isBoost = false, isBrake = false) => { setThrottle(value); setReverse(isReverse); setBoost(isBoost&&nitroPercent>0); setBrake(isBrake); }} /></div>}{room.status === 'finished' && <div className="mt-6 rounded-2xl border border-amber-300/40 bg-gradient-to-b from-amber-300/10 to-black/80 p-5">
              {soloRoom ? <><p className="text-center text-xs font-black uppercase tracking-[.25em] text-amber-300">Solo test session complete</p><h3 className="mt-3 text-center text-3xl font-black text-white">10:00 FINISHED</h3><p className="mt-2 text-center text-sm text-amber-100/65">የ10 ደቂቃ የሙከራ ውድድር ተጠናቋል።</p><button type="button" onClick={()=>{setSoloRoom(null);setThrottle(0);setSteer(0);setReverse(false);setBoost(false);setBrake(false);}} className="mt-5 w-full rounded-xl bg-yellow-300 p-3 font-black text-black">BACK TO CAR SELECT</button></> : room.winner && room.settlement ? <>
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Official race result</p><span className="rounded-full border border-emerald-400/40 bg-emerald-950/60 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">SERVER VERIFIED</span></div>
                <h3 className="mt-3 text-center text-2xl font-black text-white">{room.winner.name}</h3>
                <p className="mt-1 text-center font-mono text-lg font-black tracking-widest text-amber-300">{room.settlement.winnerPlateNumber}</p>
                <p className="mt-2 text-center text-2xl font-black text-emerald-300">{room.winner.payoutEtb.toFixed(2)} ETB</p>
                <p className="text-center text-[10px] uppercase tracking-widest text-amber-100/50">Simulation prize · 45% player pool</p>
                <p className="mt-2 text-center text-xs font-bold text-amber-100/80">Winner position: #{room.settlement?.finishOrder.find((item) => item.plateNumber === room.settlement?.winnerPlateNumber)?.position ?? '—'}</p>
                {state?.simulationOnly && <div className="mt-4 rounded-xl border border-sky-400/30 bg-sky-950/40 p-3 text-center"><p className="text-xs font-black uppercase tracking-widest text-sky-200">SIMULATION / TEST MODE</p><p className="mt-1 font-mono text-[11px] font-bold text-sky-100">REAL_MONEY_ENABLED=false</p><p className="mt-1 text-[10px] text-sky-100/70">Demo credits only · No real-money payment or wallet settlement</p></div>}
                <div className="mt-4 rounded-xl border border-amber-300/20 bg-black/45 p-3 text-xs">
                  <p className="font-black uppercase tracking-wider text-amber-200">How the pool is calculated</p>
                  <p className="mt-2 text-amber-100/80">Total entry pool: {room.settlement.totalEntryPoolEtb.toFixed(2)} ETB ({room.playerCount} players × {room.entryFeeEtb.toFixed(2)} ETB)</p>
                  <p className="mt-1 text-amber-100/80">Company share: {room.settlement.companyPercent}% · Prize pool: {room.settlement.poolPercent}%</p>
                  <p className="mt-1 text-amber-100/80">Prize payout = the lower of the {room.settlement.poolPercent}% pool and the 20,000 ETB maximum cap.</p>
                  <p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-amber-100/60">Maximum current room example: 8 × 500 ETB = 4,000 ETB total; company 55% = 2,200 ETB; prize pool 45% = 1,800 ETB. The 20,000 ETB figure is an upper payout limit, not a guaranteed prize.</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div className="rounded-lg bg-black/60 p-3"><p className="text-amber-100/50">Entry pool</p><b className="mt-1 block text-white">{room.settlement.totalEntryPoolEtb.toFixed(2)} ETB</b></div>
                  <div className="rounded-lg bg-black/60 p-3"><p className="text-amber-100/50">Company · 55%</p><b className="mt-1 block text-white">{room.settlement.companyShareEtb.toFixed(2)} ETB</b></div>
                  <div className="rounded-lg bg-black/60 p-3"><p className="text-amber-100/50">Prize · 45%</p><b className="mt-1 block text-emerald-300">{room.settlement.prizePoolEtb.toFixed(2)} ETB</b></div>
                  <div className="rounded-lg bg-black/60 p-3"><p className="text-amber-100/50">Payout cap</p><b className="mt-1 block text-white">{room.settlement.payoutCapEtb.toLocaleString()} ETB</b></div>
                </div>
                <div className="mt-4 rounded-lg border border-white/10 bg-black/50 p-3"><div className="flex flex-wrap justify-between gap-2 text-[10px] text-amber-100/60"><span>RESULT ID</span><span className="font-mono text-amber-200">{room.settlement.resultId}</span></div><div className="mt-1 flex justify-between gap-2 text-[10px] text-amber-100/60"><span>VERIFICATION</span><span>{room.settlement.verificationMethod} · {room.settlement.reason.replace('_', ' ')}</span></div></div>
                <div className="mt-4"><p className="mb-2 text-xs font-black uppercase tracking-widest text-amber-300">Final plate order</p><div className="space-y-1">{room.settlement.finishOrder.map((item) => <div key={item.plateNumber} className="flex items-center justify-between rounded-lg bg-black/50 px-3 py-2 text-xs"><span className="font-black text-amber-200">#{item.position} · {item.plateNumber}</span><span className={item.status === 'winner' ? 'font-black text-emerald-300' : item.status === 'eliminated' ? 'text-red-300' : 'text-amber-100/60'}>{item.status.toUpperCase()} · {item.progress}%</span></div>)}</div></div>
              </> : <p className="text-center text-lg font-black text-red-300">{room.endReason === 'host_stopped' ? t.stopped : t.allEliminated}</p>}
            </div>}
            <button onClick={() => {setSoloRoom(null);setThrottle(0);setSteer(0);setReverse(false);setBoost(false);setBrake(false);setNitroPercent(100);}} className={room.status === 'racing' ? "absolute left-3 top-3 z-30 rounded-lg border border-white/25 bg-black/70 px-3 py-2 text-xs text-white" : "mt-5 w-full rounded-xl border border-white/15 p-3 text-sm text-amber-100/70"}>{t.leave}</button>
          </div>
        </section>
      )}
      {settingsOpen&&<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"><section role="dialog" aria-modal="true" aria-labelledby="race-settings-title" className="w-full max-w-md rounded-3xl border border-amber-300/45 bg-[#080b12] p-5 text-amber-50 shadow-[0_0_60px_rgba(0,174,255,.18)]"><div className="flex items-center justify-between"><h2 id="race-settings-title" className="text-xl font-black text-yellow-300">GAME SETTINGS</h2><button type="button" onClick={()=>setSettingsOpen(false)} aria-label="Close settings" className="rounded-lg border border-white/20 px-3 py-1 text-lg">×</button></div><label className="mt-5 block text-xs font-black text-white">MASTER SOUND <span className="float-right text-sky-300">{Math.round(audioVolume*100)}%</span></label><input aria-label="Master sound volume" type="range" min="0" max="100" value={Math.round(audioVolume*100)} onChange={e=>setAudioVolume(Number(e.target.value)/100)} className="mt-3 w-full accent-sky-400"/><div className="mt-6"><p className="text-xs font-black text-white">GRAPHICS QUALITY</p><div className="mt-2 grid grid-cols-3 gap-2">{(['performance','balanced','ultra'] as const).map(q=><button key={q} type="button" aria-pressed={graphicsQuality===q} onClick={()=>setGraphicsQuality(q)} className={'rounded-xl border px-2 py-3 text-[10px] font-black uppercase '+(graphicsQuality===q?'border-yellow-300 bg-yellow-300 text-black':'border-white/20 bg-black/50 text-white')}>{q}</button>)}</div></div><div className="mt-6"><p className="text-xs font-black text-white">DRIVING CAMERA</p><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" aria-pressed={drivingView==='chase'} onClick={()=>setDrivingView('chase')} className={'rounded-xl border p-3 text-xs font-black '+(drivingView==='chase'?'border-yellow-300 bg-yellow-300 text-black':'border-white/20 text-white')}>CHASE VIEW</button><button type="button" aria-pressed={drivingView==='cockpit'} onClick={()=>setDrivingView('cockpit')} className={'rounded-xl border p-3 text-xs font-black '+(drivingView==='cockpit'?'border-yellow-300 bg-yellow-300 text-black':'border-white/20 text-white')}>COCKPIT VIEW</button></div></div><button type="button" onClick={()=>setSettingsOpen(false)} className="mt-6 w-full rounded-xl bg-gradient-to-r from-yellow-300 to-amber-500 p-3 font-black text-black">SAVE SETTINGS</button></section></div>}
    </main>
  );
}
