'use strict';
// Exact constructor outputs only. No substring, digest or supplied-expression
// exception can turn an unreviewed receipt grant into a recognized authority.
const Fence=require('../../cotizador/labor-fence-policy');
const Bonus=require('../prepare-bonus-batch-rules.cjs'),SAC=require('../prepare-sac-batch-rules.cjs');
const variants=Object.freeze({base:Fence.metadataRules().sv_labor_receipts.$op['.write'],expenseRemoval:Bonus.baselineReceipt,bonus:SAC.baselineReceipt,sac:'('+SAC.baselineReceipt+') && '+SAC.receiptContext});
const known=new Set(Object.values(variants));
function recognized(value){return typeof value==='string'&&known.has(value);}
module.exports={recognized,variants};
