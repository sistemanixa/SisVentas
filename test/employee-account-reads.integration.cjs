'use strict';
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),{createRequire}=require('module'),path=require('path');
const dep=createRequire(path.resolve('tmp/firebase-security-tools/package.json'));
const {initializeTestEnvironment,assertFails,assertSucceeds}=dep('@firebase/rules-unit-testing'),{ref,set,get,update,query,orderByChild,equalTo}=dep('firebase/database');let env;
before(async()=>{
 if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9005')throw Error('Solo emulador local');
 env=await initializeTestEnvironment({projectId:'demo-sisventas-security',database:{host:'127.0.0.1',port:9005,rules:require('./helpers/security-candidate.cjs').rulesFor('employee-account-read')}});
 await env.withSecurityRulesDisabled(async c=>{await set(ref(c.database()),{sv_chat_roles:{admin:{activo:true,rol:'admin'},tech:{activo:true,rol:'tecnico'},other:{activo:true,rol:'tecnico'},missing:{activo:true,rol:'vendedor'},inactive:{activo:false,rol:'tecnico'},unknown:{activo:true,rol:'inventado'}},sv_empleado_uid:{tech:{empleadoFbKey:'e1'},other:{empleadoFbKey:'e2'},inactive:{empleadoFbKey:'e1'},unknown:{empleadoFbKey:'e1'}},sisventas:{ctaemp:{e1:{m:{monto:100}},e2:{m:{monto:200}}}}});});
 await env.withSecurityRulesDisabled(async c=>{const db=c.database();await set(ref(db,'sv_usuarios'),{ptech:{uid:'tech',empleadoFbKey:'e1'},pother:{uid:'other',empleadoFbKey:'e2'},pinactive:{uid:'inactive',empleadoFbKey:'e1'},punknown:{uid:'unknown',empleadoFbKey:'e1'}});await update(ref(db,'sv_empleado_uid'),{'tech/perfilFbKey':'ptech','other/perfilFbKey':'pother','inactive/perfilFbKey':'pinactive','unknown/perfilFbKey':'punknown'});});
});
after(async()=>{await env?.cleanup();});
test('Vacaciones propias conservan observaciones y períodos ajenos requieren el módulo autorizado',async()=>{await env.withSecurityRulesDisabled(async c=>{await set(ref(c.database(),'sisventas/vacaciones'),{a:{empleadoId:'e1',desde:'2026-10-10',hasta:'2026-10-20',obs:'Propia'},b:{empleadoId:'e2',desde:'2026-10-10',hasta:'2026-10-20',obs:'Ajena'}});});const db=env.authenticatedContext('tech').database();const snap=await assertSucceeds(get(query(ref(db,'sisventas/vacaciones'),orderByChild('empleadoId'),equalTo('e1'))));assert.deepEqual(Object.keys(snap.val()),['a']);assert.equal(snap.val().a.obs,'Propia');await assertFails(get(ref(db,'sisventas/vacaciones')));await assertFails(get(query(ref(db,'sisventas/vacaciones'),orderByChild('empleadoId'),equalTo('e2'))));await assertFails(get(ref(db,'sisventas/vacaciones/b')));await assertSucceeds(get(ref(env.authenticatedContext('admin').database(),'sisventas/vacaciones')));});
test('Gastos propios consultados por ambos campos, sin colección completa ni consulta ajena',async()=>{
 await env.withSecurityRulesDisabled(async c=>{await set(ref(c.database(),'sisventas/gastos'),{a:{empleadoId:'e1',monto:100},b:{empleadoFbKey:'e1',monto:200},c:{empleadoId:'e2',monto:300},d:{monto:400}});});
 const db=env.authenticatedContext('tech').database();
 for(const field of ['empleadoId','empleadoFbKey']){const snap=await assertSucceeds(get(query(ref(db,'sisventas/gastos'),orderByChild(field),equalTo('e1'))));assert.equal(Object.keys(snap.val()).length,1);await assertFails(get(query(ref(db,'sisventas/gastos'),orderByChild(field),equalTo('e2'))));}
 await assertFails(get(ref(db,'sisventas/gastos')));await assertSucceeds(get(ref(db,'sisventas/gastos/a')));await assertFails(get(ref(db,'sisventas/gastos/c')));await assertFails(get(ref(db,'sisventas/gastos/d')));await assertSucceeds(get(ref(env.authenticatedContext('admin').database(),'sisventas/gastos')));
 await assertFails(set(ref(env.authenticatedContext('admin').database(),'sisventas/gastos/contradictorio'),{empleadoId:'e1',empleadoFbKey:'e2',monto:100}));
 for(const user of ['missing','inactive','unknown'])await assertFails(get(query(ref(env.authenticatedContext(user).database(),'sisventas/gastos'),orderByChild('empleadoId'),equalTo('e1'))));
 await assertFails(get(query(ref(env.unauthenticatedContext().database(),'sisventas/gastos'),orderByChild('empleadoId'),equalTo('e1'))));
 await env.withSecurityRulesDisabled(async c=>{const db=c.database();await set(ref(db,'sv_chat_roles/office'),{activo:true,rol:'administrativo'});await set(ref(db,'sv_permisos/administrativo'),{bloqueados:['gastos','comisiones','tesoreria','reportes','rentabilidad']});});
 const office=env.authenticatedContext('office').database();
 // Con todos los módulos bloqueados y sin vínculo, la colección no está autorizada.
 await assertFails(get(ref(office,'sisventas/gastos')));
 await env.withSecurityRulesDisabled(async c=>{const db=c.database();await set(ref(db,'sv_usuarios/poffice'),{uid:'office',empleadoFbKey:'e1'});await set(ref(db,'sv_empleado_uid/office'),{perfilFbKey:'poffice',empleadoFbKey:'e1'});});
 await assertSucceeds(get(query(ref(office,'sisventas/gastos'),orderByChild('empleadoId'),equalTo('e1'))));
 await assertFails(get(ref(office,'sisventas/gastos')));
 await assertFails(get(query(ref(office,'sisventas/gastos'),orderByChild('empleadoId'),equalTo('e2'))));
 // Una delegación explícita de cuentas sí permite el alcance completo existente.
 await env.withSecurityRulesDisabled(async c=>set(ref(c.database(),'sv_permisos/administrativo/acciones/empleados/verCuentas'),true));
 await assertSucceeds(get(ref(office,'sisventas/gastos')));
});
test('Cuenta propia permitida, ajena y colección completa rechazadas',async()=>{const db=env.authenticatedContext('tech').database();await assertSucceeds(get(ref(db,'sisventas/ctaemp/e1')));await assertFails(get(ref(db,'sisventas/ctaemp/e2')));await assertFails(get(ref(db,'sisventas/ctaemp')));});
test('El usuario solo lee su vínculo y no puede crearlo ni modificarlo',async()=>{const db=env.authenticatedContext('tech').database();await assertSucceeds(get(ref(db,'sv_empleado_uid/tech')));await assertFails(get(ref(db,'sv_empleado_uid/other')));await assertFails(set(ref(db,'sv_empleado_uid/tech/empleadoFbKey'),'e2'));await assertFails(set(ref(env.authenticatedContext('admin').database(),'sv_empleado_uid/tech'),{empleadoFbKey:'e2'}));});
test('Sin vínculo, inactivo, desconocido y anónimo no obtienen una cuenta por coincidencia',async()=>{for(const ctx of [env.unauthenticatedContext(),...['missing','inactive','unknown'].map(x=>env.authenticatedContext(x))]){const db=ctx.database();await assertFails(get(ref(db,'sisventas/ctaemp/e1')));}});
test('Administrador conserva todas las cuentas y respeta denegación de acción',async()=>{const db=env.authenticatedContext('admin').database();await assertSucceeds(get(ref(db,'sisventas/ctaemp')));await env.withSecurityRulesDisabled(async c=>{await set(ref(c.database(),'sv_permisos/admin'),{bloqueados:[],acciones:{empleados:{verCuentas:false}}});});await assertFails(get(ref(db,'sisventas/ctaemp')));await assertFails(get(ref(db,'sisventas/ctaemp/e1')));});
test('Bloquear cuenta personal y Mi cuenta impide también su lectura directa',async()=>{await env.withSecurityRulesDisabled(async c=>{await set(ref(c.database(),'sv_permisos/tecnico'),{bloqueados:['ctaemp','empleados'],acciones:{dashboard:{miCuenta:false}}});});await assertFails(get(ref(env.authenticatedContext('tech').database(),'sisventas/ctaemp/e1')));});
