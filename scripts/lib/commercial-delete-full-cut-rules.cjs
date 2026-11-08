'use strict';
// Offline composition only; all existing commercial writer stages are kept.
const Sales=require('./commercial-delete-sales-parent.cjs'),Commercial=require('./commercial-write-cut-rules.cjs'),Wildcard=require('./commercial-delete-domain-wildcard.cjs'),Atomic=require('./commercial-delete-atomic-rules.cjs');
const stages=Object.freeze(['reviewed-sales-parent','full-commercial-write-cut','destructive-domain-wildcard','atomic-delete-authority']);
function prepare(input,options){return Atomic.prepare(Wildcard.prepare(Commercial.prepare(Sales.prepare(input))),options);}
module.exports={prepare,stages};
