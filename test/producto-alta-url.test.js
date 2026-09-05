const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/modules/product-url-import.js', 'utf8');
const url = 'https://www.biosegur.com.ar/producto--det--P2822';

function escenario() {
  const ids = ['pf-importar-estado','pf-importar-boton','pf-importar-panel','pf-importar-proveedor','pf-cod-web','pf-nombre','pf-descripcion','pf-marca','pf-imagen-url','pf-es-mano-obra'];
  const nodes = Object.fromEntries(ids.map(id => [id, { id, value: '', checked: false, disabled: false, textContent: '', add() {}, replaceChildren() {} }]));
  nodes['prod-form-view'] = { querySelectorAll: () => ids.map(id => nodes[id]) };
  const calls = [];
  let resolver;
  const context = {
    URL, AbortController, setTimeout, clearTimeout, Option: function () {},
    editingProdId: null, prodProveedoresActuales: [],
    proveedoresData: [{ fbKey: 'bio', nombre: 'BIOSEGUR', web: 'https://www.biosegur.com.ar', password: 'no-debe-viajar' }],
    document: { getElementById: id => nodes[id] }, getComputedStyle: () => ({ display:'block' }),
    SISVENTAS_FUNCTIONS: { cotizadorProveedor: 'https://cotizador.example.com' },
    headersCotizadorProtegido: async () => ({ Authorization: 'Bearer sesion-prueba' }),
    fetch: async (endpoint, options) => { calls.push({ endpoint, options }); return new Promise(resolve => { resolver = resolve; }); },
    completarReferenciaProveedorProducto: p => p,
    renderTablaProveedoresProducto() {}, recalcularCompraDesdeProveedores() {}, actualizarPreviewImagenURL() {},
    normalizarUrlProveedorProducto: s => s
  };
  context.window = context;
  vm.createContext(context); vm.runInContext(source, context);
  context.inicializarFichaProducto(); nodes['pf-cod-web'].value = url; nodes['pf-importar-proveedor'].value = 'bio';
  return { context, nodes, calls, resolver: datos => resolver({ ok: true, json: async () => datos }) };
}
const respuesta = () => ({ ok: true, url, moneda:'ARS', precioArs:1000, sinIva:true, ivaAlicuota:21, identidad:{ok:true}, ficha:{nombre:'Cerradura F-102T', marca:'Trinktech', detalle:'WiFi, huella y PIN', imagenUrl:'https://www.biosegur.com.ar/images/P2822.jpg'} });
const flush = () => new Promise(resolve => setImmediate(resolve));

test('una consulta carga ficha y precio en el borrador sin enviar credenciales del proveedor', async () => {
  const s = escenario();
  const pending = s.context.completarProductoDesdeUrl(); await flush();
  assert.equal(s.calls.length, 1);
  assert.equal(s.context.productoFichaConsultando(), true);
  const body = JSON.parse(s.calls[0].options.body);
  assert.equal(body.url, url); assert.equal(body.altaProducto, true); assert.equal(body.incluirFicha, true);
  assert.equal(body.password, undefined); assert.equal(body.producto, '');
  s.resolver(respuesta()); await pending;
  assert.equal(s.nodes['pf-nombre'].value, 'CERRADURA F-102T');
  assert.equal(s.nodes['pf-marca'].value, 'TRINKTECH');
  assert.equal(s.nodes['pf-descripcion'].value, 'WiFi, huella y PIN');
  assert.match(s.nodes['pf-imagen-url'].value, /P2822.jpg$/);
  assert.equal(s.context.prodProveedoresActuales[0].precio, 1000);
  assert.equal(s.context.prodProveedoresActuales[0].sinIva, true);
  assert.equal(s.context.productoFichaConsultando(), false);
});

test('respuesta demorada no pisa una ficha editada durante la consulta', async () => {
  const s = escenario(); const pending = s.context.completarProductoDesdeUrl(); await flush();
  s.nodes['pf-nombre'].value = 'OTRO PRODUCTO';
  s.resolver(respuesta()); await pending;
  assert.equal(s.nodes['pf-nombre'].value, 'OTRO PRODUCTO');
  assert.equal(s.context.prodProveedoresActuales.length, 0);
  assert.match(s.nodes['pf-importar-estado'].textContent, /No se aplicó/);
});

test('cerrar y volver a abrir el alta descarta el resultado anterior', async () => {
  const s = escenario(); const pending = s.context.completarProductoDesdeUrl(); await flush();
  s.context.inicializarFichaProducto(); s.resolver(respuesta()); await pending;
  assert.equal(s.nodes['pf-nombre'].value, '');
  assert.equal(s.context.prodProveedoresActuales.length, 0);
});

test('URL distinta, precio inválido o ficha ausente no modifican el borrador', async () => {
  for (const cambios of [{url:'https://www.biosegur.com.ar/otro'}, {moneda:'USD'}, {precioArs:0}, {ficha:null}]) {
    const s = escenario(); const pending = s.context.completarProductoDesdeUrl(); await flush();
    s.resolver({...respuesta(), ...cambios}); await pending;
    assert.equal(s.nodes['pf-nombre'].value, '');
    assert.equal(s.context.prodProveedoresActuales.length, 0);
  }
});

test('no consulta la web inicial ni reemplaza datos ya cargados', async () => {
  const s = escenario(); s.nodes['pf-cod-web'].value = 'https://www.biosegur.com.ar/';
  await s.context.completarProductoDesdeUrl(); assert.equal(s.calls.length, 0);
  s.nodes['pf-cod-web'].value = url; s.nodes['pf-nombre'].value = 'MI PRODUCTO';
  await s.context.completarProductoDesdeUrl(); assert.equal(s.calls.length, 0);
  assert.equal(s.nodes['pf-nombre'].value, 'MI PRODUCTO');
});
