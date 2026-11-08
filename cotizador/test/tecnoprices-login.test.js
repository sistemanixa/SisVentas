'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {chromium}=require('playwright');
const helper=require('../tecnoprices-login');
const apiFixture=require('./tecnoprices-api-fixture');
const source=fs.readFileSync(require.resolve('../index.js'),'utf8');
const scraper=source.slice(source.indexOf('function firmaCredencialesProveedor('),source.indexOf('\nasync function cotizarBiosegur('));
const origin='https://www.tecnoprices.com';
const form=(action,extras='')=>`<form method="post" action="${action}"><input name="usuario"><input name="password" type="password"><button type="submit">Entrar</button>${extras}</form>`;
const authenticated='<a href="/salir.php">Salir</a><h1>Producto ficticio</h1><b>$ 1234</b>';
test('Tecnoprices DOM and real scraper with intercepted fictitious pages only',async t=>{
 const browser=await chromium.launch({headless:true,...(process.env.SV_TEST_CHROMIUM?{executablePath:process.env.SV_TEST_CHROMIUM}:{})});
 try{
  for(const action of ['control.php','/control.php',origin+'/control.php','./control.php'])await t.test('valid action '+action,async()=>{
   const context=apiFixture(await browser.newContext());let posted=0;
   try{await context.route('**/*',async route=>{const request=route.request();assert.equal(new URL(request.url()).origin,origin);if(request.method()==='POST'){posted++;assert.equal(new URL(request.url()).pathname,'/control.php');assert.equal(request.postData(),'usuario=fixture-user&password=fixture-password');return route.fulfill({contentType:'text/html',body:authenticated});}return route.fulfill({contentType:'text/html',body:new URL(request.url()).pathname==='/ingresar'?form(action):authenticated});});
    const page=await context.newPage();await page.goto(origin+'/ingresar');await helper.login(page,'fixture-user','fixture-password');assert.equal(posted,1);await helper.assertSession(page);
   }finally{await context.close();}
  });
  for(const [name,html]of [
   ['absent','<p>No disponible</p>'],['foreign action',form('https://foreign.invalid/control.php')],
   ['lookalike host',form('https://www.tecnoprices.com.foreign.invalid/control.php')],
   ['foreign document base','<base href="https://foreign.invalid/">'+form('control.php')],
   ['ambiguous',form('/control.php')+form('control.php')],
   ['split controls','<input name="password" type="password"><form method="post" action="/control.php"><input name="usuario"><button type="submit">Entrar</button></form>'],
   ['get form',form('/control.php').replace('method="post"','method="get"')],
   ['wrong path',form('/other/control.php')],['query action',form('/control.php?redirect=elsewhere')],
   ['submit overrides destination',form('/control.php').replace('type="submit"','type="submit" formaction="https://foreign.invalid/control.php"')],
   ['input owned by another form','<form id="other" action="https://foreign.invalid/control.php"></form>'+form('/control.php').replace('name="password"','name="password" form="other"')]
  ])await t.test(name+' rejects before credential submission',async()=>{
   const context=apiFixture(await browser.newContext());let posted=0;
   try{await context.route('**/*',route=>{if(route.request().method()==='POST')posted++;return route.fulfill({contentType:'text/html',body:html});});const page=await context.newPage();await page.goto(origin+'/ingresar');await assert.rejects(helper.login(page,'fixture-user','fixture-password'),{code:'TECNOPRICES_SESSION_REQUIRED'});assert.equal(posted,0);if(await page.locator('input[name="usuario"]').count())assert.equal(await page.locator('input[name="usuario"]').first().inputValue(),'');}finally{await context.close();}
  });
  for(const [name,result,path]of [
   ['failed login',form('/control.php')+'<b>$1234</b>','/ingresar'],
   ['price on login with logout decoy',form('/control.php')+authenticated,'/producto'],
   ['price without session','<h1>Producto</h1><b>$1234</b>','/producto'],
   ['foreign logout','<a href="https://foreign.invalid/salir">Salir</a><b>$1234</b>','/producto']
  ])await t.test(name+' cannot reach price extraction or cache',async()=>{
   const context=apiFixture(await browser.newContext());let extracted=0,posts=0;const sessions=new Map();
   try{await context.route('**/*',route=>{const req=route.request();assert.equal(new URL(req.url()).origin,origin);if(req.method()==='POST'){posts++;return route.fulfill({contentType:'text/html',body:name==='failed login'?result:authenticated});}return route.fulfill({contentType:'text/html',body:new URL(req.url()).pathname==='/ingresar'&&posts===0?form('/control.php'):result});});
    const scope={require:id=>{assert.equal(id,'./tecnoprices-login');return helper;},crypto:require('node:crypto'),sesionesProveedorManual:sessions,SESION_PROVEEDOR_TTL_MS:900000,claveSesionProveedorManual:()=> 'fixture',normalizarUrl:v=>v,adquirirNavegador:async()=>({newContext:async()=>context,close:async()=>{}}),extraerPrecioPaginaProveedor:async()=>{extracted++;throw Error('Price must not be reached');},Date,Map,URL};vm.runInNewContext(scraper,scope);
    await assert.rejects(scope.cotizarProveedorConLogin({proveedor:{usuario:'fixture-user',password:'fixture-password'},proveedorKey:'fixture',url:origin+'/producto',tipo:'tecnoprices'}),error=>{assert.equal(error.code,'TECNOPRICES_LOOKUP_FAILED');assert(!/fixture-password|locator|Call log|Timeout/.test(error.message));return true;});assert.equal(extracted,0);assert.equal(posts,1);assert.equal(sessions.size,0);
   }finally{await context.close();}
  });
  await t.test('session page and exact product read successfully once',async()=>{
   const context=apiFixture(await browser.newContext());let extracted=0,posts=0;const sessions=new Map(),visited=[];
   await context.route('**/*',route=>{const req=route.request();visited.push(new URL(req.url()).pathname);assert.equal(new URL(req.url()).origin,origin);if(req.method()==='POST'){posts++;return route.fulfill({contentType:'text/html',body:authenticated});}return route.fulfill({contentType:'text/html',body:new URL(req.url()).pathname==='/ingresar'?form('/control.php'):authenticated});});
   const scope={require:()=>helper,crypto:require('node:crypto'),sesionesProveedorManual:sessions,SESION_PROVEEDOR_TTL_MS:900000,claveSesionProveedorManual:()=> 'fixture',normalizarUrl:v=>v,adquirirNavegador:async()=>({newContext:async()=>context,close:async()=>{}}),extraerPrecioPaginaProveedor:async()=>{extracted++;return{precioArs:1234,moneda:'ARS'};},extraerDisponibilidadPaginaProveedor:async()=> 'disponible',extraerCondicionIva:()=>({sinIva:true}),tituloVisibleProducto:async()=> 'Producto ficticio',identidadAlta:()=>({ok:true}),validarIdentidadProducto:()=>({ok:true}),Date,Map,URL};vm.runInNewContext(scraper,scope);
   const result=await scope.cotizarProveedorConLogin({proveedor:{usuario:'fixture-user',password:'fixture-password'},proveedorKey:'fixture',url:origin+'/producto-exacto',tipo:'tecnoprices'});assert.equal(result.precioArs,1234);assert.equal(extracted,1);assert.equal(posts,1);assert.equal(sessions.size,1);assert.deepEqual(visited,['/ingresar','/control.php','/','/producto-exacto']);
  });
  await t.test('rejected cached session gets at most one login and never a price fallback',async()=>{
   const context=apiFixture(await browser.newContext()),visited=[];let extracted=0,posts=0;
   const crypto=require('node:crypto'),sessions=new Map([['fixture',{firma:crypto.createHash('sha256').update('fixture-user\u0000fixture-password').digest('hex'),expiraEn:Date.now()+60000,storageState:{cookies:[],origins:[]}}]]);
   await context.route('**/*',route=>{const req=route.request(),path=new URL(req.url()).pathname;visited.push(path);assert.equal(new URL(req.url()).origin,origin);if(req.method()==='POST')posts++;return route.fulfill({contentType:'text/html',body:path==='/ingresar'?form('/control.php'):form('/control.php')+'<p>Ingresar para ver precios</p><b>$1234</b>'});});
   const scope={require:()=>helper,crypto,sesionesProveedorManual:sessions,SESION_PROVEEDOR_TTL_MS:900000,claveSesionProveedorManual:()=> 'fixture',normalizarUrl:v=>v,adquirirNavegador:async()=>({newContext:async()=>context,close:async()=>{}}),extraerPrecioPaginaProveedor:async()=>{extracted++;throw Error('No price');},Date,Map,URL};vm.runInNewContext(scraper,scope);
   await assert.rejects(scope.cotizarProveedorConLogin({proveedor:{usuario:'fixture-user',password:'fixture-password'},proveedorKey:'fixture',url:origin+'/producto-exacto',tipo:'tecnoprices'}),{code:'TECNOPRICES_LOOKUP_FAILED'});assert.equal(posts,1);assert.equal(extracted,0);assert.equal(sessions.size,0);assert.deepEqual(visited,['/producto-exacto','/ingresar','/control.php','/']);
  });
 }finally{await browser.close();}
});
