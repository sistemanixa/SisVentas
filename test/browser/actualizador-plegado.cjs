const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {functionSource}=require('../helpers/app-functions.cjs');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:900,height:700}});await page.setContent('<body></body>');
 await page.evaluate(()=>{
 window.tienePermiso=()=>true;window.limpiarVariacionesPrecioObsoletas=()=>{};window.leerSeleccionProveedoresActualizador=()=>({ciardi:true});window.proveedoresSeleccionadosActualizador=()=>['ciardi'];window.productosBiosegurActualizables=()=>[{tipo:'ciardi',producto:{},proveedor:{}}];window.tiposProveedoresActualizador=()=>[{id:'ciardi',nombre:'CIARDI'}];window.estadoVigenciaPrecioProveedor=()=>({vigente:false});window.actualizadorProveedorActual=x=>x.proveedor;window._actualizadorSesionPrecios={procesados:{},candidatos:[],fallos:[]};window.actualizadorClaveItem=()=> '1';window.actualizadorItemsSesionParaTipos=x=>x;window.escapeHTML=x=>x;window.mostrarVistaPreviaActualizador=()=>{};window.actualizadorActualizarSeleccionPreview=()=>{};
 });
 for(const name of ['plegarConfiguracionActualizador','actualizarControlesProcesoActualizador','abrirActualizadorMasivoPrecios'])await page.addScriptTag({content:functionSource(name)});
 await page.evaluate(()=>abrirActualizadorMasivoPrecios());
 assert.equal(await page.locator('#actualizador-incluir-vigentes').isVisible(),true);
 const before=await page.locator('#actualizador-precios-fallos').boundingBox();
 await page.evaluate(()=>plegarConfiguracionActualizador(document.getElementById('modal-actualizador-precios')));
 assert.equal(await page.locator('#actualizador-incluir-vigentes').isVisible(),false);
 assert.equal(await page.locator('#actualizador-proceso-metricas').isVisible(),false);
 assert.equal(await page.locator('#actualizador-precios-fallos').isVisible(),true);
 const after=await page.locator('#actualizador-precios-fallos').boundingBox();assert.ok(after.y<before.y);
 await page.getByText('Proveedores y configuración',{exact:true}).click();assert.equal(await page.locator('#actualizador-incluir-vigentes').isVisible(),true);
 await page.evaluate(()=>actualizarControlesProcesoActualizador(document.getElementById('modal-actualizador-precios'),true));assert.equal(await page.locator('#actualizador-incluir-vigentes').isVisible(),true);
 await page.evaluate(()=>{document.getElementById('modal-actualizador-precios').remove();_actualizadorSesionPrecios.fallos=[{}];abrirActualizadorMasivoPrecios();});
 assert.equal(await page.locator('#actualizador-incluir-vigentes').isVisible(),false);
 await page.setViewportSize({width:390,height:740});assert.equal(await page.locator('#actualizador-precios-fallos').isVisible(),true);
 console.log('OK: configuración visible al preparar, plegado al analizar y recuperar resultados, reapertura manual y vista móvil');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
