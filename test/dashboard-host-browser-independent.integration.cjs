'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {start}=require('./fixtures/commercial-full-app.cjs');
const {activitySeed,memoryDb}=require('./helpers/dashboard-budget-activity-fixture.cjs');
const {budget,authFixture,request}=require('./helpers/dashboard-budget-reader-fixture.cjs');
const Reader=require('../cotizador/dashboard-budget-activity-reader-proposal'),Notices=require('../cotizador/dashboard-budget-notice-candidates-proposal'),Policy=require('../cotizador/dashboard-authority-policy-proposal');
const enabled=process.env.SV_DASHBOARD_HOST_BROWSER_QA==='1',opt={skip:!enabled,timeout:60000};
const service='https://dashboard-qa.fixture.invalid';
async function session(width,work){
 const local=await start();let browser;const calls=[],errors=[];
 const state=activitySeed({p:budget({empleado:'Uno'}),other:budget({empleado:'Uno',responsableUid:'v'})});
 state.sv_permisos.vendedor.bloqueados={legacy:'usuarios'};
 const tree=state.sv_dashboard_budget_proposal.v1;tree.coverage.policyHash=tree.policy.hash=Policy.hash({users:state.sv_usuarios,identities:state.sv_chat_roles,permissions:state.sv_permisos});
 const db=memoryDb(state),auth=authFixture('u'),asOfDay=new Intl.DateTimeFormat('en-CA',{timeZone:tree.coverage.activityTimeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const reader=Reader.createActivityReader({auth,db,enabled:true,getAsOfDay:()=>asOfDay,getLegacyContext:()=>({timeZone:tree.coverage.activityTimeZone,sourceLocale:tree.coverage.activitySourceLocale})}),notices=Notices.create({auth,db,enabled:true});
 let status=200,held=false,releases=[];
 try{
  browser=await require('playwright').chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=route.request().url();
   if(url.startsWith(service+'/')){
    calls.push({url,method:route.request().method()});if(held)await new Promise(r=>releases.push(r));
    if(status!==200)return route.fulfill({status,contentType:'application/json',body:'{}'});
    try{const result=url.endsWith('/avisos')?await notices.read(request({url:Notices.ROUTE})):await reader.read(request({url:Reader.ROUTE}));return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});}catch(e){return route.fulfill({status:e.statusCode||500,contentType:'application/json',body:JSON.stringify({error:e.message})});}
   }
   if(!url.startsWith(local.url))return route.abort();
   if(url===local.url+'/'){
    const response=await route.fetch(),headers={...response.headers()};headers['content-security-policy']="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' "+service+"; img-src 'self' data: blob:; font-src 'self' data:; object-src 'none'";
    return route.fulfill({response,headers});
   }
   return route.continue();
  });
  await page.goto(local.url);await page.waitForFunction(()=>document.querySelectorAll('#ventas-tbody tr').length===50);
  assert.equal(await page.evaluate(()=>typeof SVDashboardBudgetHost?.create),'function');assert.equal(await page.evaluate(()=>!!window._svDashboardBudgetHost),false);assert.equal(calls.length,0);
  await page.evaluate(({permissions,service})=>{
   showPage('notificaciones');currentRole='vendedor';currentUserUid='u';currentUser='Uno';fbAuth.currentUser.uid='u';fbAuth.currentUser.getIdToken=async()=> 'fixture-token';PERMISOS_ROLES=permissions;
   window.permisoModulo=()=>true;window.tienePermiso=()=>false;window.fbOnline=true;window.SVConnectionMonitor={canSync:()=>true};window.SVForegroundSession={isVisible:()=>!document.hidden};
   window.SISVENTAS_FUNCTIONS.cotizadorProveedor=service;
   const original=window.fetch;window.fetch=(input,options)=>String(input).startsWith(service)?realFetch(input,options):original(input,options);
   window.SV_DASHBOARD_READS_LOCAL=true;window.SV_BUDGET_NOTICES_LOCAL=true;pptoData=[];
  },{permissions:state.sv_permisos,service});
  console.log('Host browser integration state '+JSON.stringify(await page.evaluate(()=>({authenticated:isAuthenticated,windowAuthenticated:window.isAuthenticated??null,session:obtenerContextoSesionSisVentas(),role:window.currentRole,revision:window.PERMISOS_ROLES?.[currentRole]?.indiceRevision,readinessEpoch:SVDataReadiness.snapshotEpoch(),flags:[SV_DASHBOARD_READS_LOCAL,SV_BUDGET_NOTICES_LOCAL]}))));
  const before=structuredClone(local.backend.state.sisventas);
  await work({page,calls,errors,local,control:{status:v=>{status=v;},hold:()=>{held=true;},release:()=>{held=false;for(const r of releases)r();releases=[];}}});
  assert.deepEqual(local.backend.state.sisventas,before,'Read-only QA cannot mutate originals');
 }finally{held=false;for(const release of releases)release();await browser?.close();await new Promise(r=>local.server.close(r));}
}
const settle=page=>page.waitForTimeout(250);
for(const width of [1280,390])test('actual index and notification callpoint demand once without global budget completeness '+width,opt,()=>session(width,async({page,calls,errors})=>{
 await page.evaluate(()=>svCargarDatosDePaginaActual('notificaciones'));await settle(page);
 assert.equal(calls.length,1);assert(calls.every(c=>c.method==='GET'&&c.url.endsWith('/avisos')));
 const result=await page.evaluate(()=>({complete:_svBudgetNoticeConsumerHost.peek().complete,rows:_svBudgetNoticeConsumerHost.peek().rows?.length,global:pptoData.length,originalReady:SVDataReadiness.status(['presupuestos']).ready,errors:__moduleAudit.errors}));
 assert.equal(result.complete,true,JSON.stringify(result));assert.equal(result.rows,1);assert.equal(result.global,0);
 for(let i=0;i<3;i++)await page.evaluate(()=>{generarNotificaciones();document.dispatchEvent(new Event('sisventas:data-state-changed'));});
 await settle(page);assert.equal(calls.length,1,'render/readiness events must not create polling');assert.deepEqual(errors,[]);
 fs.mkdirSync(path.resolve('tmp/qa-dashboard-444'),{recursive:true});await page.screenshot({path:path.resolve('tmp/qa-dashboard-444/notices-'+width+'.png')});
 console.log(JSON.stringify({width,requests:calls.length,rows:result.rows,pptoData:result.global,originalReady:result.originalReady}));
}));

