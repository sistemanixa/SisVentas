'use strict';
// One offline composition for the reviewed commercial write cut. This does not
// authenticate evidence, apply rules, install indexes or enable capabilities.
const Protocol=require('./commercial-writer-protocol-rules.cjs'),Financial=require('./sale-financial-write-rules.cjs');
const Accounts=require('./client-account-cut-rules.cjs'),Return=require('./sale-return-rules.cjs'),Operational=require('./operational-write-fence.cjs'),History=require('./client-history-write-rules.cjs'),OTDelete=require('./ot-delete-action-rules.cjs');
const stages=Object.freeze(['writer-protocol-two','native-collections-and-accounts','sale-return-economics','operational-originals-and-summaries','history-write-side-only','financial-dependencies-write-side-only','ot-delete-action']);
function prepare(baseline){
 const candidate=OTDelete.prepare(Financial.prepare(History.prepare(Operational.prepare(Return.build(Accounts.prepare(Protocol.prepare(baseline)))))));
 // Server-only bounded membership lookup. This adds no read/write authority.
 const version=candidate.rules.sv_client_accounts.v1;if(version.directory)throw Error('Revisar el índice de identidad existente.');
 version.directory={index:{'.indexOn':['clienteKey']}};return candidate;
}
module.exports={prepare,stages};
