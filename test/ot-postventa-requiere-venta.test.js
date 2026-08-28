const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.v2.3.2.js'), 'utf8');

function exigir(fragmento, mensaje) {
  if (!app.includes(fragmento)) throw new Error(mensaje);
}

exigir("var esPostVenta = tipoVisitaPropuesto.toLocaleLowerCase('es-AR').indexOf('post-venta') >= 0", 'No se identifica el tipo post-venta');
exigir("if (esPostVenta && !ventaPostVenta)", 'La OT todavía puede guardar post-venta sin una venta válida');
exigir('Para guardar un reclamo post-venta primero seleccioná una venta válida.', 'Falta una explicación útil para el usuario');
exigir("ot.ventaFbKey = ventaPostVenta ? String(ventaPostVenta.fbKey || '').trim() : ''", 'No se guarda la referencia técnica de la venta');
exigir("ot.origen = ventaPostVenta ? 'venta' : 'manual'", 'El origen de la OT no queda coherente con su vínculo');
exigir("if (esReclamoPostVenta && !String(ot.reclamoKey || ot.reclamoFbKey || '').trim())", 'El guardado directo todavía permite reclamos post-venta sin reclamo original');
exigir('Un reclamo post-venta debe crearse desde Soporte y conservar el reclamo original', 'Falta bloquear el guardado inconsistente en Firebase');
exigir('Para guardar un reclamo post-venta abrilo primero desde Soporte / Reclamos.', 'La edición no explica cómo conservar el reclamo original');

console.log('OK una OT post-venta exige venta canónica y reclamo original');
