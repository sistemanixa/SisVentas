const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.v3.0.14.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');
const custody = fs.readFileSync('js/modules/ot-material-custody.js', 'utf8');
const otWorkflow = fs.readFileSync('js/modules/ot-workflow.js', 'utf8');

test('Soporte abre con pendientes y Todos incluye también cerrados', () => {
  assert.match(html, /option value="pendientes" selected>Pendientes/);
  assert.match(html, /option value="todos">Todos los estados/);
  assert.match(app, /if \(filtro === 'todos'\) return true/);
  assert.match(app, /if \(filtro === 'pendientes'\) return r\.estado !== 'cerrado'/);
});

test('los cinco KPI de Soporte filtran su estado y cerrados del mes', () => {
  for (const filtro of ['nuevo', 'diagnostico', 'visita', 'ot_activa', 'cerrado_mes']) {
    assert.match(html, new RegExp("spFiltrar\\('" + filtro + "'\\)"));
  }
  assert.match(app, /r\.cerradoEn \|\| r\.actualizadoEn \|\| r\.ts/);
});

test('las ventanas gestionables conservan tamaño y posición dentro de pantalla', () => {
  assert.match(app, /panel\.style\.boxSizing = 'border-box'/);
  assert.match(app, /window\.innerHeight - panel\.offsetHeight - 8/);
  assert.match(app, /document\.body\.appendChild\(contenedor\)/);
  assert.match(app, /data-sv-modal-behavior="compact"/);
  assert.match(app, /overlay\.dataset\.svModalBehavior = 'compact'/);
});

test('los accesos flotantes no pierden hover al desplegarse', () => {
  assert.match(css, /#chat-fab:hover[\s\S]{0,180}?right:0!important/);
});

test('Nueva OT envía el caso diferente al administrador sin crear OT ni reclamo', () => {
  assert.match(app, /function nuevaOT\(\)/);
  assert.match(app, /data-ot-enviar/);
  assert.match(app, /Esto no crea una OT ni un reclamo/);
  assert.match(app, /Describí únicamente cuál es el caso excepcional/);
  assert.match(app, /data-ot-cancelar/);
  assert.match(app, /data-ot-reclamo>Abrir nuevo reclamo/);
  assert.match(app, /modal-overlay open sv-system-dialog-overlay/);
  assert.match(app, /svNavegarDirecto\('soporte'[\s\S]{0,180}?spAbrirNuevo\(\)/);
  assert.match(app, /destino:'admin'/);
  assert.match(app, /tipo:'solicitud_ot_excepcional'/);
  assert.match(app, /Caso excepcional enviado al administrador/);
  assert.match(app, /window\.nuevaOT = nuevaOT/);
  assert.match(otWorkflow, /window\.nuevaOT=function\(\)[\s\S]{0,360}?return nuevaPrev\.apply/);
  assert.doesNotMatch(otWorkflow, /accion:'OT creada manualmente'/);
});

test('el resumen técnico filtra la lista al pulsar una persona', () => {
  assert.match(app, /onclick="otAbrirResumenTecnico/);
  assert.match(app, /function otAbrirResumenTecnico\(tecnico\)/);
  assert.match(app, /busqueda\.value = tecnico/);
  assert.match(app, /estado\.value = ''/);
  assert.match(app, /periodo\.value = 'todos'/);
  assert.match(app, /\(o\.tecnico\|\|''\)\.toLowerCase\(\)\.includes\(busq\.toLowerCase\(\)\)/);
  assert.match(html, /placeholder="Buscar cliente, técnico o N°\.\.\."/);
});

test('el margen de Venta y Presupuesto queda exclusivamente para Admin', () => {
  assert.match(app, /function puedeVerMargenVenta\(\) \{\s*return currentRole === 'admin'/);
  assert.match(app, /function puedeVerMargenPresupuesto\(\) \{\s*return currentRole === 'admin'/);
  assert.match(app, /Ver margen y costo de ventas \(solo Admin\)/);
});

test('custodia detalla productos y guarda sin cambiar visualmente de sección', () => {
  assert.match(custody, /Material y cantidad/);
  assert.match(custody, /descripcion[\s\S]{0,260}?estados\.join/);
  assert.doesNotMatch(custody, /window\.verOT\(ot\.fbKey \|\| ot\.id\)/);
  assert.match(custody, /render\(ot, controllableMaterials\(ot\)\)/);
});
