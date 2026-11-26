'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module'),{chromium}=require('playwright');
const {create}=require('./helpers/sale-delete-native-http-lab.cjs');
const sourceRoot=path.resolve(process.env.SV_SALE_DELETE_TARGET_SOURCE_ROOT||path.join(__dirname,'..')),at=createRequire(path.join(sourceRoot,'cotizador/index.js'));
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
for(const width of [390,1280])test('active full-index maintenance target preparation '+width+' pending, success and error keep all business originals', {timeout:30000},async()=>{
 const local=await at('../test/fixtures/commercial-full-app.cjs').start({count:1}),f=await create({sourceRoot,mode:'targeted'});let browser,gate=defer(),entered=defer(),prepares=0;
 try{
  f.set('sv_sale_delete_relations',null);f.set('sv_permisos/admin/indiceModulos/configuracion',true);f.set('sv_permisos/admin/acciones/mantenimiento',{migrar:true});const original=f.get('sisventas'),webOriginal=structuredClone(local.backend.state.sisventas);
  const Adapter=at('./sale-delete-target-preparation-http'),adapter=Adapter.create({authorize:f.gateway.authorize,guard:f.runtime.guard,store:f.runtime.store,enabled:true});
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe'});const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(7000);await page.addInitScript(()=>localStorage.setItem('nixa_dark','1'));
  await page.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());if(!request.url().startsWith(local.url))return route.abort();
   // Two fixture servers use different deliberately invalid bearer literals.
   // Map only that Auth boundary; execute the actual handler/Guard/models.
   if([Adapter.PATH,'/laboral/capacidades','/laboral/operacion'].includes(url.pathname)){
    a.equal(request.method(),'POST');a.equal(request.headers().authorization,'Bearer fixture-token');const req={method:'POST',url:url.pathname,headers:{authorization:'Bearer FICTITIOUS_DELETE_LAB'}},body=request.postDataJSON();
    try{let result;if(url.pathname===Adapter.PATH){prepares++;entered.resolve();await gate.promise;result=await adapter.handle(req,body);}
     else{const actor=await f.gateway.authorize(req);result={statusCode:200,body:url.pathname==='/laboral/operacion'?await f.gateway.resolve(actor,body):{ok:true,payments:{enabled:false,version:1},adminExpense:{enabled:false,version:1},saleDelete:{enabled:f.adapter.capability(),version:1}}};}
     return route.fulfill({status:result.statusCode,contentType:'application/json',body:JSON.stringify(result.body)});
    }catch(e){return route.fulfill({status:e.statusCode||503,contentType:'application/json',body:JSON.stringify({ok:false,code:e.code||'LAB_FAILURE',mensaje:e.message})});}
   }
   return route.continue();
  });
  await page.goto(local.url);await page.waitForFunction(()=>document.querySelectorAll('#ventas-tbody tr').length===1);await page.evaluate(()=>showPage('configuracion'));await page.getByRole('button',{name:'Mantenimiento',exact:true}).click();await page.getByRole('button',{name:'Ver detalles técnicos',exact:true}).click();
  const button=page.locator('button[onclick="prepararVinculosDeVentas(this)"]'),status=page.locator('#mnt-vinculos-ventas-status');await button.scrollIntoViewIfNeeded();await button.click();await page.waitForFunction(()=>document.getElementById('mnt-vinculos-ventas-status').textContent.includes('Preparando vínculos'));
  await entered.promise;a.equal(await button.isDisabled(),true);a.equal(prepares,1);await page.screenshot({path:'C:/SisVentas/tmp/targeted-maintenance-pending-'+width+'.private.png'});gate.resolve();await page.waitForFunction(()=>document.getElementById('mnt-vinculos-ventas-status').textContent==='Vínculos preparados. Ya podés eliminar la venta.');a.equal(await button.isDisabled(),false);a.equal(f.commits.length,1);a.deepEqual(f.get('sisventas'),original);await page.screenshot({path:'C:/SisVentas/tmp/targeted-maintenance-ready-'+width+'.private.png'});
  if(width===390){f.control.revoked=true;await button.click();await page.waitForFunction(()=>document.getElementById('mnt-vinculos-ventas-status').textContent.includes('sesión venció'));a.equal(f.commits.length,1);a.equal(await button.isDisabled(),false);}
  else{
   f.set('sv_sale_delete_relations',null);gate=defer();entered=defer();await button.click();await page.waitForFunction(()=>document.getElementById('mnt-vinculos-ventas-status').textContent.includes('Preparando vínculos'));await entered.promise;await page.evaluate(()=>{PERMISOS_ROLES.admin.indiceRevision=(PERMISOS_ROLES.admin.indiceRevision||0)+1;});gate.resolve();await page.waitForFunction(()=>document.getElementById('mnt-vinculos-ventas-status').textContent.includes('sesión cambió'));a.equal(f.commits.length,2);a.equal(prepares,2);a.equal(await button.isDisabled(),false);
  }
  a.deepEqual(f.get('sisventas'),original);a.deepEqual(local.backend.state.sisventas,webOriginal);a.equal(local.backend.commands.length,0);a.equal(local.backend.commits.length,0);a.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);a.equal(await status.isVisible(),true);await page.screenshot({path:'C:/SisVentas/tmp/targeted-maintenance-error-'+width+'.private.png'});
 }finally{gate.resolve();await browser?.close();await f.close();local.server.closeAllConnections();await new Promise(resolve=>local.server.close(resolve));}
});
