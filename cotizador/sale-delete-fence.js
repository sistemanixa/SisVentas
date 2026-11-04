'use strict';
function ready(guard,store){return guard?.clientAccounts===true&&guard?.clientHistory===true&&guard?.saleFinancialDependencies===true&&store?.saleDeleteFenceReady===true&&store?.saleDeleteActivityFenceReady===true&&typeof store?.saleDeleteFinancialEvidence==='function';}
function assertReady(guard,store){if(!ready(guard,store))throw Object.assign(Error('La eliminación requiere proyecciones coordinadas y cierre verificado de todos los escritores comerciales.'),{statusCode:503,code:'SV_SALE_DELETE_FENCE_REQUIRED'});}
module.exports={ready,assertReady};
