'use strict';
// Server-owned wire/route enum; no IO, authority or callbacks.
const definitions=Object.freeze({
 listCreate:{path:'/compras/listas/crear',operation:'purchase-list-create',kind:'create',fields:['id','saleKey','expectedHash'],source:'sale'},
 listStock:{path:'/compras/listas/stock',operation:'purchase-list-stock',kind:'stock',fields:['id'],source:'none'},
 listSave:{path:'/compras/listas/guardar',operation:'purchase-list-save',kind:'save',fields:['id','listKey','expectedHash','items'],source:'list'},
 listReserve:{path:'/compras/listas/reservar',operation:'purchase-list-reserve',kind:'reserve',fields:['id','listKey','expectedHash'],source:'list'},
 listGroup:{path:'/compras/listas/agrupar',operation:'purchase-list-group',kind:'group',fields:['id','sources'],source:'group'},
 listUngroup:{path:'/compras/listas/desagrupar',operation:'purchase-list-ungroup',kind:'ungroup',fields:['id','listKey','expectedHash'],source:'list'},
 listClose:{path:'/compras/listas/cerrar',operation:'purchase-list-close',kind:'close',fields:['id','listKey','expectedHash'],source:'list'},
 listRename:{path:'/compras/listas/renombrar',operation:'purchase-list-rename',kind:'rename',fields:['id','listKey','expectedHash','name'],source:'list'},
 listPreparation:{path:'/compras/listas/preparar',operation:'purchase-preparation-save',kind:'prepare',fields:['id','listKey','expectedHash','preparation','applyCosts','documents'],source:'list',purpose:'prepare'},
 listCancelPreparation:{path:'/compras/listas/cancelar-preparacion',operation:'purchase-preparation-cancel',kind:'cancel',fields:['id','listKey','expectedHash'],source:'list',purpose:'prepare'},
 orderState:{path:'/compras/ordenes/estado',operation:'purchase-order-status',kind:'status',fields:['id','orderKey','expectedHash','state'],source:'order'},
 orderReconcile:{path:'/compras/ordenes/conciliar',operation:'purchase-order-reconcile',kind:'reconcile',fields:['id','orderKey','expectedHash','movements','exchangeRate'],source:'order',purpose:'reconcile'},
 legacyImport:{path:'/compras/legacy/importar',operation:'purchase-legacy-import',kind:'import',fields:['id','legacyKey','expectedHash'],source:'legacy',numbered:true}
});
const specs=Object.freeze(Object.fromEntries(Object.entries(definitions).map(([name,spec])=>[name,Object.freeze({...spec,fields:Object.freeze([...spec.fields])})])));
const byOperation=Object.freeze(Object.fromEntries(Object.entries(specs).map(([name,spec])=>[spec.operation,Object.freeze({...spec,name})])));
module.exports={specs,byOperation};
