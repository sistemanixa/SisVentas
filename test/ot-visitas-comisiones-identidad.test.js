const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.v3.7.3.js', 'utf8');
const workflow = fs.readFileSync('js/modules/ot-workflow.js', 'utf8');

function bloque(desde, hasta) {
  const inicio = app.indexOf(desde);
  const fin = app.indexOf(hasta, inicio + desde.length);
  assert.ok(inicio >= 0 && fin > inicio, `No se encontró el bloque ${desde}`);
  return app.slice(inicio, fin);
}

function contextoIdentidades() {
  const context = {
    window: {},
    empData: {
      ignacio: { fbKey:'e1007', nombre:'Ignacio Pezzente' },
      mauro: { fbKey:'e1005', nombre:'Mauro Bechir' },
      osmar: { fbKey:'e1006', nombre:'Osmar Tello' }
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(bloque('function ventaEsTecnica', 'function itemVentaEsManoDeObraReporte'), context);
  return context;
}

test('una venta técnica histórica no atribuye comisión al creador ni al técnico heredado en empleado', () => {
  const ctx = contextoIdentidades();
  const venta = {
    origen:'reclamo', reclamoKey:'r1',
    creadaPor:'Ignacio Pezzente', usuario:'Ignacio Pezzente',
    empleado:'Mauro Bechir', empleadoFbKey:'e1005',
    tecnico:'Mauro Bechir', tecnicoFbKey:'e1005'
  };
  assert.equal(ctx.ventaPerteneceResponsableComercial(venta, ctx.empData.ignacio), false);
  assert.equal(ctx.ventaPerteneceResponsableComercial(venta, ctx.empData.mauro), false);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.ventaResponsableComercialIdentidad(venta))), { fbKey:'', nombre:'' });
});

test('los dos comisionados canónicos permanecen independientes del creador y del técnico', () => {
  const ctx = contextoIdentidades();
  const venta = {
    origen:'reclamo', reclamoKey:'r2',
    creadaPor:'Osmar Tello', usuario:'Osmar Tello',
    comisionadoPrincipal:'Ignacio Pezzente', comisionadoPrincipalFbKey:'e1007',
    empleado:'Ignacio Pezzente', empleadoFbKey:'e1007',
    comisionado2:'Mauro Bechir', comisionado2FbKey:'e1005',
    tecnico:'Osmar Tello', tecnicoFbKey:'e1006'
  };
  assert.deepEqual(
    JSON.parse(JSON.stringify(ctx.ventaResponsableComercialIdentidad(venta))),
    { fbKey:'e1007', nombre:'Ignacio Pezzente' }
  );
  assert.equal(ctx.ventaEmpleadoEsComisionado(venta, ctx.empData.ignacio), true);
  assert.equal(ctx.ventaEmpleadoEsComisionado(venta, ctx.empData.mauro), true);
  assert.equal(ctx.ventaEmpleadoEsComisionado(venta, ctx.empData.osmar), false);
  assert.equal(ctx.ventaPerteneceResponsableComercial(venta, ctx.empData.osmar), false);
});

test('el cálculo mensual incluye primer y segundo comisionado, nunca creador o técnico', () => {
  const ctx = contextoIdentidades();
  Object.assign(ctx, {
    ventasList: [{
      id:'SP-1', fecha:'2026-09-20', origen:'reclamo', reclamoKey:'r1',
      creadaPor:'Osmar Tello', usuario:'Osmar Tello',
      comisionadoPrincipal:'Ignacio Pezzente', comisionadoPrincipalFbKey:'e1007',
      empleado:'Ignacio Pezzente', empleadoFbKey:'e1007',
      comisionado2:'Mauro Bechir', comisionado2FbKey:'e1005',
      tecnico:'Osmar Tello', tecnicoFbKey:'e1006',
      total:1210
    }],
    _svTotalVentaCanonico: v => v.total,
    _calcularBaseComisionVenta: () => ({ ganancia:500 }),
    obtenerDetalleComisionEmpleado: () => ({ pct:10, origen:'cargo' }),
    APROBACION_CONFIG:{ maxComisionPct:10 }
  });
  vm.runInContext(bloque('function calcularComisionEmpleado', '// Editar cliente'), ctx);
  const principal = ctx.calcularComisionEmpleado(ctx.empData.ignacio, '2026-09');
  const segundo = ctx.calcularComisionEmpleado(ctx.empData.mauro, '2026-09');
  assert.equal(principal.cantVentas, 1);
  assert.equal(segundo.cantVentas, 1);
  assert.equal(principal.comision, 25);
  assert.equal(segundo.comision, 25);
  assert.equal(ctx.calcularComisionEmpleado(ctx.empData.osmar, '2026-09').cantVentas, 0);
});

