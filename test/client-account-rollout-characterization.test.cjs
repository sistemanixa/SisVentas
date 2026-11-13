'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Host=require('../js/modules/client-account-host.v1'),Mode=require('../js/core/client-account-mode.v1');
test('current candidate host fails before writing when private mode read is denied',async()=>{
 let reads=0,writes=0;
 const root={document:{hidden:false,getElementById:()=>null,addEventListener(){}},currentUserUid:'fixture',currentRole:'admin',fbAuth:{currentUser:{uid:'fixture'}},fbDB:{},PERMISOS_ROLES:{admin:{indiceRevision:1}},navigator:{onLine:true},_svPaginaDesdeRuta:()=> 'clientes',permisoModulo:()=>true,fbRef:(_,path)=>path,fbGet:async path=>{assert.equal(path,'sv_commercial_pages_config');reads++;throw Object.assign(Error('Permission denied'),{code:'PERMISSION_DENIED'});}};
 const host=Host.install(root);
 root.SV_CLIENT_ACCOUNTS_ROLLOUT={schema:1,enabled:true};
 await assert.rejects(async()=>{await host.prepareWrite();writes++;},{code:'PERMISSION_DENIED'});
 assert.equal(reads,1);assert.equal(writes,0);
});
test('real mode classifier preserves observed coordination when config disappears or ready is false',()=>{
 for(const config of [null,{ready:false,schema:1,generation:'fixture',writerMode:Mode.WRITER}]){
  const mode=Mode.classify(config,{installed:true});assert.equal(mode.coordinated,true);assert.equal(mode.state,'paused');
 }
});
test('never-installed classification is distinct from a failed configuration read',()=>{
 assert.equal(Mode.classify(null).state,'legacy');assert.throws(()=>Mode.classify({ready:'false'}));
});
