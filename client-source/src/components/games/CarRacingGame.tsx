import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';

type Car = { id: string; name: string; length: number; width: number; speed: number; handling: number; color: string };
type Track = { id: string; name: string; terrain: string; surface: string; environment: 'city' | 'country' | 'rocky' | 'coastal'; scenery: string[]; speedFactor: number; grip: number; curveType: 'straight' | 'left' | 'right' | 's-bend'; curveIntensity: number; wallLimit: number; obstacles: { at: number; lane: number; width: number; type: string }[] };
type Player = { userId: string; name: string; car: string; carId: string; plateNumber: string; ready: boolean; progress: number; lane: number; speed: number; finished: boolean; damage: number; collisionEvent: { id: string; at: number; type: string; severity: 'light' | 'medium' | 'severe'; participants: string[] } | null; eliminated: boolean; eliminationReason: string | null; eliminatedAt: number | null; isMe: boolean };
type Room = { roomId: string; code: string; status: 'lobby' | 'countdown' | 'racing' | 'finished'; track: Track; entryFeeEtb: number; playerCount: number; maxPlayers: number; poolEtb: number; companyShareEtb: number; prizePoolEtb: number; countdownEndsAt: number | null; startedAt: number | null; winner: { userId: string; name: string; plateNumber: string; payoutEtb: number } | null; endReason?: string; collisionEvents?: { id: string; at: number; type: string; severity: 'light' | 'medium' | 'severe'; participants: string[] }[]; players: Player[] };
type State = { enabled: boolean; simulationOnly: boolean; balanceEtb: number; maxPrizeEtb: number; companyPercent: number; poolPercent: number; cars: Car[]; tracks: Track[]; openRooms: { code: string; track: string; players: number; entryFeeEtb: number }[]; room: Room | null };
type DrivingView = 'chase' | 'cockpit';
const labels = {
  am: { title: 'MULTIPLAYER CAR RACING', subtitle: 'በአንድ ውድድር ከሌሎች ተጫዋቾች ጋር ይወዳደሩ', create: 'ውድድር ፍጠር', join: 'በኮድ ግባ', fee: 'የመግቢያ ክሬዲት (ETB)', code: 'የውድድር ኮድ', choose: 'መኪና ምረጥ', exterior: 'የውጭ እይታ', interior: 'የውስጥ እይታ', chase: 'የውጭ መንጃ እይታ', cockpit: 'የካቢና መንጃ እይታ', reverse: 'ኋላ', boost: 'ናይትሮ', eliminated: 'ከውድድሩ ውጪ ሆኗል', collision: 'ግጭት ተፈጥሯል', wall: 'የመንገድ ግድግዳ', barrier: 'መሰናክል', rocks: 'ድንጋይ', boulder: 'ትልቅ ድንጋይ', logs: 'እንጨት', debris: 'የመንገድ ቆሻሻ', rockfall: 'የድንጋይ መውደቅ', allEliminated: 'ሁሉም ተወዳዳሪዎች ከውድድሩ ውጪ ሆነዋል', plate: 'የታርጋ ቁጥር', ready: 'ዝግጁ ነኝ', waiting: 'ሌሎችን በመጠበቅ ላይ', start: 'ውድድሩ ይጀምራል', drive: 'ጋዝ', left: 'ግራ', right: 'ቀኝ', back: 'ተመለስ', rooms: 'ክፍት ውድድሮች', balance: 'የሙከራ ክሬዲት', pool: 'የሽልማት Pool', company: 'የድርጅት ድርሻ', result: 'አሸናፊ', payout: 'የሙከራ ሽልማት', demo: 'SIMULATION ብቻ · እውነተኛ ገንዘብ የለም', full: 'ውድድሩ ሞልቷል', leave: 'ውጣ', error: 'ጨዋታውን ማስኬድ አልተቻለም', countdown: 'ይጀምራል…' },
  ti: { title: 'MULTIPLAYER CAR RACING', subtitle: 'ምስ ካልኦት ተጻወትቲ ብሓደ ውድድር ተወዳደሩ', create: 'ውድድር ፍጠር', join: 'ብኮድ እቶ', fee: 'ናይ ምእታዊ ክረዲት', code: 'ኮድ ውድድር', choose: 'መኪና ምረጽ', exterior: 'ደጋዊ ርእይቶ', interior: 'ውሽጣዊ ርእይቶ', chase: 'ደጋዊ ኣነዳድራ', cockpit: 'ናይ ካቢና ኣነዳድራ', reverse: 'ድሕሪት', boost: 'ናይትሮ', eliminated: 'ካብ ውድድር ወጺኡ', collision: 'ግጭት ኣጋጢሙ', wall: 'መንደቕ መንገዲ', barrier: 'ዕንቅፋት', rocks: 'ኣእማን', boulder: 'ዓቢ እምኒ', logs: 'ዕንጸይቲ', debris: 'ፍርስራስ', rockfall: 'ምውዳቕ ኣእማን', allEliminated: 'ኩሎም ተወዳደርቲ ካብ ውድድር ወጺኦም', plate: 'ቁጽሪ ታርጋ', ready: 'ድሉው እየ', waiting: 'ካልኦት ይጽበ', start: 'ውድድር ይጅምር', drive: 'ጋዝ', left: 'ጸጋም', right: 'የማን', back: 'ተመለስ', rooms: 'ክፉታት ውድድራት', balance: 'ናይ ፈተነ ክረዲት', pool: 'Prize Pool', company: 'ናይ ትካል ክፋል', result: 'ተዓዋቲ', payout: 'ናይ ፈተነ ሽልማት', demo: 'SIMULATION ጥራይ · ሓቀኛ ገንዘብ የለን', full: 'ውድድር መሊኡ', leave: 'ውጻእ', error: 'ጸወታ ምክያድ ኣይተኻእለን', countdown: 'ይጅምር…' },
  en: { title: 'MULTIPLAYER CAR RACING', subtitle: 'Race live against players on their own phones', create: 'Create race', join: 'Join with code', fee: 'Entry credits (ETB)', code: 'Race code', choose: 'Choose your car', exterior: 'Exterior view', interior: 'Interior view', chase: 'Outside / Chase', cockpit: 'Inside / Cockpit', reverse: 'REVERSE', boost: 'BOOST', eliminated: 'ELIMINATED', collision: 'Crash', wall: 'Track wall', barrier: 'Barrier', rocks: 'Rocks', boulder: 'Boulder', logs: 'Logs', debris: 'Road debris', rockfall: 'Rockfall', allEliminated: 'All drivers were eliminated', plate: 'Plate number', ready: "I'm ready", waiting: 'Waiting for other drivers', start: 'Race starts', drive: 'THROTTLE', left: 'LEFT', right: 'RIGHT', back: 'Back', rooms: 'Open races', balance: 'Demo credits', pool: 'Prize pool', company: 'Company share', result: 'Winner', payout: 'Simulation prize', demo: 'SIMULATION ONLY · NO REAL MONEY', full: 'Room is full', leave: 'Leave', error: 'Could not load the race', countdown: 'Starting…' },
};

