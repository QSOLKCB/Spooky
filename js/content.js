// SPDX-License-Identifier: Apache-2.0
// All weapons and enemies are fictional arcade abstractions, not firing tables.
export const VERSION = '0.2.0';
export const STATIONS = [
  {id:'gunship', short:'AC-130', name:'Spectre orbit', role:'AIR SUPPORT', tag:'01',
    description:'Watch the perimeter from above. Switch between rapid fire and heavy splash damage.',
    tip:'25 mm for heads. 40 mm for quick clusters. 105 mm for a huge area-clearing blast.', weapons:['gatling','bofors','howitzer']},
  {id:'artillery', short:'ARTILLERY', name:'Thunder battery', role:'INDIRECT FIRE', tag:'02',
    description:'Lob high-explosive shells across the valley. Lead moving groups and make every impact count.',
    tip:'Lead moving groups. Heavy blasts stagger and push back survivors; bulwarks resist the impulse.', weapons:['battery']},
  {id:'infantry', short:'M2 .50 CAL', name:'Last line', role:'GROUND DEFENCE', tag:'03',
    description:'Take the gun at the wire. Hold the line, change belts and keep the barrel cool.',
    tip:'Aim for heads with the M2. Fire in bursts, and use fuel drums when the horde clusters.', weapons:['m2']},
  {id:'sniper', short:'20 MM RIFLE', name:'Long watch', role:'PRECISION OVERWATCH', tag:'04',
    description:'Man a fixed 20 mm bolt-action rifle. Scope in, pick a head and line up the horde.',
    tip:'Hold right mouse / Shift or toggle SCOPE. Click once per shot. Heads hit harder; aligned targets take collaterals. Buildings stop rounds.', weapons:['rifle']}
];
export const WEAPONS = {
  gatling: {name:'25 mm Gatling', label:'25 MM', damage:30, radius:2.6, interval:7, flight:7, magazine:90, reload:95, heat:1.5},
  bofors: {name:'40 mm cannon', label:'40 MM', damage:135, radius:11, interval:26, flight:22, magazine:16, reload:125, heat:0},
  howitzer: {name:'105 mm howitzer', label:'105 MM', damage:400, radius:26, interval:100, flight:40, magazine:5, reload:155, heat:0},
  battery: {name:'155 mm field gun', label:'155 MM HE', damage:170, radius:12, interval:66, flight:55, magazine:5, reload:130, heat:0},
  m2: {name:'M2 Browning', label:'.50 BMG', damage:38, radius:3.1, interval:6, flight:0, magazine:80, reload:150, heat:3.9},
  rifle: {name:'20 mm anti-materiel rifle', label:'20 MM BOLT', damage:200, radius:0, interval:54, flight:0, magazine:5, reload:132, heat:0}
};
// Arcade effect profiles: the slow 105 mm gets a distinct impact, not just a longer cooldown.
const EXPLOSIONS = {
  light:{life:18,flameTicks:10,ringTicks:10,puffs:4,visualScale:1,plume:1,particles:5,throwSpeed:3,lift:4,impulse:0,sound:null},
  heavy:{life:95,flameTicks:25,ringTicks:25,puffs:10,visualScale:1,plume:1,particles:20,throwSpeed:9,lift:12,impulse:16,sound:'impact'},
  howitzer:{life:160,flameTicks:38,ringTicks:36,puffs:18,visualScale:1.35,plume:1.5,particles:48,throwSpeed:16,lift:24,impulse:26,sound:'impact105'}
};
export const explosionProfile=(weapon,radius)=>EXPLOSIONS[weapon==='howitzer'?'howitzer':radius>5?'heavy':'light'];
export const ENEMIES = {
  walker: {name:'Shambler', hp:28, speed:0.043, damage:5, points:100, size:1},
  runner: {name:'Runner', hp:23, speed:0.079, damage:5, points:140, size:0.85},
  brute: {name:'Bulwark', hp:150, speed:0.031, damage:14, points:350, size:1.7}
};
export const DIFFICULTIES = {
  cadet:{name:'Cadet', pressure:0.8, damage:0.65, points:0.8},
  night:{name:'Night watch', pressure:1, damage:1, points:1},
  blackout:{name:'Blackout', pressure:1.2, damage:1.2, points:1.3}
};
export const UPGRADES = [
  {id:'damage', icon:'✦', name:'Overpressure', description:'+25% weapon damage per rank.', max:8, kind:'FIREPOWER'},
  {id:'radius', icon:'◎', name:'Wide awake', description:'+16% impact radius per rank.', max:6, kind:'AREA CONTROL'},
  {id:'rate', icon:'»', name:'Fast hands', description:'Faster firing and reloads. +14% speed per rank.', max:6, kind:'HANDLING'},
  {id:'capacity', icon:'▤', name:'Deep pockets', description:'+25% ammunition capacity per rank.', max:6, kind:'SUPPLY'},
  {id:'cooling', icon:'❄', name:'Cold iron', description:'Slower heat buildup; shells fly 12% faster per rank.', max:5, kind:'SUSTAIN'},
  {id:'repair', icon:'+', name:'Hold the line', description:'Repair 25 outpost integrity now. Available every round.', max:Infinity, kind:'OUTPOST'}
];
export const stationForRound = round => STATIONS[(round-1)%STATIONS.length];

// Every sniper card has a mechanical benefit; blast/heat cards become penetration cards.
export function upgradeForStation(id,station){
  const base=UPGRADES.find(u=>u.id===id);
  if(station!=='sniper')return base;
  const changes={
    damage:{name:'Heavy punch',description:'+25% rifle damage per rank. Head hits deal 2.5× damage.'},
    radius:{name:'Through and through',description:'+1 target penetrated per shot, from 3 up to 9. Buildings always stop rounds.'},
    rate:{name:'Slick bolt',description:'+14% bolt cycling and reload speed per rank.'},
    cooling:{name:'Follow-through',description:'+5 percentage points of damage retained per penetration, from 70% up to 95%.'}
  };
  return {...base,...changes[id]};
}
