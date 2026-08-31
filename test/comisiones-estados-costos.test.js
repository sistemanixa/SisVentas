const fs = require('fs');
const assert = require('assert');

const finance = fs.readFileSync('js/modules/finance-details.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

assert(html.includes('<div class="m-label">Aprobado</div>'), 'La venta cobrada no debe presentarse como comisión cobrada');
assert(html.includes('<div class="m-label">Pendiente de aprobación</div>'), 'Debe distinguirse la aprobación de la comisión');
assert(finance.includes("typeof obtenerCostoItemVenta === 'function'"), 'Comisiones debe reutilizar el costo auditado de ventas');
assert(finance.includes('v.items || v.productos || v.detalle || v.lineas'), 'Debe reconocer las líneas históricas de la venta');
assert(finance.includes("['aprobado','pagado','pagado_parcial'].indexOf(estadoComision)"), 'El KPI aprobado debe depender del movimiento de comisión');
assert(!finance.includes("estadoPago === 'pago_total' ? '<span class=\"badge b-green\">Cobrado</span>'"), 'No debe confundir el cobro de la venta con la aprobación de comisión');
assert(finance.includes('Recalcular comisión'), 'Las comisiones históricas inconsistentes deben quedar señaladas');
assert(finance.includes('minimumFractionDigits:cents?2:0'), 'Los totales deben conservar centavos reales');

console.log('OK: comisiones separan venta, aprobación, costos auditados y redondeo.');
