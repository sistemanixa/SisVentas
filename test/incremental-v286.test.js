const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.v2.0.286.js'), 'utf8');
const publishedVersion = fs.readFileSync(path.join(root, 'js', 'core', 'version.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

function crearEntornoCotizacion() {
  const inicio = app.indexOf('function firmaEstadoCotizacionProducto');
  const fin = app.indexOf('function margenProductoDefault', inicio);
  assert.ok(inicio >= 0 && fin > inicio, 'no se encontró el aislamiento de cotizaciones');
  const elementos = {
    'prod-form-view': { style:{ display:'block' } },
    'pf-codigo': { value:'P-21472' },
    'pf-nombre': { value:'SWITCH TL-SG1008D' },
    'pf-descripcion': { value:'' },
    'pf-cod-web': { value:'https://www.tecnoprices.com/4834' },
    'pf-proveedores-cotizacion-resultado': { style:{ display:'block' }, innerHTML:'anterior' }
  };
  const contexto = {
    document:{ getElementById:id => elementos[id] || null },
    getComputedStyle:el => ({ display:el.style.display }),
    parsePrecioProveedorARS:valor => Number(valor) || 0,
    restaurarBotonCotizacionProveedores() {}
  };
  vm.runInNewContext(
    "var editingProdId='producto-a';" +
    "var prodProveedoresActuales=[{nombre:'TECNOPRICES',proveedorKey:'tp',url:'https://www.tecnoprices.com/4834',precio:33023.93,sinIva:true}];" +
    'var _cotizacionProductoSecuencia=1;var _cotizacionProductoActiva=null;' +
    app.slice(inicio, fin) +
    '\nthis.crear=function(){var c={secuencia:1,productoId:String(editingProdId),proveedores:[{idx:0}]};c.firma=firmaEstadoCotizacionProducto(c.proveedores,document.getElementById("pf-codigo").value,document.getElementById("pf-nombre").value);_cotizacionProductoActiva=c;return c;};' +
    '\nthis.activa=cotizacionProductoSigueActiva;' +
    '\nthis.cambiarProducto=function(id){editingProdId=id;};' +
    '\nthis.proveedores=prodProveedoresActuales;',
    contexto
  );
  contexto.elementos = elementos;
  return contexto;
}

test('la publicación v2.0.286 mantiene todas las referencias coherentes', () => {
  assert.match(index, /app\.v2\.0\.286\.js/);
  assert.match(index, /version\.v2\.0\.286\.js/);
  assert.match(worker, /sisventas-v2\.0\.286/);
  assert.match(publishedVersion, /SISVENTAS_PWA_VERSION\s*=\s*'v2\.0\.286'/);
  assert.match(app, /VERSION:\s*'v2\.0\.286-firebase'/);
});

test('el actualizador libera la interfaz al ejecutarse en segundo plano', () => {
  assert.match(app, /'Iniciar '\+porProcesar\.length\+' en segundo plano'/);
  assert.match(app, /modal\.dataset\.ejecutando !== '1' \|\| modal\.dataset\.minimizado === '1'/);
  assert.match(app, /minimizarActualizadorMasivoPrecios\(\);[\s\S]*?Actualizador ejecutándose en segundo plano/);
});

test('el actualizador tampoco bloquea SisVentas cuando está abierto', () => {
  assert.match(app, /overlay\.dataset\.noBloqueante = '1'/);
  assert.match(app, /background:transparent[\s\S]*?pointer-events:none/);
  assert.match(app, /actualizador-precios-panel[^\n]*pointer-events:auto/);
  assert.match(app, /dataset\.minimizado === '1' \|\| el\.dataset\.noBloqueante === '1'/);
});

test('Gastos expone un administrador completo de recurrencias', () => {
  assert.match(index, /onclick="abrirGestorGastosRecurrentes\(\)"[^>]*>[\s\S]*?Recurrentes/);
  assert.match(app, /async function abrirGestorGastosRecurrentes\(\)/);
  assert.match(app, /function cambiarEstadoGastoRecurrente\(/);
  assert.match(app, /async function editarReglaGastoRecurrente\(/);
  assert.match(app, /async function eliminarReglaGastoRecurrente\(/);
  assert.match(app, /gasto\.recurrenciaActiva === false/);
});

test('las reglas mensuales de empleados generan una sola clave por mes', () => {
  assert.match(app, /sisventas\/gastos_periodicos_emp/);
  assert.match(app, /'periodico_emp_' \+ _gastoFijoHash\(empKey \+ '\\|' \+ reglaKey\) \+ '_' \+ mes\.replace/);
  assert.match(app, /reglaPeriodicaFbKey:reglaKey/);
  assert.match(app, /recurrenciaGenerada:true/);
});

test('los adelantos aplicados al haber conservan trazabilidad en los tres registros', () => {
  assert.match(app, /function _habDetalleAplicaciones\(compensacion\)/);
  assert.match(app, /adelantosAplicados:\s*adelantosAplicados/g);
  assert.match(app, /sisventas\/gastos\/' \+ gastoKey \+ '\/adelantosAplicados/);
  assert.match(app, /sisventas\/haberes\/' \+ ctaEmpActual[\s\S]*?\/adelantosAplicados/);
  assert.match(app, /function _ctaEmpDescripcionHaberConDescuento\(/);
  assert.match(app, /Bruto \$'[\s\S]*?adelanto[\s\S]*?neto \$/);
  assert.match(app, /async function verDesgloseHaberGasto\(/);
  assert.match(app, /mov\.tipo === 'adelanto' && parseFloat\(\(mov\.compensaciones\|\|\{\}\)\[mesKey\]\) > 0/);
});

test('Mi cuenta reconstruye para el técnico el adelanto ya compensado de un mes anterior', () => {
  const inicio = app.indexOf('function _ctaEmpDesgloseAdelantos');
  const fin = app.indexOf('function renderMovsEmp', inicio);
  assert.ok(inicio >= 0 && fin > inicio);
  const contexto = {
    movsEmpData: [
      {
        fbKey:'adelanto-julio', tipo:'adelanto', monto:100000,
        fechaPago:'2026-07-21', descripcion:'QUEDA COMO ADELANTO HASTA TANTO SE CARGUEN SUS HS',
        compensaciones:{ '2026_08':100000 }
      }
    ],
    escapeHTML: valor => String(valor || ''),
    _ctaEmpEsSueldoMovimiento: mov => mov && mov.tipo === 'sueldo'
  };
  vm.runInNewContext(
    app.slice(inicio, fin) +
      '\nthis.aplicados=_ctaEmpAdelantosAplicadosEnMes;' +
      '\nthis.descripcion=_ctaEmpDescripcionHaberConDescuento;',
    contexto
  );
  const aplicados = contexto.aplicados(contexto.movsEmpData, '2026-08');
  assert.equal(aplicados.length, 1);
  assert.equal(aplicados[0].monto, 100000);

  const html = contexto.descripcion(
    { tipo:'sueldo', fecha:'2026-08-31', monto:1086800 },
    'Haber Marcos Tello — agosto de 2026'
  );
  assert.match(html, /Bruto \$1\.186\.800/);
  assert.match(html, /adelanto \$100\.000/);
  assert.match(html, /neto \$1\.086\.800/);
  assert.match(html, /QUEDA COMO ADELANTO HASTA TANTO SE CARGUEN SUS HS/);
  assert.match(html, /21\/07\/2026/);
});

test('la compensación descuenta sólo el saldo del adelanto y no vuelve a aplicarlo', () => {
  const inicio = app.indexOf('function _habAdelantoDisponibleRaw');
  const fin = app.indexOf('async function confirmarRegistroHaberes', inicio);
  assert.ok(inicio >= 0 && fin > inicio);
  const contexto = {};
  vm.runInNewContext(app.slice(inicio, fin) + '\nthis.preparar=_habPrepararCompensacion;this.detallar=_habDetalleAplicaciones;', contexto);
  const movimientos = {
    adelanto_julio: { tipo:'adelanto', estado:'pagado', monto:30000, montoPagado:30000, montoCompensado:10000, fecha:'2026-07-15', descripcion:'Adelanto solicitado en julio' }
  };
  const resultado = contexto.preparar(movimientos, 100000, '2026-08');
  assert.equal(resultado.total, 20000);
  assert.equal(resultado.neto, 80000);
  assert.equal(contexto.detallar(resultado).adelanto_julio.monto, 20000);
  movimientos.adelanto_julio.montoCompensado = 30000;
  assert.equal(contexto.preparar(movimientos, 100000, '2026-09').total, 0);
});

test('el actualizador confirma bloques cortos y reintenta sólo lo pendiente', () => {
  assert.match(app, /var ACTUALIZADOR_TAMANIO_BLOQUE = 4;/);
  assert.match(app, /inicio \+= ACTUALIZADOR_TAMANIO_BLOQUE/);
  assert.match(app, /grupo\.slice\(inicio, inicio \+ ACTUALIZADOR_TAMANIO_BLOQUE\)/);
  assert.match(app, /modal\._productosPendientes \|\| \[\]\)\.filter[\s\S]*?_actualizadorSesionPrecios\.procesados/);
  assert.match(app, /límite de cinco minutos/);
});

test('el respaldo consulta el index activo y no el alias histórico app.js', () => {
  assert.match(app, /fetch\('\.\/index\.html\?_version_fallback='/);
  assert.doesNotMatch(app, /fetch\('\.\/js\/app\.js\?_version_fallback='/);
  assert.match(app, /setInterval\(function\(\) \{ _chequearGitHub\(\); \}, 60 \* 1000\)/);
});

test('una respuesta sólo sigue activa para la misma ficha sin modificaciones', () => {
  const entorno = crearEntornoCotizacion();
  const solicitud = entorno.crear();
  assert.equal(entorno.activa(solicitud), true);
  entorno.cambiarProducto('producto-b');
  assert.equal(entorno.activa(solicitud), false);
});

test('editar el nombre, proveedor o precio invalida la respuesta en curso', () => {
  const entornoNombre = crearEntornoCotizacion();
  const solicitudNombre = entornoNombre.crear();
  entornoNombre.elementos['pf-nombre'].value = 'PC-900G CON BATERIA';
  assert.equal(entornoNombre.activa(solicitudNombre), false);

  const entornoPrecio = crearEntornoCotizacion();
  const solicitudPrecio = entornoPrecio.crear();
  entornoPrecio.proveedores[0].precio = 442771;
  assert.equal(entornoPrecio.activa(solicitudPrecio), false);
});

test('abrir y cerrar fichas blanquea el resultado anterior', () => {
  assert.match(app, /editingProdId = id;\s*cancelarCotizacionProductoEditor\(\);/);
  assert.match(app, /function cerrarFormProducto\(\) \{\s*cancelarCotizacionProductoEditor\(\);/);
  assert.match(app, /box\.innerHTML = '';\s*box\.style\.display = 'none';/);
});

test('el resultado tardío se descarta antes de procesar proveedores', () => {
  assert.match(app, /if \(!cotizacionProductoSigueActiva\(contextoCotizacion\)\) \{[\s\S]*?return null;[\s\S]*?procesarResultadoCotizacionProveedores/);
  assert.match(app, /Producto consultado: <strong>/);
});

test('el selector visual se sincroniza al reutilizarlo para otro producto', () => {
  assert.match(app, /if \(sel\.dataset\.ssInit\) \{[\s\S]*?inputExistente\.value = opcionActual \? opcionActual\.text[\s\S]*?ssRenderList\(selectId, sel\.value, ''\);[\s\S]*?return;/);
});
