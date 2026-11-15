// SPDX-License-Identifier: Apache-2.0
// All weapons and enemies are fictional arcade abstractions, not firing tables.
export const VERSION = '0.1.0';
export const STATIONS = [
  {id:'gunship', short:'AC-130', name:'Spectre orbit', role:'AIR SUPPORT', tag:'01',
    description:'Watch the perimeter from above. Switch between rapid fire and heavy splash damage.',
    tip:'Use 25 mm on stragglers. Switch to 105 mm when the horde bunches up.', weapons:['gatling','bofors','howitzer']},
  {id:'artillery', short:'ARTILLERY', name:'Thunder battery', role:'INDIRECT FIRE', tag:'02',
    description:'Lob high-explosive shells across the valley. Lead moving groups and make every impact count.',
    tip:'Shells take a moment to land. Aim ahead of the horde, towards the outpost.', weapons:['battery']},
  {id:'infantry', short:'M2 .50 CAL', name:'Last line', role:'GROUND DEFENCE', tag:'03',
    description:'Take the gun at the wire. Hold the line, change belts and keep the barrel cool.',
    tip:'Fire in bursts to manage heat. Reload between groups before the belt runs dry.', weapons:['m2']}
];
export const WEAPONS = {
  gatling: {name:'25 mm Gatling', label:'25 MM', damage:30, radius:2.6, interval:7, flight:7, magazine:90, reload:95, heat:1.5},
  bofors: {name:'40 mm cannon', label:'40 MM', damage:68, radius:5.8, interval:26, flight:22, magazine:16, reload:125, heat:0},
  howitzer: {name:'105 mm howitzer', label:'105 MM', damage:135, radius:11, interval:100, flight:40, magazine:5, reload:155, heat:0},
  battery: {name:'155 mm field gun', label:'155 MM HE', damage:170, radius:12, interval:66, flight:55, magazine:5, reload:130, heat:0},
  m2: {name:'M2 Browning', label:'.50 BMG', damage:38, radius:3.1, interval:6, flight:0, magazine:80, reload:150, heat:3.9}
};
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
export const stationForRound = round => STATIONS[(round-1)%3];
