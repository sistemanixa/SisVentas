const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/modules/product-url-import.js', 'utf8');
const url = 'https://www.biosegur.com.ar/producto--det--P2822';

function escenario() {
  const ids = ['pf-importar-estado','pf-importar-boton','pf-importar-panel','pf-importar-proveedor','pf-cod-web','pf-nombre','pf-descripcion','pf-marca','pf-imagen-url','pf-es-mano-obra','pf-envio-paraguay-panel','pf-envio-paraguay'];
  const nodes = Object.fromEntries(ids.map(id => [id, { id, value: '', checked: false, disabled: false, textContent: '', add() {}, replaceChildren() {} }]));
  nodes['pf-envio-paraguay-panel'].dataset = {};
  nodes['pf-envio-paraguay'].setCustomValidity = () => {};
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

test('el vencimiento libera el botón incluso si la autenticación queda pendiente', async () => {
  const s = escenario();
  let vencer, autenticar;
  s.context.setTimeout = fn => { vencer = fn; return 1; };
  s.context.clearTimeout = () => {};
  s.context.headersCotizadorProtegido = () => new Promise(resolve => { autenticar = resolve; });
  const pendiente = s.context.completarProductoDesdeUrl();
  vencer();
  assert.equal(s.context.productoFichaConsultando(), false);
  assert.equal(s.nodes['pf-importar-boton'].disabled, false);
  assert.match(s.nodes['pf-importar-estado'].textContent, /demoró demasiado/);
  autenticar({}); await pendiente;
  assert.equal(s.calls.length, 0);
  assert.equal(s.context.prodProveedoresActuales.length, 0);
});

test('bloqueo de Mercado Libre informa la causa y conserva la ficha', async () => {
  const s = escenario();
  s.context.proveedoresData[0].nombre = 'MERCADO LIBRE';
  const pendiente = s.context.completarProductoDesdeUrl(); await flush();
  s.resolver({ok:false, mensaje:'API Mercado Libre respondió 403: access_denied'});
  await pendiente;
  assert.match(s.nodes['pf-importar-estado'].textContent, /Mercado Libre bloqueó/);
  assert.equal(s.context.prodProveedoresActuales.length, 0);
  assert.equal(s.nodes['pf-importar-boton'].disabled, false);
});

test('una respuesta posterior al vencimiento no reemplaza la nueva consulta', async () => {
  const s = escenario(); let vencer;
  s.context.setTimeout = fn => { vencer = fn; return 1; };
  s.context.clearTimeout = () => {};
  const anterior = s.context.completarProductoDesdeUrl(); await flush();
  // Guardar el resolvedor del primer fetch antes de iniciar otro.
  const resolverViejo = s.calls[0];
  vencer(); s.resolver(respuesta()); await anterior;
  assert.equal(s.nodes['pf-nombre'].value, '');
  assert.equal(resolverViejo.options.signal.aborted, true);
  const nueva = s.context.completarProductoDesdeUrl(); await flush();
  s.resolver(respuesta()); await nueva;
  assert.equal(s.nodes['pf-nombre'].value, 'CERRADURA F-102T');
});

test('Compras Paraguay selecciona categoría e IVA exento y recalcula, sin alterar otras webs ni una ficha al abrirla', () => {
  const s = escenario();
  s.nodes['pf-iva'] = { value:'21' };
  s.nodes['pf-categoria'] = { value:'OTROS', options:[{value:'COMPRAS PARAGUAY'}] };
  let recalculos = 0;
  s.context.initSearchableSelect = () => {};
  s.context.calcMargen = () => { recalculos++; };
  s.context.sugerirProveedorFicha();
  assert.equal(s.nodes['pf-iva'].value, '21');
  s.nodes['pf-cod-web'].value = 'https://www.comprasparaguai.com.br/producto__5064641/';
  s.context.sugerirProveedorFicha();
  assert.equal(s.nodes['pf-categoria'].value, 'COMPRAS PARAGUAY');
  assert.equal(s.nodes['pf-iva'].value, '0');
  assert.equal(recalculos, 1);
  s.nodes['pf-iva'].value = '10.5';
  s.context.editingProdId = 'guardado';
  s.context.inicializarFichaProducto();
  assert.equal(s.nodes['pf-iva'].value, '10.5');
  assert.equal(recalculos, 1);
});

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

test('editar permite importar otra URL sin duplicar proveedor ni tocar los demás', async () => {
  const s = escenario(); s.context.editingProdId = 'existente';
  s.nodes['pf-nombre'].value = 'NOMBRE ANTERIOR';
  s.context.prodProveedoresActuales = [{nombre:'BIOSEGUR',proveedorKey:'bio',url:'https://www.biosegur.com.ar/anterior',precio:20,identidadConfirmadaManualmente:true},{nombre:'OTRO',proveedorKey:'otro',precio:30}];
  const pending=s.context.completarProductoDesdeUrl(); await flush();
  s.resolver(respuesta()); await pending;
  assert.equal(s.context.prodProveedoresActuales.length,2);
  assert.equal(s.context.prodProveedoresActuales[0].url,url);
  assert.equal(s.context.prodProveedoresActuales[0].identidadConfirmadaManualmente,undefined);
  assert.equal(s.context.prodProveedoresActuales[1].precio,30);
  assert.equal(s.nodes['pf-nombre'].value,'CERRADURA F-102T');
});

test('importar proveedor secundario conserva imagen y ficha principal existente', async () => {
  const s=escenario();s.context.editingProdId='P-9213';
  s.context._productoEditorBase={codWeb:'https://favorito.example/producto'};
  Object.assign(s.nodes['pf-nombre'],{value:'NOMBRE PROPIO'});
  s.nodes['pf-marca'].value='MARCA PROPIA';s.nodes['pf-descripcion'].value='DETALLE PROPIO';s.nodes['pf-imagen-url'].value='https://favorito.example/foto.jpg';
  s.context.prodProveedoresActuales=[{nombre:'Favorito',proveedorKey:'f',url:s.context._productoEditorBase.codWeb,precio:100}];
  const pending=s.context.completarProductoDesdeUrl();await flush();s.resolver(respuesta());await pending;
  assert.equal(s.context.prodProveedoresActuales.length,2);
  assert.equal(s.context.prodProveedoresActuales[1].url,url);
  assert.equal(s.nodes['pf-nombre'].value,'NOMBRE PROPIO');assert.equal(s.nodes['pf-marca'].value,'MARCA PROPIA');assert.equal(s.nodes['pf-descripcion'].value,'DETALLE PROPIO');assert.equal(s.nodes['pf-imagen-url'].value,'https://favorito.example/foto.jpg');
  assert.equal(s.nodes['pf-cod-web'].value,url); // La URL escrita por el usuario tampoco se revierte automáticamente.
});
