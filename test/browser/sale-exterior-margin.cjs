const {chromium}=require('playwright'),assert=require('node:assert/strict');
const src=require('../helpers/active-app').readActiveApp().source;
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
const page=await browser.newPage();await page.setContent('<main style="padding:20px"></main>');await page.addStyleTag({path:'css/app.css'});
await page.evaluate(()=>{window.obtenerCostoItemVenta=i=>i.costoTotalCompra;window.itemVentaEsManoDeObraReporte=i=>i.cod==='MO';window.importeComprobanteVenta=n=>'$'+n.toLocaleString('es-AR',{minimumFractionDigits:2});});
await page.addScriptTag({content:src.slice(src.indexOf('function _margenCostoGananciaHTML('),src.indexOf('function toggleMargenGanancia('))});
await page.addScriptTag({content:src.slice(src.indexOf('function comparacionMargenExteriorVenta('),src.indexOf('function _calcularBaseComisionVenta('))});
await page.evaluate(()=>{document.querySelector('main').innerHTML=comparacionMargenExteriorVentaHTML([{cod:'A',qty:2,origenCompra:'Exterior',costoUnitarioAntesPreparacion:200000,costoTotalCompra:200000},{cod:'MO',qty:1,costoTotalCompra:50000}],1000000);});
for(const width of [1200,768,390]){await page.setViewportSize({width,height:700});assert.equal(await page.locator('.sale-exterior-margin section').count(),2);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const boxes=await page.locator('.sale-exterior-margin section').evaluateAll(es=>es.map(e=>({top:e.getBoundingClientRect().top,left:e.getBoundingClientRect().left})));if(width>=768)assert.equal(boxes[0].top,boxes[1].top);else assert.ok(boxes[1].top>boxes[0].top);}
await page.setViewportSize({width:1024,height:650});await page.screenshot({path:'tmp/sale-exterior-margin.png'});console.log('Comparativa original/exterior: escritorio, tablet y móvil sin desbordamiento. OK');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
