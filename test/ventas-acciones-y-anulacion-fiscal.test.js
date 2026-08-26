const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'app.css'), 'utf8');

function bloque(desde, hasta) {
  const inicio = app.indexOf(desde);
  const fin = app.indexOf(hasta, inicio + desde.length);
  if (inicio < 0 || fin <= inicio) throw new Error(`No se encontró ${desde}`);
  return app.slice(inicio, fin);
}

const tabla = bloque('function renderVentasTabla', '// Filtros y paginación de ventas');
if (!tabla.includes('onclick="verVenta(')) throw new Error('La fila debe continuar abriendo el detalle de la venta');
if (app.includes("boton('Ver detalle', 'ti-eye', \"verVenta(")) throw new Error('Ver detalle no debe repetirse en Acciones');
['Imprimir', 'Duplicar', 'Anular', 'Eliminar'].forEach((accion) => {
  if (!app.includes(`boton('${accion}'`)) throw new Error(`Falta la acción unificada ${accion}`);
});
if (!index.includes('<tbody id="ventas-tbody"></tbody>')) throw new Error('No se encontró la tabla de ventas');

const anulacion = bloque('async function anularVenta', 'function toggleMenuPpto');
if (!anulacion.includes('tieneFacturaFiscal && !notaCreditoActiva')) throw new Error('Una factura vigente debe bloquear la anulación sin NC');
if (!anulacion.includes('documentoAnulacion')) throw new Error('La NC debe quedar registrada como documento de respaldo');
if (!anulacion.includes('audit: auditAnulacion')) throw new Error('La anulación debe quedar auditada');

const detalle = bloque('var puedeEliminarVentaDetalle', 'var puedeCrearOTDesdeVenta');
if (!detalle.includes("!(v.factura && v.factura.cae) || ventaTieneNotaCreditoActiva(v)")) throw new Error('Eliminar una venta facturada debe exigir NC');
if (!detalle.includes("!(v.factura && v.factura.cae) || ventaTieneNotaCreditoActiva(v)")) throw new Error('Anular una venta facturada debe exigir NC');
const accionesDetalle = bloque('var accionesVentaDetalleHtml', 'dv.innerHTML =');
if (!accionesDetalle.includes('accionesRiesgoVentaDetalleHtml')) throw new Error('Anular y eliminar deben quedar agrupados');
if (accionesDetalle.indexOf('Anular venta') > accionesDetalle.indexOf('Eliminar definitivamente')) throw new Error('Anular debe mostrarse antes de Eliminar');
if (!accionesDetalle.includes('venta-detalle-acciones-kpi')) throw new Error('Las acciones contextuales deben quedar identificadas junto a los KPI');
if (!css.includes('.venta-detalle-acciones-kpi{display:flex;justify-content:space-between')) throw new Error('A presupuesto y las acciones de riesgo deben ocupar extremos opuestos');
if (!css.includes('.venta-detalle-acciones-riesgo{display:flex')) throw new Error('Anular y eliminar deben compartir una fila compacta');
if (!app.includes('accionesEdicionVentaDetalleHtml +\n    accionesContextualesKpiDetalleHtml +\n    metricVentaHtml')) throw new Error('Las acciones deben renderizarse inmediatamente antes de los KPI');

console.log('OK ventas con acciones unificadas y anulación fiscal respaldada');
