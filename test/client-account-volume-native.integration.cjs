'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {start}=require('./helpers/client-account-volume-fixture.cjs');
const {chromium}=require('playwright');
const ARTIFACTS='C:/SisVentas/tmp/client-account-volume-v32010';
const normalized=value=>value.replace(/\s/g,'');
const money=cents=>(cents/100).toLocaleString('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:2,maximumFractionDigits:2});
async function fixture(t,width=1280){
 const local=await start();t.after(()=>local.close());
 const browser=await chromium.launch({headless:true,executablePath:process.env.SV_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width,height:960}}),requests=[];page.setDefaultTimeout(10000);
 await page.route('**/*',route=>{const url=route.request().url();requests.push(url);return url.startsWith(local.url+'/')?route.continue():route.abort();});
 const started=performance.now();await page.goto(local.url+'/#/cuentacorriente');
 await page.waitForFunction(()=>document.querySelectorAll('#cc-tbody tr[data-account]').length===50&&!document.getElementById('page-cuentacorriente').classList.contains('sv-data-pending'));
 const coldReadyMs=performance.now()-started;
 async function search(text){await page.locator('#cc-buscador').fill(text);await page.waitForFunction(()=>document.getElementById('cc-contador').textContent.includes('clientes en esta página'));await page.waitForFunction(()=>document.querySelectorAll('#cc-tbody tr[data-account]').length===1);}
 return {local,browser,page,requests,coldReadyMs,search};
}

for(const width of [390,768,1280])test('real Account host/readiness shows complete volume totals and exact history at '+width,async t=>{
 const f=await fixture(t,width),expected=f.local.data.expected.all;
 assert.equal((await f.page.locator('#cc-met-clientes').innerText()).trim(),'225');assert.equal(normalized(await f.page.locator('#cc-met-deuda').innerText()),normalized(money(expected.balanceCents)));
 assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'the page itself must not overflow horizontally');
 assert(f.local.measures.every(r=>!r.path.startsWith('sisventas/')));assert(f.local.measures.filter(r=>r.limit).every(r=>r.limit===50));
 const cold=f.local.measures.slice();await f.search('ZZZ');assert.equal(normalized(await f.page.locator('#cc-met-deuda').innerText()),normalized(money(expected.balanceCents)));
 await f.page.locator('#cc-tbody tr[data-account]').click();await f.page.waitForFunction(()=>window._ccExtractoActual?.nombre==='ZZZ Cliente histórico'&&document.getElementById('cc-client-meta')?.textContent.includes('persona224@example.invalid'));
 assert.equal(normalized(await f.page.locator('#cc-saldo').innerText()),normalized(money(f.local.data.expected.clients.c224.balanceCents)));
 const colors=await f.page.evaluate(()=>{const rgb=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number),lum=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0),background=node=>{for(let p=node;p;p=p.parentElement){const color=getComputedStyle(p).backgroundColor;if(color!=='rgba(0, 0, 0, 0)'&&color!=='transparent')return color;}throw Error('No opaque base');};return{htmlClass:document.documentElement.className,text2:getComputedStyle(document.body).getPropertyValue('--text2'),text3:getComputedStyle(document.body).getPropertyValue('--text3'),targets:['#cc-client-meta','#cc-detail .card-title','#cc-movimientos th','#cc-movimientos td'].map(selector=>{const e=document.querySelector(selector),color=getComputedStyle(e).color,bg=background(e),a=lum(rgb(color)),b=lum(rgb(bg));return{selector,color,background:bg,solidBackgroundContrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};})};});
 assert(colors.htmlClass.includes('sv-v3-preview'));assert(colors.targets.every(row=>row.solidBackgroundContrast>=4.5),'the real default theme must make normal account text readable');
 if(width===390){const scroll=await f.page.locator('#cc-movimientos').evaluate(table=>{const wrap=table.closest('.table-wrap');if(!wrap)throw Error('Actual table-scroll initializer is missing');wrap.scrollLeft=500;return{x:wrap.scrollLeft,overflow:getComputedStyle(wrap).overflowX};});assert(scroll.x>0);assert(['auto','scroll'].includes(scroll.overflow));await f.page.locator('#cc-movimientos').evaluate(table=>{table.closest('.table-wrap').scrollLeft=0;});await f.page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));assert(await f.page.evaluate(()=>scrollY>0));await f.page.evaluate(()=>window.scrollTo(0,0));}
 const originals=f.local.measures.filter(r=>r.path.startsWith('sisventas/'));assert(originals.every(r=>r.path==='sisventas/clientes/c224'));
 fs.mkdirSync(ARTIFACTS,{recursive:true});fs.writeFileSync(ARTIFACTS+'/colors-after-'+width+'.private.json',JSON.stringify(colors,null,2));await f.page.screenshot({path:ARTIFACTS+'/account-volume-'+width+'.private.png',fullPage:true});
 assert.deepEqual(await f.page.evaluate(()=>fixtureTrace.errors),[]);assert.deepEqual(await f.page.evaluate(()=>fixtureTrace.legacy),[]);assert(f.requests.every(url=>url.startsWith(f.local.url+'/')));
 console.log(JSON.stringify({syntheticOnly:true,width,sales:1100,customers:225,coldReadyMs:f.coldReadyMs,coldDataRequests:cold.length,coldJSONBodyBytes:cold.reduce((s,r)=>s+r.bytes,0)}));
});

