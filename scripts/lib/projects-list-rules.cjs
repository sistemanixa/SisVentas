'use strict';
const assert=require('node:assert/strict');
function prepare(input){
 const out=structuredClone(input),r=out.rules;assert.ok(r);
 for(const key of ['.read','.write'])assert.ok(r[key]===undefined||r[key]===false,'No admitir permisos heredados del padre');
 assert.ok(!Object.keys(r).some(k=>k.startsWith('$')),'Revisar comodines antes de agregar índices');
 assert.equal(r.sv_project_lists,undefined,'El índice ya existe; no sobrescribir');assert.equal(r.sv_project_list_config,undefined,'La configuración ya existe; no sobrescribir');
 const indexes=r.sv_proyectos?.['.indexOn'];r.sv_proyectos={...(r.sv_proyectos||{}),'.indexOn':[...new Set([...(typeof indexes==='string'?[indexes]:Object.values(indexes||{})),'_listProjectionPending'])]};
 r.sv_project_lists={'.read':false,'.write':false,'$scope':{'.indexOn':['order']}};
 r.sv_project_list_config={'.read':false,'.write':false};return out;
}
module.exports={prepare};
