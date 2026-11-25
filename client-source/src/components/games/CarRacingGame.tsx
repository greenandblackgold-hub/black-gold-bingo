import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';

type Car = { id: string; name: string; speed: number; handling: number; color: string };
type Track = { id: string; name: string; terrain: string; speedFactor: number; grip: number };
type Player = { userId: string; name: string; car: string; carId: string; ready: boolean; progress: number; lane: number; speed: number; finished: boolean; isMe: boolean };
type Room = { roomId: string; code: string; status: 'lobby' | 'countdown' | 'racing' | 'finished'; track: Track; entryFeeEtb: number; playerCount: number; maxPlayers: number; poolEtb: number; companyShareEtb: number; prizePoolEtb: number; countdownEndsAt: number | null; startedAt: number | null; winner: { userId: string; name: string; payoutEtb: number } | null; players: Player[] };
type State = { enabled: boolean; simulationOnly: boolean; balanceEtb: number; maxPrizeEtb: number; companyPercent: number; poolPercent: number; cars: Car[]; tracks: Track[]; openRooms: { code: string; track: string; players: number; entryFeeEtb: number }[]; room: Room | null };
const labels = {
  am: { title: 'MULTIPLAYER CAR RACING', subtitle: 'በአንድ ውድድር ከሌሎች ተጫዋቾች ጋር ይወዳደሩ', create: 'ውድድር ፍጠር', join: 'በኮድ ግባ', fee: 'የመግቢያ ክሬዲት (ETB)', code: 'የውድድር ኮድ', choose: 'መኪና ምረጥ', ready: 'ዝግጁ ነኝ', waiting: 'ሌሎችን በመጠበቅ ላይ', start: 'ውድድሩ ይጀምራል', drive: 'ጋዝ', left: 'ግራ', right: 'ቀኝ', back: 'ተመለስ', rooms: 'ክፍት ውድድሮች', balance: 'የሙከራ ክሬዲት', pool: 'የሽልማት Pool', company: 'የድርጅት ድርሻ', result: 'አሸናፊ', payout: 'የሙከራ ሽልማት', demo: 'SIMULATION ብቻ · እውነተኛ ገንዘብ የለም', full: 'ውድድሩ ሞልቷል', leave: 'ውጣ', error: 'ጨዋታውን ማስኬድ አልተቻለም', countdown: 'ይጀምራል…' },
  ti: { title: 'MULTIPLAYER CAR RACING', subtitle: 'ምስ ካልኦት ተጻወትቲ ብሓደ ውድድር ተወዳደሩ', create: 'ውድድር ፍጠር', join: 'ብኮድ እቶ', fee: 'ናይ ምእታዊ ክረዲት', code: 'ኮድ ውድድር', choose: 'መኪና ምረጽ', ready: 'ድሉው እየ', waiting: 'ካልኦት ይጽበ', start: 'ውድድር ይጅምር', drive: 'ጋዝ', left: 'ጸጋም', right: 'የማን', back: 'ተመለስ', rooms: 'ክፉታት ውድድራት', balance: 'ናይ ፈተነ ክረዲት', pool: 'Prize Pool', company: 'ናይ ትካል ክፋል', result: 'ተዓዋቲ', payout: 'ናይ ፈተነ ሽልማት', demo: 'SIMULATION ጥራይ · ሓቀኛ ገንዘብ የለን', full: 'ውድድር መሊኡ', leave: 'ውጻእ', error: 'ጸወታ ምክያድ ኣይተኻእለን', countdown: 'ይጅምር…' },
  en: { title: 'MULTIPLAYER CAR RACING', subtitle: 'Race live against players on their own phones', create: 'Create race', join: 'Join with code', fee: 'Entry credits (ETB)', code: 'Race code', choose: 'Choose your car', ready: "I'm ready", waiting: 'Waiting for other drivers', start: 'Race starts', drive: 'THROTTLE', left: 'LEFT', right: 'RIGHT', back: 'Back', rooms: 'Open races', balance: 'Demo credits', pool: 'Prize pool', company: 'Company share', result: 'Winner', payout: 'Simulation prize', demo: 'SIMULATION ONLY · NO REAL MONEY', full: 'Room is full', leave: 'Leave', error: 'Could not load the race', countdown: 'Starting…' },
};