test('los cinco casos históricos quedan sin comisión inferida', () => {
  const ctx = contextoIdentidades();
  const casos = [
    ['SP-67693','Yanina Plana','Mauro Bechir','e1005'],
    ['SP-28822','Yanina Plana','Osmar Tello','e1006'],
    ['SP-98492','Yanina Plana','Mauro Bechir','e1005'],
    ['SP-45009','Ignacio Pezzente','Osmar Tello','e1006'],
    ['SP-27388','Ignacio Pezzente','Mauro Bechir','e1005']
  ];
  casos.forEach(([id, creador, tecnico, tecnicoFbKey]) => {
    const venta = {
      id:'#' + id, origen:'reclamo', reclamoKey:'r-' + id,
      creadaPor:creador, usuario:creador,
      empleado:tecnico, empleadoFbKey:tecnicoFbKey,
      tecnico, tecnicoFbKey
    };
    assert.deepEqual(
      JSON.parse(JSON.stringify(ctx.ventaComisionadoPrincipalIdentidad(venta))),
      { fbKey:'', nombre:'' },
      id
    );
    Object.values(ctx.empData).forEach(emp => assert.equal(ctx.ventaEmpleadoEsComisionado(venta, emp), false, `${id}: ${emp.nombre}`));
  });
});

test('la generación efectiva crea movimientos sólo para los dos comisionados reales', async () => {
  const ctx = contextoIdentidades();
  Object.assign(ctx, {
    fbDB:{},
    APROBACION_CONFIG:{ maxComisionPct:10 },
    _calcularBaseComisionVenta:() => ({ ganancia:1000 }),
    _pctComisionEmpleadoVenta:() => 4,
    _generarComisionVentaAtomica:async (emp, movimiento) => ({ empleado:emp.nombre, monto:movimiento.monto })
  });
  vm.runInContext(bloque('async function generarComisionesVenta', 'function _actualizarCtaEmpPorPagoGasto'), ctx);
  const resultados = await ctx.generarComisionesVenta({
    id:'#V-1', fbKey:'venta-1', fecha:'2026-09-24', cliente:'Cliente', comisionHabilitada:true,
    creadaPor:'Osmar Tello', usuario:'Osmar Tello', tecnico:'Osmar Tello', tecnicoFbKey:'e1006',
    comisionadoPrincipal:'Ignacio Pezzente', comisionadoPrincipalFbKey:'e1007',
    empleado:'Ignacio Pezzente', empleadoFbKey:'e1007',
    comisionado2:'Mauro Bechir', comisionado2FbKey:'e1005'
  }, 1000);
  assert.deepEqual(JSON.parse(JSON.stringify(resultados)), [
    { empleado:'Ignacio Pezzente', monto:40 },
    { empleado:'Mauro Bechir', monto:40 }
  ]);
});

