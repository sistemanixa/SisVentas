const assert = require('assert');
const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:8080/index.html?verify=catalogo-clientes-test', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.renderCatalogo === 'function');
  await page.evaluate(() => {
    window.__catalogoTestData = {
      a: { fbKey:'a', codigo:'P-100', nombre:'CÁMARA COLOR VU', descripcion:'Detalle interno', catalogoDescripcion:'Imagen color las 24 horas.', marca:'HIKVISION', categoria:'CÁMARAS', imagenUrl:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300"><rect width="500" height="300" fill="white"/></svg>', catalogoVisible:true, catalogoDestacado:true, estado:'activo', stock:99, venta:999999, compra:1, proveedor:'Privado' },
      b: { fbKey:'b', codigo:'P-101', nombre:'ALARMA AX PRO', marca:'HIKVISION', categoria:'ALARMAS', estado:'activo' },
      c: { fbKey:'c', nombre:'SERVICIO TÉCNICO', catalogoVisible:true, estado:'activo', esManoDeObra:true },
      d: { fbKey:'d', nombre:'PRODUCTO OCULTO', catalogoVisible:false, estado:'activo' },
      e: { fbKey:'e', nombre:'PRODUCTO INACTIVO', catalogoVisible:true, estado:'inactivo' }
    };
    window.prodData = window.__catalogoTestData;
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.getElementById('screen-app').style.display = 'block';
    document.getElementById('page-catalogo').classList.add('active');
    window.renderCatalogo();
  });

  assert.equal(await page.locator('.catalogo-card').count(), 2, 'Sólo deben verse productos activos, físicos y publicados');
  assert.equal(await page.locator('.catalogo-card.destacado').count(), 1, 'El destacado debe conservar prioridad visual');
  assert.equal(await page.locator('#catalogo-categorias-rapidas .catalogo-chip').count(), 3, 'Deben conservarse las categorías horizontales y Todos');
  const cardsText = await page.locator('#catalogo-grid').innerText();
  ['P-100', '999999', 'Privado', 'Detalle interno'].forEach(secret => assert(!cardsText.includes(secret), `No debe exponerse ${secret}`));

  const busquedaCount = await page.evaluate(() => {
    window.prodData = window.__catalogoTestData;
    document.getElementById('catalogo-buscar').value = 'alarma';
    window.renderCatalogo();
    return document.querySelectorAll('.catalogo-card').length;
  });
  assert.equal(busquedaCount, 1, 'La búsqueda debe filtrar en vivo');
  await page.evaluate(() => { document.getElementById('catalogo-buscar').value = ''; window.prodData = window.__catalogoTestData; window.renderCatalogo(); });
  await page.evaluate(() => { window.prodData = window.__catalogoTestData; window.abrirCategoriasCatalogo(); });
  assert.equal(await page.locator('#catalogo-categorias-modal').evaluate(el => el.style.display), 'flex', 'El explorador grande debe abrirse');
  assert.equal(await page.locator('#catalogo-categorias .catalogo-categoria-opcion').count(), 3, 'El explorador debe listar todas las categorías y Todos');
  const categoriaCount = await page.evaluate(() => {
    window.prodData = window.__catalogoTestData;
    window.seleccionarCategoriaCatalogo('CÁMARAS');
    return document.querySelectorAll('.catalogo-card').length;
  });
  assert.equal(categoriaCount, 1, 'La categoría debe filtrar sin alterar datos');
  assert.equal(await page.locator('#catalogo-categorias-modal').evaluate(el => el.style.display), 'none', 'Elegir una categoría debe cerrar el explorador');
  await page.evaluate(() => { window.prodData = window.__catalogoTestData; window.abrirProductoCatalogo('a'); });
  assert((await page.locator('#catalogo-modal-nombre').innerText()).includes('CÁMARA'));
  assert(!(await page.locator('#catalogo-modal').innerText()).includes('999999'), 'El detalle tampoco expone valores internos');
  assert.equal(await page.locator('.catalogo-ficha-interna').innerText(), 'Ver ficha interna con valores');
  await page.evaluate(() => { window.catalogoCategoriaActual = ''; window.renderCatalogo(); window.abrirProductoCatalogo('a'); });
  const laterales = await page.evaluate(() => {
    const anterior = document.getElementById('catalogo-anterior').getBoundingClientRect();
    const siguiente = document.getElementById('catalogo-siguiente').getBoundingClientRect();
    return { anteriorX:anterior.left, siguienteDerecha:window.innerWidth - siguiente.right, ancho:anterior.width };
  });
  assert(laterales.anteriorX <= 20 && laterales.siguienteDerecha <= 20 && laterales.ancho >= 58, 'Las flechas deben permanecer grandes y pegadas a los laterales');
  await page.keyboard.press('ArrowRight');
  assert((await page.locator('#catalogo-modal-nombre').innerText()).includes('ALARMA'), 'Flecha derecha debe avanzar al producto siguiente');
  await page.keyboard.press('ArrowLeft');
  assert((await page.locator('#catalogo-modal-nombre').innerText()).includes('CÁMARA'), 'Flecha izquierda debe regresar al producto anterior');
  const categoriaDesdeDetalle = await page.evaluate(() => {
    document.getElementById('catalogo-buscar').value = 'texto anterior';
    window.verCategoriaDesdeDetalleCatalogo();
    return {
      modal:document.getElementById('catalogo-modal').style.display,
      busqueda:document.getElementById('catalogo-buscar').value,
      categoria:window.catalogoCategoriaActual,
      cantidad:document.querySelectorAll('.catalogo-card').length
    };
  });
  assert.deepEqual(categoriaDesdeDetalle, { modal:'none', busqueda:'', categoria:'CÁMARAS', cantidad:1 }, 'La categoría del detalle debe mostrar todos sus productos y limpiar búsquedas previas');
  const retornoCatalogo = await page.evaluate(() => {
    window.prodData = window.__catalogoTestData;
    window.isAuthenticated = true;
    window.currentRole = 'admin';
    document.getElementById('catalogo-buscar').value = 'cam';
    window.catalogoCategoriaActual = 'CÁMARAS';
    window.abrirProductoCatalogo('a');
    window.abrirFichaInternaDesdeCatalogo();
    window.cerrarDetalleProducto();
    const activa = document.querySelector('.page.active');
    return { pagina:activa && activa.id, busqueda:document.getElementById('catalogo-buscar').value, categoria:window.catalogoCategoriaActual };
  });
  assert.deepEqual(retornoCatalogo, { pagina:'page-catalogo', busqueda:'cam', categoria:'CÁMARAS' }, 'Volver desde la ficha interna debe restaurar el catálogo y sus filtros');

  await page.evaluate(() => {
    window.cerrarProductoCatalogo();
    window.prodData = window.__catalogoTestData;
    window.seleccionarCategoriaCatalogo('');
    document.getElementById('screen-login').style.display = 'none';
    document.getElementById('screen-app').style.display = 'block';
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.getElementById('page-catalogo').classList.add('active');
    const grid = document.getElementById('catalogo-grid');
    grid.innerHTML = Array(8).fill(grid.innerHTML).join('');
  });
  await page.waitForTimeout(80);
  await page.evaluate(() => { document.querySelector('.content').scrollTop = 620; });
  await page.waitForTimeout(80);
  await page.evaluate(() => { document.getElementById('screen-login').style.display = 'none'; document.getElementById('screen-app').style.display = 'block'; });
  fs.mkdirSync('test-output', { recursive:true });
  await page.screenshot({ path:'test-output/catalogo-local-verificado.png', fullPage:false });

  await browser.close();
  console.log('catalogo-clientes-v330: OK');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
