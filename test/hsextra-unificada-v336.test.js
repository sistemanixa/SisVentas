const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.v2.0.336.js'), 'utf8');
const inicio = app.indexOf('function _hsexClaveEmpleadoMes');
const fin = app.indexOf('function abrirFormCargaHsExtra', inicio);
const bloque = app.slice(inicio, fin);

function contextoHs() {
  let estado = {};
  const context = {
    window: {
      fbDB: {},
      fbRef: () => ({}),
      fbRunTransaction: async (_ref, actualizar) => {
        const siguiente = actualizar(structuredClone(estado));
        if (siguiente === undefined) return { committed:false };
        estado = siguiente;
        return { committed:true, snapshot:{ val:() => structuredClone(estado) } };
      }
    },
    currentUser: 'Técnico',
    Date,
    Math,
    Object,
    Array,
    String,
    Promise
  };
  vm.createContext(context);
  vm.runInContext(bloque, context);
  context.estado = () => estado;
  return context;
}

test('dos cargas del mismo empleado y mes se guardan en una sola solicitud', async () => {
  const ctx = contextoHs();
  await ctx._hsexGuardarSolicitudUnificada('emp_1', 'Mauro', '2026-07', [{fecha:'2026-07-01',horas:1,lugar:'Mat Alija'}], '', 'aporte_a');
  await ctx._hsexGuardarSolicitudUnificada('emp_1', 'Mauro', '2026-07', [{fecha:'2026-07-06',horas:3,lugar:'Authogar'}], '', 'aporte_b');
  const solicitudes = Object.values(ctx.estado());
  assert.equal(solicitudes.length, 1);
  assert.equal(solicitudes[0].horas, 4);
  assert.equal(solicitudes[0].detalleDias.length, 2);
});

test('reintentar el mismo aporte no duplica horas', async () => {
  const ctx = contextoHs();
  const detalle = [{fecha:'2026-07-06',horas:3,lugar:'Authogar'}];
  await ctx._hsexGuardarSolicitudUnificada('emp_1', 'Mauro', '2026-07', detalle, '', 'mismo_aporte');
  await ctx._hsexGuardarSolicitudUnificada('emp_1', 'Mauro', '2026-07', detalle, '', 'mismo_aporte');
  const solicitud = Object.values(ctx.estado())[0];
  assert.equal(solicitud.horas, 3);
  assert.equal(Object.keys(solicitud.aportes).length, 1);
});

test('una carga nueva conserva las horas de un pendiente legacy sin detalle por día', async () => {
  const ctx = contextoHs();
  const ref = await ctx._hsexGuardarSolicitudUnificada('emp_1', 'Mauro', '2026-07', [{fecha:'2026-07-01',horas:32,lugar:'Detalle anterior'}], '', 'legacy_inicial');
  assert.equal(ref.committed, true);
  const existente = Object.values(ctx.estado())[0];
  delete existente.aportes;
  existente.detalleDias = [];
  existente.descripcion = 'Horas de julio previamente cargadas';
  await ctx._hsexGuardarSolicitudUnificada('emp_1', 'Mauro', '2026-07', [{fecha:'2026-07-06',horas:3,lugar:'Authogar'}], '', 'aporte_nuevo');
  assert.equal(Object.values(ctx.estado())[0].horas, 35);
});

test('los pendientes legacy repetidos se consolidan para revisión', () => {
  const ctx = contextoHs();
  const grupos = ctx._hsexAgruparPendientes([
    {fbKey:'a',empFbKey:'emp_1',empNombre:'Mauro',mes:'2026-07',horas:32,detalleDias:[]},
    {fbKey:'b',empFbKey:'emp_1',empNombre:'Mauro',mes:'2026-07',horas:3,detalleDias:[]}
  ]);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].horas, 35);
  assert.equal(grupos[0].solicitudes.length, 2);
});

test('la cuenta administrativa se accede desde Empleados y Mi cuenta sigue siendo un permiso personal', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(app, /function abrirCuentaEmpleadoDesdeEmpleados/);
  assert.match(app, /navCtaEmp\.style\.display = isAdmin \? 'none'/);
  assert.match(app, /Mi cuenta \(acceso personal\)/);
  assert.match(html, /id="ctaemp-volver-empleados"/);
});

test('la aprobación consolidada conserva protección transaccional e idempotente', () => {
  assert.match(app, /function _aprobarGrupoHsExtraAtomico/);
  assert.match(app, /fbRunTransaction\(window\.fbRef\(window\.fbDB, 'sisventas'\)/);
  assert.match(app, /_claveOperacionConcurrente\('hextra', claves\)/);
  assert.match(app, /solicitudes\.some\(function\(s\)\{ return !s \|\| s\.estado !== 'pendiente'; \}\)/);
});