function CarPreview({ car, view }: { car: Car; view: 'exterior' | 'interior' }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-amber-300/15 bg-[radial-gradient(ellipse_at_top,rgba(202,158,57,.13),transparent_65%),#050505] p-3">
      <svg viewBox="0 0 360 170" role="img" aria-label={`${car.name} ${view} preview`} className="h-36 w-full sm:h-44">
        {view === 'exterior' ? (
          <>
            <ellipse cx="180" cy="142" rx="126" ry="10" fill="#000" opacity=".65" />
            <path d="M45 112 L61 86 Q72 75 103 72 L135 43 Q145 33 171 33 L226 36 Q242 37 254 52 L282 78 Q306 82 315 98 L319 119 Q319 130 305 132 L57 132 Q40 130 45 112Z" fill={car.color} stroke="#f8e7b4" strokeOpacity=".55" strokeWidth="2" />
            <path d="M119 73 L145 47 Q151 42 169 42 L188 43 L188 73Z" fill="#101b27" stroke="#d9e8f5" strokeOpacity=".45" />
            <path d="M198 44 L224 46 Q236 47 246 60 L260 75 L198 73Z" fill="#101b27" stroke="#d9e8f5" strokeOpacity=".45" />
            <path d="M58 91 L103 82 L110 112 L52 112Z" fill="#111" opacity=".7" />
            <path d="M266 84 L299 96 L305 111 L275 111Z" fill="#111" opacity=".7" />
            <rect x="292" y="113" width="17" height="7" rx="2" fill="#fff2c7" />
            <rect x="53" y="113" width="17" height="7" rx="2" fill="#fff2c7" />
            <circle cx="103" cy="127" r="20" fill="#080808" stroke="#a8a8a8" strokeWidth="5" /><circle cx="103" cy="127" r="8" fill="#555" />
            <circle cx="264" cy="127" r="20" fill="#080808" stroke="#a8a8a8" strokeWidth="5" /><circle cx="264" cy="127" r="8" fill="#555" />
            <path d="M137 86 L224 86" stroke="#fff" strokeOpacity=".22" strokeWidth="2" />
          </>
        ) : (
          <>
            <path d="M20 120 Q180 82 340 120 L340 160 L20 160Z" fill="#171717" stroke="#a8873e" strokeWidth="2" />
            <path d="M35 95 Q180 18 325 95 L340 119 Q180 93 20 119Z" fill="#172634" stroke="#9bb5c9" strokeOpacity=".55" strokeWidth="3" />
            <path d="M35 100 Q180 32 325 100" fill="none" stroke="#d5e7f4" strokeOpacity=".22" strokeWidth="3" />
            <path d="M28 123 Q180 94 332 123" stroke={car.color} strokeWidth="9" fill="none" />
            <circle cx="104" cy="111" r="35" fill="none" stroke="#d5d5d5" strokeWidth="8" />
            <circle cx="104" cy="111" r="8" fill="#b8b8b8" />
            <path d="M104 111 L82 88 M104 111 L126 88 M104 111 L104 146" stroke="#c9c9c9" strokeWidth="6" strokeLinecap="round" />
            <rect x="160" y="112" width="115" height="31" rx="7" fill="#080808" stroke="#b48b3d" strokeWidth="2" />
            <circle cx="181" cy="127" r="9" fill="#0b1116" stroke="#e5c36b" strokeWidth="2" />
            <circle cx="210" cy="127" r="9" fill="#0b1116" stroke="#e5c36b" strokeWidth="2" />
            <path d="M233 119 L262 119 M233 127 L262 127 M233 135 L262 135" stroke="#b9c7d2" strokeWidth="2" />
            <rect x="292" y="116" width="24" height="19" rx="4" fill={car.color} />
          </>
        )}
      </svg>
      <p className="text-center text-[10px] font-bold uppercase tracking-[.2em] text-amber-200/65">{car.name} · {view === 'exterior' ? 'EXTERIOR' : 'COCKPIT'}</p>
    </div>
  );
}

