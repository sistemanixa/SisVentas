'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Policy=require('../cotizador/ot-structure-policy'),Metadata=require('../cotizador/ot-metadata-policy');
function fixture(kind='claim',supportResolving=false){const profile={rol:'admin',activo:true},cfg={indiceVersion:2,indiceRevision:2,indiceModulos:{ordentrabajo:true,soporte:true},acciones:{ot:{editarDatosAdministrativos:true},soporte:{resolver:true}}},context=Policy.authority(profile,cfg,kind),cap=Policy.issue({uid:'u',otKey:'ot',operationId:'fiction-resolving',kind,generation:'fiction-generation',supportResolving,...context}),actor={uid:'u',claims:{uid:'u'},mode:'user',operation:'ot-structure',opId:'fiction-resolving',otStructure:cap},lease={actorUid:'u',opId:'fiction-resolving',fence:'fiction-fence'};return {profile,cfg,actor,lease};}
test('Resolving is true only for genuine claim resolution and Metadata inherits it',()=>{
 const f=fixture('claim',true);assert.equal(Policy.token(f.actor,f.lease).svOTMetadataResolving,true);assert.equal(Metadata.token(f.actor,f.lease).svOTMetadataResolving,true);assert.doesNotThrow(()=>Policy.validate(f.actor,f.profile,f.cfg));
 for(const kind of Policy.kinds){const g=fixture(kind);assert.equal(Policy.token(g.actor,g.lease).svOTMetadataResolving,false);}
 for(const value of [1,'true',null]){const g=fixture('claim',value);assert.equal(Policy.token(g.actor,g.lease).svOTMetadataResolving,false);}
});
test('cloned or absent private capability and wrong lease never emit Resolving',()=>{
 const f=fixture('claim',true);for(const actor of [{...f.actor,otStructure:{...f.actor.otStructure}},{...f.actor,otStructure:null},{...f.actor,uid:'other'}]){const claims=Policy.token(actor,f.lease);assert.equal(claims.svOTMetadataVersion,0);assert.equal(claims.svOTMetadataResolving,false);}
 assert.equal(Policy.token(f.actor,{...f.lease,opId:'other'}).svOTMetadataResolving,false);
});
test('actor JWT flags cannot enable or suppress private Resolving authority',()=>{
 const plain=fixture();plain.actor.claims.svOTMetadataResolving=true;plain.actor.claims.supportResolving=true;plain.actor.supportResolving=true;assert.equal(Metadata.token(plain.actor,plain.lease).svOTMetadataResolving,false);
 const real=fixture('claim',true);real.actor.claims.svOTMetadataResolving=false;assert.equal(Metadata.token(real.actor,real.lease).svOTMetadataResolving,true);
});
test('genuine Resolving still requires current resolver permission after issuance',()=>{
 const f=fixture('claim',true),revoked={...f.cfg,acciones:{...f.cfg.acciones,soporte:{resolver:false}}};assert.throws(()=>Policy.validate(f.actor,f.profile,revoked),{statusCode:403});assert.equal(Policy.token(f.actor,f.lease).svOTMetadataResolving,true);assert.throws(()=>Metadata.validate(f.actor,f.profile,revoked),{statusCode:403});
});
