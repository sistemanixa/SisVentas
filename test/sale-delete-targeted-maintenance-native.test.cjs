'use strict';
// Full active index, native prepared indices and genuine authorized history.
// Only SDK/HTTP transport is fictional; review drivers are the actual modules.
const {test}=require('node:test'),a=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module'),{chromium}=require('playwright');
const sourceRoot=path.resolve(process.env.SV_MAINTENANCE_THREE_BLOCKS_SOURCE_ROOT||path.join(__dirname,'..')),at=createRequire(path.join(sourceRoot,'cotizador/index.js'));
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
async function setup(){
 const f=await at('../test/fixtures/commercial-full-app.cjs').start({count:1,paymentAmount:25}),Model=at('../js/core/record-list-model'),Activation=at('../scripts/lib/record-list-activation.cjs');
 f.backend.state.sisventas.gastos={};
 for(const [id,value]of Object.entries({good:{descripcion:'Gasto QA vinculado',monto:12.345,fecha:'2026-11-26',empleadoFbKey:'e',legacyKey:'ctaemp/e/m',tipoPagable:'hextra',pagos:{p:{monto:1,fotoBase64:'RAW-PAYMENT-PRIVATE-SENTINEL'}}},review:{descripcion:'Gasto QA sin empleado',monto:9,fecha:'2026-11-26',empleadoFbKey:'missing'}})){
  const p='sisventas/gastos/'+id;f.backend.state.sisventas.gastos[id]=Model.plan(p,null,value,'fixture-'+id)[p];
 }
 f.backend.state.sisventas.empleados={e:{nombre:'Empleado QA'}};f.backend.state.sisventas.ctaemp={e:{m:{tipo:'hextra',gastoFbKey:'good',empleadoId:'e'}}};
 const prepared=await Activation.scan(async(p,options)=>{const value=f.backend.get(p);return options?.shallow&&value!==null?Object.fromEntries(Object.keys(value).map(k=>[k,true])):value;});
 f.backend.state.sisventas.listados_resumen=prepared.indexes;f.backend.state.sv_record_list_config={schema:1,ready:true};
 a.equal(Object.keys(Model.parseIndex('gastos',f.backend.get('sisventas/listados_resumen/gastos'))).length,2);
 a.equal(f.backend.get('sv_commercial_pages_config/nativeCollectionsReady'),true,'Native sales/payment index must be genuinely prepared by the shared backend');
 return f;
}
async function unchanged(f,page,original,writes){a.equal(await page.evaluate(()=>__moduleAudit.writes.length),writes);a.equal(f.backend.commands.length,0);a.equal(f.backend.commits.length,0);a.deepEqual(f.backend.state.sisventas,original);}
for(const width of [390,1280])test('complete active index maintenance reviews real expenses and sales read-only '+width,{timeout:25000},async()=>{
 const f=await setup(),original=structuredClone(f.backend.state.sisventas);let browser,hold=null,blocked=null;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true});page.setDefaultTimeout(6000);await page.addInitScript(()=>localStorage.setItem('nixa_dark','1'));
  await page.route('**/*',async route=>{const request=route.request(),url=new URL(request.url());if(url.origin!==new URL(f.url).origin)return route.abort();
   if(hold&&url.pathname==='/fixture-read'&&JSON.parse(url.searchParams.get('spec')||'{}').path==='sv_record_list_config'){const current=hold;hold=null;blocked=current;const response=await route.fetch();current.entered.resolve();await current.release.promise;await route.fulfill({response});blocked=null;return;}return route.continue();
  });
  await page.goto(f.url);await page.waitForFunction(()=>document.querySelectorAll('#ventas-tbody tr').length===1);await page.evaluate(()=>showPage('configuracion'));await page.getByRole('button',{name:'Mantenimiento',exact:true}).click();
  a.deepEqual(await page.locator('#cfg-mantenimiento > section').evaluateAll(nodes=>nodes.map(n=>n.id)),['mnt-targeted-reviews','mnt-support']);a.equal(await page.locator('#mnt-current-state,#mnt-diagnostic-generate').count(),0);a.equal(await page.locator('#mnt-diagnostic-download').isDisabled(),true);
  const writes=await page.evaluate(()=>__moduleAudit.writes.length),reads=await page.evaluate(()=>__moduleAudit.reads.length);
  await page.getByRole('button',{name:'Revisar gastos',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#mnt-review-results .mnt-review-result h3')?.textContent==='Gastos'&&document.getElementById('mnt-review-progress').textContent.startsWith('Revisión terminada'));
  a.equal(await page.locator('#page-configuracion.active #cfg-mantenimiento').isVisible(),true);a.equal(await page.locator('#page-gastos.active').count(),0);a.match(await page.locator('#mnt-review-results').innerText(),/2 de 2 revisados · 1 requieren atención/);await page.locator('#mnt-review-results summary').filter({hasText:'Gasto QA sin empleado'}).click();a.match(await page.locator('#mnt-review-results').innerText(),/Falta empleado/);
  await page.getByRole('button',{name:'Revisar ventas y cobros',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('#mnt-review-results .mnt-review-result').length===2&&document.getElementById('mnt-review-progress').textContent.startsWith('Revisión terminada'));
  const sales=page.locator('#mnt-review-results .mnt-review-result').filter({has:page.getByRole('heading',{name:'Ventas y cobros',exact:true})});a.match(await sales.innerText(),/2 de 2 revisados · 0 requieren atención/);await sales.locator('summary').filter({hasText:'Qué se comprobó'}).click();a.match(await sales.innerText(),/historial autorizados por servidor|historial servidor/);a.equal(await page.locator('#page-detalle.active').count(),0);for(const button of await page.getByRole('button',{name:'Mostrar más hallazgos',exact:true,includeHidden:true}).all())a.equal(await button.isVisible(),false,'No extra-page action when there are fewer than thirty findings');
  a.equal(await page.locator('#page-configuracion.active #cfg-mantenimiento').isVisible(),true);a.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#cfg-mantenimiento').screenshot({path:path.join(require('node:os').tmpdir(),'maintenance-reviews-'+width+'.png')});
  a.equal(await page.locator('#mnt-diagnostic-download').isDisabled(),false);const text=await page.locator('#mnt-diagnostic-output').innerText();a.match(text,/GASTOS/);a.match(text,/VENTAS Y COBROS/);a.match(text,/2 de 2 registros revisados/);a.doesNotMatch(text,/RAW-PAYMENT-PRIVATE-SENTINEL|fotoBase64|"(?:pagos|payments|monto)"\s*:|Transferencia|fixture-token/);
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar informe',exact:true}).click();const download=await downloaded;a.match(download.suggestedFilename(),/\.txt$/);const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);a.equal(Buffer.concat(chunks).toString('utf8'),text);await download.delete();
  const access=await page.evaluate(start=>__moduleAudit.reads.slice(start),reads);a(access.some(r=>r.path==='sisventas/gastos/good'));a(access.some(r=>r.path==='sisventas/ctaemp/e/m'));a(!access.some(r=>['sisventas/gastos','sisventas/ventas','sisventas/pagos','sisventas/ctaemp'].includes(r.path)),'Review never enumerates business original roots');a(f.measures.some(r=>r.path==='/comerciales/ventas/registro/fixture0'),'Sales review must reach genuine server history');await unchanged(f,page,original,writes);
  let gate={entered:defer(),release:defer()};hold=gate;await page.getByRole('button',{name:'Revisar gastos',exact:true}).click();await gate.entered.promise;await page.getByRole('button',{name:'Cancelar revisión',exact:true}).click();gate.release.resolve();await page.waitForFunction(()=>document.getElementById('mnt-review-progress').textContent.startsWith('Revisión cancelada'));a.equal(await page.locator('#mnt-diagnostic-output').innerText(),text);
  gate={entered:defer(),release:defer()};hold=gate;await page.getByRole('button',{name:'Revisar gastos',exact:true}).click();await gate.entered.promise;await page.getByRole('button',{name:'General',exact:true}).click();gate.release.resolve();await page.waitForLoadState('networkidle');a.equal(await page.locator('#cfg-mantenimiento').isVisible(),false);a.equal(await page.locator('#mnt-review-results .mnt-review-result').count(),0);a.equal(await page.locator('#mnt-diagnostic-download').isDisabled(),true);a.equal(await page.locator('.modal-overlay.open').count(),0);await unchanged(f,page,original,writes);
  console.log('MAINTENANCE_REVIEWS '+JSON.stringify({width,expenses:2,salesAndPayments:2,navigated:false,writes:0,history:'real'}));
 }finally{hold?.release.resolve();blocked?.release.resolve();await browser?.close();f.server.closeAllConnections();await new Promise(resolve=>f.server.close(resolve));}
});

test('retained preparation API remains authenticated and permission protected without UI exposure or writes',async()=>{
 const f=await at('../test/helpers/sale-delete-native-http-lab.cjs').create({sourceRoot,mode:'targeted'});
 try{
  const original=f.get('sisventas'),metadata=f.get('sv_sale_delete_relations'),Adapter=at('./sale-delete-target-preparation-http');
  const api=Adapter.create({authorize:f.gateway.authorize,guard:f.runtime.guard,store:f.runtime.store,enabled:true});
  const body={id:'maintenance-unauthorized-fixture'};
  await a.rejects(api.handle({method:'POST',url:Adapter.PATH,headers:{}},body),e=>e.statusCode===401);
  await a.rejects(api.handle({method:'POST',url:Adapter.PATH,headers:{authorization:'Bearer FICTITIOUS_DELETE_LAB'}},body),e=>e.statusCode===403);
  a.equal(f.commits.length,0);a.deepEqual(f.get('sisventas'),original);a.deepEqual(f.get('sv_sale_delete_relations'),metadata);a.equal(f.get('sv_labor_guard'),null);
 }finally{await f.close();}
});
