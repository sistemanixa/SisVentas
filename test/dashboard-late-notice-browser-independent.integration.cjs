'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(require.resolve('./dashboard-activity-integrated-browser-independent.integration.cjs'),'utf8');
const session=new Function('require','__dirname',source.slice(0,source.indexOf('for(const width of'))+'\nreturn session;')(require,__dirname);
for(const width of [1280,390])test('actual center pending then late notices after1200ms without retries '+width,{
 skip:process.env.SV_ACTIVITY_INTEGRATED_BROWSER_QA!=='1',timeout:60000
},()=>session(width,async({page,calls})=>{
 let release,started;const held=new Promise(r=>{release=r;}),entered=new Promise(r=>{started=r;});let attempts=0;
 await page.route('https://activity.fixture.invalid/commercial/dashboard/presupuestos/avisos',async route=>{attempts++;started();await held;await route.fallback();});
 try{
  await page.evaluate(()=>{const role=PERMISOS_ROLES[currentRole];role.indiceModulos.notificaciones=true;role.bloqueados=(role.bloqueados||[]).filter(m=>m!=='notificaciones');showPage('notificaciones');window.__lateNoticeQA=Promise.resolve(svCargarDatosDePaginaActual('notificaciones')).catch(()=>false);});
  assert.equal(await page.evaluate(()=>document.querySelector('.page.active').id),'page-notificaciones');
  await entered;await page.waitForTimeout(1400);await page.evaluate(()=>generarNotificaciones());
  const overlay=page.locator('[data-sv-data-status][data-sv-data-page="notificaciones"]');assert.equal(await overlay.isVisible(),true);assert.match(await overlay.innerText(),/Cargando|pendiente|presupuest/i);
  assert.doesNotMatch(await page.locator('body').innerText(),/Todo al día|Sin notificaciones/i);
  fs.mkdirSync(path.resolve('tmp/qa-late-notices-2a'),{recursive:true});await page.screenshot({path:path.resolve('tmp/qa-late-notices-2a/held-'+width+'.png')});
  const before=await page.evaluate(()=>({list:document.getElementById('notif-lista').textContent,label:document.getElementById('notif-count-label').textContent,busy:document.getElementById('notif-badge').getAttribute('aria-busy'),readiness:SVDataReadiness.statusFor('notificaciones')}));
  console.log('Held notice state '+JSON.stringify(before));
  assert.match(before.list,/pendientes/i);assert.doesNotMatch(before.list,/Sin notificaciones|Todo al día/i);assert.equal(before.busy,'true');assert.equal(attempts,1);
  release();await page.evaluate(()=>__lateNoticeQA);
  await page.waitForFunction(()=>window._svBudgetNoticeConsumerHost?.peek().complete===true);
  await page.waitForTimeout(1500);console.log('Delivered notice state '+JSON.stringify(await page.evaluate(()=>({page:document.querySelector('.page.active')?.id,list:document.getElementById('notif-lista').textContent,label:document.getElementById('notif-count-label').textContent,rows:_svBudgetNoticeConsumerHost.peek().rows,notifications:todasNotifs.filter(n=>n.tipo==='presupuesto'),readiness:SVDataReadiness.statusFor('notificaciones')}))));
  assert.equal(await page.locator('#notif-lista').isVisible(),true);await page.screenshot({path:path.resolve('tmp/qa-late-notices-2a/delivered-'+width+'.png')});
  assert.match(await page.locator('#notif-lista').innerText(),/PP-FICTICIO/,'A complete late delivery must replace the visible pending message');
  const after=await page.evaluate(()=>({list:document.getElementById('notif-lista').innerText,busy:document.getElementById('notif-badge').getAttribute('aria-busy'),originals:pptoData.length}));
  assert.match(after.list,/PP-FICTICIO/);assert.equal(after.busy,'false');assert.equal(attempts,1);assert.equal(calls.length,1);assert.equal(after.originals,0);
  await page.waitForTimeout(300);assert.equal(attempts,1);
  console.log(JSON.stringify({width,heldMs:1400,pending:before.list,lateVisible:true,requests:attempts,originalBudgets:after.originals}));
 }finally{release();}
}));
