'use strict';
const {key}=require('./purchase-inventory-model'),{digest}=require('./labor-guard'),Financial=require('./sale-financial-dependencies-model');
const fail=message=>Object.assign(Error(message),{statusCode:409,code:'SV_PURCHASE_LINKED_SOURCE'});
async function readiness({read,guard}){
 if(guard?.clientAccounts!==true||guard?.clientHistory!==true||guard?.saleFinancialDependencies!==true)throw fail('La compra vinculada requiere coordinación financiera e historial completos.');
 const configPaths=['sv_commercial_pages_config','sv_client_accounts_config','sv_client_history_config'],dependencies=Object.create(null);
 for(const path of configPaths){const value=await read(path);if(value?.schema!==1||value.ready!==true||!value.generation)throw fail('La proyección comercial todavía no está preparada.');dependencies[path]=value;}
 const coverage=await read(Financial.ROOT+'/coverage');Financial.validateCoverage(coverage);dependencies[Financial.ROOT+'/coverage']=coverage;
 return dependencies;
}
async function load({order,orderKey,read,guard}){
 const dependencies=await readiness({read,guard});
 async function source(path){const value=await read(path);if(!value||typeof value!=='object'||Array.isArray(value))throw fail('Falta una fuente original de la compra.');dependencies[path]=value;return value;}
 const sale=order.ventaFbKey?await source('sisventas/ventas/'+key(order.ventaFbKey)):null,list=order.listaMaterialesId?await source('sisventas/listas_materiales/'+key(order.listaMaterialesId)):null,sourceList=order.listaOrigenId?await source('sisventas/listas_materiales/'+key(order.listaOrigenId)):null,otherOrders=Object.create(null);
 if(sale&&!Array.isArray(sale.ordenesCompraIds)||list&&!Array.isArray(list.ordenesIds))throw fail('Los vínculos comerciales no están completos.');
 const ids=[...new Set([...(sale?.ordenesCompraIds||[]),...(list?.ordenesIds||[]),...(sourceList?.ordenesIds||[])])];
 if(ids.length>100)throw fail('Hay demasiadas órdenes vinculadas para esta operación.');
 for(const id of ids){key(id);if(id===orderKey)continue;const other=await source('sisventas/ordenes/'+id);if(!(order.ventaFbKey&&other.ventaFbKey===order.ventaFbKey)&&!(order.listaMaterialesId&&other.listaMaterialesId===order.listaMaterialesId))throw fail('Una orden referenciada pertenece a otra compra.');otherOrders[id]=other;}
 return {sale,list,sourceList,otherOrders,dependencyHash:digest(dependencies),assertFresh:async readFresh=>{for(const [path,value]of Object.entries(dependencies))if(digest(await readFresh(path))!==digest(value))throw fail('Una fuente comercial o su preparación cambió.');}};
}
module.exports={load,readiness};