export function CarRacingGame({ onBack }: { onBack: () => void }) {
  const { lang } = useLanguage();
  const t = labels[lang] ?? labels.en;
  const [state, setState] = useState<State | null>(null);
  const [entryFee, setEntryFee] = useState(10);
  const [roomCode, setRoomCode] = useState('');
  const [selectedCar, setSelectedCar] = useState('sport');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [throttle, setThrottle] = useState(0);
  const [steer, setSteer] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const room = state?.room ?? null;
  const me = room?.players.find((p) => p.isMe);
  const load = useCallback(async () => {
    try { setState(await api.get<State>('/api/games/car-racing/state')); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : t.error); }
  }, [t.error]);
  useEffect(() => {
    void load();
    const poll = window.setInterval(() => { void load(); setClock(Date.now()); }, 700);
    return () => window.clearInterval(poll);
  }, [load]);
  useEffect(() => {
    if (!room || room.status !== 'racing') { setThrottle(0); setSteer(0); return; }
    const send = () => void api.post('/api/games/car-racing/control', { roomId: room.roomId, throttle, steer }).catch(() => undefined);
    send();
    const timer = window.setInterval(send, 650);
    return () => window.clearInterval(timer);
  }, [room?.roomId, room?.status, throttle, steer]);
  const act = async (path: string, body: unknown) => {
    setBusy(true); setError('');
    try { await api.post(path, body); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : t.error); }
    finally { setBusy(false); }
  };
  const car = useMemo(() => state?.cars.find((c) => c.id === selectedCar), [state?.cars, selectedCar]);
  const progress = me?.progress ?? 0;
  const countdown = room?.countdownEndsAt ? Math.max(0, Math.ceil((room.countdownEndsAt - clock) / 1000)) : 0;
  return (
    <main className="mx-auto min-h-[calc(100dvh-7rem)] w-full max-w-5xl space-y-4 px-3 pb-28 pt-4 text-amber-50 sm:px-5">
      <header className="rounded-3xl border border-amber-300/25 bg-[radial-gradient(ellipse_at_top_right,rgba(202,158,57,.2),transparent_48%),linear-gradient(120deg,#19150b,#080808)] p-5">
        <button onClick={onBack} className="mb-4 text-xs font-bold text-amber-300">← {t.back}</button>
        <p className="text-[10px] font-black tracking-[.3em] text-amber-400">BLACK GOLD · RACING LEAGUE</p>
        <h1 className="mt-2 text-2xl font-black sm:text-4xl">{t.title}</h1>
        <p className="mt-2 text-sm text-amber-100/60">{t.subtitle}</p>
        <p className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-center text-[10px] font-black tracking-wider text-amber-200">{t.demo}</p>
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs"><span>{t.balance}: <b>{state?.balanceEtb?.toFixed(2) ?? '—'} ETB</b></span><span>55% company / 45% pool · max 20,000 ETB</span></div>
      </header>
      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
      {!room ? (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-amber-300/20 bg-[#0d0d0b] p-5">
            <h2 className="text-lg font-black">{t.create}</h2>
            <label className="mt-4 block text-xs text-amber-100/60">{t.fee}</label>
            <input type="number" min={5} max={500} step={5} value={entryFee} onChange={(e) => setEntryFee(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-amber-300/20 bg-black p-3 text-amber-100" />
            <button disabled={busy} onClick={() => void act('/api/games/car-racing/rooms', { entryFeeEtb: entryFee })} className="mt-4 w-full rounded-xl bg-amber-300 p-3 font-black text-black disabled:opacity-50">{t.create}</button>
          </div>
          <div className="rounded-3xl border border-amber-300/20 bg-[#0d0d0b] p-5">
            <h2 className="text-lg font-black">{t.join}</h2>
            <label className="mt-4 block text-xs text-amber-100/60">{t.code}</label>
            <input value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))} className="mt-2 w-full rounded-xl border border-amber-300/20 bg-black p-3 font-mono uppercase tracking-[.25em] text-amber-100" />
            <button disabled={busy || roomCode.length !== 6} onClick={() => void act('/api/games/car-racing/join', { code: roomCode })} className="mt-4 w-full rounded-xl border border-amber-300/40 p-3 font-black text-amber-200 disabled:opacity-50">{t.join}</button>
          </div>
          <div className="rounded-3xl border border-amber-300/20 bg-[#0d0d0b] p-5 md:col-span-2">
            <h2 className="font-black">{t.rooms}</h2>
            {state?.openRooms.length ? state.openRooms.map((r) => <button key={r.code} onClick={() => void act('/api/games/car-racing/join', { code: r.code })} className="mt-2 flex w-full justify-between rounded-xl border border-white/10 p-3 text-left text-sm hover:border-amber-300/40"><span><b>{r.code}</b> · {r.track} · {r.players}/8</span><span>{r.entryFeeEtb} ETB</span></button>) : <p className="mt-3 text-sm text-amber-100/45">No open races yet.</p>}
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="rounded-3xl border border-amber-300/25 bg-[#0b0b09] p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[.25em] text-amber-400">{room.track.terrain}</p><h2 className="text-xl font-black">{room.track.name}</h2></div><div className="text-right text-xs"><p>{t.pool}: <b>{room.prizePoolEtb.toFixed(2)} ETB</b></p><p className="text-amber-100/50">{t.company}: {room.companyShareEtb.toFixed(2)} ETB</p></div></div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-200 transition-all" style={{ width: progress + '%' }} /></div>
            <div className="mt-2 flex justify-between text-[10px] text-amber-100/45"><span>START</span><span>{progress}%</span><span>FINISH</span></div>
            <div className="mt-5 space-y-2">{room.players.map((p) => <div key={p.userId} className="rounded-xl border border-white/10 bg-black/40 p-3"><div className="flex justify-between gap-2 text-xs"><b>{p.name} · {p.car}</b><span>{p.finished ? 'FINISHED' : p.ready ? 'READY' : 'WAITING'}</span></div><div className="mt-2 h-2 overflow-hidden rounded bg-white/10"><div className="h-full bg-amber-400" style={{ width: p.progress + '%' }} /></div></div>)}</div>
            {room.status === 'lobby' && <div className="mt-5"><h3 className="font-bold">{t.choose}</h3><div className="mt-3 grid grid-cols-2 gap-2">{state?.cars.map((c) => <button key={c.id} onClick={() => { setSelectedCar(c.id); void act('/api/games/car-racing/car', { roomId: room.roomId, carId: c.id }); }} className={`rounded-xl border p-3 text-left text-xs ${me?.carId === c.id ? 'border-amber-300 bg-amber-300/10' : 'border-white/10'}`}><span className="block text-base">🏎️</span><b>{c.name}</b><span className="mt-1 block text-amber-100/50">Speed {Math.round(c.speed * 100)} · Handling {Math.round(c.handling * 100)}</span></button>)}</div><button disabled={busy || room.players.length < 2} onClick={() => void act('/api/games/car-racing/ready', { roomId: room.roomId, ready: true })} className="mt-4 w-full rounded-xl bg-amber-300 p-3 font-black text-black disabled:opacity-40">{t.ready}</button><p className="mt-2 text-center text-xs text-amber-100/45">{room.players.length < 2 ? t.waiting : t.start}</p></div>}
            {room.status === 'countdown' && <p className="mt-6 text-center text-4xl font-black text-amber-300">{countdown || t.countdown}</p>}
            {room.status === 'racing' && <div className="mt-5"><div className="relative h-44 overflow-hidden rounded-2xl border border-amber-300/20 bg-[repeating-linear-gradient(0deg,#242424_0_30px,#1a1a1a_30px_60px)]"><div className="absolute inset-y-0 left-1/2 border-l-2 border-dashed border-white/30" /><div className="absolute inset-0 flex items-center justify-center text-6xl opacity-80">🏎️</div><div className="absolute bottom-2 left-3 text-[10px] font-bold text-white/60">{room.track.name.toUpperCase()}</div></div><div className="mt-4 grid grid-cols-3 gap-3"><button onPointerDown={() => setSteer(-1)} onPointerUp={() => setSteer(0)} onPointerLeave={() => setSteer(0)} className="rounded-xl border border-amber-300/40 py-5 font-black text-amber-200">← {t.left}</button><button onPointerDown={() => setThrottle(1)} onPointerUp={() => setThrottle(0)} onPointerLeave={() => setThrottle(0)} className="rounded-xl bg-amber-300 py-5 font-black text-black">▲ {t.drive}</button><button onPointerDown={() => setSteer(1)} onPointerUp={() => setSteer(0)} onPointerLeave={() => setSteer(0)} className="rounded-xl border border-amber-300/40 py-5 font-black text-amber-200">{t.right} →</button></div></div>}
            {room.status === 'finished' && <div className="mt-6 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-5 text-center"><p className="text-xs uppercase tracking-widest text-amber-300">{t.result}</p><h3 className="mt-2 text-2xl font-black">{room.winner?.name}</h3><p className="mt-2 text-lg text-amber-100">{t.payout}: {room.winner?.payoutEtb.toFixed(2)} ETB</p></div>}
            <button onClick={() => void act('/api/games/car-racing/leave', {})} className="mt-5 w-full rounded-xl border border-white/15 p-3 text-sm text-amber-100/70">{t.leave}</button>
          </div>
        </section>
      )}
    </main>
  );
}
