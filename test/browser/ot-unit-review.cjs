'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const out='C:/SisVentas/tmp/priority3157/ot-browser';
async function main(){fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),results=[];
try{for(const viewport of [{width:320,height:568},{width:390,height:844},{width:768,height:1024},{width:1280,height:900}])for(const manual of [false,true]){
 const page=await browser.newPage({viewport}),errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));
 const html='<!doctype html><html lang="es" class="dark-mode"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+fs.readFileSync('css/app.css','utf8')+fs.readFileSync('css/ot-unit-confirmation.css','utf8')+'</style><body class="dark-mode"><button id="start">Equipos y garantías · ejemplo ficticio</button><div style="height:160vh"></div></body></html>';
 await page.route('**/*',route=>{if(route.request().url()==='http://127.0.0.1:8932/ot.html')return route.fulfill({status:200,contentType:'text/html',body:html});external.push(route.request().url());return route.abort();});await page.goto('http://127.0.0.1:8932/ot.html');
 await page.addScriptTag({path:path.resolve('js/core/ot-unit-confirmation.v1.js')});await page.addScriptTag({path:path.resolve('js/modules/ot-unit-confirmation.js')});
 await page.evaluate(manual=>{
  const sale={fbKey:'fictitious-sale',id:'V-FICTICIA',items:{locks:{desc:'Cerradura ficticia',qty:5,unidad:'Unidad',...(manual?{}:{garantiaLinea:'locks',garantiaConfig:{estado:'si',meses:12,inicio:'instalacion',serie:true,equipo:true}})},labor:{desc:'Instalación ficticia',qty:5,esManoDeObra:true}}};
  window.__calls=[];window.__controller=SVOTUnitReviewFactory.create({document,model:SVOTUnitConfirmation,today:()=> '2026-10-27',context:()=>()=>true,request:async(action,body)=>{__calls.push({action,body});if(action==='preparar')return {sale,revision:'a'.repeat(64),capabilities:{manualReview:manual,equipos:true,garantias:true,reviewOT:true},existing:{},manualUnits:manual?Array.from({length:5},(_,n)=>({itemKey:'locks',n,key:'unidad_manual_fake_'+n})):[]};return {ok:true,registered:Array.from({length:5},(_,n)=>'unidad_fake_'+n),preserved:[],reviewed:[],estadoInst:'instalado'};}});
  document.getElementById('start').onclick=()=>{window.__result=null;__controller.open({fbKey:'fictitious-ot',id:'OT-FICTICIA'}).then(r=>__result=r);};
 },manual);
 await page.locator('#start').click();const dialog=page.locator('dialog');await dialog.waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelectorAll('.ot-unit-card').length===5);
 assert.equal(await page.locator('.ot-unit-card').count(),5);assert.equal(await page.locator('.ot-unit-card').filter({hasText:'Instalación ficticia'}).count(),0);
 const rect=await dialog.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=viewport.width&&rect.y>=0&&rect.y+rect.height<=viewport.height);
 for(let n=0;n<5;n++){
  const card=page.locator('.ot-unit-card').nth(n);await card.locator('.ot-unit-decision select').selectOption('instalado');
  await card.locator('.ot-unit-fields input').nth(0).fill('FICTICIA-'+n);await card.locator('.ot-unit-fields input').nth(1).fill('Acceso ficticio '+n);
  if(manual){await card.getByRole('button',{name:'Revisar condiciones',exact:true}).click();const grid=card.locator('.ot-unit-manual-grid');await grid.locator('select').nth(0).selectOption('si');await grid.locator('input[type=number]').fill('12');await grid.locator('select').nth(1).selectOption('instalacion');await grid.locator('select').nth(2).selectOption('si');await grid.locator('input[type=date]').fill('2026-10-27');await card.locator('input[type=checkbox]').check();}
 }
 await page.screenshot({path:path.join(out,(manual?'manual':'technical')+'-'+viewport.width+'.png')});
 const scroll=await page.evaluate(()=>scrollY);await dialog.locator('.ot-unit-body').evaluate(e=>e.scrollTop=e.scrollHeight);assert.equal(await page.evaluate(()=>scrollY),scroll);
 await dialog.getByRole('button',{name:'Guardar confirmación',exact:true}).click();await page.waitForFunction(()=>__result!==null);assert.equal(await dialog.count(),0);const calls=await page.evaluate(()=>__calls);assert.equal(calls.length,2);assert.equal(calls[1].body.units.length,5);assert.equal(new Set(calls[1].body.units.map(r=>r.serie)).size,5);assert.equal(calls[1].body.units.every(r=>manual?r.manual?.confirmado===true:!Object.hasOwn(r,'manual')),true);assert.equal(await page.evaluate(()=>document.activeElement.id),'start');assert.deepEqual(errors,[]);assert.deepEqual(external,[]);results.push({viewport,manual,units:5,serials:5,focusRestored:true,externalRequests:0,realWrites:0});await page.close();
}}finally{await browser.close();}fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({result:'PASS',cases:results,limits:'Real DOM/controller/CSS with fictitious request adapter. Backend guard tested separately in memory. No physical camera or authenticated production save.'},null,2));console.log(JSON.stringify({result:'PASS',cases:results.length,externalRequests:0,realWrites:0}));}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
