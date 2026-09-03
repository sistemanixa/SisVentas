const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const moduleSource = fs.readFileSync('js/modules/commissions.js', 'utf8');

['pendientes', 'aprobadas', 'rechazadas', 'total'].forEach((id) => {
  assert(html.includes(`id="com-card-${id}"`), `El KPI ${id} debe ser interactivo.`);
  assert(html.includes(`id="com-kpi-${id}-sub"`), `El KPI ${id} debe informar la cantidad.`);
});
assert(moduleSource.includes("actualizarKpi('pendientes'"), 'Pendientes debe calcular su suma monetaria.');
assert(moduleSource.includes("actualizarKpi('aprobadas'"), 'Aprobadas debe calcular su suma monetaria.');
assert(moduleSource.includes("actualizarKpi('rechazadas'"), 'Rechazadas debe calcular su suma monetaria.');
assert(moduleSource.includes("window.filtrarComisionesPorEstado=filtrarComisionesPorEstado"), 'Los KPI deben filtrar la grilla.');
assert(moduleSource.includes("estadoGrupo(g) !== 'rechazado'"), 'Total asignado debe excluir las comisiones rechazadas.');
assert(!moduleSource.includes("card.style.outline"), 'La selección de un KPI no debe dibujar un reborde adicional.');
assert(moduleSource.includes("item.motivoRechazo"), 'La grilla debe leer el motivo guardado del rechazo.');
assert(moduleSource.includes("g.motivoRechazo || 'Sin motivo registrado'"), 'El detalle debe mostrar el motivo o aclarar que es histórico.');
assert(!moduleSource.includes("ID ' + esc(g.fbKey)"), 'No se debe exponer la clave interna de Firebase como dato del empleado.');

console.log('OK: KPI monetarios y filtrables, motivos visibles e identificadores internos ocultos.');
