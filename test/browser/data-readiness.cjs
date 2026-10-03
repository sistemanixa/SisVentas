const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage();
 await page.setContent('<main id="page-actualizadorprecios"><p id="empty">0 productos</p><button>Actualizar mano de obra</button></main>');
 await page.addScriptTag({content:fs.readFileSync('js/core/data-readiness.js','utf8')});
 await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 await page.waitForFunction(()=>document.querySelector('[data-sv-data-status]'));
 assert.equal(await page.locator('#empty').isVisible(),false);
 assert.match(await page.locator('[data-sv-data-status]').innerText(),/Cargando datos/);
 await page.evaluate(()=>{window.product=SVDataReadiness.begin('https://test/sisventas/productos');product.ready();window.provider=SVDataReadiness.begin('https://test/sisventas/proveedores');provider.error();});
 await page.waitForFunction(()=>document.querySelector('.sv-data-error'));
 assert.match(await page.locator('[data-sv-data-status]').innerText(),/No se pudieron cargar/);
 assert.equal(await page.locator('#empty').isVisible(),false);
 await page.evaluate(()=>provider.ready());
 await page.waitForFunction(()=>!document.querySelector('[data-sv-data-status]'));
 assert.equal(await page.locator('#empty').isVisible(),true);
 console.log('OK: carga inicial, fallo, recuperación y vacío confirmado');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
