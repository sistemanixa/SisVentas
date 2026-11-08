'use strict';
// Build exact allowlists from the existing versioned constructors. These are
// grammar templates, not hashes/substring exceptions for supplied authority.
const Fence=require('../../cotizador/labor-fence-policy'),Receipt=require('./commercial-delete-receipt-baseline.cjs'),Writer=require('./commercial-writer-protocol-rules.cjs');
const guard=new Set([Fence.metadataRules().sv_labor_guard['.write']]),receipts=new Set(Object.values(Receipt.variants));
for(const receipt of Object.values(Receipt.variants)){
 const input={rules:{'.write':false,...Fence.metadataRules()}};input.rules.sv_labor_receipts.$op['.write']=receipt;
 const output=Writer.prepare(input);guard.add(output.rules.sv_labor_guard['.write']);receipts.add(output.rules.sv_labor_receipts.$op['.write']);
}
function recognized(path,value){return typeof value==='string'&&(path==='sv_labor_guard'?guard.has(value):path==='sv_labor_receipts/$op'?receipts.has(value):false);}
module.exports={recognized};
