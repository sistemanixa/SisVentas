'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright'),{start}=require('./fixtures/commercial-full-app.cjs'),{readActiveApp}=require('./helpers/active-app');
const evidence=process.env.SV_PHOTO_UI_EVIDENCE_DIR;
if(evidence&&!path.isAbsolute(evidence))throw Error('Evidence directory must be absolute');
async function formState(page,selector){return page.locator(selector).evaluate(node=>Array.from(node.querySelectorAll('input,select,textarea')).map(el=>({id:el.id,cls:el.className,value:el.value,checked:el.checked})));}
for(const width of [390,1280])for(const domain of ['sale','budget'])test('real product photo control and return preserve '+domain+' form '+width,{timeout:45000},async()=>{
 const local=await start({count:3});let browser,page;const blocked=[],errors=[],steps=[];
 const budget={id:'PP-PHOTO-FICTION',cliente:'Cliente ficticio',clienteFbKey:'c',responsableUid:'u',fecha:'2026-11-04',estado:'enviado',conIva:false,subtotal:1600,total:1600,descuento:0,descuentoAmt:0,iva:0,items:structuredClone(local.backend.get('sisventas/ventas/fixture0/items'))};
 if(domain==='budget')await local.backend.guard.run({uid:'sv-labor-service',mode:'server',operation:'fixture-budget-seed'},scope=>scope.update({'sisventas/presupuestos/photo-fixture':budget}));
 const before=structuredClone(local.backend.state),commits=local.backend.commits.length,commands=local.backend.commands.length;
 const prefix=domain+'-'+width;
 async function snap(name){steps.push(name);if(evidence){fs.mkdirSync(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,prefix+'-'+name+'.png'),fullPage:false});}}
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.SV_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin!==new URL(local.url).origin){blocked.push(url.origin+url.pathname);return route.abort();}if(req.method()!=='GET'&&req.method()!=='OPTIONS'&&url.pathname!=='/laboral/capacidades'){blocked.push(req.method()+' '+url.pathname);return route.abort();}if(url.pathname==='/comerciales/presupuestos/registro/photo-fixture')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,record:{...budget,fbKey:'photo-fixture'}})});return route.continue();});
  await page.goto(local.url);await page.locator('#ventas-tbody tr').nth(2).waitFor();
  await page.evaluate(()=>{__moduleAuditSourceControl.release('productos');__moduleAuditSourceControl.release('empleados');fbCargarProductos();fbCargarEmpleados();});
  await page.waitForFunction(()=>SVDataReadiness.status(['productos','empleados']).ready);
  if(domain==='sale'){await page.locator('#ventas-tbody tr').first().click();await page.locator('#venta-detalle-view tr[data-venta-item-index]').nth(15).waitFor();}
  else {await page.evaluate(()=>showPage('presupuesto'));await page.locator('#ppto-tbody-main tr').filter({hasText:'PP-PHOTO-FICTION'}).first().click();await page.locator('#ppto-det-items tr[data-ppto-item-index]').nth(15).waitFor();}
  const detail=domain==='sale'?'#venta-detalle-view':'#ppto-detalle-view';
  const photo=page.locator(detail+' tr[data-'+(domain==='sale'?'venta':'ppto')+'-item-index="0"] img.item-prod-img');
  await photo.scrollIntoViewIfNeeded();await page.waitForFunction(sel=>{const img=document.querySelector(sel);return img?.complete&&img.naturalWidth>0;},detail+' tr[data-'+(domain==='sale'?'venta':'ppto')+'-item-index="0"] img.item-prod-img');
  await snap('detail-photo');await photo.click();await page.locator('#prod-detail-view').waitFor({state:'visible'});await page.waitForFunction(()=>document.getElementById('pd-imagen-img')?.naturalWidth>0);await snap('product-detail');
  assert.equal(await page.locator('#modal-ver-foto-ot').isVisible(),false,'thumbnail opens product, not gallery modal');
  assert.match(await page.locator('#pd-codigo-lbl').innerText(),/P-0/);
  await page.locator('#prod-detail-view button[onclick="cerrarDetalleProducto()"]' ).click();await page.locator(detail).waitFor({state:'visible'});await snap('detail-return');
  await page.locator(detail+' button[onclick*="'+(domain==='sale'?'abrirEditorVenta':'abrirEditorPpto')+'"]').click();
  const form=domain==='sale'?'#page-venta':'#ppto-form-view',body=domain==='sale'?'#det-body':'#pp-body';await page.locator(form).waitFor({state:'visible'});await page.locator(body+' tr').nth(15).waitFor();
  const qty=page.locator(body+' tr').first().locator('input.qty');await qty.fill('2');await qty.dispatchEvent('change');
  const state=await formState(page,form);await snap('unsaved-form');
  const formPhoto=page.locator(body+' tr').first().locator('.item-prod-nav img');await formPhoto.click();await page.locator('#prod-detail-view').waitFor({state:'visible'});await page.waitForFunction(()=>document.getElementById('pd-imagen-img')?.naturalWidth>0);
  await snap('from-unsaved-form');await page.locator('#prod-detail-view button[onclick="cerrarDetalleProducto()"]' ).click();await page.locator(form).waitFor({state:'visible'});
  assert.deepEqual(await formState(page,form),state,'all unsaved form fields preserved');assert.equal(await qty.inputValue(),'2');assert.equal(await page.locator('#modal-ver-foto-ot').isVisible(),false);await snap('unsaved-form-return');
  assert.equal(local.backend.commands.length,commands);assert.equal(local.backend.commits.length,commits);assert.deepEqual(local.backend.state,before);assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);
  if(evidence)fs.writeFileSync(path.join(evidence,prefix+'.json'),JSON.stringify({width,domain,activeApp:readActiveApp().filename,testSha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),steps,visibleEntry:'product item thumbnail -> product detail -> Volver',galleryOpened:false,unsavedFormPreserved:true,commitsAfterSeed:0,commands:0,originalsUnchanged:true,blocked,errors},null,2));
 }catch(error){if(page&&evidence){await snap('failure').catch(()=>{});const diagnostic=await page.evaluate(()=>({hash:location.hash,notes:window.__moduleAudit?.notes,errors:window.__moduleAudit?.errors,active:document.querySelector('.page.active')?.id})).catch(()=>({}));console.log(JSON.stringify(diagnostic));}throw error;}
 finally{await browser?.close();await new Promise(resolve=>{local.server.close(resolve);local.server.closeAllConnections();});}
});
