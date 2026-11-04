'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Prep=require('../scripts/lib/client-account-preparation.cjs'),P=require('../cotizador/client-account-projection');
function fixture(){return{sales:{s:{id:'V-FICTICIA',total:100.11,clienteFbKey:'c',responsableUid:'u',fecha:'2026-10-01'}},payments:{p:{ventaFbKey:'s',monto:20.03,fecha:'2026-10-02'}},budgets:{},customers:{clients:{c:{nombre:'Cliente ficticio'}},index:{},structures:{}},users:{p:{uid:'u',rol:'administrativo',activo:true,nombre:'Usuario ficticio'},new:{uid:'new',rol:'administrativo',activo:true,nombre:'Usuario nuevo'}},identities:{u:{rol:'administrativo',activo:true},new:{rol:'administrativo',activo:true}},permissions:{}};}
const at=(plan,path)=>{const base=Object.keys(plan.patch).find(base=>path===base||path.startsWith(base+'/'));return base?path.slice(base.length).split('/').filter(Boolean).reduce((v,k)=>v?.[k],plan.patch[base]):undefined;};
const prepare=sources=>Prep.prepare({accountDestination:null,sources,generation:'account-preparation-fake',commercialGeneration:'commercial-preparation-fake'});
test('prepares paired canonical sources and eligible empty owners without touching originals or activating',async()=>{
 const sources=fixture(),before=structuredClone(sources),plan=await prepare(sources);
 assert.deepEqual(sources,before);assert.deepEqual(plan.totals,{totalCents:10011,paidCents:2003,balanceCents:8008});
 assert.deepEqual(plan.counts,{sales:1,payments:1,eligibleOwners:2});assert.equal(at(plan,P.ROOT+'/coverage/u_new').salesRecords,0);
 assert.equal(at(plan,P.ROOT+'/ownerEvidence').salesRecords,1);assert.equal(plan.patch.sv_client_accounts_config,undefined);assert.equal(plan.patch.sv_commercial_pages_config,undefined);
 assert(Object.keys(plan.patch).every(p=>!p.startsWith('sisventas/')));assert(Prep.verify(plan,sources));
});
test('every omitted source fails rather than becoming an empty collection',async()=>{
 for(const name of ['sales','payments','budgets','customers','users','identities','permissions']){const sources=fixture();delete sources[name];await assert.rejects(prepare(sources),/fuentes/);}
 for(const name of ['clients','index','structures']){const sources=fixture();delete sources.customers[name];await assert.rejects(prepare(sources),/fuentes/);}
});
test('any source drift invalidates the plan, including identities and permissions',async()=>{
 for(const name of ['sales','payments','budgets','customers','users','identities','permissions']){const sources=fixture(),plan=await prepare(sources);sources[name].extra={changed:true};assert.throws(()=>Prep.verify(plan,sources),/obsoleta/);}
 const sources=fixture(),plan=await prepare(sources);at(plan,P.ROOT+'/totals/all').balanceCents++;assert.throws(()=>Prep.verify(plan,sources),/obsoleta/);
});
test('global annulled payments suppress embedded fallback and preserve overpayment and cancellation',async()=>{
 const sources=fixture();sources.sales.s.pagos=[{monto:100.11}];sources.payments.p.anulado=true;
 let plan=await prepare(sources);assert.deepEqual(plan.totals,{totalCents:10011,paidCents:0,balanceCents:10011});
 sources.payments.p={ventaFbKey:'s',monto:150.12,fecha:'2026-10-02'};plan=await prepare(sources);assert.equal(plan.totals.balanceCents,0);assert.equal(plan.totals.paidCents,10011);
 sources.sales.s.estado='anulada';plan=await prepare(sources);assert.deepEqual(plan.totals,{totalCents:0,paidCents:0,balanceCents:0});
});
test('inactive, duplicate and module-blocked users do not receive a certified new scope',async()=>{
 for(const kind of ['inactive','duplicate','blocked']){const sources=fixture();if(kind==='inactive')sources.identities.new.activo=false;if(kind==='duplicate')sources.users.other={...sources.users.new};if(kind==='blocked')sources.permissions.administrativo={indiceVersion:2,indiceModulos:{cuentacorriente:true},bloqueados:['cuentacorriente']};const plan=await prepare(sources);assert.equal(at(plan,P.ROOT+'/coverage/u_new'),undefined,kind);}
});
test('historical aliases retain evidence and ambiguous ownership is not assigned by customer name',async()=>{
 const sources=fixture();delete sources.sales.s.responsableUid;sources.sales.s.creadaPor='Autor histórico';
 const plan=await prepare(sources);assert.equal(at(plan,P.ROOT+'/sources/sales/s').ownerUid,'');assert.equal(at(plan,P.ROOT+'/sources/sales/s').ownerEvidence.legacyAliasesCount,1);
 assert.equal(at(plan,P.ROOT+'/totals/u_u').salesRecords,0);assert.equal(plan.totals.balanceCents,8008);
});
test('unified physical customers count as one debtor in both indexes while all original names remain intact',async()=>{
 const sources=fixture();sources.customers.clients.other={nombre:'Otra sede'};sources.customers.structures.g={principalLegacyFbKey:'c'};sources.customers.index={c:{clienteKey:'g'},other:{clienteKey:'g'}};
 sources.sales.t={...sources.sales.s,id:'V-FICTICIA-2',clienteFbKey:'other',total:50};const before=structuredClone(sources),plan=await prepare(sources);
 assert.deepEqual(sources,before);assert.equal(at(plan,P.ROOT+'/totals/all').debtors,1);
 assert.equal(at(plan,'sv_commercial_pages/v1/collectionTotals').debtorCount,1);assert.equal(plan.totals.balanceCents,13008);
 assert.equal(at(plan,'sv_commercial_pages/v1/records/sales/t').clientKey,'g');
});
test('complete preparation includes rows beyond the first fifty and rejects any altered activation artifact',async()=>{
 const sources=fixture();for(let n=0;n<121;n++)sources.sales['x'+n]={...sources.sales.s,id:'V-FICTICIA-'+n,total:1.01};
 const plan=await prepare(sources);assert.equal(plan.counts.sales,122);assert.equal(plan.totals.totalCents,22232);assert.equal(at(plan,P.ROOT+'/ownerEvidence').salesRecords,122);
 for(const change of [p=>p.activation.accounts.generation='wrong',p=>p.generation='wrong',p=>p.counts.sales--,p=>p.totals.balanceCents--]){const changed=structuredClone(plan);change(changed);assert.throws(()=>Prep.verify(changed,sources),/obsoleta/);}
 assert(Prep.verify(JSON.parse(JSON.stringify(plan)),sources));
});
test('a converted historical sale uses the exact original budget ownership policy, not its converter',async()=>{
 const sources=fixture();delete sources.sales.s.responsableUid;sources.sales.s.creadaPor='Usuario nuevo';sources.sales.s.presupuestoFbKey='b';sources.budgets.b={responsableUid:'u'};
 let plan=await prepare(sources);assert.equal(at(plan,P.ROOT+'/sources/sales/s').ownerUid,'u');assert.equal(at(plan,P.ROOT+'/totals/u_new').salesRecords,0);
 sources.sales.s.responsableUid='new';plan=await prepare(sources);assert.equal(at(plan,P.ROOT+'/sources/sales/s').ownerUid,'new');
});
test('unresolved historical budget authors remain in evidence even when the sale names only its converter',async()=>{
 const sources=fixture();delete sources.sales.s.responsableUid;sources.sales.s.creadaPor='Usuario nuevo';sources.sales.s.presupuestoFbKey='b';sources.budgets.b={empleado:'Autor anterior ficticio'};
 const plan=await prepare(sources),source=at(plan,P.ROOT+'/sources/sales/s');assert.equal(source.ownerUid,'');assert.equal(source.ownerEvidence.legacyAliasesCount,2);
 const Evidence=require('../cotizador/client-account-owner-evidence');assert(source.ownerEvidence.legacyAliases.includes(Evidence.fromRecord(sources.budgets.b,'presupuestos').legacyAliases[0]));
});
test('technical destinations are complete root replacements, removing stale payment members instead of overlaying',async()=>{
 const sources=fixture(),first=await prepare(sources);sources.payments={};const next=await prepare(sources),Index=require('../cotizador/payment-membership-index');
 assert.deepEqual(Object.keys(next.patch).sort(),[P.ROOT,'sv_commercial_pages/v1',Index.INDEX_ROOT].sort());
 const state={...first.patch,...next.patch};assert.equal(state[Index.INDEX_ROOT].coverage.paymentCount,0);assert.equal(state[Index.INDEX_ROOT].reverse,undefined);
 assert.equal(at(next,P.ROOT+'/sources/payments/p'),undefined);
 await assert.rejects(Prep.prepare({sources,generation:'g',commercialGeneration:'c'}),/destino/);
 await assert.rejects(Prep.prepare({sources,generation:'g',commercialGeneration:'c',accountDestination:{}}),/destino/);
});

