'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright'),{start}=require('./fixtures/commercial-full-app.cjs');
const {createCommercialOwnership}=require('../cotizador/commercial-ownership'),{create}=require('../cotizador/commercial-sale-payments');
for(const width of [390,1280])test('complete active app shows the existing global payment without opening collections '+width,{timeout:30000},async()=>{
 const local=await start({count:2,paymentAmount:1600});let browser,release;
 try{
  local.backend.state.sv_usuarios={u:{uid:'u',nombre:'Persona ficticia',rol:'admin',activo:true}};
  local.backend.state.sv_chat_directorio={u:{nombre:'Persona ficticia'}};
  local.backend.state.sisventas.ventas.fixture0.totalPagado=1600;
  local.backend.state.sisventas.pagos.payment0.nota='<img src=x> Nota ficticia';
  const db={ref:path=>({get:async()=>({val:()=>local.backend.get(path)})})},ownership=createCommercialOwnership({db,auth:{verifyIdToken:async(token,revoked)=>{assert.equal(token,'FICTICIO-SIN-VALIDEZ');assert.equal(revoked,true);return{uid:'u'};}},enabled:true,readAsUser:(path,actor)=>local.backend.store.readAsUser(path,actor)}),service=create({ownership,store:local.backend.store});
  // Notes do not affect membership; all original references remain indexed.
  const before=structuredClone(local.backend.state),requests=[];let began;const started=new Promise(r=>began=r),held=new Promise(r=>release=r);let failOnce=width===390;
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});page.setDefaultTimeout(8000);
  await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin!==new URL(local.url).origin)return route.abort();
   if(url.pathname==='/comerciales/ventas/registro/fixture0'&&url.searchParams.get('para')==='pagos'){
    requests.push(req.method());assert.equal(req.method(),'GET');began();await held;
    if(failOnce){failOnce=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,mensaje:'Fallo ficticio de lectura'})});}
    const request={method:'GET',url:url.pathname+url.search,headers:{authorization:req.headers().authorization}},actor=await ownership.authorize(request,'ventas'),record=(await ownership.readAuthorizedRecordsByIds(actor,'ventas',['fixture0'])).fixture0,result=await service.load({req:request,actor,saleKey:'fixture0',record});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,...result,record:{...result.record,fbKey:'fixture0'}})});
   }return route.continue();});
  await page.goto(local.url);await page.locator('#ventas-tbody tr').nth(1).waitFor();
  await page.locator('#ventas-tbody tr').filter({hasText:'V-FIXTURE-0'}).click();await started;
  const history=page.locator('#venta-detalle-pagos');await page.locator('#venta-detalle-view').getByText('Abriendo venta…',{exact:false}).waitFor();assert.equal(await history.getByText('Sin pagos registrados',{exact:true}).count(),0);assert.equal(await history.getByRole('button',{name:'Registrar pago',exact:false}).count(),0);
  release();release=null;
  if(width===390){await page.locator('#venta-detalle-view').getByText('No se pudo abrir la venta. Volvé a intentarlo.',{exact:true}).waitFor();assert.equal(await history.getByText('Sin pagos registrados',{exact:true}).count(),0);assert.equal(requests.length,1);await page.locator('#venta-detalle-view').getByRole('button',{name:'Volver',exact:true}).click();await page.locator('#ventas-tbody tr').filter({hasText:'V-FIXTURE-0'}).click();}
  await history.locator('[data-sale-payment]').waitFor();await history.scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.getElementById('venta-detalle-pagos').innerText.includes('1.600'));assert.match(await history.innerText(),/1\.600/);assert.match(await history.innerText(),/Transferencia/);assert.equal(await history.locator('img[src="x"]').count(),0);assert.match(await history.innerText(),/<img src=x> Nota ficticia/);assert.equal(await history.getByText('Saldo cancelado',{exact:false}).count(),1);
  await page.evaluate(()=>{document.documentElement.classList.add('dark-mode');document.body.classList.add('dark-mode');});await history.scrollIntoViewIfNeeded();
  await page.screenshot({path:'C:/SisVentas/tmp/sale-payment-history18-'+width+'.private.png'});assert.equal(requests.length,width===390?2:1);assert.equal(local.backend.commands.length,0);assert.equal(local.backend.commits.length,0);assert.deepEqual(local.backend.state,before);
 }finally{release?.();await browser?.close();local.server.closeAllConnections();await new Promise(r=>local.server.close(r));}
});