function DrivingScene({ view, players, me, cars, speed, steer, track, boost, rank }: { view: DrivingView; players: Player[]; me: Player; cars: Car[]; speed: number; steer: number; track: Track; boost: boolean; rank: number }) {
  const others = players.filter((p) => !p.isMe && !p.finished);
  const roadPath = track.curveType === 'left' ? 'M360 160 C345 245 245 330 105 460 L505 460 C600 340 610 245 575 160 Z' : track.curveType === 'right' ? 'M325 160 C290 245 300 330 395 460 L795 460 C650 330 600 245 575 160 Z' : track.curveType === 's-bend' ? 'M310 160 C430 230 250 330 370 460 L770 460 C640 330 820 230 590 160 Z' : 'M310 160 L590 160 L850 460 L50 460 Z';
  const centerPath = track.curveType === 'left' ? 'M468 160 C465 245 360 330 305 460' : track.curveType === 'right' ? 'M432 160 C420 245 500 330 595 460' : track.curveType === 's-bend' ? 'M450 160 C535 230 365 330 570 460' : 'M450 160 L450 460';
  const sprite = (p: Player, index: number, own = false) => {
    const color = cars.find((c) => c.id === p.carId)?.color ?? '#e9ad3b';
    const delta = p.progress - me.progress;
    const x = 450 + p.lane * (view === 'cockpit' ? 90 : 115);
    const y = own ? 350 : Math.max(145, Math.min(305, 245 - delta * 1.45));
    const scale = own ? 1 : Math.max(.34, Math.min(.72, 0.58 - Math.abs(delta) / 2200));
    return <g key={p.userId || index} transform={`translate(${x} ${y}) scale(${scale})`} className={p.collisionEvent && Date.now() - p.collisionEvent.at < 1000 ? 'animate-pulse' : undefined}>
      <path d="M-45 24 L-38 -22 Q-34 -39 -20 -42 L20 -42 Q34 -39 38 -22 L45 24 Q44 35 32 37 L-32 37 Q-44 35 -45 24Z" fill={color} stroke="#f8e7b4" strokeWidth="3" />
      <path d="M-27 -18 Q-22 -34 -12 -34 L12 -34 Q22 -34 27 -18 L25 -5 L-25 -5Z" fill="#152330" stroke="#b7c9d7" strokeWidth="2" />
      <rect x="-38" y="15" width="12" height="8" rx="2" fill="#fff0b9" /><rect x="26" y="15" width="12" height="8" rx="2" fill="#fff0b9" />
      <rect x="-25" y="25" width="50" height="12" rx="2" fill="#fff8df" stroke="#171717" strokeWidth="2" /><text x="0" y="33.5" textAnchor="middle" fontSize="7" fontWeight="900" letterSpacing=".35" fill="#111">{p.plateNumber}</text>{own && boost && <g><path d="M-23 38 Q-30 55 -18 67 Q-10 54 -14 39Z M23 38 Q30 55 18 67 Q10 54 14 39Z" fill="#31c8ff" opacity=".95"/><path d="M-19 39 Q-22 50 -17 56 M19 39 Q22 50 17 56" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></g>}
      {p.collisionEvent && Date.now() - p.collisionEvent.at < 1600 && <g><circle r={p.collisionEvent.severity === 'severe' ? 58 : p.collisionEvent.severity === 'medium' ? 40 : 25} fill="none" stroke={p.collisionEvent.severity === 'severe' ? '#ff4b35' : '#ffd166'} strokeWidth="7" strokeDasharray="9 7"/><path d="M-35 -40l-10 -18m80 18l10 -18M-45 20l-18 8m108 -8l18 8" stroke="#fff1b8" strokeWidth="6" strokeLinecap="round"/><circle cx="-20" cy="-25" r="16" fill="#aeb8c0" opacity=".25"/><circle cx="20" cy="-28" r="13" fill="#aeb8c0" opacity=".2"/></g>}
      {p.eliminated && <><path d="M-24 -48 L24 -48" stroke="#ef4444" strokeWidth="7" strokeLinecap="round" /><text x="0" y="-57" textAnchor="middle" fontSize="13" fontWeight="black" fill="#fecaca">CRASH</text></>}
    </g>;
  };
  return <svg viewBox="0 0 900 460" role="img" aria-label={view === 'chase' ? 'Outside chase driving view' : 'Inside cockpit driving view'} className="h-auto max-h-[58vh] w-full rounded-2xl">
    <defs><linearGradient id="raceSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#172b35"/><stop offset="1" stopColor="#65705c"/></linearGradient><linearGradient id="raceRoad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#414141"/><stop offset="1" stopColor="#171717"/></linearGradient></defs>
    <rect width="900" height="460" fill="url(#raceSky)" />
    {track.environment === 'city' && <g fill="#263541" stroke="#647786" strokeWidth="3"><path d="M0 205V80H92V205M105 205V42H205V205M700 205V62H790V205M805 205V105H900V205"/><path d="M20 100h15m20 0h15m-50 35h15m20 0h15M125 75h18m22 0h18m-58 38h18m22 0h18M720 95h16m18 0h16m-50 38h16m18 0h16" stroke="#f2cb70" strokeWidth="7"/><path d="M40 205v-35m820 35v-35" stroke="#e8d6a5" strokeWidth="4"/></g>}
    {track.environment === 'country' && <g><rect y="170" width="900" height="290" fill="#355d32"/><path d="M0 205Q150 135 300 205T600 205T900 205" fill="none" stroke="#79a84a" strokeWidth="18"/><g fill="#234b2a" stroke="#8a7047" strokeWidth="5">{[70,170,730,830].map((x)=><g key={x}><path d={`M${x} 205V135`} /><circle cx={x} cy="120" r="35" fill="#397d3e"/></g>)}</g></g>}
    {track.environment === 'rocky' && <g><rect y="170" width="900" height="290" fill="#51483e"/><path d="M0 210L130 60L245 195L370 35L520 205L680 55L820 195L900 115V460H0Z" fill="#655d54" stroke="#a39a8d" strokeWidth="5"/><path d="M0 205L180 145L290 215L430 125L600 215L760 150L900 210" fill="none" stroke="#c2b7a5" strokeWidth="8"/></g>}
    {track.environment === 'coastal' && <g><rect y="160" width="900" height="300" fill="#15566b"/><path d="M0 190Q100 165 200 190T400 190T600 190T800 190T1000 190" fill="none" stroke="#8ed9e5" strokeWidth="9"/><path d="M0 235Q100 210 200 235T400 235T600 235T800 235T1000 235" fill="none" stroke="#4db3c7" strokeWidth="6"/><path d="M0 275L900 245V460H0Z" fill="#c6b58b" opacity=".45"/></g>}
    <path d={roadPath} fill={track.environment === 'country' ? '#80613c' : track.environment === 'rocky' ? '#6d675e' : track.environment === 'coastal' ? '#263b45' : 'url(#raceRoad)'} stroke={track.environment === 'coastal' ? '#d8e9e9' : '#c5b98b'} strokeWidth="5" />
    <path d={centerPath} stroke="#e7e1c8" strokeOpacity=".7" strokeWidth="5" strokeDasharray="30 26" />
    {track.obstacles.filter((obstacle) => obstacle.at / 10 > me.progress && obstacle.at / 10 < me.progress + 28).map((obstacle) => <g key={obstacle.at} transform={`translate(${450 + obstacle.lane * 105} ${Math.max(190, 390 - (obstacle.at / 10 - me.progress) * 7)})`}>{obstacle.type === 'barrier' ? <><rect x="-24" y="-12" width="48" height="24" rx="3" fill="#eee7d5" stroke="#b52f2f" strokeWidth="3"/><path d="M-18 -9l12 18m5 -18l12 18" stroke="#b52f2f" strokeWidth="6"/></> : obstacle.type === 'logs' ? <><rect x="-27" y="-8" width="54" height="16" rx="8" fill="#80532f" stroke="#d5a46c" strokeWidth="3"/><circle cx="-24" cy="0" r="7" fill="#d7b17b"/></> : obstacle.type === 'rocks' || obstacle.type === 'boulder' || obstacle.type === 'rockfall' ? <><path d="M-25 10L-19 -10L-5 -19L12 -14L26 8L18 15H-18Z" fill="#827d74" stroke="#d1c8b8" strokeWidth="3"/><path d="M-8 -10l10 -5 7 8" fill="none" stroke="#eee" strokeOpacity=".5" strokeWidth="3"/></> : <><path d="M-25 8L-12 -10L2 5L17 -14L27 10Z" fill="#9a9a92" stroke="#e4e4dc" strokeWidth="2"/></>}</g>)}
    {others.map((p, i) => sprite(p, i))}
    {view === 'chase' ? <>
      {sprite(me, -1, true)}
      <rect x="18" y="18" width="200" height="42" rx="12" fill="#050505" fillOpacity=".72"/><text x="34" y="45" fill="#f6d889" fontSize="18" fontWeight="bold">{track.name.toUpperCase()}</text>
      <rect x="690" y="14" width="196" height="76" rx="14" fill="#050505" fillOpacity=".9" stroke="#d5ad53" strokeWidth="2"/><text x="788" y="47" fill="#fff0bc" fontSize="30" textAnchor="middle" fontWeight="900">{Math.round(speed)}</text><text x="788" y="68" fill="#d6cba9" fontSize="12" textAnchor="middle">KM/H</text><rect x="18" y="70" width="202" height="38" rx="10" fill="#050505" fillOpacity=".9" stroke="#d5ad53"/><text x="32" y="95" fill="#fff0bc" fontSize="16" fontWeight="900">P{rank} / {players.length}</text><text x="112" y="95" fill="#d6cba9" fontSize="12">POSITION</text><rect x="690" y="100" width="196" height="35" rx="9" fill="#050505" fillOpacity=".9" stroke="#55cfff"/><text x="702" y="122" fill="#8be6ff" fontSize="13" fontWeight="900">N₂O</text><rect x="744" y="111" width="126" height="10" rx="5" fill="#24313a"/><rect x="744" y="111" width={boost ? 126 : 0} height="10" rx="5" fill="#32cfff"/><text x="870" y="106" fill="#fff" fontSize="9" textAnchor="end">{boost ? "ACTIVE" : "READY"}</text><rect x="240" y="18" width="390" height="34" rx="9" fill="#050505" fillOpacity=".85" stroke="#d5ad53"/><text x="435" y="40" fill="#fff0bc" fontSize="15" textAnchor="middle" fontWeight="900" letterSpacing="1.2">{me.plateNumber}</text>
    </> : <>
      <path d="M0 285 Q180 255 320 284 L580 284 Q720 255 900 285 L900 460 L0 460Z" fill="#101112" stroke="#5c5140" strokeWidth="5" />
      <path d="M0 301 Q180 270 320 300 M580 300 Q720 270 900 301" fill="none" stroke="#9e895c" strokeWidth="5" />
      <rect x="330" y="305" width="240" height="68" rx="13" fill="#050708" stroke="#a88b4b" strokeWidth="4"/><text x="450" y="342" fill="#8ee5b0" textAnchor="middle" fontSize="34" fontWeight="900">{Math.round(speed)} KM/H</text><text x="450" y="360" fill="#d6cba9" textAnchor="middle" fontSize="11">GEAR D · POSITION {rank}/{players.length}</text><rect x="18" y="18" width="260" height="48" rx="11" fill="#050708" fillOpacity=".92" stroke="#d5ad53" strokeWidth="2"/><text x="148" y="48" fill="#fff0bc" fontSize="19" textAnchor="middle" fontWeight="900" letterSpacing="1">{me.plateNumber}</text><rect x="622" y="18" width="260" height="48" rx="11" fill="#050708" fillOpacity=".92" stroke="#55cfff" strokeWidth="2"/><text x="640" y="48" fill="#8be6ff" fontSize="17" fontWeight="900">N₂O</text><rect x="700" y="35" width="162" height="12" rx="6" fill="#24313a"/><rect x="700" y="35" width={boost ? 162 : 0} height="12" rx="6" fill="#32cfff"/><text x="860" y="29" fill="#fff" fontSize="10" textAnchor="end">{boost ? "ACTIVE" : "READY"}</text>{boost && <g opacity=".95"><path d="M250 285l-90 -35m110 48l-110 -8m480 -5l110 -35m-130 48l110 -8" stroke="#45d7ff" strokeWidth="8" strokeLinecap="round"/><path d="M265 300l-55 -10m425 10l55 -10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></g>}
      <circle cx="450" cy="405" r="70" fill="none" stroke="#090a0a" strokeWidth="20"/><circle cx="450" cy="405" r="55" fill="none" stroke="#777" strokeWidth="5"/><path d="M450 405 L450 350 M450 405 L405 438 M450 405 L495 438" stroke="#b7b7b7" strokeWidth="12" strokeLinecap="round" transform={`rotate(${steer * 22} 450 405)`}/><circle cx="450" cy="405" r="13" fill="#b38c3f"/>
      <text x="42" y="350" fill="#e8d49e" fontSize="14" fontWeight="bold">DASHBOARD</text><text x="858" y="350" fill="#e8d49e" fontSize="14" textAnchor="end">{track.name.toUpperCase()}</text>
    </>}
  </svg>;
}

export function CarRacingGame({ onBack }: { onBack: () => void }) {
  const { lang } = useLanguage();
  const t = labels[lang] ?? labels.en;
  const [state, setState] = useState<State | null>(null);
  const [entryFee, setEntryFee] = useState(10);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [throttle, setThrottle] = useState(0);
  const [steer, setSteer] = useState(0);
  const [reverse, setReverse] = useState(false);
  const [boost, setBoost] = useState(false);
  const [drivingView, setDrivingView] = useState<DrivingView>('chase');
  const [clock, setClock] = useState(Date.now());
  const [previewView, setPreviewView] = useState<'exterior' | 'interior'>('exterior');
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
    if (!room || room.status !== 'racing' || me?.eliminated) { setThrottle(0); setSteer(0); setReverse(false); setBoost(false); return; }
    const send = () => void api.post('/api/games/car-racing/control', { roomId: room.roomId, throttle, steer, reverse, boost }).catch(() => undefined);
    send();
    const timer = window.setInterval(send, 650);
    return () => window.clearInterval(timer);
  }, [room?.roomId, room?.status, me?.eliminated, throttle, steer, reverse, boost]);
  const act = async (path: string, body: unknown) => {
    setBusy(true); setError('');
    try { await api.post(path, body); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : t.error); }
    finally { setBusy(false); }
  };
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
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[.25em] text-amber-400">{room.track.terrain} · {room.track.surface}</p><h2 className="text-xl font-black">{room.track.name}</h2><p className="mt-1 text-[10px] uppercase tracking-wider text-amber-100/45">{room.track.curveType.toUpperCase()} TRACK · GRIP {Math.round(room.track.grip * 100)}%</p></div><div className="text-right text-xs"><p>{t.pool}: <b>{room.prizePoolEtb.toFixed(2)} ETB</b></p><p className="text-amber-100/50">{t.company}: {room.companyShareEtb.toFixed(2)} ETB</p></div></div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-200 transition-all" style={{ width: progress + '%' }} /></div>
            {me && <div className="mt-3"><div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-amber-100/60"><span>Vehicle damage</span><span>{me.damage}%</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full transition-all ${me.damage >= 70 ? 'bg-red-500' : me.damage >= 35 ? 'bg-orange-400' : 'bg-emerald-400'}`} style={{ width: me.damage + '%' }} /></div></div>}
            <div className="mt-2 flex justify-between text-[10px] text-amber-100/45"><span>START</span><span>{progress}%</span><span>FINISH</span></div>
            <div className="mt-5 space-y-2">{room.players.map((p) => <div key={p.userId} className="rounded-xl border border-white/10 bg-black/40 p-3"><div className="flex justify-between gap-2 text-xs"><b>{p.name} · {p.car}</b><span className="font-mono text-amber-300">{p.plateNumber}</span><span>{p.eliminated ? `${t.eliminated} · ${t[p.eliminationReason as keyof typeof t] ?? t.collision}` : p.finished ? 'FINISHED' : p.ready ? 'READY' : 'WAITING'}</span></div><div className="mt-2 h-2 overflow-hidden rounded bg-white/10"><div className="h-full bg-amber-400" style={{ width: p.progress + '%' }} /></div></div>)}</div>
            {room.status === 'lobby' && <div className="mt-5"><h3 className="font-bold">{t.choose}</h3><div className="mt-3 grid grid-cols-2 gap-2">{state?.cars.map((c) => <button key={c.id} onClick={() => void act('/api/games/car-racing/car', { roomId: room.roomId, carId: c.id })} className={`rounded-xl border p-3 text-left text-xs ${me?.carId === c.id ? 'border-amber-300 bg-amber-300/10' : 'border-white/10'}`}><span className="block text-base">🏎️</span><b>{c.name}</b><span className="mt-1 block text-amber-100/50">Speed {Math.round(c.speed * 100)} · Handling {Math.round(c.handling * 100)}</span></button>)}</div>{me && state?.cars.find((c) => c.id === me.carId) && <div className="mt-4 rounded-2xl border border-amber-300/20 bg-black/35 p-3 sm:p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-black text-amber-100">{state.cars.find((c) => c.id === me.carId)?.name}</h4><span className="rounded-lg border border-amber-300/35 bg-amber-300/10 px-3 py-1.5 font-mono text-sm font-black tracking-widest text-amber-200">{me.plateNumber}</span></div><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setPreviewView('exterior')} className={`rounded-lg border px-3 py-2 text-xs font-bold ${previewView === 'exterior' ? 'border-amber-300 bg-amber-300/15 text-amber-100' : 'border-white/10 text-amber-100/55'}`}>{t.exterior}</button><button type="button" onClick={() => setPreviewView('interior')} className={`rounded-lg border px-3 py-2 text-xs font-bold ${previewView === 'interior' ? 'border-amber-300 bg-amber-300/15 text-amber-100' : 'border-white/10 text-amber-100/55'}`}>{t.interior}</button></div><div className="mt-3"><CarPreview car={state.cars.find((c) => c.id === me.carId)!} view={previewView} /></div><p className="mt-2 text-center text-[10px] text-amber-100/45">{t.plate}: {me.plateNumber}</p></div>}<button disabled={busy || room.players.length < 2} onClick={() => void act('/api/games/car-racing/ready', { roomId: room.roomId, ready: true })} className="mt-4 w-full rounded-xl bg-amber-300 p-3 font-black text-black disabled:opacity-40">{t.ready}</button><p className="mt-2 text-center text-xs text-amber-100/45">{room.players.length < 2 ? t.waiting : t.start}</p></div>}
            {room.status === 'countdown' && <p className="mt-6 text-center text-4xl font-black text-amber-300">{countdown || t.countdown}</p>}
            {room.status === 'racing' && <div className="mt-5"><div className="mb-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setDrivingView('chase')} aria-pressed={drivingView === 'chase'} className={`rounded-xl border px-3 py-3 text-xs font-black ${drivingView === 'chase' ? 'border-amber-300 bg-amber-300/15 text-amber-100' : 'border-white/10 text-amber-100/55'}`}>{t.chase}</button><button type="button" onClick={() => setDrivingView('cockpit')} aria-pressed={drivingView === 'cockpit'} className={`rounded-xl border px-3 py-3 text-xs font-black ${drivingView === 'cockpit' ? 'border-amber-300 bg-amber-300/15 text-amber-100' : 'border-white/10 text-amber-100/55'}`}>{t.cockpit}</button></div>{me && <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
  <div className="rounded-xl border border-amber-300/30 bg-black/80 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Speed</p><p className="mt-1 text-2xl font-black tabular-nums text-white">{me.speed} <span className="text-xs text-amber-100/70">KM/H</span></p></div>
  <div className="rounded-xl border border-amber-300/30 bg-black/80 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Position</p><p className="mt-1 text-2xl font-black tabular-nums text-white">P{[...room.players].sort((a, b) => b.progress - a.progress).findIndex((p) => p.userId === me.userId) + 1}<span className="text-xs text-amber-100/70"> / {room.players.length}</span></p></div>
  <div className="col-span-2 rounded-xl border border-amber-300/30 bg-black/80 p-3 sm:col-span-1"><p className="text-[10px] font-black uppercase tracking-widest text-amber-300">BGB · LICENSE PLATE</p><p className="mt-1 break-all font-mono text-sm font-black tracking-wider text-amber-100">{me.plateNumber}</p></div>
  <div className="col-span-2 rounded-xl border border-sky-400/40 bg-slate-950/90 p-3 sm:col-span-1"><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-widest text-sky-300">N₂O Nitro</p><span className={boost ? "text-xs font-black text-sky-200 animate-pulse" : "text-xs font-bold text-slate-400"}>{boost ? "BOOST ACTIVE" : "READY"}</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-700"><div className={boost ? "h-full w-full rounded-full bg-sky-300 shadow-[0_0_12px_#38bdf8]" : "h-full w-1/4 rounded-full bg-sky-700"} /></div></div>
</div>}{me && <DrivingScene view={drivingView} players={room.players} me={me} cars={state?.cars ?? []} speed={me.speed} steer={steer} track={room.track} boost={boost} rank={[...room.players].sort((a, b) => b.progress - a.progress).findIndex((p) => p.userId === me.userId) + 1} />}{me?.eliminated ? <div role="alert" className="mt-4 rounded-2xl border border-red-500/50 bg-red-950/40 p-4 text-center"><p className="text-xl font-black text-red-300">{t.eliminated}</p><p className="mt-1 text-sm text-red-100/80">{t.collision}: {t[me.eliminationReason as keyof typeof t] ?? me.eliminationReason}</p><p className="mt-2 text-xs text-amber-100/60">You can watch the remaining drivers until this race ends.</p></div> : <div className="mt-4 grid grid-cols-5 gap-2 sm:gap-3" style={{ touchAction: 'none' }}><button type="button" onPointerDown={() => setSteer(-1)} onPointerUp={() => setSteer(0)} onPointerCancel={() => setSteer(0)} onPointerLeave={() => setSteer(0)} className="select-none rounded-xl border border-amber-300/40 bg-black/60 px-1 py-4 text-center text-xs font-black text-amber-200 active:bg-amber-300/20"><span className="block text-2xl">←</span>{t.left}</button><button type="button" onPointerDown={() => { setThrottle(1); setReverse(true); setBoost(false); }} onPointerUp={() => { setThrottle(0); setReverse(false); }} onPointerCancel={() => { setThrottle(0); setReverse(false); }} onPointerLeave={() => { setThrottle(0); setReverse(false); }} className="select-none rounded-xl border border-white/15 bg-[#202020] px-1 py-4 text-center text-xs font-black text-white active:bg-white/20"><span className="block text-2xl">▼</span>{t.reverse}</button><button type="button" onPointerDown={() => { setThrottle(1); setReverse(false); setBoost(false); }} onPointerUp={() => setThrottle(0)} onPointerCancel={() => setThrottle(0)} onPointerLeave={() => setThrottle(0)} className="select-none rounded-xl bg-amber-300 px-1 py-4 text-center text-xs font-black text-black active:bg-amber-200"><span className="block text-2xl">▲</span>{t.drive}</button><button type="button" onPointerDown={() => { setThrottle(1); setReverse(false); setBoost(true); }} onPointerUp={() => { setThrottle(0); setBoost(false); }} onPointerCancel={() => { setThrottle(0); setBoost(false); }} onPointerLeave={() => { setThrottle(0); setBoost(false); }} className="select-none rounded-xl border border-orange-300/50 bg-orange-950/50 px-1 py-4 text-center text-xs font-black text-orange-200 active:bg-orange-500/30"><span className="block text-2xl">⚡</span>{t.boost}</button><button type="button" onPointerDown={() => setSteer(1)} onPointerUp={() => setSteer(0)} onPointerCancel={() => setSteer(0)} onPointerLeave={() => setSteer(0)} className="select-none rounded-xl border border-amber-300/40 bg-black/60 px-1 py-4 text-center text-xs font-black text-amber-200 active:bg-amber-300/20"><span className="block text-2xl">→</span>{t.right}</button></div>}</div>}
            {room.status === 'finished' && <div className="mt-6 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-5 text-center">{room.winner ? <><p className="text-xs uppercase tracking-widest text-amber-300">{t.result}</p><h3 className="mt-2 text-2xl font-black">{room.winner.name}</h3><p className="mt-1 font-mono text-sm font-black tracking-widest text-amber-300">{room.winner.plateNumber}</p><p className="mt-2 text-lg text-amber-100">{t.payout}: {room.winner.payoutEtb.toFixed(2)} ETB</p></> : <p className="text-lg font-black text-red-300">{t.allEliminated}</p>}</div>}
            <button onClick={() => void act('/api/games/car-racing/leave', {})} className="mt-5 w-full rounded-xl border border-white/15 p-3 text-sm text-amber-100/70">{t.leave}</button>
          </div>
        </section>
      )}
    </main>
  );
}
