'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{start}=require('./dev-master-audit.cjs');
async function audit(sourceRoot,out){
 const root=path.resolve(sourceRoot);fs.mkdirSync(out,{recursive:true});
 const active=require(path.join(root,'test/helpers/active-app')).readActiveApp();
 const files=['index.html','js/'+active.filename,'js/core/client-account-reader.v1.js','js/modules/client-account-host.v1.js','cotizador/client-account-projections.js'];
 const hashes=()=>Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.isAbsolute(f)?f:path.join(root,f))).digest('hex')]));
 const report={sourceRoot:root,sourceHashes:hashes(),scope:'Aplicación completa; identidad ficticia; arranque nativo; memoria aislada; no reglas remotas ni Historial integrado',cases:[]};
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{for(const scenario of ['populated','empty','missing','new-user']){
  const service=await start(0,{sourceRoot:root,accounts:scenario,fullStartup:true,role:scenario==='new-user'?'administrativo':'admin'}),context=await browser.newContext({viewport:{width:1280,height:950},serviceWorkers:'block'});
  const preserved=()=>JSON.stringify({sales:service.backend.state.sisventas.ventas,payments:service.backend.state.sisventas.pagos,stock:service.backend.state.sisventas.sentinel});
  const financialBefore=preserved(),row={scenario,errors:[],external:[]},page=await context.newPage();report.cases.push(row);
  await context.route('**/*',r=>r.request().url().startsWith(service.url+'/')||/^(blob:|data:)/.test(r.request().url())?r.continue():(row.external.push(r.request().url()),r.abort()));page.on('pageerror',e=>row.errors.push(e.message));
  try{
   const t=performance.now();await page.goto(service.url);await page.locator('#page-dashboard.active').waitFor();row.startupMs=Math.round(performance.now()-t);
   row.beforeAccount=service.requests.length;const enter=performance.now();await page.locator('[onclick="showPage(\'cuentacorriente\',this)"]').click();await page.mouse.move(1000,200);
   await page.waitForFunction(()=>/clientes en esta página|cobertura completa/.test(document.getElementById('cc-contador')?.textContent||''),null,{timeout:10000});
   row.accountMs=Math.round(performance.now()-enter);row.counter=await page.locator('#cc-contador').innerText();row.debt=await page.locator('#cc-met-deuda').innerText();row.rows=await page.locator('#cc-tbody tr[data-account]').count();
   if(scenario==='populated'){
    assert.equal(row.rows,50);assert.match(row.debt,/9\.680,00/);
    const first=await page.locator('#cc-tbody tr[data-account]').first().getAttribute('data-account');
    await page.locator('#cc-native-pages').getByRole('button',{name:'Siguiente',exact:true}).click();
    await page.waitForFunction(old=>document.querySelector('#cc-tbody tr[data-account]')?.dataset.account!==old&&document.getElementById('cc-native-pages').textContent.includes('Página 2'),first);
    row.secondPageRows=await page.locator('#cc-tbody tr[data-account]').count();assert.equal(row.secondPageRows,50);
    await page.locator('#cc-tbody tr[data-account]').first().click();
    await page.waitForFunction(()=>document.getElementById('cc-saldo')?.textContent.includes('80,00'));
    row.detailBalance=await page.locator('#cc-saldo').innerText();row.movements=await page.locator('#cc-movimientos tbody tr').count();assert.equal(row.movements,2);
   }
   if(scenario==='empty'){assert.equal(row.rows,0);assert.match(row.debt,/0,00/);}
   if(scenario==='missing'){assert.equal(row.rows,0);assert.equal(row.debt,'—');assert.match(row.counter,/cobertura completa/);}
   if(scenario==='new-user'){row.emptyUserBlocked=/cobertura completa/.test(row.counter);if(row.emptyUserBlocked)row.openIssue='Usuario nuevo sin scope preparado: no confundir cobertura faltante con saldo cero';else if(row.counter){assert.equal(row.rows,0);assert.match(row.debt,/0,00/);}}
   if(!row.counter)throw Error('La pantalla no conservó un resultado verificable');row.status=row.openIssue?'BLOCKED':'PASS';await page.screenshot({path:path.join(out,scenario+'.png'),fullPage:false});
  }catch(e){row.status='FAIL';row.failure=e.message;await page.screenshot({path:path.join(out,scenario+'-failure.png'),fullPage:false});}
  finally{row.financialUnchanged=financialBefore===preserved();if(!row.financialUnchanged){row.status='FAIL';row.failure='La lectura alteró ventas, cobros o stock ficticios';}row.requests=service.requests;row.fixture=await page.evaluate(()=>({errors:__qa.errors,reads:__qa.reads,writes:__qa.writes,blocked:__qa.blocked})).catch(()=>null);await context.close();await new Promise(r=>service.server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
 }}finally{await browser.close();report.finalSourceHashes=hashes();report.sourceUnchanged=JSON.stringify(report.sourceHashes)===JSON.stringify(report.finalSourceHashes);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
 return report;
}
if(require.main===module)audit(process.argv[2],process.argv[3]).then(r=>{console.log(JSON.stringify(r.cases.map(({scenario,status,startupMs,accountMs,counter,debt,rows,failure,openIssue})=>({scenario,status,startupMs,accountMs,counter,debt,rows,failure,openIssue})),null,2));if(!r.sourceUnchanged||r.cases.some(c=>c.status!=='PASS'))process.exitCode=1;});module.exports={audit};
