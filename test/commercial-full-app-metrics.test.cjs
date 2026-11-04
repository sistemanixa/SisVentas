'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('opt-in complete HTML fictional boot and historical debt metrics',{skip:process.env.SV_RUN_COMMERCIAL_METRICS!=='1',timeout:120000},async()=>{
 const {chromium}=require('playwright'),{start}=require('./fixtures/commercial-full-app.cjs'),results=[];
 const output=path.resolve(__dirname,'../tmp/stage1-integral-plan/commercial-full-app-metrics.private.json');
 for(const count of [60,1095]){
  const local=await start({count,historicalCount:20,paymentAmount:400}),before=structuredClone(local.backend.state.sisventas);let browser;
  const result={count,simulated:true,expectedDebtCents:local.fixture.expectedDebtCents,checks:[],requests:local.measures};results.push(result);
  try{
   browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
   const page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(15000);
   await page.route('**/*',route=>route.request().url().startsWith(local.url)?route.continue():route.abort());
   await page.goto(local.url);
   await page.evaluate(()=>{__moduleAuditSourceControl.release('productos');__moduleAuditSourceControl.release('empleados');});
   await page.waitForFunction(()=>document.querySelectorAll('#ventas-tbody tr').length===50&&SVDataReadiness.statusFor('detalle').ready&&SVCommercialPagesHost.financialState());
   assert.equal(await page.evaluate(()=>SVCommercialPagesHost.financialState().debtCents),local.fixture.expectedDebtCents);result.checks.push('cold sales: real readiness, 50 rows and complete debt');
   local.setPhase('historic-search');await page.locator('#vtab-todas').click();await page.locator('#ventas-mes').fill('');await page.locator('#ventas-mes').dispatchEvent('change');await page.locator('#ventas-search').fill('Antigua');
   await page.waitForFunction(()=>document.querySelectorAll('#ventas-tbody tr').length===20&&document.querySelector('#ventas-tbody').textContent.includes('01-01-2020')&&document.querySelector('#ventas-list-view').getAttribute('aria-busy')===null);
   result.checks.push('historical search: 20 old sales');await page.locator('#ventas-search').fill('');
   await page.waitForFunction(()=>document.querySelectorAll('#ventas-tbody tr').length===50);
   local.setPhase('dashboard');await page.evaluate(()=>showPage('dashboard'));
   await page.waitForFunction(()=>SVDataReadiness.statusFor('dashboard').ready&&SVCommercialPagesHost.financialState()?.recent.length===5);
   assert.equal(await page.evaluate(()=>SVCommercialPagesHost.financialState().debtCents),local.fixture.expectedDebtCents);result.checks.push('dashboard: real readiness, five recent sales and complete debt');
   local.setPhase('collections');await page.evaluate(()=>showPage('cobranzas'));
   await page.waitForFunction(()=>SVDataReadiness.statusFor('cobranzas').ready&&document.querySelectorAll('#pagos-tbody tr').length===50);
   const expected=(local.fixture.expectedDebtCents/100).toLocaleString('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:2});
   assert.equal((await page.locator('#cob-met-pendiente').innerText()).replace(/\s/g,''),expected.replace(/\s/g,''));result.checks.push('collections: real readiness, 50 payments and complete historical debt');
   local.setPhase('return-sales');await page.evaluate(()=>showPage('detalle'));
   await page.waitForFunction(()=>SVDataReadiness.statusFor('detalle').ready&&document.querySelectorAll('#ventas-tbody tr').length===50);
   await page.waitForLoadState('networkidle');
   const reads=local.measures.filter(row=>row.path==='/fixture-read');
   assert.equal(reads.filter(row=>['sisventas/ventas','sisventas/pagos'].includes(row.source)).length,0,'No full sales or payments SDK root reads');
   const bounded=reads.filter(row=>/^sv_commercial_pages\/v1\/(pages|search)(\/|$)/.test(row.source));
   assert(bounded.length>0,'The complete HTML must exercise indexed queries');
   for(const row of bounded)assert(Number.isInteger(row.limit)&&row.limit>=1&&row.limit<=50,'Indexed pages/search query must have a limit of at most 50: '+row.source);
   result.otherDomainRootReads=[...new Set(reads.filter(row=>/^sisventas\/[^/]+$/.test(row.source)).map(row=>row.source))].sort();
   result.checks.push('zero sales/payments SDK root reads; every indexed pages/search query limited to 50');
   assert.equal(local.backend.commands.length,0);assert.equal(local.backend.commits.length,0);assert.deepEqual(local.backend.state.sisventas,before);result.checks.push('return sales: 50 rows; originals unchanged and no writes');result.passed=true;
  }catch(error){result.error=error.message;const p=browser?.contexts()[0]?.pages()[0];if(p)result.diagnostic=await p.evaluate(()=>({filters:window._filtrosVentas,rows:document.querySelectorAll('#ventas-tbody tr').length,status:document.querySelector('#ventas-search-status')?.textContent,text:document.querySelector('#ventas-tbody')?.textContent.slice(0,350),readiness:SVDataReadiness.statusFor('detalle')}));throw error;}
  finally{await browser?.close();await new Promise(resolve=>local.server.close(resolve));result.summary={};for(const r of local.measures){const kind=r.path==='/fixture-read'?'sdk-data':r.path.startsWith('/comerciales/')?'commercial-data':r.path==='/fixture-bootstrap.js'?'fictional-bootstrap':'assets-and-other';const key=r.phase+':'+kind;const group=result.summary[key]||={requests:0,bytes:0};group.requests++;group.bytes+=r.bytes;}fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({notice:'Simulated loopback response payload only; not Firebase wire traffic, billing, USD cost or real service latency. Fictional bootstrap embeds backend state. Only sales/payments SDK root reads are prohibited: full HTML still reads other domains (including expenses, work orders, products and clients), some empty, through their current fallback/configuration. Read-only assertions cover unchanged fictional sisventas state and zero backend commands/commits.',results},null,2));}
 }
 console.log(JSON.stringify({privateOutput:output,results:results.map(({requests,...result})=>result)}));
});
