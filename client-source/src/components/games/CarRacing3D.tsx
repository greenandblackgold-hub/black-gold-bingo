import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import * as THREE from 'three';

// Rendering-only layer: server-authoritative race state continues to come from CarRacingGame/API.
export type RacingCar = { id: string; name: string; color: string; bodyStyle?: string };
export type RacingPlayer = { userId: string; name: string; carId: string; plateNumber: string; progress: number; lane: number; speed: number; finished: boolean; eliminated: boolean; isMe: boolean; collisionEvent: { id: string; at: number; type: string; severity: 'light' | 'medium' | 'severe'; participants: string[] } | null };
export type RacingTrack = { name: string; environment: 'city' | 'country' | 'rocky' | 'coastal'; curveType: 'straight' | 'left' | 'right' | 's-bend'; obstacles: { at: number; lane: number; width: number; type: string }[] };
export type RacingView = 'chase' | 'cockpit';
type Props = { view: RacingView; throttle: number; brake: boolean; players: RacingPlayer[]; me: RacingPlayer; cars: RacingCar[]; speed: number; steer: number; reverse: boolean; track: RacingTrack; boost: boolean; rank: number; startedAt: number; nitroPercent: number; audioVolume: number; graphicsQuality: 'performance'|'balanced'|'ultra'; soloMode: boolean; onSettings: () => void; onViewChange: (v: RacingView) => void; onSteer: (v: number) => void; onThrottle: (v: number, reverse?: boolean, boost?: boolean, brake?: boolean) => void; onGearChange: (reverse: boolean) => void };
type CarModel = { group: THREE.Group; wheels: THREE.Mesh[]; frontWheels: THREE.Mesh[] };

