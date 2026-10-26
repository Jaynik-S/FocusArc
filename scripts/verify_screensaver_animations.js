// Local Vite :5175; add ?production=1 to its URL to test the built app on :5176.
// Mock API isolates motion tests. Real API timer checks remain in verify_screensaver.js.
async page => {
  if (!page.url().startsWith('http://localhost:5175/')) throw new Error('Use local Vite on :5175.');
  const origin = page.url().includes('production=1') ? 'http://localhost:5176' : 'http://localhost:5175';
  const onlyScene = page.url().match(/[?&]scene=([^&]+)/)?.[1];
  const wallpapers = await page.evaluate(async () => (await import('/src/utils/screensaverWallpapers.ts')).SCREENSAVER_WALLPAPERS);
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const browser = page.context().browser(); const report = { origin, cases: [], errors: [] };
  for (let index = 0; index < wallpapers.length; index++) {
    const wallpaper = wallpapers[index];
    if (onlyScene && wallpaper.id !== onlyScene) continue;
    const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
    await context.addInitScript(({ random, wallpapers }) => {
      Math.random = () => random;
      window.animationMetrics = { frames: 0, costs: [], jobs: 0, mismatches: [] };
      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker { postMessage(...args) { window.animationMetrics.jobs++; super.postMessage(...args); } };
      const starts = new WeakMap(); const depths = new WeakMap();
      const prototype = CanvasRenderingContext2D.prototype;
      const clear = prototype.clearRect; const save = prototype.save; const restore = prototype.restore;
      prototype.clearRect = function(...args) { if (this.canvas.classList.contains('screensaver-environment')) starts.set(this, performance.now()); return clear.apply(this,args); };
      prototype.save = function(...args) { if (this.canvas.classList.contains('screensaver-environment')) depths.set(this,(depths.get(this)||0)+1); return save.apply(this,args); };
      prototype.restore = function(...args) {
        const value=restore.apply(this,args);
        if(this.canvas.classList.contains('screensaver-environment')) {
          const depth=(depths.get(this)||1)-1;depths.set(this,depth);
          if(depth===0 && starts.has(this)) { window.animationMetrics.frames++;window.animationMetrics.costs.push(performance.now()-starts.get(this));starts.delete(this); }
        }return value;
      };
      window.addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>{
        const art=document.querySelector('.screensaver-wallpaper');const effect=document.querySelector('.screensaver-environment');
        if(!art || !effect)return;const source=art.getAttribute('data-source');const color=art.getAttribute('data-color')||'#377DC2';
        const scene=wallpapers.find(item=>item.source===source)?.id;
        if(scene && (effect.getAttribute('data-scene')!==scene || effect.getAttribute('data-color')!==color))window.animationMetrics.mismatches.push({scene,color,effect:effect.dataset.scene,tint:effect.dataset.color});
      }).observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-color','data-source']}));
    }, { random: (index + .1) / wallpapers.length, wallpapers });
    const view = await context.newPage(); view.on('pageerror', error => report.errors.push(error.message));
    let active = null; let revision = 1; let serial = 0;
    const now = new Date(); const day = now.toISOString().slice(0,10);
    const timer = { id:'motion-a', name:wallpaper.name, color:'#A8D5BA', icon:'book', cycle_total_seconds:0,completed_today_seconds:0,is_archived:false,created_at:now.toISOString(),updated_at:now.toISOString() };
    const second = {...timer,id:'motion-b',name:'Another study',color:'#42216F'};
    const headers = {'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
    // Match HTTP API paths only; /src/api/*.ts are Vite JavaScript modules.
    await context.route(url => url.pathname.startsWith('/api/'),async route=>{
      const url=route.request().url();let body={};
      if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
      if(url.includes('/auth/session'))body={username:'animation-preview'};
      else if(url.includes('/start')) { const id=url.includes('/motion-b/')?second.id:timer.id;active={id:'motion-'+(++serial),timer_id:id,start_at:new Date().toISOString(),end_at:null,duration_seconds:null,client_tz:'America/Toronto',day_date:day,day_of_week:0};revision++;body={active_session:active,stopped_session:null}; }
      else if(url.includes('/stop')) {body={stopped_session:active};active=null;revision++;}
      else if(url.includes('/study-state'))body={username:'animation-preview',changed:true,revision,server_now:new Date().toISOString(),study_timezone:'America/Toronto',day_date:day,day_start_at:day+'T00:00:00Z',day_end_at:new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString(),lease_expires_at:null,active_session:active,timers:[timer,second]};
      await route.fulfill({status:200,headers,body:JSON.stringify(body)});
    });
    const effect=view.locator('.screensaver-environment');
    const metrics=()=>view.evaluate(()=>window.animationMetrics);
    const snapshot=()=>effect.evaluate(canvas=>{
      const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let hash=2166136261;let visible=0;
      for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]>5)visible++;if(i%28===0)hash=Math.imul(hash^pixels[i+3],16777619);}return{hash:hash>>>0,visible};
    });
    try {
      await view.goto(origin);
      await view.bringToFront();
      await view.getByRole('button',{name:new RegExp('^'+wallpaper.name+' ')}).click();
      await view.getByRole('button',{name:'Play',exact:true}).click();
      await view.locator('.screensaver-wallpaper[data-render-state="ready"][data-color="#A8D5BA"]').waitFor();
      await view.locator('.screensaver-environment[data-scene="'+wallpaper.id+'"][data-motion="running"][data-color="#A8D5BA"]').waitFor();
      await view.evaluate(()=>{window.retainedEnvironment=document.querySelector('.screensaver-environment');});
      const first=await snapshot();const before=await metrics();const started=Date.now();
      await view.screenshot({path:'.deployment-private/animation-'+wallpaper.id+'-start.png'});
      await view.waitForTimeout(4200);
      const later=await snapshot();const steady=await metrics();
      assert(first.hash!==later.hash && later.visible>20,'Motion is missing: '+wallpaper.id);
      assert(steady.jobs===before.jobs,'Animation triggered static recoloring');
      const fps=(steady.frames-before.frames)/((Date.now()-started)/1000);
      assert(fps>15 && fps<40,'Unexpected animation draw rate: '+fps);
      await view.screenshot({path:'.deployment-private/animation-'+wallpaper.id+'-sage.png'});
      timer.color='#42216F';revision++;await view.evaluate(()=>window.dispatchEvent(new Event('focus')));
      await view.locator('.screensaver-wallpaper[data-render-state="ready"][data-color="#42216F"]').waitFor();
      await view.locator('.screensaver-environment[data-color="#42216F"]').waitFor();
      assert(await effect.evaluate(el=>el===window.retainedEnvironment),'HEX edit restarted the scene');
      await view.waitForTimeout(4200);
      await view.screenshot({path:'.deployment-private/animation-'+wallpaper.id+'-purple.png'});
      await view.emulateMedia({reducedMotion:'reduce'});await view.locator('.screensaver-environment[data-motion="reduced"]').waitFor({state:'attached'});
      const reduced=(await metrics()).frames;await view.waitForTimeout(350);assert((await metrics()).frames===reduced,'Reduced motion kept rendering');
      assert((await snapshot()).visible===0,'Reduced motion retained moving effects');
      await view.emulateMedia({reducedMotion:'no-preference'});
      await view.locator('.screensaver-environment[data-motion="running"]').waitFor();
      for (const color of ['#FFFFFF','#FF5733','#000000']) {
        timer.color=color;revision++;await view.evaluate(()=>window.dispatchEvent(new Event('focus')));
        await view.locator('.screensaver-wallpaper[data-render-state="ready"][data-color="'+color+'"]').waitFor();
        await view.locator('.screensaver-environment[data-color="'+color+'"][data-motion="running"]').waitFor();
        await view.waitForTimeout(250);assert((await snapshot()).visible>20,'Missing effects for '+color);
        await view.screenshot({path:'.deployment-private/animation-'+wallpaper.id+'-'+color.slice(1)+'.png'});
      }
      // The automated browser exposes every tab as visible. Exercise the visibility
      // listener with a temporary hidden getter, then restore the native property.
      await view.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
      await view.locator('.screensaver-environment[data-motion="hidden"]').waitFor({state:'attached'});
      const hidden=(await metrics()).frames;await view.waitForTimeout(350);assert((await metrics()).frames===hidden,'Hidden tab kept rendering');
      await view.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
      await view.locator('.screensaver-environment[data-motion="running"]').waitFor();
      await view.setViewportSize({width:320,height:568});await view.waitForTimeout(250);
      assert(await effect.evaluate(el=>el.width===320 && el.height===568),'Narrow canvas sizing incorrect');
      await view.screenshot({path:'.deployment-private/animation-'+wallpaper.id+'-320.png'});
      await view.setViewportSize({width:900,height:700});
      await view.getByRole('button',{name:'Exit screensaver',exact:true}).click();
      await view.locator('.screensaver-environment[data-motion="paused"]').waitFor({state:'attached'});
      const paused=(await metrics()).frames;await view.waitForTimeout(350);assert((await metrics()).frames===paused,'Exited screensaver kept rendering');
      await view.getByRole('button',{name:'Pause',exact:true}).click();await view.getByRole('button',{name:'Play',exact:true}).click();
      await view.locator('.screensaver-environment[data-motion="running"]').waitFor();
      assert(await effect.evaluate(el=>el===window.retainedEnvironment),'Same-world resume recreated the animation');
      if(index===0){
        await view.getByRole('button',{name:'Exit screensaver',exact:true}).click();
        await view.getByRole('button',{name:/^Another study /}).click();await view.getByRole('button',{name:'Play',exact:true}).click();
        await view.waitForFunction(()=>document.querySelector('.screensaver-wallpaper')?.getAttribute('data-render-state')==='ready' && document.querySelector('.screensaver-environment')?.getAttribute('data-scene')!=='space');
        assert(await effect.evaluate(el=>el!==window.retainedEnvironment),'New displayed artwork reused old scene buffer');
      }
      const final=await metrics();assert(final.mismatches.length===0,'Effect/artwork mismatch: '+JSON.stringify(final.mismatches));
      const costs=final.costs.slice().sort((a,b)=>a-b);
      report.cases.push({scene:wallpaper.id,colors:['#A8D5BA','#42216F','#FFFFFF','#FF5733','#000000'],fps:Number(fps.toFixed(1)),averageDrawMs:Number((costs.reduce((a,b)=>a+b,0)/costs.length).toFixed(2)),p95DrawMs:Number(costs[Math.floor(costs.length*.95)].toFixed(2)),visiblePixels:later.visible,noStaticReprocessing:true,hiddenReducedExitStopped:true,paletteAndSceneSynchronized:true});
    } catch(error){
      const state = await view.evaluate(()=>({effect:document.querySelector('.screensaver-environment')?.dataset,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,hidden:document.hidden,visibility:document.visibilityState,frames:window.animationMetrics?.frames}));
      await view.screenshot({path:'.deployment-private/animation-failure.png'});throw new Error(String(error)+' State: '+JSON.stringify(state)+' Completed: '+JSON.stringify(report));
    }
    finally {await context.close();}
  }
  assert(report.errors.length===0,'Browser errors: '+report.errors.join('; '));return report;
}
