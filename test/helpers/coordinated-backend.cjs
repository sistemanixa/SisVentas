'use strict';
const {createBackend,apply}=require('./labor-ui-flow.cjs');
const Accounts=require('../../cotizador/client-account-projections'),History=require('../../cotizador/client-history-model'),Pages=require('../../cotizador/commercial-pages-projections'),Membership=require('../../cotizador/payment-membership-index');
async function createCoordinatedBackend(input={}){
 const records=Object.fromEntries(History.domains.map(domain=>[domain,structuredClone(input[domain]||{})]));
 const customers={clients:structuredClone(input.clientes||{c:{id:'C-FIXTURE',nombre:'Persona ficticia'}}),structures:structuredClone(input.clientes_unificados||{}),index:structuredClone(input.clientes_unificados_indice||{})};
 const backend=createBackend({...input,...records,clientes:customers.clients,clientes_unificados:customers.structures,clientes_unificados_indice:customers.index},{coordinated:true});
 const owner=record=>record.responsableUid||'u';
 apply(backend.state,{...(await Pages.prepare({sales:records.ventas,payments:records.pagos,owner,generation:'fixture-commercial',nativeCollections:true})).patch,...(await Accounts.prepare({sales:records.ventas,payments:records.pagos,customers,owner,generation:'fixture-accounts'})).patch,...Membership.buildIndex(records.pagos,{generation:'fixture-membership',ready:true}).patch,...(await History.prepare({records,customers,owner,generation:'fixture-history'})).patch,sv_commercial_pages_config:{schema:1,ready:true,generation:'fixture-commercial',nativeCollectionsReady:true,nativeCollectionsSchema:1},sv_client_accounts_config:{schema:1,ready:true,generation:'fixture-accounts'},sv_client_history_config:{schema:1,ready:true,generation:'fixture-history',writerSchema:1}});
 return backend;
}
module.exports={createCoordinatedBackend};