function plateTexture(plate: string) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) { ctx.fillStyle = '#f4edcf'; ctx.fillRect(0, 0, 512, 128); ctx.strokeStyle = '#171717'; ctx.lineWidth = 12; ctx.strokeRect(6, 6, 500, 116); ctx.fillStyle = '#111'; ctx.font = '900 54px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(plate.slice(0, 18), 256, 66); }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
function makeCar(color: string, plate: string, bodyStyle = 'coupe'): CarModel {
  const g = new THREE.Group(), wheels: THREE.Mesh[] = [], frontWheels: THREE.Mesh[] = [];
  const paint = new THREE.MeshStandardMaterial({ color, metalness: .7, roughness: .25 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#6f9bb0', metalness: .3, roughness: .14, transparent: true, opacity: .84 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#08090b', roughness: .95 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#c1c5c9', metalness: .9, roughness: .2 });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => { const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const suv = bodyStyle === 'suv', roadster = bodyStyle === 'roadster', hyper = ['hypercar','track','concept'].includes(bodyStyle), muscle = bodyStyle === 'muscle';
  const bodyLength = suv ? 4.45 : roadster ? 3.95 : hyper ? 4.05 : muscle ? 4.35 : 4.15;
  add(new THREE.BoxGeometry(suv?2.12:2.05,.58,bodyLength),paint,0,.72,0);
  add(new THREE.BoxGeometry(1.92,.18,1.22),paint,0,1.02,-1.34);
  add(new THREE.BoxGeometry(1.56,suv?.95:roadster?.48:.78,1.92),paint,0,suv?1.42:roadster?1.2:1.34,.08);
  const wind = add(new THREE.BoxGeometry(1.43,.53,.08),glass,0,1.39,-.91); wind.rotation.x=-.2;
  const rear = add(new THREE.BoxGeometry(1.4,.48,.07),glass,0,1.4,1.05); rear.rotation.x=.2;
  add(new THREE.BoxGeometry(1.55,.1,1.22),paint,0,suv?2.02:roadster?1.46:1.76,.05);
  // Sculpted body details: wheel arches, bumpers, grille, side glass and door lines.
  const dark=new THREE.MeshStandardMaterial({color:'#111820',metalness:.48,roughness:.42});
  const trim=new THREE.MeshStandardMaterial({color:'#aeb8c0',metalness:.88,roughness:.22});
  const lamp=new THREE.MeshStandardMaterial({color:'#fff5d8',emissive:'#ffe5a0',emissiveIntensity:2.4});
  const tailLamp=new THREE.MeshStandardMaterial({color:'#ed1835',emissive:'#b90022',emissiveIntensity:2.1});
  [-1,1].forEach(side=>{
    const arch=new THREE.Mesh(new THREE.TorusGeometry(.52,.095,8,28,Math.PI),paint);
    arch.rotation.z=Math.PI;arch.rotation.y=Math.PI/2;arch.position.set(side*1.02,.52,-1.34);g.add(arch);
    const rearArch=new THREE.Mesh(new THREE.TorusGeometry(.52,.095,8,28,Math.PI),paint);
    rearArch.rotation.z=Math.PI;rearArch.rotation.y=Math.PI/2;rearArch.position.set(side*1.02,.52,1.34);g.add(rearArch);
    const sideGlass=new THREE.Mesh(new THREE.BoxGeometry(.055,.47,1.48),glass);
    sideGlass.position.set(side*.965,1.39,.02);sideGlass.rotation.x=-.08;g.add(sideGlass);
    const doorLine=new THREE.Mesh(new THREE.BoxGeometry(.018,.48,1.5),dark);
    doorLine.position.set(side*1.035,.78,.1);g.add(doorLine);
    [-.62,.72].forEach(z=>{const handle=new THREE.Mesh(new THREE.BoxGeometry(.035,.045,.22),trim);handle.position.set(side*1.055,1.03,z);g.add(handle);});
    const mirror=new THREE.Mesh(new THREE.BoxGeometry(.28,.16,.34),paint);mirror.position.set(side*1.13,1.35,-.78);g.add(mirror);
    const mirrorGlass=new THREE.Mesh(new THREE.BoxGeometry(.018,.105,.23),trim);mirrorGlass.position.set(side*1.275,1.36,-.78);g.add(mirrorGlass);
    const skirt=new THREE.Mesh(new THREE.BoxGeometry(.12,.16,2.5),dark);skirt.position.set(side*1.01,.43,0);g.add(skirt);
    const frontFog=new THREE.Mesh(new THREE.CircleGeometry(.105,16),lamp);frontFog.position.set(side*.72,.55,-2.105);g.add(frontFog);
  });
  // Front fascia and rear diffuser.
  const grille=new THREE.Mesh(new THREE.BoxGeometry(1.05,.24,.055),dark);grille.position.set(0,.67,-2.12);g.add(grille);
  for(let i=0;i<5;i++){const slat=new THREE.Mesh(new THREE.BoxGeometry(.88,.018,.025),trim);slat.position.set(0,.59+i*.04,-2.155);g.add(slat);}
  const lowerLip=new THREE.Mesh(new THREE.BoxGeometry(1.95,.12,.24),dark);lowerLip.position.set(0,.42,-2.08);g.add(lowerLip);
  const rearDiffuser=new THREE.Mesh(new THREE.BoxGeometry(1.55,.16,.28),dark);rearDiffuser.position.set(0,.42,2.04);g.add(rearDiffuser);
  const spoilerWing=new THREE.Mesh(new THREE.BoxGeometry(1.9,.095,.34),new THREE.MeshStandardMaterial({color:'#10151d',metalness:.78,roughness:.22}));spoilerWing.position.set(0,1.98,1.82);g.add(spoilerWing);
  [-.62,.62].forEach(x=>{const support=new THREE.Mesh(new THREE.BoxGeometry(.065,.28,.09),chrome);support.position.set(x,1.84,1.78);g.add(support);});
  [-.78,.78].forEach(x=>{const head=new THREE.Mesh(new THREE.BoxGeometry(.48,.16,.07),lamp);head.position.set(x,.88,-2.12);g.add(head);const rearLight=new THREE.Mesh(new THREE.BoxGeometry(.48,.18,.07),tailLamp);rearLight.position.set(x,.87,2.12);g.add(rearLight);});
  // Roof glass and panoramic windshield trim.
  const sunroof=new THREE.Mesh(new THREE.BoxGeometry(1.12,.025,.72),dark);sunroof.position.set(0,1.855,.08);g.add(sunroof);
  [-1,1].forEach((x) => [-1,1].forEach((z) => {
    const tire = add(new THREE.CylinderGeometry(.43,.43,.28,32),rubber,x*1.03,.45,z*1.34); tire.rotation.z=Math.PI/2; wheels.push(tire); if(z<0)frontWheels.push(tire);
    const rim=add(new THREE.CylinderGeometry(.22,.22,.3,20),chrome,x*1.03,.45,z*1.34); rim.rotation.z=Math.PI/2;
  }));
  [-.68,.68].forEach((x) => {
    add(new THREE.BoxGeometry(.42,.15,.06),new THREE.MeshStandardMaterial({color:'#fff2c6',emissive:'#ffe7a1',emissiveIntensity:1.2}),x,.85,-2.1);
    add(new THREE.BoxGeometry(.42,.16,.06),new THREE.MeshStandardMaterial({color:'#ef263b',emissive:'#b00019',emissiveIntensity:1.1}),x,.84,2.1);
    const exhaust=add(new THREE.CylinderGeometry(.09,.09,.24,12),chrome,x,.42,2.2); exhaust.rotation.x=Math.PI/2;
  });
  const plateMesh=add(new THREE.PlaneGeometry(.95,.24),new THREE.MeshStandardMaterial({map:plateTexture(plate)}),0,.75,2.135);
  add(new THREE.BoxGeometry(1.72,.08,.3),new THREE.MeshStandardMaterial({color:'#111820',metalness:.5}),0,1.48,1.72);
  add(new THREE.BoxGeometry(1.88,.12,.22),new THREE.MeshStandardMaterial({color:'#111820',metalness:.45}),0,.55,-1.98);
  add(new THREE.BoxGeometry(1.95,.12,.32),new THREE.MeshStandardMaterial({color:'#15191d',metalness:.65}),0,.48,1.92);
  add(new THREE.BoxGeometry(1.9,.09,.42),paint,0,1.93,1.78);
  if(hyper||muscle){add(new THREE.BoxGeometry(1.72,.07,.34),dark,0,1.98,1.78);[-.62,.62].forEach(x=>{const support=add(new THREE.BoxGeometry(.07,.28,.08),trim,x,1.91,1.76);});}
  if(suv){add(new THREE.BoxGeometry(1.55,.08,.12),dark,0,2.04,.08);}

  [-1,1].forEach(side=>{add(new THREE.BoxGeometry(.22,.16,.28),paint,side*1.05,1.42,-.65);add(new THREE.BoxGeometry(.12,.12,2.35),new THREE.MeshStandardMaterial({color:'#15191d',metalness:.35}),side*.99,.58,0);});
  add(new THREE.BoxGeometry(1.12,.2,.07),new THREE.MeshStandardMaterial({color:'#080b0e',metalness:.35}),0,.66,-2.12);
  return {group:g,wheels,frontWheels};
}
function tree(x:number,z:number) {
  const g=new THREE.Group();
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.22,.3,2.3,8),new THREE.MeshStandardMaterial({color:'#65452b'})); trunk.position.y=1.15; g.add(trunk);
  for(let i=0;i<3;i++){const c=new THREE.Mesh(new THREE.ConeGeometry(1.25-i*.18,2.2,9),new THREE.MeshStandardMaterial({color:i%2?'#28613a':'#347747'}));c.position.y=2.45+i*.65;g.add(c);}
  g.position.set(x,0,z);return g;
}
function building(x:number,z:number,i:number) {
  const g=new THREE.Group(),h=10+(i%5)*3.2,w=4.8+(i%3)*.8,d=4.8;
  const facade=new THREE.MeshStandardMaterial({color:['#263744','#3b414b','#303b43','#514b45'][i%4],metalness:.22,roughness:.72});
  const glass=new THREE.MeshStandardMaterial({color:'#9ac6d8',emissive:'#e6a94e',emissiveIntensity:.22,metalness:.45,roughness:.25});
  const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),facade);body.position.y=h/2;body.castShadow=true;body.receiveShadow=true;g.add(body);
  const floors=Math.floor(h/1.7);
  for(let floor=0;floor<floors;floor++)for(let col=0;col<3;col++){
    const windowMesh=new THREE.Mesh(new THREE.BoxGeometry(.72,1.02,.055),glass);
    windowMesh.position.set((col-1)*1.35,1.05+floor*1.65,-d/2-.035);g.add(windowMesh);
    const sideWindow=new THREE.Mesh(new THREE.BoxGeometry(.055,1.02,.72),glass);
    sideWindow.position.set(w/2+.035,1.05+floor*1.65,(col-1)*1.35);g.add(sideWindow);
  }
  const roof=new THREE.Mesh(new THREE.BoxGeometry(w+.25,.22,d+.25),new THREE.MeshStandardMaterial({color:'#161d24',metalness:.55,roughness:.38}));roof.position.y=h+.11;g.add(roof);
  const podium=new THREE.Mesh(new THREE.BoxGeometry(w+.3,1.1,d+.3),new THREE.MeshStandardMaterial({color:'#171f27',metalness:.35,roughness:.6}));podium.position.y=.55;g.add(podium);
  g.position.set(x,0,z);return g;
}
function control(label:string,caption:string,tone:string,down:()=>void,up:()=>void) {
  const color=tone==='gold'?'border-amber-200 bg-amber-300 text-black':tone==='nitro'?'border-sky-300 bg-sky-500/25 text-sky-100 shadow-[0_0_24px_rgba(40,190,255,.3)]':tone==='muted'?'border-white/20 bg-slate-800/90 text-white':'border-amber-300/45 bg-black/75 text-amber-100';
  return <button type="button" onPointerDown={(e)=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);down();}} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} onContextMenu={(e)=>e.preventDefault()} className={'flex min-h-[62px] min-w-[54px] select-none flex-col items-center justify-center rounded-xl border px-2 py-2 active:scale-95 sm:min-h-[72px] sm:min-w-[68px] '+color} style={{touchAction:'none'}}><span className="text-xl font-black leading-none sm:text-2xl">{label}</span><span className="mt-1 text-[8px] font-black tracking-wider sm:text-[9px]">{caption}</span></button>;
}

