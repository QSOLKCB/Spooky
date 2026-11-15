// SPDX-License-Identifier: Apache-2.0
// Canvas presentation only; projected targets and inverse aiming share one model.
import {clamp,seededRandom} from '../vendor/vanillajs/modules/math/index.js';
import {ENEMIES,explosionProfile} from './content.js';
import {weaponStats} from './sim.js';
import {hitboxes,scopeZoom} from './sniper.js';
import {BUILDINGS,sectorForRound} from './world.js';
export const WIDTH=1152, HEIGHT=720;
export function project(station,x,z,height=0){
  if(station==='gunship')return {x:576+x*9,y:88+z*5.5-height*5,scale:1.65};
  const depth=(station==='infantry'||station==='sniper')?127-z:156-z;
  const factor=((station==='infantry'||station==='sniper')?720:700)/depth;
  return {x:576+x*factor,y:((station==='infantry'||station==='sniper')?130:105)+((station==='infantry'||station==='sniper')?15000:23000)/depth-height*factor,scale:factor*.46};
}
export function unproject(station,px,py){
  if(station==='gunship')return {x:clamp((px-576)/9,-52,52),z:clamp((py-88)/5.5,4,96)};
  const near=(station==='infantry'||station==='sniper'),depth=(near?15000:23000)/Math.max(1,py-(near?130:105));
  const z=clamp((near?127:156)-depth,4,96),f=(near?720:700)/((near?127:156)-z);
  return {x:clamp((px-576)/f,-52,52),z};
}
// Clip world-plane blast guides to the playable field before perspective projection.
// This keeps maximum-rank blasts finite near the camera and matches the damage circle.
export function blastOutline(station,x,z,radius){
  return Array.from({length:64},(_,i)=>{const angle=i*Math.PI/32;
    const p=project(station,clamp(x+Math.cos(angle)*radius,-52,52),clamp(z+Math.sin(angle)*radius,4,96));
    return [p.x,p.y];});
}
export function enemyBounds(station,e){
  const p=project(station,e.x,e.z),u=p.scale*ENEMIES[e.kind].size;
  return {left:p.x-6*u-2,right:p.x+6*u+2,top:p.y-18*u-2,bottom:p.y+2,centerX:p.x,centerY:p.y-10*u};
}
export function aimFromScreen(s,x,y){
  if(s.station==='sniper')return {...unproject(s.station,x,y),sightX:x,sightY:y};
  // Intersect the displayed upright body before the ground plane. In perspective
  // views a head/torso pixel is not the terrain coordinate behind that body.
  let target=null;
  for(const e of s.enemies){const b=enemyBounds(s.station,e);if(x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom&&(!target||e.z>target.z))target=e;}
  if(!target)return unproject(s.station,x,y);
  const p=project(s.station,target.x,target.z),u=p.scale*ENEMIES[target.kind].size;
  return {x:target.x,z:target.z,targetId:target.id,head:Math.abs(x-p.x)<=3.5*u&&y<p.y-13*u};
}
export function createRenderer(canvas){
  let ctx=canvas.getContext('2d',{alpha:false});canvas.width=WIDTH;canvas.height=HEIGHT;
  const rng=seededRandom(130);const trees=Array.from({length:95},()=>({x:(rng()>.5?1:-1)*(32+rng()*36),z:rng()*110,size:1+rng()*1.5}));
  const rubble=Array.from({length:130},()=>({x:(rng()-.5)*110,z:rng()*103,size:.3+rng()*.8}));
  const stars=Array.from({length:80},()=>[rng()*WIDTH,rng()*210,rng()]);
  let flash=0;
  const scene=canvas.ownerDocument.createElement('canvas');scene.width=WIDTH;scene.height=HEIGHT;
  const sceneContext=scene.getContext('2d',{alpha:false});let sceneKey='';
  const rect=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
  function poly(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
  function line(points,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
  function text(value,x,y,color='#becbb0',size=13,align='left'){ctx.fillStyle=color;ctx.font=`${size}px ui-monospace, monospace`;ctx.textAlign=align;ctx.fillText(value,x,y);}
  function cube(x,y,w,h,d,color,top,side){rect(x-w/2,y-h,w,h,color);poly([[x-w/2,y-h],[x-w/2+d,y-h-d*.55],[x+w/2+d,y-h-d*.55],[x+w/2,y-h]],top);poly([[x+w/2,y-h],[x+w/2+d,y-h-d*.55],[x+w/2+d,y-d*.55],[x+w/2,y]],side);}
  function ground(station,points,color){poly(points.map(([x,z])=>{const p=project(station,x,z);return [p.x,p.y];}),color);}
  function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);ctx.fill();}
  function terrain(s){
    const thermal=s.station==='gunship',sector=sectorForRound(s.round);
    const sky=ctx.createLinearGradient(0,0,0,HEIGHT);sky.addColorStop(0,thermal?'#142221':sector.sky);sky.addColorStop(.4,thermal?'#293c31':sector.horizon);sky.addColorStop(1,'#16231c');ctx.fillStyle=sky;ctx.fillRect(0,0,WIDTH,HEIGHT);
    if(!thermal){
      stars.forEach(([x,y,r])=>rect(x,y,1+r,1+r,'#a2b7b480'));
      const glow=ctx.createRadialGradient(900,92,8,900,92,180);glow.addColorStop(0,'#b3b48f30');glow.addColorStop(1,'#b3b48f00');ctx.fillStyle=glow;ctx.fillRect(700,0,400,260);
      ellipse(900,90,16,16,'#ced3b8');ellipse(907,85,15,15,sector.sky);
      poly([[0,186],[110,144],[160,171],[265,126],[370,166],[455,145],[570,185],[740,125],[810,156],[990,138],[1152,178],[1152,320],[0,320]],'#253438');
      poly([[0,214],[160,178],[280,218],[460,168],[610,215],[815,175],[1010,205],[1152,171],[1152,720],[0,720]],'#263831');
    }
    ground(s.station,[[-70,0],[70,0],[70,120],[-70,120]],thermal?'#344437':sector.ground);
    ground(s.station,[[-22,0],[-13,0],[3,55],[17,110],[7,110],[-5,56]],thermal?'#57614c':sector.road);
    ground(s.station,[[32,0],[39,0],[4,70],[-4,110],[-11,110],[-3,68]],thermal?'#4a5845':sector.road);
    ground(s.station,[[-52,74],[52,69],[52,78],[-52,82]],thermal?'#53604a':'#5e5a43');
    // Seeded ground detail is rendered once per station/sector, never per tick.
    const noise=seededRandom(237);
    for(let i=0;i<1200;i++){
      const x=(noise()-.5)*140,z=noise()*110,p=project(s.station,x,z),u=p.scale;
      rect(p.x,p.y,(.2+noise()*1.4)*u,.5*u,i%3?'#141e1824':'#d1c59818');
    }
    for(const r of rubble){const p=project(s.station,r.x,r.z);rect(p.x,p.y,r.size*p.scale*2,r.size*p.scale,thermal?'#283c2b':'#252c23');}
    for(let z=3;z<96;z+=6){
      const x=-17+z*.28,p=project(s.station,x,z),q=project(s.station,x+.5,z+3);
      line([[p.x,p.y],[q.x,q.y]],'#c4b88a24',2);
    }
    for(const tree of [...trees].sort((a,b)=>a.z-b.z)){
      const p=project(s.station,tree.x,tree.z),u=p.scale*tree.size;
      ellipse(p.x+6*u,p.y+u,8*u,2*u,'#0b16133a');rect(p.x-1.3*u,p.y-7*u,2.6*u,8*u,'#343c2b');
      for(let i=0;i<3;i++){
        const top=p.y-(28-i*7)*u,base=top+15*u,w=(5+i*2)*u;
        poly([[p.x,top],[p.x-w,base],[p.x+w,base]],thermal?'#1b3125':'#162c25');
        poly([[p.x,top],[p.x,base],[p.x+w,base]],thermal?'#273c2b':'#20392e');
      }
    }
    // Trenches, revetments and a layered perimeter establish the defended line.
    ground(s.station,[[-53,87],[53,87],[53,90],[-53,90]],'#1b241d');
    ground(s.station,[[-53,86],[53,86],[53,87],[-53,87]],'#79785b');
    for(let x=-48;x<=48;x+=8){
      const p=project(s.station,x,91),q=project(s.station,x+8,91),u=p.scale;
      line([[p.x,p.y],[p.x,p.y-7*u]],'#a4aa80',2);
      for(const y of [2,5])line([[p.x,p.y-y*u],[q.x,q.y-y*q.scale]],'#b7be8e80');
      line([[p.x,p.y-6*u],[q.x,q.y]],'#c1c49840');
    }
    for(const x of [-43,43]){const p=project(s.station,x,87),u=p.scale;
      rect(p.x-1.4*u,p.y-15*u,2.8*u,15*u,'#71785c');rect(p.x-4*u,p.y-17*u,8*u,3*u,'#fff1b8');
      const light=ctx.createRadialGradient(p.x,p.y-15*u,1,p.x,p.y-15*u,42*u);light.addColorStop(0,'#fff4b247');light.addColorStop(1,'#fff4b200');ctx.fillStyle=light;ctx.fillRect(p.x-42*u,p.y-57*u,84*u,84*u);
      poly([[p.x,p.y-15*u],[p.x-34*u,p.y-75*u],[p.x+18*u,p.y-75*u]],'#e4f0b10c');
    }
    if(thermal){for(let x=80;x<WIDTH;x+=96)line([[x,70],[x,650]],'#9caf7d0d');for(let y=100;y<650;y+=96)line([[60,y],[1092,y]],'#9caf7d0d');}
  }
  function building(s,b){
    const st=s.station,thermal=st==='gunship',corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
    const base=corners.map(([x,z])=>project(st,b.x+x*b.width/2,b.z+z*b.depth/2));
    const top=corners.map(([x,z])=>project(st,b.x+x*b.width/2,b.z+z*b.depth/2,b.height));
    const points=ps=>ps.map(p=>[p.x,p.y]);
    poly(points([base[1],base[2],top[2],top[1]]),'#343d32');poly(points([base[2],base[3],top[3],top[2]]),thermal?'#67705b':'#626756');
    poly(points(top),thermal?'#8a9071':'#7d806a');
    line(points([...top,top[0]]),'#b2b49455',1);
    for(let x=-1;x<=1;x++){const p=project(st,b.x+x*b.width*.28,b.z+b.depth/2,b.height*.62),u=p.scale;
      rect(p.x-u,p.y-1.5*u,2*u,2*u,'#18241d');rect(p.x-u,p.y+.5*u,2.2*u,.5*u,'#9ba07b');}
    const door=project(st,b.x,b.z+b.depth/2),u=door.scale;
    rect(door.x-1.4*u,door.y-4.5*u,2.8*u,4.5*u,'#29382c');
    if(b.roof==='gable'&&s.station!=='sniper'){
      const r1=project(st,b.x,b.z-b.depth/2,b.height+2),r2=project(st,b.x,b.z+b.depth/2,b.height+2);
      poly(points([top[0],r1,r2,top[3]]),'#939079');poly(points([r1,top[1],top[2],r2]),'#5c6552');
      line(points([r1,r2]),'#b2ac8c',2);
    }else if(s.station!=='sniper'){const vent=project(st,b.x+1,b.z,b.height);cube(vent.x,vent.y,4*vent.scale,2*vent.scale,2*vent.scale,'#4e5d4b','#969b78','#394b3c');}
    if(b.id==='relay'){
      const a=project(st,b.x,b.z,b.height),u=a.scale;line([[a.x-3*u,a.y],[a.x,a.y-23*u],[a.x+3*u,a.y]],'#adb79a',1.5);
      for(let i=1;i<5;i++)line([[a.x-2*u,a.y-i*4*u],[a.x+2*u,a.y-(i+1)*4*u]],'#9ead8c');rect(a.x-1,a.y-24*u,3,3,'#edb575');
    }
  }
  function fuel(s,b){
    const p=project(s.station,b.x,b.z),u=p.scale*1.3;
    ellipse(p.x+u,p.y,3*u,u,'#0005');
    if(b.hp<=0){rect(p.x-2*u,p.y-2*u,4*u,2*u,'#242b22');return;}
    cube(p.x,p.y,3.7*u,4.2*u,u,'#ad7949','#dcb273','#694e36');
    for(const y of [1,3])rect(p.x-1.9*u,p.y-y*u,4*u,.5*u,'#333f2e');
    rect(p.x-.5*u,p.y-2.6*u,u,u,'#ffdfa1');
  }
  function rifleEnemy(s,e){
    const shade=e.flash?'#fff9d5':e.kind==='brute'?'#8e8270':['#657861','#828064','#566f70','#6e675a'][e.variant||0];
    const p=project(s.station,e.x,e.z);ellipse(p.x,p.y,5*p.scale,1.6*p.scale,'#030b0855');
    for(const b of hitboxes(e).sort((a,b)=>a.max[2]-b.max[2])){
      const [x,y,z]=b.min,[X,Y,Z]=b.max;
      const face=points=>points.map(([a,b,c])=>{const q=project(s.station,a,c,b);return [q.x,q.y];});
      const head=b.part==='head',color=e.flash?'#fff9d5':head?'#bdc493':shade;
      poly(face([[x,y,Z],[X,y,Z],[X,Y,Z],[x,Y,Z]]),color);
      poly(face([[x,Y,z],[X,Y,z],[X,Y,Z],[x,Y,Z]]),head?'#e1d9aa':'#9ba384');
      const side=e.x<0?X:x;
      poly(face([[side,y,z],[side,y,Z],[side,Y,Z],[side,Y,z]]),head?'#7b876a':'#344638');
      if(head)for(const side of [-1,1]){const q=project(s.station,(x+X)/2+side*(X-x)*.2,Z,Y-(Y-y)*.35);rect(q.x-1,q.y,2.3*p.scale,1*p.scale,'#ffd18b');}
    }
    if(e.hp<e.maxHp){const q=project(s.station,e.x,e.z,10*ENEMIES[e.kind].size);rect(q.x-6*p.scale,q.y,12*p.scale,1.2*p.scale,'#111b15');rect(q.x-6*p.scale,q.y,12*p.scale*e.hp/e.maxHp,1.2*p.scale,'#e5b77d');}
  }
  function enemy(s,e){
    if(s.station==='sniper'){rifleEnemy(s,e);return;}
    const p=project(s.station,e.x,e.z),u=p.scale*ENEMIES[e.kind].size,thermal=s.station==='gunship',brute=e.kind==='brute',runner=e.kind==='runner';
    const walk=Math.sin(e.stride||e.phase||0)*2.4,lean=clamp((e.vx||0)*.18,-1.5,1.5),bob=Math.abs(walk)*.18;
    const clothes=['#657861','#828064','#566f70','#6e675a'][e.variant||0];
    const body=e.flash?'#fff9d5':thermal?(brute?'#c4cdb4':'#d9e3bf'):brute?'#888071':clothes;
    const dark=thermal?'#7e9275':'#354638',skin=e.flash?'#fffbe4':thermal?'#f4f7db':'#bdc493';
    ellipse(p.x,p.y+u,5*u,1.6*u,'#030b0855');
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(u,u);
    // Feet, knee joints and swinging arms share the body's actual travelled stride.
    for(const side of [-1,1]){
      const stride=walk*side;
      line([[side*2.2,-7],[side*2.3+stride*.4,-3],[side*2+stride*.7,0]],dark,2.6);
      rect(side*2+stride*.7-1.5,-1,3.8,1.5,thermal?'#afbd9b':'#222f29');
      line([[side*4+lean,-12-bob],[side*5.3+lean,-9+stride*.7],[side*5+lean+stride*.4,-7+stride]],body,2.2);
      rect(side*5+lean+stride*.4-1,-7+stride,2,1.7,skin);
    }
    poly([[-3.7+lean,-13-bob],[3.7+lean,-13-bob],[3,-5],[-3,-5]],body);
    rect(-3,-6,6,1,thermal?'#8a9b79':'#293b32');
    if(brute){cube(lean,-7,7,5,1.3,thermal?'#a5b699':'#58645b',thermal?'#e1e7c9':'#a0a58c','#303d35');rect(-5+lean,-14,3,2,body);rect(2+lean,-14,3,2,body);}
    else{rect(-1+lean,-12-bob,1,5,thermal?'#b0bea0':'#88947b');if(runner)rect(-3+lean,-10-bob,6,1.5,thermal?'#edf2d5':'#c29860');}
    cube(lean,-13-bob,5.6,4.6,1,skin,thermal?'#ffffff':'#d6d1a5',thermal?'#b6c7a2':'#778671');
    if(brute)rect(-3.2+lean,-18-bob,6.4,2,thermal?'#aebca3':'#68796b');
    rect(-1.8+lean,-16-bob,1.1,.8,thermal?'#37472f':'#ffc37b');rect(.8+lean,-16-bob,1.1,.8,thermal?'#37472f':'#ffc37b');
    rect(-1+lean,-14.2-bob,2,.6,'#3c4937');ctx.restore();
    if(e.hp<e.maxHp){rect(p.x-6*u,p.y-23*u,12*u,1.2*u,'#111b15');rect(p.x-6*u,p.y-23*u,12*u*Math.max(0,e.hp/e.maxHp),1.2*u,'#e5b77d');}
    if(brute){text('◆',p.x,p.y-26*u,'#e8b77e',9,'center');}
  }
  function groundEffects(s){
    for(const c of s.craters){const p=project(s.station,c.x,c.z),r=c.radius*p.scale;
      ellipse(p.x,p.y,r*1.8,r*.65,'#171b1590');ellipse(p.x,p.y-1,r*1.2,r*.45,'#11191288');
      const rand=seededRandom(c.seed);for(let i=0;i<8;i++){const a=rand()*6.28;rect(p.x+Math.cos(a)*r*1.4,p.y+Math.sin(a)*r*.5,2+p.scale,1+p.scale,'#8c816033');}
    }
    for(const r of s.remains){const p=project(s.station,r.x,r.z),u=p.scale;ctx.globalAlpha=Math.min(1,(600-r.age)/120);
      ellipse(p.x,p.y,7*u,2.6*u,'#151f1b88');rect(p.x-4*u,p.y-2*u,7*u,2*u,s.station==='gunship'?'#849477':'#465441');rect(p.x+4*u,p.y-u,2*u,2*u,'#8c9974');ctx.globalAlpha=1;}
  }
  function blastRing(s,x,z,radius,color,width=1){
    const points=blastOutline(s.station,x,z,radius);line([...points,points[0]],color,width);
  }
  function effects(s,reducedMotion=false){
    for(const shot of s.shells){
      ctx.setLineDash([4,5]);blastRing(s,shot.x,shot.z,shot.radius,'#ebcd8b90');ctx.setLineDash([]);
      if(shot.position){const v=shot.position,p=project(s.station,v.x,v.z,v.y),q=project(s.station,v.x-shot.velocity.x/100,v.z-shot.velocity.z/100,v.y-shot.velocity.y/100);
        line([[q.x,q.y],[p.x,p.y]],'#edcf8aa0',4);line([[q.x,q.y],[p.x,p.y]],'#fff6cc',1.6);ellipse(p.x,p.y,2.5,2.5,'#fffbd9');}
    }
    for(const e of s.effects){
      const p=project(s.station,e.x,e.z),t=e.age/e.life;
      if(e.type==='blast'){
        const heavy=e.radius>5,profile=explosionProfile(e.weapon,e.radius),u=p.scale,r=Math.max(4,e.radius*u)*profile.visualScale,early=Math.max(0,1-e.age/12);
        if(early&&!reducedMotion){const light=ctx.createRadialGradient(p.x,p.y,1,p.x,p.y,r*5);light.addColorStop(0,`rgba(255,222,143,${early*.65})`);light.addColorStop(1,'#ffd89800');ctx.fillStyle=light;ctx.fillRect(p.x-r*5,p.y-r*5,r*10,r*10);}
        const ring=Math.min(1,e.age/profile.ringTicks),spread=1-(1-ring)**3;
        blastRing(s,e.x,e.z,e.radius*spread,`rgba(236,224,177,${(1-ring)*.75})`,e.weapon==='howitzer'?3:2);
        const rand=seededRandom(e.seed||1);
        for(let j=0;j<profile.puffs;j++){
          const a=rand()*6.28,size=(.35+rand()*.55)*r,spread=rand(),cx=p.x+Math.cos(a)*r*spread*(.3+t*2),cy=p.y+Math.sin(a)*r*.3-e.age*u*(.3+spread*.3)*profile.plume;
          const flame=Math.max(0,1-e.age/profile.flameTicks);
          ellipse(cx,cy,size*(.4+t),size*(.35+t),`rgba(37,43,35,${(1-t)*.34})`);
          if(flame){ellipse(cx,cy,size*flame,size*flame,`rgba(255,${Math.round(130+flame*90)},75,${flame*.8})`);ellipse(cx,cy,size*flame*.55,size*flame*.55,`rgba(255,246,195,${flame})`);}
        }
        if(heavy&&e.age<profile.ringTicks*2){const dust=e.age/(profile.ringTicks*2),points=blastOutline(s.station,e.x,e.z,e.radius*(.4+.6*dust));poly(points,`rgba(173,150,97,${(1-dust)*.14})`);}
      }else if(e.type==='rifle-trace'){const q=project(s.station,e.x,e.z,e.height);line([[576,640],[q.x,q.y]],`rgba(255,235,178,${(1-t)*.7})`,2);ellipse(q.x,q.y,4,4,'#ffeabf');}
      else if(e.type==='kill'&&s.station!=='sniper')text(e.critical?'CRITICAL +'+e.points:'+'+e.points,p.x,p.y-25-t*30,`rgba(238,219,166,${1-t})`,e.critical?13:11,'center');
      else if(e.type==='tracer'&&(e.key==='m2'||e.key==='gatling'))line([e.key==='m2'?[576,503]:[-40,105],[p.x,p.y-(e.targetKind?p.scale*ENEMIES[e.targetKind].size*(e.head?16:10):0)]],`rgba(255,238,175,${(1-t)*.8})`,1.8);
    }
    for(const p of s.particles){
      const q=project(s.station,p.x,p.z,p.y),u=Math.max(.6,p.size*q.scale);ctx.globalAlpha=Math.min(1,(p.life-p.age)/20);
      if(p.kind==='ember'){ellipse(q.x,q.y,u*2,u*2,'#efbd6d44');rect(q.x,q.y,u,u,'#ffe6a0');}
      else{ctx.save();ctx.translate(q.x,q.y);ctx.rotate(p.age*.15);rect(-u/2,-u/2,p.kind==='case'?u*2:u,u,p.kind==='case'?'#d2b572':p.kind==='fragment'?'#8a9575':'#9d9270');ctx.restore();}ctx.globalAlpha=1;
    }
  }
  function emplacement(s,time,reducedMotion=false){
    if(s.station==='gunship')return;
    if(s.station==='sniper'){rifleEmplacement(s,reducedMotion);return;}
    const p=project(s.station,s.aim.x,s.aim.z),angle=clamp((p.x-576)/1000,-.35,.35);
    // Sandbags and foreground bring the gun down to eye level.
    for(let row=0;row<2;row++)for(let i=0;i<12;i++)cube(i*105+(row%2)*50,HEIGHT-row*24,98,28,10,'#4c503b','#62654a','#303c2d');
    ctx.save();ctx.translate(576,720+(reducedMotion?0:(s.weapons[s.weapon].recoil||0)*14));ctx.rotate(angle);
    if(s.station==='infantry'){
      poly([[-48,0],[-38,-110],[-18,-135],[18,-135],[38,-110],[48,0]],'#181f1b');
      rect(-14,-205,28,135,'#3d4840');rect(-9,-232,18,37,'#252d28');rect(-8,-202,4,130,'#7a8067');
      for(let i=0;i<7;i++)rect(-13,-188+i*10,26,3,'#171f1b');
      cube(0,-44,84,85,13,'#3c473a','#707760','#1b271e');rect(-66,-80,33,47,'#737452');
      for(let i=0;i<7;i++)rect(-67-i*9,-73+i*2,7,23,'#c2a36c');
      line([[-24,-155],[-24,-177],[24,-177],[24,-155]],'#bcc4a0',3);
      if(flash>0){poly([[-5,-227],[-25,-260],[-9,-256],[0,-304],[10,-262],[27,-278],[12,-230]],'#ffe3a3');}
    }else{
      ctx.fillStyle='#101c17';ctx.beginPath();ctx.arc(-95,-38,48,0,Math.PI*2);ctx.arc(95,-38,48,0,Math.PI*2);ctx.fill();
      cube(0,-20,150,75,30,'#414b39','#6d7653','#283523');
      poly([[-32,-71],[-18,-223],[18,-223],[32,-71]],'#647253');rect(-17,-248,34,35,'#87916a');rect(-15,-244,30,5,'#243224');
      if(flash>0){poly([[-15,-245],[-60,-285],[-19,-278],[0,-345],[22,-281],[57,-300],[16,-244]],'#ffe7ac');}
    }
    ctx.restore();
  }
  function rifleEmplacement(s,reducedMotion){
    const w=s.weapons.rifle,stats=weaponStats(s),ads=s.sniper.ads;
    ctx.save();ctx.globalAlpha=1-ads*.95;
    const bolt=w.cooldown?Math.sin((1-w.cooldown/stats.interval)*Math.PI):0;
    const reload=w.reload?Math.sin(w.reload/stats.reload*Math.PI):0;
    ctx.translate(720,HEIGHT+reload*110+(reducedMotion?0:w.recoil*24));ctx.rotate(-.14);
    // Fixed bipod, long barrel, muzzle brake, receiver and telescopic sight.
    line([[-58,-22],[-140,0]],'#819071',10);line([[20,-22],[130,0]],'#819071',10);
    poly([[-35,0],[-48,-85],[-18,-112],[30,-98],[70,0]],'#343e31');
    cube(-8,-55,75,105,16,'#515b44','#879376','#28382d');
    rect(-15,-320,18,165,'#3b483d');rect(-12,-320,4,165,'#9aa188');
    cube(-6,-320,32,30,6,'#353f37','#9eab8d','#18271f');
    for(let i=0;i<3;i++)rect(-20,-345+i*9,28,4,'#111b15');
    cube(-7,-148,36,93,11,'#1c2a24','#6d7f66','#111c17');
    ellipse(-2,-156,23,27,'#77866c');ellipse(-2,-157,17,21,'#172c2a');ellipse(0,-160,10,12,'#5f968444');
    line([[30,-113],[69+bolt*30,-104+bolt*39],[78+bolt*30,-96+bolt*39]],'#a3ad89',6);
    ellipse(79+bolt*30,-95+bolt*39,9,9,'#303d32');
    if(flash&&!reducedMotion)poly([[-5,-350],[-25,-393],[0,-378],[4,-420],[18,-369],[39,-390],[15,-350]],'#ffe8ae');
    ctx.restore();
  }
  function scopeReticle(s,p){
    const ads=s.sniper.ads,w=s.weapons.rifle;
    if(ads>0){
      ctx.save();ctx.globalAlpha=ads;ctx.fillStyle='#050b09';ctx.beginPath();ctx.rect(0,0,WIDTH,HEIGHT);ctx.arc(p.x,p.y,277,0,Math.PI*2,true);ctx.fill('evenodd');
      ctx.strokeStyle='#6b795c';ctx.lineWidth=12;ctx.beginPath();ctx.arc(p.x,p.y,280,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle='#121e17';ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,271,0,Math.PI*2);ctx.stroke();
      line([[p.x-266,p.y],[p.x-10,p.y]],'#19261bcc',1.2);line([[p.x+10,p.y],[p.x+266,p.y]],'#19261bcc',1.2);
      line([[p.x,p.y-266],[p.x,p.y-10]],'#19261bcc',1.2);line([[p.x,p.y+10],[p.x,p.y+266]],'#19261bcc',1.2);
      for(let i=-4;i<=4;i++)if(i){line([[p.x+i*32,p.y-4],[p.x+i*32,p.y+4]],'#d1ddb2',1);line([[p.x-4,p.y+i*32],[p.x+4,p.y+i*32]],'#d1ddb2',1);}
      text('LONG WATCH / 20 MM',p.x,p.y-225,'#c6d5ad',12,'center');text('3.2×  /  FIXED OVERWATCH',p.x,p.y+229,'#c6d5ad',11,'center');ctx.restore();
    }
    if(!ads){line([[p.x-12,p.y],[p.x-5,p.y]],'#d9e6b3',1);line([[p.x+5,p.y],[p.x+12,p.y]],'#d9e6b3',1);line([[p.x,p.y-12],[p.x,p.y-5]],'#d9e6b3',1);}
    rect(p.x-1.5,p.y-1.5,3,3,'#ffd18b');
    text(w.reload?'RELOADING':w.cooldown?'CYCLING BOLT':ads<1?'HOLD SCOPE / CLICK TO FIRE':'READY / ONE CLICK, ONE ROUND',p.x,p.y+55,'#d5dfbc',10,'center');
    const c=s.rifleConfirm;
    if(c&&s.tick-c.tick<85){const label=c.killed>=2?'COLLATERAL ×'+c.killed:c.heads?'HEADSHOT':c.hits?'HIT':'MISS';
      text((c.quick?'QUICKSCOPE / ':'')+label,576,80,c.hits?'#ffce8f':'#abb696',18,'center');}
  }
  function reticle(s,cursor){
    const ground=project(s.station,s.aim.x,s.aim.z),p=cursor||ground,w=s.weapons[s.weapon],stats=weaponStats(s),r=16;
    if(s.station==='sniper'){scopeReticle(s,p);return;}
    if(stats.radius>5){ctx.setLineDash([6,7]);blastRing(s,s.aim.x,s.aim.z,stats.radius,'#e3f3b852');ctx.setLineDash([]);}
    const c=w.overheated?'#ee9165':w.reload?'#c5b67e':'#e3f3b8';
    ctx.strokeStyle=c;ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.stroke();
    for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]])line([[p.x+dx*(r+5),p.y+dy*(r+5)],[p.x+dx*(r+17),p.y+dy*(r+17)]],c,2);
    rect(p.x-1,p.y-1,2,2,c);
    if(w.reload)text('RELOADING',p.x,p.y+r+34,c,11,'center');else if(w.overheated)text('COOLING BARREL',p.x,p.y+r+34,c,11,'center');
  }
  function draw(s,{time=s.tick/60,muted=false,reducedMotion=false,cursor=null}={}){
    const key=s.station+':'+sectorForRound(s.round).name;
    if(key!==sceneKey){const live=ctx;ctx=sceneContext;terrain(s);ctx=live;sceneKey=key;}
    const sniper=s.station==='sniper',zoom=sniper?scopeZoom(s):1;
    const reticlePoint=cursor||(sniper?{x:s.sniper.x,y:s.sniper.y}:project(s.station,s.aim.x,s.aim.z));
    rect(0,0,WIDTH,HEIGHT,'#101c19');ctx.save();
    if(sniper){ctx.translate(reticlePoint.x*(1-zoom),reticlePoint.y*(1-zoom));ctx.scale(zoom,zoom);}
    ctx.drawImage(scene,0,0);groundEffects(s);
    const actors=[...BUILDINGS.map(b=>({z:b.z+b.depth/2,draw:()=>building(s,b)})),...s.fuel.map(b=>({z:b.z,draw:()=>fuel(s,b)})),...s.enemies.map(e=>({z:e.z,draw:()=>enemy(s,e)}))];
    actors.sort((a,b)=>a.z-b.z).forEach(a=>a.draw());effects(s,reducedMotion);
    ctx.restore();
    flash=reducedMotion?0:s.effects.some(e=>e.type==='tracer'&&e.key===s.weapon&&e.age<4)?1:0;
    emplacement(s,time,reducedMotion);reticle(s,reticlePoint);
    if(s.hitConfirm&&s.tick-s.hitConfirm.tick<9){const p=reticlePoint||project(s.station,s.aim.x,s.aim.z),c=s.hitConfirm.critical?'#ffbe7e':'#eff6cd';
      for(const [x,y] of [[-1,-1],[1,-1],[-1,1],[1,1]])line([[p.x+x*5,p.y+y*5],[p.x+x*11,p.y+y*11]],c,2);}
    const vignette=ctx.createRadialGradient(576,330,200,576,350,700);vignette.addColorStop(0,'#0000');vignette.addColorStop(1,'#0008');ctx.fillStyle=vignette;ctx.fillRect(0,0,WIDTH,HEIGHT);
    for(let y=0;y<HEIGHT;y+=4)rect(0,y,WIDTH,1,'#0000000b');
    const corners=[[24,24,1,1],[1128,24,-1,1],[24,696,1,-1],[1128,696,-1,-1]];
    corners.forEach(([x,y,dx,dy])=>line([[x+dx*30,y],[x,y],[x,y+dy*30]],'#a7b78e80'));
    text(s.station==='gunship'?'EO / IR  ·  WHITE HOT':'OPTICAL  ·  LOW LIGHT',44,47,'#d1dcbc',12);
    text('LIVE',1106,47,'#dbe9a1',12,'right');rect(1049,38,5,5,'#dbe9a1');
    text(sectorForRound(s.round).name,44,675,'#b6c596',12);text('AZ '+String(Math.round(s.aim.x+180)).padStart(3,'0')+'°',1107,675,'#b6c596',12,'right');
    if(s.roundTick<160&&s.status==='playing'){
      ctx.globalAlpha=Math.min(1,(160-s.roundTick)/40);rect(399,84,354,58,'#111b18dc');text('ROUND '+String(s.round).padStart(2,'0')+'  /  '+s.total+' CONTACTS',576,119,'#e4edce',18,'center');ctx.globalAlpha=1;
    }
    if(muted)rect(0,0,WIDTH,HEIGHT,'#07100b55');
  }
  return {draw,event(){}};
}
