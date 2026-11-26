'use strict';
const Live=require('./sale-delete-live-financial-evidence');
function ready(guard,store){
 const base=guard?.clientAccounts===true&&store?.saleDeleteFenceReady===true&&store?.saleDeleteActivityFenceReady===true&&typeof store?.saleDeleteFinancialEvidence==='function';
 if(!base)return false;
 return Live.isProvider(store.saleDeleteFinancialEvidence)?guard.clientHistory===false&&guard.saleFinancialDependencies===false:guard.clientHistory===true&&guard.saleFinancialDependencies===true;
}
function assertReady(guard,store){if(!ready(guard,store))throw Object.assign(Error('La eliminación requiere proyecciones coordinadas y cierre verificado de todos los escritores comerciales.'),{statusCode:503,code:'SV_SALE_DELETE_FENCE_REQUIRED'});}
module.exports={ready,assertReady};
