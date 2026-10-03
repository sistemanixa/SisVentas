const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {functionSource}=require('../helpers/app-functions.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:900}});
  await page.setContent('<style>:root{--bg2:#131d30;--bg3:#1e2c45;--text:#e8eef9;--text2:#b8c7df;--text3:#8ea3c0;--border:#2c3d55;--border2:#3d5475;--blue:#86b5ff;--green:#80d989;--red:#fb8585}body{font-family:Arial;background:#09111e}.btn{padding:10px;border:1px solid #5c7398;border-radius:8px;color:#d5e5ff;background:transparent}.btn-primary{background:#88b3ff;color:#14203a}.search-input{background:#1e2c45;color:#eee;border:1px solid #486181;border-radius:8px}</style>');
  await page.evaluate(()=>{
   window.p={fbKey:'P',codigo:'P-11300',nombre:'MANTENIMIENTO TÉCNICO A DOMICILIO · RADIO EXTENDIDO',compra:97200,venta:126360,iva:21,stock:7};
   window.prodData={P:p};window.manoObraPendienteRevision=()=>[p];window.esProductoManoDeObra=()=>true;window.tienePermiso=()=>true;window.renderRevisionManoObra=()=>{};
   window.precioGremioARSDesdeProducto=p=>p.compra;window.precioVentaCanonicoProducto=p=>({precioARS:p.venta});window.estadoVigenciaPrecioProducto=()=>({texto:'Hace 10 días'});window.escapeHTML=s=>s;
   window.obtenerDolarReferenciaProducto=()=>({valor:1540});window.fbDB={};window.FB_PATHS={productos:'products'};window.fbRef=(_,path)=>path;
   window.fbRunTransaction=async(_,fn)=>{window.saved=fn(p);return {committed:true,snapshot:{val:()=>saved}};};
  });
  await page.addScriptTag({content:functionSource('cambiosRevisionManoObra')+'\n'+functionSource('abrirRevisionManoObra')});
  await page.evaluate(()=>abrirRevisionManoObra());
  await page.locator('#mo-costo').fill('100000');
  assert.equal(await page.locator('#mo-venta').inputValue(),'130000.00');
  assert.match(await page.locator('#mo-final').innerText(),/157.300,00/);
  await page.screenshot({path:'tmp/labor-review-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tmp/labor-review-mobile.png'});
  assert.ok(await page.locator('#mo-venta').isVisible());
  await page.getByRole('button',{name:'Guardar y siguiente'}).click();
  assert.equal(await page.evaluate(()=>saved.compraARS),100000);assert.equal(await page.evaluate(()=>saved.stock),7);
  assert.match(await page.locator('#revision-mano-obra-dialog').innerText(),/Revisión terminada/);
  assert.ok(await page.evaluate(()=>saved.precioActualizadoEn>0));
  await page.getByRole('button',{name:'← Anterior',exact:true}).click();
  assert.equal(await page.locator('#mo-costo').inputValue(),'100000.00');
  assert.equal(await page.locator('#mo-venta').inputValue(),'130000.00');
  assert.equal(await page.getByRole('button',{name:'← Anterior',exact:true}).isDisabled(),true);
  // Usar la confirmación real dentro del dialog nativo, con datos aislados.
  await page.addStyleTag({content:'.sv-system-dialog-overlay{position:fixed;inset:0;z-index:20000;background:#0008;display:flex;align-items:center;justify-content:center}.sv-system-dialog{background:#18283b;padding:24px}.sv-system-dialog-message{max-width:320px}'});
  await page.evaluate(()=>{window._svDialogoCola=Promise.resolve();window.svSincronizarPilaModales=()=>{};window.eliminarProductoPorId=async()=>{if(!await svConfirm('¿Eliminar este ítem?'))return false;if(!await svConfirm('Confirmación final'))return false;delete prodData.P;return true;};});
  await page.addScriptTag({content:[' _svCrearDialogoSistema','svDialogoSistema','svConfirm'].map(n=>functionSource(n.trim())).join('\n')});
  await page.getByRole('button',{name:'Eliminar ítem',exact:true}).click();
  await page.locator('#revision-mano-obra-dialog .sv-system-dialog-overlay').waitFor();
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.getByRole('button',{name:'Eliminar ítem',exact:true}).waitFor({state:'visible'});
  assert.equal(await page.getByRole('button',{name:'Eliminar ítem',exact:true}).isEnabled(),true);
  const before=await page.evaluate(()=>JSON.stringify(p));
  await page.getByRole('button',{name:'Omitir',exact:true}).click();
  assert.equal(await page.evaluate(()=>JSON.stringify(p)),before);
  await page.getByRole('button',{name:'← Anterior',exact:true}).click();
  await page.getByRole('button',{name:'Eliminar ítem',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar',exact:true}).click();
  assert.match(await page.locator('#revision-mano-obra-dialog').innerText(),/Revisión terminada/);
  assert.equal(await page.evaluate(()=>prodData.P),undefined);
  console.log('OK: edición de costo, cálculo con IVA, guardado y diseño móvil');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
