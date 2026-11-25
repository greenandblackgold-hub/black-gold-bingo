import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type RacingCar = { id: string; name: string; color: string };
export type RacingPlayer = { userId: string; name: string; carId: string; plateNumber: string; progress: number; lane: number; speed: number; finished: boolean; eliminated: boolean; isMe: boolean };
export type RacingTrack = { name: string; environment: 'city' | 'country' | 'rocky' | 'coastal'; curveType: 'straight' | 'left' | 'right' | 's-bend' };
export type RacingView = 'chase' | 'cockpit';
type Props = { view: RacingView; players: RacingPlayer[]; me: RacingPlayer; cars: RacingCar[]; speed: number; steer: number; track: RacingTrack; boost: boolean; rank: number; onViewChange: (v: RacingView) => void; onSteer: (v: number) => void; onThrottle: (v: number, reverse?: boolean, boost?: boolean) => void };
type CarModel = { group: THREE.Group; wheels: THREE.Mesh[] };

function plateTexture(plate: string) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) { ctx.fillStyle = '#f4edcf'; ctx.fillRect(0, 0, 512, 128); ctx.strokeStyle = '#171717'; ctx.lineWidth = 12; ctx.strokeRect(6, 6, 500, 116); ctx.fillStyle = '#111'; ctx.font = '900 54px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(plate.slice(0, 18), 256, 66); }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
function makeCar(color: string, plate: string): CarModel {
  const g = new THREE.Group(), wheels: THREE.Mesh[] = [];
  const paint = new THREE.MeshStandardMaterial({ color, metalness: .7, roughness: .25 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#6f9bb0', metalness: .3, roughness: .14, transparent: true, opacity: .84 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#08090b', roughness: .95 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#c1c5c9', metalness: .9, roughness: .2 });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => { const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  add(new THREE.BoxGeometry(2.05,.58,4.15),paint,0,.72,0);
  add(new THREE.BoxGeometry(1.92,.18,1.22),paint,0,1.02,-1.34);
  add(new THREE.BoxGeometry(1.56,.78,1.92),paint,0,1.34,.08);
  const wind = add(new THREE.BoxGeometry(1.43,.53,.08),glass,0,1.39,-.91); wind.rotation.x=-.2;
  const rear = add(new THREE.BoxGeometry(1.4,.48,.07),glass,0,1.4,1.05); rear.rotation.x=.2;
  add(new THREE.BoxGeometry(1.55,.1,1.22),paint,0,1.76,.05);
  [-1,1].forEach((x) => [-1,1].forEach((z) => {
    const tire = add(new THREE.CylinderGeometry(.43,.43,.28,24),rubber,x*1.03,.45,z*1.34); tire.rotation.z=Math.PI/2; wheels.push(tire);
    const rim=add(new THREE.CylinderGeometry(.22,.22,.3,20),chrome,x*1.03,.45,z*1.34); rim.rotation.z=Math.PI/2;
  }));
  [-.68,.68].forEach((x) => {
    add(new THREE.BoxGeometry(.42,.15,.06),new THREE.MeshStandardMaterial({color:'#fff2c6',emissive:'#ffe7a1',emissiveIntensity:1.2}),x,.85,-2.1);
    add(new THREE.BoxGeometry(.42,.16,.06),new THREE.MeshStandardMaterial({color:'#ef263b',emissive:'#b00019',emissiveIntensity:1.1}),x,.84,2.1);
    const exhaust=add(new THREE.CylinderGeometry(.09,.09,.24,12),chrome,x,.42,2.2); exhaust.rotation.x=Math.PI/2;
  });
  const plateMesh=add(new THREE.PlaneGeometry(.95,.24),new THREE.MeshStandardMaterial({map:plateTexture(plate)}),0,.75,2.135);
  add(new THREE.BoxGeometry(1.72,.08,.3),new THREE.MeshStandardMaterial({color:'#111820',metalness:.5}),0,1.48,1.72);
  return {group:g,wheels};
}
function tree(x:number,z:number) {
  const g=new THREE.Group();
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.22,.3,2.3,8),new THREE.MeshStandardMaterial({color:'#65452b'})); trunk.position.y=1.15; g.add(trunk);
  for(let i=0;i<3;i++){const c=new THREE.Mesh(new THREE.ConeGeometry(1.25-i*.18,2.2,9),new THREE.MeshStandardMaterial({color:i%2?'#28613a':'#347747'}));c.position.y=2.45+i*.65;g.add(c);}
  g.position.set(x,0,z);return g;
}
function building(x:number,z:number,i:number) {
  const g=new THREE.Group(),h=7+(i%4)*3;
  const b=new THREE.Mesh(new THREE.BoxGeometry(4.5,h,4.5),new THREE.MeshStandardMaterial({color:['#34434c','#4a4d51','#353d4a'][i%3]}));b.position.y=h/2;g.add(b);
  const w=new THREE.Mesh(new THREE.BoxGeometry(4.56,h*.72,.04),new THREE.MeshStandardMaterial({color:'#d5a94d',emissive:'#9a6821',emissiveIntensity:.35}));w.position.set(0,h/2,-2.28);g.add(w);g.position.set(x,0,z);return g;
}
function control(label:string,caption:string,tone:string,down:()=>void,up:()=>void) {
  const color=tone==='gold'?'border-amber-200 bg-amber-300 text-black':tone==='nitro'?'border-sky-300 bg-sky-500/25 text-sky-100 shadow-[0_0_24px_rgba(40,190,255,.3)]':tone==='muted'?'border-white/20 bg-slate-800/90 text-white':'border-amber-300/45 bg-black/75 text-amber-100';
  return <button type="button" onPointerDown={(e)=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);down();}} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} onContextMenu={(e)=>e.preventDefault()} className={'flex min-h-[62px] min-w-[54px] select-none flex-col items-center justify-center rounded-xl border px-2 py-2 active:scale-95 sm:min-h-[72px] sm:min-w-[68px] '+color} style={{touchAction:'none'}}><span className="text-xl font-black leading-none sm:text-2xl">{label}</span><span className="mt-1 text-[8px] font-black tracking-wider sm:text-[9px]">{caption}</span></button>;
}

