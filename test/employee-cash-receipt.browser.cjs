'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {functionSource}=require('./helpers/app-functions.cjs');
for(const width of [390,768,1280])test('cash receipt hydrated history and preview '+width,{skip:!process.env.SV_TEST_CHROME,timeout:60000},async t=>{
 const browser=await require('playwright').chromium.launch({headless:true,executablePath:process.env.SV_TEST_CHROME});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width,height:900}});const network=[];await page.route('**/*',r=>{network.push(r.request().url());return r.abort();});
 await page.setContent('<style>body{background:#101b2e;color:white;font:14px Arial}#modal-hist-pago-gasto{max-width:800px;padding:12px}button{padding:9px}#hpg-body>div{flex-wrap:wrap}#hpg-body>div>div:last-child{flex-wrap:wrap}</style><div id="modal-hist-pago-gasto" style="display:none"><h2 id="hpg-titulo"></h2><div id="hpg-body"></div></div>');
 await page.evaluate(()=>{
  window.currentUserUid='fiction';window.fbAuth={currentUser:{uid:'fiction'}};window.fbDB={};window.writes=0;window.reads=0;window.prints=0;
  window.gastosData=[{fbKey:'fiction',empleadoId:'e',empleadoNombre:'Persona ficticia',descripcion:'Haber ficticio',fotoAdjunta:true,pagos:{a:{medio:'Efectivo',monto:192000,fecha:'2026-11-05'},b:{medio:'Transferencia',monto:594000,fecha:'2026-11-06'},c:{medio:'Efectivo',monto:594000,fecha:'2026-11-06'}}}];
  window.before=JSON.stringify(gastosData);window.empData={e:{id:'e',nombre:'Persona ficticia'}};window.puedeAdministrarGastos=()=>true;window.tienePermiso=()=>false;window.escapeHTML=String;window.svDescripcionMovimientoVisible=g=>g.descripcion;window.pagoGastoEstaAnulado=p=>!!p.anulado;window._normalizarComprobantePagoGasto=()=>null;window.svNombreAutorPago=()=> 'Usuario ficticio';
  window._gastoPagosArray=g=>Object.entries(g.pagos).map(([key,p])=>({...p,_key:key}));window.fbRef=(_,p)=>p;window.fbGet=async()=>{reads++;return {val:()=>gastosData[0]};};window.fbUpdate=()=>{writes++;throw Error('No write allowed');};window.notify=message=>{throw Error(message);};
 });
 await page.addScriptTag({content:functionSource('verPagosGasto')});
 await page.evaluate(()=>{const original=verPagosGasto;window.verPagosGasto=key=>new Promise(resolve=>{window.finishDetail=()=>{original(key);resolve('hydrated');};});});
 await page.addScriptTag({content:fs.readFileSync(require.resolve('../js/modules/employee-cash-receipt.js'),'utf8')});
 await page.evaluate(()=>{window.pending=verPagosGasto('fiction');});assert.equal(await page.getByRole('button',{name:'Imprimir recibo',exact:true}).count(),0);
 await page.evaluate(async()=>{finishDetail();await pending;});assert.equal(await page.getByRole('button',{name:'Imprimir recibo',exact:true}).count(),2);
 const rows=page.locator('#hpg-body > div');assert.equal(await rows.count(),4);assert.equal(await rows.nth(0).getByRole('button',{name:'Imprimir recibo',exact:true}).count(),0);assert.equal(await rows.nth(2).getByRole('button',{name:'Imprimir recibo',exact:true}).count(),0);
 await page.getByRole('button',{name:'Imprimir recibo',exact:true}).nth(1).click();await page.locator('#employee-cash-receipt').waitFor({state:'visible'});
 const frame=page.frameLocator('#employee-cash-receipt iframe');await frame.getByText('Importe recibido:',{exact:false}).waitFor();assert.match(await frame.locator('body').innerText(),/594\.000,00/);assert.match(await frame.locator('body').innerText(),/Firma de quien recibe/);assert.doesNotMatch(await frame.locator('body').innerText(),/192\.000,00/);
 await page.evaluate(()=>{SVPrintLayout={ready:async()=>{document.querySelector('#employee-cash-receipt iframe').contentWindow.print=()=>{prints++;};}};});
 await page.getByRole('button',{name:'Imprimir / Guardar PDF',exact:true}).click();await page.getByText('Podés imprimir o elegir Guardar como PDF en el diálogo de impresión.').waitFor();
 assert.deepEqual(await page.evaluate(()=>({writes,prints,reads,unchanged:before===JSON.stringify(gastosData)})),{writes:0,prints:1,reads:2,unchanged:true});assert.deepEqual(network,[]);
 if(process.env.SV_QA_OUTPUT){fs.mkdirSync(process.env.SV_QA_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.SV_QA_OUTPUT,'cash-receipt-'+width+'.png')});}
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();assert.equal(await page.locator('#employee-cash-receipt').count(),0);
});
