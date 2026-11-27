'use strict';
// The approved three-block UI retires the former preparation button. Server
// preparation Auth/permission checks remain covered below, without a UI POST.
// Full active index and Root's existing fictional HTTP/SDK fixture. No product
// replacement, shared fixture edits, remote services, or business writes.
const {test}=require('node:test'),a=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module'),{chromium}=require('playwright');
const sourceRoot=path.resolve(process.env.SV_MAINTENANCE_THREE_BLOCKS_SOURCE_ROOT||path.join(__dirname,'..'));
const at=createRequire(path.join(sourceRoot,'cotizador/index.js'));
const cards=['mnt-current-state','mnt-targeted-reviews','mnt-support'];
async function open(width){
 const local=await at('../test/fixtures/commercial-full-app.cjs').start({count:1});let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true});page.setDefaultTimeout(7000);
  await page.addInitScript(()=>localStorage.setItem('nixa_dark','1'));
  const requests=[];page.on('request',request=>{const url=new URL(request.url());requests.push({method:request.method(),path:url.pathname});});
  await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(local.url).origin?route.continue():route.abort());
  await page.goto(local.url);await page.waitForFunction(()=>document.querySelectorAll('#ventas-tbody tr').length===1);
  await page.evaluate(()=>showPage('configuracion'));await page.waitForLoadState('networkidle');
  return{local,browser,page,requests,original:structuredClone(local.backend.state.sisventas),close:async()=>{await browser.close();local.server.closeAllConnections();await new Promise(resolve=>local.server.close(resolve));}};
 }catch(error){await browser?.close();local.server.closeAllConnections();await new Promise(resolve=>local.server.close(resolve));throw error;}
}
async function counts(f){return{browser:await f.page.evaluate(()=>({reads:__moduleAudit.reads.length,writes:__moduleAudit.writes.length})),network:f.requests.length,commands:f.local.backend.commands.length,commits:f.local.backend.commits.length};}
async function assertNoBusinessIO(f,before){
 const after=await counts(f),audit=await f.page.evaluate(()=>({reads:__moduleAudit.reads,writes:__moduleAudit.writes}));
 a.deepEqual(audit.reads.slice(before.browser.reads),[],'No SDK/API reads while opening or generating local support');
 a.deepEqual(audit.writes.slice(before.browser.writes),[],'No SDK writes');
 a.deepEqual(f.requests.slice(before.network).filter(r=>/^\/(fixture-read|fixture-counter|comerciales|laboral|usuarios)(\/|$)/.test(r.path)),[],'No business HTTP requests');
 a.equal(after.commands,before.commands);a.equal(after.commits,before.commits);a.deepEqual(f.local.backend.state.sisventas,f.original);
}
async function openMaintenance(f){await f.page.getByRole('button',{name:'Mantenimiento',exact:true}).click();await f.page.locator('#cfg-mantenimiento[data-maintenance-layout="three-blocks"]').waitFor({state:'visible'});}
async function assertLayout(page){
 a.deepEqual(await page.locator('#cfg-mantenimiento > [id]').evaluateAll(nodes=>nodes.map(n=>n.id)),cards);
 for(const id of cards){const node=page.locator('#'+id);a.equal(await node.isVisible(),true);const box=await node.boundingBox();a(box.width>200);}
 a.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal document overflow');
 a.equal(await page.locator('#cfg-mantenimiento #mnt-v3-card,#cfg-mantenimiento #mnt-v2-card,#cfg-mantenimiento #mnt-v2-audit-card,#cfg-mantenimiento #mnt-migraciones-lista,#cfg-mantenimiento #mnt-vinculos-ventas-status').count(),0);
 a.doesNotMatch(await page.locator('#cfg-mantenimiento').innerText(),/Rumbo a|Volver a v2|Activar módulos|Preparar vínculos|Limpiar legacy|Borra[r]? duplicados/i);
 a.deepEqual(await page.evaluate(()=>['mntExaminarTodo','mntMigrarLegacy','mntLimpiarLegacy','prepararVinculosDeVentas','svRenderPreparacionV2','svRenderResumenOperativo'].filter(name=>typeof window[name]==='function')),[],'Retired exclusive maintenance APIs are not loaded');
}
async function assertSupport(f){
 const before=await counts(f);a.equal(await f.page.locator('#mnt-diagnostic-download').isDisabled(),true);
 await f.page.getByRole('button',{name:'Generar diagnóstico',exact:true}).click();
 const output=f.page.locator('#mnt-diagnostic-output');await output.waitFor({state:'visible'});const text=await output.innerText();
 a.match(text,/Diagnóstico de sesión/);a.match(text,/Fecha:/);a.match(text,/Versión:/);a.match(text,/Conexión:/);a.match(text,/Sesión: Administrador/);a.match(text,/No comprueba saldos ni la integridad completa/);
 a.doesNotMatch(text,/\bUID\b|fixture@example\.invalid|Administrador ficticio|Cliente ficticio|Dirección ficticia|V-FIXTURE-|P-\d+|FICTICIO-SIN-VALIDEZ|fixture-token/);
 a.equal(await f.page.locator('#mnt-diagnostic-status').isVisible(),true);a.match(await f.page.locator('#mnt-diagnostic-status').innerText(),/generado/i);
 const downloaded=f.page.waitForEvent('download');await f.page.getByRole('button',{name:'Descargar diagnóstico',exact:true}).click();const download=await downloaded;
 a.match(download.suggestedFilename(),/^sisventas-diagnostico-.*\.txt$/);const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);a.equal(Buffer.concat(chunks).toString('utf8'),text);await download.delete();await assertNoBusinessIO(f,before);
 a.equal(await f.page.evaluate(()=>{const n=document.querySelector('#mnt-diagnostic-output'),style=getComputedStyle(n);return style.whiteSpace==='pre-wrap'&&parseFloat(style.fontSize)>=12&&n.scrollWidth<=n.clientWidth;}),true);
}
async function returnToMaintenance(f){await f.page.evaluate(()=>showPage('configuracion'));await openMaintenance(f);}
async function assertNavigation(f){
 const actions=[['Revisar clientes','clientes'],['Abrir Gastos','gastos'],['Abrir Ventas','detalle']];
 for(const [name,destination]of actions){
  const before=await counts(f);await f.page.getByRole('button',{name,exact:true}).click();await f.page.waitForFunction(id=>document.getElementById('page-'+id)?.classList.contains('active'),destination);
  if(destination==='clientes'){await f.page.locator('#modal-revision-clientes.open').waitFor({state:'visible'});a.equal(await f.page.getByRole('button',{name:'Generar estructura aprobada',exact:true}).count(),0);await f.page.locator('#modal-revision-clientes .modal-foot').getByRole('button',{name:'Cerrar',exact:true}).click();}
  await f.page.waitForLoadState('networkidle');const after=await counts(f);a.equal(after.browser.writes,before.browser.writes);a.equal(after.commands,before.commands);a.equal(after.commits,before.commits);a.deepEqual(f.local.backend.state.sisventas,f.original);
  const reads=await f.page.evaluate(start=>__moduleAudit.reads.slice(start),before.browser.reads);
  a(reads.every(r=>!/^sisventas\/(mantenimiento|aguinaldos|hsextra_solicitudes|ctaemp|credenciales|dolarHistorico)(\/|$)/.test(r.path)),'Navigation must not start any retired maintenance audit');
  a(f.requests.slice(before.network).every(r=>!r.path.includes('/eliminacion/preparar')&&!r.path.includes('/admin-diagnostics.js')));
  console.log('MAINTENANCE_DESTINATION '+JSON.stringify({destination,reads:reads.map(r=>({type:r.type,path:r.path}))}));
  await returnToMaintenance(f);
 }
}
async function assertRetiredContext(f){
 await f.page.getByRole('button',{name:'Generar diagnóstico',exact:true}).click();await f.page.getByRole('button',{name:'General',exact:true}).click();
 a.equal(await f.page.locator('#mnt-diagnostic-output').isVisible(),false);a.equal(await f.page.locator('#mnt-diagnostic-download').isDisabled(),true);await openMaintenance(f);
 // Hold only the genuine fixture's existing source delivery, never substitute
 // a successful readiness answer. Retiring the caller must cancel continuation.
 await f.page.evaluate(()=>{__moduleAuditSourceControl.hold(['clientes']);SVDataReadiness.invalidate(['clientes']);});
 await f.page.getByRole('button',{name:'Revisar clientes',exact:true}).click();await f.page.waitForFunction(()=>document.getElementById('page-clientes')?.classList.contains('active'));a.equal(await f.page.locator('#modal-revision-clientes.open').count(),0);
 await f.page.evaluate(()=>showPage('configuracion'));await f.page.getByRole('button',{name:'General',exact:true}).click();await f.page.evaluate(()=>__moduleAuditSourceControl.release('clientes'));await f.page.waitForTimeout(100);a.equal(await f.page.locator('#modal-revision-clientes.open').count(),0,'hiding/navigating away retires the pending review');await openMaintenance(f);
 await f.page.evaluate(()=>{__moduleAuditSourceControl.hold(['clientes']);SVDataReadiness.invalidate(['clientes']);});
 a.equal(await f.page.evaluate(()=>SVDataReadiness.statusFor('clientes').ready),false);await f.page.getByRole('button',{name:'Revisar clientes',exact:true}).click();await f.page.waitForFunction(()=>document.getElementById('page-clientes')?.classList.contains('active'));a.equal(await f.page.locator('#modal-revision-clientes.open').count(),0,'review must still be waiting before retiring the session');
 await f.page.evaluate(()=>{currentUserUid='';fbAuth.currentUser=null;document.dispatchEvent(new Event('sisventas:session-ended'));__moduleAuditSourceControl.release('clientes');});
 await f.page.waitForTimeout(100);a.equal(await f.page.locator('#modal-revision-clientes.open').count(),0);a.equal(f.local.backend.commands.length,0);a.equal(f.local.backend.commits.length,0);a.deepEqual(f.local.backend.state.sisventas,f.original);
}
for(const width of [390,1280])test('complete active index three-block maintenance '+width+' opens twice without business IO', {timeout:25000},async()=>{
 const f=await open(width);try{
  const before=await counts(f);await openMaintenance(f);await assertLayout(f.page);
  // Cover the previous panel's delayed 400/700/900ms automatic audits.
  await f.page.waitForTimeout(1000);await assertNoBusinessIO(f,before);
  await f.page.getByRole('button',{name:'General',exact:true}).click();await openMaintenance(f);await f.page.waitForTimeout(1000);await assertNoBusinessIO(f,before);await assertLayout(f.page);
  await assertSupport(f);await f.page.locator('#cfg-mantenimiento').screenshot({path:path.join(require('node:os').tmpdir(),'maintenance-three-blocks-'+width+'.png')});await assertNavigation(f);await assertRetiredContext(f);
  a(f.requests.every(r=>!r.path.includes('/eliminacion/preparar')),'The retired preparation button must never produce a POST');
 }finally{await f.close();}
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