export function CarRacing3DViewport(p:Props) {
  const host=useRef<HTMLDivElement>(null), latest=useRef(p); latest.current=p;
  useEffect(()=>{
    const el=host.current;if(!el)return;
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch{el.dataset.webglUnavailable='true';return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.domElement.className='block h-full w-full';el.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.background=new THREE.Color('#91a9b4');scene.fog=new THREE.Fog('#91a9b4',75,230);
    const camera=new THREE.PerspectiveCamera(62,1,.1,320);camera.position.set(0,6.2,13);camera.lookAt(0,.8,-24);
    scene.add(new THREE.HemisphereLight('#d9eaff','#343025',2.1));
    const sun=new THREE.DirectionalLight('#fff0cf',3.1);sun.position.set(-22,38,12);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
    const road=new THREE.Mesh(new THREE.PlaneGeometry(16,280),new THREE.MeshStandardMaterial({color:'#292d32',roughness:.96}));road.rotation.x=-Math.PI/2;road.position.set(0,0,-112);road.receiveShadow=true;scene.add(road);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(420,300),new THREE.MeshStandardMaterial({color:p.track.environment==='coastal'?'#1a657a':'#334c34'}));ground.rotation.x=-Math.PI/2;ground.position.set(0,-.08,-110);scene.add(ground);
    const markers:THREE.Mesh[]=[];
    for(let lane=1;lane<4;lane++)for(let i=0;i<20;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(.12,.025,5.2),new THREE.MeshStandardMaterial({color:'#e6dfc6'}));m.position.set(-8+lane*4,.025,-i*12);scene.add(m);markers.push(m);}
    const railMat=new THREE.MeshStandardMaterial({color:'#9ca6ae',metalness:.82,roughness:.3});
    [-8.25,8.25].forEach(x=>{const rail=new THREE.Mesh(new THREE.BoxGeometry(.22,.42,280),railMat);rail.position.set(x,.72,-112);scene.add(rail);for(let i=0;i<24;i++){const post=new THREE.Mesh(new THREE.BoxGeometry(.25,.9,.25),railMat);post.position.set(x,.45,-i*12);scene.add(post);}});
    const scenery:THREE.Object3D[]=[];
    for(let i=0;i<16;i++){const z=-i*15-5;if(p.track.environment==='city'){scenery.push(building(-13-(i%3),z,i),building(13+(i%2),z-6,i+1));}else if(p.track.environment==='rocky'){for(const side of [-1,1]){const r=new THREE.Mesh(new THREE.DodecahedronGeometry(2+i%3),new THREE.MeshStandardMaterial({color:'#68635d'}));r.position.set(side*(13+i%2*2),2+i%3,z);r.scale.set(1.5,1.3,1.2);scenery.push(r);}}else{scenery.push(tree(-13-(i%3),z),tree(13+(i%2),z-5));}}
    scenery.forEach(x=>scene.add(x));
    const own=makeCar('#e9ad3b','BGB-CAR');scene.add(own.group);
    const opponents=new Map<string,CarModel>();
    const cockpit=new THREE.Group(),dash=new THREE.Mesh(new THREE.BoxGeometry(4.8,.62,1.1),new THREE.MeshStandardMaterial({color:'#101316',metalness:.42}));dash.position.set(0,-.95,-1.55);cockpit.add(dash);
    const steering=new THREE.Group(),rim=new THREE.Mesh(new THREE.TorusGeometry(.48,.075,12,40),new THREE.MeshStandardMaterial({color:'#b6b9bb',metalness:.8}));steering.add(rim);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.13,20),new THREE.MeshStandardMaterial({color:'#bd9140',metalness:.65}));hub.rotation.x=Math.PI/2;steering.add(hub);
    for(let i=0;i<3;i++){const spoke=new THREE.Mesh(new THREE.BoxGeometry(.055,.48,.08),new THREE.MeshStandardMaterial({color:'#b8bdc2',metalness:.9}));spoke.position.y=i===0?.24:-.12;spoke.rotation.z=i===1?.85:i===2?-.85:0;steering.add(spoke);}
    steering.position.set(0,-.55,-1.28);cockpit.add(steering);camera.add(cockpit);scene.add(camera);
    const resize=()=>{const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
    const observer=new ResizeObserver(resize);observer.observe(el);resize();
    let last=performance.now(),travel=0,raf=0;
    const animate=(now:number)=>{raf=requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;const s=latest.current,velocity=Math.max(.4,s.speed/90);travel+=dt*velocity*(s.boost?2.2:1);
      markers.forEach(m=>{m.position.z+=dt*velocity*34;if(m.position.z>15)m.position.z-=240;});
      scenery.forEach(o=>{o.position.z+=dt*velocity*25;if(o.position.z>18)o.position.z-=240;});
      const bend=s.track.curveType==='left'?.22:s.track.curveType==='right'?-.22:s.track.curveType==='s-bend'?Math.sin(travel*.2)*.2:0,offset=s.steer*1.05;
      own.group.position.set(offset*.7,0,4.5);own.group.rotation.y=-s.steer*.16-bend*.16;own.group.visible=s.view==='chase';own.wheels.forEach(w=>{w.rotation.x+=dt*velocity*3;});
      steering.rotation.z=-s.steer*.55;cockpit.visible=s.view==='cockpit';
      if(s.view==='cockpit'){camera.position.set(offset*.18,1.62,3.3);camera.lookAt(offset*.25+bend*2,1.2,-32);}else{camera.position.lerp(new THREE.Vector3(offset*.25,6.2,13.2),.08);camera.lookAt(offset*.2+bend*2,.8,-24);}
      const ids=new Set<string>();
      s.players.forEach(player=>{if(player.isMe||player.finished)return;ids.add(player.userId);let model=opponents.get(player.userId);if(!model){const car=s.cars.find(c=>c.id===player.carId);model=makeCar(car?.color||'#4b9bd2',player.plateNumber);opponents.set(player.userId,model);scene.add(model.group);}const delta=player.progress-s.me.progress;model.group.position.set(player.lane*3.45,0,THREE.MathUtils.clamp(-22-delta*.38,-115,8));model.group.visible=!player.eliminated;model.wheels.forEach(w=>{w.rotation.x+=dt*velocity*2.3;});});
      opponents.forEach((model,id)=>{if(!ids.has(id)){scene.remove(model.group);opponents.delete(id);}});
      const sky=s.track.environment==='coastal'?'#8bb9c8':s.track.environment==='rocky'?'#9a8f80':s.track.environment==='city'?'#8497a4':'#91a9b4';scene.background=new THREE.Color(sky);scene.fog=new THREE.Fog(sky,75,230);
      renderer.render(scene,camera);
    };
    raf=requestAnimationFrame(animate);
    return()=>{cancelAnimationFrame(raf);observer.disconnect();scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});renderer.dispose();renderer.domElement.remove();};
  },[]);
  return <div className="relative isolate w-full overflow-hidden rounded-2xl border border-amber-300/30 bg-[#111820] shadow-[0_18px_55px_rgba(0,0,0,.55)]">
    <div ref={host} className="h-[min(68vh,560px)] min-h-[340px] w-full sm:min-h-[440px]" />
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/80 to-transparent p-3 sm:p-4">
      <div className="rounded-xl border border-amber-300/40 bg-black/70 px-3 py-2"><p className="text-[9px] font-black uppercase tracking-[.2em] text-amber-300">{p.track.name}</p><p className="mt-1 font-mono text-xl font-black text-white">P{p.rank}<span className="text-xs text-amber-200/70"> / {p.players.length}</span></p></div>
      <div className="rounded-xl border border-amber-300/40 bg-black/75 px-4 py-2 text-center"><p className="font-mono text-3xl font-black tabular-nums text-white">{Math.round(p.speed)}</p><p className="text-[9px] font-black tracking-[.22em] text-amber-200">KM/H</p></div>
      <div className="rounded-xl border border-sky-300/50 bg-slate-950/85 px-3 py-2"><p className="font-mono text-xs font-black tracking-wider text-sky-200">{p.me.plateNumber}</p><p className={'mt-1 text-[9px] font-black '+(p.boost?'animate-pulse text-cyan-200':'text-slate-400')}>N₂O {p.boost?'ACTIVE':'READY'}</p></div>
    </div>
    <div className="absolute right-3 top-[76px] flex gap-1 rounded-xl border border-white/15 bg-black/65 p-1">
      <button type="button" onClick={()=>p.onViewChange('chase')} aria-pressed={p.view==='chase'} className={'rounded-lg px-3 py-2 text-[10px] font-black '+(p.view==='chase'?'bg-amber-300 text-black':'text-amber-100')}>CHASE</button>
      <button type="button" onClick={()=>p.onViewChange('cockpit')} aria-pressed={p.view==='cockpit'} className={'rounded-lg px-3 py-2 text-[10px] font-black '+(p.view==='cockpit'?'bg-amber-300 text-black':'text-amber-100')}>COCKPIT</button>
    </div>
    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-3 pb-3 pt-12 sm:px-5 sm:pb-5">
      <div className="flex gap-2">{control('◀','LEFT','default',()=>p.onSteer(-1),()=>p.onSteer(0))}{control('▶','RIGHT','default',()=>p.onSteer(1),()=>p.onSteer(0))}</div>
      <div className="flex items-end gap-2">{control('▼','BRAKE / REV','muted',()=>p.onThrottle(1,true,false),()=>p.onThrottle(0,false,false))}{control('▲','GAS','gold',()=>p.onThrottle(1,false,false),()=>p.onThrottle(0,false,false))}{control('N₂O','NITRO','nitro',()=>p.onThrottle(1,false,true),()=>p.onThrottle(0,false,false))}</div>
    </div>
    <div className="pointer-events-none absolute bottom-[88px] left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-[9px] font-black tracking-[.2em] text-white/75">{p.view==='cockpit'?'3D COCKPIT · LIVE DASH':'3D CHASE CAMERA'}</div>
    <div className="sr-only" aria-live="polite">{Math.round(p.speed)} kilometers per hour, position {p.rank} of {p.players.length}</div>
  </div>;
}

