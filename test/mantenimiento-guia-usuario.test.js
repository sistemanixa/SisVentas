const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'app.css'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'js', 'modules', 'maintenance.js'), 'utf8');

test('Mantenimiento prioriza decisiones entendibles y oculta los detalles técnicos', () => {
  assert.match(html, /id="mnt-guia-usuario"/);
  assert.match(html, /Qué tenés que decidir/);
  assert.match(html, /Ver detalles técnicos/);
  assert.match(css, /#cfg-mantenimiento:not\(\.mnt-tecnico-visible\)>\.mnt-main-grid/);
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
