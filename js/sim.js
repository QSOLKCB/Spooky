// SPDX-License-Identifier: Apache-2.0
// Pure 60 Hz simulation. x = across the valley; z = towards the outpost.
import {clamp,seededRandom} from '../vendor/vanillajs/modules/math/index.js';
import {STATIONS,WEAPONS,ENEMIES,UPGRADES,DIFFICULTIES,stationForRound} from './content.js';
import {freshFuel} from './world.js';
import {launchShell,advanceShell,burst,shellCase,advanceParticles,pushEnemy,moveHorde} from './physics.js';
export const TICK_RATE = 60;
export const BOUNDS = Object.freeze({minX:-52,maxX:52,minZ:4,maxZ:96,wire:91});
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
const blank = () => ({damage:0,radius:0,rate:0,capacity:0,cooling:0,repair:0});
export function waveSize(round) { return 17+7*round+Math.floor((round-1)/3)*5; }
export function weaponStats(s, key=s.weapon) {
  const w=WEAPONS[key], station=STATIONS.find(x=>x.weapons.includes(key)), u=s.upgrades[station.id];
  return {...w,damage:w.damage*(1+u.damage*.25),radius:w.radius*(1+u.radius*.16),
    interval:Math.max(3,Math.round(w.interval/(1+u.rate*.14))),
    reload:Math.max(30,Math.round(w.reload/(1+u.rate*.14))),
    magazine:Math.round(w.magazine*(1+u.capacity*.25)),
    flight:Math.round(w.flight/(1+u.cooling*.12)),heat:w.heat/(1+u.cooling*.3)};
}
export function create({seed=13013,difficulty='night'}={}) {
  if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw new RangeError('seed must be an unsigned 32-bit integer');
  if(!own(DIFFICULTIES,difficulty))throw new TypeError('unknown difficulty');
  const s={seed,difficulty,tick:0,round:1,status:'playing',hp:100,score:0,kills:0,shots:0,hits:0,
    upgrades:Object.fromEntries(STATIONS.map(x=>[x.id,blank()])),weapons:{},enemies:[],shells:[],effects:[],events:[],
    nextId:1,fxSerial:1,aim:{x:0,z:45},target:null,hitConfirm:null,offers:[],roundKills:0,combo:0,comboUntil:0,
    particles:[],craters:[],remains:[],fuel:[]};
  for(const [key,w] of Object.entries(WEAPONS))s.weapons[key]={ammo:w.magazine,cooldown:0,reload:0,heat:0,overheated:false,recoil:0};
  beginRound(s);return s;
}
function beginRound(s) {
  s.station=stationForRound(s.round).id;s.weapon=stationForRound(s.round).weapons[0];
  s.total=waveSize(s.round);s.spawned=0;s.resolved=0;s.roundTick=0;s.roundKills=0;s.nextSpawn=55;
  s.enemies=[];s.shells=[];s.effects=[];s.offers=[];s.status='playing';
  s.particles=[];s.craters=[];s.remains=[];s.fuel=freshFuel();s.hitConfirm=null;s.target=null;
  // Every station arrives resupplied. Upgrades survive every rotation.
  for(const key of stationForRound(s.round).weapons){const w=s.weapons[key];Object.assign(w,{ammo:weaponStats(s,key).magazine,cooldown:0,reload:0,heat:0,overheated:false,recoil:0});}
  s.events=[{type:'round',round:s.round}];
}
function spawn(s) {
  // Each spawn owns a reproducible random stream; rendering never consumes it.
  const random=seededRandom((s.seed ^ Math.imul(s.round,2654435761) ^ Math.imul(s.spawned+1,1597334677))>>>0);
  const r=random(),kind=s.round>=3&&r<Math.min(.24,.06+s.round*.008)?'brute':s.round>=2&&r<.4?'runner':'walker';
  const spec=ENEMIES[kind],hp=spec.hp*(1+(s.round-1)*.055);
  const lane=Math.floor(random()*5)-2;
  s.enemies.push({id:s.nextId++,kind,x:clamp(lane*16+(random()-.5)*18,-47,47),z:7+random()*8,
    hp,maxHp:hp,speed:spec.speed*DIFFICULTIES[s.difficulty].pressure*(1+Math.min(1,(s.round-1)*.025)),
    phase:random()*6.28,flash:0,kx:0,kz:0,stagger:0,stride:0,vx:0,vz:0,variant:Math.floor(random()*4)});
  s.spawned++;s.nextSpawn=Math.max(12,41-s.round)+Math.floor(random()*15);
}
export function selectWeapon(s,index) {
  if(s.status!=='playing'||!Number.isInteger(index))return false;
  const key=stationForRound(s.round).weapons[index];if(!key)return false;
  s.weapon=key;return true;
}
export function reload(s) {
  if(s.status!=='playing')return false;
  const w=s.weapons[s.weapon],stats=weaponStats(s);
  if(w.reload||w.ammo>=stats.magazine)return false;
  w.reload=stats.reload;s.events.push({type:'reload'});return true;
}
function impact(s,shot) {
  const queue=[shot];let hits=0;
  // Each drum is marked destroyed before enqueueing; chains cannot detonate twice.
  while(queue.length){
    const blast=queue.shift(),heavy=blast.radius>5;
    const seed=(s.seed^Math.imul(s.tick,673)^Math.imul(s.fxSerial++,997))>>>0;
    s.effects.push({type:'blast',x:blast.x,z:blast.z,radius:blast.radius,age:0,life:heavy?95:18,seed,fuel:blast.key==='fuel'});
    s.events.push({type:'impact',heavy,x:blast.x,z:blast.z,seed,weapon:blast.key});
    burst(s,{...blast,seed});
    for(const e of s.enemies){
      if(e.hp<=0)continue;
      const distance=Math.hypot(e.x-blast.x,e.z-blast.z);
      if(distance>blast.radius+ENEMIES[e.kind].size*.65)continue;
      const falloff=heavy?1-.4*clamp(distance/blast.radius,0,1):1;
      const critical=blast.targetId===e.id&&blast.head&&(blast.key==='gatling'||blast.key==='m2');
      e.hp-=blast.damage*falloff*(critical?1.65:1);e.flash=8;hits++;
      if(heavy)pushEnemy(e,blast.x,blast.z,16*falloff);
      s.hitConfirm={tick:s.tick,critical:Boolean(critical)};
      if(e.hp<=0){
        s.kills++;s.roundKills++;s.resolved++;s.combo=s.tick<s.comboUntil?s.combo+1:1;s.comboUntil=s.tick+130;
        const multiplier=1+Math.min(4,Math.floor(s.combo/5))*.25;
        const points=Math.round(ENEMIES[e.kind].points*DIFFICULTIES[s.difficulty].points*multiplier);
        s.score+=points;s.effects.push({type:'kill',x:e.x,z:e.z,age:0,life:40,points,critical});
        s.remains.push({x:e.x,z:e.z,kind:e.kind,age:0,seed});
        burst(s,{x:e.x,z:e.z,radius:2,seed:seed^e.id,body:e.kind});
      }
    }
    for(const drum of s.fuel){
      if(drum.hp<=0||Math.hypot(drum.x-blast.x,drum.z-blast.z)>blast.radius+1)continue;
      drum.hp-=blast.damage;
      if(drum.hp<=0){s.score+=25;queue.push({x:drum.x,z:drum.z,radius:9,damage:95,key:'fuel'});}
    }
  }
  if(hits)s.hits++;
}
function fire(s) {
  const w=s.weapons[s.weapon],stats=weaponStats(s);
  if(w.cooldown||w.reload||w.overheated)return;
  if(w.ammo===0){reload(s);return;}
  w.ammo--;w.cooldown=stats.interval;w.heat=Math.min(100,w.heat+stats.heat);s.shots++;
  w.recoil=Math.min(1.5,w.recoil+(stats.radius>5?1:.45));
  if(w.heat>=100){w.overheated=true;s.events.push({type:'hot'});}
  const shot={x:s.aim.x,z:s.aim.z,damage:stats.damage,radius:stats.radius,remaining:stats.flight,flight:stats.flight,key:s.weapon,
    targetId:s.target?.id,head:s.target?.head};
  s.events.push({type:'fire',weapon:s.weapon,x:shot.x,z:shot.z,seed:(s.seed^s.shots)>>>0});
  const target=s.enemies.find(e=>e.id===shot.targetId);
  if(stats.flight)s.shells.push(launchShell(shot,s.station));else impact(s,shot);
  if(s.weapon==='m2')shellCase(s);
  s.effects.push({type:'tracer',x:shot.x,z:shot.z,age:0,life:6,key:s.weapon,targetKind:target?.kind,head:shot.head});
}
function draft(s) {
  const u=s.upgrades[s.station],pool=UPGRADES.filter(x=>u[x.id]<x.max);
  const random=seededRandom((s.seed ^ Math.imul(s.round,2246822519))>>>0);
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  // At maximum weapon ranks, repeatable repair offers remain useful and distinct.
  if(pool.length<3){for(const item of UPGRADES.filter(x=>x.id!=='repair'))if(!pool.includes(item))pool.push(item);}
  s.offers=pool.slice(0,3).map(x=>x.id);
}
export function chooseUpgrade(s,id) {
  if(s.status!=='upgrade'||!s.offers.includes(id))return false;
  const spec=UPGRADES.find(x=>x.id===id),u=s.upgrades[s.station];
  if(id==='repair'||u[id]>=spec.max)s.hp=Math.min(100,s.hp+25);
  else u[id]++;
  s.round++;beginRound(s);return true;
}
export function step(s,input={}) {
  if(s.status!=='playing')return;
  s.events=[];s.tick++;s.roundTick++;
  if(Number.isFinite(input.x)&&Number.isFinite(input.z))s.aim={x:clamp(input.x,BOUNDS.minX,BOUNDS.maxX),z:clamp(input.z,BOUNDS.minZ,BOUNDS.maxZ)};
  s.target=Number.isSafeInteger(input.targetId)?{id:input.targetId,head:input.head===true}:null;
  if(input.weapon!==undefined)selectWeapon(s,input.weapon);
  for(const [key,w] of Object.entries(s.weapons)){
    if(w.cooldown>0)w.cooldown--;
    if(w.reload>0&&--w.reload===0)w.ammo=weaponStats(s,key).magazine;
    w.heat=Math.max(0,w.heat-.15);if(w.overheated&&w.heat<=32)w.overheated=false;
    w.recoil=(w.recoil||0)*.82;
  }
  if(input.reload)reload(s);
  if(input.fire)fire(s);
  for(const shot of s.shells)if(advanceShell(shot))impact(s,shot);
  s.shells=s.shells.filter(x=>x.remaining>0);
  moveHorde(s.enemies);
  for(const e of s.enemies){
    if(e.hp<=0)continue;
    e.flash=Math.max(0,e.flash-1);
    if(e.z>=BOUNDS.wire){s.hp=Math.max(0,s.hp-ENEMIES[e.kind].damage*DIFFICULTIES[s.difficulty].damage);e.hp=0;s.resolved++;s.combo=0;s.events.push({type:'breach'});}
  }
  s.enemies=s.enemies.filter(x=>x.hp>0);
  for(const e of s.effects)e.age++;
  s.effects=s.effects.filter(e=>e.age<e.life).slice(-180);
  advanceParticles(s);
  if(s.tick>=s.comboUntil)s.combo=0;
  if(s.hp<=0){s.status='lost';s.events.push({type:'lost'});return;}
  if(s.spawned<s.total&&--s.nextSpawn<=0)spawn(s);
  if(s.resolved===s.total&&s.spawned===s.total&&s.shells.length===0){
    s.status='upgrade';s.hp=Math.min(100,s.hp+8);s.score+=s.round*200;draft(s);s.events.push({type:'clear'});
  }
}
