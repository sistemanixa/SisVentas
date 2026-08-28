const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.v2.3.2.js'), 'utf8');
const health = fs.readFileSync(path.join(__dirname, '..', 'js', 'modules', 'refactor-health.js'), 'utf8');

function bloque(desde, hasta) {
  const inicio = app.indexOf(desde);
  const fin = app.indexOf(hasta, inicio + desde.length);
  if (inicio < 0 || fin <= inicio) throw new Error(`No se encontró el bloque ${desde}`);
  return app.slice(inicio, fin);
}

const preservacion = bloque('function _preservarPresupuestoPorVentaRetirada', 'async function eliminarVenta');
if (!preservacion.includes("estado: 'anulado'")) throw new Error('La venta retirada debe anular su presupuesto de origen');
if (!preservacion.includes('ventaRetiradaId')) throw new Error('Debe conservarse la referencia visible de la venta retirada');
if (!preservacion.includes('ventaRetiradaFbKey')) throw new Error('Debe conservarse la referencia técnica de la venta retirada');
if (!preservacion.includes('audit: audit')) throw new Error('La corrección debe quedar auditada');

const eliminar = bloque('async function eliminarVenta', 'async function anularVenta');
if (!eliminar.includes("_preservarPresupuestoPorVentaRetirada(v, 'eliminada')")) throw new Error('Eliminar venta debe preservar el presupuesto');

const anular = bloque('async function anularVenta', 'function toggleMenuPpto');
if (!anular.includes("_preservarPresupuestoPorVentaRetirada(v, 'anulada')")) throw new Error('Anular venta debe preservar el presupuesto');

if (!app.includes('Convertido históricamente')) throw new Error('Falta la explicación visible para conversiones históricas');
if (!health.includes('p.conversionHistoricaSinVenta === true && p.ventaRetiradaId')) throw new Error('La auditoría volvería a denunciar casos históricos ya resueltos');

console.log('OK presupuesto conserva trazabilidad cuando su venta es anulada o eliminada');
