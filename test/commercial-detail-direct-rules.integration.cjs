'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {rest,restrictedFetch,base,ns}=require('./helpers/demo-rtdb-rules.cjs');
test('actual baseline rules authorize an admin point detail but never a forged client admin or revoked identity',{skip:process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9046'||!process.env.SV_RULES_TEST_FILE,timeout:60000},async()=>{
 const rules=JSON.parse(fs.readFileSync(process.env.SV_RULES_TEST_FILE,'utf8'));
 const installed=await fetch(base+'/.settings/rules.json?ns='+ns,{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify(rules)});assert.equal(installed.status,200);
 await rest('PUT','',{sv_chat_roles:{admin:{activo:true,rol:'admin'},staff:{activo:true,rol:'administrativo'},other:{activo:true,rol:'administrativo'}},sv_permisos:{admin:{indiceVersion:2,indiceModulos:{detalle:true,venta:true}},administrativo:{indiceVersion:2,indiceModulos:{detalle:true,venta:true,cobranzas:true}}},sisventas:{ventas:{own:{id:'V-FICTICIA',responsableUid:'staff',total:100,items:[{costo:40}]},other:{id:'V-OTRA-FICTICIA',responsableUid:'other',total:200,items:[{costo:80}]}}}});
 async function read(uid,key,clientRole='admin',claims={}){const url=new URL(base+'/sisventas/ventas/'+key+'.json');url.searchParams.set('ns',ns);url.searchParams.set('auth_variable_override',JSON.stringify({uid,token:{uid,...claims}}));const response=await restrictedFetch(url,{headers:{'X-Client-Role':clientRole}});await response.body?.cancel();return response.status;}
 assert.equal(await read('admin','other'),200);assert.equal(await read('staff','own','administrativo'),200);
 assert.equal(await read('staff','other','admin'),401,'UI role cannot grant a different Auth user another original');
 await rest('PUT','sv_chat_roles/admin/activo',false);assert.equal(await read('admin','other'),401);
 await rest('PUT','sv_chat_roles/admin',{activo:true,rol:'administrativo'});assert.equal(await read('admin','other','admin'),401,'role revocation takes effect in Firebase itself');
 await rest('PUT','sv_chat_roles/admin',{activo:true,rol:'admin'});assert.equal(await read('admin','other','admin',{svPasswordChangeRequired:true}),401);
 await rest('PUT','sv_access_resets/admin',{required:true});assert.equal(await read('admin','other'),401);
});
