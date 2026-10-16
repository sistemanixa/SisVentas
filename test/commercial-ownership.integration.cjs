'use strict';
const {test,before,after,beforeEach}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{createRequire}=require('module');
const dep=createRequire(path.resolve(process.env.SV_SECURITY_TOOLS,'package.json')),{initializeTestEnvironment,assertFails,assertSucceeds}=dep('@firebase/rules-unit-testing'),{ref,set,get,update,remove}=dep('firebase/database');
const {build:buildIndex}=require('../js/core/permission-index'),{createCommercialOwnership}=require('../cotizador/commercial-ownership');let env,app,db,api;
const row=(uid,total=100)=>({responsableUid:uid,responsableNombre:'Persona '+uid,responsableRol:uid==='a'?'vendedor':'administrativo',responsableRevision:1,creadorOriginalUid:uid,creadorOriginalNombre:'Persona '+uid,creadaPor:'Persona '+uid,creadoPor:'Persona '+uid,usuario:'Persona '+uid,fecha:'2026-10-01',ts:10,creadoEn:10,total});
before(async()=>{if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9008')throw Error('Solo emulador demo');env=await initializeTestEnvironment({projectId:'demo-sisventas-commercial',database:{host:'127.0.0.1',port:9008,rules:fs.readFileSync('tmp/commercial-ownership.candidate.json','utf8')}});const admin=require(process.env.SV_PRIVATE_FINANCE_ADMIN_MODULE||'firebase-admin');app=admin.initializeApp({projectId:'demo-sisventas-commercial',databaseURL:'https://demo-sisventas-commercial.firebaseio.com'},'commercial-test');db=app.database();api=createCommercialOwnership({db,auth:{verifyIdToken:async uid=>({uid})},enabled:true,now:()=>1000});});
beforeEach(async()=>{const identities={admin:{rol:'admin',activo:true},a:{rol:'vendedor',activo:true},b:{rol:'administrativo',activo:true},tech:{rol:'tecnico',activo:true}};const users=Object.fromEntries(Object.entries(identities).map(([uid,i])=>[uid,{uid,rol:i.rol,nombre:'Persona '+uid,activo:true}]));const directory=Object.fromEntries(Object.keys(identities).map(uid=>[uid,{nombre:'Persona '+uid,activo:true}]));const perms=buildIndex({admin:{bloqueados:[]},vendedor:{bloqueados:['comisiones'],acciones:{empleados:{verCuentas:false},comisiones:{distribuir:false,crear:false}}},administrativo:{bloqueados:[]},tecnico:{bloqueados:['venta','detalle','presupuesto']}});
 await env.withSecurityRulesDisabled(c=>set(ref(c.database()),{sv_chat_roles:identities,sv_usuarios:users,sv_chat_directorio:directory,sv_permisos:perms,sisventas:{ventas:{a:row('a'),b:row('b'),old:{usuario:'Persona a',fecha:'2026-10-01',ts:1,total:50}},presupuestos:{a:row('a'),b:row('b')},pagos:{sentinel:{monto:12}},gastos:{sentinel:{monto:7}}},sv_personal_finance:{proof:{ownerUid:'admin',secret:'FICTICIO'}}}));});
after(async()=>{await app?.delete();await env?.cleanup();});
const client=uid=>uid?env.authenticatedContext(uid).database():env.unauthenticatedContext().database();
const {createCommissionGeneration}=require('../cotizador/commission-generation');
async function generationFixture(){
 const sale={...row('a',200),id:'V-DEMO',empleadoFbKey:'e',comisionHabilitada:true,estadoPago:'pago_total',items:[{qty:2,punit:100,sub:200,disc:0,costoUnitarioPresupuestado:40}],subtotal:200,descuentoGeneral:0,descuento:0,conIva:false,iva:0};
 await db.ref().update({'sisventas/ventas/a':sale,'sisventas/empleados/e':{nombre:'Empleado ficticio',estado:'Activo'},'sisventas/config/maxComisionPct':25,'sisventas/config/comisionesEmpleados/e':{pct:25},'sisventas/pagos/demo':{ventaFbKey:'a',ventaId:'V-DEMO',monto:200,ts:2000}});
 const service=createCommissionGeneration({db,commercial:api,enabled:true,from:1000,now:()=>10000});const actor=await service.authorize({headers:{authorization:'Bearer a'}});return {service,actor};
}
for(const domain of ['ventas','presupuestos']){
 test(domain+': admin lee todos, usuarios solo su registro y no el padre',async()=>{await assertSucceeds(get(ref(client('admin'),'sisventas/'+domain)));for(const uid of ['a','b']){await assertFails(get(ref(client(uid),'sisventas/'+domain)));await assertSucceeds(get(ref(client(uid),'sisventas/'+domain+'/'+uid)));await assertFails(get(ref(client(uid),'sisventas/'+domain+'/'+(uid==='a'?'b':'a'))));}await assertFails(get(ref(client(null),'sisventas/'+domain+'/a')));});
 test(domain+': no se roba ni reasigna un registro ajeno con multipath o campos anidados',async()=>{const c=client('a');await assertFails(update(ref(c,'sisventas/'+domain+'/b'),{responsableUid:'a',total:1}));await assertFails(update(ref(c),{['sisventas/'+domain+'/b/totalPagado']:100}));await assertFails(update(ref(c,'sisventas/'+domain+'/a'),{responsableUid:'b'}));});
 test(domain+': preserva autor y timestamp, fecha solo con evidencia manual',async()=>{const r=ref(client('a'),'sisventas/'+domain+'/a');await assertSucceeds(update(r,{total:120}));await assertFails(update(r,{creadaPor:'Editor'}));await assertFails(update(r,{ts:99}));await assertFails(update(r,{fecha:'2026-10-02'}));await assertSucceeds(update(r,{fecha:'2026-10-02',fechaCambioManual:{anteriorValor:'2026-10-01',nueva:'2026-10-02',actorUid:'a'}}));});
 test(domain+': alta propia válida y autor ajeno rechazado',async()=>{await assertSucceeds(set(ref(client('a'),'sisventas/'+domain+'/new'),row('a')));await assertFails(set(ref(client('a'),'sisventas/'+domain+'/forged'),{...row('a'),creadorOriginalUid:'b',creadorOriginalNombre:'Persona b'}));});
}
test('servicio reasigna sin tocar dinero y pierde acceso el responsable anterior',async()=>{const sentinel=(await db.ref('sisventas/pagos').get()).val(),actor=await api.authorize({headers:{authorization:'Bearer admin'}},'ventas');const result=await api.assign(actor,{id:'a',uid:'b',owner:'a',revision:1});assert.equal(result.record.total,100);assert.equal(result.record.creadaPor,'Persona a');await assertFails(get(ref(client('a'),'sisventas/ventas/a')));await assertSucceeds(get(ref(client('b'),'sisventas/ventas/a')));assert.deepEqual((await db.ref('sisventas/pagos').get()).val(),sentinel);await assert.rejects(api.assign(actor,{id:'a',uid:'a',owner:'a',revision:1}),e=>e.statusCode===409);});
test('técnico sin módulo no puede recibir un registro ni por escritura directa de admin',async()=>{await assertFails(update(ref(client('admin'),'sisventas/ventas/a'),{responsableUid:'tech',responsableNombre:'Persona tech'}));const actor=await api.authorize({headers:{authorization:'Bearer admin'}},'ventas');await assert.rejects(api.assign(actor,{id:'a',uid:'tech',owner:'a',revision:1}),e=>e.statusCode===403);});
test('legado se vincula mediante servicio antes de editar, sin abrir lectura directa por nombre',async()=>{await assertFails(get(ref(client('a'),'sisventas/ventas/old')));const actor=await api.authorize({headers:{authorization:'Bearer a'}},'ventas');await api.prepare(actor,{id:'old'});await assertSucceeds(get(ref(client('a'),'sisventas/ventas/old')));await assertSucceeds(update(ref(client('a'),'sisventas/ventas/old'),{total:60}));});
test('usuario inactivo y nodo privado siguen denegados',async()=>{await db.ref('sv_chat_roles/a/activo').set(false);await assertFails(get(ref(client('a'),'sisventas/ventas/a')));for(const uid of ['admin','a',null])await assertFails(get(ref(client(uid),'sv_personal_finance/proof')));});
test('regresión de auditoría: vendedor no genera comisiones con escrituras directas del navegador',async()=>{await assertFails(set(ref(client('a'),'sisventas/comisiones_generacion/ficticia'),{estado:'procesando'}));await assertFails(set(ref(client('a'),'sisventas/ctaemp/a/ficticia'),{tipo:'comision',monto:1}));});

test('convertir presupuesto reasignado conserva autor inicial y operador; no admite autor u origen falsificados',async()=>{
 await db.ref('sisventas/presupuestos/a').update({responsableUid:'b',responsableNombre:'Persona b',creadorOriginalNombre:'Nombre histórico del autor'});
 const converted={...row('b'),presupuestoFbKey:'a',creadorOriginalUid:'a',creadorOriginalNombre:'Nombre histórico del autor',usuario:'Nombre histórico del autor',creadaPor:'Nombre histórico del autor',convertidaPorUid:'b'};
 await assertSucceeds(set(ref(client('b'),'sisventas/ventas/ppto_a'),converted));
 await db.ref('sisventas/ventas/ppto_a').remove();
 await assertFails(set(ref(client('b'),'sisventas/ventas/ppto_a'),{...converted,creadorOriginalUid:'b',creadorOriginalNombre:'Persona b'}));
 await assertFails(set(ref(client('b'),'sisventas/ventas/otro'),converted));
 await assertFails(set(ref(client('a'),'sisventas/ventas/ppto_a'),{...converted,responsableUid:'a',convertidaPorUid:'a'}));
 await assertFails(set(ref(client('b'),'sisventas/ventas/ppto_a'),{...converted,convertidaPorUid:'a'}));
});

test('generación servidor: Vendedor sin módulo Comisiones obtiene su comisión; privado y terceros quedan bloqueados',async()=>{
 const before=(await db.ref('sisventas/gastos/sentinel').get()).val(),{service,actor}=await generationFixture();
 assert.equal((await service.generate(actor,{ventaFbKey:'a'})).status,'generada');
 assert.equal((await db.ref('sisventas/gastos/gasto_comision_a_e/monto').get()).val(),30);
 assert.deepEqual((await db.ref('sisventas/gastos/sentinel').get()).val(),before);
 assert.equal((await service.generate(actor,{ventaFbKey:'a'})).reutilizada,true);
 for(const uid of ['admin','a','b',null]){await assertFails(get(ref(client(uid),'sv_commission_generation/a')));await assertFails(set(ref(client(uid),'sv_commission_generation/forged'),{estado:'completada'}));}
 await assertFails(set(ref(client('a'),'sisventas/gastos/forged'),{tipoPagable:'comision',monto:999}));
});

test('generación servidor: conserva comisión manual existente y no hace backfill de cobros anteriores al corte',async()=>{
 const {service,actor}=await generationFixture(),manual={ventaFbKey:'a',empleadoFbKey:'e',monto:17,estado:'pagado',tipoPagable:'comision'};
 await db.ref('sisventas/gastos/manual').set(manual);assert.equal((await service.generate(actor,{ventaFbKey:'a'})).status,'existente');assert.deepEqual((await db.ref('sisventas/gastos/manual').get()).val(),manual);
 await db.ref('sisventas/gastos/manual').remove();await db.ref('sisventas/pagos/demo/ts').set(500);assert.equal((await service.systemGenerate('a')).status,'historica');assert.equal((await db.ref('sv_commission_generation/a').get()).exists(),false);
});

test('observador genera al completar el cobro aunque el navegador no llame al endpoint',async()=>{
 const {service}=await generationFixture();await db.ref('sisventas/ventas/a/estadoPago').set('seniado');const stop=service.start();
 try{await db.ref('sisventas/ventas/a/estadoPago').set('pago_total');for(let i=0;i<60;i++){if((await db.ref('sv_commission_generation/a/estado').get()).val()==='completada')break;await new Promise(r=>setTimeout(r,50));}assert.equal((await db.ref('sv_commission_generation/a/estado').get()).val(),'completada');assert.equal((await db.ref('sisventas/gastos/gasto_comision_a_e/actorUid').get()).val(),'servidor');}finally{stop();}
});

test('generación retoma con otra instancia del servidor tras una caída entre cuenta y gasto',async()=>{
 const {actor}=await generationFixture();let cut=true;
 const interruptedDB={ref(path){const original=db.ref(path);if(path!=='sisventas/gastos/gasto_comision_a_e')return original;return {on:original.on.bind(original),off:original.off.bind(original),get:original.get.bind(original),transaction(...args){if(cut){cut=false;return Promise.reject(Error('Corte sintético'));}return original.transaction(...args);}};}};
 const first=createCommissionGeneration({db:interruptedDB,commercial:api,enabled:true,from:1000,now:()=>10000});await assert.rejects(first.generate(actor,{ventaFbKey:'a'}),/Corte sintético/);
 const movement=(await db.ref('sisventas/ctaemp/e/comision_a_e').get()).val();
 const next=createCommissionGeneration({db,commercial:api,enabled:true,from:1000,now:()=>100000});await next.retryPending();
 assert.equal((await db.ref('sv_commission_generation/a/estado').get()).val(),'completada');assert.deepEqual((await db.ref('sisventas/ctaemp/e/comision_a_e').get()).val(),movement);assert.equal((await db.ref('sisventas/gastos/gasto_comision_a_e/monto').get()).val(),30);
});