export function CarRacing3DPreview({car,plateNumber}:{car:RacingCar;plateNumber:string}) {
  const host=useRef<HTMLDivElement>(null);
  useEffect(()=>{const el=host.current;if(!el)return;let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{el.dataset.webglUnavailable='true';return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.domElement.className='block h-full w-full';el.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(5.4,3.4,7.2);camera.lookAt(0,.7,0);scene.add(new THREE.HemisphereLight('#e4f1ff','#3c2d16',2.2));const light=new THREE.DirectionalLight('#fff0cf',3);light.position.set(-4,9,6);light.castShadow=true;scene.add(light);
    const floor=new THREE.Mesh(new THREE.CircleGeometry(5,48),new THREE.MeshStandardMaterial({color:'#16191b',roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.04;scene.add(floor);const model=makeCar(car.color,plateNumber);scene.add(model.group);
    const resize=()=>{const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(el);resize();let raf=0;const animate=()=>{raf=requestAnimationFrame(animate);model.group.rotation.y+=.003;renderer.render(scene,camera);};raf=requestAnimationFrame(animate);
    return()=>{cancelAnimationFrame(raf);observer.disconnect();scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});renderer.dispose();renderer.domElement.remove();};
  },[car.color,plateNumber]);
  return <div className="overflow-hidden rounded-2xl border border-amber-300/20 bg-[radial-gradient(ellipse_at_top,rgba(202,158,57,.18),transparent_65%),#050505]"><div ref={host} className="h-48 w-full sm:h-56"/><p className="pb-3 text-center text-[10px] font-bold uppercase tracking-[.2em] text-amber-200/65">{car.name} · REAL-TIME 3D MODEL · {plateNumber}</p></div>;
}
