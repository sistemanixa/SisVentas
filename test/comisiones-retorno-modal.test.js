const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../js/modules/commissions.js'), 'utf8');

function entorno(origen = 'gastos') {
  const modal = {style:{display:'none'}};
  const pagina = {id:'page-' + origen};
  const calls = [];
  const window = {gastosData:[{fbKey:'g1',tipo:'comision',ventaId:'V1',monto:100}],
    showPage(){throw new Error('No debe cambiar de módulo al consultar');},
    notify(m){calls.push(m);}, irAVentaDesdeGastoComision(key){calls.push(key);},
    svNavegarDirecto(id, callback){calls.push(id);callback();},
    verDetalleVenta(id){calls.push(id);}};
  vm.runInNewContext(source, {window,document:{getElementById(id){return id === 'modal-comision-gestion' ? modal : null;},
    querySelector(selector){return selector === '.page.active' ? pagina : null;}},setTimeout(){}});
  return {window,modal,pagina,calls};
}

test('consultar y cerrar comisión conserva Gastos sin reconstruir sus filtros', async () => {
  const c = entorno();
  await c.window.abrirComisionDesdeGasto('g1');
  assert.equal(c.modal.style.display,'flex');
  assert.equal(c.pagina.id,'page-gastos');
  c.window.cerrarDetalleComision();
  assert.equal(c.modal.style.display,'none');
  assert.equal(c.pagina.id,'page-gastos');
});

test('ver venta desde la comisión de Gastos usa el retorno con filtros', async () => {
  const c = entorno();
  await c.window.abrirComisionDesdeGasto('g1');
  c.window.abrirVentaDesdeComisiones();
  assert.equal(c.modal.style.display,'none');
  assert.deepEqual(c.calls,['g1']);
});

test('ver venta desde Comisiones conserva su origen y cierra el modal', async () => {
  const c = entorno('comisiones');
  await c.window.abrirDetalleComision('V1');
  c.window.abrirVentaDesdeComisiones();
  assert.equal(c.modal.style.display,'none');
  assert.deepEqual(c.calls,['detalle','V1']);
  assert.equal(c.window._ventaDesdeHistorialOrigen,'comisiones');
});

test('cerrar mientras carga no vuelve a abrir la comisión al recibir los datos', async () => {
  const c = entorno();
  let resolver;
  c.window.gastosData[0].legacyKey = 'ctaemp/empleado/movimiento';
  c.window.fbDB = {};
  c.window.fbRef = () => ({});
  c.window.fbGet = () => new Promise(resolve => {resolver = resolve;});
  const consulta = c.window.abrirComisionDesdeGasto('g1');
  assert.equal(c.modal.style.display,'flex');
  c.window.cerrarDetalleComision();
  resolver({val:()=>({pct:10})});
  await consulta;
  assert.equal(c.modal.style.display,'none');
  assert.equal(c.pagina.id,'page-gastos');
});
