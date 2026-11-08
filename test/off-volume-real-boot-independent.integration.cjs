'use strict';
// Opt-in preparation only. Uses the joint fixture with its explicit OFF option.
// Synthetic shape/prices/dates; matching sale cardinality proves no real payload parity.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const Off=require('./helpers/retained-commercial-off-source.cjs'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const width of [1280,390])test('real OFF boot, historical volume, retained presentation and return '+width,{skip:process.env.SV_OFF_VOLUME_BOOT_QA!=='1',timeout:120000},async()=>{
 const root=Off.resolve().root,source=process.env.SV_OFF_BOOT_SOURCE_SHA,output=process.env.SV_OFF_BOOT_EVIDENCE;
 assert.match(source||'',/^[a-f0-9]{40}$/,'Explicit final source SHA required');assert(output&&path.isAbsolute(output),'Private absolute evidence directory required');
 assert.equal(source,Off.SOURCE_SHA,'Reviewed retained OFF19 source required');const active=require(path.join(root,'test/helpers/active-app.js')).readActiveApp(),runtime=['index.html','sw.js','js/'+active.filename,'js/core/commercial-ownership.js','js/modules/sales-indexed-host.v1.js','js/modules/collections-indexed-host.v1.js','js/core/commercial-pages-reader.v1.js','js/modules/commissions.js','test/fixtures/commercial-full-app.cjs'];
 const binding={};for(const file of runtime){const local=fs.readFileSync(path.join(root,file)),frozen=cp.execFileSync('git',['show',source+':'+file],{cwd:root,maxBuffer:20e6});assert.deepEqual(local,frozen,'RAW source binding '+file);binding[file]=hash(local);}
 assert(active.index.includes('SV_CLIENT_ACCOUNTS_ROLLOUT=Object.freeze({schema:1,enabled:false})'));
 assert(active.index.includes('SV_CLIENT_HISTORY_ROLLOUT=Object.freeze({schema:1,enabled:false})'));
 const {start}=require(path.join(root,'test/fixtures/commercial-full-app.cjs'));assert.match(start.toString(),/accountsRollout/,'Requires fdd fixture option; do not silently ignore OFF');
 const local=await start({accountsRollout:false,count:1096,historicalCount:800,paymentAmount:400}),before=structuredClone(local.backend.state.sisventas);
 let browser,context,page,gate;const queries=[],external=[],writeAttempts=[],errors=[],steps=[],frames=[];
 const expected={sales:1096,payments:1096,totalCents:175360000,paidCents:43840000,debtCents:131520000,historicalSales:800,historicalDebtCents:96000000};
 const arm=predicate=>{assert(!gate,'One transport hold at a time');let reached,release;const started=new Promise(r=>reached=r),pending=new Promise(r=>release=r);gate={predicate,reached,pending,release};return {started,release(){release();gate=null;}};};
 const waitStarted=async held=>{let timer;try{await Promise.race([held.started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Expected held transport not observed')),10000);})]);}finally{clearTimeout(timer);}};
 const off=async()=>assert.deepEqual(await page.evaluate(()=>({accounts:window.SV_CLIENT_ACCOUNTS_ROLLOUT?.enabled,history:window.SV_CLIENT_HISTORY_ROLLOUT?.enabled})),{accounts:false,history:false});
 const ready=async name=>page.waitForFunction(name=>window.SVDataReadiness?.statusFor(name).ready,name);
 const rows=()=>page.locator('#ventas-tbody tr[data-indexed-sale]');
 const totals=async()=>{
  const value=await page.evaluate(()=>SVCommercialPagesHost.financialState());assert(value);assert.equal(value.sales,expected.sales);assert.equal(value.payments,expected.payments);assert.equal(value.debtCents,expected.debtCents);
  assert.equal(value.days['2020-01-01'].sales,expected.historicalSales);
  // These historical receipts were paid on Jan 2, not the sale date Jan 1.
  const historical=Object.entries(value.days).filter(([day])=>day.startsWith('2020-01-')).reduce((sum,[,day])=>({sales:sum.sales+day.salesCents,paid:sum.paid+day.paidCents}),{sales:0,paid:0});
  assert.equal(historical.sales,128000000);assert.equal(historical.paid,32000000);assert.equal(historical.sales-historical.paid,expected.historicalDebtCents);
  assert.equal(Object.values(value.days).reduce((n,d)=>n+d.salesCents,0),expected.totalCents);assert.equal(Object.values(value.days).reduce((n,d)=>n+d.paidCents,0),expected.paidCents);
 };
 try{
  browser=await require('playwright').chromium.launch({headless:true,executablePath:process.env.SV_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});await context.addInitScript(()=>localStorage.setItem('nixa_dark','1'));
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());if(url.origin!==new URL(local.url).origin){external.push({method:request.method(),origin:url.origin,path:url.pathname});return route.abort();}
   if(!['GET','HEAD','OPTIONS'].includes(request.method())&&url.pathname!=='/laboral/capacidades'){writeAttempts.push({method:request.method(),path:url.pathname});return route.abort();}
   if(url.pathname==='/fixture-read'){const spec=JSON.parse(url.searchParams.get('spec'));queries.push(spec);if(gate&&!gate.taken&&gate.predicate(spec)){gate.taken=true;const current=gate;current.reached();await current.pending;}}
   return route.continue();
  });
  page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(local.url,{waitUntil:'domcontentloaded'});
  // The fixture's actual startup calls showPage('detalle') and its real loader.
  await page.evaluate(()=>{__moduleAuditSourceControl.release('productos');__moduleAuditSourceControl.release('empleados');});
  await ready('detalle');await page.waitForFunction(()=>document.querySelectorAll('#ventas-tbody tr[data-indexed-sale]').length===50&&SVCommercialPagesHost.financialState());
  assert.equal(await page.locator('.page.active').getAttribute('id'),'page-detalle');await off();await totals();steps.push('real OFF cold boot:50 rows and exact complete/historical debt');
  await page.locator('#vtab-todas').click();await page.locator('#ventas-mes').fill('');await page.locator('#ventas-mes').dispatchEvent('change');await page.waitForFunction(()=>document.querySelectorAll('#ventas-tbody tr[data-indexed-sale]').length===50&&document.getElementById('ventas-list-view').getAttribute('aria-busy')!=='true');
  const debtText=await page.locator('#vm-pendiente').textContent();
  await page.evaluate(()=>{
   window.__offFrames=[];const capture=()=>{const metric=document.getElementById('vm-pendiente'),active=document.querySelector('.page.active');__offFrames.push({rows:document.querySelectorAll('#ventas-tbody tr[data-indexed-sale]').length,debt:metric.textContent,ready:SVDataReadiness.statusFor('detalle').ready,inert:active.inert,visibility:getComputedStyle(metric).visibility});};
   window.__offObserver=new MutationObserver(capture);__offObserver.observe(document.getElementById('page-detalle'),{subtree:true,childList:true,characterData:true,attributes:true});capture();
  });
  local.setPhase('off-held-search');const searchHold=arm(spec=>spec.path.includes('/search/'));await page.locator('#ventas-search').fill('Cliente');await waitStarted(searchHold);
  assert.equal(await rows().count(),50);assert.equal(await page.locator('#vm-pendiente').textContent(),debtText);await ready('detalle');await off();
  searchHold.release();await page.waitForFunction(()=>window._filtrosVentas.texto==='Cliente'&&document.getElementById('ventas-list-view').getAttribute('aria-busy')!=='true');
  frames.push(...await page.evaluate(()=>{__offObserver.disconnect();return __offFrames;}));assert(frames.length>1);assert(frames.every(f=>f.rows>0&&f.rows<=50&&f.debt===debtText&&f.ready&&!f.inert&&f.visibility==='visible'),JSON.stringify(frames));steps.push('verified rows/cards/readiness retained during real held search');
  local.setPhase('off-historical-search');await page.locator('#ventas-search').fill('Antigua');await page.waitForFunction(()=>window._filtrosVentas.texto==='Antigua'&&document.getElementById('ventas-list-view').getAttribute('aria-busy')!=='true'&&document.querySelectorAll('#ventas-tbody tr[data-indexed-sale]').length===50);
  const historicalIds=await rows().evaluateAll(nodes=>nodes.map(n=>n.dataset.indexedSale));assert(historicalIds.every(id=>Number(id.replace('fixture',''))>=296));assert.match(await page.locator('#ventas-tbody').textContent(),/2020/);await totals();await off();
  // Open and return using actual row and Volver handlers, without editing/saving.
  await rows().first().click();await page.locator('#venta-detalle-view').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelectorAll('#venta-detalle-view tr[data-venta-item-index]').length===16);await page.locator('#venta-detalle-view').getByRole('button',{name:/Volver/}).first().click();await page.waitForFunction(()=>document.querySelectorAll('#ventas-tbody tr[data-indexed-sale]').length===50);
  assert.equal(await page.locator('#ventas-search').inputValue(),'Antigua');steps.push('historical search:50 bounded results; actual detail and Volver preserve query');
  local.setPhase('off-dashboard');await page.evaluate(()=>{showPage('dashboard');svCargarDatosDePaginaActual('dashboard');});await ready('dashboard');await page.waitForFunction(()=>SVCommercialPagesHost.financialState()?.recent.length===5);await totals();await off();
  const dashboardDebt=await page.locator('#kpi-deuda').textContent();assert(dashboardDebt.trim());
  local.setPhase('off-notifications');await page.evaluate(()=>{showPage('notificaciones');svCargarDatosDePaginaActual('notificaciones');});await ready('notificaciones');await off();
  const dashboardHold=arm(spec=>spec.path==='sv_commercial_pages/v1/coverage');local.setPhase('off-dashboard-return-held');await page.evaluate(()=>{showPage('dashboard');svCargarDatosDePaginaActual('dashboard');});await waitStarted(dashboardHold);
  assert.equal(await page.locator('#kpi-deuda').textContent(),dashboardDebt);assert.equal(await page.locator('#page-dashboard').evaluate(el=>el.classList.contains('sv-data-pending')),false);assert(await page.locator('#page-dashboard').isVisible());dashboardHold.release();await ready('dashboard');await totals();
  local.setPhase('off-return-sales');await page.evaluate(()=>{showPage('detalle');svCargarDatosDePaginaActual('detalle');});await ready('detalle');await page.waitForFunction(()=>document.querySelectorAll('#ventas-tbody tr[data-indexed-sale]').length===50);await totals();await off();steps.push('Dashboard→notifications→Dashboard held return→sales, exact debt and OFF preserved');
  const bounded=queries.filter(q=>/\/(?:pages|search)\//.test(q.path));assert(bounded.length);assert(bounded.every(q=>Number.isInteger(q.limit)&&q.limit>0&&q.limit<=50));assert(!queries.some(q=>['sisventas/ventas','sisventas/pagos'].includes(q.path)));
  assert.deepEqual(external,[]);assert.deepEqual(writeAttempts,[]);assert.deepEqual(errors,[]);assert.equal(local.backend.commands.length,0);assert.equal(local.backend.commits.length,0);assert.deepEqual(local.backend.state.sisventas,before);
  assert.equal(await page.evaluate(()=>__moduleAudit.writes.filter(w=>/^sisventas(?:\/|$)/.test(w.path)).length),0);steps.push('zero business/external writes; all original fictional records preserved');
  fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,'off-real-boot-'+width+'.png')});
  fs.writeFileSync(path.join(output,'off-real-boot-'+width+'.private.json'),JSON.stringify({source,testSha256:hash(fs.readFileSync(__filename)),binding,width,expected,steps,historicalIds,frames,queries,measures:local.measures,errors,limits:['Synthetic content/prices/calendar, not real payload/bytes equivalence','Real index sanitized for fixture Auth/SDK; no production Firebase','OFF Account/History switches; fictional prebuilt Commercial Pages remains ready','Notifications screen/return only: fixture has no notification item asserted','Read-only desktop/mobile scenario; not all forms, money operations or production latency']},null,2));
  console.log(JSON.stringify({source,width,expected,steps,accountsRollout:false,historyRollout:false,businessWrites:0,externalRequests:external.length,ui:true,simulated:true}));
 }finally{gate?.release();await context?.close();await browser?.close();await new Promise(resolve=>{local.server.close(resolve);local.server.closeAllConnections();});}
});
