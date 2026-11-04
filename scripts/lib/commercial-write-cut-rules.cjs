'use strict';
// One offline composition for the reviewed commercial write cut. This does not
// authenticate evidence, apply rules, install indexes or enable capabilities.
const Protocol=require('./commercial-writer-protocol-rules.cjs'),Financial=require('./sale-financial-write-rules.cjs');
const Accounts=require('./client-account-cut-rules.cjs'),Return=require('./sale-return-rules.cjs'),Operational=require('./operational-write-fence.cjs'),History=require('./client-history-write-rules.cjs'),OTDelete=require('./ot-delete-action-rules.cjs');
const SDKPause=require('./sdk-admission-pause-rules.cjs');
const stages=Object.freeze(['writer-protocol-two','native-collections-and-accounts','sale-return-economics','operational-originals-and-summaries','history-write-side-only','financial-dependencies-write-side-only','ot-delete-action','sdk-admission-pause']);
function prepare(baseline){
 const candidate=[Protocol.prepare,Accounts.prepare,Return.build,Operational.prepare,History.prepare,Financial.prepare,OTDelete.prepare].reduce((rules,build)=>build(rules),SDKPause.strip(baseline));
 // Server-only bounded membership lookup. This adds no read/write authority.
 const version=candidate.rules.sv_client_accounts.v1;if(version.directory)throw Error('Revisar el índice de identidad existente.');
 version.directory={index:{'.indexOn':['clienteKey']}};return SDKPause.prepare(candidate);
}
module.exports={prepare,stages};
