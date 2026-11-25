'use strict';
const Legacy=require('./ot-stock-consumption-model'),Warehouse=require('./ot-warehouse-receipt');
function plan(input,command){const before=input?.rendicionesOT?.[command.receipt];if(Warehouse.modern(before))Warehouse.balance(before);const result=Legacy.plan(input,command),after=result.rendicionesOT[command.receipt];if(Warehouse.modern(after))Warehouse.balance(after);return result;}
module.exports={plan};
