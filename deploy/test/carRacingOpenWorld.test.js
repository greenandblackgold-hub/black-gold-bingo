import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const game = readFileSync(new URL('../../client-source/src/components/games/CarRacingGame.tsx', import.meta.url), 'utf8');
const view = readFileSync(new URL('../../client-source/src/components/games/CarRacing3D.tsx', import.meta.url), 'utf8');

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
