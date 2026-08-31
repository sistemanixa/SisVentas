const fs = require('fs');
const assert = require('assert');

const grid = fs.readFileSync('js/modules/resizable-tables.js', 'utf8');
const app = fs.readFileSync('js/app.v3.1.1.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

function body(name) {
  const start = grid.indexOf('function ' + name + '(');
  assert(start >= 0, 'Falta ' + name);
  const next = grid.indexOf('\n  function ', start + 10);
  return grid.slice(start, next < 0 ? grid.length : next);
}

['loadWidths', 'loadPercentages', 'loadAlignments'].forEach(name => {
  const source = body(name);
  assert(source.indexOf('localStorage.getItem') < source.indexOf('globalDataFor'), name + ' debe priorizar el perfil local');
});

const observer = grid.slice(grid.indexOf('var observer = new MutationObserver'));
assert(observer.indexOf('initMutationTables(mutations)') < observer.indexOf('scheduleScan()'), 'Las tablas nuevas deben inicializarse antes del repaso diferido');
assert(css.includes('.sv-columns-pending{visibility:hidden!important}'), 'La grilla debe permanecer oculta mientras resuelve el perfil');
assert(grid.includes("if (!isTableVisible(table)) {\n      table.classList.add('sv-columns-pending');"), 'La tabla oculta debe quedar marcada antes de activar el módulo');
const activated = app.indexOf("page.classList.add('active');");
assert(activated >= 0 && app.indexOf('window.SisVentas.prepareResizablePage(page);', activated) > activated, 'La página debe aplicar el perfil otra vez con su ancho real antes del primer dibujo');

assert(app.includes('Preparando Excel…'), 'La exportación debe informar progreso');
assert(app.includes('enviado a las descargas del navegador'), 'La exportación debe confirmar destino y nombre');
assert(app.includes("boton.disabled = true"), 'La exportación debe bloquear doble clic');
assert(html.includes("exportarExcel('Reporte de ventas',this)"), 'Reportes debe entregar el botón a la exportación');
assert(css.includes('#cobranzas-stats-global{width:100%'), 'Los KPI de cobranzas deben ocupar todo el ancho');

assert(html.includes('repeat(auto-fit,minmax(220px,1fr))'), 'Cobros por medio de pago debe repartir solo las tarjetas existentes');
assert(html.includes("VERSION: 'v3.1.1-firebase'"));
assert(html.includes('./js/app.v3.1.1.js'));
assert(sw.includes("sisventas-v3.1.1"));

console.log('OK: perfiles de grilla, exportación visible y KPI de cobranzas v3.1.0');
