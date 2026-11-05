'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright'),{start}=require('./fixtures/commercial-full-app.cjs'),{apply}=require('./helpers/labor-ui-flow.cjs');
async function session(width,work){const local=await start();let browser;const records=['old','next','third'].map(key=>({fbKey:key,id:'OT-'+key,cliente:'Ficticio',estado:'pendiente',materiales:[],...(key==='old'?{}:{ventaFbKey:'fixture0'})}));apply(local.backend.state,{'sisventas/ordenes_trabajo':Object.fromEntries(records.map(({fbKey,...record})=>[fbKey,record]))});const before=structuredClone(local.backend.state.sisventas);
 try{browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(6000);await page.route('**/*',route=>route.request().url().startsWith(local.url)?route.continue():route.abort());await page.goto(local.url);await page.waitForFunction(()=>document.querySelectorAll('#ventas-tbody tr').length===50);await page.evaluate(async rows=>{__moduleAuditSourceControl.release('productos');__moduleAuditSourceControl.release('empleados');const prepare=_svPrepararVistaModulo,back=volverListaOT;window.__entryOT=[];window.__otTrace=[];volverListaOT=function(){__otTrace.push({event:'back',before:otActualId,token:verOT._svAperturaToken,stack:new Error().stack});return back.apply(this,arguments);};_svPrepararVistaModulo=function(id,delay,fn){return prepare(id,delay,id==='ordentrabajo'?()=>__entryOT.push(fn):fn);};showPage('ordentrabajo');svDetenerLecturaOTs();otData=rows;await verOT('old');const original=SVOTSaleOrigin;window.__releaseOT={};SVOTSaleOrigin={...original,open:async ot=>{await new Promise(resolve=>{__releaseOT[ot.fbKey]=resolve;});return original.open(ot);}};},records);await page.waitForFunction(()=>__entryOT.length>0);await page.evaluate(()=>verOT('old'));assert.equal(await page.locator('#ot-det-num').textContent(),'OT-old');assert.equal(await page.locator('#ot-detalle-view').evaluate(element=>element.inert),false);await work(page);assert.equal(local.backend.commits.length,0);assert.equal(local.backend.commands.length,0);assert.deepEqual(local.backend.state.sisventas,before);
 }finally{if(browser){for(const context of browser.contexts())for(const page of context.pages())await page.evaluate(()=>{Object.values(window.__releaseOT||{}).forEach(release=>release());window.__moduleAuditSourceControl?.clear();}).catch(()=>{});await browser.close();}local.server.closeAllConnections();await new Promise(resolve=>local.server.close(resolve));}}

for(const width of [390,1280])for(const late of [false,true])test('controlled OT entry '+width+' late='+late,{timeout:20000},()=>session(width,async page=>{
 if(!late)await page.evaluate(async()=>{__entryOT.shift()();await verOT('old');});
 await page.evaluate(()=>{window.__nextOT=verOT('next');});
 assert.equal(await page.evaluate(()=>otActualId),'old');
 if(late)await page.evaluate(()=>__entryOT.shift()());
 assert.equal(await page.locator('#ot-detalle-view').evaluate(el=>el.inert&&el.style.display==='none'),true);
 const state=await page.evaluate(()=>({id:otActualId,trace:__otTrace}));console.log(JSON.stringify({width,late,...state}));assert.equal(state.id,'old');
 await page.evaluate(()=>__releaseOT.next());await page.evaluate(()=>__nextOT);assert.equal(await page.locator('#ot-det-num').textContent(),'OT-next');
}));

for(const width of [390,1280])test('normal OT entry and explicit return remain effective '+width,{timeout:20000},()=>session(width,async page=>{
 await page.evaluate(()=>__entryOT.shift()());
 await page.evaluate(async()=>{await verOT('old');volverDesdeDetalleOT();});
 assert.equal(await page.evaluate(()=>otActualId),null);
 assert.equal(await page.locator('#ot-list-view').evaluate(el=>el.style.display),'block');
 await page.evaluate(async()=>{await verOT('old');showPage('ordentrabajo');});
 await page.waitForFunction(()=>__entryOT.length>0);
 await page.evaluate(()=>__entryOT.shift()());
 assert.equal(await page.evaluate(()=>otActualId),null);
 assert.equal(await page.locator('#ot-detalle-view').evaluate(el=>el.style.display),'none');
}));
for(const width of [390,1280])test('old OT entry callback cannot reset state after navigation '+width,{timeout:20000},()=>session(width,async page=>{
 await page.evaluate(()=>showPage('dashboard'));
 const before=await page.evaluate(()=>({id:otActualId,calls:__otTrace.length}));
 await page.evaluate(()=>__entryOT.shift()());
 assert.deepEqual(await page.evaluate(()=>({id:otActualId,calls:__otTrace.length})),before);
 assert.equal(await page.evaluate(()=>_svPaginaDesdeRuta()),'dashboard');
}));
