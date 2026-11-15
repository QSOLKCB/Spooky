// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {create,step,chooseUpgrade,selectWeapon,reload,weaponStats,waveSize} from '../js/sim.js';
import {stationForRound,ENEMIES,UPGRADES} from '../js/content.js';
import {project,unproject,enemyBounds,aimFromScreen} from '../js/render.js';
import {FixedClock} from '../vendor/vanillajs/modules/time/index.js';
const advance=(s,n,input={})=>{for(let i=0;i<n;i++)step(s,typeof input==='function'?input(s,i):input);};
function enemy(s,{x=0,z=45,kind='walker',hp=ENEMIES[kind].hp,speed=0}={}){const e={id:s.nextId++,kind,x,z,hp,maxHp:hp,speed,phase:0,flash:0};s.enemies.push(e);return e;}
function quiet(s=create()){s.nextSpawn=100000;return s;}
function atStation(station){const s=quiet();s.round={gunship:1,artillery:2,infantry:3}[station];s.station=station;s.weapon=stationForRound(s.round).weapons[0];return s;}
function pilot(s){
  const weapon=s.station==='gunship'?2:0,key=stationForRound(s.round).weapons[weapon];
  const e=s.enemies.reduce((a,b)=>!a||b.z>a.z?b:a,null),w=weaponStats(s,key);
  return {x:e?.x??0,z:e?e.z+e.speed*w.flight:45,fire:!!e,weapon};
}
test('seed and difficulty validation rejects malformed public construction',()=>{
  for(const seed of [-1,2**32,NaN,Infinity,1.5,'1'])assert.throws(()=>create({seed}));
  for(const difficulty of ['unknown','__proto__','toString',null])assert.throws(()=>create({difficulty}));
  assert.equal(create({seed:0}).seed,0);
});
test('seeded input streams reproduce full state including choices',()=>{
  for(const difficulty of ['cadet','night','blackout']){
    const a=create({seed:9,difficulty}),b=create({seed:9,difficulty});
    for(let tick=0;tick<12000;tick++){
      const input=pilot(a);step(a,input);step(b,input);
      if(a.status==='upgrade'){assert.deepEqual(a.offers,b.offers);chooseUpgrade(a,a.offers[0]);chooseUpgrade(b,b.offers[0]);}
    }assert.deepEqual(a,b);
  }
});
test('a real nine-round run rotates stations, escalates hordes and retains upgrades',()=>{
  const s=create(),history=[],ranks={};
  for(let ticks=0;ticks<40000&&s.round<=9&&s.status!=='lost';ticks++){
    step(s,pilot(s));
    if(s.status==='upgrade'){
      history.push({round:s.round,station:s.station,total:s.total,kills:s.roundKills});
      assert.equal(s.offers.length,3);assert.equal(new Set(s.offers).size,3);
      const frozen=JSON.stringify(s);advance(s,20,{fire:true});assert.equal(JSON.stringify(s),frozen);
      const id=s.offers.includes('damage')?'damage':s.offers[0],station=s.station;
      chooseUpgrade(s,id);ranks[station]={...s.upgrades[station]};
      for(const [key,value] of Object.entries(ranks))assert.deepEqual(s.upgrades[key],value);
    }
  }
  assert.equal(s.round,10);assert.equal(history.length,9);assert.equal(s.status,'playing');
  assert.deepEqual(history.map(x=>x.station),Array(3).fill(['gunship','artillery','infantry']).flat());
  for(let i=1;i<history.length;i++)assert.ok(history[i].total>history[i-1].total);
});
test('every weapon hits real targets and heavy blasts damage groups once',()=>{
  for(const station of ['gunship','artillery','infantry'])for(const index of stationForRound({gunship:1,artillery:2,infantry:3}[station]).weapons.keys()){
    const s=atStation(station);selectWeapon(s,index);const stats=weaponStats(s);enemy(s);enemy(s,{x:1});
    step(s,{x:0,z:45,fire:true});advance(s,stats.flight+1);
    assert.equal(s.kills,2);assert.equal(s.resolved,2);assert.equal(s.shots,1);assert.equal(s.hits,1);
    advance(s,60);assert.equal(s.kills,2);
  }
});
test('artillery has a real delay and leading a moving target matters',()=>{
  const s=atStation('artillery'),e=enemy(s,{speed:.08,hp:1000}),stats=weaponStats(s);
  step(s,{x:0,z:e.z+e.speed*stats.flight,fire:true});assert.equal(s.hits,0);assert.equal(s.shells.length,1);
  advance(s,stats.flight-2);assert.equal(s.hits,0);step(s);assert.equal(s.hits,1);assert.ok(e.hp<1000);
});
test('magazines, manual reload and automatic empty reload preserve cadence',()=>{
  const s=atStation('infantry'),w=s.weapons.m2;w.ammo=1;
  step(s,{fire:true});assert.equal(w.ammo,0);advance(s,10,{fire:true});assert.ok(w.reload>0);
  const before=s.shots;advance(s,20,{fire:true});assert.equal(s.shots,before);
  advance(s,w.reload);assert.equal(w.ammo,weaponStats(s).magazine);assert.equal(reload(s),false);
  step(s,{fire:true});assert.equal(reload(s),true);const remaining=w.reload;assert.equal(reload(s),false);assert.equal(w.reload,remaining);
});
test('switching gunship weapons cannot refill or cancel their reload/cooldown',()=>{
  const s=quiet();step(s,{fire:true});const before=s.weapons.gatling.ammo;assert.ok(reload(s));
  selectWeapon(s,2);step(s,{fire:true});selectWeapon(s,0);step(s,{fire:true});
  assert.equal(s.weapons.gatling.ammo,before);assert.ok(s.weapons.gatling.reload>0);assert.ok(s.weapons.howitzer.cooldown>0);
  assert.equal(selectWeapon(s,6),false);assert.equal(selectWeapon(s,1.2),false);
});
test('M2 overheats, refuses shots during recovery and becomes usable again',()=>{
  const s=atStation('infantry'),w=s.weapons.m2;w.heat=99;
  step(s,{fire:true});assert.equal(w.overheated,true);const shots=s.shots;
  advance(s,30,{fire:true});assert.equal(s.shots,shots);
  advance(s,500);assert.equal(w.overheated,false);step(s,{fire:true});assert.equal(s.shots,shots+1);
});
test('cooling, capacity, radius, damage and rate upgrades change actual weapon stats',()=>{
  for(const station of ['gunship','artillery','infantry']){
    const s=atStation(station),before=weaponStats(s);for(const id of ['damage','radius','rate','capacity','cooling'])s.upgrades[station][id]=1;
    const after=weaponStats(s);assert.ok(after.damage>before.damage);assert.ok(after.radius>before.radius);assert.ok(after.magazine>before.magazine);assert.ok(after.reload<before.reload);assert.ok(after.interval<=before.interval);assert.ok(after.heat<=before.heat);assert.ok(after.flight<=before.flight);
  }
});
test('a breach damages the outpost exactly once; loss freezes every field',()=>{
  const s=quiet();s.hp=1;enemy(s,{z:90.99,speed:1});step(s);assert.equal(s.status,'lost');assert.equal(s.hp,0);assert.equal(s.resolved,1);
  const frozen=JSON.stringify(s);advance(s,60,{fire:true});assert.equal(JSON.stringify(s),frozen);
  assert.equal(chooseUpgrade(s,'repair'),false);assert.equal(selectWeapon(s,2),false);assert.equal(reload(s),false);
});
test('passive play really loses; several seeds expose all enemy classes',()=>{
  const kinds=new Set();for(let seed=1;seed<=12;seed++){
    const s=create({seed});advance(s,6000);assert.equal(s.status,'lost');
    const late=atStation('infantry');late.seed=seed;late.nextSpawn=0;late.total=40;
    for(let i=0;i<1900;i++){step(late);late.enemies.forEach(e=>kinds.add(e.kind));}
  }assert.deepEqual([...kinds].sort(),['brute','runner','walker']);
});
test('upgrade choices are transactional and capped upgrades become field repairs',()=>{
  const s=quiet();const frozen=JSON.stringify(s);assert.equal(chooseUpgrade(s,'damage'),false);assert.equal(JSON.stringify(s),frozen);
  s.status='upgrade';s.offers=['damage','capacity','repair'];s.hp=42;s.upgrades.gunship.damage=8;
  assert.equal(chooseUpgrade(s,'toString'),false);assert.equal(chooseUpgrade(s,'damage'),true);assert.equal(s.hp,67);assert.equal(s.upgrades.gunship.damage,8);assert.equal(s.round,2);
  assert.equal(chooseUpgrade(s,'damage'),false);
});
test('terminal wave waits for in-flight shells; offers remain three distinct IDs at rank limits',()=>{
  const s=quiet();s.spawned=s.resolved=s.total;for(const u of UPGRADES)if(Number.isFinite(u.max))s.upgrades.gunship[u.id]=u.max;
  s.shells=[{x:0,z:45,damage:10,radius:3,remaining:3,flight:3}];step(s);assert.equal(s.status,'playing');advance(s,2);assert.equal(s.status,'upgrade');assert.equal(s.offers.length,3);assert.equal(new Set(s.offers).size,3);
});
test('nonfinite aim is ignored, finite aim clamps, and untrusted indices are inert',()=>{
  const s=quiet();step(s,{x:NaN,z:Infinity,weapon:'__proto__'});assert.deepEqual(s.aim,{x:0,z:45});
  step(s,{x:1e12,z:-1e12});assert.deepEqual(s.aim,{x:52,z:4});
});
test('ground projection inverts across all stations and the whole play area',()=>{
  for(const station of ['gunship','artillery','infantry'])for(const x of [-50,-20,0,20,50])for(const z of [4,20,55,85,96]){
    const p=project(station,x,z),q=unproject(station,p.x,p.y);assert.ok(Math.abs(q.x-x)<1e-10);assert.ok(Math.abs(q.z-z)<1e-10);
  }
});
test('clicking visible heads and torsos targets the body rather than distant terrain',()=>{
  for(const station of ['gunship','artillery','infantry'])for(const kind of Object.keys(ENEMIES))for(const z of [12,50,85]){
    const s=atStation(station),e=enemy(s,{x:12,z,kind}),b=enemyBounds(station,e);
    for(const y of [b.centerY,b.top+3,b.bottom-3])assert.deepEqual(aimFromScreen(s,b.centerX,y),{x:e.x,z:e.z});
  }
});
test('fixed clock produces identical combat at 30/60/120/144 Hz with bounded catch-up',()=>{
  const states=[];for(const hz of [30,60,120,144]){
    const s=create(),clock=new FixedClock({step:1/60,maxFrame:.15,maxSteps:8});
    for(let f=0;f<hz*12;f++)clock.advance(1/hz,()=>step(s,{x:0,z:45,fire:true}));states.push(s);
  }states.forEach(s=>assert.deepEqual(s,states[0]));const clock=new FixedClock({step:1/60,maxFrame:.15,maxSteps:8});let n=0;const result=clock.advance(500,()=>n++);assert.equal(n,8);assert.ok(result.dropped>499);
});
test('seed sweep maintains finite state and bounded effects during actual combat',()=>{
  for(let seed=0;seed<30;seed++){
    const s=create({seed});for(let i=0;i<6000&&s.status!=='lost';i++){
      step(s,pilot(s));if(s.status==='upgrade')chooseUpgrade(s,s.offers[0]);
      assert.ok(s.hp>=0&&s.hp<=100);assert.ok(s.enemies.length<=s.total);assert.ok(s.effects.length<=180);assert.ok(s.shells.length<30);
      for(const e of s.enemies)assert.ok(Number.isFinite(e.x+e.z+e.hp));
    }
  }
});
