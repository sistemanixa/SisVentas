const fs = require('fs');
const assert = require('assert');

const files = ['index.html'].concat(
  fs.readdirSync('js/modules').filter(name => name.endsWith('.js')).map(name => 'js/modules/' + name)
);
const tables = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const pattern = /<table\b([^>]*)>/gi;
  let match;
  while ((match = pattern.exec(source))) {
    const attrs = match[1];
    const id = (attrs.match(/\bid=["']([^"']+)/i) || [])[1] || '';
    const key = (attrs.match(/data-sv-column-key=["']([^"']+)/i) || [])[1] || '';
    const exempt = /data-sv-no-resize|sv-no-resize/.test(attrs);
    tables.push({ file, id, key, exempt });
  }
}

const unidentified = tables.filter(table => !table.id && !table.key && !table.exempt);
const identities = new Map();
for (const table of tables) {
  const identity = table.key || table.id;
  if (!identity) continue;
  if (!identities.has(identity)) identities.set(identity, []);
  identities.get(identity).push(table.file);
}
const duplicates = Array.from(identities.entries()).filter(([, owners]) => new Set(owners).size > 1);

// Las tablas sin identidad explícita reciben una clave estable por página y
// encabezados desde el controlador. Lo crítico es que ninguna implementación
// paralela agregue sus propios manejadores de resize.
const central = fs.readFileSync('js/modules/resizable-tables.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v3.1.1.js', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');
assert(central.includes("root.querySelectorAll('table').forEach(initTable)"), 'El controlador central debe alcanzar todas las tablas');
assert(central.includes('dragUsesPercent = false'), 'El arrastre central debe congelar las demás columnas como Windows');
assert(!central.includes('applyLivePixelWidth(pendingClientX - startX)'), 'El movimiento no debe forzar píxeles sin respetar el modo de la tabla');
assert(!central.includes('next[neighborIndex] ='), 'Mover una columna no debe redimensionar las demás');
assert(central.includes("th.dataset.svActionsAuto = '1'"), 'Acciones debe volver a medirse al cargar las filas');
assert(central.includes("cell.querySelector('.sv-grid-actions-original,.sv-row-actions,[data-sv-actions]')"), 'La reserva de Acciones debe medir el bloque real de controles');
assert(central.includes("cell.querySelector('.sv-grid-actions-original')"), 'Acciones debe ignorar las copias ocultas del menú compacto');
assert(central.includes("!action.closest('.sv-grid-actions-menu')"), 'Los controles ocultos no deben inflar la reserva de Acciones');
assert(!central.includes('acc.rendered = Math.max(acc.rendered, cell.scrollWidth'), 'Acciones no debe confundir el ancho de la celda con su contenido');
assert(central.includes('minimumPct'), 'El 100% debe reservar el mínimo real de Acciones');
assert(central.includes("isActionsHeader(_th, index) ? 'right'"), 'Acciones debe quedar alineada a la derecha en todas las grillas');
assert(central.includes('th === th.parentElement.lastElementChild'), 'La última cabecera vacía debe reconocerse como Acciones');
assert(central.includes("th.dataset.svColumnLabel = 'Acciones'"), 'Toda columna con iconos debe mostrar el encabezado Acciones');
assert(central.includes("visibleLabel.textContent = 'Acciones'"), 'El encabezado Acciones debe ser visible, no sólo accesible');
assert(app.includes("control.classList.add('sv-grid-action-button')"), 'Todas las acciones deben recibir la clase visual común');
assert(app.includes("encabezadoAcciones.dataset.svColumnLabel = 'Acciones'"), 'El inicializador general debe rotular las cabeceras de acciones vacías');
assert(app.includes("control.classList.add('sv-grid-action-danger')"), 'Las acciones destructivas deben compartir señal visual');
assert(css.includes('.sv-responsive-grid .sv-grid-action-button{'), 'Falta la medida visual común para acciones');
assert(css.includes('border:0.5px solid var(--border2)!important;'), 'Todas las acciones deben conservar el mismo recuadro visible');
assert(css.includes('color:var(--text2)!important;'), 'Las acciones normales deben compartir el mismo color');
assert(css.includes('.sv-responsive-grid .sv-grid-actions-original{\n  justify-content:flex-end!important;'), 'Las acciones deben alinearse a la derecha');

const productosToolbar = html.match(/<div class="card-head">[\s\S]*?<table id="prod-tbl"[\s\S]*?<\/thead>/)?.[0] || '';
assert(/prod-grid-controls[\s\S]*?btn-colapsar-cats[\s\S]*?openColumnPercentEditor\('prod-tbl'\)[\s\S]*?<div class="table-wrap prod-table-wrap">/.test(productosToolbar),
  'Productos debe mostrar Colapsar todo y luego Columnas en la franja superior derecha');
assert(!/<th[^>]*>[\s\S]{0,500}openColumnPercentEditor\('prod-tbl'\)/.test(productosToolbar),
  'Los controles de Productos no deben ocupar una columna de la tabla');
assert(/<table id="prod-tbl" data-sv-column-key="productos-catalogo-v3">/.test(productosToolbar),
  'Productos debe migrar el perfil recomendado defectuoso sin afectar otras grillas');
assert(/0:\s*6,[\s\S]*?1:\s*9,[\s\S]*?2:\s*23,[\s\S]*?3:\s*21,[\s\S]*?4:\s*7,[\s\S]*?8:\s*12/.test(central),
  'El perfil recomendado de Productos no debe crear columnas inutilizables');

for (const file of files.filter(file => file !== 'js/modules/resizable-tables.js')) {
  const source = fs.readFileSync(file, 'utf8');
  assert(!/addEventListener\(['"](?:mouse|pointer|touch)move['"][\s\S]{0,400}(?:colgroup|column|columna)/i.test(source), 'Resize paralelo detectado en ' + file);
}

console.log('OK: ' + tables.length + ' grillas auditadas; ' + unidentified.length + ' usan identidad derivada; ' + duplicates.length + ' identidades repetidas entre archivos.');
