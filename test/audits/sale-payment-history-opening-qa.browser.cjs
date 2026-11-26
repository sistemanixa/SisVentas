'use strict';
// Full active index/app19; only SDK/Auth/HTTP test boundaries are substituted.
// No product changes. Final assertion deliberately specifies the desired single
// original read and reproduces redundant SDK base + HTTP history on published19.
const {test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright'),{start}=require('../fixtures/commercial-full-app.cjs'),{createCommercialOwnership}=require('../../cotizador/commercial-ownership'),{create}=require('../../cotizador/commercial-sale-payments');
for(const width of [390,1280])test('one detail opening should fetch its fresh original once including payment history '+width,{timeout:30000},async t=>{
 const local=await start({count:2,paymentAmount:1600});let browser,release;const requests=[];let stage='boot';
 try{
  local.backend.state.sv_usuarios={u:{uid:'u',nombre:'Persona ficticia',rol:'admin',activo:true}};local.backend.state.sv_chat_directorio={u:{nombre:'Persona ficticia'}};local.backend.state.sisventas.ventas.fixture0.totalPagado=1600;
  const db={ref:path=>({get:async()=>({val:()=>local.backend.get(path)})})},ownership=createCommercialOwnership({db,auth:{verifyIdToken:async(token,revoked)=>{assert.equal(token,'FICTICIO-SIN-VALIDEZ');assert.equal(revoked,true);return{uid:'u'};}},enabled:true,readAsUser:(path,actor)=>local.backend.store.readAsUser(path,actor)}),service=create({ownership,store:local.backend.store}),before=structuredClone(local.backend.state);
  let began;const started=new Promise(r=>began=r),held=new Promise(r=>release=r);
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});page.setDefaultTimeout(8000);
  await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin!==new URL(local.url).origin)return route.abort();
   if(url.pathname.startsWith('/comerciales/'))requests.push({stage,method:req.method(),path:url.pathname,query:url.search});
   if(url.pathname==='/comerciales/ventas/registro/fixture0'){
    assert.equal(req.method(),'GET');const request={method:'GET',url:url.pathname+url.search,headers:{authorization:req.headers().authorization}},actor=await ownership.authorize(request,'ventas'),record=(await ownership.readAuthorizedRecordsByIds(actor,'ventas',['fixture0'])).fixture0;
    if(url.searchParams.get('para')==='pagos'){began();await held;const result=await service.load({req:request,actor,saleKey:'fixture0',record});return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,...result,record:{...result.record,fbKey:'fixture0'}})});}
    return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,record:{...record,fbKey:'fixture0'}})});
   }return route.continue();});
  await page.goto(local.url);await page.locator('#ventas-tbody tr').nth(1).waitFor();
  await page.evaluate(()=>{window.__paymentQA={renders:0};const original=window.renderDetalleVenta;window.renderDetalleVenta=function(...args){__paymentQA.renders++;return original.apply(this,args);};});
  stage='open';local.setPhase(stage);await page.locator('#ventas-tbody tr').filter({hasText:'V-FIXTURE-0'}).click();await started;
  const pending=await page.evaluate(()=>({state:_svVentaPaymentHistoryReader.state(_ventaDetalleActual),selected:_ventaDetalleActual?.fbKey||null,opening:document.getElementById('venta-detalle-view').getAttribute('aria-busy'),renders:__paymentQA.renders,source:SVDataReadiness.status(['salePaymentHistory']),embedded:_ventaDetalleActual?.pagos||null}));
  assert.equal(pending.state.status,'idle');assert.equal(pending.selected,null);assert.equal(pending.opening,'true');assert.equal(await page.locator('#venta-detalle-pagos').getByText('Sin pagos registrados',{exact:true}).count(),0);
  await page.evaluate(()=>document.dispatchEvent(new Event('sisventas:labor-write-recovery')));assert.equal(requests.filter(r=>r.query==='?para=pagos').length,1);
  stage='fresh';release();release=null;await page.locator('#venta-detalle-pagos [data-sale-payment]').waitFor();
  const fresh=await page.evaluate(()=>({state:_svVentaPaymentHistoryReader.state(_ventaDetalleActual),renders:__paymentQA.renders,source:SVDataReadiness.status(['salePaymentHistory'])}));assert.equal(fresh.state.source,'global');assert.equal(fresh.state.paidAmount,1600);assert.equal(fresh.state.payments.length,1);
  stage='repaint';await page.evaluate(()=>{for(let i=0;i<3;i++)renderDetalleVenta(_ventaDetalleActual);});assert.equal(requests.filter(r=>r.query==='?para=pagos').length,1);
  assert.equal(local.backend.commands.length,0);assert.equal(local.backend.commits.length,0);assert.deepEqual(local.backend.state,before);
  const subscriptions=await page.evaluate(()=>__moduleAudit.subscriptions.map(s=>({path:s.path,active:s.active})));assert.equal(subscriptions.filter(s=>/^sisventas\/pagos(?:\/|$)/.test(s.path)).length,0);
  const pointReads=requests.filter(r=>r.path==='/comerciales/ventas/registro/fixture0'),sdkOriginalReads=local.measures.filter(m=>m.phase==='open'&&m.source==='sisventas/ventas/fixture0'),originalReads=pointReads.length+sdkOriginalReads.length;t.diagnostic(JSON.stringify({width,pending,fresh,requests,httpOriginalReads:pointReads.length,sdkOriginalReads:sdkOriginalReads.length,totalOriginalReads:originalReads,subscriptions,sdkReads:local.measures.filter(m=>m.source&&m.phase!=='boot').map(m=>({phase:m.phase,source:m.source})),commands:0,commits:0}));
  assert.equal(originalReads,1,'Opening should reuse the authenticated fresh record returned with paymentHistory instead of separate base + history GETs');
 }finally{release?.();await browser?.close();local.server.closeAllConnections();await new Promise(r=>local.server.close(r));}
});
