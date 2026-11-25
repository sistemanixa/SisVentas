'use strict';const{test}=require('node:test'),assert=require('node:assert/strict');
const {start}=require('../scripts/dev-purchase-delete-review.cjs');
// The isolated review server extracts the actual delete handler; supply its new
// pure UI classifier as a real source dependency, preserving every assertion.
const purchaseSource=require('node:fs').readFileSync(require('node:path').join(__dirname,'../js/modules/purchase-orders.js'),'utf8');
const classifyStart=purchaseSource.indexOf('  function orderDeleteAction('),classifyEnd=purchaseSource.indexOf('  async function deleteActiveOrder(',classifyStart);
const classifySource=purchaseSource.slice(classifyStart,classifyEnd);

let chromium;try{chromium=require('playwright').chromium;}catch{}
for(const width of [390,1280])test('borrado aislado con controlador y transporte reales '+width,{skip:!chromium,timeout:30000},async()=>{
 const orders={draft:{numero:'OC-TEST-49',estado:'borrador',origen:'manual',items:[{productoKey:'p',codigo:'P',cantidadOrdenada:2,cantidadRecibida:0}]},received:{numero:'OC-TEST-48',estado:'recibida',origen:'manual',items:[{productoKey:'p',codigo:'P',cantidadOrdenada:2,cantidadRecibida:2}]}};
 const inventory={general:2,reservado:0,enCompra:2,consumido:0,costoReferenciaStock:{unit:50,order:'received'}};
 const local=await start({orders,orderKey:'draft',protectedOrderKey:'received',inventoryByKey:{p:inventory}});let browser;
 try{browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const page=await browser.newPage({viewport:{width,height:900}});await page.addInitScript({content:classifySource+'\nwindow.orderDeleteAction=orderDeleteAction;'});const outside=[];await page.route('**/*',route=>{if(!route.request().url().startsWith(local.url)){outside.push(route.request().url());return route.abort();}return route.continue();});await page.goto(local.url);await page.getByRole('heading',{name:'OC-TEST-49',exact:true}).waitFor();assert.match(await page.locator('header').textContent(),/COPIA LOCAL AISLADA/);
 page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Eliminar borrador de la copia',exact:true}).click();await page.getByText('Eliminada únicamente de la copia',{exact:true}).waitFor();assert.equal(await page.locator('#physical').textContent(),'2');assert.equal(await page.locator('#pending').textContent(),'0');assert.equal(await page.locator('#protected').textContent(),'OC-TEST-48 · recibida');assert.equal(local.backend.get('sisventas/ordenes/draft'),null);assert.deepEqual(local.backend.get('sisventas/ordenes/received'),orders.received);assert.equal(local.backend.commits.length,1);assert.equal(local.backend.direct.length,0);assert.deepEqual(outside,[]);
 }finally{await browser?.close();await local.close();}
});
