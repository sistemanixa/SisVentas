'use strict';
// Pure build transform based on proposal 255ec144. No file or database writes.
const crypto=require('node:crypto');
const SOURCE_FUNCTION_SHA256='b99114a7ffe99c99bb4add966d9614faaf3f7fbdb0657f0d16efd87e89b2c87c';
const gate="  // Límite UX: no hay una cascada de cliente certificada para Accounts ON.\n"+
 "  if (window.SV_CLIENT_ACCOUNTS_ROLLOUT?.enabled === true) {\n"+
 "    notify('La eliminación está en revisión. Podés desactivar el cliente sin perder su historial.');\n"+
 "    return;\n"+
 "  }\n";
const anchor='  var sedesVinculadas = ',beginAnchor='async function eliminarCliente(el) {';
const hash=text=>crypto.createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex');
function section(source){if(typeof source!=='string'||source.split(beginAnchor).length!==2)throw Error('Client deletion source changed: unique function required');const begin=source.indexOf(beginAnchor),tail=source.slice(begin),end=/\r?\nfunction eliminarClienteDesdeHistorial\(\)/.exec(tail);if(!end)throw Error('Client deletion source changed: missing boundary');return{begin,end:begin+end.index,text:tail.slice(0,end.index)};}
function prepare(source){const existing=section(source);if(existing.text.includes('SV_CLIENT_ACCOUNTS_ROLLOUT')||existing.text.includes('Límite UX:'))throw Error('Client deletion rollout gate already present');if(hash(existing.text)!==SOURCE_FUNCTION_SHA256||existing.text.split(anchor).length!==2)throw Error('Client deletion source changed: review the approved transform');const replacement=existing.text.replace(anchor,gate+anchor);return source.slice(0,existing.begin)+replacement+source.slice(existing.end);}
function validateGated(source){const existing=section(source),normalized=existing.text.replace(/\r\n/g,'\n');if(normalized.split(gate).length!==2||hash(normalized.replace(gate,''))!==SOURCE_FUNCTION_SHA256)throw Error('Client deletion rollout gate missing or changed');return true;}
module.exports={prepare,validateGated,SOURCE_FUNCTION_SHA256};
