'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const sales=require('../scripts/dev-sales-indexed.cjs'),collections=require('../scripts/dev-collections-indexed.cjs');
const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
async function setup(kind){const local=await(kind==='collections'?collections:sales).start(),browser=await chromium.launch({headless:true,executablePath:chrome}),page=await browser.newPage();
 if(kind==='fallback')await page.route('**/js/modules/sales-indexed-host.v1.js',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync('js/modules/commercial-pages-view.v1.js','utf8')+'\n'+fs.readFileSync('js/modules/commercial-pages-host.v1.js','utf8')}));
 const rows=kind==='collections'?'#pagos-tbody tr':kind==='fallback'?'.sv-cpages-table tbody tr':'#ventas-tbody tr';await page.goto(local.url);await page.locator(rows).nth(49).waitFor();
 return{local,browser,page,rows,route:kind==='collections'?'cobranzas':'detalle',close:async()=>{await browser.close();await new Promise(r=>local.server.close(r));}};
}
async function visibility(page,hidden){await page.evaluate(value=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>value});document.dispatchEvent(new Event('visibilitychange'));},hidden);}
const payload=measures=>measures.filter(x=>/\/pages\/|\/search\/|\/totals\/|\/collectionTotals$|^sisventas\//.test(x.path)).length;
test('Dashboard retention requires the actual complete render marker, not only loaded finance',async()=>{const f=await setup('sales');try{
 await f.page.evaluate(()=>{fixtureRoute='dashboard';document.dispatchEvent(new Event('sisventas:page-changed'));});await f.page.waitForFunction(()=>!!SVCommercialPagesHost.financialState());
 assert.equal(await f.page.evaluate(()=>SVCommercialPagesHost.canRetainView('dashboard')),false);
 await f.page.evaluate(()=>SVCommercialPagesHost.dashboardPainted());assert.equal(await f.page.evaluate(()=>SVCommercialPagesHost.canRetainView('dashboard')),true);
 }finally{await f.close();}});
for(const kind of ['sales','collections','fallback'])test(kind+': warm foreground keeps exact DOM/page/scroll and reads only metadata',async()=>{const f=await setup(kind);try{
 if(kind==='sales')await f.page.locator('#ventas-search').fill('Cliente');
 if(kind==='collections')await f.page.evaluate(()=>{_cobFiltroActual='mes';SVCommercialPagesHost.renderList();});
 if(kind!=='fallback'){await f.page.locator(f.rows).nth(49).waitFor();await f.page.waitForFunction(()=>!document.getElementById('ventas-list-view')?.hasAttribute('aria-busy')&&document.getElementById('pagos-tbody')?.style.visibility!=='hidden');}
 await f.page.getByRole('button',{name:'Siguiente',exact:true}).click();await f.page.getByText(/Página 2|página 2/).first().waitFor();await f.page.locator(f.rows).nth(49).waitFor();
 await f.page.evaluate(selector=>{window.__retainedRow=document.querySelector(selector);window.__retainedText=__retainedRow.textContent;window.scrollTo(0,250);window.__scroll=scrollY;window.__metadataCalls=0;const old=fbGet;window.fbGet=async spec=>{const value=await old(spec);if(/coverage$|config$/.test(spec.path))__metadataCalls++;return value;};},f.rows);
 const beforePayload=payload(f.local.measures);await visibility(f.page,true);const hidden=f.local.measures.length;await f.page.evaluate(()=>dispatchEvent(new Event('sisventas:connection-lost')));assert.equal(await f.page.evaluate(selector=>document.querySelector(selector)===__retainedRow,f.rows),true);
 await f.page.waitForTimeout(30);assert.equal(f.local.measures.length,hidden);await visibility(f.page,false);await f.page.evaluate(()=>{dispatchEvent(new Event('sisventas:connection-restored'));dispatchEvent(new Event('online'));});await f.page.waitForFunction(()=>__metadataCalls>=3);
 assert.equal(payload(f.local.measures),beforePayload);assert.equal(await f.page.evaluate(selector=>document.querySelector(selector)===__retainedRow,f.rows),true);assert.equal(await f.page.evaluate(()=>scrollY===__scroll),true);assert.equal(await f.page.evaluate(name=>SVCommercialPagesHost.canRetainView(name),f.route),true);assert.equal(await f.page.evaluate(()=>SVCommercialPagesHost.canRetainView('unrelated')),false);
 }finally{await f.close();}});
for(const kind of ['sales','collections'])test(kind+': callbacks from a paused subscription cannot clear or repopulate retained rows',async()=>{const f=await setup(kind);try{
 await f.page.evaluate(()=>{const previous=fbOnValue;window.fbOnValue=(ref,callback,error)=>{window.__staleCoverage=callback;window.__staleError=error;return previous(ref,callback,error);};});
 await visibility(f.page,true);await visibility(f.page,false);await f.page.waitForFunction(()=>typeof __staleCoverage==='function');await f.page.evaluate(selector=>window.__rowBeforePause=document.querySelector(selector),f.rows);await visibility(f.page,true);
 const at=f.local.measures.length;await f.page.evaluate(()=>{__staleCoverage({val:()=>({schema:1,ready:false,generation:'foreign',revision:999})});__staleError?.(Error('old callback'));});assert.equal(await f.page.evaluate(selector=>document.querySelector(selector)===__rowBeforePause,f.rows),true);assert.equal(f.local.measures.length,at);
 }finally{await f.close();}});
for(const kind of ['sales','collections','fallback'])test(kind+': changed coverage refreshes in background without hiding old rows',async()=>{const f=await setup(kind);let release;try{
 await f.page.getByRole('button',{name:'Siguiente',exact:true}).click();await f.page.getByText(/Página 2|página 2/).first().waitFor();await f.page.locator(f.rows).nth(49).waitFor();await f.page.evaluate(selector=>window.__retainedRow=document.querySelector(selector),f.rows);
 let changed=false,entered;const blocked=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 await f.page.route('**/api/read?**',async route=>{const spec=JSON.parse(new URL(route.request().url()).searchParams.get('spec')),response=await route.fetch(),value=await response.json();if(changed&&spec.order&&spec.path.includes('/pages/')){entered();await gate;}if(changed&&(/coverage$|\/totals\/|\/collectionTotals$/.test(spec.path))&&value)value.revision=2;await route.fulfill({response,body:JSON.stringify(value)});});
 await visibility(f.page,true);changed=true;await visibility(f.page,false);await blocked;
 assert.equal(await f.page.evaluate(selector=>document.querySelector(selector)===__retainedRow,f.rows),true);assert.equal(await f.page.locator(f.rows).first().isVisible(),true);if(kind!=='fallback')assert.equal(await f.page.locator(kind==='sales'?'#ventas-search-status':'#cob-contador').textContent(),'Actualizando…');
 release();await f.page.waitForFunction(selector=>document.querySelector(selector)!==__retainedRow,f.rows);if(kind!=='fallback')assert.equal(await f.page.getByText('Página 2',{exact:true}).count(),1);
 }finally{release?.();await f.close();}});
for(const kind of ['sales','collections','fallback'])test(kind+': denied resume purges old presentation rather than retaining unauthorized rows',async()=>{const f=await setup(kind);try{
 await visibility(f.page,true);await f.page.route('**/api/read?**',route=>{const spec=JSON.parse(new URL(route.request().url()).searchParams.get('spec'));return spec.path==='sv_commercial_pages_config'?route.fulfill({status:403,body:'{}'}):route.continue();});await visibility(f.page,false);await f.page.waitForFunction(name=>SVCommercialPagesHost.canRetainView(name)===false,f.route);await f.page.waitForFunction(selector=>document.querySelectorAll(selector).length===0,f.rows);assert.equal(await f.page.evaluate(name=>SVCommercialPagesHost.canRetainView(name),f.route),false);
 }finally{await f.close();}});
