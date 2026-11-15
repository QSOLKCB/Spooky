// SPDX-License-Identifier: Apache-2.0
// Shared authored scenery and collision footprints in fictional game units.
export const BUILDINGS = Object.freeze([
  {id:'west-depot',x:-26,z:28,width:9,depth:8,height:6,roof:'flat'},
  {id:'east-barracks',x:28,z:43,width:8,depth:9,height:7,roof:'gable'},
  {id:'relay',x:-29,z:65,width:7,depth:6,height:4,roof:'flat'},
  {id:'pump-house',x:38,z:18,width:8,depth:7,height:5,roof:'gable'},
  {id:'ruin',x:-12,z:10,width:8,depth:5,height:3,roof:'broken'}
]);
export const SOLIDS = BUILDINGS.map(b=>({min:[b.x-b.width/2,0,b.z-b.depth/2],max:[b.x+b.width/2,b.height,b.z+b.depth/2]}));
export const FUEL_DRUMS = Object.freeze([
  {x:-12,z:43},{x:-5,z:45},{x:3,z:48},{x:20,z:62},{x:24,z:68},{x:-20,z:77}
]);
export const freshFuel=()=>FUEL_DRUMS.map((b,i)=>({...b,id:i,hp:26}));
export const SECTORS=[
  {name:'ECHO / PINE RIDGE',sky:'#101c2a',horizon:'#34464a',ground:'#3b4531',road:'#585644',accent:'#e9b76f'},
  {name:'ECHO / ASH VALLEY',sky:'#211a29',horizon:'#554850',ground:'#454138',road:'#65584a',accent:'#f3ad79'},
  {name:'ECHO / BLUE HOUR',sky:'#142132',horizon:'#3f5961',ground:'#364641',road:'#52635b',accent:'#a4d7ce'}
];
export const sectorForRound=round=>SECTORS[Math.floor((round-1)/3)%SECTORS.length];