type RendererStatus = 'ready' | 'unavailable' | 'lost' | 'error';
class CarRacingRenderErrorBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error:Error, info:ErrorInfo){console.error('Car Racing 3D UI failed',error,info);}
  render(){return this.state.failed?<div role="alert" className="flex min-h-[340px] flex-col items-center justify-center gap-3 rounded-2xl border border-amber-300/30 bg-slate-950 p-6 text-center text-white"><p className="text-lg font-black text-amber-200">3D የጨዋታ ማሳያ ለጊዜው አልተጫነም</p><p className="text-sm text-white/70">የጨዋታው ገጽ እንዲቀጥል ተጠብቋል። እባክዎ እንደገና ይሞክሩ።</p></div>:this.props.children;}
}
function CarRacing3DViewportInner(p:Props) {
  const host=useRef<HTMLDivElement>(null), latest=useRef(p); latest.current=p;
  const [rendererStatus,setRendererStatus]=useState<RendererStatus>('ready');
  const [rendererAttempt,setRendererAttempt]=useState(0);
  const [elapsedSeconds,setElapsedSeconds]=useState(0);
  useEffect(()=>{const update=()=>setElapsedSeconds(Math.min(600,Math.floor((Date.now()-p.startedAt)/1000)));update();const timer=window.setInterval(update,200);return()=>window.clearInterval(timer);},[p.startedAt]);
  const remainingSeconds=Math.max(0,600-elapsedSeconds);
  const elapsedLabel=`${String(Math.floor(remainingSeconds/60)).padStart(2,'0')}:${String(remainingSeconds%60).padStart(2,'0')}`;
  const lap=Math.min(3,Math.floor(Math.max(0,p.me.progress)/33.34)+1);
  const audioRig=useRef<{ctx:AudioContext;engine:OscillatorNode;sub:OscillatorNode;engineGain:GainNode;subGain:GainNode;engineFilter:BiquadFilterNode;wind:AudioBufferSourceNode;windGain:GainNode;windFilter:BiquadFilterNode;tires:AudioBufferSourceNode;tiresGain:GainNode;tiresFilter:BiquadFilterNode}|null>(null);
  useEffect(()=>{
    const startAudio=()=>{
      if(audioRig.current)return;
      const AudioCtor=window.AudioContext;
      if(!AudioCtor)return;
      try{
        const ctx=new AudioCtor();
        const engine=ctx.createOscillator(),sub=ctx.createOscillator(),engineFilter=ctx.createBiquadFilter(),engineGain=ctx.createGain(),subGain=ctx.createGain();
        engine.type='sawtooth';engine.frequency.value=62;engineFilter.type='lowpass';engineFilter.frequency.value=520;engine.connect(engineFilter);engineFilter.connect(engineGain);engineGain.gain.value=.0001;engineGain.connect(ctx.destination);
        sub.type='triangle';sub.frequency.value=31;sub.connect(subGain);subGain.gain.value=.0001;subGain.connect(ctx.destination);
        const makeNoise=()=>{const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.55;const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;return source;};
        const wind=makeNoise(),windFilter=ctx.createBiquadFilter(),windGain=ctx.createGain();windFilter.type='lowpass';windFilter.frequency.value=420;wind.connect(windFilter);windFilter.connect(windGain);windGain.gain.value=.0001;windGain.connect(ctx.destination);
        const tires=makeNoise(),tiresFilter=ctx.createBiquadFilter(),tiresGain=ctx.createGain();tiresFilter.type='bandpass';tiresFilter.frequency.value=1450;tiresFilter.Q.value=.7;tires.connect(tiresFilter);tiresFilter.connect(tiresGain);tiresGain.gain.value=.0001;tiresGain.connect(ctx.destination);
        engine.start();sub.start();wind.start();tires.start();audioRig.current={ctx,engine,sub,engineGain,subGain,engineFilter,wind,windGain,windFilter,tires,tiresGain,tiresFilter};
        void ctx.resume();
      }catch(error){console.warn('Racing audio could not start',error);}
    };
    window.addEventListener('pointerdown',startAudio,{passive:true});window.addEventListener('keydown',startAudio);
    return()=>{window.removeEventListener('pointerdown',startAudio);window.removeEventListener('keydown',startAudio);const rig=audioRig.current;if(rig){rig.engine.stop();rig.sub.stop();rig.wind.stop();rig.tires.stop();void rig.ctx.close();audioRig.current=null;}};
  },[]);
  useEffect(()=>{
    const rig=audioRig.current;if(!rig)return;const now=rig.ctx.currentTime;const speed=Math.max(0,latest.current.speed),throttle=latest.current.throttle,boost=latest.current.boost,steer=Math.abs(latest.current.steer),brake=latest.current.brake;
    const rpm=58+speed*2.35+throttle*82+(boost?55:0);rig.engine.frequency.setTargetAtTime(rpm,now,.08);rig.sub.frequency.setTargetAtTime(Math.max(28,rpm*.48),now,.1);rig.engineFilter.frequency.setTargetAtTime(380+speed*8+throttle*520,now,.12);
    rig.engineGain.gain.setTargetAtTime((.035+throttle*.19+(boost?.075:0)+(speed/220)*.055)*p.audioVolume,now,.12);rig.subGain.gain.setTargetAtTime((.045+throttle*.11+(boost?.04:0))*p.audioVolume,now,.12);
    rig.windFilter.frequency.setTargetAtTime(240+speed*17,now,.2);rig.windGain.gain.setTargetAtTime((.008+(speed/220)*.16)*p.audioVolume,now,.2);
    rig.tiresFilter.frequency.setTargetAtTime(900+speed*7,now,.1);rig.tiresGain.gain.setTargetAtTime(((steer>.28&&speed>35?steer*.16:0)+(brake&&speed>10?.12:0))*p.audioVolume,now,.08);
  },[p.speed,p.throttle,p.steer,p.boost,p.brake,p.audioVolume]);
  useEffect(()=>{
    const ignored=(target:EventTarget|null)=>target instanceof HTMLElement&&/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
    const down=(event:KeyboardEvent)=>{
      if(ignored(event.target))return;
      const key=event.key.toLowerCase();
      if(['arrowup','w'].includes(key)){event.preventDefault();p.onThrottle(1,latest.current.reverse,false,false);}
      else if(['arrowdown','s',' '].includes(key)){event.preventDefault();p.onThrottle(0,latest.current.reverse,false,true);}
      else if(['arrowleft','a'].includes(key)){event.preventDefault();p.onSteer(Math.max(-1,latest.current.steer-.12));}
      else if(['arrowright','d'].includes(key)){event.preventDefault();p.onSteer(Math.min(1,latest.current.steer+.12));}
      else if(key==='r'&&!event.repeat){event.preventDefault();p.onGearChange(!latest.current.reverse);}
      else if(key==='shift'){event.preventDefault();p.onThrottle(1,latest.current.reverse,true,false);}
    };
    const up=(event:KeyboardEvent)=>{
      const key=event.key.toLowerCase();
      if(['arrowup','w','shift'].includes(key))p.onThrottle(0,latest.current.reverse,false,false);
      if(['arrowdown','s',' '].includes(key))p.onThrottle(0,latest.current.reverse,false,false);
      if(['arrowleft','a','arrowright','d'].includes(key))p.onSteer(0);
    };
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);};
  },[]);
  useEffect(()=>{
    const el=host.current;if(!el)return;
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch(error){el.dataset.webglUnavailable='true';setRendererStatus('unavailable');console.warn('Car Racing WebGL is unavailable',error);return;}
    let contextLost=false;
    const onContextLost=(event:Event)=>{event.preventDefault();contextLost=true;setRendererStatus('lost');};
    const onContextRestored=()=>{if(contextLost){setRendererStatus('ready');setRendererAttempt(value=>value+1);}};
    renderer.domElement.addEventListener('webglcontextlost',onContextLost,false);
    renderer.domElement.addEventListener('webglcontextrestored',onContextRestored,false);
    let observer:ResizeObserver|undefined;
    try{
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,p.graphicsQuality==='ultra'?2:p.graphicsQuality==='balanced'?1.5:1));renderer.shadowMap.enabled=p.graphicsQuality!=='performance';renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;renderer.domElement.className='block h-full w-full';el.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.background=new THREE.Color('#06152c');scene.fog=new THREE.Fog('#06152c',78,245);
    const camera=new THREE.PerspectiveCamera(62,1,.1,320);camera.position.set(0,6.2,13);camera.lookAt(0,.8,-24);
    scene.add(new THREE.HemisphereLight('#a9c8f0','#080b18',1.22));
    const moon=new THREE.DirectionalLight('#9fcaff',1.55);moon.position.set(-22,28,12);moon.castShadow=true;moon.shadow.mapSize.set(1536,1536);scene.add(moon);
    const cityGlow=new THREE.AmbientLight('#3850a0',.58);scene.add(cityGlow);
    const road=new THREE.Mesh(new THREE.PlaneGeometry(17,300),new THREE.MeshStandardMaterial({color:'#080e19',roughness:.24,metalness:.32}));road.rotation.x=-Math.PI/2;road.position.set(0,0,-118);road.receiveShadow=true;scene.add(road);
    const shoulderMat=new THREE.MeshStandardMaterial({color:'#b7a77e',roughness:.95});
    [-8.45,8.45].forEach(x=>{const shoulder=new THREE.Mesh(new THREE.BoxGeometry(.55,.035,300),shoulderMat);shoulder.position.set(x,.015,-118);scene.add(shoulder);});
    const centerGlow=new THREE.MeshStandardMaterial({color:'#f3e4b5',emissive:'#d5b66c',emissiveIntensity:.12});
    [-4,4].forEach(x=>{const line=new THREE.Mesh(new THREE.BoxGeometry(.075,.03,300),centerGlow);line.position.set(x,.035,-118);scene.add(line);});
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(420,300),new THREE.MeshStandardMaterial({color:'#07162a',roughness:.82,metalness:.12}));ground.rotation.x=-Math.PI/2;ground.position.set(0,-.08,-110);scene.add(ground);
    const markers:THREE.Mesh[]=[];
    const lanePaint=new THREE.MeshStandardMaterial({color:'#e7dfc4',roughness:.72});
    for(let lane=1;lane<4;lane++)for(let i=0;i<28;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(.095,.026,3.1),lanePaint);m.position.set(-8+lane*4,.026,-i*9);scene.add(m);markers.push(m);}
    const lampMat=new THREE.MeshStandardMaterial({color:'#343b42',metalness:.8,roughness:.28});
    const lampGlow=new THREE.MeshStandardMaterial({color:'#fff0bd',emissive:'#ffd77c',emissiveIntensity:3.2});
    for(let i=0;i<18;i++)for(const side of [-1,1]){
      const x=side*10.5,z=-i*15-4;
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(.07,.1,5.8,8),lampMat);pole.position.set(x,2.9,z);pole.castShadow=true;scene.add(pole);
      const arm=new THREE.Mesh(new THREE.BoxGeometry(1.25,.08,.08),lampMat);arm.position.set(x-side*.55,5.65,z);scene.add(arm);
      const glow=new THREE.Mesh(new THREE.SphereGeometry(.22,12,10),lampGlow);glow.position.set(x-side*1.05,5.55,z);scene.add(glow);
      if(i%4===0){const beam=new THREE.SpotLight('#ffe2a3',32,22,.78,.65,1.5);beam.position.set(x-side*1.05,5.48,z);beam.target.position.set(x-side*1.05,.1,z-5);scene.add(beam,beam.target);}
    }
    const railMat=new THREE.MeshStandardMaterial({color:'#9ca6ae',metalness:.82,roughness:.3});
    [-8.25,8.25].forEach(x=>{const rail=new THREE.Mesh(new THREE.BoxGeometry(.22,.42,280),railMat);rail.position.set(x,.72,-112);scene.add(rail);for(let i=0;i<24;i++){const post=new THREE.Mesh(new THREE.BoxGeometry(.25,.9,.25),railMat);post.position.set(x,.45,-i*12);scene.add(post);}});
    const scenery:THREE.Object3D[]=[];
    for(let i=0;i<20;i++){
      const z=-i*12-5;
      if(p.track.environment==='city'){
        scenery.push(building(-14-(i%3)*1.2,z,i),building(14+(i%2)*1.5,z-5,i+1));
        if(i%2===0)scenery.push(tree(-10.2,z-3),tree(10.2,z-9));
      }else if(p.track.environment==='rocky'||p.track.environment==='country'){
        scenery.push(tree(-12.5-(i%3),z),tree(12.5+(i%2),z-5));
        if(i%3===0){scenery.push(building(-19,z-7,i),building(19,z-2,i+2));}
      }else if(p.track.environment==='coastal'){
        scenery.push(tree(-14,z),tree(14,z-7));
        const palm=new THREE.Group();const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.16,.24,4,8),new THREE.MeshStandardMaterial({color:'#8b6948'}));trunk.position.y=2;palm.add(trunk);
        for(let leaf=0;leaf<6;leaf++){const frond=new THREE.Mesh(new THREE.ConeGeometry(.28,3,5),new THREE.MeshStandardMaterial({color:'#287a50'}));frond.position.set(Math.cos(leaf*Math.PI/3)*1.2,3.7,Math.sin(leaf*Math.PI/3)*1.2);frond.rotation.z=Math.PI/2-Math.cos(leaf*Math.PI/3)*.45;frond.rotation.x=Math.sin(leaf*Math.PI/3)*.45;palm.add(frond);}
        palm.position.set(i%2?15:-15,0,z-3);scenery.push(palm);
      }
    }
    // Street-level storefronts, illuminated signs and roadside advertising like an urban night circuit.
    if(p.track.environment==='city'){
      for(let i=0;i<12;i++)for(const side of [-1,1]){
        const z=-i*19-8,x=side*(12.2+(i%2)*1.2);
        const shop=new THREE.Group();
        const facade=new THREE.Mesh(new THREE.BoxGeometry(3.8,3.1,4.2),new THREE.MeshStandardMaterial({color:i%2?'#263744':'#3c3430',metalness:.18,roughness:.82}));
        facade.position.y=1.55;shop.add(facade);
        const windowPane=new THREE.Mesh(new THREE.BoxGeometry(3.2,1.55,.08),new THREE.MeshStandardMaterial({color:'#193342',emissive:i%2?'#e28b36':'#2a9cbb',emissiveIntensity:.8,metalness:.2}));
        windowPane.position.set(0,1.05,-2.14);shop.add(windowPane);
        const sign=new THREE.Mesh(new THREE.BoxGeometry(3.5,.46,.12),new THREE.MeshStandardMaterial({color:i%3===0?'#e9a83b':i%3===1?'#26a9c6':'#d94b53',emissive:i%3===0?'#bd6b18':i%3===1?'#087c9b':'#a51d2b',emissiveIntensity:1.35}));
        sign.position.set(0,2.35,-2.2);shop.add(sign);
        shop.position.set(x,0,z);scenery.push(shop);
      }
      for(let i=0;i<7;i++){
        const board=new THREE.Group();
        const post=new THREE.Mesh(new THREE.BoxGeometry(.14,5,.14),lampMat);post.position.y=2.5;board.add(post);
        const panel=new THREE.Mesh(new THREE.BoxGeometry(4.8,1.55,.18),new THREE.MeshStandardMaterial({color:i%2?'#102b3a':'#332016',emissive:i%2?'#0a6e91':'#9d4d12',emissiveIntensity:.65}));
        panel.position.set(0,4.5,0);board.add(panel);board.position.set(i%2?18:-18,0,-i*34-12);scenery.push(board);
      }
    }
    scenery.forEach(x=>scene.add(x));
    // Premium neon night circuit: glowing skyline strips, wet-road reflections and the BLACK GOLD start gantry.
    const neonBlue=new THREE.MeshStandardMaterial({color:'#28c9ff',emissive:'#087eb8',emissiveIntensity:2.8,metalness:.35,roughness:.22});
    const neonPink=new THREE.MeshStandardMaterial({color:'#ff4fc8',emissive:'#b40072',emissiveIntensity:2.5,metalness:.3,roughness:.24});
    for(let i=0;i<14;i++)for(const side of [-1,1]){const strip=new THREE.Mesh(new THREE.BoxGeometry(.075,7.5,.12),i%2?neonBlue:neonPink);strip.position.set(side*(14+(i%3)*1.5),5.2,-i*17-12);scene.add(strip);}
    const helicopter=new THREE.Group();
    const heliBody=new THREE.Mesh(new THREE.SphereGeometry(.72,20,16),new THREE.MeshStandardMaterial({color:'#171e2a',metalness:.72,roughness:.28}));heliBody.scale.set(1.55,.72,1);helicopter.add(heliBody);
    const heliGlass=new THREE.Mesh(new THREE.SphereGeometry(.48,18,14),new THREE.MeshPhysicalMaterial({color:'#3f9ed0',metalness:.35,roughness:.12,transparent:true,opacity:.82}));heliGlass.scale.set(1.1,.72,.85);heliGlass.position.set(0,.08,-.55);helicopter.add(heliGlass);
    const tailBoom=new THREE.Mesh(new THREE.CylinderGeometry(.12,.22,3.2,12),new THREE.MeshStandardMaterial({color:'#202a37',metalness:.55}));tailBoom.rotation.x=Math.PI/2;tailBoom.position.set(0,.06,2);helicopter.add(tailBoom);
    const rotor=new THREE.Group();for(let i=0;i<4;i++){const blade=new THREE.Mesh(new THREE.BoxGeometry(.16,.045,5.8),new THREE.MeshStandardMaterial({color:'#111820',metalness:.55}));blade.rotation.y=i*Math.PI/2;rotor.add(blade);}rotor.position.y=.68;helicopter.add(rotor);
    const tailRotor=new THREE.Group();for(let i=0;i<3;i++){const blade=new THREE.Mesh(new THREE.BoxGeometry(.08,.12,1.1),new THREE.MeshStandardMaterial({color:'#d7dce2'}));blade.rotation.y=i*Math.PI/3;tailRotor.add(blade);}tailRotor.position.set(0,.18,3.55);helicopter.add(tailRotor);
    const searchBeam=new THREE.Mesh(new THREE.ConeGeometry(3.2,12,24),new THREE.MeshBasicMaterial({color:'#318dff',transparent:true,opacity:.13,depthWrite:false}));searchBeam.rotation.x=Math.PI;searchBeam.position.set(0,-6,0);helicopter.add(searchBeam);
    const searchLight=new THREE.SpotLight('#4d9dff',72,48,.58,.72,1.5);searchLight.position.set(0,-.1,0);searchLight.target.position.set(0,-12,-4);helicopter.add(searchLight,searchLight.target);
    helicopter.position.set(8.5,13,-52);scene.add(helicopter);
    const gantry=new THREE.Group();
    const gantryMat=new THREE.MeshStandardMaterial({color:'#101722',metalness:.72,roughness:.28});
    const beam=new THREE.Mesh(new THREE.BoxGeometry(17,.85,.6),gantryMat);beam.position.y=7.1;gantry.add(beam);
    [-8,8].forEach(x=>{const post=new THREE.Mesh(new THREE.BoxGeometry(.55,7.2,.55),gantryMat);post.position.set(x,3.6,0);gantry.add(post);});
    const bannerCanvas=document.createElement('canvas');bannerCanvas.width=1024;bannerCanvas.height=128;const bannerCtx=bannerCanvas.getContext('2d');
    if(bannerCtx){bannerCtx.fillStyle='#080d16';bannerCtx.fillRect(0,0,1024,128);bannerCtx.strokeStyle='#f7bd3b';bannerCtx.lineWidth=7;bannerCtx.strokeRect(5,5,1014,118);bannerCtx.fillStyle='#ffd24a';bannerCtx.font='900 italic 76px Arial';bannerCtx.textAlign='center';bannerCtx.textBaseline='middle';bannerCtx.fillText('BLACK GOLD RACING',512,67);}
    const bannerTexture=new THREE.CanvasTexture(bannerCanvas);bannerTexture.colorSpace=THREE.SRGBColorSpace;
    const banner=new THREE.Mesh(new THREE.PlaneGeometry(12,.95),new THREE.MeshBasicMaterial({map:bannerTexture}));banner.position.set(0,7.1,-.34);gantry.add(banner);gantry.position.set(0,0,-58);scene.add(gantry);
    [-5.5,5.5].forEach(x=>{const glow=new THREE.PointLight(x<0?'#1baeff':'#ff42c8',48,26,2);glow.position.set(x,4,-28);scene.add(glow);});
    // Wet-road reflection bands catch the city neon without obscuring driving lanes.
    for(let i=0;i<18;i++){const reflection=new THREE.Mesh(new THREE.PlaneGeometry(THREE.MathUtils.randFloat(1.2,4.8),THREE.MathUtils.randFloat(2,8)),new THREE.MeshBasicMaterial({color:i%2?'#087eb8':'#a51d72',transparent:true,opacity:.12,depthWrite:false}));reflection.rotation.x=-Math.PI/2;reflection.position.set(THREE.MathUtils.randFloat(-7,7),.018,-i*13-5);scene.add(reflection);}
    // Ambient road traffic adds depth to the city scene without changing race logic.
    const traffic:CarModel[]=[];
    if(p.track.environment==='city'){
      for(let i=0;i<5;i++){const trafficCar=makeCar(['#c7d1d8','#d34b35','#e4b84d','#3989a8','#252a31'][i],`CITY-${i+1}`);trafficCar.group.scale.setScalar(.78);trafficCar.group.position.set(i%2?5.35:-5.35,0,-26-i*43);scene.add(trafficCar.group);traffic.push(trafficCar);}
    }
    const obstacleModels = p.track.obstacles.map(obstacle => {
      const group = new THREE.Group();
      const laneX = obstacle.lane * 3.45;
      const warning = new THREE.MeshStandardMaterial({color:'#f4e8c8', roughness:.75});
      const hazard = new THREE.MeshStandardMaterial({color:'#d33b32', roughness:.8});
      if (obstacle.type === 'barrier') {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(2.5, .8, .45), warning); beam.position.y=.55; group.add(beam);
        for(let stripe=-1;stripe<=1;stripe++){const band=new THREE.Mesh(new THREE.BoxGeometry(.42,.84,.48),hazard);band.position.set(stripe*.72,.55,0);band.rotation.z=-.45;group.add(band);}
        const legMat=new THREE.MeshStandardMaterial({color:'#42464a',metalness:.4});
        [-.8,.8].forEach(x=>{const leg=new THREE.Mesh(new THREE.BoxGeometry(.18,.7,.2),legMat);leg.position.set(x,.2,0);group.add(leg);});
      } else if (obstacle.type === 'logs') {
        for(let n=0;n<2;n++){const log=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,2.2,12),new THREE.MeshStandardMaterial({color:'#80532f',roughness:.95}));log.rotation.z=Math.PI/2;log.position.set(0,.35+n*.38,n*.35);group.add(log);}
      } else {
        const count=obstacle.type === 'rockfall'?6:obstacle.type === 'boulder'?1:3;
        for(let n=0;n<count;n++){const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(obstacle.type==='boulder'?1.15:.48+(n%2)*.25),new THREE.MeshStandardMaterial({color:'#77736c',roughness:1}));rock.position.set((n%3-1)*.58,.35+(n%2)*.28,Math.floor(n/3)*.55);rock.rotation.set(n*.2,n*.4,n*.15);group.add(rock);}
      }
      group.position.set(laneX,0,-20);
      scene.add(group);
      return {group, obstacle};
    });
    const ownColor=p.soloMode?'#f5c400':(p.cars.find(c=>c.id===p.me.carId)?.color||'#e9ad3b');const own=makeCar(ownColor,p.me.plateNumber,p.cars.find(c=>c.id===p.me.carId)?.bodyStyle);own.group.scale.setScalar(p.soloMode?1.18:1);scene.add(own.group);
    const nitroFlames=new THREE.Group();[-.56,.56].forEach(x=>{const flame=new THREE.Mesh(new THREE.ConeGeometry(.19,1.35,16),new THREE.MeshBasicMaterial({color:'#16baff',transparent:true,opacity:.92}));flame.rotation.x=Math.PI/2;flame.position.set(x,.43,2.82);nitroFlames.add(flame);});const nitroGlow=new THREE.PointLight('#16aaff',0,7,2);nitroGlow.position.set(0,.55,3.25);nitroFlames.add(nitroGlow);own.group.add(nitroFlames);
    const opponents=new Map<string,CarModel>();
    const cockpit=new THREE.Group();
    const cabin=new THREE.MeshStandardMaterial({color:'#11161b',metalness:.28,roughness:.72});
    const leather=new THREE.MeshStandardMaterial({color:'#252a2d',roughness:.86});
    const silver=new THREE.MeshStandardMaterial({color:'#aab2b8',metalness:.9,roughness:.2});
    const screenMat=new THREE.MeshStandardMaterial({color:'#071b24',emissive:'#0a6b8c',emissiveIntensity:.8,metalness:.2});
    const dash=new THREE.Mesh(new THREE.BoxGeometry(4.8,.62,1.1),cabin);dash.position.set(0,-.95,-1.55);cockpit.add(dash);
    const dashTop=new THREE.Mesh(new THREE.BoxGeometry(4.65,.13,.96),leather);dashTop.position.set(0,-.64,-1.58);cockpit.add(dashTop);
    // Driver and passenger seats, center console and instrument binnacle.
    [-1.18,1.18].forEach(x=>{const seat=new THREE.Group();const base=new THREE.Mesh(new THREE.BoxGeometry(.88,.2,.9),leather);base.position.set(0,-1.18,-.15);seat.add(base);const back=new THREE.Mesh(new THREE.BoxGeometry(.9,1.12,.2),leather);back.position.set(0,-.68,.28);seat.add(back);const headrest=new THREE.Mesh(new THREE.BoxGeometry(.48,.32,.18),cabin);headrest.position.set(0,-.12,.34);seat.add(headrest);seat.position.x=x;cockpit.add(seat);});
    const centerConsole=new THREE.Mesh(new THREE.BoxGeometry(.82,.22,1.2),cabin);centerConsole.position.set(0,-1.12,-.45);cockpit.add(centerConsole);
    const consoleScreen=new THREE.Mesh(new THREE.BoxGeometry(.62,.32,.045),screenMat);consoleScreen.position.set(0,-.91,-.9);cockpit.add(consoleScreen);
    const gearStick=new THREE.Group();const stick=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.42,10),silver);stick.position.y=.18;gearStick.add(stick);const knob=new THREE.Mesh(new THREE.SphereGeometry(.11,14,12),cabin);knob.position.y=.42;gearStick.add(knob);gearStick.position.set(.48,-1.2,-.3);cockpit.add(gearStick);
    const cluster=new THREE.Mesh(new THREE.BoxGeometry(1.7,.55,.14),cabin);cluster.position.set(0,-.69,-1.92);cockpit.add(cluster);
    const gaugeMat=new THREE.MeshStandardMaterial({color:'#06121b',emissive:'#0a3348',emissiveIntensity:.7});
    [-.48,.48].forEach(x=>{const gauge=new THREE.Mesh(new THREE.CylinderGeometry(.27,.27,.055,32),gaugeMat);gauge.rotation.x=Math.PI/2;gauge.position.set(x,-.69,-2.02);cockpit.add(gauge);const ring=new THREE.Mesh(new THREE.TorusGeometry(.255,.025,8,32),silver);ring.position.set(x,-.69,-2.055);cockpit.add(ring);const needle=new THREE.Mesh(new THREE.BoxGeometry(.018,.2,.025),new THREE.MeshStandardMaterial({color:'#f4bd54',emissive:'#d78a25',emissiveIntensity:1.2}));needle.position.set(x,-.69,-2.09);needle.rotation.z=-.65;cockpit.add(needle);});
    const display=new THREE.Mesh(new THREE.BoxGeometry(.52,.3,.035),screenMat);display.position.set(0,-.69,-2.035);cockpit.add(display);
    [-.9,.9].forEach(x=>{const vent=new THREE.Mesh(new THREE.BoxGeometry(.42,.13,.04),silver);vent.position.set(x,-.82,-2.02);cockpit.add(vent);});
    const windshieldFrame=new THREE.Mesh(new THREE.BoxGeometry(4.7,.12,.12),cabin);windshieldFrame.position.set(0,.08,-2.18);cockpit.add(windshieldFrame);
    const steering=new THREE.Group(),rim=new THREE.Mesh(new THREE.TorusGeometry(.48,.075,16,56),new THREE.MeshStandardMaterial({color:'#101419',metalness:.42,roughness:.34}));steering.add(rim);
    const innerRim=new THREE.Mesh(new THREE.TorusGeometry(.405,.025,8,48),new THREE.MeshStandardMaterial({color:'#b6b9bb',metalness:.92,roughness:.22}));steering.add(innerRim);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.13,20),new THREE.MeshStandardMaterial({color:'#bd9140',metalness:.65}));hub.rotation.x=Math.PI/2;steering.add(hub);
    for(let i=0;i<3;i++){const spoke=new THREE.Mesh(new THREE.BoxGeometry(.055,.48,.08),new THREE.MeshStandardMaterial({color:'#b8bdc2',metalness:.9}));spoke.position.y=i===0?.24:-.12;spoke.rotation.z=i===1?.85:i===2?-.85:0;steering.add(spoke);}
    steering.position.set(0,-.55,-1.28);cockpit.add(steering);
    const column=new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,.62,12),cabin);column.rotation.x=Math.PI/2;column.position.set(0,-.78,-1.55);cockpit.add(column);
    const gearLever=new THREE.Group();
    const leverStem=new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,.46,12),silver);leverStem.position.y=.22;gearLever.add(leverStem);
    const leverKnob=new THREE.Mesh(new THREE.SphereGeometry(.14,18,16),new THREE.MeshStandardMaterial({color:'#161a20',metalness:.3,roughness:.25}));leverKnob.position.y=.46;gearLever.add(leverKnob);gearLever.position.set(.48,-1.18,-.38);cockpit.add(gearLever);
    const pedalMat=new THREE.MeshStandardMaterial({color:'#59616a',metalness:.8,roughness:.35});
    const brakePedal=new THREE.Group(),brakePlate=new THREE.Mesh(new THREE.BoxGeometry(.22,.32,.06),pedalMat);brakePlate.position.y=.16;brakePedal.add(brakePlate);brakePedal.position.set(.42,-1.38,-1.02);cockpit.add(brakePedal);
    const accelPedal=new THREE.Group(),accelPlate=new THREE.Mesh(new THREE.BoxGeometry(.18,.34,.06),pedalMat);accelPlate.position.y=.17;accelPedal.add(accelPlate);accelPedal.position.set(.72,-1.38,-1.02);cockpit.add(accelPedal);
    const speedCanvas=document.createElement('canvas');speedCanvas.width=512;speedCanvas.height=256;
    const speedCtx=speedCanvas.getContext('2d');const speedTexture=new THREE.CanvasTexture(speedCanvas);speedTexture.colorSpace=THREE.SRGBColorSpace;
    const liveDisplay=new THREE.Mesh(new THREE.PlaneGeometry(.48,.27),new THREE.MeshBasicMaterial({map:speedTexture,transparent:true}));liveDisplay.position.set(0,-.69,-2.08);cockpit.add(liveDisplay);
    const speedNeedle=new THREE.Group();const needleMesh=new THREE.Mesh(new THREE.BoxGeometry(.025,.2,.025),new THREE.MeshStandardMaterial({color:'#f4bd54',emissive:'#d78a25',emissiveIntensity:1.5}));needleMesh.position.y=.1;speedNeedle.add(needleMesh);speedNeedle.position.set(-.48,-.69,-2.1);cockpit.add(speedNeedle);
    const rpmNeedle=new THREE.Group();const rpmMesh=new THREE.Mesh(new THREE.BoxGeometry(.025,.2,.025),new THREE.MeshStandardMaterial({color:'#f04e57',emissive:'#a51c25',emissiveIntensity:1.2}));rpmMesh.position.y=.1;rpmNeedle.add(rpmMesh);rpmNeedle.position.set(.48,-.69,-2.1);cockpit.add(rpmNeedle);
    camera.add(cockpit);scene.add(camera);
    const resize=()=>{const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
    observer=new ResizeObserver(resize);observer.observe(el);resize();
    let last=performance.now(),travel=0,raf=0;
    let lastDashboardLabel='';
    const animate=(now:number)=>{if(contextLost)return;raf=requestAnimationFrame(animate);try{const dt=Math.min((now-last)/1000,.05);last=now;rotor.rotation.y+=dt*18;tailRotor.rotation.y+=dt*22;const s=latest.current,velocity=(s.speed>0?Math.max(.15,s.speed/90):0)*(s.reverse?-1:1);travel+=dt*Math.abs(velocity)*(s.boost?2.2:1);
      markers.forEach(m=>{m.position.z+=dt*velocity*34;if(m.position.z>15)m.position.z-=240;});
      scenery.forEach(o=>{o.position.z+=dt*velocity*25;if(o.position.z>18)o.position.z-=240;});
      obstacleModels.forEach(({group,obstacle})=>{const ahead=obstacle.at/10-latest.current.me.progress;group.position.set(obstacle.lane*3.45,0,THREE.MathUtils.clamp(-ahead*3.2,-220,18));group.visible=ahead>-2&&ahead<72;});
      const bend=s.track.curveType==='left'?.22:s.track.curveType==='right'?-.22:s.track.curveType==='s-bend'?Math.sin(travel*.2)*.2:0,offset=s.steer*1.05;
      own.group.position.set(offset*.7,0,4.5);own.group.rotation.y=-s.steer*.16-bend*.16;own.group.visible=s.view==='chase';nitroFlames.visible=s.boost&&s.speed>1&&latest.current.nitroPercent>0;nitroFlames.scale.setScalar(.78+Math.random()*.32);nitroGlow.intensity=nitroFlames.visible?2.8:0;own.wheels.forEach(w=>{w.rotation.x+=dt*velocity*3;});
      steering.rotation.z=-s.steer*Math.PI;cockpit.visible=s.view==='cockpit';
      own.frontWheels.forEach(w=>{w.rotation.y=s.steer*.48;});
      gearLever.rotation.z=s.reverse?-.48:0;gearLever.position.x=s.reverse?.58:.48;
      brakePedal.rotation.x=s.brake?-.32:0;accelPedal.rotation.x=s.throttle>.05?-.24:0;
      speedNeedle.rotation.z=-THREE.MathUtils.clamp(s.speed/220,0,1)*Math.PI*.78;
      rpmNeedle.rotation.z=-THREE.MathUtils.clamp((s.speed/220)+(s.boost?.18:0),0,1)*Math.PI*.78;
      const gear=s.reverse?'R':s.speed<8?'1':String(Math.min(6,Math.max(1,Math.ceil(s.speed/38))));const dashboardLabel=(s.reverse?'REVERSE':'DRIVE')+' '+Math.round(s.speed)+' G'+gear;if(speedCtx&&dashboardLabel!==lastDashboardLabel){speedCtx.clearRect(0,0,512,256);speedCtx.fillStyle='#06131d';speedCtx.fillRect(0,0,512,256);speedCtx.fillStyle='#8bdcff';speedCtx.font='bold 38px Arial';speedCtx.textAlign='center';speedCtx.fillText((s.reverse?'REVERSE':'DRIVE')+'  GEAR '+gear,256,54);speedCtx.fillStyle='#ffffff';speedCtx.font='bold 112px Arial';speedCtx.fillText(String(Math.round(s.speed)),256,172);speedCtx.fillStyle='#e9b94f';speedCtx.font='bold 30px Arial';speedCtx.fillText('KM/H',256,222);speedTexture.needsUpdate=true;lastDashboardLabel=dashboardLabel;}
      if(s.view==='cockpit'){camera.position.set(offset*.18,1.62,3.3);camera.lookAt(offset*.25+bend*2,1.2,-32);}else{camera.position.lerp(new THREE.Vector3(offset*.22,5.3,14.8),.075);camera.lookAt(offset*.18+bend*2,.85,-27);}
      const ids=new Set<string>();
      s.players.forEach(player=>{if(player.isMe||player.finished)return;ids.add(player.userId);let model=opponents.get(player.userId);if(!model){const car=s.cars.find(c=>c.id===player.carId);model=makeCar(car?.color||'#4b9bd2',player.plateNumber,car?.bodyStyle);opponents.set(player.userId,model);scene.add(model.group);}const delta=player.progress-s.me.progress;model.group.position.set(player.lane*3.45,0,THREE.MathUtils.clamp(-22-delta*.38,-115,8));model.group.visible=!player.eliminated;model.wheels.forEach(w=>{w.rotation.x+=dt*velocity*2.3;});model.frontWheels.forEach(w=>{w.rotation.y=(player.lane-s.me.lane)*.16;});});
      opponents.forEach((model,id)=>{if(!ids.has(id)){scene.remove(model.group);opponents.delete(id);}});
      const sky='#06152c';scene.background=new THREE.Color(sky);scene.fog=new THREE.Fog(sky,78,245);
      traffic.forEach((car,i)=>{car.group.position.z+=dt*velocity*(23+i%2*4);if(car.group.position.z>16)car.group.position.z=-205-i*8;car.wheels.forEach(w=>{w.rotation.x+=dt*velocity*2.2;});});
      renderer.render(scene,camera);
      }catch(error){cancelAnimationFrame(raf);setRendererStatus('error');console.error('Car Racing 3D render failed',error);}
    };
    raf=requestAnimationFrame(animate);
    return()=>{cancelAnimationFrame(raf);renderer.domElement.removeEventListener('webglcontextlost',onContextLost);renderer.domElement.removeEventListener('webglcontextrestored',onContextRestored);observer?.disconnect();scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});renderer.dispose();renderer.domElement.remove();};
    }catch(error){observer?.disconnect();renderer.domElement.removeEventListener('webglcontextlost',onContextLost);renderer.domElement.removeEventListener('webglcontextrestored',onContextRestored);renderer.dispose();renderer.domElement.remove();setRendererStatus('error');console.error('Car Racing 3D initialization failed',error);}
  },[rendererAttempt,p.graphicsQuality]);
  const retryRenderer=()=>{setRendererStatus('ready');setRendererAttempt(value=>value+1);};
  return <div className="relative isolate h-full min-h-0 w-full overflow-hidden rounded-none border-0 bg-[#030609] shadow-none">
    {rendererStatus!=='ready'&&<div role="alert" aria-live="assertive" className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-slate-950/95 p-6 text-center text-white"><p className="text-lg font-black text-amber-200">{rendererStatus==='lost'?'3D ማሳያው ተቋርጧል':rendererStatus==='unavailable'?'ይህ መሳሪያ 3D WebGL አይደግፍም':'3D ማሳያው ላይ ችግር ተፈጥሯል'}</p><p className="max-w-md text-sm text-white/75">{rendererStatus==='lost'?'የግራፊክስ ግንኙነቱ እየተመለሰ ነው። ካልተመለሰ እንደገና ይሞክሩ።':'የ3D እይታው ሳይሰራ ቢቀርም የውድድሩ መረጃና ውጤት አይጠፋም።'}</p><button type="button" onClick={retryRenderer} className="rounded-xl border border-amber-300 bg-amber-300 px-5 py-3 font-black text-black">እንደገና ሞክር</button></div>}
    <div ref={host} className="absolute inset-0 h-full min-h-0 w-full" />
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 bg-gradient-to-b from-black/90 via-black/40 to-transparent p-2 sm:gap-4 sm:p-4">
      <div className="min-w-0 max-w-[260px] rounded-xl border border-amber-300/60 bg-black/85 p-2 shadow-xl backdrop-blur-md sm:rounded-2xl sm:p-3">
        <div className="font-black italic text-amber-300">LAP <span className="text-2xl text-yellow-300">{lap}</span><span className="text-white"> / 3</span></div>
        <div className="mt-1 space-y-0.5">{[...p.players].sort((a,b)=>b.progress-a.progress).slice(0,3).map((driver,index)=><div key={driver.userId} className={`flex items-center justify-between gap-2 rounded px-1.5 py-1 text-[10px] font-black sm:text-xs ${driver.isMe?'bg-yellow-300 text-black':'bg-black/60 text-white'}`}><span>{index+1}  {driver.isMe?'YOU':driver.name.slice(0,13)}</span><span>{driver.isMe?'♛':Math.round(driver.progress)+'%'}</span></div>)}</div>
      </div>
      <div className="pointer-events-none min-w-[150px] rounded-xl border border-amber-300/60 bg-black/90 px-4 py-2 text-center shadow-[0_0_24px_rgba(245,190,70,.24)] sm:min-w-[300px] sm:rounded-2xl sm:px-7">
        <div className="font-mono text-2xl font-black leading-none tabular-nums text-white sm:text-4xl">{elapsedLabel}</div>
        <div className="mt-1 text-[9px] font-black italic tracking-[.18em] text-yellow-300 sm:text-sm">BLACK GOLD RACING</div>
      </div>
      <div className="ml-auto min-w-0 w-full max-w-[220px] rounded-xl border border-sky-300/60 bg-black/85 p-2 text-right shadow-xl backdrop-blur-md sm:rounded-2xl sm:p-3">
        <div className="font-black italic text-white">POS <span className="text-2xl text-yellow-300">{p.rank}</span><span> / {Math.max(1,p.players.length)}</span></div>
        <div className="mt-1 flex items-center gap-1.5"><span className="text-base text-sky-300">ϟ</span><span className="text-[9px] font-black italic text-white">NITRO</span></div>
        <div className="h-2.5 overflow-hidden rounded-full border border-sky-300/50 bg-slate-900"><div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-200 shadow-[0_0_12px_#00bfff]" style={{width:p.nitroPercent+'%'}}/></div>
      </div>
    </div>
    <button type="button" onClick={async()=>{try{await document.documentElement.requestFullscreen?.();const orientation=(window.screen as Screen & {orientation?:{lock?:(mode:string)=>Promise<void>}}).orientation;await orientation?.lock?.('landscape');}catch{/* Browser orientation lock is optional. */}}} aria-label="Rotate screen to landscape" className="absolute right-3 top-[116px] z-20 flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 border-white/60 bg-black/90 text-white shadow-xl sm:top-[124px] sm:h-[76px] sm:w-[76px]"><span className="text-2xl">↻</span><span className="text-[8px] font-black">ROTATE</span><span className="text-[8px] font-black">SCREEN</span></button>
    <button type="button" onClick={p.onSettings} aria-label="Game settings" className="absolute right-20 top-[124px] z-20 flex h-10 w-10 items-center justify-center rounded-full border border-amber-200/60 bg-black/90 text-xl text-amber-200 shadow-xl sm:right-24 sm:top-[140px]">⚙</button>
    <div className="absolute right-3 top-[178px] z-20 flex gap-1 rounded-xl border border-white/20 bg-black/85 p-1 shadow-lg sm:right-24 sm:top-[205px]">
      <button type="button" onClick={()=>p.onViewChange('chase')} aria-pressed={p.view==='chase'} className={'rounded-lg px-2 py-1.5 text-[9px] font-black '+(p.view==='chase'?'bg-amber-300 text-black':'text-amber-100')}>CHASE</button>
      <button type="button" onClick={()=>p.onViewChange('cockpit')} aria-pressed={p.view==='cockpit'} className={'rounded-lg px-2 py-1.5 text-[9px] font-black '+(p.view==='cockpit'?'bg-amber-300 text-black':'text-amber-100')}>COCKPIT</button>
    </div>
    <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-2 bg-gradient-to-t from-[#030609]/98 via-[#030609]/80 to-transparent px-3 pb-3 pt-14 sm:px-6 sm:pb-5">
      <div className="flex h-[112px] w-[112px] shrink-0 flex-col items-center justify-center rounded-full border-[5px] border-sky-300 bg-[radial-gradient(circle,#172b3a_0%,#020509_70%)] shadow-[0_0_26px_rgba(0,174,255,.38)] sm:h-[170px] sm:w-[170px]">
        <div className="text-[9px] font-black tracking-widest text-sky-200">KM/H</div>
        <div className="font-mono text-3xl font-black leading-tight text-white sm:text-5xl">{Math.round(p.speed)}</div>
        <div className="rounded-md border border-amber-300/70 bg-black/80 px-3 py-0.5 font-mono text-lg font-black text-yellow-300 sm:text-2xl">{p.reverse?'R':Math.max(1,Math.min(6,Math.ceil(p.speed/50)))}</div>
      </div>
      <div className="flex min-w-0 flex-wrap items-end justify-end gap-1.5 sm:gap-3">
        <div className="flex gap-1.5">
          {control('◀','STEER LEFT','gold',()=>p.onSteer(-1),()=>p.onSteer(0))}
          {control('▶','STEER RIGHT','gold',()=>p.onSteer(1),()=>p.onSteer(0))}
        </div>
        <div className="flex gap-1.5">
          {control('N₂O','NITRO','nitro',()=>p.onThrottle(1,p.reverse,true,false),()=>p.onThrottle(0,p.reverse,false,false))}
          <div className="flex flex-col gap-1">
            <button type="button" onClick={()=>p.onGearChange(!p.reverse)} aria-pressed={p.reverse} className={'min-h-[34px] min-w-[58px] rounded-xl border px-2 text-xs font-black '+(p.reverse?'border-red-300 bg-red-500 text-white':'border-white/30 bg-black/85 text-white')}>{p.reverse?'R · REVERSE':'D · DRIVE'}</button>
            {control('●','BRAKE','muted',()=>p.onThrottle(0,p.reverse,false,true),()=>p.onThrottle(0,p.reverse,false,false))}
          </div>
          {control('▲','GAS','gold',()=>p.onThrottle(1,p.reverse,false,false),()=>p.onThrottle(0,p.reverse,false,false))}
        </div>
      </div>
    </div>
        {p.me.collisionEvent && Date.now()-p.me.collisionEvent.at<2200 && <div role="status" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-orange-300/70 bg-red-950/85 px-5 py-3 text-center text-sm font-black tracking-widest text-orange-100 shadow-[0_0_30px_rgba(255,90,30,.45)]">IMPACT · {p.me.collisionEvent.severity.toUpperCase()}</div>}
    <div className="sr-only" aria-live="polite">{Math.round(p.speed)} kilometers per hour, position {p.rank} of {p.players.length}</div>
  </div>;
}

export function CarRacing3DViewport(p:Props) { return <CarRacingRenderErrorBoundary><CarRacing3DViewportInner {...p}/></CarRacingRenderErrorBoundary>; }

export function CarRacing3DPreview({car,plateNumber}:{car:RacingCar;plateNumber:string}) {
  const host=useRef<HTMLDivElement>(null);
  useEffect(()=>{const el=host.current;if(!el)return;let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{el.dataset.webglUnavailable='true';return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.domElement.className='block h-full w-full';el.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(5.4,3.4,7.2);camera.lookAt(0,.7,0);scene.add(new THREE.HemisphereLight('#e4f1ff','#3c2d16',2.2));const light=new THREE.DirectionalLight('#fff0cf',3);light.position.set(-4,9,6);light.castShadow=true;scene.add(light);
    const floor=new THREE.Mesh(new THREE.CircleGeometry(5,48),new THREE.MeshStandardMaterial({color:'#16191b',roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.04;scene.add(floor);const model=makeCar(car.color,plateNumber,car.bodyStyle);scene.add(model.group);
    const resize=()=>{const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(el);resize();let raf=0;const animate=()=>{raf=requestAnimationFrame(animate);model.group.rotation.y+=.003;renderer.render(scene,camera);};raf=requestAnimationFrame(animate);
    return()=>{cancelAnimationFrame(raf);observer.disconnect();scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});renderer.dispose();renderer.domElement.remove();};
  },[car.color,plateNumber]);
  return <div className="overflow-hidden rounded-2xl border border-amber-300/20 bg-[radial-gradient(ellipse_at_top,rgba(202,158,57,.18),transparent_65%),#050505]"><div ref={host} className="h-48 w-full sm:h-56"/><p className="pb-3 text-center text-[10px] font-bold uppercase tracking-[.2em] text-amber-200/65">{car.name} · REAL-TIME 3D MODEL · {plateNumber}</p></div>;
}
