const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, 'fixtures', 'legacy-maintenance.source.js'), 'utf8');

test('Mantenimiento ofrece revisiones e informe y no duplica el estado de la cabecera', () => {
  const panel=html.slice(html.indexOf('id="cfg-mantenimiento"'),html.indexOf('<!-- TAB: METAS DEL NEGOCIO -->'));
  assert.equal((panel.match(/<section\b/g)||[]).length,2);
  for(const id of ['mnt-targeted-reviews','mnt-support'])assert(panel.includes('id="'+id+'"'));
  assert.doesNotMatch(panel,/mnt-current-state|Generar diagnóstico|Abrir Gastos|Abrir Ventas/);
  assert.match(panel,/Revisar gastos/);assert.match(panel,/Revisar ventas y cobros/);assert.match(panel,/Descargar informe/);
  assert.doesNotMatch(panel,/mnt-guia-usuario|mnt-v2-card|mnt-migraciones-lista|mnt-vinculos-ventas|mnt-console|mntMigrar|mntEliminar/);
  assert.match(html,/js\/modules\/maintenance-center\.js/);
  assert.doesNotMatch(html,/<script[^>]+(?:maintenance\.js|v2-readiness\.js|v2-audit\.js|ops-hardening\.js|sale-delete-maintenance\.js)/);
});

test('la fixture histórica conserva los casos de revisión para las regresiones financieras', () => {
  assert.match(js, /function mntRenderGuiaUsuario/);
  assert.match(js, /Qué pasó:/);
  assert.match(js, /Qué puede afectar:/);
  assert.match(js, /Cómo se corrige:/);
  assert.match(js, /Vínculos entre registros/);
  assert.match(js, /Cobros e identificadores/);
  assert.match(js, /Presupuestos/);
  assert.match(js, /Ventas y cobros/);
  assert.match(js, /Órdenes de trabajo/);
  assert.match(js, /Productos y proveedores/);
  assert.match(js, /MNT_STATE\.v2 = await window\.svRenderAuditoriaV2/);
  assert.match(js, /MNT_STATE\.v3 = await window\.SisVentas\.V3Diagnostics\.run/);
  assert.match(js, /Se reunieron.*observaciones/);
  assert.match(js, /Credenciales sin cliente identificado/);
  assert.match(js, /Revisar y reparar/);
  assert.match(js, /function mntResolverAutomaticos/);
  assert.match(js, /svAplicarPlanNormalizacionRelaciones/);
});
