// SPDX-License-Identifier: Apache-2.0
// Adapted from QSOLKCB/QUICKSCOPER src/math.js and src/game.js at
// 8da5569b1ee7565d9ae5fb0588847d262c896648. Modified for Spooky's fixed camera,
// articulated voxel horde, 60 Hz scope/trigger timing and bounded penetration.
import {ENEMIES} from './content.js';
import {SOLIDS} from './world.js';
export const RIFLE = Object.freeze({adsIn:9,adsOut:7,quickEnd:33,fireBuffer:11,zoom:3.2,range:240});
export const freshSight=()=>({ads:0,adsTicks:0,trigger:false,queued:0,queueScope:false,x:576,y:360});
export const scopeZoom=s=>1+(RIFLE.zoom-1)*s.sniper.ads**2*(3-2*s.sniper.ads);
export function sightRay(x,y){
  const d=[(x-576)/720,(130-y)/720,-1],length=Math.hypot(...d);
  return {origin:[0,15000/720,127],direction:d.map(v=>v/length)};
}
// Quickscoper's slab ray/box intersection, including parallel axes/inside origins.
export function rayBox(origin,direction,box,max=Infinity){
  let near=0,far=max;
  for(let axis=0;axis<3;axis++){
    const min=box.min[axis],hi=box.max[axis],d=direction[axis];
    if(Math.abs(d)<1e-9){if(origin[axis]<min||origin[axis]>hi)return null;}
    else{
      let a=(min-origin[axis])/d,b=(hi-origin[axis])/d;
      if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);
      if(near>far)return null;
    }
  }
  return near;
}
// These exact boxes are also rendered. No invisible enlarged head or ground splash.
export function hitboxes(e){
  const size=ENEMIES[e.kind].size*.46,walk=Math.sin(e.stride||e.phase||0)*2.4;
  const lean=Math.max(-1.5,Math.min(1.5,(e.vx||0)*.18)),bob=Math.abs(walk)*.18;
  const box=(part,x,y,z,w,h,d)=>({part,min:[e.x+(x-w/2)*size,(y-h/2)*size,e.z+(z-d/2)*size],max:[e.x+(x+w/2)*size,(y+h/2)*size,e.z+(z+d/2)*size]});
  return [box('head',lean,15.3+bob,0,5.6,4.6,3),box('body',lean,9,0,7.4,8,3.5),
    ...[-1,1].flatMap(side=>[box('legs',side*2.2,2.5,walk*side*.35,2.6,5,2.4),box('limb',side*5+lean,9-walk*side*.4,0,2.2,5,2.4)])];
}
// Adapted Quickscoper trace: one nearest region per target, stable front-to-back
// ordering, hard cover wins ties and terminates all later collateral hits.
export function traceShot(origin,direction,enemies,solids=SOLIDS,max=RIFLE.range){
  let end={distance:max,kind:'miss'};
  for(const box of solids){const distance=rayBox(origin,direction,box,max);if(distance!==null&&distance<=end.distance)end={distance,kind:'wall'};}
  const hits=[];
  for(const enemy of enemies)if(enemy.hp>0){
    let nearest=null;
    for(const box of hitboxes(enemy)){
      const distance=rayBox(origin,direction,box,end.distance);
      if(distance!==null&&distance<end.distance&&(!nearest||distance<nearest.distance))nearest={distance,enemy,part:box.part};
    }
    if(nearest)hits.push({...nearest,point:origin.map((v,i)=>v+direction[i]*nearest.distance)});
  }
  hits.sort((a,b)=>a.distance-b.distance||a.enemy.id-b.enemy.id);
  end={...end,point:origin.map((v,i)=>v+direction[i]*end.distance)};
  return {hits,end};
}