test('historical ledger goes beyond121 movements and a warm return preserves complete totals without fetching unrelated originals',async t=>{
 const f=await fixture(t);await f.search('Cliente ficticio 000');await f.page.locator('#cc-tbody tr[data-account]').click();await f.page.waitForFunction(()=>window._ccExtractoActual?.movimientos.length===50);
 const ids=new Set(),total=f.local.data.expected.clients.c0.sales+f.local.data.expected.clients.c0.payments;let seen=0;
 for(let page=0;page<5;page++){
  const rows=await f.page.evaluate(()=>structuredClone(_ccExtractoActual.movimientos));seen+=rows.length;for(const row of rows)ids.add(JSON.stringify([row.fecha,row.concepto,row.debe,row.haber]));
  const next=f.page.locator('#cc-native-ledger-pages').getByRole('button',{name:'Siguiente',exact:true});if(await next.isDisabled())break;const label=await f.page.locator('#cc-native-ledger-pages').innerText();await next.click();await f.page.waitForFunction(old=>document.getElementById('cc-native-ledger-pages').innerText!==old,label);
 }
 assert.equal(seen,total);assert.equal(ids.size,seen);assert(seen>121);assert.equal(normalized(await f.page.locator('#cc-saldo').innerText()),normalized(money(f.local.data.expected.clients.c0.balanceCents)));
 await f.page.locator('#fixture-away').click();const count=f.local.measures.length;await f.page.waitForTimeout(80);assert.equal(f.local.measures.length,count);
 await f.page.locator('#fixture-return').click();await f.page.waitForFunction(()=>document.getElementById('cc-contador').textContent.includes('clientes en esta página'));
 assert.equal(normalized(await f.page.locator('#cc-met-deuda').innerText()),normalized(money(f.local.data.expected.all.balanceCents)));
 assert(f.local.measures.filter(r=>r.path.startsWith('sisventas/')).every(r=>r.path==='sisventas/clientes/c0'));assert.deepEqual(await f.page.evaluate(()=>fixtureTrace.errors),[]);
});