test('crear una visita descarta el fbKey anterior y clona los datos anidados', async () => {
  let guardada;
  const context = {
    window: {},
    document: {
      getElementById: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    },
    structuredClone,
    setTimeout: () => 0,
    clearTimeout: () => {},
    Promise,
    console,
    FB_PATHS: { ordenesTrabajo:'sisventas/ordenes_trabajo' },
    otData: [{ fbKey:'visita-anterior', id:'OT-100' }],
    fbDB: {},
    fbRef: (_db, path) => path,
    fbRunTransaction: async () => ({ snapshot:{ val:() => 101 } }),
    otPersistirGuardar: async ot => {
      guardada = ot;
      return { ...ot, fbKey:'visita-nueva' };
    },
    tienePermiso: () => true
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(workflow, context);

  const anterior = {
    fbKey:'visita-anterior', id:'OT-100', tecnico:'Mauro Bechir',
    checks:{ preparacion:[true] }, audit:[{ accion:'Primera visita' }]
  };
  const resultado = await context.crearRegistroOTSeguro(anterior, { evitarDoble:true });

  assert.equal(resultado.key, 'visita-nueva');
  assert.equal(resultado.id, 'OT-101');
  assert.equal(guardada.fbKey, undefined);
  assert.equal(guardada.id, 'OT-101');
  assert.equal(anterior.fbKey, 'visita-anterior');
  assert.equal(anterior.id, 'OT-100');
  guardada.checks.preparacion[0] = false;
  assert.equal(anterior.checks.preparacion[0], true);
});

test('dos visitas del mismo cliente se recargan como registros independientes', async () => {
  let secuencia = 100;
  const guardadas = [];
  const context = {
    window: {},
    document: { getElementById:() => null, querySelectorAll:() => [], addEventListener:() => {} },
    structuredClone, setTimeout:() => 0, clearTimeout:() => {}, Promise, console,
    FB_PATHS:{ ordenesTrabajo:'sisventas/ordenes_trabajo' }, otData:[], fbDB:{},
    fbRef:(_db,path) => path,
    fbRunTransaction:async () => ({ snapshot:{ val:() => ++secuencia } }),
    otPersistirGuardar:async ot => {
      const copia = structuredClone(ot);
      guardadas.push(copia);
      return { ...copia, fbKey:'visita-' + guardadas.length };
    },
    tienePermiso:() => true
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(workflow, context);

  await context.crearRegistroOTSeguro({ cliente:'Cliente A', dir:'Domicilio 1', tecnico:'Mauro Bechir', checks:{preparacion:[true]}, audit:[{accion:'Primera'}] });
  await context.crearRegistroOTSeguro({ cliente:'Cliente A', dir:'Domicilio 1', tecnico:'Osmar Tello', checks:{preparacion:[false]}, audit:[{accion:'Segunda'}] });
  const recargadas = JSON.parse(JSON.stringify(guardadas));

  assert.deepEqual(recargadas.map(o => o.id), ['OT-101','OT-102']);
  assert.deepEqual(recargadas.map(o => o.tecnico), ['Mauro Bechir','Osmar Tello']);
  recargadas[1].checks.preparacion[0] = true;
  recargadas[1].audit.push({accion:'Cambio sólo en segunda'});
  assert.deepEqual(recargadas[0].audit.map(a => a.accion), ['Primera']);
  assert.equal(guardadas[1].checks.preparacion[0], false);
});

test('las dos rutas de reclamos copian comisionados reales y guardan al técnico por separado', () => {
  const coincidencias = app.match(/empleado:\s+responsableComercial\.nombre[\s\S]{0,450}tecnico:\s+tecnico/g) || [];
  assert.equal(coincidencias.length, 2);
  assert.doesNotMatch(app, /empleado:\s+tecnico,[\s\S]{0,100}tecnicoAsignado:\s+tecnico/);
  assert.equal((app.match(/comisionadoPrincipal:\s+responsableComercial\.nombre/g) || []).length >= 2, true);
  assert.equal((app.match(/comisionado2:\s+segundoComisionado\.nombre/g) || []).length >= 2, true);
  assert.doesNotMatch(app, /ventaComisionadoPrincipalIdentidad\(ventaOrigenReclamo\s*\|\|\s*\{\s*creadaPor/);
  assert.match(app, /var empPrincipal = Object\.values\(empData\|\|\{\}\)\.find\(function\(e\)\{\s*return ventaPerteneceResponsableComercial\(venta, e\)/);
});

test('cambiar el técnico persiste sólo la OT y conserva una auditoría reversible', () => {
  const transferencia = bloque('async function cambiarTecnicoOT', 'function renderAvisoProximasVacaciones');
  assert.match(transferencia, /ot\.tecnicoFbKey = empleadoTecnicoNuevo/);
  assert.match(transferencia, /tecnicoAnteriorFbKey:tecnicoFbKeyAnterior/);
  assert.match(transferencia, /await fbGuardarOT\(ot\)/);
  assert.doesNotMatch(transferencia, /ventasPagosPersistir|fbGuardarVenta|sisventas\/ventas/);
});

test('cuenta del empleado usa ambos comisionados y paneles comerciales usan el principal', () => {
  const cuenta = bloque('function renderComisionesDelMes', 'function _movEmpPagosArray');
  const dashboard = bloque('function renderDashAdministrativo', 'function renderDashMisOTs');
  assert.match(cuenta, /ventaEmpleadoEsComisionado\(v, emp\)/);
  assert.match(dashboard, /ventaResponsableComercialReporte\(v\) === usuario/);
});
