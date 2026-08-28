const fs = require('fs');
const path = require('path');

const js = fs.readFileSync(path.join(__dirname, '..', 'js', 'modules', 'maintenance.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.v2.3.2.js'), 'utf8');

if (!js.includes("refGasto.replace(/^hsextra_grupo\\//,'')===refOrigen.replace(/^hsextra_solicitudes\\//,'')")) {
  throw new Error('Mantenimiento no reconoce que hsextra_grupo y hsextra_solicitudes representan el mismo pago');
}
if (!js.includes("tipoPagable==='hextra'")) {
  throw new Error('La equivalencia debe limitarse a horas extra');
}
if (!app.includes("refGasto.replace(/^hsextra_grupo\\//, '') === refOrigen.replace(/^hsextra_solicitudes\\//, '')")) {
  throw new Error('La función canónica de Gastos no reconoce la referencia agrupada de horas extra');
}

console.log('OK mantenimiento reconoce horas extra agrupadas ya registradas en Gastos');
