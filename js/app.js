// SPDX-License-Identifier: Apache-2.0
import {FixedClock} from '../vendor/vanillajs/modules/time/index.js';
import {create,step,chooseUpgrade,selectWeapon,weaponStats} from './sim.js';
import {STATIONS,UPGRADES,stationForRound,DIFFICULTIES} from './content.js';
import {createRenderer,project,aimFromScreen,WIDTH,HEIGHT} from './render.js';
import {createAudio} from './audio.js';
import {Display} from './display.js';
const $=id=>document.getElementById(id),canvas=$('field'),renderer=createRenderer(canvas);
const clock=new FixedClock({step:1/60,maxFrame:.15,maxSteps:8});
let state=create(),screen='menu',paused=false,aim={x:0,z:45},pendingReload=false,noticeUntil=0;
let cursor=project(state.station,aim.x,aim.z);
let demo=create(),last=performance.now(),uiStation='',uiWeapon='',best={},prefs={fx:true,music:true};
try{const data=JSON.parse(localStorage.getItem('spooky.preferences')||'null');if(data&&typeof data.fx==='boolean'&&typeof data.music==='boolean')prefs={fx:data.fx,music:data.music};}catch{}
try{const data=JSON.parse(localStorage.getItem('spooky.best')||'{}');for(const key of Object.keys(DIFFICULTIES))if(Number.isSafeInteger(data[key])&&data[key]>=0)best[key]=data[key];}catch{}
const keys=new Set(),firePointers=new Set();let aimPointer=null,padPrevious=[],padBlocked=true;
const audio=createAudio(()=>notice('Audio unavailable this session. Combat stays active.'));
let windowMode='fit';try{windowMode=localStorage.getItem('spooky.display')||'fit';}catch{}
const display=new Display({select:$('display-mode'),button:$('fullscreen'),feedback:$('display-feedback'),initial:windowMode,
  save:mode=>{try{localStorage.setItem('spooky.display',mode);}catch{}},
  onChange:()=>{clearInput();if(screen==='game')pause();else audio.stop();}});
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
for(let i=0;i<650;i++)step(demo);
function notice(message){$('notice').textContent=message;noticeUntil=performance.now()+3500;}
function preferences(){
  $('sound').textContent=prefs.fx?'FX ON':'FX OFF';$('sound').setAttribute('aria-pressed',String(prefs.fx));
  $('music').textContent=prefs.music?'MUSIC ON':'MUSIC OFF';$('music').setAttribute('aria-pressed',String(prefs.music));
}
function savePreferences(){try{localStorage.setItem('spooky.preferences',JSON.stringify(prefs));}catch{}}
function clearInput(){
  keys.clear();firePointers.clear();pendingReload=false;padBlocked=true;
  if(aimPointer!==null){try{canvas.releasePointerCapture(aimPointer);}catch{}aimPointer=null;}
}
function show(panel){
  for(const name of ['briefing','upgrade-panel','pause-panel','result-panel'])$(name).hidden=name!==panel;
  $('overlay').hidden=!panel;
}
function focusGame(){canvas.focus({preventScroll:true});}
function stationUI(s){
  const station=stationForRound(s.round);
  if(uiStation!==s.station){
    uiStation=s.station;uiWeapon='';$('role').textContent=station.role;$('station-number').textContent=station.tag;
    $('station-title').textContent=station.name.toUpperCase()+'.';$('station-description').textContent=station.description;$('tip').textContent=station.tip;
    document.querySelectorAll('[data-station]').forEach(el=>el.classList.toggle('current',el.dataset.station===s.station));
    $('weapon-select').replaceChildren(...station.weapons.map((key,i)=>{
      const button=document.createElement('button');button.dataset.weapon=key;
      const small=document.createElement('small');small.textContent=station.weapons.length>1?String(i+1).padStart(2,'0'):'PRIMARY';
      const label=document.createElement('span');label.textContent=weaponStats(s,key).label;
      button.append(small,label);button.addEventListener('click',()=>{if(screen==='game'&&!paused&&selectWeapon(state,i)){uiWeapon='';focusGame();}});return button;
    }));
  }
  if(uiWeapon!==s.weapon){uiWeapon=s.weapon;document.querySelectorAll('[data-weapon]').forEach(el=>{el.classList.toggle('active',el.dataset.weapon===s.weapon);el.setAttribute('aria-pressed',String(el.dataset.weapon===s.weapon));});}
}
function hud(s){
  stationUI(s);const stats=weaponStats(s),w=s.weapons[s.weapon];
  $('round').textContent=String(s.round).padStart(2,'0');$('horde').textContent=s.total-s.resolved;
  $('integrity').replaceChildren(document.createTextNode(String(Math.ceil(s.hp))),Object.assign(document.createElement('span'),{textContent:'%'}));
  $('health-progress').style.width=s.hp+'%';$('health-progress').style.background=s.hp<30?'#e59c70':'var(--acid)';
  $('wave-progress').style.width=(100*(s.total-s.resolved)/s.total)+'%';
  $('weapon-name').textContent=stats.name;$('ammo').textContent=String(w.ammo).padStart(2,'0');$('capacity').textContent=stats.magazine;
  $('weapon-status').textContent=w.reload?'RELOADING '+(w.reload/60).toFixed(1)+'s':w.overheated?'BARREL OVERHEATED':w.cooldown?'CYCLING':'WEAPON READY';
  $('heat').textContent=Math.round(w.heat)+'% HEAT';
  $('weapon-progress').style.width=(w.reload?100*(1-w.reload/stats.reload):100-w.heat)+'%';
  $('weapon-progress').style.background=w.overheated?'var(--amber)':'var(--acid)';
  $('kills').textContent=s.kills;$('score').textContent=String(s.score).padStart(6,'0');
  $('combo').textContent=s.combo>=5?s.combo+' CHAIN / '+(1+Math.min(4,Math.floor(s.combo/5))*.25).toFixed(2)+'×':'NO ONE GETS THROUGH.';
  const installed=UPGRADES.filter(u=>u.id!=='repair'&&s.upgrades[s.station][u.id]>0);
  $('upgrades').textContent=installed.length?installed.map(u=>u.name+' '+s.upgrades[s.station][u.id]).join(' · '):'No upgrades installed. Earn your first.';
  $('reload').disabled=screen!=='game'||paused;
  $('touch-fire').disabled=screen!=='game'||paused;$('touch-reload').disabled=screen!=='game'||paused;
}
function launch(){
  const seed=Number($('seed').value);
  if($('seed').value===''||!Number.isInteger(seed)||seed<0||seed>4294967295){notice('Enter a whole-number seed between 0 and 4294967295.');$('seed').focus();return;}
  document.body.classList.add('playing');display.refresh();
  state=create({seed,difficulty:$('difficulty').value});screen='game';paused=false;aim={...state.aim};cursor=project(state.station,aim.x,aim.z);
  clearInput();clock.reset();clock.setPaused(false);show(null);$('pause').disabled=false;$('pause').innerHTML='Ⅱ <span>PAUSE</span>';
  $('channel').textContent='SPECTRE 01 / PERIMETER DEFENCE';uiStation='';hud(state);focusGame();void audio.unlock();
}
function pause(value=true){
  if(screen!=='game')return;
  paused=value;clearInput();clock.setPaused(value);audio.stop();show(value?'pause-panel':null);
  $('pause').innerHTML=value?'▶ <span>RESUME</span>':'Ⅱ <span>PAUSE</span>';
  $('channel').textContent=value?'COMMS ON HOLD / OPERATION PAUSED':stationForRound(state.round).name.toUpperCase()+' / PERIMETER DEFENCE';
  if(value)$('resume').focus({preventScroll:true});else{focusGame();void audio.unlock();}
  hud(state);
}
function menu(){
  document.body.classList.remove('playing');display.refresh();
  clearInput();audio.stop();paused=false;screen='menu';clock.setPaused(true);show('briefing');$('pause').disabled=true;$('pause').innerHTML='Ⅱ <span>PAUSE</span>';
  $('channel').textContent='SPECTRE 01 / AWAITING DEPLOYMENT';state=create();uiStation='';hud(state);$('deploy').focus({preventScroll:true});
}
function finishRound(){
  clearInput();clock.setPaused(true);audio.stop();$('pause').disabled=true;
  if(state.status==='upgrade'){
    screen='upgrade';show('upgrade-panel');const station=stationForRound(state.round);
    $('upgrade-info').textContent=`Round ${state.round} cleared · ${state.roundKills} eliminated · +8 integrity. Choose an upgrade for ${station.short}.`;
    $('next-station').textContent=`NEXT: ${stationForRound(state.round+1).short} / ROUND ${state.round+1} / UPGRADES STAY WITH THEIR STATION`;
    $('upgrade-cards').replaceChildren(...state.offers.map((id,i)=>{
      const u=UPGRADES.find(x=>x.id===id),rank=state.upgrades[state.station][id],capped=rank>=u.max,button=document.createElement('button');
      button.className='upgrade-card';button.dataset.upgrade=id;
      for(const [tag,cls,value] of [['span','upgrade-icon',u.icon],['span','label',u.kind],['strong','',capped?'Field repairs':u.name],['p','',capped?'All ranks installed. Repair 25 outpost integrity instead.':u.description],['span','rank',id==='repair'||capped?`${i+1} / +25 HP`:`${i+1} / RANK ${rank+1}`]]){
        const el=document.createElement(tag);el.className=cls;el.textContent=value;button.append(el);
      }
      button.addEventListener('click',()=>pickUpgrade(id));return button;
    }));$('upgrade-cards').firstElementChild?.focus({preventScroll:true});
  }else{
    screen='lost';show('result-panel');$('result-summary').textContent=`Reached round ${state.round} · ${state.kills} confirmed · ${DIFFICULTIES[state.difficulty].name} · seed ${state.seed}`;
    $('final-score').textContent=state.score.toLocaleString();
    best[state.difficulty]=Math.max(best[state.difficulty]||0,state.score);try{localStorage.setItem('spooky.best',JSON.stringify(best));}catch{}
    $('best-score').textContent=`Personal best (${DIFFICULTIES[state.difficulty].name}): ${best[state.difficulty].toLocaleString()}`;
    $('retry').focus({preventScroll:true});$('channel').textContent='OUTPOST ECHO / SIGNAL LOST';
  }
}
function pickUpgrade(id){
  if(screen!=='upgrade'||!chooseUpgrade(state,id))return;
  screen='game';paused=false;clearInput();aim={...state.aim};cursor=project(state.station,aim.x,aim.z);clock.setPaused(false);show(null);$('pause').disabled=false;
  $('channel').textContent=stationForRound(state.round).name.toUpperCase()+' / PERIMETER DEFENCE';hud(state);focusGame();void audio.unlock();
}
function aimAt(event){
  const box=canvas.getBoundingClientRect(),scale=Math.min(box.width/WIDTH,box.height/HEIGHT);
  const x=(event.clientX-box.left-(box.width-WIDTH*scale)/2)/scale,y=(event.clientY-box.top-(box.height-HEIGHT*scale)/2)/scale;
  cursor={x:Math.max(0,Math.min(WIDTH,x)),y:Math.max(0,Math.min(HEIGHT,y))};
}
canvas.addEventListener('pointerdown',e=>{
  if(screen!=='game'||paused||e.button>0)return;e.preventDefault();focusGame();aimPointer=e.pointerId;canvas.setPointerCapture(e.pointerId);aimAt(e);
  if(e.pointerType==='mouse'||e.pointerType==='pen')firePointers.add(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{if(screen==='game'&&!paused&&(e.pointerType==='mouse'||e.pointerId===aimPointer))aimAt(e);});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
function releasePointer(e){firePointers.delete(e.pointerId);if(e.pointerId===aimPointer)aimPointer=null;}
window.addEventListener('pointerup',releasePointer);window.addEventListener('pointercancel',releasePointer);
canvas.addEventListener('lostpointercapture',releasePointer);
$('touch-fire').addEventListener('pointerdown',e=>{if(screen!=='game'||paused)return;e.preventDefault();firePointers.add(e.pointerId);e.currentTarget.setPointerCapture(e.pointerId);});
$('touch-fire').addEventListener('lostpointercapture',releasePointer);
const editing=target=>target instanceof Element&&!!target.closest('input,select,textarea,[contenteditable="true"]');
window.addEventListener('keydown',e=>{
  if($('manual').open||editing(e.target))return;
  if(e.code==='Escape'||e.code==='KeyP'){if(screen==='game'){e.preventDefault();if(!e.repeat)pause(!paused);}return;}
  if(screen==='upgrade'&&/^Digit[123]$/.test(e.code)&&!e.repeat){e.preventDefault();pickUpgrade(state.offers[Number(e.code.at(-1))-1]);return;}
  if(screen!=='game'||paused)return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyR','Digit1','Digit2','Digit3'].includes(e.code)){
    e.preventDefault();keys.add(e.code);
    if(e.code==='KeyR'&&!e.repeat)pendingReload=true;
    if(/^Digit[123]$/.test(e.code)&&!e.repeat)selectWeapon(state,Number(e.code.at(-1))-1);
  }
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{clearInput();if(screen==='game'&&!paused)pause();else audio.stop();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(screen==='game'&&!paused)pause();else audio.stop();}});
window.addEventListener('pagehide',()=>{clearInput();audio.stop();if(screen==='game'&&!paused)pause();});
window.addEventListener('pageshow',()=>{last=performance.now();clearInput();if(screen==='game')pause();});
$('deploy').addEventListener('click',launch);$('retry').addEventListener('click',launch);$('resume').addEventListener('click',()=>pause(false));
$('quit').addEventListener('click',menu);$('result-menu').addEventListener('click',menu);$('pause').addEventListener('click',()=>pause(!paused));
for(const id of ['reload','touch-reload'])$(id).addEventListener('click',()=>{if(screen==='game'&&!paused){pendingReload=true;focusGame();}});
for(const [id,pref] of [['sound','fx'],['music','music']])$(id).addEventListener('click',()=>{prefs[pref]=!prefs[pref];preferences();savePreferences();audio.stop();if(prefs[pref])void audio.unlock();if(screen==='game'&&!paused)focusGame();});
$('manual-open').addEventListener('click',()=>{$('manual').showModal();});$('manual-close').addEventListener('click',()=>$('manual').close());
$('download-music').addEventListener('click',()=>{
  try{const url=URL.createObjectURL(new Blob([audio.musicWav($('soundtrack').value)],{type:'audio/wav'})),a=document.createElement('a');a.href=url;a.download='spooky-'+$('soundtrack').value+'-last-light.wav';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{notice('Soundtrack export unavailable. Your sound preferences are unchanged.');}
});
function readGamepad(){
  let pad;try{pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected&&p.mapping==='standard');}catch{}
  if(!pad){padPrevious=[];return {x:0,y:0,fire:false};}
  const buttons=pad.buttons.map(b=>b.pressed),edge=i=>buttons[i]&&!padPrevious[i];
  const axis=i=>Number.isFinite(pad.axes[i])&&Math.abs(pad.axes[i])>.2?Math.max(-1,Math.min(1,pad.axes[i])):0;
  const x=axis(0),y=axis(1);
  if(!buttons.some(Boolean)&&x===0&&y===0)padBlocked=false;
  if(screen==='game'){
    if(edge(9))pause(!paused);
    if(!paused&&!padBlocked){if(edge(2))pendingReload=true;const station=stationForRound(state.round),index=station.weapons.indexOf(state.weapon);if(edge(4))selectWeapon(state,(index+station.weapons.length-1)%station.weapons.length);if(edge(5))selectWeapon(state,(index+1)%station.weapons.length);}
  }
  padPrevious=buttons;return padBlocked?{x:0,y:0,fire:false}:{x,y,fire:buttons[0]||buttons[7]};
}
let lastHud=0;
function frame(now){
  const delta=Math.max(0,(now-last)/1000);last=now;const pad=readGamepad();
  if(screen==='game'&&!paused){
    clock.advance(delta,()=>{
      const dx=(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0)+pad.x;
      const dy=(keys.has('ArrowDown')||keys.has('KeyS')?1:0)-(keys.has('ArrowUp')||keys.has('KeyW')?1:0)+pad.y;
      if(dx||dy)cursor={x:Math.max(0,Math.min(WIDTH,cursor.x+dx*7)),y:Math.max(0,Math.min(HEIGHT,cursor.y+dy*6))};
      aim=aimFromScreen(state,cursor.x,cursor.y);
      step(state,{...aim,fire:firePointers.size>0||keys.has('Space')||pad.fire,reload:pendingReload});pendingReload=false;
      for(const e of state.events){renderer.event(e);audio.event({...e,tick:state.tick},prefs.fx);if(e.type==='breach')notice('PERIMETER BREACHED / OUTPOST TAKING DAMAGE');if(e.type==='hot')notice('BARREL HOT / RELEASE FIRE TO COOL');}
      if(state.status!=='playing')finishRound();
    });
    audio.sync(state.tick,prefs.music&&screen==='game'&&!paused,state.station);
  }
  if(screen==='menu'){
    // Attract scene runs independently from the next deployment's seed and state.
    for(let i=0;i<Math.min(3,Math.round(delta*60));i++)step(demo);
    if(demo.status!=='playing'){demo=create();for(let i=0;i<650;i++)step(demo);}
    renderer.draw(demo,{time:now/1000,muted:true,reducedMotion:reduced.matches});
  }else renderer.draw(state,{time:state.tick/60,reducedMotion:reduced.matches,cursor});
  if(now-lastHud>80){hud(state);lastHud=now;}
  if(noticeUntil&&now>noticeUntil){$('notice').textContent='';noticeUntil=0;}
  requestAnimationFrame(frame);
}
preferences();hud(state);clock.setPaused(true);requestAnimationFrame(frame);
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').then(async registration=>{
  await navigator.serviceWorker.ready;$('local-status').textContent='OFFLINE READY / LOCAL OPERATION';
  if(registration.waiting)$('local-status').textContent='UPDATE READY / CLOSE ALL SPOOKY TABS TO APPLY';
}).catch(()=>{$('local-status').textContent='ONLINE MODE / OFFLINE CACHE UNAVAILABLE';});}
