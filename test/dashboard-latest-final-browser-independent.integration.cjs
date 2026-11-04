'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const old=fs.readFileSync(require.resolve('./dashboard-own-month-browser-independent.integration.cjs'),'utf8');
const {harness}=new Function('require','__dirname',old.slice(0,old.indexOf('\nfor(const width of [1280,390])test('))+'\nreturn {harness};')(require,__dirname);
const transport=fs.readFileSync(require.resolve('./dashboard-sales-creator-latest-transport.test.cjs'),'utf8');
const backend=new Function('require','__dirname',transport.slice(0,transport.indexOf("test('60 and 501"))+'\nreturn backend;')(require,__dirname);
const Pages=require('../cotizador/commercial-pages-model'),P=require('../cotizador/commercial-pages-projections'),Activity=require('../cotizador/dashboard-commercial-activity-proposal');
const opt={skip:process.env.SV_ACTIVITY_INTEGRATED_BROWSER_QA!=='1',timeout:60000},salePath='/commercial/dashboard/ventas/actividad-v2';
async function realBackend(){
 const f=await backend(501),amounts=[0.01,12.34,123.45,1000.01,1.99];
 for(let i=0;i<5;i++)f.set('sisventas/ventas/s'+String(500-i).padStart(4,'0')+'/total',amounts[i]);
 const sales=f.data().sisventas.ventas,prepared=await P.prepare({sales,payments:{},owner:s=>s.responsableUid,generation:'pages-fixture'});f.set(Pages.ROOT,null);f.apply(prepared.patch);
 f.set(Activity.ROOT,null);f.apply((await Activity.build({originals:f.data().sisventas,complete:true,pages:f.read(Pages.ROOT),pagesEvidence:prepared.activitySnapshot,config:f.read('sv_commercial_pages_config'),generation:'activity-fixture',...f.legacy})).patch);
 return f;
}
const personalRows=page=>page.locator('#dash-adm-ultventas > div[style*="padding:8px 10px"]');
async function nameAndRender(page){await page.evaluate(()=>{clientesData=[{fbKey:'customer1',id:'customer1',nombre:'Nombre vigente & <QA>'}];const sales=ventasList,budgets=pptoData,trap=new Proxy({},{get(){throw Error('Forbidden original fallback');}});try{ventasList=trap;pptoData=trap;renderDashAdministrativo();}finally{ventasList=sales;pptoData=budgets;}});}
async function narrow(page){await page.evaluate(()=>{
 aplicarPermisosRolesGuardados({vendedor:{indiceVersion:2,indiceRevision:7,indiceModulos:{dashboard:true,comisiones:true,clientes:true}}});
 window.permisoModulo=m=>PERMISOS_ROLES[currentRole]?.indiceModulos?.[m]===true;window.tienePermiso=a=>a==='dashboard.miActividad';
 ventasList=Array.from({length:50},(_,i)=>({id:'LOCAL-'+i,creadaPor:'u',fecha:'2026-11-04',total:999,cliente:'FALSO_PARCIAL_50'}));
});}
for(const width of [1280,390])test('final personal501 and certified5 exact cents current names privacy and lifecycle '+width,opt,async()=>{
 const f=await realBackend(),{session,demand,ready}=harness();let status=200;
 await session(width,async({page,calls,local})=>{
  const deliveries=[];await page.route('https://activity.fixture.invalid'+salePath,async route=>{
   calls.push({path:salePath,method:route.request().method()});if(status!==200)return route.fulfill({status,contentType:'application/json',body:'{}'});
   const reply=await f.readDomain('ventas');deliveries.push(reply);return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(reply)});
  });
  await narrow(page);local.setPhase('final-personal');const marker=await page.evaluate(()=>__moduleAudit.reads.length);
  await demand(page);await ready(page);await nameAndRender(page);
  const packet=await page.evaluate(()=>SVDashboardActivityHost.peek().data),keys=packet.salesAuthorLatest.rows.map(r=>r.key);
  assert.equal(packet.mode,'ownMonthly');assert.equal(packet.salesAuthorMonthly.count,501);assert.equal(packet.salesAuthorLatestComplete,true);assert.deepEqual(keys,['s0500','s0499','s0498','s0497','s0496']);
  assert(deliveries[0].recent.rows.every(r=>Number(r.key.slice(1))>=501),'global top5 must belong to the other creator');
  for(const row of packet.salesAuthorLatest.rows)assert.deepEqual(Object.keys(row),['key','number','client','clientRecordKey','rawDate','totalCents']);
  assert(!JSON.stringify(packet.salesAuthorLatest).includes('PRIVATE'));assert(!JSON.stringify(packet.salesAuthorLatest).includes('creatorOrder'));
  assert.equal(calls.length,1);assert.equal(await page.locator('#dash-adm-ventas').textContent(),'501');assert.equal(await personalRows(page).count(),5);
  const list=await page.locator('#dash-adm-ultventas').innerText();assert.doesNotMatch(list,/pendiente|FALSO_PARCIAL|Sin ventas/i);
  const values=await personalRows(page).locator(':scope > div:last-child').allTextContents();assert.deepEqual(values,['$ 0,01','$ 12,34','$ 123,45','$ 1.000,01','$ 1,99']);
  assert.equal((list.match(/Nombre vigente & <QA>/g)||[]).length,5);assert.equal(await page.locator('#dash-adm-ultventas qa').count(),0);
  assert.deepEqual(await page.evaluate(()=>SVDashboardHostContext.create(window).capture().grants),{ventas:'own',pagos:null,ordenes_trabajo:null,presupuestos:null});
  assert.equal(await page.locator('#dash-administrativo-card').isVisible(),true);
  const originalReads=await page.evaluate(marker=>__moduleAudit.reads.slice(marker).filter(r=>r.path==='sisventas/presupuestos'||r.path==='/comerciales/presupuestos'),marker);assert.deepEqual(originalReads,[]);
  fs.mkdirSync(path.resolve('tmp/qa-latest-ee46'),{recursive:true});await page.locator('#dash-administrativo-card').screenshot({path:path.resolve('tmp/qa-latest-ee46/personal-'+width+'.png')});
  status=503;await page.evaluate(()=>SVDashboardActivityHost.refresh().catch(()=>false));assert.equal(await personalRows(page).count(),5);assert.match(await page.locator('#dash-adm-ultventas').innerText(),/No se pudo actualizar/i);
  const failed=calls.length;await page.evaluate(()=>{for(let i=0;i<3;i++)renderDashAdministrativo();Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(200);assert.equal(calls.length,failed);assert.equal(await personalRows(page).count(),5);
  status=200;await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await ready(page);assert.equal(calls.length,failed+1);
  const beforeNavigation=calls.length;await page.evaluate(()=>showPage('clientes'));await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>document.querySelector('.page.active').id),'page-clientes');assert.equal(calls.length,beforeNavigation);
  await demand(page);await ready(page);assert.equal(calls.length,beforeNavigation+1);await nameAndRender(page);assert.equal(await personalRows(page).count(),5);
  const beforeRetire=calls.length;await page.evaluate(()=>{fbAuth.currentUser={uid:'u',getIdToken:async()=> 'fixture-token'};document.dispatchEvent(new Event('sisventas:session-changed'));renderDashAdministrativo();});
  assert.equal(await personalRows(page).count(),0);assert.equal(await page.locator('#dash-adm-ventas').textContent(),'—');assert.equal(calls.length,beforeRetire);
  console.log(JSON.stringify({width,initialGET:1,mode:packet.mode,count:501,personalKeys:keys,values,globalKeys:deliveries[0].recent.rows.map(r=>r.key),retained503:5,returnGET:1,retired:0,originalBudgetReads:0,totalGET:calls.length}));
 });
});
for(const creator of [false,true])test('final global '+(creator?'seven':'six')+' GETs and no original fallback',opt,async()=>{
 const f=await realBackend(),{session,demand,ready}=harness();
 await session(creator?390:1280,async({page,calls})=>{
  if(creator){for(const domain of ['ventas','pagos','ordenes_trabajo'])await page.route('https://activity.fixture.invalid/commercial/dashboard/'+domain+'/actividad-v2',async route=>{
   calls.push({path:new URL(route.request().url()).pathname,method:route.request().method()});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(await f.readDomain(domain))});
  });}
  else await page.route('https://activity.fixture.invalid'+salePath,async route=>{calls.push({path:salePath,method:route.request().method()});const value=await f.readDomain('ventas');delete value.creatorMonthly;delete value.creatorLatest;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});});
  const marker=await page.evaluate(()=>__moduleAudit.reads.length);await demand(page);await ready(page);
  const packet=await page.evaluate(()=>SVDashboardActivityHost.peek().data);assert.equal(packet.activity.complete,true);assert.equal(packet.salesAuthorMonthlyComplete,creator);assert.equal(packet.salesAuthorLatestComplete,creator);
  assert.equal(calls.length,creator?7:6,JSON.stringify(calls));assert.equal(calls.filter(c=>c.path.includes('/presupuestos/actividad-v2')).length,3);
  const originals=await page.evaluate(marker=>__moduleAudit.reads.slice(marker).filter(r=>r.path==='sisventas/presupuestos'||r.path==='/comerciales/presupuestos'),marker);assert.deepEqual(originals,[]);
  const before=calls.length;await page.evaluate(()=>showPage('venta'));await page.waitForTimeout(250);assert.equal(calls.length,before);
  console.log(JSON.stringify({creator,totalGET:calls.length,salesGET:calls.filter(c=>c.path===salePath).length,budgetGET:3,originalBudgetReads:0,extraVenta:0}));
 });
});
