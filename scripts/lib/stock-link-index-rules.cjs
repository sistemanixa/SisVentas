'use strict';
// Metadata only: never creates data, grants, activation or global mirrors.
const targets={
 'sisventas/productos':['codigo','cod','id'],
 'sisventas/inventario_operativo':['codigo','cod','id','productoKey','productKey'],
 'sisventas/stock_vinculos/porProducto':['productKey','inventoryKey'],
 'sisventas/stock_vinculos/porInventario':['productKey','inventoryKey']
};
function add(out){const changes=[];for(const [path,required]of Object.entries(targets)){let node=out.rules;for(const key of path.split('/')){if(!node[key]||typeof node[key]!=='object'||Array.isArray(node[key]))throw Error('Falta nodo de índices: '+path);node=node[key];}const previous=node['.indexOn'];if(previous!==undefined&&typeof previous!=='string'&&(!Array.isArray(previous)||previous.some(x=>typeof x!=='string')))throw Error('Índice previo inválido: '+path);const fields=previous===undefined?[]:Array.isArray(previous)?previous.slice():[previous],added=required.filter(x=>!fields.includes(x));if(added.length){node['.indexOn']=fields.concat(added);changes.push({path:path+'/.indexOn',added,previousPresent:previous!==undefined});}}return changes;}
module.exports={add,targets};
