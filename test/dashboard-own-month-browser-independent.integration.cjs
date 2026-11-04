'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('./dashboard-activity-integrated-browser-independent.integration.cjs'),'utf8');
function harness(legacy=false){
 const helpers=source.slice(0,source.indexOf('for(const width of')).replace("if(corrupt&&pathname.includes('/ventas/'))value.coverage=null;","if(corrupt&&pathname.includes('/ventas/'))value.coverage=null;if(legacy&&pathname.includes('/ventas/'))delete value.creatorMonthly;");
 return new Function('require','__dirname','legacy',helpers+'\nreturn {session,demand,ready,rows};')(require,__dirname,legacy);
}
const transport=fs.readFileSync(require.resolve('./dashboard-sales-creator-month-transport.test.cjs'),'utf8');
const backend=new Function('require','__dirname',transport.slice(0,transport.indexOf("test('real reader delivers"))+'\nreturn backend;')(require,__dirname);
const Pages=require('../cotizador/commercial-pages-model'),Projection=require('../cotizador/commercial-pages-projections'),Activity=require('../cotizador/dashboard-commercial-activity-proposal');
const opt={skip:process.env.SV_ACTIVITY_INTEGRATED_BROWSER_QA!=='1',timeout:60000};
async function personalBackend(){
 const f=await backend('u',511);
 for(const [key,sale]of Object.entries(f.data().sisventas.ventas)){sale.creadaPor=Number(key.slice(1))<501?'u':'v';sale.fecha='2026-11-04';sale.responsableUid='u';}
 const prepared=await Projection.prepare({sales:f.data().sisventas.ventas,payments:f.data().sisventas.pagos,owner:s=>s.responsableUid,generation:'pages-fixture'});f.set(Pages.ROOT,null);f.apply(prepared.patch);
 f.set(Activity.ROOT,null);f.apply((await Activity.build({originals:f.data().sisventas,complete:true,pages:f.read(Pages.ROOT),pagesEvidence:prepared.activitySnapshot,config:f.read('sv_commercial_pages_config'),generation:'personal-browser-activity',timeZone:'America/Argentina/Buenos_Aires',sourceLocale:'es-AR'})).patch);
 return f;
}
for(const width of [1280,390])test('real personal startup501 with only miActividad and ventas own at '+width,opt,async()=>{
 const f=await personalBackend(),{session,demand,ready}=harness();
 await session(width,async({page,calls})=>{
  await page.route('https://activity.fixture.invalid/commercial/dashboard/ventas/actividad-v2',async route=>{
   calls.push({path:new URL(route.request().url()).pathname,method:route.request().method()});
   const response=await f.readDomain('ventas');assert.equal(response.creatorMonthly.count,501);
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
  });
  await page.evaluate(()=>{
   aplicarPermisosRolesGuardados({vendedor:{indiceVersion:2,indiceRevision:7,indiceModulos:{dashboard:true,comisiones:true}}});
   window.permisoModulo=m=>PERMISOS_ROLES[currentRole]?.indiceModulos?.[m]===true;window.tienePermiso=a=>a==='dashboard.miActividad';
   ventasList=Array.from({length:50},(_,i)=>({id:'LOCAL-'+i,creadaPor:'u',fecha:'2026-11-04',total:1,cliente:'Ficticio parcial'}));
  });
  await demand(page);await ready(page);
  const evidence=await page.evaluate(()=>({mode:SVDashboardActivityHost.peek().data.mode,packet:SVDashboardActivityHost.peek().data,grants:SVDashboardHostContext.create(window).capture().grants,kpi:document.getElementById('dash-adm-ventas').textContent,sub:document.getElementById('dash-adm-ventas-sub').textContent,list:document.getElementById('dash-adm-ultventas').textContent,actions:[tienePermiso('dashboard.miActividad'),tienePermiso('dashboard.actividad'),tienePermiso('interfaz.dashboard_admin_only')]}));
  assert.equal(calls.length,1,JSON.stringify(calls));assert(calls[0].path.includes('/ventas/'));assert.equal(evidence.mode,'ownMonthly');assert.equal(evidence.kpi,'501');assert.match(evidence.sub,/501/);
  assert.match(evidence.list,/pendiente/i);assert.doesNotMatch(evidence.list,/Sin ventas/i);assert.deepEqual(evidence.actions,[true,false,false]);
  assert.deepEqual(evidence.grants,{ventas:'own',pagos:null,ordenes_trabajo:null,presupuestos:null});assert.equal(evidence.packet.activity,null);assert.equal(evidence.packet.originalCollectionComplete,false);
  assert.equal(await page.locator('#dash-administrativo-card').isVisible(),true);
  await page.evaluate(()=>{for(let i=0;i<3;i++)renderDashAdministrativo();});await page.waitForTimeout(250);assert.equal(calls.length,1);
  console.log(JSON.stringify({width,requests:calls,grants:evidence.grants,kpi:evidence.kpi,list:evidence.list,mode:evidence.mode}));
 });
});
for(const [legacy,width]of [[true,1280],[false,390]])test('global request bracket with '+(legacy?'legacy':'current')+' creator capability at '+width,opt,async()=>{
 const {session,demand,ready,rows}=harness(legacy);
 await session(width,async({page,calls})=>{
  await demand(page);await ready(page);assert.equal(await rows(page).count(),5);
  const packet=await page.evaluate(()=>SVDashboardActivityHost.peek().data),creator=packet.salesAuthorMonthlyComplete;
  if(legacy)assert.equal(creator,false);
  const counts=Object.fromEntries([...new Set(calls.map(c=>c.path))].map(p=>[p,calls.filter(c=>c.path===p).length]));
  assert.equal(calls.filter(c=>c.path.includes('/presupuestos/actividad-v2')).length,3,'two aggregate B headers plus separate budget Source summary');
  assert.equal(calls.filter(c=>c.path.includes('/ventas/')).length,creator?2:1);assert.equal(calls.length,creator?7:6,JSON.stringify(counts));
  const before=calls.length;await page.evaluate(()=>showPage('venta'));await page.waitForTimeout(300);assert.equal(calls.length,before);
  console.log(JSON.stringify({width,legacy,creatorComplete:creator,initialRequests:counts,total:calls.length,ventaExtra:0}));
 });
});
test('global bracket with real certified501 uses seven GETs including two sales reads',opt,async()=>{
 const f=await personalBackend(),{session,demand,ready}=harness();
 await session(1280,async({page,calls})=>{
  for(const domain of ['ventas','pagos','ordenes_trabajo'])await page.route('https://activity.fixture.invalid/commercial/dashboard/'+domain+'/actividad-v2',async route=>{
   calls.push({path:new URL(route.request().url()).pathname,method:route.request().method()});
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(await f.readDomain(domain))});
  });
  await demand(page);await ready(page);
  const packet=await page.evaluate(()=>SVDashboardActivityHost.peek().data);assert.equal(packet.salesAuthorMonthlyComplete,true);assert.equal(packet.salesAuthorMonthly.count,501);assert.equal(packet.activity.complete,true);
  const counts=Object.fromEntries([...new Set(calls.map(c=>c.path))].map(p=>[p,calls.filter(c=>c.path===p).length]));
  assert.equal(calls.length,7,JSON.stringify(counts));assert.equal(calls.filter(c=>c.path.includes('/ventas/')).length,2);assert.equal(calls.filter(c=>c.path.includes('/presupuestos/actividad-v2')).length,3);
  console.log(JSON.stringify({creatorCount:501,total:calls.length,counts}));
 });
});
