const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os'),path=require('node:path');
(async()=>{
 const url=process.argv[2],profile=await fs.mkdtemp(path.join(os.tmpdir(),'flatmap-'));
 let browser;
 const errors=[];
 const open=async()=>{
   browser=await chromium.launchPersistentContext(profile,{executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,viewport:{width:1600,height:1000},args:['--disable-gpu']});
   const page=browser.pages()[0];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url,{waitUntil:'load'});await page.waitForFunction(()=>typeof state!=='undefined'&&state.traffic&&World.flat);
   return page;
 };
 const click=async(page,point,z=0)=>{
   const p=await page.evaluate(({point,z})=>{const q=view.project(point.x,point.y,World.height(point.x,point.y)+z),r=canvas.getBoundingClientRect();return {x:q.x+r.x,y:q.y+r.y};},{point,z});
   await page.mouse.move(p.x,p.y);await page.mouse.click(p.x,p.y);console.log('落点',point,await page.evaluate(()=>[state.mode,state.points.length,state.invalid,$('notice').textContent,snapshot().roads.length]));
 };
 const strip=page=>page.evaluate(()=>{
   const rect=canvas.getBoundingClientRect();
   for(let y=80;y<World.H-50;y+=30)for(let x=60;x<World.W-450;x+=40){
     const pts=[0,100,200,300,400].map(d=>({x:x+d,y}));
     const clear=Array.from({length:41},(_,i)=>({x:x+i*10,y})).every(p=>{
       const v=view.project(p.x,p.y,World.height(p.x,p.y));
       return document.elementFromPoint(rect.left+v.x,rect.top+v.y)===canvas&&!state.roads.some(r=>World.nearest(r,p).distance<45);
     });
     if(clear)return pts;
   } throw Error('没有找到可见空地');
 });
 try{
   let page=await open();await page.locator('#top').click();
   await page.locator('[data-mode=road]').click();await page.locator('[data-shape=line]').click();const pts=await strip(page);
   await click(page,pts[0]);await click(page,pts[1]);await page.waitForFunction(()=>snapshot().roads.length>=1);
   await page.mouse.click(...await page.evaluate(()=>{let q=canvas.getBoundingClientRect();return [q.x+q.width/2,q.y+q.height/2]}),{button:'right'});
   await page.locator('[data-mode=bridge]').click();await click(page,pts[1]);await page.locator('#manualBridgeRaise').click();
   await click(page,pts[2],5);await click(page,pts[3],5);await page.locator('#manualBridgeGround').click();await click(page,pts[4]);
   await page.locator('#manualBridgeFinish').click({timeout:5000});
   await page.waitForFunction(()=>state.roads.some(r=>r.built&&r.bridge));
   await page.locator('#keepMap').click();
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem(storageKey)).roads);
   assert(saved.some(r=>r.bridge));assert(saved.some(r=>!r.bridge));
   await browser.close();browser=null;
   page=await open();const reopened=await page.evaluate(()=>snapshot().roads);assert.deepEqual(reopened,saved);
   await page.locator('#top').click();
   await page.locator('[data-mode=road]').click();await page.locator('[data-shape=line]').click();const next=await strip(page);await click(page,next[0]);await click(page,next[1]);
   await page.waitForFunction(n=>snapshot().roads.length===n+1,saved.length);
   assert.deepEqual(errors,[]);console.log(JSON.stringify({os:os.platform(),arch:os.arch(),url,closedAndReopened:true,restored:saved.map(r=>({id:r.id,bridge:r.bridge,layout:r.layout})),addedAfterRestart:1}));
 }finally{await browser?.close();await fs.rm(profile,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
