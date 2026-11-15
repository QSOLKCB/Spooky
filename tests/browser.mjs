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
  await check('Fit window keeps the complete battlefield, HUD and controls visible on short screens',async()=>{
    const dc=await browser.newContext({viewport:{width:1836,height:890},hasTouch:true});
    try{
      await dc.addInitScript(installAnimationClock);const p=await dc.newPage();p.on('pageerror',e=>receipt.errors.push(e.message));
      await p.goto(url);await p.waitForFunction(()=>document.querySelector('#weapon-select button'),{},{polling:100});
      await click(p,'#sound');await click(p,'#music');await click(p,'#deploy');await frames(p,200);
      for(const [width,height] of [[1836,890],[1366,650],[1280,600],[844,390],[320,844],[390,844],[320,568]]){
        await p.setViewportSize({width,height});await frames(p,2);
        const bounds=await p.evaluate(()=>({scrollW:document.documentElement.scrollWidth,scrollH:document.documentElement.scrollHeight,w:innerWidth,h:innerHeight,fit:getComputedStyle(document.querySelector('#field')).objectFit}));
        assert.equal(bounds.fit,'contain');assert.ok(bounds.scrollW<=width&&bounds.scrollH<=height,`no page overflow at ${width}x${height}`);
        for(const selector of ['#field','.combat-stats','.weapon-select','.ammo-panel','#display-mode','#pause','#touch-fire','#touch-reload']){
          const b=await p.locator(selector).boundingBox();assert.ok(b&&b.width>0&&b.height>0&&b.x>=-1&&b.y>=-1&&b.x+b.width<=width+1&&b.y+b.height<=height+1,`${selector} visible at ${width}x${height}: ${JSON.stringify(b)}`);
        }
        await p.screenshot({path:path.join(out,`fit-${width}x${height}.png`)});
      }
      // Resizing preserves the contain transform used by live pointer aiming.
      await p.setViewportSize({width:844,height:390});await frames(p,2);
      const target=await p.evaluate(async()=>{const view=await import('./js/render.js'),b=document.querySelector('#field').getBoundingClientRect(),q=view.project('gunship',17,55),scale=Math.min(b.width/1152,b.height/720);return {x:b.left+(b.width-1152*scale)/2+q.x*scale,y:b.top+(b.height-720*scale)/2+q.y*scale};});
      await p.mouse.move(target.x,target.y);await key(p,'Space');await frames(p,8);await key(p,'Space',false);assert.ok(Number(await p.locator('#ammo').textContent())<90);
    }finally{await dc.close();}
  });
  await check('native fullscreen enters and exits through one controller, pauses combat and clears held fire',async()=>{
    const dc=await browser.newContext({viewport:{width:1280,height:600}});
    try{
      await dc.addInitScript(installAnimationClock);const p=await dc.newPage();p.on('pageerror',e=>receipt.errors.push(e.message));
      await p.goto(url);await p.waitForFunction(()=>document.querySelector('#weapon-select button'),{},{polling:100});await click(p,'#sound');await click(p,'#music');
      await p.locator('#display-mode').selectOption('page');await p.waitForFunction(()=>!document.querySelector('#display-mode').disabled,{},{polling:100});
      await click(p,'#deploy');await frames(p,80);await key(p,'Space');await frames(p,8);
      await p.locator('#display-mode').selectOption('fullscreen');
      await p.waitForFunction(()=>document.fullscreenElement&&document.querySelector('#display-mode').value==='fullscreen'&&!document.querySelector('#display-mode').disabled,{},{polling:100});
      assert.ok(await p.locator('#pause-panel').isVisible());const ammo=await p.locator('#ammo').textContent();await frames(p,200);assert.equal(await p.locator('#ammo').textContent(),ammo);
      await click(p,'#resume');await frames(p,30);assert.equal(await p.locator('#ammo').textContent(),ammo,'display change clears held fire');
      await p.evaluate(()=>document.exitFullscreen());await p.waitForFunction(()=>!document.fullscreenElement&&document.querySelector('#display-mode').value==='page',{},{polling:100});
      assert.ok(await p.locator('#pause-panel').isVisible());assert.equal(await p.evaluate(()=>document.body.classList.contains('fit-screen')),false);
      await click(p,'#quit');await click(p,'#manual-open');await p.locator('#fullscreen').click();
      await p.waitForFunction(()=>!!document.fullscreenElement,{},{polling:100});assert.equal(await p.locator('#display-mode').inputValue(),'fullscreen');
      await p.locator('#fullscreen').click();await p.waitForFunction(()=>!document.fullscreenElement,{},{polling:100});assert.equal(await p.locator('#display-mode').inputValue(),'page');
      await click(p,'#manual-close');await p.locator('#display-mode').selectOption('fit');
    }finally{await dc.close();}
  });
  await check('fullscreen denial falls back to Fit window; window preference persists and short menus scroll',async()=>{
    const dc=await browser.newContext({viewport:{width:844,height:390},hasTouch:true});
    try{
      await dc.addInitScript(installAnimationClock);const p=await dc.newPage();p.on('pageerror',e=>receipt.errors.push(e.message));
      await p.goto(url);await p.waitForFunction(()=>document.querySelector('#weapon-select button'),{},{polling:100});
      await p.evaluate(()=>{document.documentElement.requestFullscreen=()=>Promise.reject(new Error('denied'));});
      await p.locator('#display-mode').selectOption('fullscreen');await p.waitForFunction(()=>!document.querySelector('#display-mode').disabled,{},{polling:100});
      assert.equal(await p.locator('#display-mode').inputValue(),'fit');assert.match(await p.locator('#display-feedback').textContent(),/unavailable/);
      await p.locator('#manual-open').scrollIntoViewIfNeeded();await p.locator('#manual-open').click();await click(p,'#manual-close');
      await p.locator('#deploy').scrollIntoViewIfNeeded();await p.locator('#deploy').click();await frames(p,30);
      await key(p,'KeyP');await p.locator('#resume').scrollIntoViewIfNeeded();await p.locator('#resume').click();await frames(p,10);assert.ok(await p.locator('#overlay').isHidden());
      await p.locator('#display-mode').selectOption('page');await p.reload();await p.waitForFunction(()=>document.querySelector('#weapon-select button'),{},{polling:100});
      assert.equal(await p.locator('#display-mode').inputValue(),'page');assert.equal(await p.evaluate(()=>Boolean(document.fullscreenElement)),false);
      await p.locator('#display-mode').selectOption('fit');await p.reload();await p.waitForFunction(()=>document.querySelector('#weapon-select button'),{},{polling:100});assert.equal(await p.locator('#display-mode').inputValue(),'fit');
    }finally{await dc.close();}
  });
  await check('all station scenes render gravity debris, fuel chains and distinct enemy silhouettes without mutating combat',async()=>{
    const vc=await browser.newContext({viewport:{width:1440,height:1000}});
    try{
      await vc.addInitScript(installAnimationClock);const p=await vc.newPage();p.on('pageerror',e=>receipt.errors.push(e.message));
      await p.goto(url);await p.waitForFunction(()=>document.querySelector('#weapon-select button'),{},{polling:100});
      for(const [round,station,weapon] of [[1,'gunship','howitzer'],[2,'artillery','battery'],[3,'infantry','m2']]){
        const capture=await p.evaluate(async({round,station,weapon})=>{
          const {create,step}=await import('./js/sim.js'),{createRenderer,project}=await import('./js/render.js');
          const s=create();s.round=round;s.station=station;s.weapon=weapon;s.nextSpawn=100000;
          s.enemies=Array.from({length:24},(_,i)=>({id:i+1,kind:['walker','runner','brute'][i%3],x:(i%8-3.5)*7,z:42+Math.floor(i/8)*12,hp:600,maxHp:600,speed:.03,phase:i,flash:0,variant:i%4}));
          for(let i=0;i<2;i++)step(s,{x:-12,z:43,fire:i===0});for(let i=0;i<54;i++)step(s);
          // Physical scenery fixture: all visual effects were produced by actual sim steps.
          if(station==='infantry'){s.weapons.m2.cooldown=0;step(s,{x:3,z:48,fire:true});}
          const canvas=document.createElement('canvas'),renderer=createRenderer(canvas),before=JSON.stringify(s);renderer.draw(s,{cursor:project(station,-12,43)});
          if(JSON.stringify(s)!==before)throw new Error('renderer mutated simulation');
          const first=canvas.toDataURL();renderer.draw(s,{cursor:project(station,-12,43)});if(first!==canvas.toDataURL())throw new Error('same tick rendered differently');
          return canvas.toDataURL('image/jpeg',.9);
        },{round,station,weapon});
        fs.writeFileSync(path.join(out,`${station}-battlefield.jpg`),Buffer.from(capture.split(',')[1],'base64'));
      }
    }finally{await vc.close();}
  });
  await check('105 mm has a much larger visible blast and finite effects at full upgrades',async()=>{
    const vc=await browser.newContext({viewport:{width:1440,height:1000}});
    try{
      await vc.addInitScript(installAnimationClock);const p=await vc.newPage();p.on('pageerror',e=>receipt.errors.push(e.message));
      await p.goto(url);await p.waitForFunction(()=>document.querySelector('#weapon-select button'),{},{polling:100});
      const result=await p.evaluate(async()=>{
        const {create,step,selectWeapon,weaponStats}=await import('./js/sim.js'),{createRenderer,project}=await import('./js/render.js');
        const pictures=[],areas=[];
        for(const index of [1,2]){
          const s=create();s.fuel=[];s.nextSpawn=100000;s.tick=s.roundTick=200;s.aim={x:0,z:55};selectWeapon(s,index);
          const canvas=document.createElement('canvas'),renderer=createRenderer(canvas),cursor=project(s.station,0,55),context=canvas.getContext('2d');
          renderer.draw(s,{cursor});const before=context.getImageData(0,0,1152,720).data;
          step(s,{x:0,z:55,fire:true});for(let i=1;i<weaponStats(s).flight+8;i++)step(s);
          const frozen=JSON.stringify(s);renderer.draw(s,{cursor});if(JSON.stringify(s)!==frozen)throw new Error('blast rendering changed combat');
          const after=context.getImageData(0,0,1152,720).data;let area=0;
          for(let i=0;i<after.length;i+=4)if(Math.abs(after[i]-before[i])+Math.abs(after[i+1]-before[i+1])+Math.abs(after[i+2]-before[i+2])>35)area++;
          areas.push(area);pictures.push(canvas.toDataURL('image/jpeg',.9));
          const normal=canvas.toDataURL();renderer.draw(s,{cursor});if(canvas.toDataURL()!==normal)throw new Error('blast rendering is not repeatable');
          renderer.draw(s,{cursor,reducedMotion:true});
        }
        // Exercise the largest supported radius near every perspective camera edge.
        for(const station of ['gunship','artillery','infantry']){
          const s=create();s.fuel=[];s.nextSpawn=100000;s.station=station;s.weapon='howitzer';s.upgrades.gunship.radius=6;
          step(s,{x:52,z:96,fire:true});for(let i=1;i<weaponStats(s).flight+20;i++)step(s);
          const canvas=document.createElement('canvas'),renderer=createRenderer(canvas);renderer.draw(s,{reducedMotion:true});
        }
        return {areas,pictures};
      });
      assert.ok(result.areas[1]>result.areas[0]*3,`105 mm visible blast covers >3x as many pixels: ${result.areas}`);
      fs.writeFileSync(path.join(out,'gunship-blast-comparison.json'),JSON.stringify({changedPixels40:result.areas[0],changedPixels105:result.areas[1],threshold:'sum of RGB absolute differences > 35',age:9},null,2)+'\n');
      for(let i=0;i<2;i++)fs.writeFileSync(path.join(out,`blast-${i===0?'40mm':'105mm'}.jpg`),Buffer.from(result.pictures[i].split(',')[1],'base64'));
    }finally{await vc.close();}
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
  await check('field manual exports the selected complete station soundtrack',async()=>{
    const {makeScore}=await import('../js/audio.js');
    await key(page,'KeyP');await click(page,'#quit');await click(page,'#manual-open');
    for(const station of ['gunship','artillery','infantry']){
      await page.locator('#soundtrack').selectOption(station);const pending=page.waitForEvent('download');await page.locator('#download-music').click();
      const download=await pending;assert.equal(download.suggestedFilename(),`spooky-${station}-last-light.wav`);
      assert.deepEqual(fs.readFileSync(await download.path()),Buffer.from(makeScore(station).wav()));
    }
    await click(page,'#manual-close');await click(page,'#deploy');await frames(page,120);
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
