'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('./dashboard-host-browser-independent.integration.cjs'),'utf8');
const session=new Function('require','__dirname',source.slice(0,source.indexOf('const settle='))+'\nreturn session;')(require,__dirname);
for(const [kind,destination]of [['dashboard','venta'],['notices','venta']])test('visible unrelated route '+destination+' must not revalidate previously demanded '+kind,{
 skip:process.env.SV_DASHBOARD_HOST_BROWSER_QA!=='1',timeout:60000
},()=>session(1280,async({page,calls})=>{
 await page.evaluate(kind=>{
  aplicarPermisosRolesGuardados(PERMISOS_ROLES);
  if(kind==='dashboard'){showPage('dashboard');svCargarInicioDashboardDemandado();}
  else svCargarDatosDePaginaActual('notificaciones');
 },kind);
 await page.waitForFunction(kind=>window._svDashboardBudgetSource?.peek(kind).status==='ready',kind);await page.waitForTimeout(300);
 const before=calls.length,prior=calls.map(c=>c.url);assert.equal(before,1,JSON.stringify(prior));
 await page.evaluate(destination=>showPage(destination),destination);await page.waitForTimeout(400);
 const active=await page.evaluate(()=>document.querySelector('.page.active')?.id);
 assert.equal(active,'page-'+destination,'Navigation must actually reach the unrelated consumer');
 console.log(JSON.stringify({kind,destination,active,before,after:calls.length,newRequests:calls.slice(before),sourceStatus:await page.evaluate(kind=>_svDashboardBudgetSource.peek(kind).status,kind)}));
 assert.equal(calls.length,before,'Unrelated visible page must not demand a budget consumer');
}));
