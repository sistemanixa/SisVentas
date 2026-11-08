'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/current-ot-delivery-node.cjs');
const Host=require('../js/modules/client-account-host.v1');
for(const changed of ['uid','auth','db','role','revision','epoch','permission','ot','materials','error'])test('cold preparation cancels '+changed+' before confirmation or writes',async()=>{
 const f=await fixture(),w=f.w,before=structuredClone(f.state.sisventas);let confirms=0;
 w.svConfirm=async()=>{confirms++;return true;};
 w.SVClientAccountHost.prepareWrite=async()=>{
  if(changed==='uid')w.currentUserUid='other';if(changed==='auth')w.fbAuth.currentUser={uid:'u'};if(changed==='db')w.fbDB={};if(changed==='role')w.currentRole='tecnico';if(changed==='revision')w.PERMISOS_ROLES.admin.indiceRevision++;if(changed==='epoch')w._svOperacionesSesionEpoch=1;if(changed==='permission')w.tienePermiso=()=>false;if(changed==='ot')w.otData=[structuredClone(w.otData[0])];if(changed==='materials')w.otData[0].materiales[0].vendida=4;if(changed==='error')throw Error('Fictional preparation error');return true;
 };
 await w.otCustodiaEntregar();assert.equal(confirms,0);assert.equal(f.commands.length,0);assert.equal(f.sdkPatches.length,0);assert.deepEqual(f.state.sisventas,before);
});
test('double click during cold preparation creates one confirmation and commit',async()=>{
 const f=await fixture(),w=f.w;let release,confirms=0,prepares=0;const pending=new Promise(resolve=>{release=resolve;});
 w.SVClientAccountHost.prepareWrite=async()=>{prepares++;await pending;return true;};w.svConfirm=async()=>{confirms++;return true;};
 const first=w.otCustodiaEntregar();await w.otCustodiaEntregar();assert.equal(prepares,1);assert.equal(confirms,0);release();await first;
 assert.equal(confirms,1);assert.equal(f.commands.length,1);assert.equal(f.get('sisventas/ordenes_trabajo/ot/materiales/0/entregada'),3);
});
test('first public delivery resolves real cold ON host without external preparation',async()=>{
 const f=await fixture(),w=f.w;
 w.document={hidden:false,getElementById:()=>null,addEventListener(){}};
 w.location={hash:'#/ordentrabajo'};w.navigator={onLine:true};
 w.SV_CLIENT_ACCOUNTS_ROLLOUT={schema:1,enabled:true};
 w.SVClientAccountHost=Host.install(w);
 assert.equal(w.SVClientAccountHost.coordinated(),false);
 assert.equal(f.get('sv_client_accounts_config').ready,true);
 await w.otCustodiaEntregar();
 assert.equal(f.get('sisventas/ordenes_trabajo/ot/materiales/0/entregada'),3,'Cold first attempt must deliver without prewarming: '+JSON.stringify(f.notes));
 assert.equal(w.SVClientAccountHost.coordinated(),true);
 assert.equal(f.commands.length,1);assert.equal(f.sdkPatches.length,0);
});
