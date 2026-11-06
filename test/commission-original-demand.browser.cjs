'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {start}=require('./fixtures/commercial-full-app.cjs');
const enabled=process.env.SV_COMMISSION_QA==='1',output=process.env.SV_QA_OUTPUT;
const meta={schema:1,ventaFbKey:'qa-sale',neto:2217805.24,costo:1284833.79,costoManoObra:405000,ganancia:932971.45,pct:15,monto:139945.72};
const expense={fbKey:'qa-expense',tipoPagable:'comision',ventaId:'V-QA-FICTION',ventaFbKey:'qa-sale',empleadoFbKey:'e',empleadoNombre:'Persona ficticia',cliente:'Cliente ficticio',gananciaBase:meta.ganancia,pct:meta.pct,monto:meta.monto,estado:'pendiente_pago',aprobadoPor:'Admin ficticio',aprobadoTs:1,baseComisionAjustada:meta};
const sale={fbKey:'qa-sale',id:'V-QA-FICTION',cliente:'Cliente ficticio',items:[{cod:'QA',desc:'Producto ficticio',qty:1,punit:meta.neto,sub:meta.neto,costoTotalCompra:meta.costo}],subtotal:meta.neto,total:meta.neto,descuento:0,descuentoGeneral:0,iva:0,conIva:false};
async function create(t,width){
 assert(output&&process.env.SV_TEST_CHROME,'explicit private output and Chrome required');fs.mkdirSync(output,{recursive:true});
 const f=await start({accountsRollout:false,count:1});f.backend.state.sisventas.gastos={'qa-expense':structuredClone(expense)};f.backend.state.sisventas.ventas={};f.backend.state.sv_commercial_pages_config.ready=false;f.backend.state.sv_commercial_pages_config.searchReady=false;
 const business=JSON.stringify(f.backend.state.sisventas),requests=[],external=[],posts=[],errors=[];let mode='ok',release;
 const original=f.server.listeners('request')[0];f.server.removeAllListeners('request');
 f.server.on('request',(req,res)=>{
  const url=new URL(req.url,'http://fixture');
  if(url.pathname==='/comerciales/ventas/registro/qa-sale'){
   requests.push({method:req.method,path:url.pathname});assert.equal(req.method,'GET');
   const respond=()=>{if(res.destroyed)return;res.setHeader('Content-Type','application/json');if(mode==='error'){res.writeHead(503);res.end(JSON.stringify({ok:false,mensaje:'Error ficticio al consultar original'}));}else res.end(JSON.stringify({ok:true,record:sale}));};
   if(mode==='hold')release=respond;else respond();return;
  }
  const end=res.end.bind(res);res.end=(chunk,...args)=>{
   if(typeof chunk==='string'&&url.pathname==='/fixture-bootstrap.js')chunk+='\nfixtureRoot.sisventas.gastos='+JSON.stringify({'qa-expense':expense})+';fixtureRoot.sisventas.ventas={};__moduleAuditSourceControl.hold(["ventas","pagos"]);fixtureRoot.sv_commercial_pages_config.ready=false;fixtureRoot.sv_commercial_pages_config.searchReady=false;';
   if(typeof chunk==='string'&&url.pathname==='/fixture-start.js')chunk=chunk.replace("showPage('detalle');svCargarDatosDePaginaActual('detalle');","showPage('comisiones');svCargarDatosDePaginaActual('comisiones');");
   return end(chunk,...args);
  };return original(req,res);
 });
 const browser=await require('playwright').chromium.launch({headless:true,executablePath:process.env.SV_TEST_CHROME});
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
 await context.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(u.origin!==new URL(f.url).origin&&!['data:','blob:','about:'].includes(u.protocol)){external.push(u.origin+u.pathname);return route.abort();}if(r.method()!=='GET'&&!u.pathname.endsWith('/laboral/capacidades')){posts.push(u.pathname);return route.abort();}return route.continue();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 t.after(async()=>{release?.();const state=await page.evaluate(()=>({writes:__moduleAudit.writes,expenses:gastosData,values:ventasList.length})).catch(()=>null);await browser.close();await new Promise(r=>{f.server.close(r);f.server.closeAllConnections();});assert.deepEqual(state?.writes,[]);assert.equal(state?.values,0);assert.deepEqual(posts,[]);assert.deepEqual(external,[]);assert.equal(f.backend.commits.length,0);assert.equal(f.backend.commands.length,0);assert.equal(JSON.stringify(f.backend.state.sisventas),business);assert.deepEqual(errors,[]);});
 await page.goto(f.url,{waitUntil:'domcontentloaded'});await page.evaluate(()=>{__moduleAuditSourceControl.release('empleados');__moduleAuditSourceControl.release('productos');document.body.classList.add('dark-mode');document.documentElement.classList.add('dark-mode');});await page.waitForFunction(()=>document.querySelector('#page-comisiones.active')&&(window.gastosData||[]).some(g=>g.fbKey==='qa-expense'));
 await page.screenshot({path:path.join(output,'cold-'+width+'.png')});assert.equal(await page.evaluate(()=>ventasList.length),0);
 const baseline=await page.evaluate(()=>JSON.stringify(gastosData.find(g=>g.fbKey==='qa-expense')));
 return {page,requests,mode:v=>{mode=v;},release:()=>release?.(),async unchanged(){assert.equal(await page.evaluate(()=>JSON.stringify(gastosData.find(g=>g.fbKey==='qa-expense'))),baseline);assert.equal(await page.evaluate(()=>ventasList.length),0);},async open(){await page.getByText('V-QA-FICTION',{exact:true}).click();},async ready(){await page.locator('#com-det-info').getByText('COSTO DE CÁLCULO',{exact:true}).waitFor();},async screen(label){await page.screenshot({path:path.join(output,label+'-'+width+'.png'),fullPage:false});}};
}
for(const width of [390,1280]){
 test('cold commission original and adjusted snapshot survive reopen '+width,{skip:!enabled,timeout:60000},async t=>{
  const x=await create(t,width),p=x.page;for(let i=0;i<2;i++){
   await x.open();await x.ready();const info=await p.locator('#com-det-info').innerText();for(const text of ['2.217.805,24','1.284.833,79','932.971,45','139.945,72','405.000'])assert(info.includes(text),text+' in '+info);
   assert.equal(await p.locator('.comision-pct-input').inputValue(),'15');assert.match(await p.locator('.comision-monto-preview').innerText(),/139\.945,72/);await x.unchanged();await x.screen('snapshot-'+i);await p.locator('#modal-comision-gestion').getByRole('button',{name:'Cerrar',exact:true}).click();await p.locator('#modal-comision-gestion').waitFor({state:'hidden'});
  }assert.equal(x.requests.length,2);await x.open();await x.ready();await p.evaluate(()=>{fbAuth.currentUser=null;document.dispatchEvent(new Event('sisventas:session-ended'));});await p.locator('#modal-comision-gestion').waitFor({state:'hidden'});assert.equal(await p.locator('#com-det-info').innerText(),'');
 });
 test('original error cannot become zero financial summary and retry recovers '+width,{skip:!enabled,timeout:60000},async t=>{
  const x=await create(t,width),p=x.page;x.mode('error');await x.open();await p.locator('#com-det-info').getByText(/Error ficticio al consultar original/).waitFor();assert(await p.locator('#com-det-guardar').isDisabled());assert.doesNotMatch(await p.locator('#com-det-info').innerText(),/VENTA NETA|COSTO DE CÁLCULO/);await x.unchanged();await x.screen('error');await p.locator('#modal-comision-gestion').getByRole('button',{name:'Cerrar',exact:true}).click();x.mode('ok');await x.open();await x.ready();assert.equal(x.requests.length,2);await x.unchanged();
 });
 test('revoked auth retires delayed original without financial repaint '+width,{skip:!enabled,timeout:60000},async t=>{
  const x=await create(t,width),p=x.page;x.mode('hold');await x.open();await p.waitForFunction(()=>document.querySelector('#com-det-info').textContent.includes('Cargando'));while(!x.requests.length)await p.waitForTimeout(20);assert(await p.locator('#com-det-guardar').isDisabled());await p.evaluate(()=>{fbAuth.currentUser=null;document.dispatchEvent(new Event('sisventas:session-ended'));});x.release();await p.locator('#modal-comision-gestion').waitFor({state:'hidden'});await p.waitForTimeout(150);assert.equal(await p.locator('#com-det-info').innerText(),'');await x.unchanged();assert.equal(x.requests.length,1);
 });
}
