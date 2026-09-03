const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v3.3.7.js', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');
const inicioPagina = html.indexOf('<div id="page-catalogo"');
const inicioModalProducto = html.indexOf('<div id="catalogo-modal"');
const inicioModalCategorias = html.indexOf('<div id="catalogo-categorias-modal"');
const inicioProductos = html.indexOf('<!-- ── PRODUCTOS ── -->');
const fragmento = html.slice(inicioPagina, inicioProductos);

assert(inicioPagina >= 0 && inicioModalProducto > inicioPagina && inicioModalCategorias > inicioModalProducto,
  'Los modales del catálogo deben existir después del contenido principal.');
assert(app.includes('onclick="abrirProductoCatalogo('),
  'Las tarjetas deben conservar la apertura del detalle.');
assert(app.includes("pagina.classList.toggle('catalogo-presentacion-activa', activar)"),
  'La presentación debe usar el modo propio de la aplicación para conservar los clics.');
assert(!app.includes('pagina.requestFullscreen'),
  'La presentación no debe depender del fullscreen nativo que bloqueaba el detalle.');
assert(!app.includes('precioVentaCatalogoHtml'),
  'El catálogo comercial no debe exponer precios.');
assert(css.includes('.catalogo-presentacion-activa'),
  'El modo presentación debe ocupar la ventana completa.');
assert(css.includes('.catalogo-categorias{flex-wrap:wrap'),
  'Las categorías deben mostrarse completas en varias filas en móvil.');
const aperturas = (fragmento.match(/<div\b/g) || []).length;
const cierres = (fragmento.match(/<\/div>/g) || []).length;
assert.strictEqual(aperturas, cierres,
  'Los modales deben quedar dentro de page-catalogo para que se vean en pantalla completa.');

console.log('OK: el detalle y las categorías permanecen accesibles en modo Presentación.');
