'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module');
function candidate(input){
 const rules=require('../scripts/lib/ot-lifecycle-rules.cjs').build(input),profile="root.child('sv_chat_roles').child(auth.uid)",permission="root.child('sv_permisos').child("+profile+".child('rol').val()).child('acciones/ot/eliminar')";
 const allowed='('+permission+".val() === true || (!"+permission+".exists() && "+profile+".child('rol').val() === 'admin'))";
 for(const domain of [rules.rules.sisventas.ordenes_trabajo,rules.rules.sisventas.listados_resumen.ordenes_trabajo]){
  assert.ok([false,'false',undefined].includes(domain['.write']));assert.equal(typeof domain.$record['.write'],'string');
  domain.$record['.write']='('+domain.$record['.write']+') && (newData.exists() || '+allowed+')';
 }
 return rules;
}
test('candidata delete-only sobre lifecycle conserva altas/ediciones y veto canónico',{skip:!process.env.SV_OT_DELETE_RULES,timeout:60000},async()=>{
 assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,'127.0.0.1:9057');const baseline=JSON.parse(fs.readFileSync(process.env.SV_OT_DELETE_RULES,'utf8'));
 const lifecycle=require('../scripts/lib/ot-lifecycle-rules.cjs').build(baseline);assert.deepEqual(lifecycle.rules.sisventas.ordenes_trabajo,baseline.rules.sisventas.ordenes_trabajo,'lifecycle no cierra delete de OT');
 const dep=createRequire('C:/SisVentas/tmp/firebase-security-tools/package.json'),{initializeTestEnvironment,assertSucceeds,assertFails}=dep('@firebase/rules-unit-testing'),sdk=dep('firebase/database'),Model=require('../cotizador/record-list-model');
 const env=await initializeTestEnvironment({projectId:'demo-ot-delete-action',database:{host:'127.0.0.1',port:9057,rules:JSON.stringify(candidate(baseline))}});
 try{for(const [role,override,allowed]of [['admin',undefined,true],['admin',false,false],['administrativo',true,true],['administrativo',undefined,false],['tecnico',true,true]]){
  const original={id:'OT-FIC',materiales:[]};await env.withSecurityRulesDisabled(async context=>sdk.set(sdk.ref(context.database()),{sv_chat_roles:{u:{activo:true,rol:role}},sv_permisos:{[role]:{indiceVersion:2,indiceModulos:{ordentrabajo:true},...(override===undefined?{}:{acciones:{ot:{eliminar:override}}})}},sisventas:{ordenes_trabajo:{OT1:original},listados_resumen:{ordenes_trabajo:{OT1:Model.summary('ordenes_trabajo',original)}}}}));
  const db=env.authenticatedContext('u').database(),path='sisventas/ordenes_trabajo/OT1';
  await assertSucceeds(sdk.update(sdk.ref(db),Model.plan('sisventas/ordenes_trabajo/NEW',null,{id:'OT-NEW'},'fiction-create')));
  const edited=Model.plan(path,original,{...original,observaciones:'Ficticio'},'fiction-edit');await assertSucceeds(sdk.update(sdk.ref(db),edited));
  const deletion=Model.plan(path,edited[path],null,'fiction-delete');await (allowed?assertSucceeds:assertFails)(sdk.update(sdk.ref(db),deletion));
 }
 }finally{await env.cleanup();}
});
module.exports={candidate};
