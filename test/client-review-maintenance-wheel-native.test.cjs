'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module'),{chromium}=require('playwright');
const sourceRoot=path.resolve(process.env.SV_CLIENT_REVIEW_WHEEL_SOURCE_ROOT||path.join(__dirname,'..')),at=createRequire(path.join(sourceRoot,'cotizador/index.js'));
for(const width of [1280,390])test('complete index keeps maintenance behind client review and native TD wheel scrolls only its list '+width,{timeout:20000},async()=>{
 const f=await at('../test/fixtures/commercial-full-app.cjs').start({count:1});let browser;
 try{
  for(let i=0;i<100;i++)f.backend.state.sisventas.clientes['wheel-'+i]={id:'C-WHEEL-'+i,nombre:'Grupo rueda ficticio '+Math.floor(i/2),dir:'Dirección ficticia '+i,activo:true};
  const original=structuredClone(f.backend.state.sisventas);
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(6000);await page.addInitScript(()=>localStorage.setItem('nixa_dark','1'));
  await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(f.url).origin?r.continue():r.abort());
  await page.goto(f.url);await page.waitForFunction(()=>document.querySelectorAll('#ventas-tbody tr').length===1);await page.evaluate(()=>showPage('configuracion'));await page.getByRole('button',{name:'Mantenimiento',exact:true}).click();
  const opener=page.getByRole('button',{name:'Revisar clientes',exact:true});await opener.scrollIntoViewIfNeeded();const writes=await page.evaluate(()=>__moduleAudit.writes.length);
  const beforeOpen=await page.evaluate(()=>({body:document.scrollingElement.scrollTop,content:document.querySelector('.content').scrollTop}));
  await opener.click();await page.waitForFunction(()=>document.querySelectorAll('#clientes-review-lista .clientes-review-group').length===50);
  a.equal(await page.locator('#page-configuracion.active #cfg-mantenimiento').isVisible(),true);a.equal(await page.locator('#page-clientes.active').count(),0,'Opening review must not navigate to Clientes');
  await page.waitForFunction(()=>document.body.classList.contains('sv-modal-stack-open'));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const background=await page.evaluate(()=>({body:document.scrollingElement.scrollTop,content:document.querySelector('.content').scrollTop}));console.log('CLIENT_REVIEW_OPEN '+JSON.stringify({width,beforeOpen,afterOpen:background}));
  const list=page.locator('#clientes-review-lista'),initial=await list.evaluate(n=>({top:n.scrollTop,client:n.clientHeight,total:n.scrollHeight}));a(initial.total>initial.client);a.equal(initial.top,0);
  const box=await list.boundingBox(),point=width===1280?{x:600,y:600}:await page.locator('#clientes-review-lista td').first().evaluate(n=>{const r=n.getBoundingClientRect();return{x:r.x+Math.min(100,r.width/2),y:r.y+r.height/2};});
  a(point.y>=box.y&&point.y<box.y+box.height);a.equal(await page.evaluate(p=>!!document.elementFromPoint(p.x,p.y)?.closest('#clientes-review-lista td'),point),true,'Native wheel must hit a table cell, not empty list padding');
  await page.evaluate(()=>{window.__clientWheel=[];document.addEventListener('wheel',e=>{queueMicrotask(()=>__clientWheel.push({trusted:e.isTrusted,prevented:e.defaultPrevented,target:e.target.tagName}));},{passive:true,capture:true});});
  await page.mouse.move(point.x,point.y);await page.mouse.wheel(0,600);await page.waitForFunction(()=>document.getElementById('clientes-review-lista').scrollTop>0);
  const scrolled=await list.evaluate(n=>n.scrollTop);a(scrolled>0);a.deepEqual(await page.evaluate(()=>({body:document.scrollingElement.scrollTop,content:document.querySelector('.content').scrollTop})),background);a.equal(await page.evaluate(()=>document.body.classList.contains('sv-modal-stack-open')),true);
  const events=await page.evaluate(()=>__clientWheel);a(events.length>0);a(events.every(e=>e.trusted&&!e.prevented));
  await page.locator('#modal-revision-clientes .modal-foot').getByRole('button',{name:'Cerrar',exact:true}).click();await page.locator('#modal-revision-clientes.open').waitFor({state:'hidden'});await page.waitForFunction(()=>!document.body.classList.contains('sv-modal-stack-open'));
  a.equal(await opener.evaluate(n=>document.activeElement===n),true,'Closing restores focus to the maintenance opener');a.equal(await page.locator('#page-configuracion.active #cfg-mantenimiento').isVisible(),true);
  a.equal(await page.evaluate(()=>__moduleAudit.writes.length),writes);a.equal(f.backend.commands.length,0);a.equal(f.backend.commits.length,0);a.deepEqual(f.backend.state.sisventas,original);
  console.log('CLIENT_REVIEW_WHEEL '+JSON.stringify({width,point,initial,scrolled,backgroundStayed:true,writes:0}));
 }finally{await browser?.close();f.server.closeAllConnections();await new Promise(resolve=>f.server.close(resolve));}
});