test('real callpoint preserves notices offline/hidden and retires authority on same-User reset and logout',opt,()=>session(1280,async({page,calls,control})=>{
 await page.evaluate(()=>svCargarDatosDePaginaActual('notificaciones'));const first=calls.length;
 await page.evaluate(()=>{fbOnline=false;dispatchEvent(new Event('offline'));});await settle(page);assert.equal(calls.length,first);assert.equal(await page.evaluate(()=>_svBudgetNoticeConsumerHost.peek().complete),true);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));fbOnline=true;dispatchEvent(new Event('online'));});await settle(page);assert.equal(calls.length,first);assert.equal(await page.evaluate(()=>_svBudgetNoticeConsumerHost.peek().complete),true);
 control.status(503);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await settle(page);
 assert.equal(calls.length,first+1);assert.equal(await page.evaluate(()=>_svBudgetNoticeConsumerHost.peek().complete),true);
 control.status(200);control.hold();await page.evaluate(()=>{SVDataReadiness.reset();document.dispatchEvent(new Event('sisventas:data-state-changed'));});await settle(page);
 assert.equal(await page.evaluate(()=>_svBudgetNoticeConsumerHost.peek().rows),null);control.release();await page.waitForFunction(()=>window._svBudgetNoticeConsumerHost?.peek().complete===true);
 await page.evaluate(()=>{isAuthenticated=false;document.dispatchEvent(new Event('sisventas:session-ended'));});assert.equal(await page.evaluate(()=>!!window._svDashboardBudgetSource),false);assert.equal(await page.evaluate(()=>!!window._svBudgetNoticeConsumerHost),false);
}));

test('real role event retires pending notice delivery before it can publish old authority',opt,()=>session(390,async({page,control})=>{
 control.hold();await page.evaluate(()=>{window.__pendingNoticeQA=svCargarDatosDePaginaActual('notificaciones').catch(()=>false);});
 await page.waitForFunction(()=>!!window._svDashboardBudgetSource);await page.evaluate(()=>{currentRole='distribuidora';document.dispatchEvent(new Event('sisventas:role-changed'));});
 control.release();assert.equal(await page.evaluate(()=>__pendingNoticeQA),false);assert.equal(await page.evaluate(()=>!!window._svDashboardBudgetSource),false);assert.equal(await page.evaluate(()=>pptoData.length),0);
}));
