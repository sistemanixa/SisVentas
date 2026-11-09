'use strict';
// Exact local preparation; never changes a checked-out immutable application.
function prepare(source){
 const start=source.indexOf('async function eliminarOT(fbKey) {'),end=source.indexOf('\nfunction buscarProveedor',start);if(start<0||end<0)throw Error('No se identificó el circuito OT vigente.');
 const part=source.slice(start,end),anchor="    notify('Verificando la OT…');";
 if(part.includes('canDeleteOT'))throw Error('La comprobación ya está integrada.');
 if(part.split(anchor).length!==2)throw Error('La función OT no coincide con la base revisada.');
 const next=part.replace(anchor,`    notify('Verificando disponibilidad…');
    if (typeof window.SVFinancialCommands.canDeleteOT !== 'function') { notify('Actualizá la aplicación para comprobar la eliminación de OT.'); return; }
    var enabled = await window.SVFinancialCommands.canDeleteOT();
    if (!check()) return;
    if (!enabled) { notify('La eliminación de OT no está disponible en este momento. No se modificó la orden.'); return; }
    notify('Verificando la OT…');`);
 return source.slice(0,start)+next+source.slice(end);
}
module.exports={prepare};
