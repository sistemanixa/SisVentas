'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs');
const M=require('../scripts/lib/sale-delete-history-financial-preparation.cjs'),S=require('../scripts/lib/commercial-cut-preparation.cjs');
const {digest}=require('../cotizador/labor-guard');
async function fixture(){
 const backend=await createCoordinatedBackend({ventas:{s:{id:'V-FICTION',fecha:'2026-11-04',clienteFbKey:'c',responsableUid:'u',subtotal:100,total:100}},pagos:{p:{ventaFbKey:'s',fecha:'2026-11-04',monto:20}}});
 const state=backend.state;
 state.sv_usuarios={profile:{uid:'u',nombre:'Persona ficticia',rol:'admin',activo:true}};
 const get=path=>path.split('/').reduce((v,k)=>v?.[k],state)??null;
 const sources=Object.fromEntries(S.SOURCES.map(path=>[path,structuredClone(get(path)||{})]));
 return {schema:1,sources,manifest:Object.fromEntries(S.SOURCES.map(path=>[path,{complete:true,sha256:digest(sources[path])}])),generations:{history:'history-new-fixture',financial:'financial-new-fixture'},observed:{history:null,historyConfig:null,financial:null,accountsConfig:get('sv_client_accounts_config'),accountsCoverage:get('sv_client_accounts/v1/coverage/all'),accountSources:get('sv_client_accounts/v1/sources'),pagesConfig:get('sv_commercial_pages_config'),pagesCoverage:get('sv_commercial_pages/v1/coverage')}};
}
test('offline H/Financial proposal preserves existing Accounts, Pages, sources and payment indexes',async()=>{
 const input=await fixture(),before=structuredClone(input),result=await M.prepare(input);
 assert.deepEqual(input,before);
 assert.deepEqual(Object.keys(result.patch).sort(),['sv_client_history/v1','sv_sale_financial_dependencies/v1']);
 assert.equal(result.originalWrites,0);assert.equal(result.activationAuthorized,false);assert.equal(result.remoteVerified,false);
 assert.equal(result.issues.unresolvedFinancial,0);assert.equal(result.patch['sv_client_history/v1'].state.ready,true);
 assert.equal(result.patch['sv_sale_financial_dependencies/v1'].coverage.ready,true);
});
test('missing/incomplete source and existing destination cannot be inferred or overwritten',async()=>{
 for(const mutate of [i=>delete i.sources['sisventas/gastos'],i=>i.manifest['sisventas/gastos'].complete=false,i=>i.sources['sisventas/ventas'].s.total=99,i=>i.observed.history={},i=>i.observed.financial={},i=>i.observed.historyConfig={},i=>i.observed.accountsConfig.generation='other']){
  const input=await fixture();mutate(input);await assert.rejects(M.prepare(input),{code:'SV_SALE_DELETE_PREPARATION'});
 }
});
test('stale account amounts and missing payment contribution stop preparation without repairing money',async()=>{
 for(const mutate of [i=>i.observed.accountSources.sales.s.public.paidCents++,i=>delete i.observed.accountSources.payments.p]){const input=await fixture();mutate(input);const before=structuredClone(input);await assert.rejects(M.prepare(input),{code:'SV_SALE_DELETE_PREPARATION'});assert.deepEqual(input,before);}
});
test('financial memberships are retained as blocking evidence, never removed to permit deletion',async()=>{
 const input=await fixture();input.sources['sisventas/gastos']={expense:{ventaFbKey:'s',monto:7,fecha:'2026-11-04'}};
 input.manifest['sisventas/gastos'].sha256=digest(input.sources['sisventas/gastos']);
 const before=structuredClone(input),result=await M.prepare(input);
 assert.deepEqual(input,before);assert.equal(result.originalWrites,0);
 assert.equal(Object.keys(result.patch['sv_sale_financial_dependencies/v1'].bySale.s).length,1);
 assert.equal(result.activationAuthorized,false);
});