function homonyms(){const sources=fixture();sources.users.p.nombre='Homónimo ficticio';sources.users.new.nombre='Homónimo ficticio';delete sources.sales.s.responsableUid;sources.sales.s.creadaPor='Homónimo ficticio';return sources;}
test('homonymous current owners never receive certified zero scopes from an unresolved historical sale',async()=>{
 const sources=homonyms(),before=structuredClone(sources);await assert.rejects(prepare(sources),error=>{assert.equal(error.code,'SV_CLIENT_ACCOUNTS_OWNER_REVIEW');assert.equal(error.reviewCount,2);assert.deepEqual(Object.keys(error.privateReview).sort(),['new','u']);assert(!error.message.includes('Homónimo'));return true;});assert.deepEqual(sources,before);
});
test('an existing own sale does not turn an ambiguous personal account into complete partial coverage',async()=>{
 const sources=homonyms();sources.sales.own={id:'V-PROPIA-FICTICIA',responsableUid:'u',total:15,clienteFbKey:'c'};await assert.rejects(prepare(sources),{code:'SV_CLIENT_ACCOUNTS_OWNER_REVIEW',reviewCount:2});
});
test('conflicting explicit author UIDs require review for every intersecting eligible scope',async()=>{
 const sources=fixture();delete sources.sales.s.responsableUid;sources.sales.s.creadaPorUid='u';sources.sales.s.creadoPorUid='new';await assert.rejects(prepare(sources),{code:'SV_CLIENT_ACCOUNTS_OWNER_REVIEW',reviewCount:2});
});
test('a resolved budget owner does not block the converter scope merely because the sale names its converter',async()=>{
 const sources=fixture();delete sources.sales.s.responsableUid;sources.sales.s.presupuestoFbKey='b';sources.sales.s.creadaPor='Usuario nuevo';sources.budgets.b={responsableUid:'u'};
 const plan=await prepare(sources);assert.equal(at(plan,P.ROOT+'/totals/u_u').balanceCents,8008);assert.equal(at(plan,P.ROOT+'/totals/u_new').balanceCents,0);
});
test('unresolved authors outside current eligible scopes preserve global debt and block a future false empty proof',async()=>{
 const sources=fixture();delete sources.sales.s.responsableUid;sources.sales.s.creadaPor='Autor aún desconocido';const plan=await prepare(sources),{apply}=require('./helpers/labor-ui-flow.cjs'),state={};apply(state,plan.patch);
 assert.equal(plan.totals.balanceCents,8008);const read=async path=>path.split('/').reduce((v,k)=>v?.[k],state)??null;
 await assert.rejects(P.prepareEmptyScope({uid:'future',aliases:['Autor aún desconocido'],generation:plan.generation,read}),{code:'SV_CLIENT_ACCOUNTS_INCOMPLETE'});
});
