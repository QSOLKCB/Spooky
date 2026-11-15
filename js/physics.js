// SPDX-License-Identifier: Apache-2.0
import {ballisticStep} from '../vendor/vanillajs/modules/ballistics/index.js';
import {moveAndSlideAABB} from '../vendor/vanillajs/modules/collision/index.js';
import {clamp,seededRandom} from '../vendor/vanillajs/modules/math/index.js';
import {SOLIDS} from './world.js';
import {ENEMIES,explosionProfile} from './content.js';
const DT=1/60;
export const FX_LIMITS=Object.freeze({particles:260,craters:40,remains:24});
export function launchShell(shot,station){
  const duration=shot.flight*DT,origin=station==='gunship'?{x:-68,z:25,y:38}:{x:0,z:101,y:3};
  const gravity=station==='gunship'?45:145;
  return {...shot,position:{...origin},origin,gravity,
    velocity:{x:(shot.x-origin.x)/duration,z:(shot.z-origin.z)/duration,y:(gravity*duration*duration*.5-origin.y)/duration}};
}
export function advanceShell(shot){
  if(shot.position){
    const vertical=ballisticStep({height:shot.position.y,velocity:shot.velocity.y,dt:DT,gravity:shot.gravity});
    shot.position.x+=shot.velocity.x*DT;shot.position.z+=shot.velocity.z*DT;
    shot.position.y=vertical.height;shot.velocity.y=vertical.velocity;
  }
  shot.remaining--;
  if(shot.remaining<=0&&shot.position)shot.position={x:shot.x,y:0,z:shot.z};
  return shot.remaining<=0;
}
export function burst(s,{x,z,radius,seed,body=null,key=null}){
  const random=seededRandom(seed>>>0),heavy=radius>5,profile=explosionProfile(key,radius),count=body?6:profile.particles;
  for(let i=0;i<count;i++){
    const angle=random()*Math.PI*2,speed=(body?4:profile.throwSpeed)*(0.5+random());
    s.particles.push({x,z,y:body?2+random()*4:.3,vx:Math.cos(angle)*speed,vz:Math.sin(angle)*speed,
      vy:(body?5:profile.lift)+random()*(heavy?17:8),size:body ? .7+random()*.6 : .15+random()*(heavy ? .8 : .25),
      age:0,life:body?150:Math.max(32,profile.life+5),kind:body?'fragment':i%3===0?'ember':'debris',tone:body||'soil',bounce:0});
  }
  s.particles=s.particles.slice(-FX_LIMITS.particles);
  if(heavy&&!body){s.craters.push({x,z,radius:radius*.6,seed,age:0});s.craters=s.craters.slice(-FX_LIMITS.craters);}
}
export function shellCase(s){
  const random=seededRandom((s.seed^Math.imul(s.shots,2654435761))>>>0);
  s.particles.push({x:1,z:99,y:3,vx:7+random()*3,vz:-2-random()*3,vy:7+random()*4,size:.3,age:0,life:90,kind:'case',tone:'brass',bounce:0});
  s.particles=s.particles.slice(-FX_LIMITS.particles);
}
export function advanceParticles(s){
  for(const p of s.particles){
    const previousVelocity=p.vy,vertical=ballisticStep({height:p.y,velocity:p.vy,dt:DT,gravity:35});
    p.x+=p.vx*DT;p.z+=p.vz*DT;p.y=vertical.height;p.vy=vertical.velocity;p.age++;
    if(p.y===0){
      if(previousVelocity<-.8&&p.bounce<2){p.vy=-previousVelocity*.28;p.bounce++;}
      p.vx*=.8;p.vz*=.8;
    }
  }
  s.particles=s.particles.filter(p=>p.age<p.life);
  for(const c of s.craters)c.age++;
  for(const r of s.remains)r.age++;
  s.remains=s.remains.filter(r=>r.age<600).slice(-FX_LIMITS.remains);
}
export function pushEnemy(e,x,z,power){
  let dx=e.x-x,dz=e.z-z,distance=Math.hypot(dx,dz);
  if(distance<.001){dx=0;dz=-1;distance=1;}
  const mass=e.kind==='brute'?3.5:e.kind==='runner'?.8:1;
  e.kx=clamp((e.kx||0)+dx/distance*power/mass,-22,22);
  e.kz=clamp((e.kz||0)+dz/distance*power/mass,-22,22);
  e.stagger=Math.max(e.stagger||0,Math.round(power/mass));
}
export function moveHorde(enemies){
  // Snapshot bins keep crowd steering independent of mutation order in this tick.
  const bins=new Map(),cell=(x,z)=>`${Math.floor(x/5)},${Math.floor(z/5)}`;
  for(const e of enemies)if(e.hp>0){const key=cell(e.x,e.z);if(!bins.has(key))bins.set(key,[]);bins.get(key).push({id:e.id,x:e.x,z:e.z,size:ENEMIES[e.kind].size});}
  for(const e of enemies){
    if(e.hp<=0)continue;
    let vx=0,vz=e.speed*60*(e.stagger>0?.4:1);
    const size=ENEMIES[e.kind].size,cx=Math.floor(e.x/5),cz=Math.floor(e.z/5);
    if(e.speed>0){
      for(let ix=-1;ix<=1;ix++)for(let iz=-1;iz<=1;iz++)for(const other of bins.get(`${cx+ix},${cz+iz}`)||[]){
        if(other.id===e.id)continue;
        const dx=e.x-other.x,dz=e.z-other.z,d=Math.hypot(dx,dz),reach=(size+other.size)*1.2;
        if(d<reach){const strength=(1-d/reach)*1.8;vx+=(d>.01?dx/d:e.id<other.id?-1:1)*strength;}
      }
      for(const box of SOLIDS){
        if(e.z>box.min[2]-11&&e.z<box.max[2]+1&&e.x>box.min[0]-size-1&&e.x<box.max[0]+size+1){
          const mid=(box.min[0]+box.max[0])/2,side=e.x<mid?-1:1;
          vx+=side*Math.max(2.5,e.speed*75);if(e.z<box.min[2])vz*=.75;
        }
      }
    }
    const velocity=[clamp(vx,-6,6)+(e.kx||0),0,vz+(e.kz||0)],oldX=e.x,oldZ=e.z;
    const endX=e.x+velocity[0]*DT,endZ=e.z+velocity[2]*DT,half=size*.6;
    const nearby=SOLIDS.filter(b=>Math.max(e.x,endX)+half>=b.min[0]&&Math.min(e.x,endX)-half<=b.max[0]&&Math.max(e.z,endZ)+half>=b.min[2]&&Math.min(e.z,endZ)-half<=b.max[2]);
    const position=nearby.length?moveAndSlideAABB([e.x,1,e.z],velocity,DT,[half,1,half],nearby).position:[endX,1,endZ];
    e.x=clamp(position[0],-50,50);e.z=clamp(position[2],4,96);
    e.vx=(e.x-oldX)*60;e.vz=(e.z-oldZ)*60;e.stride=(e.stride||e.phase||0)+Math.hypot(e.x-oldX,e.z-oldZ)*1.3;
    e.kx=(e.kx||0)*.9;e.kz=(e.kz||0)*.9;e.stagger=Math.max(0,(e.stagger||0)-1);
  }
}
