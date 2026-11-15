// SPDX-License-Identifier: Apache-2.0
// Canvas presentation only; projected targets and inverse aiming share one model.
import {clamp,seededRandom} from '../vendor/vanillajs/modules/math/index.js';
import {ENEMIES} from './content.js';
import {weaponStats} from './sim.js';
export const WIDTH=1152, HEIGHT=720;
export function project(station,x,z,height=0){
  if(station==='gunship')return {x:576+x*9,y:88+z*5.5-height*5,scale:1.65};
  const depth=station==='infantry'?127-z:156-z;
  const factor=(station==='infantry'?720:700)/depth;
  return {x:576+x*factor,y:(station==='infantry'?130:105)+(station==='infantry'?15000:23000)/depth-height*factor,scale:factor*.46};
}
export function unproject(station,px,py){
  if(station==='gunship')return {x:clamp((px-576)/9,-52,52),z:clamp((py-88)/5.5,4,96)};
  const near=station==='infantry',depth=(near?15000:23000)/Math.max(1,py-(near?130:105));
  const z=clamp((near?127:156)-depth,4,96),f=(near?720:700)/((near?127:156)-z);
  return {x:clamp((px-576)/f,-52,52),z};
}
export function enemyBounds(station,e){
  const p=project(station,e.x,e.z),u=p.scale*ENEMIES[e.kind].size;
  return {left:p.x-6*u-2,right:p.x+6*u+2,top:p.y-18*u-2,bottom:p.y+2,centerX:p.x,centerY:p.y-10*u};
}
export function aimFromScreen(s,x,y){
  // Intersect the displayed upright body before the ground plane. In perspective
  // views a head/torso pixel is not the terrain coordinate behind that body.
  let target=null;
  for(const e of s.enemies){const b=enemyBounds(s.station,e);if(x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom&&(!target||e.z>target.z))target=e;}
  return target?{x:target.x,z:target.z}:unproject(s.station,x,y);
}
export function createRenderer(canvas){
  const ctx=canvas.getContext('2d',{alpha:false});canvas.width=WIDTH;canvas.height=HEIGHT;
  const rng=seededRandom(130);const trees=Array.from({length:95},()=>({x:(rng()>.5?1:-1)*(32+rng()*36),z:rng()*110,size:1+rng()*1.5}));
  const rubble=Array.from({length:130},()=>({x:(rng()-.5)*110,z:rng()*103,size:.3+rng()*.8}));
  const stars=Array.from({length:80},()=>[rng()*WIDTH,rng()*210,rng()]);
  let shake=0,flash=0;
  const rect=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
  function poly(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
  function line(points,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
  function text(value,x,y,color='#becbb0',size=13,align='left'){ctx.fillStyle=color;ctx.font=`${size}px ui-monospace, monospace`;ctx.textAlign=align;ctx.fillText(value,x,y);}
  function cube(x,y,w,h,d,color,top,side){rect(x-w/2,y-h,w,h,color);poly([[x-w/2,y-h],[x-w/2+d,y-h-d*.55],[x+w/2+d,y-h-d*.55],[x+w/2,y-h]],top);poly([[x+w/2,y-h],[x+w/2+d,y-h-d*.55],[x+w/2+d,y-d*.55],[x+w/2,y]],side);}
  function ground(station,points,color){poly(points.map(([x,z])=>{const p=project(station,x,z);return [p.x,p.y];}),color);}
  function terrain(s,time){
    const thermal=s.station==='gunship';
    const sky=ctx.createLinearGradient(0,0,0,HEIGHT);sky.addColorStop(0,thermal?'#111d1b':'#080e16');sky.addColorStop(.38,thermal?'#24312a':'#1d2c30');sky.addColorStop(1,thermal?'#344033':'#171f1a');ctx.fillStyle=sky;ctx.fillRect(0,0,WIDTH,HEIGHT);
    if(!thermal){
      stars.forEach(([x,y,r])=>rect(x,y,1+r,1+r,'#5b6d6c'));
      const glow=ctx.createRadialGradient(900,92,8,900,92,180);glow.addColorStop(0,'#b3b48f2b');glow.addColorStop(1,'#b3b48f00');ctx.fillStyle=glow;ctx.fillRect(700,0,400,260);
      ctx.fillStyle='#b7bea3';ctx.beginPath();ctx.arc(900,90,16,0,Math.PI*2);ctx.fill();ctx.fillStyle='#131e23';ctx.beginPath();ctx.arc(907,85,15,0,Math.PI*2);ctx.fill();
      poly([[0,186],[110,144],[160,171],[265,126],[370,166],[455,145],[570,185],[740,125],[810,156],[990,138],[1152,178],[1152,320],[0,320]],'#152122');
      poly([[0,214],[160,178],[280,218],[460,168],[610,215],[815,175],[1010,205],[1152,171],[1152,720],[0,720]],'#25302a');
    }
    ground(s.station,[[-55,0],[55,0],[55,110],[-55,110]],thermal?'#2b382d':'#2c3528');
    // Two broken roads lead to the wire. Patches establish depth without textures.
    ground(s.station,[[-22,0],[-13,0],[3,55],[17,110],[7,110],[-5,56]],thermal?'#404c3e':'#444738');
    ground(s.station,[[32,0],[39,0],[4,70],[-4,110],[-11,110],[-3,68]],thermal?'#414b3d':'#3d4033');
    ground(s.station,[[-52,74],[52,69],[52,78],[-52,82]],thermal?'#4b5442':'#444331');
    for(const r of rubble){const p=project(s.station,r.x,r.z);rect(p.x,p.y,r.size*p.scale*2,r.size*p.scale,thermal?'#1f2e23':'#20281e');}
    // Abandoned block buildings, never collision obstacles.
    for(const [x,z,w,h] of [[-25,25,17,12],[24,39,13,17],[-29,62,10,9],[37,17,11,8]]){
      const p=project(s.station,x,z),u=p.scale;cube(p.x,p.y,w*u,h*u,6*u,thermal?'#4f5a48':'#414840',thermal?'#68725a':'#596052','#252f27');
      for(let i=-1;i<=1;i++)rect(p.x+i*4*u-1,p.y-h*u+4*u,2*u,3*u,thermal?'#202d23':'#131d19');
    }
    for(const tree of [...trees].sort((a,b)=>a.z-b.z)){
      const p=project(s.station,tree.x,tree.z),u=p.scale*tree.size;
      rect(p.x-1.5*u,p.y-7*u,3*u,8*u,'#252e24');
      const c=thermal?'#15251c':'#0d1d19';
      poly([[p.x,p.y-23*u],[p.x-8*u,p.y-5*u],[p.x+8*u,p.y-5*u]],c);
      poly([[p.x,p.y-28*u],[p.x-6*u,p.y-13*u],[p.x+6*u,p.y-13*u]],thermal?'#22352a':'#152820');
    }
    // Outpost lights and wire; threats disappear only when they actually breach.
    const left=project(s.station,-50,91),right=project(s.station,50,91);
    line([[left.x,left.y],[right.x,right.y]],s.hp<30?'#d96c46':'#a4b279',2);
    for(let x=-48;x<=48;x+=8){const p=project(s.station,x,91);line([[p.x,p.y+5],[p.x,p.y-12]],'#b4ba88',2);}
    for(const x of [-43,43]){const p=project(s.station,x,87);rect(p.x-3,p.y-24,6,25,'#495241');rect(p.x-6,p.y-29,12,5,'#ebd89a');
      poly([[p.x,p.y-24],[p.x-75,p.y-120],[p.x+35,p.y-120]],'#dded9c09');}
    if(thermal){
      ctx.strokeStyle='#9caf7d13';ctx.lineWidth=1;for(let x=80;x<WIDTH;x+=96){ctx.beginPath();ctx.moveTo(x,70);ctx.lineTo(x,650);ctx.stroke();}for(let y=100;y<650;y+=96){ctx.beginPath();ctx.moveTo(60,y);ctx.lineTo(1092,y);ctx.stroke();}
      text('OUTPOST ECHO  /  HOLD THE PERIMETER',576,640,'#b5c895',13,'center');
    }
    // Smoke is strictly visual and derives from animation time.
    for(let i=0;i<6;i++){
      const p=project(s.station,24,39),age=(time*8+i*12)%80;
      ctx.fillStyle=`rgba(95,111,92,${.09*(1-age/80)})`;ctx.beginPath();ctx.arc(p.x+age*.2,p.y-40-age*1.1,8+age*.25,0,Math.PI*2);ctx.fill();
    }
  }
  function enemy(s,e,time){
    const p=project(s.station,e.x,e.z),u=p.scale*ENEMIES[e.kind].size,thermal=s.station==='gunship';
    const walk=Math.sin(time*8+e.phase)*2.4*u,brute=e.kind==='brute';
    const body=e.flash?'#fff5bf':thermal?(brute?'#c6cfb7':'#e1e9cc'):brute?'#8e8262':e.kind==='runner'?'#91a571':'#647d63';
    ctx.fillStyle='#0005';ctx.beginPath();ctx.ellipse(p.x,p.y+u,5*u,1.6*u,0,0,Math.PI*2);ctx.fill();
    rect(p.x-3.4*u,p.y-5*u+walk*.25,2.5*u,5*u-walk*.25,thermal?'#a7b398':'#35483b');
    rect(p.x+1*u,p.y-5*u-walk*.25,2.5*u,5*u+walk*.25,thermal?'#b8c3a5':'#425641');
    rect(p.x-4*u,p.y-13*u,8*u,9*u,body);rect(p.x-6*u,p.y-12*u+walk,2*u,7*u,body);rect(p.x+4*u,p.y-12*u-walk,2*u,7*u,body);
    rect(p.x-3*u,p.y-18*u,6*u,5*u,e.flash?'#fff9de':thermal?'#f2f5df':'#b5bd8e');
    if(!thermal){rect(p.x-2*u,p.y-16.5*u,1.2*u,1*u,'#f1ad5d');rect(p.x+.8*u,p.y-16.5*u,1.2*u,1*u,'#f1ad5d');}
    if(e.hp<e.maxHp){rect(p.x-6*u,p.y-23*u,12*u,1.2*u,'#111b15');rect(p.x-6*u,p.y-23*u,12*u*Math.max(0,e.hp/e.maxHp),1.2*u,'#dbe99d');}
    if(brute){line([[p.x-8*u,p.y-20*u],[p.x-8*u,p.y-24*u],[p.x-4*u,p.y-24*u]],'#e7aa6d');line([[p.x+8*u,p.y-20*u],[p.x+8*u,p.y-24*u],[p.x+4*u,p.y-24*u]],'#e7aa6d');}
  }
  function effects(s){
    for(const shot of s.shells){
      const p=project(s.station,shot.x,shot.z),t=1-shot.remaining/Math.max(1,shot.flight);
      ctx.setLineDash([4,5]);ctx.strokeStyle='#dec98a80';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(p.x,p.y,shot.radius*p.scale*2,shot.radius*p.scale,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      const sx=s.station==='gunship'?WIDTH+50:576,sy=s.station==='gunship'?-40:HEIGHT;
      const px=sx+(p.x-sx)*t,py=sy+(p.y-sy)*t-Math.sin(t*Math.PI)*200;
      line([[px-3,py+10],[px,py]],'#e7cf85',3);rect(px-2,py-2,4,4,'#fff9ca');
    }
    for(const e of s.effects){
      const p=project(s.station,e.x,e.z),t=e.age/e.life;
      if(e.type==='blast'){
        const r=Math.max(4,e.radius*p.scale*(.6+t*2.2));
        ctx.fillStyle=`rgba(244,208,121,${(1-t)*.24})`;ctx.beginPath();ctx.arc(p.x,p.y-3,r,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle=`rgba(255,231,164,${1-t})`;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,r,r*.55,0,0,Math.PI*2);ctx.stroke();
        for(let j=0;j<7;j++){const a=j*2.399+e.x;rect(p.x+Math.cos(a)*r*.8,p.y+Math.sin(a)*r*.6-r*.4,Math.max(1,7*(1-t)),Math.max(1,7*(1-t)),t<.4?'#fff1bd':'#bcaa72');}
      }else if(e.type==='kill'){
        text('+'+e.points,p.x,p.y-25-t*30,`rgba(218,236,161,${1-t})`,12,'center');
      }else if(e.type==='tracer'&&(e.key==='m2'||e.key==='gatling')){
        const start=e.key==='m2'?[576,650]:[1120,40];line([start,[p.x,p.y-10]],`rgba(244,231,164,${(1-t)*.8})`,2);
      }
    }
  }
  function emplacement(s,time){
    if(s.station==='gunship')return;
    const p=project(s.station,s.aim.x,s.aim.z),angle=clamp((p.x-576)/1000,-.35,.35);
    // Sandbags and foreground bring the gun down to eye level.
    for(let row=0;row<2;row++)for(let i=0;i<12;i++)cube(i*105+(row%2)*50,HEIGHT-row*24,98,28,10,'#4c503b','#62654a','#303c2d');
    ctx.save();ctx.translate(576,720);ctx.rotate(angle);
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
  function reticle(s,cursor){
    const ground=project(s.station,s.aim.x,s.aim.z),p=cursor||ground,w=s.weapons[s.weapon],stats=weaponStats(s),r=Math.max(13,stats.radius*ground.scale*(s.station==='gunship'?3:1.8));
    const c=w.overheated?'#ee9165':w.reload?'#c5b67e':'#e3f3b8';
    ctx.strokeStyle=c;ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.stroke();
    for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]])line([[p.x+dx*(r+5),p.y+dy*(r+5)],[p.x+dx*(r+17),p.y+dy*(r+17)]],c,2);
    rect(p.x-1,p.y-1,2,2,c);
    if(w.reload)text('RELOADING',p.x,p.y+r+34,c,11,'center');else if(w.overheated)text('COOLING BARREL',p.x,p.y+r+34,c,11,'center');
  }
  function draw(s,{time=s.tick/60,muted=false,reducedMotion=false,cursor=null}={}){
    if(reducedMotion)shake=0;
    ctx.save();if(shake>0)ctx.translate(Math.sin(time*113)*shake,Math.cos(time*97)*shake*.6);
    terrain(s,time);
    for(const e of [...s.enemies].sort((a,b)=>a.z-b.z))enemy(s,e,time);
    effects(s);emplacement(s,time);reticle(s,cursor);ctx.restore();
    const vignette=ctx.createRadialGradient(576,330,180,576,350,700);vignette.addColorStop(0,'#0000');vignette.addColorStop(1,'#0009');ctx.fillStyle=vignette;ctx.fillRect(0,0,WIDTH,HEIGHT);
    // Instrument frame and subtle raster treatment.
    for(let y=0;y<HEIGHT;y+=4)rect(0,y,WIDTH,1,'#00000012');
    const corners=[[24,24,1,1],[1128,24,-1,1],[24,696,1,-1],[1128,696,-1,-1]];
    corners.forEach(([x,y,dx,dy])=>line([[x+dx*30,y],[x,y],[x,y+dy*30]],'#a7b78e80'));
    text(s.station==='gunship'?'EO / IR  ·  WHITE HOT':'OPTICAL  ·  LOW LIGHT',44,47,'#b6c596',12);
    text('LIVE',1106,47,'#dbe9a1',12,'right');rect(1049,38,5,5,'#dbe9a1');
    text('ECHO 06',44,675,'#b6c596',12);text('AZ '+String(Math.round(s.aim.x+180)).padStart(3,'0')+'°',1107,675,'#b6c596',12,'right');
    if(s.roundTick<160&&s.status==='playing'){
      const alpha=Math.min(1,(160-s.roundTick)/40);ctx.globalAlpha=alpha;
      rect(399,84,354,58,'#111b18dc');text('ROUND '+String(s.round).padStart(2,'0')+'  /  '+s.total+' CONTACTS',576,119,'#e4edce',18,'center');ctx.globalAlpha=1;
    }
    if(muted){rect(0,0,WIDTH,HEIGHT,'#07100b55');}
    shake*=.78;flash=Math.max(0,flash-1);
  }
  return {draw,event(e){if(e.type==='fire'){flash=4;shake=e.weapon==='battery'||e.weapon==='howitzer'?7:2;}if(e.type==='breach')shake=8;}};
}
