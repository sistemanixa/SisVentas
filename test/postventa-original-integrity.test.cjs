'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../js/core/postventa-demand-proposal');
function fixture(extra={}){
 let page='soporte',shown=null;const notices=[],calls=[],raw={id:'V-FICTION',total:100,responsableUid:'u',_svListRevision:7,audit:[{accion:'Original ficticio'}],items:[{cod:'QA',qty:1,punit:100,costoUnitarioCompra:50}],...extra};
 const summary={key:'sale',ownerUid:'u',totalCents:10000,paidCents:2000,balanceCents:8000};
 const root={currentUserUid:'u',currentRole:'administrativo',fbAuth:{currentUser:{uid:'u'}},fbDB:{},PERMISOS_ROLES:{administrativo:{indiceRevision:1}},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},navigator:{onLine:true},document:{hidden:false,querySelector:()=>({id:'page-'+page}),getElementById:()=>({style:{},dataset:{}}),addEventListener(){}},permisoModulo:()=>true,svPuedeLeerDominio:()=>true,notify:m=>notices.push(m),SVCommercialOwnership:{request:async(domain,path)=>{calls.push({domain,path});return {record:structuredClone(raw)};}},SVCommercialPagesReader:require('../js/core/commercial-pages-reader.v1'),fbRef:(_,p)=>p,fbGet:async p=>({val:()=>p==='sv_commercial_pages_config'?{schema:1,ready:true,generation:'g'}:p==='sv_commercial_pages/v1/coverage'?{schema:1,ready:true,generation:'g',revision:1}:structuredClone(summary)})};
 const api=create(root);root.svNavegarDirecto=(route,work)=>{page=route;work();return true;};root.spCerrarModal=()=>{};root.verVenta=ref=>{shown=api.resolve(ref);};
 return {raw,summary,api,root,calls,notices,get shown(){return shown;}};
}
test('financial action receives the exact original, not an ownership-enriched view that changes its CAS hash',async()=>{
 const f=fixture(),before=structuredClone(f.raw),record=await f.api.begin().financialByKey('sale');assert.deepEqual(record,{...before,fbKey:'sale'});assert.deepEqual(f.raw,before);assert.equal(Object.hasOwn(record,'_svOwnerUid'),false);assert.equal(f.api.summary(record).paidCents,2000);assert.deepEqual(f.calls,[{domain:'ventas',path:'registro/sale'}]);
});
test('a legitimate stored field is preserved rather than removed to hide a compare mismatch',async()=>{
 const f=fixture({_svOwnerUid:'stored-metadata'}),record=await f.api.begin().financialByKey('sale');assert.deepEqual(record,{...f.raw,fbKey:'sale'});assert.equal(record._svListRevision,7);assert.equal(record._svOwnerUid,'stored-metadata');
});
test('point view still uses current authorized ownership and authoritative financial totals',async()=>{
 const f=fixture({_svOwnerUid:'stored-metadata'});assert.equal(await f.api.open({fbKey:'claim',ventaFbKey:'sale'},null),true);assert.equal(f.shown._svOwnerUid,'u');assert.equal(f.api.summary(f.shown).balanceCents,8000);assert.equal(f.raw._svOwnerUid,'stored-metadata');assert.deepEqual(f.notices,[]);
});
test('returning the original never bypasses the summary ownership check',async()=>{
 const f=fixture();f.summary.ownerUid='other';await assert.rejects(f.api.begin().financialByKey('sale'),/no está disponible/);assert.equal(f.api.claimsPointView('detalle'),false);assert.equal(f.shown,null);
});
