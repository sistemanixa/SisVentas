'use strict';
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),{createRequire}=require('module'),path=require('path');
const dep=createRequire(path.resolve('tmp/firebase-security-tools/package.json'));
const {initializeTestEnvironment,assertFails,assertSucceeds}=dep('@firebase/rules-unit-testing'),{ref,set,update,get,query,orderByChild,equalTo,runTransaction}=dep('firebase/database');let env;
before(async()=>{
 if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9005')throw Error('Solo emulador local');
 env=await initializeTestEnvironment({projectId:'demo-sisventas-security',database:{host:'127.0.0.1',port:9005,rules:fs.readFileSync('security/database.domain-read.candidate.json','utf8')}});
 await env.withSecurityRulesDisabled(async ctx=>{
  const roles={};for(const rol of ['admin','administrativo','vendedor','tecnico_vendedor','tecnico','inventado','distribuidora'])roles[rol]={activo:true,rol};roles.inactivo={activo:false,rol:'admin'};
  await set(ref(ctx.database()),{sv_chat_roles:roles,sisventas:{productos:{p:{categoria:'COMPRAS PARAGUAY'},otro:{categoria:'OTRA'}},ventas:{v:{total:100,totalPagado:0}},config:{tipoCambio:{oficial:100},tfapp:{punto_venta:2},empresa:{nombre:'Prueba'},cargos:{c:{valorHora:1}}}}});
 });
});
after(async()=>{await env?.cleanup();});
test('Admin conserva todas las lecturas; Administrativo respeta los tres alcances reservados por defecto',async()=>{
 const paths=Object.keys(require('../js/core/domain-read-policy.js').domains);
 const adminOnly=['notificaciones_admin','hsextra_solicitudes','uso_usuarios'];
 for(const role of ['admin','administrativo']){const db=env.authenticatedContext(role).database();for(const p of paths){
  const read=get(ref(db,'sisventas/'+p));
  if(role==='administrativo'&&adminOnly.includes(p))await assertFails(read);
  else await assertSucceeds(read);
 }}
});
test('Técnico y vendedor no leen comprobantes fiscales, configuración fiscal ni órdenes de compra bloqueadas',async()=>{
 for(const role of ['tecnico','vendedor']){const db=env.authenticatedContext(role).database();for(const p of ['comprobantesCompra','comprobantesVenta','config/tfapp','ordenes'])await assertFails(get(ref(db,'sisventas/'+p)));}
});
test('Identidades externas, desconocidas, inactivas y anónimas siguen sin datos comerciales',async()=>{
 for(const ctx of [env.unauthenticatedContext(),...['inventado','distribuidora','inactivo'].map(x=>env.authenticatedContext(x))]){const db=ctx.database();for(const p of ['clientes','ventas','caja','config/tfapp','informes'])await assertFails(get(ref(db,'sisventas/'+p)));}
});
test('Cotización pública y productos de Distribuidora conservan consultas autorizadas',async()=>{
 await assertSucceeds(get(ref(env.unauthenticatedContext().database(),'sisventas/config/tipoCambio/oficial')));
 for(const role of ['distribuidora','compras_paraguay']) {
  await env.withSecurityRulesDisabled(async ctx=>set(ref(ctx.database(),'sv_chat_roles/'+role),{activo:true,rol:role}));
  const db=env.authenticatedContext(role).database();const snap=await assertSucceeds(get(query(ref(db,'sisventas/productos'),orderByChild('categoria'),equalTo('COMPRAS PARAGUAY'))));
  assert.deepEqual(Object.keys(snap.val()),['p']);
  await assertFails(get(ref(db,'sisventas/productos')));
  await assertFails(get(query(ref(db,'sisventas/productos'),orderByChild('categoria'),equalTo('OTRA'))));
  await assertFails(get(ref(db,'sisventas/productos/otro')));
  await assertFails(get(ref(db,'sisventas')));
 }
});
test('Overrides respetan bloqueo, dependencia de Garantías y delegación de métricas fiscales',async()=>{
 await env.withSecurityRulesDisabled(async ctx=>{await update(ref(ctx.database()),{'sv_permisos/tecnico':{bloqueados:['caja','gastos','tesoreria','ordenes','balancecompra','creditofiscal','facturas','configuracion','equipos','informes'],acciones:{dashboard:{metricasGlobales:true}}}});});
 const db=env.authenticatedContext('tecnico').database();await assertSucceeds(get(ref(db,'sisventas/equipos')));await assertSucceeds(get(ref(db,'sisventas/comprobantesCompra')));
 await assertFails(get(ref(db,'sisventas/caja')));await assertFails(get(ref(db,'sisventas/informes')));await assertFails(get(ref(db,'sisventas/config/tfapp')));
 await env.withSecurityRulesDisabled(async ctx=>{await update(ref(ctx.database()),{'sv_permisos/tecnico/bloqueados/11':'garantias','sv_permisos/tecnico/acciones/dashboard/metricasGlobales':false});});
 await assertFails(get(ref(db,'sisventas/equipos')));await assertFails(get(ref(db,'sisventas/comprobantesCompra')));
});
test('Lecturas de nodos compartidos y transacciones de ventas/cobros continúan funcionando',async()=>{
 const db=env.authenticatedContext('admin').database();for(const p of ['clientes','productos','ventas','pagos','empleados','gastos','config/empresa','config/cargos','config/mediosPago'])await assertSucceeds(get(ref(db,'sisventas/'+p)));
 await assertSucceeds(update(ref(db,'sisventas'),{'pagos/p':{monto:10},'ventas/v/totalPagado':10,'cobros_grupos/g':{monto:10}}));
 await assertSucceeds(runTransaction(ref(db,'sisventas/ventas'),data=>({...data,nueva:{total:10}})));
 await assertFails(get(ref(db,'sisventas')));await assertFails(get(ref(db,'sisventas/config')));await assertFails(set(ref(db,'sisventas'),{borrar:true}));
});
test('No se cambió ninguna regla de escritura del corte activo',()=>{
 const base=JSON.parse(fs.readFileSync('security/database.domain-write.candidate.json')),candidate=JSON.parse(fs.readFileSync('security/database.domain-read.candidate.json'));
 function writes(o,p='',out={}){for(const [k,v]of Object.entries(o)){if(k==='.write')out[p]=v;else if(v&&typeof v==='object')writes(v,p+'/'+k,out);}return out;}
 const before=writes(base),after=writes(candidate);
 for(const name of Object.keys(require('../js/core/domain-read-policy.js').domains).filter(n=>!n.includes('/'))){
  if(!base.rules.sisventas[name]){const p='/rules/sisventas/'+name;assert.equal(after[p],base.rules.sisventas.contadores['.write']);delete after[p];}
 }
 assert.deepEqual(after,before);
});
