'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.SV_PLAYWRIGHT_MODULE||'playwright');
const {fixture}=require('../helpers/user-access-fixture.cjs');
async function run(){
 const browser=await chromium.launch({headless:true});let checks=0;
 try{for(const viewport of [{width:1366,height:900},{width:390,height:844}]){
  const f=fixture(),page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://demo-service.invalid/**',async route=>{
   const request=route.request(),method={'temporal':'temporary','correo':'email','completar':'complete','estado':'status'}[request.url().split('/').pop()];
   try{const result=await f.service[method]({headers:request.headers()},request.postData()?JSON.parse(request.postData()):undefined);await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,...result})});}
   catch(e){await route.fulfill({status:e.statusCode||503,contentType:'application/json',body:JSON.stringify({ok:false,mensaje:e.message})});}
  });
  await page.setContent('<!doctype html><html class="dark-mode sv-v3-preview"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body class="dark-mode" style="font:15px system-ui"><main id="fake-main" style="height:2000px;padding:20px"><h1>Usuarios · prueba aislada</h1><p>Administrador y Técnico ficticios. Sin Firebase real.</p></main></body></html>');
  await page.addStyleTag({content:fs.readFileSync('css/app.css','utf8')+'\n'+fs.readFileSync('css/v3-preview.css','utf8')+'\n'+fs.readFileSync('css/user-access.css','utf8')});
  await page.addScriptTag({content:`
   var currentRole='admin',usuariosData=[{fbKey:'p',uid:'worker',nombre:'Técnico de prueba',mail:'worker@example.test'}], notices=[];
   var adminUser={uid:'admin',email:'admin@example.test',getIdToken:async()=> 'admin',getIdTokenResult:async()=>({claims:{}})};
   var fbAuth={currentUser:adminUser};var SISVENTAS_FUNCTIONS={cotizadorProveedor:'https://demo-service.invalid'};
   var tienePermiso=()=>true,notify=s=>notices.push(s),svConfirm=async()=>true,reauthCount=0;
   var fbReauthenticate=async(u,p)=>{reauthCount++;if(p!=='fixture-admin-key')throw Error('bad');};
   var signedOut=false,loginButtonReset=false,_loginEnCurso=true;var _resetLoginBtn=()=>{loginButtonReset=true;};var fbSignOut=async()=>{signedOut=true;fbAuth.currentUser=null;document.dispatchEvent(new Event('sisventas:session-ended'));};
   function _bloquearInterfazSinSesion(){document.getElementById('fake-main').hidden=true;document.dispatchEvent(new Event('sisventas:session-ended'));}
  `});
  await page.addScriptTag({content:fs.readFileSync('js/core/user-access.js','utf8')});
  const initialOverflow=await page.evaluate(()=>getComputedStyle(document.body).overflow);
  await page.evaluate(()=>SVUserAccess.open('p'));
  await page.getByRole('status').filter({hasText:'Gestión de acceso disponible.'}).waitFor();assert.equal(f.updates.length,0);assert.equal(f.emails.length,0);checks++;
  await page.getByRole('button',{name:'Generar clave temporal',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Ingresá tu contraseña'}).waitFor();checks++;
  await page.locator('#sv-access-admin').fill('wrong');await page.getByRole('button',{name:'Generar clave temporal',exact:true}).click();
  await page.getByRole('status').filter({hasText:'No se pudo confirmar'}).waitFor();assert.equal(f.updates.length,0);checks++;
  const input=page.locator('#sv-access-admin');await input.fill('fixture-admin-key');await input.focus();
  assert.equal(await input.evaluate(e=>e===document.activeElement),true);
  await page.getByRole('button',{name:'Generar clave temporal',exact:true}).click();await page.locator('#sv-access-temporary').waitFor();
  assert.equal(await page.locator('#sv-access-temporary').getAttribute('type'),'password');assert.equal(f.get('sv_access_resets/worker').required,true);checks++;
  await page.waitForFunction(()=>!document.querySelector('#sv-access-done').disabled);
  await page.screenshot({path:'tmp/user-access-admin-'+viewport.width+'.png'});
  await page.getByRole('button',{name:'Mostrar clave',exact:true}).click();assert.equal(await page.locator('#sv-access-temporary').getAttribute('type'),'text');
  await page.getByRole('button',{name:'Listo',exact:true}).click();assert.equal(await page.locator('#sv-access-modal').count(),0);checks++;
  assert.equal(await page.evaluate(()=>getComputedStyle(document.body).overflow),initialOverflow);
  f.advance();await page.evaluate(()=>SVUserAccess.open('p','correo'));await page.locator('#sv-access-admin').fill('fixture-admin-key');
  await page.getByRole('button',{name:'Enviar restablecimiento por correo',exact:true}).click();await page.getByRole('status').filter({hasText:'solicitado correctamente'}).waitFor();
  assert.deepEqual(f.emails,['worker@example.test']);checks++;
  f.tokens.temp={uid:'worker',...f.users.worker.customClaims,firebase:{sign_in_provider:'password'}};
  await page.evaluate(async claims=>{SVUserAccess.close();var u={uid:'worker',getIdToken:async()=> 'temp',getIdTokenResult:async()=>({claims})};fbAuth.currentUser=u;await SVUserAccess.gate(u);},f.users.worker.customClaims);
  assert.equal(await page.locator('#fake-main').isVisible(),false);await page.locator('#sv-access-new').fill('Personal-new-key-2026');await page.locator('#sv-access-confirm').fill('different-value');
  await page.getByRole('button',{name:'Guardar nueva contraseña',exact:true}).click();await page.getByRole('status').filter({hasText:'no coinciden'}).waitFor();checks++;
  await page.screenshot({path:'tmp/user-access-forzado-'+viewport.width+'.png'});
  await page.locator('#sv-access-confirm').fill('Personal-new-key-2026');await page.getByRole('button',{name:'Guardar nueva contraseña',exact:true}).click();
  await page.waitForFunction(()=>signedOut);assert.equal(f.get('sv_access_resets/worker').required,false);assert.equal(await page.locator('#sv-access-modal').count(),0);assert.equal(await page.evaluate(()=>loginButtonReset&&!_loginEnCurso),true);checks++;
  await page.evaluate(()=>{currentRole='tecnico';fbAuth.currentUser=adminUser;SVUserAccess.open('p');});assert.equal(await page.locator('#sv-access-modal').count(),0);checks++;
  await page.evaluate(()=>{currentRole='admin';window._impersonacionOriginal={};SVUserAccess.open('p');});assert.equal(await page.locator('#sv-access-modal').count(),0);checks++;
  assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
 console.log(JSON.stringify({checks,passed:true,scope:'Escritorio y móvil emulado: admin, confirmación, clave de una sola visualización, correo ficticio, cambio forzado, salida y Ver como; sin usuarios ni correos reales'},null,2));
}
run().catch(e=>{console.error(e);process.exitCode=1;});
