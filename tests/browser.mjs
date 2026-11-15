// SPDX-License-Identifier: Apache-2.0
// Real DOM controls with a caller-owned animation clock. No production test hooks.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {ROOT} from '../scripts/files.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.join(ROOT,'test-results');fs.mkdirSync(out,{recursive:true});
const receipt={status:'RUNNING',started:new Date().toISOString(),checks:[],errors:[],browser:null};
const write=()=>fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(receipt,null,2)+'\n');write();
const base=path.join(ROOT,'dist');
const server=http.createServer((request,response)=>{
  const pathname=decodeURIComponent(new URL(request.url,'http://local').pathname);
  const file=path.resolve(base,'.'+pathname.replace(/^\/Spooky/,'')+(pathname.endsWith('/')?'index.html':''));
  if(!file.startsWith(base+path.sep)){response.writeHead(403);response.end();return;}
  try{const data=fs.readFileSync(file);response.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'text/plain');response.end(data);}catch{response.writeHead(404);response.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/Spooky/`;
let browser;
async function check(name,fn){await fn();receipt.checks.push(name);write();console.log('PASS:',name);}
async function click(page,id){assert.ok(await page.locator(id).isVisible(),id+' visible');await page.locator(id).evaluate(el=>el.click());}
async function frames(page,n){await page.evaluate(n=>window.__frames(n),n);}
async function key(page,code,down=true){await page.evaluate(({code,down})=>window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,bubbles:true,cancelable:true})),{code,down});}
function installAnimationClock(){
  let now=0,id=0,queue=new Map();Object.defineProperty(performance,'now',{value:()=>now});
  window.requestAnimationFrame=fn=>{queue.set(++id,fn);return id;};window.cancelAnimationFrame=id=>queue.delete(id);
  window.__frames=n=>{for(let i=0;i<n;i++){now+=1000/60;const calls=[...queue.values()];queue.clear();calls.forEach(fn=>fn(now));}};
}
try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});receipt.browser=browser.version();
  await check('landscape tablets show touch controls and preserve independent aim/fire/reload input',async()=>{
    for(const [width,height] of [[1024,768],[1366,1024]]){
      const touchContext=await browser.newContext({viewport:{width,height},hasTouch:true});
      try{
        await touchContext.addInitScript(installAnimationClock);
        const tablet=await touchContext.newPage();tablet.on('pageerror',e=>receipt.errors.push(e.message));
        await tablet.goto(url);await tablet.waitForFunction(()=>document.querySelector('#weapon-select button'),{},{polling:100});await frames(tablet,2);
        assert.ok(await tablet.evaluate(()=>innerWidth>850&&matchMedia('(any-pointer: coarse)').matches),'wide touchscreen capability is active');
        assert.ok(await tablet.locator('.touch-controls').isVisible(),`touch controls visible at ${width}px`);
        await click(tablet,'#sound');await click(tablet,'#music');await click(tablet,'#deploy');await frames(tablet,10);
        assert.ok(await tablet.locator('#touch-fire').isEnabled());assert.ok(await tablet.locator('#touch-reload').isEnabled());
        assert.equal(await tablet.locator('#touch-fire').evaluate(el=>getComputedStyle(el).touchAction),'none');
        const session=await touchContext.newCDPSession(tablet),field=await tablet.locator('#field').boundingBox(),fire=await tablet.locator('#touch-fire').boundingBox();
        assert.ok(fire.x>=0&&fire.x+fire.width<=width&&fire.y+fire.height<=height,'fire button is in the viewport');
        const aim={x:field.x+field.width*.55,y:field.y+field.height*.4,id:1},trigger={x:fire.x+fire.width*.5,y:fire.y+fire.height*.5,id:2};
        await session.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
        const ammo=()=>tablet.locator('#ammo').textContent().then(Number),initial=await ammo();
        await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[aim]});await frames(tablet,12);
        assert.equal(await ammo(),initial,'aiming alone does not fire');
        await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[aim,trigger]});await frames(tablet,12);
        const firing=await ammo();assert.ok(firing<initial,'the separate touch button fires');
        aim.x+=field.width*.1;
        await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[aim,trigger]});await frames(tablet,12);
        const moved=await ammo();assert.ok(moved<firing,'dragging aim does not cancel firing');
        await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[aim]});await frames(tablet,12);
        assert.ok(await ammo()<moved,'lifting the aiming finger does not cancel firing');
        await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await frames(tablet,12);
        const stopped=await ammo();await frames(tablet,12);assert.equal(await ammo(),stopped,'releasing fire stops firing');
        const reload=await tablet.locator('#touch-reload').boundingBox();await tablet.touchscreen.tap(reload.x+reload.width*.5,reload.y+reload.height*.5);await frames(tablet,8);
        assert.match(await tablet.locator('#weapon-status').textContent(),/RELOADING/);await frames(tablet,100);assert.equal(await ammo(),initial);
        await tablet.screenshot({path:path.join(out,`tablet-${width}.png`)});await session.detach();
      }finally{await touchContext.close();}
    }
  });
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  page.on('pageerror',e=>receipt.errors.push(e.message));
  await context.addInitScript(installAnimationClock);
  await page.goto(url);await page.waitForFunction(()=>document.querySelector('#weapon-select button'),{},{polling:100});await frames(page,2);
  await check('desktop briefing and manual are usable',async()=>{
    assert.ok(await page.locator('.touch-controls').isHidden(),'wide mouse-only layout keeps touch controls hidden');
    assert.equal(await page.title(),'SPOOKY — Last Light');await page.screenshot({path:path.join(out,'briefing.png')});
    await click(page,'#manual-open');assert.ok(await page.locator('#manual').isVisible());await click(page,'#manual-close');
    await click(page,'#sound');await click(page,'#music');await click(page,'#deploy');await frames(page,120);
    assert.ok(await page.locator('#overlay').isHidden());assert.equal(await page.locator('#round').textContent(),'01');
  });
  await check('Space still fires after toolbar clicks; weapon and reload controls work',async()=>{
    const before=Number(await page.locator('#ammo').textContent());await key(page,'Space');await frames(page,8);await key(page,'Space',false);assert.ok(Number(await page.locator('#ammo').textContent())<before);
    await key(page,'Digit3');await frames(page,5);assert.match(await page.locator('#weapon-name').textContent(),/105 mm/);
    await key(page,'Space');await frames(page,1);await key(page,'Space',false);await key(page,'KeyR');await frames(page,8);await key(page,'KeyR',false);assert.match(await page.locator('#weapon-status').textContent(),/RELOADING/);
  });
  await check('pause and lost focus freeze combat and cancel held fire',async()=>{
    await key(page,'KeyP');await frames(page,5);assert.ok(await page.locator('#pause-panel').isVisible());
    const before=await page.locator('#ammo').textContent();await frames(page,300);assert.equal(await page.locator('#ammo').textContent(),before);
    await click(page,'#resume');await frames(page,160);await key(page,'Space');await frames(page,1);
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.ok(await page.locator('#pause-panel').isVisible());
    await click(page,'#resume');await frames(page,160);const ammo=await page.locator('#ammo').textContent();await frames(page,100);assert.equal(await page.locator('#ammo').textContent(),ammo);
    // BFCache restoration must also leave an explicitly resumable pause.
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));assert.ok(await page.locator('#pause-panel').isVisible());
    await click(page,'#quit');await click(page,'#deploy');
  });
  await page.evaluate(async()=>{
    const sim=await import('./js/sim.js'),view=await import('./js/render.js');window.__mirror=sim.create();
    window.__playRound=()=>{
      const s=window.__mirror,canvas=document.querySelector('#field'),rect=canvas.getBoundingClientRect();
      const scale=Math.min(rect.width/view.WIDTH,rect.height/view.HEIGHT),ox=rect.left+(rect.width-view.WIDTH*scale)/2,oy=rect.top+(rect.height-view.HEIGHT*scale)/2;
      const dispatchKey=(code,down)=>window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,bubbles:true,cancelable:true}));
      if(s.station==='gunship'){sim.selectWeapon(s,2);dispatchKey('Digit3',true);dispatchKey('Digit3',false);}
      let count=0;
      while(s.status==='playing'&&count++<10000){
        const target=s.enemies.reduce((a,b)=>!a||b.z>a.z?b:a,null),stats=sim.weaponStats(s);
        const point=target?view.project(s.station,target.x,target.z+target.speed*stats.flight):view.project(s.station,0,45);
        canvas.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',clientX:ox+point.x*scale,clientY:oy+point.y*scale,bubbles:true}));
        dispatchKey('Space',!!target);const aim=view.aimFromScreen(s,point.x,point.y);
        sim.step(s,{...aim,fire:!!target});window.__frames(1);
      }
      dispatchKey('Space',false);window.__frames(8);return {status:s.status,round:s.round,kills:s.kills,score:s.score,offers:s.offers,frames:count};
    };
  });
  for(const [round,name] of [[1,'gunship'],[2,'artillery'],[3,'infantry']]){
    await check(`${name}: complete a wave through actual input handlers and choose an upgrade`,async()=>{
      const result=await page.evaluate(()=>window.__playRound());assert.equal(result.status,'upgrade');assert.equal(result.round,round);
      assert.ok(await page.locator('#upgrade-panel').isVisible());assert.equal(await page.locator('.upgrade-card').count(),3);
      assert.equal(Number(await page.locator('#score').textContent()),result.score);assert.equal(Number(await page.locator('#kills').textContent()),result.kills);
      await page.screenshot({path:path.join(out,`${name}-upgrade.png`)});
      const id=result.offers.includes('damage')?'damage':result.offers[0];await click(page,`[data-upgrade="${id}"]`);
      await page.evaluate(async id=>{const {chooseUpgrade}=await import('./js/sim.js');chooseUpgrade(window.__mirror,id);},id);
      assert.equal(Number(await page.locator('#round').textContent()),round+1);
      // Capture the next station with real contacts; keep the mirror in lockstep.
      await page.evaluate(async()=>{const {step}=await import('./js/sim.js');for(let i=0;i<100;i++){step(window.__mirror);window.__frames(1);}});
      await page.screenshot({path:path.join(out,`${name}-next-station.png`)});
    });
  }
  await check('loss, personal best, retry and restart work without a refresh',async()=>{
    await frames(page,6500);assert.ok(await page.locator('#result-panel').isVisible());assert.ok(Number(await page.locator('#final-score').textContent().then(x=>x.replaceAll(',','')))>0);
    await click(page,'#retry');await frames(page,8);assert.equal(await page.locator('#round').textContent(),'01');assert.equal(Number(await page.locator('#kills').textContent()),0);
  });
  await check('offline cache serves a complete deployment under a repository subpath',async()=>{
    await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
    await page.reload();await page.waitForFunction(()=>navigator.serviceWorker.controller,{},{polling:100});
    await context.setOffline(true);await page.reload();await page.waitForFunction(()=>document.querySelector('#weapon-select button'),{},{polling:100});await frames(page,2);
    await click(page,'#deploy');await frames(page,120);assert.ok(await page.locator('#overlay').isHidden());await context.setOffline(false);
  });
  await check('320 px and 390 px layouts fit and touch firing survives aim-pointer release',async()=>{
    await key(page,'KeyP');await click(page,'#quit');
    for(const width of [320,390]){await page.setViewportSize({width,height:844});await frames(page,2);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      for(const selector of ['#brief-title','#deploy','#difficulty','#seed','.brief-rules']){const box=await page.locator(selector).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width,selector+' fits at '+width);}
      await page.screenshot({path:path.join(out,`mobile-${width}.png`),fullPage:true});}
    await click(page,'#deploy');await frames(page,10);
    // Native touch input uses distinct IDs for the aiming and firing fingers.
    const session=await context.newCDPSession(page),canvas=await page.locator('#field').boundingBox(),fire=await page.locator('#touch-fire').boundingBox();
    const aim={x:canvas.x+canvas.width*.6,y:canvas.y+canvas.height*.4,id:1},trigger={x:fire.x+fire.width*.5,y:fire.y+fire.height*.5,id:2};
    await session.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[aim]});
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[aim,trigger]});await frames(page,12);
    const before=Number(await page.locator('#ammo').textContent());await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[aim]});await frames(page,12);assert.ok(Number(await page.locator('#ammo').textContent())<before);
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await frames(page,12);const after=await page.locator('#ammo').textContent();await frames(page,12);assert.equal(await page.locator('#ammo').textContent(),after);
    await page.screenshot({path:path.join(out,'mobile-combat.png'),fullPage:true});await session.detach();
  });
  await check('unavailable audio leaves gameplay and saved preferences intact',async()=>{
    const fallback=await context.newPage();fallback.on('pageerror',e=>receipt.errors.push(e.message));
    await fallback.addInitScript(()=>{localStorage.setItem('spooky.preferences',JSON.stringify({fx:true,music:true}));window.AudioContext=class{constructor(){throw new Error('test device failure');}};});
    await fallback.goto(url);await fallback.waitForFunction(()=>document.querySelector('#weapon-select button'),{},{polling:100});await click(fallback,'#deploy');await frames(fallback,120);await click(fallback,'#sound');await frames(fallback,8);
    const saved=await fallback.evaluate(()=>JSON.parse(localStorage.getItem('spooky.preferences')));assert.equal(saved.music,true);assert.ok(await fallback.locator('#overlay').isHidden());await fallback.close();
  });
  assert.deepEqual(receipt.errors,[]);receipt.status='PASS';
}catch(error){receipt.status='FAIL';receipt.failure=error.stack;process.exitCode=1;console.error(error);}
finally{receipt.finished=new Date().toISOString();write();await browser?.close();server.close();}
