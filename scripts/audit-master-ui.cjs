'use strict';
// Audita la interfaz activa contra el fixture aislado. No inicia SDK ni usa credenciales.
const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks');
const {chromium}=require('playwright'),{start}=require('./dev-module-audit.cjs');
async function audit({out,widths=[1280,768,390]}={}){
 if(!out)throw Error('Indicar un directorio local para la evidencia');fs.mkdirSync(out,{recursive:true});
 const server=start(0);await new Promise(r=>server.once('listening',r));const origin='http://127.0.0.1:'+server.address().port;
 const report={schema:1,generatedAt:new Date().toISOString(),source:require('../test/helpers/active-app').readActiveApp().filename,environment:'Chrome headless, loopback, datos ficticios; no mide producción ni certifica permisos remotos',coverage:'Navegación y editores; cada operación de guardado requiere prueba funcional separada',runs:[]};
 let browser;try{browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 for(const width of widths){const context=await browser.newContext({viewport:{width,height:950},serviceWorkers:'block'}),page=await context.newPage();
 const run={width,errors:[],externalBlocked:[],routes:[],dialogs:[],editors:[],bytes:0};report.runs.push(run);
 await context.route('**/*',r=>r.request().url().startsWith(origin+'/')||/^(data:|blob:)/.test(r.request().url())?r.continue():(run.externalBlocked.push(r.request().url()),r.abort()));
 page.on('pageerror',e=>run.errors.push(e.message));page.on('response',async r=>{try{run.bytes+=(await r.body()).length;}catch(_){}});
 const begin=performance.now();await page.goto(origin);await page.locator('#module-audit-tools').waitFor();run.startupMs=Math.round(performance.now()-begin);
 const inventory=await page.locator('.page[id^="page-"]').evaluateAll(nodes=>nodes.map(n=>({id:n.id.slice(5),title:n.querySelector('h1,h2,.card-title,.page-title')?.textContent?.trim()||n.id.slice(5)})));
 for(const item of inventory){const t=performance.now();let row={...item,level:'apertura',status:'pendiente'};const before=run.errors.length;
 try{await page.evaluate(id=>showPage(id),item.id);await page.locator('#page-'+item.id+'.active').waitFor({timeout:3000});await page.waitForFunction(id=>{const p=document.getElementById('page-'+id);return p&&p.getAttribute('aria-busy')!=='true';},item.id,{timeout:4000});
 row=Object.assign(row,await page.evaluate(id=>{const p=document.getElementById('page-'+id),tables=[...p.querySelectorAll('table')].map(n=>({id:n.id,rows:n.tBodies[0]?.rows.length||0,pending:n.classList.contains('sv-columns-pending'),visibility:getComputedStyle(n).visibility}));return {tables,overflow:document.documentElement.scrollWidth>innerWidth+1,active:document.querySelector('.page.active')?.id,buttons:[...p.querySelectorAll('button')].filter(b=>b.getClientRects().length&&getComputedStyle(b).visibility!=='hidden').map(b=>(b.getAttribute('aria-label')||b.textContent).trim()).slice(0,35)};},item.id));row.status=row.overflow?'desborde':'abierto';
 }catch(e){row.status='bloqueado';row.reason=e.message.split('\n')[0];}
 row.ms=Math.round(performance.now()-t);row.errors=run.errors.slice(before);run.routes.push(row);process.stdout.write(JSON.stringify({width,module:item.id,status:row.status,ms:row.ms})+'\n');
 }
 // Herramientas del fixture invocan los formularios/ventanas nativos. No guardan datos.
 await page.evaluate(()=>showPage('dashboard'));
 for(const [button,key]of [['audit-dialogs','dialogs'],['audit-editors','editors']]){const t=performance.now();try{await page.evaluate(async id=>{await document.getElementById(id).onclick();},button);run[key]=await page.evaluate(key=>__moduleAudit[key],key);}catch(e){run[key+'Error']=e.message.split('\n')[0];}run[key+'Ms']=Math.round(performance.now()-t);}
 run.fixture=await page.evaluate(()=>({errors:__moduleAudit.errors,reads:__moduleAudit.reads,writes:__moduleAudit.writes,blocked:__moduleAudit.blocked,subscriptions:__moduleAudit.subscriptions}));
 await page.screenshot({path:path.join(out,'modules-'+width+'.png'),fullPage:false});fs.writeFileSync(path.join(out,'run-'+width+'.json'),JSON.stringify(run,null,2));await context.close();
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));return report;
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
}
if(require.main===module)audit({out:process.argv[2]}).then(r=>console.log(JSON.stringify({runs:r.runs.map(x=>({width:x.width,routes:x.routes.length,errors:x.errors.length,external:x.externalBlocked.length}))}))).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={audit};
