const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');

test('gastos separa la búsqueda de los filtros y ofrece empleado activo', () => {
  assert.match(html, /class="gas-toolbar-search"/);
  assert.match(html, /id="gas-buscar"/);
  assert.match(html, /id="gas-f-empleado"/);
  assert.match(css, /\.gas-toolbar-search\{display:grid/);
  assert.match(app, /function _cargarFiltroEmpleadosGastos\(\)/);
  assert.match(app, /function filtrarGastosPorEmpleado\(\)/);
  assert.match(app, /buscar\.value = nombre/);
  assert.match(html, /id="gas-f-empleado" onchange="filtrarGastosPorEmpleado\(\)"/);
  assert.match(app, /e\.activo !== false/);
});

test('listado y KPIs cambian con el empleado seleccionado', () => {
  assert.match(app, /var fEmpleado = \(document\.getElementById\('gas-f-empleado'\)/);
  assert.match(app, /var gastosMetricas = \(gastosData \|\| \[\]\)\.filter/);
  assert.match(app, /function _gastoCorrespondeEmpleado\(gasto, empleadoKey, empleadoNombre\)/);
  assert.match(app, /descripcion\.indexOf\(nombre\) >= 0/);
  assert.match(app, /actualizarMetricasGastos\(\);/);
});

test('horas extra usan fecha de imputación y conservan el período trabajado', () => {
  assert.match(app, /function fechaImputacionGasto\(g\)/);
  assert.match(app, /periodoTrabajo: String\(payload\.periodoTrabajo/);
  assert.match(app, /fechaImputacion: _pagableNormFecha\(payload\.fecha\)/);
  assert.match(app, /var fechasPago = _gastoPagosArray\(g\)/);
});

test('todos los gastos abonados se incluyen en el mes efectivo del pago', () => {
  const filtro = app.slice(app.indexOf('function fechaImputacionGasto'), app.indexOf('function _normFechaGasto'));
  assert.match(filtro, /_gastoPagosArray\(g\).*pagoGastoEstaAnulado/);
  assert.match(filtro, /_normFechaGasto\(g\.fechaPago \|\| ''\)/);
  assert.match(filtro, /_normFechaGasto\(g\.fecha \|\| ''\)/);
  assert.doesNotMatch(filtro, /if \(String\(g\.tipoPagable[^\n]+hextra[^\n]+\) \{\s*_gastoPagosArray/);
});

test('la tabla de este mes reutiliza el mismo conjunto pagado que el KPI', () => {
  assert.match(app, /var gastosPagadosMesKeys = fMes === 'mes'/);
  assert.match(app, /resumenGastosPagadosMes\(gastosData \|\| \[\], hoyD\)\.pagados/);
  assert.match(app, /matchMes = mesesImputacion\.indexOf\(mesActual\) >= 0 \|\| gastosPagadosMesKeys\.has\(g\.fbKey\)/);
});

test('los gastos históricos pagados reciben fecha contable canónica y conservan la fecha original', () => {
  assert.match(app, /function _normalizarImputacionGastosPagados\(\)/);
  assert.match(app, /sisventas\/gastos\/' \+ g\.fbKey \+ '\/fechaImputacion/);
  assert.match(app, /var fechaImputacion = fechasPago\[fechasPago\.length - 1\]/);
  assert.match(app, /imputacionActual === fechaImputacion && fechaActual === fechaImputacion/);
  assert.match(app, /sisventas\/gastos\/' \+ g\.fbKey \+ '\/fechaOriginal/);
  assert.match(app, /sisventas\/gastos\/' \+ g\.fbKey \+ '\/fecha'\] = fechaImputacion/);
  const carga = app.slice(app.indexOf('function fbCargarGastos()'), app.indexOf('function _gastoFijoMesActual'));
  assert.doesNotMatch(carga, /_normalizarImputacionGastosPagados\(\)/);
});

test('un gasto de julio pagado el 18 de agosto muestra la fecha efectiva de agosto', () => {
  const inicio = app.indexOf('function fechaImputacionGasto');
  const fin = app.indexOf('function gastoSeleccionableParaPago', inicio);
  const contexto = {
    _gastoPagosArray:g => Object.values(g.pagos || {}),
    pagoGastoEstaAnulado:p => p && (p.anulado === true || p.estado === 'anulado'),
    _normFechaGasto:f => f || ''
  };
  vm.createContext(contexto);
  vm.runInContext(app.slice(inicio, fin), contexto);
  assert.equal(contexto.fechaImputacionGasto({
    fecha:'2026-07-07',
    montoPagado:6678,
    pagos:{ pago_1:{ fecha:'2026-08-18', monto:6678 } }
  }), '2026-08-18');
  assert.equal(contexto.fechaImputacionGasto({
    fecha:'2026-07-01',
    tipoPagable:'hextra',
    montoPagado:160000,
    pagos:{ pago_1:{ fecha:'2026-08-18', monto:160000 } }
  }), '2026-08-18');
});

test('un comprobante guardado como ruta se detecta y puede reemplazarse', () => {
  assert.match(app, /function _normalizarComprobantePagoGasto\(comprobante\)/);
  assert.match(app, /Ruta inválida/);
  assert.match(app, /function previewEdicionPagoGastoComprobante\(input\)/);
  assert.match(app, /Reemplazar comprobante/);
  assert.match(app, /cambios\.comprobante = _pagoGastoEdicionComprobante/);
});

test('gastos mantiene sus acciones accesibles directamente en móvil', () => {
  assert.match(css, /#page-gastos #gas-tbl \.sv-grid-actions-original\{display:flex!important/);
  assert.match(css, /#page-gastos #gas-tbl \.sv-grid-actions-trigger,/);
  assert.match(css, /#page-gastos #gas-tbl \.sv-grid-actions-menu\{display:none!important\}/);
});

test('productos muestra sus acciones directamente en móvil', () => {
  assert.match(css, /#page-productos #prod-tbl \.sv-grid-actions-original\{display:inline-flex!important/);
  assert.match(css, /#page-productos #prod-tbl \.sv-grid-actions-trigger,/);
  assert.match(css, /#page-productos #prod-tbl \.sv-grid-actions-menu\{display:none!important\}/);
});

test('proveedores del producto se presentan como tarjetas en móvil', () => {
  assert.match(html, /class="card pf-providers-card"/);
  assert.match(app, /class="pf-provider-name" data-label="Proveedor"/);
  assert.match(app, /class="pf-provider-url" data-label="URL del producto"/);
  assert.match(css, /#page-productos #pf-proveedores-tbl \.pf-provider-row\{display:grid!important/);
  assert.match(css, /#page-productos #pf-proveedores-tbl \.pf-provider-name,/);
});

test('proveedores usan una sola columna en celulares angostos y cargan CSS vigente', () => {
  assert.match(html, /css\/app\.css\?v=2\.0\.384/);
  assert.match(css, /@media\(max-width:480px\)[\s\S]*pf-provider-row\{grid-template-columns:1fr!important/);
  assert.match(css, /pf-provider-head\{display:none!important/);
});

test('el comprobante PDF se abre en un visor propio sin exponer Base64', () => {
  const visorPago = app.slice(app.indexOf('var _visorComprobanteSistemaUrl'), app.indexOf('function editarGasto'));
  assert.match(app, /function cerrarVisorComprobanteSistema\(\)/);
  assert.match(app, /function abrirVisorComprobanteSistema\(archivo, tituloVisor\)/);
  assert.match(app, /id = 'modal-visor-comprobante-sistema'/);
  assert.match(app, /URL\.createObjectURL\(new Blob/);
  assert.match(app, /#navpanes=0&view=Fit/);
  assert.doesNotMatch(visorPago, /<iframe src="'\+comp\.data/);
});

test('los adjuntos fiscales y pagos de empleados reutilizan el visor común', () => {
  assert.match(app, /abrirVisorComprobanteSistema\(adjunto, 'Comprobante adjunto'\)/);
  assert.match(app, /abrirVisorComprobanteSistema\(comp, 'Comprobante de pago del empleado'\)/);
  assert.match(app, /abrirVisorComprobanteSistema\(pagos\[idx\].*'Comprobante de pago del gasto'\)/);
});

test('el visor común usa impresión nativa y conserva descarga y compartir', () => {
  assert.match(app, /#navpanes=0&view=Fit/);
  assert.match(app, /aria-label="Cerrar visor"/);
  assert.match(app, /background:var\(--card\)/);
  assert.doesNotMatch(app, /function imprimirVisorComprobanteSistema\(\)/);
  assert.match(app, /function descargarVisorComprobanteSistema\(\)/);
  assert.match(app, /async function compartirVisorComprobanteSistema\(\)/);
  assert.match(app, /navigator\.share\(\{ files:\[archivo\]/);
  assert.match(app, /var anchoVisor = esPdf \? 'min\(760px,calc\(100vw - 24px\)\)'/);
  assert.doesNotMatch(app, /aria-label="Cerrar visor"[^>]+margin-left:auto/);
  assert.match(app, /function _visorComprobanteUsaAperturaMovil\(\)/);
  assert.match(app, /if \(esPdf && _visorComprobanteUsaAperturaMovil\(\)\)/);
  assert.match(app, /window\.open\(urlTemporal, '_blank'\)/);
});

test('un modal abierto bloquea el desplazamiento del fondo', () => {
  assert.match(css, /body\.sv-modal-stack-open\{overflow:hidden!important;overscroll-behavior:none!important\}/);
  assert.match(css, /\.sv-modal-stack-open \.modal\{overscroll-behavior:contain\}/);
});

test('corregir un pago inicializa el monto dinámico antes de validarlo', () => {
  const inicio = app.indexOf('function abrirEditarPagoGasto');
  const fin = app.indexOf('async function _persistirAjustePagoGasto', inicio);
  const bloque = app.slice(inicio, fin);
  assert.match(bloque, /document\.body\.appendChild\(overlay\);\s*\/\/[\s\S]*?initMoneyInputsEn\(overlay\)/);
  assert.ok(bloque.indexOf('initMoneyInputsEn(overlay)') > bloque.indexOf('document.body.appendChild(overlay)'));
});

test('cerrar y maximizar comparten posición y tamaño en ventanas gestionables', () => {
  assert.match(app, /cabecera\.style\.display = 'flex'/);
  assert.match(app, /cerrar\.classList\.add\('sv-modal-close-btn'\)/);
  assert.match(css, /sv-modal-maximize-btn,[\s\S]*sv-modal-close-btn\{width:32px;height:32px/);
});