test('a second synthetic actor changes contact data and name in the current customer without changing finances or performing a full customer reload',async t=>{
 const f=await fixture(t);await f.search('ZZZ');await f.page.locator('#cc-tbody tr[data-account]').click();await f.page.waitForFunction(()=>document.getElementById('cc-client-meta')?.textContent.includes('persona224@example.invalid'));
 const before={sales:f.local.get('sisventas/ventas'),payments:f.local.get('sisventas/pagos'),stock:f.local.get('sisventas/inventario_operativo')},debt=await f.page.locator('#cc-saldo').innerText(),oldReads=f.local.measures.length;
 const second=await f.browser.newContext(),sender=await second.newPage();t.after(()=>second.close());await sender.goto(f.local.url+'/?actor=v#/cuentacorriente');assert.equal(await sender.evaluate(()=>fbAuth.currentUser.uid),'v');assert.equal(await f.page.evaluate(()=>fbAuth.currentUser.uid),'u');
 await sender.evaluate(async()=>{const r=await fetch('/fixture/customer',{method:'POST',headers:{'Content-Type':'application/json','X-Fixture-Actor':currentUserUid},body:JSON.stringify({actor:currentUserUid,clientKey:'c224',changes:{telefono:'0223 555 9999',email:'externo@example.invalid',direccion:'Domicilio ficticio actualizado'}})});if(!r.ok)throw Error('Synthetic second actor failed');});
 await f.page.waitForFunction(()=>document.getElementById('cc-client-meta')?.textContent.includes('externo@example.invalid'));assert.equal(await f.page.locator('#cc-saldo').innerText(),debt);
 await f.local.updateClient('c224',{nombre:'ZZZ Cliente actualizado'},{actor:'v',order:'coverage-first'});
 try{await f.page.waitForFunction(()=>document.getElementById('cc-nombre').textContent==='ZZZ Cliente actualizado');}catch(error){throw Error('Synthetic rename did not converge: '+JSON.stringify({ui:await f.page.evaluate(()=>({name:document.getElementById('cc-nombre').textContent,meta:document.getElementById('cc-client-meta')?.textContent,counter:document.getElementById('cc-contador').textContent,notice:document.getElementById('fixture-message').textContent,trace:fixtureTrace,subscriptions:[...fixtureSubscriptions.values()].map(v=>v.path)})),revision:f.local.get('sv_client_accounts/v1/coverage/all/revision'),listeners:[...f.local.subscribers.values()].map(v=>v.path),recent:f.local.measures.slice(-12)}));}
 assert.deepEqual(f.local.get('sisventas/ventas'),before.sales);assert.deepEqual(f.local.get('sisventas/pagos'),before.payments);assert.deepEqual(f.local.get('sisventas/inventario_operativo'),before.stock);assert.equal(await f.page.locator('#cc-saldo').innerText(),debt);
 assert(f.local.measures.slice(oldReads).filter(r=>r.path.startsWith('sisventas/')).every(r=>r.path==='sisventas/clientes/c224'));assert.equal(f.local.commits.length,2);assert.deepEqual(await f.page.evaluate(()=>fixtureTrace.errors),[]);
  await f.page.evaluate(()=>{fixturePermission=false;document.dispatchEvent(new Event('sisventas:role-changed'));});await f.page.waitForFunction(()=>!window._ccExtractoActual&&['','—'].includes(document.getElementById('cc-nombre').textContent.trim()));assert.equal(await f.page.locator('#cc-client-meta').innerText(),'');assert.equal(await f.page.locator('#cc-tbody tr[data-account]').count(),0);
});

test('transport comparison uses identical synthetic records and reports full-source body bytes separately from native ready time',async t=>{
 const f=await fixture(t),native=f.local.measures.slice(),baseline=await f.page.evaluate(async()=>{const started=performance.now(),rows=await Promise.all(['ventas','pagos','clientes'].map(async source=>{const response=await fetch('/fixture/baseline?source='+source);const text=await response.text();return{source,bytes:new TextEncoder().encode(text).length,count:Object.keys(JSON.parse(text)).length};}));return{transportAndParseMs:performance.now()-started,rows};});
 assert.equal(baseline.rows[0].count,1100);assert.equal(baseline.rows[2].count,225);assert(native.reduce((s,r)=>s+r.bytes,0)<baseline.rows.reduce((s,r)=>s+r.bytes,0));
 console.log(JSON.stringify({syntheticOnly:true,nativeColdUIReadyMs:f.coldReadyMs,nativeJSONBytes:native.reduce((s,r)=>s+r.bytes,0),nativeRequests:native.length,fullSourceTransportOnlyMs:baseline.transportAndParseMs,fullSourceJSONBytes:baseline.rows.reduce((s,r)=>s+r.bytes,0),fullSourceRequests:3,note:'Baseline is transport/parse, not a legacy UI-ready timing or a production billing measurement.'}));
});
