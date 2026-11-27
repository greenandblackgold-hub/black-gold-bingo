import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const game = readFileSync(new URL('../../client-source/src/components/games/CarRacingGame.tsx', import.meta.url), 'utf8');
const view = readFileSync(new URL('../../client-source/src/components/games/CarRacing3D.tsx', import.meta.url), 'utf8');
const service = readFileSync(new URL('../src/services/carRacingDemoService.js', import.meta.url), 'utf8');

test('Car Racing offers multiple premium vehicle classes and selectable world locations', () => {
  assert.match(game, /state\?\.cars\?\?\[\]\)\.map\(car/);
  for (const [location,environment] of [['city','city'],['village','village'],['country','country'],['rocky','rocky'],['coast','coastal'],['airport','airport'],['parking','parking']]) {
    assert.ok(game.includes(`id:'${location}'`) || game.includes(`id: '${location}'`) || game.includes(`id:'${location}',`), `missing ${location} solo world preset`);
    assert.ok(view.includes(`environment==='${environment}'`) || view.includes(`'${environment}'`), `missing ${environment} scene support`);
  }
  assert.match(game, /car\.bodyStyle\|\|'sedan'/);
});

test('Car Racing supports exiting and re-entering the vehicle with on-foot movement', () => {
  assert.match(game, /onExitVehicle=\{\(\)=>/);
  assert.match(game, /onEnterVehicle=\{\(\)=>/);
  assert.match(game, /onFootMove=\{\(x,z\)=>/);
  assert.match(view, /EXIT VEHICLE/);
  assert.match(view, /ON FOOT · WASD \/ ARROWS/);
  assert.match(view, /ENTER CAR · F/);
  assert.match(view, /latest\.current\.onFootMove/);
});

test('Car Racing steering animates a full steering-wheel turn and front-wheel articulation', () => {
  assert.match(view, /steering\.rotation\.z=-s\.steer\*Math\.PI\*2/);
  assert.match(view, /w\.rotation\.y=s\.steer\*\.72/);
});

test('Car Racing supports passenger pickup and drop-off in solo walk mode', () => {
  assert.match(game, /onPassengerAction=\{\(\)=>/);
  assert.match(view, /PICK UP PASSENGER/);
  assert.match(view, /DROP PASSENGER/);
  assert.match(view, /passenger\.visible=s\.passengerCount>0&&!s\.onFoot/);
});

test('Car Racing initializes shared scenery helpers before first use', () => {
  const collection = view.indexOf('const scenery:THREE.Object3D[]=[];');
  const helper = view.indexOf('const addWorldObject=(object:THREE.Object3D)=>{scene.add(object);scenery.push(object);};');
  const firstUse = view.indexOf('addWorldObject(post);');
  assert.ok(collection >= 0 && helper > collection && firstUse > helper, 'scenery collection and helper must be initialized before roadside posts use them');
  assert.equal(view.indexOf('const addWorldObject=', helper + 1), -1, 'scenery helper must have one declaration');
});

test('Car Racing provides ten selectable vehicles with distinct body styles and a live 3D selection preview', () => {
  const styles = ['hypercar','coupe','sedan','track','electric','suv','muscle','roadster','grandtourer','concept'];
  for (const style of styles) assert.ok(service.includes(`bodyStyle: '${style}'`), `missing vehicle class ${style}`);
  assert.match(game, /YOUR SELECTED VEHICLE/);
  assert.match(game, /<CarRacing3DPreview car=\{selectedCar\}/);
  assert.match(view, /if\(roadster\)/);
  assert.match(view, /if\(muscle\)/);
  assert.match(view, /if\(hyper\)/);
  assert.match(view, /if\(suv\)/);
});

test('Car Racing renders distinct daytime and nighttime environments with dedicated location scenery', () => {
  for (const environment of ['city','country','rocky','coastal','airport','village','parking']) {
    assert.ok(view.includes(`${environment}:{sky:`), `missing lighting and terrain palette for ${environment}`);
  }
  assert.match(view, /if\(safeTrack\.environment==='city'\)\{/);
  assert.match(view, /if\(safeTrack\.environment==='country'\)\{/);
  assert.match(view, /if\(safeTrack\.environment==='parking'\)\{/);
  assert.match(view, /if\(safeTrack\.environment==='airport'\)\{/);
  assert.match(view, /if\(safeTrack\.environment==='coastal'\)\{/);
  assert.match(view, /style==='feminine'/);
  assert.match(view, /style==='masculine'/);
});

test('Car Racing requires a stopped vehicle before exit and supports walking, passenger pickup/drop-off, and re-entry', () => {
  assert.match(view, /key==='e'.*latest\.current\.speed<=2.*latest\.current\.onExitVehicle/);
  assert.match(view, /disabled=\{p\.speed>2\}/);
  assert.match(game, /setPassengerPosition\(\{x:footPosition\.x\+\.8,z:footPosition\.z\}\)/);
  assert.match(game, /Math\.hypot\(footPosition\.x-passengerPosition\.x,footPosition\.z-passengerPosition\.z\)>2\.5/);
  assert.match(view, /disabled=\{Math\.hypot\(p\.footPosition\.x,p\.footPosition\.z\)>2\.5\}/);
  assert.match(view, /PICK UP PASSENGER/);
  assert.match(view, /DROP PASSENGER/);
});

test('Car Racing uses smooth full-lock steering and front-wheel articulation', () => {
  assert.match(view, /steering\.rotation\.z=THREE\.MathUtils\.lerp\(steering\.rotation\.z,-s\.steer\*Math\.PI\*2/);
  assert.match(view, /w\.rotation\.y=THREE\.MathUtils\.lerp\(w\.rotation\.y,s\.steer\*\.72/);
});
