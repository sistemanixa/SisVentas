const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const appActivo = (html.match(/<script src="\.\/js\/(app\.v[^"?]+\.js)(?:\?[^\"]*)?"/) || [])[1];
assert.ok(appActivo, 'index.html debe declarar el archivo principal activo');
const app = fs.readFileSync(path.join(raiz, 'js', appActivo), 'utf8');

test('Empleados permite una bonificación adicional con mes elegido y mantiene comisiones vinculadas', () => {
  assert.match(html, /<i class="ti ti-cash"><\/i>\s*Haberes<\/button>/);
  assert.doesNotMatch(html, /Haberes y bonificaciones/);
  assert.match(html, /data-permiso="empleados.bonificar" onclick="abrirModalBonificacionEmpleado\(\)"/);
  assert.match(html, /<input type="month" id="bonificacion-mes" required>/);
  assert.match(html, /onclick="abrirModalComisionVenta\(\)"/);
  assert.match(html, /id="modal-bonificacion-empleado"/);
  assert.match(html, /id="modal-comision-venta"/);
  assert.match(html, /list="comision-manual-ventas-list"/);
});

test('la bonificación posterior crea haber y gasto juntos sin modificar sueldo ni reemplazar pagos al repetir', async () => {
  const {createBackend,copy}=require('./helpers/labor-ui-flow.cjs');
  const f=createBackend({haberes:{e:{mes:{sueldo:500,sueldoBase:500}}}}),p=f.page();
  const mov={tipo:'bonificacion',monto:50,fecha:'2026-10-20',descripcion:'Bono ficticio',ts:1000};
  await p.context._guardarBonificacionEmpleadoAtomica(p.context.empData.e,mov,'bonus_fixture');
  const gastoKey='gasto_bonificacion_e_bonus_fixture',movKey='bonificacion_e_bonus_fixture';
  assert.equal(f.commits.length,1);assert.equal(f.commands[0].kind,'atomic');
  assert.equal(f.get('sisventas/gastos/'+gastoKey).tipoPagable,'bonificacion');assert.equal(f.get('sisventas/gastos/'+gastoKey).estado,'aprobado');
  assert.equal(f.get('sisventas/ctaemp/e/'+movKey).tipo,'bonificacion');assert.equal(f.get('sisventas/ctaemp/e/'+movKey).gastoFbKey,gastoKey);
  p.refresh();await p.context._registrarPagoGastoUnitario(gastoKey,50,'Efectivo',null,null);
  const before=copy(f.state.sisventas);await p.context._guardarBonificacionEmpleadoAtomica(p.context.empData.e,mov,'bonus_fixture');
  assert.deepEqual(f.state.sisventas,before);assert.deepEqual(f.get('sisventas/haberes/e'),{mes:{sueldo:500,sueldoBase:500}});assert.deepEqual(f.direct,[]);
  assert.match(app, /TIPOS_HABER = \['sueldo','aguinaldo','comision','hextra','bonificacion'/);
});

test('eliminar una bonificación quita en una sola escritura el gasto y la cuenta del empleado', () => {
  const inicio = app.indexOf('function _eliminarBonificacionGastoVinculada');
  const fin = app.indexOf('async function eliminarCliente', inicio);
  const flujo = app.slice(inicio, fin);
  assert.ok(inicio > 0 && fin > inicio);
  assert.match(flujo, /return _eliminarGastoAtomico\(gasto,gastoFbKey\)/);
  const atomico = require('./helpers/app-functions.cjs').functionSource('_eliminarGastoAtomico');
  assert.match(atomico, /window\.SVLaborWrites\.atomic/);
  assert.match(atomico, /updates\[path\] = null/);
  assert.match(atomico, /updates\['sisventas\/ctaemp\/' \+ ref.empKey \+ '\/' \+ ref.key\] = null/);
  assert.match(flujo, /También se quitará de la cuenta del empleado/);
  assert.match(atomico, /El gasto no tiene un vínculo válido/);
});

test('la comisión manual confirma control, destino y venta juntos; la automática delega al servidor', async () => {
  assert.match(app, /function _calcularBaseComisionVenta\(venta\)/);
  assert.match(app, /SVCommissionGeneration\.generate\(venta\)/);
  assert.match(app, /await _ventaTieneComisionGenerada\(emp\.fbKey, venta\)/);
  assert.match(app, /await _generarComisionVentaAtomica\(emp, movimiento\)/);
  assert.match(app, /ventaId: venta\.id \|\| venta\.numero \|\| venta\.nro/);
  assert.match(app, /ventaFbKey: venta\.fbKey \|\| ''/);
  assert.match(app, /origenCarga: 'manual_empleados'/);
  assert.match(app, /sisventas\/comisiones_generacion/);
  const {createBackend}=require('./helpers/labor-ui-flow.cjs'),f=createBackend(),p=f.page();
  await p.context._generarComisionVentaAtomica(p.context.empData.e,{tipo:'comision',monto:50,pct:5,gananciaBase:1000,ventaFbKey:'v',ventaId:'V-FICTICIA',fecha:'2026-10-20',ts:1000});
  assert.equal(f.commands.length,1);assert.equal(f.commands[0].kind,'atomic');assert.equal(f.commits.length,1);
  assert.equal(f.get('sisventas/comisiones_generacion/comision_v_e').estado,'completada');assert.equal(f.get('sisventas/gastos/gasto_comision_v_e').monto,50);assert.equal(f.get('sisventas/ctaemp/e/comision_v_e').gastoFbKey,'gasto_comision_v_e');assert.equal(f.get('sisventas/ventas/v').comisionesGeneradas,true);
  assert.ok(!Object.values(f.commands[0].value).some(value=>value?.estado==='procesando'),'No hay reserva intermedia que pueda quedar sin sus destinos');
  const model = require('../cotizador/commission-generation-model');
  assert.equal(model.round(120 * 25 / 100), 30);
});
