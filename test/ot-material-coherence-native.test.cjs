'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const {start}=require('./fixtures/commercial-full-app.cjs'),Index=require('../js/core/record-list-model'),{apply}=require('./helpers/labor-ui-flow.cjs');
const evidence=process.env.SV_OT187_EVIDENCE;
for(const width of [390,1280])test('full OT wizard: coherent delivery, mobile admin, late sources and revoked intent '+width,{timeout:90000},async()=>{
 const f=await start({accountsRollout:false}),key='fiction_ot187',ref='sisventas/ordenes_trabajo/'+key;
 let ot={id:'OT-FICTION-187',cliente:'Cliente ficticio',clienteFbKey:'c',tecnico:'Persona ficticia',estado:'pendiente',progreso:100,checks:{preparacion:Array(5).fill(true),instalacion:Array(3).fill(true),verificacion:Array(6).fill(true)},firmada:true,firmaClienteUrl:'data:image/png;base64,iVBORw0KGgo=',materiales:[{cod:'CAM-F',desc:'Cámara ficticia',vendida:2,entregada:2,instalada:0,custodiaActiva:false}],audit:[]};
 function seed(next){const before=f.backend.get(ref);apply(f.backend.state,{...Index.plan(ref,before,next,'fiction-seed'),'sv_record_list_config':{schema:1,ready:true}});ot=f.backend.get(ref);}
 seed(ot);const financial=structuredClone(Object.fromEntries(['ventas','pagos','inventario_operativo','comisiones'].map(k=>[k,f.backend.get('sisventas/'+k)])));let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.SV_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),requests=[],errors=[];page.setDefaultTimeout(10000);
  await context.route('**/*',route=>{const r=route.request(),u=new URL(r.url());requests.push({method:r.method(),path:u.pathname});return u.origin===new URL(f.url).origin?route.continue():route.abort();});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('nixa_dark','1'));await page.goto(f.url);await page.evaluate(()=>{__moduleAuditSourceControl.release('productos');__moduleAuditSourceControl.release('empleados');});await page.locator('#ventas-tbody tr').nth(49).waitFor();
  await page.evaluate(()=>{showPage('ordentrabajo');svCargarDatosDePaginaActual('ordentrabajo');});await page.waitForFunction(k=>otData.some(o=>o.fbKey===k),key);await page.evaluate(k=>verOT(k),key);await page.locator('#ot-wiz301-context').getByText('OT-FICTION-187',{exact:true}).waitFor();
  for(const step of ['1 Cliente','2 Materiales','3 Checklist','4 Trabajo','5 Finalizar','6 Historial','2 Materiales']){await page.locator('#ot-wiz301-nav').getByRole('button',{name:new RegExp(step)}).click();a.match(await page.locator('#ot-wiz301-context').innerText(),/OT-FICTION-187/);}
  await page.locator('#ot-custodia-estado').filter({hasText:/no coinciden/}).waitFor({state:'visible'});
  a.doesNotMatch(await page.locator('#ot-wiz301-context').innerText(),/Lista para finalizar/);a.match(await page.locator('#ot-custodia-estado').innerText(),/no coinciden/);await page.getByRole('button',{name:'Revisar entrega',exact:true}).click();a.equal(await page.locator('#ot-btn-todo-instalado').isVisible(),false);a.equal(f.backend.commits.length,0);
  async function receive(){await page.evaluate(async({key,ref})=>{const next=(await fbGet(fbRef(fbDB,ref))).val(),current=otData.find(o=>o.fbKey===key);Object.assign(current,next);document.dispatchEvent(new CustomEvent('sisventas:data-state-changed'));},{key,ref});}
  seed({...ot,custodiaIniciada:true,custodiaRendida:false,materiales:[{...ot.materiales[0],custodiaActiva:true,entregada:0.25,vendida:2.75}]});await receive();await page.locator('#ot-btn-todo-instalado').waitFor({state:'visible'});a.equal(await page.locator('#ot-btn-entregar-materiales').isVisible(),true);
  a.equal(await page.locator('#notif').evaluate(el=>el.classList.contains('show')),false);
  if(evidence)await page.screenshot({path:path.join(evidence,'partial-wizard-'+width+'.private.png'),fullPage:true});
  await page.locator('#ot-btn-todo-instalado').click();await page.locator('.sv-system-dialog').getByRole('button',{name:'Cancelar',exact:true}).click();a.equal(f.backend.commits.length,0);
  // A source event with identical data must not reconstruct the material table.
  a.equal(await page.evaluate(()=>{const before=document.querySelector('#ot-materiales tr');document.dispatchEvent(new CustomEvent('sisventas:data-state-changed'));return before===document.querySelector('#ot-materiales tr');}),true);
  // Late catalog classification updates the component without resetting wizard step.
  await page.evaluate(()=>{prodData['late']={codigo:'CAM-F',esManoDeObra:true};document.dispatchEvent(new CustomEvent('sisventas:data-state-changed'));});a.match(await page.locator('#ot-materiales').innerText(),/Sin materiales controlables/);
  await page.evaluate(()=>{prodData['late'].esManoDeObra=false;document.dispatchEvent(new CustomEvent('sisventas:data-state-changed'));});a.match(await page.locator('#ot-materiales').innerText(),/Cámara ficticia/);a.equal(await page.locator('#ot-materiales-card').isVisible(),true);
  for(const mutation of ['permission','session','quantity']){
   await page.evaluate(()=>{__moduleAudit.notes.length=0;});
   await page.locator('#ot-btn-todo-instalado').click();await page.locator('.sv-system-dialog').waitFor({state:'visible'});
   await page.evaluate(({mutation,key})=>{if(mutation==='permission')window.tienePermiso=action=>action!=='ot.rendirMateriales';if(mutation==='session')window.currentUserUid='fiction-other';if(mutation==='quantity')otData.find(o=>o.fbKey===key).materiales[0].entregada=0.2;document.dispatchEvent(new CustomEvent('sisventas:data-state-changed'));},{mutation,key});
   if(mutation!=='quantity')a.equal(await page.locator('#ot-btn-todo-instalado').isVisible(),false);
   await page.locator('.sv-system-dialog').getByRole('button',{name:'Confirmar',exact:true}).click();await page.waitForFunction(()=>__moduleAudit.notes.some(n=>/La sesión, los permisos o los materiales cambiaron/.test(n)));a.equal(f.backend.commits.length,0);
   await page.evaluate(()=>{window.tienePermiso=()=>true;window.currentUserUid='u';});await receive();
  }
  // An arrived legacy row remains review-only; no automatic remito or consumption.
  seed({...ot,materiales:[],items:[{cod:'LEGACY-F',desc:'Registro ficticio anterior',qty:2}]});await receive();a.match(await page.locator('#ot-custodia-estado').innerText(),/anteriores pendientes/);a.equal(await page.locator('#ot-btn-todo-instalado').isVisible(),false);
  seed({...ot,items:[],custodiaIniciada:true,custodiaRendida:true,materiales:[{cod:'CAM-F',desc:'Cámara ficticia',vendida:2,entregada:2,instalada:2,custodiaActiva:true}]});await receive();a.match(await page.locator('#ot-wiz301-context').innerText(),/Lista para finalizar/);
  if(evidence){fs.mkdirSync(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,'full-wizard-'+width+'.private.png'),fullPage:true});}
  a.equal(requests.filter(r=>r.method==='POST'&&r.path!=='/laboral/capacidades').length,0);a.equal(f.backend.commits.length,0);a.equal(f.backend.commands.length,0);for(const k of Object.keys(financial))a.deepEqual(f.backend.get('sisventas/'+k),financial[k]);a.deepEqual(errors,[]);
 }catch(error){const p=browser?.contexts()[0]?.pages()[0];if(p){if(evidence)await p.screenshot({path:path.join(evidence,'failure-'+width+'.private.png'),fullPage:true});console.log(JSON.stringify(await p.evaluate(()=>({step:window._otWizardStep,ot:window.otData?.find(o=>o.id==='OT-FICTION-187'),status:document.getElementById('ot-custodia-estado')?.textContent,materialHTML:document.getElementById('ot-materiales')?.innerHTML,detailDisplay:document.getElementById('ot-detalle-view')?.style.display,errors:window.__moduleAudit?.errors,notes:window.__moduleAudit?.notes}))));}throw error;}finally{await browser?.close();await new Promise(resolve=>{f.server.close(resolve);f.server.closeAllConnections();});}
});
