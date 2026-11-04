'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const fixtureSource=fs.readFileSync(require.resolve('./dashboard-host-browser-independent.integration.cjs'),'utf8');
// Reuse the browser fixture only; preserve the four original test cases verbatim.
const session=new Function('require','__dirname',fixtureSource.slice(0,fixtureSource.indexOf('const settle='))+'\nreturn session;')(require,__dirname);
test('actual startup callpoint demands one summary and never notices or another read from rendering',{
 skip:process.env.SV_DASHBOARD_HOST_BROWSER_QA!=='1',timeout:60000
},()=>session(1280,async({page,calls})=>{
 await page.evaluate(()=>{aplicarPermisosRolesGuardados(PERMISOS_ROLES);showPage('dashboard');svCargarInicioDashboardDemandado();});
 await page.waitForFunction(()=>window._svDashboardBudgetSource?.peek('dashboard').status==='ready');await page.waitForTimeout(300);
 assert.equal(calls.length,1,JSON.stringify(calls));assert(calls[0].url.endsWith('/presupuestos/actividad-v2'));
 assert.equal(await page.evaluate(()=>_svDashboardBudgetSource.peek('notices').data),null);
 for(let i=0;i<3;i++)await page.evaluate(()=>{svPintarPresupuestosDashboard();svCargarInicioDashboardDemandado();});
 await page.waitForTimeout(300);assert.equal(calls.length,1,'summary demand deduplicates; rendering never requests notices');
 assert.equal(await page.evaluate(()=>SVDataReadiness.status(['dashboardBudgets']).ready),true);
}));
