// Visual/interaction regression against an isolated synthetic API; never writes to a real account.
// Open a local frontend on :5175, :5176 or Docker :5173 before running with playwright-cli.
async page => {
  const origin=page.url().split('/').slice(0,3).join('/');
  if(!['http://localhost:5173','http://localhost:5175','http://localhost:5176'].includes(origin))throw new Error('Use a local FocusArc frontend.');
  const browser=page.context().browser();const report={origin,captures:[],checks:[],errors:[]};
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto'}).format(new Date());
  const shift=(date,amount)=>new Date(Date.parse(date+'T12:00:00Z')+amount*86400000).toISOString().slice(0,10);
  const context=await browser.newContext({viewport:{width:900,height:700}});
  await context.addInitScript(()=>{const key='coursetimers.accounts.design-preview.theme';if(!localStorage.getItem(key))localStorage.setItem(key,'dark');});
  let empty=false;let failAnalytics=false;let active=null;let revision=1;let serial=0;let anonymous=false;
  const timers=[['Deep work','#A8D5BA',5400],['System design','#B89ED6',2520],['Reading','#DAB179',1380],['Algorithms','#91B9D0',900]].map(([name,color,seconds],index)=>({id:'design-'+index,name,color,icon:'book',cycle_total_seconds:seconds,completed_today_seconds:seconds,is_archived:false,created_at:day+'T0'+index+':00:00Z',updated_at:day+'T12:00:00Z'}));
  const sessions=timers.map((timer,index)=>({id:'session-'+index,timer_id:timer.id,start_at:day+'T'+String(12+index*2).padStart(2,'0')+':00:00Z',end_at:new Date(Date.parse(day+'T'+String(12+index*2).padStart(2,'0')+':00:00Z')+timer.completed_today_seconds*1000).toISOString(),duration_seconds:timer.completed_today_seconds,client_tz:'America/Toronto',day_date:day,day_of_week:0}));
  const snapshot=()=>({username:'design-preview',changed:true,revision,server_now:new Date().toISOString(),study_timezone:'America/Toronto',day_date:day,day_start_at:day+'T04:00:00Z',day_end_at:shift(day,1)+'T04:00:00Z',lease_expires_at:null,active_session:active,timers:empty?[]:timers.filter(timer=>!timer.is_archived)});
  const totals=()=>timers.map(timer=>({timer_id:timer.id,total_seconds:timer.completed_today_seconds}));
  await context.route(url=>url.pathname.startsWith('/api/'),async route=>{
    const request=route.request();const suffix=request.url().split('/api')[1];const path=suffix.split('?')[0];
    const query=Object.fromEntries((suffix.split('?')[1]||'').split('&').filter(Boolean).map(part=>part.split('=').map(decodeURIComponent)));
    const body=request.postData()?JSON.parse(request.postData()):{};
    const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
    let value={};let status=200;
    if(path==='/auth/session'){value={username:'design-preview'};if(anonymous)status=401;}
    else if(path==='/study-state')value=snapshot();
    else if(path==='/study-heartbeat')value={};
    else if(path.endsWith('/start')){active={...sessions[0],id:'active-'+(++serial),timer_id:path.split('/')[2],start_at:new Date().toISOString(),end_at:null,duration_seconds:null};revision++;value={active_session:active,stopped_session:null};}
    else if(path==='/stop'){value={stopped_session:active};active=null;revision++;}
    else if(path==='/totals/reset'){active=null;revision++;timers.forEach(timer=>{timer.cycle_total_seconds=0;});value={totals:[]};}
    else if(path.endsWith('/adjust')){const session=active?.id===path.split('/')[2]?active:sessions.find(item=>item.id===path.split('/')[2]);const delta=body.delta_seconds;session.start_at=new Date(Date.parse(session.start_at)-delta*1000).toISOString();if(session.end_at)session.duration_seconds=Math.max(0,Math.round((Date.parse(session.end_at)-Date.parse(session.start_at))/1000));revision++;value=session;}
    else if(path.endsWith('/latest-session'))value=sessions.find(item=>item.timer_id===path.split('/')[2])??null;
    else if(path==='/timers'&&request.method()==='POST'){const timer={...timers[0],...body,id:'created-'+(++serial),completed_today_seconds:0,cycle_total_seconds:0};timers.push(timer);revision++;value=timer;}
    else if(path.startsWith('/timers/')){const timer=timers.find(item=>item.id===path.split('/')[2]);if(request.method()==='PATCH')Object.assign(timer,body);if(request.method()==='DELETE')timer.is_archived=true;revision++;value=timer;}
    else if(path==='/timers')value={timers:empty?[]:timers};
    else if(path==='/sessions'||path==='/stats/analytics/sessions')value={sessions:empty?[]:sessions.filter(session=>!query.timer_id||session.timer_id===query.timer_id)};
    else if(path==='/schedule/day')value={day_date:query.day_date,sessions:query.day_date===day?sessions:[]};
    else if(path==='/stats/day')value={day_date:query.day_date,totals:totals()};
    else if(path==='/stats/week')value={week_start:query.week_start,daily:Array.from({length:7},(_,index)=>({day_date:shift(query.week_start,index),totals:totals().map(item=>({...item,total_seconds:Math.round(item.total_seconds*(.4+index*.12))}))}))};
    else if(path==='/stats/averages')value={days:Number(query.days),averages:timers.map(timer=>({timer_id:timer.id,avg_seconds_per_day:Math.round(timer.completed_today_seconds*.75)}))};
    else if(path==='/stats/analytics'){
      if(failAnalytics){status=503;value={detail:'Preview data is temporarily unavailable.'};}
      else{const from=query.from||shift(day,-89);const count=Math.round((Date.parse(day)-Date.parse(from))/86400000)+1;
        const daily=Array.from({length:count},(_,index)=>({day_date:shift(from,index),recorded_seconds:index%7===5?0:1800+(index*1733)%10800,timed_seconds:index%7===5?0:1800+(index*1733)%10800,session_count:index%7===5?0:2+index%3}));
        const recorded=daily.reduce((sum,item)=>sum+item.recorded_seconds,0);const activeDays=daily.filter(item=>item.recorded_seconds>0).length;
        value={range:{from,to:day,client_tz:'America/Toronto'},summary:{recorded_seconds:recorded,timed_seconds:recorded,session_count:daily.reduce((sum,item)=>sum+item.session_count,0),active_days:activeDays,day_count:count,consistency_percent:activeDays/count*100,average_seconds_per_day:recorded/count},daily,weekly:Array.from({length:Math.ceil(count/7)},(_,index)=>({week_start:shift(from,index*7),recorded_seconds:Math.max(5000,40000+Math.sin(index*.8)*22000),active_days:5,is_partial:false})),hourly:Array.from({length:24},(_,hour)=>({hour,timed_seconds:hour>=8&&hour<=20?Math.round((1+Math.sin(hour*.8)**2)*22000):0})),comparison:{previous_week_start:shift(day,-14),current_week_start:shift(day,-7),previous_seconds:36000,current_seconds:43200,delta_seconds:7200,delta_percent:20}};
      }
    }
    await route.fulfill({status,headers,body:JSON.stringify(value)});
  });
  const view=await context.newPage();view.on('pageerror',error=>report.errors.push(error.message));
  const settle=async()=>{await view.evaluate(async()=>{await document.fonts.ready;const material=new Image();material.src='/materials/gouache-paper.webp';await material.decode();});await view.waitForTimeout(220);};
  const capture=async name=>{await settle();const path='.impeccable/review/'+name+'.png';await view.screenshot({path,fullPage:false});report.captures.push(path);};
  const theme=async desired=>{if(await view.locator('html').getAttribute('data-theme')!==desired){await view.getByRole('button',{name:'Switch to '+desired+' mode'}).click();await settle();}};
  const textContrast=async(selector,backgroundSelector=selector,pseudo=null)=>view.evaluate(([selector,backgroundSelector,pseudo])=>{
    const ink=getComputedStyle(document.querySelector(selector)).color;
    const background=document.querySelector(backgroundSelector);
    const surface=background.querySelector('.soft-frame-fill');
    const ground=surface&&!pseudo?getComputedStyle(surface).fill:getComputedStyle(background,pseudo).backgroundColor;
    const ctx=document.createElement('canvas').getContext('2d');
    const luminance=color=>{ctx.fillStyle=color;ctx.fillRect(0,0,1,1);const rgb=[...ctx.getImageData(0,0,1,1).data].slice(0,3).map(channel=>{const n=channel/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
    const a=luminance(ink),b=luminance(ground);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  },[selector,backgroundSelector,pseudo]);
  const fits=async vertical=>view.evaluate(vertical=>{
    const selectors=vertical?'.timer-name,.timer-time,.clock-housing,.timer-controls button,.sidebar-brand,.sidebar-endday':'.main-content,.sidebar,.page,.panel,.page-header';
    return document.documentElement.scrollWidth<=innerWidth&&[...document.querySelectorAll(selectors)].every(el=>{const b=el.getBoundingClientRect();return b.left>=-.5&&b.right<=innerWidth+.5&&(!vertical||b.top>=-.5&&b.bottom<=innerHeight+.5);});
  },vertical);
  try{
    for(const selectedTheme of ['dark','light']){
      await view.goto(origin+'/timers');await view.getByRole('button',{name:'Play',exact:true}).waitFor();await theme(selectedTheme);
      assert(await fits(true),'Primary timer does not fit 900x700 in '+selectedTheme);
      assert(await view.evaluate(()=>[...document.fonts].some(face=>face.family.replaceAll('"','')==='Fraunces'&&face.status==='loaded')),'Display font did not load');
      assert(await textContrast('.timer-period','.timer-dial','::after')>=4.5,'Timer metadata contrast in '+selectedTheme);
      assert(await textContrast('.sidebar-username','.sidebar')>=4.5,'Sidebar metadata contrast in '+selectedTheme);
      await capture('user-900-'+selectedTheme+'-timers');
      await view.getByRole('button',{name:'New',exact:true}).click();await capture('user-900-'+selectedTheme+'-create');
      await view.getByLabel('Color',{exact:true}).focus();await view.keyboard.press('Tab');
      assert(await view.getByRole('button',{name:'Cancel',exact:true}).evaluate(el=>document.activeElement===el&&getComputedStyle(el).outlineStyle!=='none'),'Dialog keyboard focus is not visible or follows the wrong field order in '+selectedTheme);
      await view.getByLabel('Name',{exact:true}).fill('New study');await view.getByLabel('Color',{exact:true}).fill('bad');await view.getByRole('button',{name:'Create',exact:true}).click();
      await view.getByText('Color must be a valid hex code (e.g. #1A2B3C).').waitFor();await capture('user-900-'+selectedTheme+'-validation');await view.getByRole('button',{name:'Close',exact:true}).click();
      await view.getByRole('button',{name:'Edit timer',exact:true}).click();await capture('user-900-'+selectedTheme+'-edit');await view.getByRole('button',{name:'Close',exact:true}).click();
      await view.getByRole('button',{name:'Reset cycle counters',exact:true}).click();await capture('user-900-'+selectedTheme+'-reset');await view.getByRole('button',{name:'Cancel',exact:true}).click();
      for(const [route,heading]of[['/history','History'],['/schedule','Schedule'],['/stats','Stats'],['/stats?view=reports','Stats']]){
        await view.goto(origin+route);await view.getByRole('heading',{name:heading,exact:true}).waitFor();await settle();assert(await fits(false),'Page overflow: '+route+' '+selectedTheme);
        await capture('user-900-'+selectedTheme+'-'+(route.includes('reports')?'reports':route.slice(1)));
      }
    }
    const originalSessions=sessions.slice();sessions.splice(0,sessions.length,
      {...originalSessions[2],id:'adjacent-15',start_at:day+'T12:00:00Z',end_at:day+'T12:15:00Z',duration_seconds:900},
      {...originalSessions[3],id:'adjacent-23',start_at:day+'T12:15:00Z',end_at:day+'T12:38:00Z',duration_seconds:1380});
    for(const selectedTheme of ['dark','light']){
      await view.goto(origin+'/schedule');await view.getByRole('group',{name:'Short sessions'}).waitFor();await theme(selectedTheme);
      const choices=view.getByRole('group',{name:'Short sessions'}).getByRole('button');assert(await choices.count()===2,'Short session choices missing');
      for(const choice of await choices.all()){const box=await choice.boundingBox();assert(box&&box.height>=36,'Short session target too small');}
      await choices.nth(1).click();await view.getByRole('button',{name:'Add 10 minutes to session',exact:true}).waitFor();
      const intervals=await view.locator('.session-block').evaluateAll(nodes=>nodes.map(node=>({height:parseFloat(node.style.height),text:node.textContent})));
      assert(Math.abs(intervals[0].height-9)<.01&&Math.abs(intervals[1].height-13.8)<.01&&intervals.every(item=>!item.text),'Short timeline interval stretched or label clipped');
      await capture('user-900-'+selectedTheme+'-schedule-adjacent');assert(await fits(false),'Adjacent sessions overflow');
    }
    sessions.splice(0,sessions.length,...originalSessions);report.checks.push('Adjacent 15/23-minute sessions keep accurate markers with readable 36px selection targets in both themes');
    await view.goto(origin+'/timers');await view.getByRole('button',{name:'Play',exact:true}).waitFor();await theme('dark');
    for(const selectedTheme of ['dark','light']){await theme(selectedTheme);
    for(const color of ['#000000','#FFFFFF','#FF0000','#777777','#384C96']){
      timers[0].color=color;revision++;await view.evaluate(()=>window.dispatchEvent(new Event('focus')));
      await view.waitForFunction(color=>document.querySelector('.app-layout')?.style.getPropertyValue('--app-accent')===color,color);
      assert(await view.locator('.timer-view').evaluate(el=>el.style.getPropertyValue('--accent'))===color,'Timer lost exact HEX');
      await settle();
      assert(await fits(true),'Extreme HEX broke layout');
      assert(await textContrast('.timer-control-main')>=4.5,'Action text contrast for '+color+' in '+selectedTheme);
      assert(await textContrast('.timer-row-active .timer-row-name','.timer-row-active')>=4.5,'Selected course contrast for '+color+' in '+selectedTheme);
    }}
    await theme('dark');report.checks.push('Exact custom HEX and readable action text in both themes, including black, white, vivid red and middle gray');
    timers[0].color='#A8D5BA';timers[0].name='A very long course name for study';revision++;await view.evaluate(()=>window.dispatchEvent(new Event('focus')));await view.getByRole('heading',{name:timers[0].name,exact:true}).waitFor();await capture('user-900-long-name');assert(await fits(true),'Long timer name overflows');timers[0].name='Deep work';revision++;
    await view.reload();await view.getByRole('button',{name:'Play',exact:true}).waitFor();
    await view.setViewportSize({width:1440,height:900});await capture('desktop');assert(await fits(true),'Desktop timer overflow');
    await view.setViewportSize({width:390,height:844});await capture('mobile');assert(await fits(false),'Mobile page overflow');
    await view.setViewportSize({width:320,height:568});await theme('light');await capture('mobile-320-light');assert(await fits(false),'320px page overflow');
    await view.setViewportSize({width:900,height:400});await theme('dark');await capture('user-900-short');assert(await fits(true),'Short timer view overflow');
    await view.setViewportSize({width:900,height:700});await view.getByRole('button',{name:'Play',exact:true}).click();await view.getByRole('dialog',{name:'Timer screensaver'}).waitFor();await view.locator('.screensaver-wallpaper[data-render-state="ready"]').waitFor();
    await view.getByRole('button',{name:'Exit screensaver',exact:true}).click();await view.locator('.screensaver').waitFor({state:'hidden'});await view.getByRole('button',{name:'Pause',exact:true}).waitFor();await capture('user-900-running');await view.getByRole('button',{name:'Pause',exact:true}).click();await view.getByRole('button',{name:'Play',exact:true}).waitFor();report.checks.push('Play enters illustrated screensaver; Exit and Pause retain normal timer behavior');
    failAnalytics=true;await view.goto(origin+'/stats');await view.getByRole('button',{name:'Retry analytics'}).waitFor();await capture('user-900-error');failAnalytics=false;
    empty=true;await view.goto(origin+'/timers');await view.getByRole('heading',{name:'Select a timer'}).waitFor();await capture('user-900-empty');assert(await view.getByRole('button',{name:'Play',exact:true}).isDisabled(),'Empty timer action is enabled');empty=false;
    anonymous=true;await view.goto(origin);await view.getByRole('heading',{name:'FocusArc',exact:true}).waitFor();await capture('auth-dark');await view.evaluate(()=>{document.documentElement.dataset.theme='light';});await capture('auth-light');
    assert(report.errors.length===0,'Browser errors: '+report.errors.join('; '));return report;
  }catch(error){await view.screenshot({path:'.deployment-private/rebrand-failure.png',fullPage:true});throw new Error(String(error)+' Completed: '+JSON.stringify(report));}
  finally{await context.close();}
}
