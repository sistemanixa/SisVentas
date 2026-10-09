const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{const p=await browser.newPage();let rate=1500;
await p.route('http://127.0.0.1:8765/**',r=>{const path=new URL(r.request().url()).pathname.slice(1);if(['catalogo.html','js/public-catalog.js','js/public-catalog-currency.js','js/public-catalog-cart.js','css/public-catalog.css'].includes(path))return r.fulfill({body:fs.readFileSync(path),contentType:path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':'text/html'});r.abort();});
await p.route('**/tipoCambio/*.json',r=>r.fulfill({json:r.request().url().includes('dolarConversion')?'oficial':rate}));
await p.route('**/sv_catalogo_publico**',r=>r.fulfill({json:r.request().url().includes('_index')?{a:true}:{nombre:'Teléfono',marca:'Marca',descripcion:'Ficha',precioUSD:100,referenciaMLUSD:150,iva:0}}));
await p.goto('http://127.0.0.1:8765/catalogo.html');await p.locator('.tile').waitFor();await p.getByRole('button',{name:'Pesos',exact:true}).click();assert.match(await p.locator('.public-price').innerText(),/ARS \$ 150.000,00/);assert.match(await p.locator('.ml-comparison').innerText(),/Ahorrás ARS \$ 75.000,00/);
await p.locator('[data-add]').click();await p.locator('.cart-toggle').click();assert.match(await p.locator('.cart-total').innerText(),/150.000,00/);await p.getByRole('button',{name:'Cerrar carrito'}).click();
await p.locator('.tile-link').click();assert.match(await p.locator('.info .public-price').innerText(),/150.000,00/);
rate=1600;await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await p.waitForFunction(()=>document.querySelector('.public-price').textContent.includes('160.000,00'));
await p.reload();await p.waitForFunction(()=>document.querySelector('.public-price')?.textContent.includes('160.000,00'));
for(const width of [360,768,1280]){await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
await p.getByRole('button',{name:'US$',exact:true}).click();assert.match(await p.locator('.public-price').innerText(),/US\$ 100,00/);
rate=0;await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await p.waitForFunction(()=>document.querySelector('[data-currency="ARS"]').disabled);assert.match(await p.locator('.public-price').innerText(),/US\$ 100,00/);
console.log('PASS monedas, referencia y ahorro, carrito, ficha, recarga, actualización de dólar, cotización inválida y tamaños móvil/tablet.');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
