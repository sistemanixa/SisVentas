const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.v3.2.4.js', 'utf8');

assert.match(app, /function gastoVisibleEnModuloGastos\(gasto\)/,
  'Debe existir una regla única de visibilidad para el módulo Gastos');
assert.match(app, /_ctaEmpTipoDesdeGasto\(gasto\)/,
  'La regla debe reconocer también comisiones históricas sin tipoPagable');
assert.match(app, /var tieneAprobacion = !!\(gasto && \(gasto\.aprobadoTs \|\| gasto\.aprobadoPor \|\| gasto\.fechaAprobacion\)\)/,
  'La visibilidad debe comprobar evidencia real de aprobación y no sólo un estado histórico');
assert.match(app, /if \(estado === 'pendiente_aprobacion' \|\| estado === 'rechazado' \|\| estado === 'anulado'\) return false/,
  'Una comisión pendiente, rechazada o anulada nunca debe aparecer en Gastos');
assert.match(app, /return estado === 'pagado' \|\| estado === 'pagado_parcial' \|\| tieneAprobacion/,
  'Una comisión sólo debe aparecer en Gastos después de aprobarse o pagarse');
assert.match(app, /gastosMetricas = \(gastosData \|\| \[\]\)\.filter\(function\(g\)\{ return gastoVisibleEnModuloGastos\(g\)/,
  'Los KPI deben excluir comisiones no aprobadas');
assert.match(app, /var gastosVisiblesModulo = \(gastosData \|\| \[\]\)\.filter\(gastoVisibleEnModuloGastos\)/,
  'La grilla y sus filtros deben partir de la misma lista visible');
assert.match(app, /gastoVisibleEnModuloGastos\(g\) && clavesKpiRender\.has/,
  'Los accesos desde KPI tampoco deben reintroducir comisiones pendientes');

console.log('gastos-oculta-comisiones-no-aprobadas.test.js OK');
