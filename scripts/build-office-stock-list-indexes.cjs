'use strict';
// Offline proposal only. Adds query indexes without changing any authority.
function candidate(input){const out=structuredClone(input),data=out.rules?.sisventas;if(!data?.productos||!data.compras_resumen?.inventario_operativo)throw Error('Unknown stock list index roots');for(const[node,fields]of [[data.productos,['codigo','cod','id']],[data.compras_resumen.inventario_operativo,['general']]]){const current=node['.indexOn'];if(current!==undefined&&typeof current!=='string'&&(!Array.isArray(current)||current.some(field=>typeof field!=='string')))throw Error('Unknown existing index');node['.indexOn']=[...new Set([...(Array.isArray(current)?current:current?[current]:[]),...fields])];}return out;}
module.exports={candidate};
