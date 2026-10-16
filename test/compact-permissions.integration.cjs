'use strict';
const {test,before,after}=require('node:test'),assert=require('assert/strict'),fs=require('fs'),path=require('path'),{createRequire}=require('module');
const dep=createRequire(path.resolve('tmp/firebase-security-tools/package.json')),{initializeTestEnvironment,assertFails,assertSucceeds}=dep('@firebase/rules-unit-testing'),{ref,set,get,update,query,orderByChild,equalTo,runTransaction}=dep('firebase/database');
const index=require('../js/core/permission-index');let env;
let adminApp,chatService;
const configs=index.build({admin:{bloqueados:[]},tecnico:{bloqueados:['clientes','venta','detalle','presupuesto','productos','gastos','empleados','comisiones','configuracion','creditofiscal','facturas','caja','tesoreria','reportes','rentabilidad','ordenes','balancecompra','usuarios','vacaciones','cuentacorriente','cobranzas','estadisticas'],acciones:{dashboard:{metricasGlobales:false}}},vendedor:{bloqueados:['configuracion','empleados','gastos','caja','tesoreria','creditofiscal','facturas','comisiones','rentabilidad','balancecompra']}});
before(async()=>{
 if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9005')throw Error('Solo emulador demo');
 env=await initializeTestEnvironment({projectId:'demo-sisventas-security',database:{host:'127.0.0.1',port:9005,rules:fs.readFileSync('security/database.compact-final.candidate.json','utf8')}});
 await env.withSecurityRulesDisabled(c=>set(ref(c.database()),{sv_permisos:configs,sv_chat_roles:{admin:{rol:'admin',activo:true},tech:{rol:'tecnico',activo:true},sales:{rol:'vendedor',activo:true},unknown:{rol:'inventado',activo:true}},sv_usuarios:{w:{uid:'tech',activo:true,empleadoFbKey:'own'}},sv_empleado_uid:{tech:{perfilFbKey:'w'}},sisventas:{clientes:{c:{nombre:'Cliente ficticio'}},ventas:{v:{total:100,totalPagado:0}},productos:{p:{nombre:'Ficticio',stock:5}},ordenesTrabajo:{ot:{estado:'Pendiente'}},ctaemp:{own:{m:{monto:100}},other:{m:{monto:200}}},gastos:{g:{empleadoId:'own',monto:100},h:{empleadoId:'other',monto:200}}}}));
 await env.withSecurityRulesDisabled(c=>update(ref(c.database()),{'sv_chat_directorio':{admin:{nombre:'Admin',activo:true},tech:{nombre:'Técnico ficticio',activo:true},sales:{nombre:'Ventas',activo:true}},'sv_chat/general/old':{autor:'Técnico ficticio',rol:'tecnico',texto:'Anterior',ts:1,canal:'general'},'sv_chat/general/m':{autorUid:'tech',autor:'Técnico ficticio',rol:'tecnico',texto:'Inicial',ts:1,canal:'general'},'sv_chat_roles/inactive':{rol:'tecnico',activo:false}}));
 const admin=require('../cotizador/node_modules/firebase-admin');adminApp=admin.initializeApp({projectId:'demo-sisventas-security',databaseURL:'https://demo-sisventas-security.firebaseio.com'},'chat-permissions-demo');chatService=require('../cotizador/chat-operations').createChatOperations({db:adminApp.database(),auth:{verifyIdToken:async uid=>({uid})},enabled:true});
});
after(async()=>{await adminApp?.delete();await env?.cleanup();});
test('las lecturas y escrituras comerciales autorizadas conservan transacciones y rechazan reemplazo de raíz',async()=>{
 const db=env.authenticatedContext('admin').database();for(const p of ['clientes','ventas','productos','pagos','ordenesTrabajo','empleados','config/cargos'])await assertSucceeds(get(ref(db,'sisventas/'+p)));
 await assertSucceeds(update(ref(db,'sisventas'),{'pagos/p':{monto:10},'ventas/v/totalPagado':10}));
 await assertFails(set(ref(db,'sisventas'),{clientes:{c:{nombre:'Reemplazo'}}}));await assertFails(get(ref(db,'sisventas')));
});
test('técnico consulta OT y cuenta propia sin fichas, cuentas ajenas o información comercial bloqueada',async()=>{
 const db=env.authenticatedContext('tech').database();await assertSucceeds(get(ref(db,'sisventas/ordenesTrabajo')));await assertSucceeds(get(ref(db,'sisventas/ctaemp/own')));
 // Clientes/productos son dependencias explícitas de OT; cerrar sus lecturas
 // sin una proyección técnica previa rompería la selección de materiales.
 for(const p of ['clientes','productos'])await assertSucceeds(get(ref(db,'sisventas/'+p)));
 for(const p of ['ventas','gastos','ctaemp','ctaemp/other','comprobantesCompra','config/tfapp'])await assertFails(get(ref(db,'sisventas/'+p)));
 await assertSucceeds(get(query(ref(db,'sisventas/gastos'),orderByChild('empleadoId'),equalTo('own'))));await assertFails(get(query(ref(db,'sisventas/gastos'),orderByChild('empleadoId'),equalTo('other'))));await assertFails(get(ref(db,'sv_usuarios')));
});
test('técnicos concurrentes rinden stock sin adquirir permiso de precio ni perder unidades',async()=>{
 const a=env.authenticatedContext('tech').database(),b=env.authenticatedContext('tech').database();
 // Para transaccionar el campo stock se necesita una lectura puntual: la
 // política se comprueba separadamente sin abrir la colección de productos.
 await assertFails(set(ref(a,'sisventas/productos/p/precioVenta'),1));
 // Esta prueba detecta si el permiso de lectura no acompaña a la rendición.
 await assertSucceeds(get(ref(a,'sisventas/productos/p/stock')));
 await Promise.all([a,b].map(db=>assertSucceeds(runTransaction(ref(db,'sisventas/productos/p/stock'),n=>Number(n)-1))));
 await env.withSecurityRulesDisabled(async c=>assert.equal((await get(ref(c.database(),'sisventas/productos/p/stock'))).val(),3));
});
test('el índice debe coincidir con las casillas y bloquea alteraciones o clientes antiguos incoherentes',async()=>{
 const db=env.authenticatedContext('admin').database();await assertFails(set(ref(db,'sv_permisos/tecnico/indiceModulos/venta'),true));
 await assertFails(update(ref(db,'sv_permisos/tecnico'),{bloqueados:[],indiceVersion:2}));
 const revised=index.build({tecnico:{...configs.tecnico,bloqueados:[]}}).tecnico;await assertSucceeds(set(ref(db,'sv_permisos/tecnico'),revised));
 await assertSucceeds(get(ref(env.authenticatedContext('tech').database(),'sisventas/clientes')));
});
test('sesiones temporales, versiones antiguas e identidades desconocidas no recuperan acceso',async()=>{
 const temporary=env.authenticatedContext('admin',{svPasswordChangeRequired:true}).database();await assertFails(get(ref(temporary,'sisventas/clientes')));await assertFails(set(ref(temporary,'sisventas/clientes/c/nombre'),'No permitido'));
 await assertFails(get(ref(env.authenticatedContext('unknown').database(),'sisventas/clientes')));
});

test('chat nuevo fija UID y autor protegido; rechaza suplantación, edición ajena y reemplazo del canal',async()=>{
 const db=env.authenticatedContext('tech').database(),message={autorUid:'tech',autor:'Técnico ficticio',rol:'tecnico',texto:'Nuevo',ts:Date.now(),canal:'general'};
 await assertSucceeds(set(ref(db,'sv_chat/general/new'),message));
 for(const override of [{autorUid:'sales'},{autor:'Ventas'},{rol:'admin'},{archivoUrl:'javascript:alert(1)'},{texto:'x'.repeat(10001)}])await assertFails(set(ref(db,'sv_chat/general/forged'),{...message,...override}));
 await assertFails(set(ref(db,'sv_chat/general/m/texto'),'Edición directa'));await assertFails(set(ref(db,'sv_chat/general'),{fake:message}));await assertFails(set(ref(db,'sv_chat/general/m'),null));
});

test('lecturas, reacciones y escritura solo se atribuyen a la identidad real',async()=>{
 const db=env.authenticatedContext('sales').database();await assertSucceeds(set(ref(db,'sv_chat/general/m/leido/sales'),true));await assertFails(set(ref(db,'sv_chat/general/m/leido/tech'),true));
 await assertFails(set(ref(db,'sv_chat/general/m/reacciones/tech'),{emoji:'👍',nombre:'Falso'}));
 await assertSucceeds(set(ref(db,'sv_chat_escribiendo/general/sales'),{nombre:'Ventas',ts:Date.now()}));await assertFails(set(ref(db,'sv_chat_escribiendo/general/tech'),{nombre:'Ventas',ts:Date.now()}));
 for(const who of ['unknown','inactive'])for(const path of ['sv_chat_directorio','sv_chat/general','sv_permisos','sv_ia_reglas','sv_borradores/'+who])await assertFails(get(ref(env.authenticatedContext(who).database(),path)));
});

test('servidor edita propio tras lectura y conserva recibos/reacciones; bloquea ajenos, conflictos y eliminación leída',async()=>{
 const actor=await chatService.authorize({headers:{authorization:'Bearer tech'}},'general'),seller=await chatService.authorize({headers:{authorization:'Bearer sales'}},'general');
 await chatService.modify(seller,{key:'m',action:'reaccion',emoji:'👍',remove:false});
 await assert.rejects(chatService.modify(seller,{key:'m',action:'editar',expectedText:'Inicial',texto:'Suplantado'}),e=>e.statusCode===409);
 await chatService.modify(actor,{key:'m',action:'editar',expectedText:'Inicial',texto:'Corregido'});
 await assertSucceeds(get(ref(env.authenticatedContext('tech').database(),'sv_chat/general/m'))).then(s=>{assert.equal(s.val().texto,'Corregido');assert.equal(s.val().leido.sales,true);assert.equal(s.val().reacciones.sales.emoji,'👍');});
 await assert.rejects(chatService.modify(actor,{key:'m',action:'editar',expectedText:'Inicial',texto:'Pisado'}),e=>e.statusCode===409);
 await assert.rejects(chatService.modify(actor,{key:'m',action:'eliminar'}),e=>e.statusCode===409);
 await chatService.modify(actor,{key:'old',action:'editar',expectedText:'Anterior',texto:'Histórico conservado'});
 await env.withSecurityRulesDisabled(c=>set(ref(c.database(),'sv_chat_directorio/duplicate'),{nombre:'Técnico ficticio'}));
 const ambiguous=await chatService.authorize({headers:{authorization:'Bearer tech'}},'general');await assert.rejects(chatService.modify(ambiguous,{key:'old',action:'editar',expectedText:'Histórico conservado',texto:'Ambiguo'}),e=>e.statusCode===409);
});

test('el técnico conserva Relevamientos y el borrador con claves de ítems seguras, sin acceso al mantenimiento',async()=>{
 await env.withSecurityRulesDisabled(c=>set(ref(c.database(),'sv_permisos/tecnico'),configs.tecnico));
 const db=env.authenticatedContext('tech').database(),survey=require('../js/modules/surveys').surveyForStorage({id:'REL-demo',cliente:'Cliente ficticio',direccion:'Lugar ficticio',services:['alarma'],items:{'alarma.central':{value:'Central ficticia'}}});
 await assertSucceeds(set(ref(db,'sisventas/relevamientos/REL-demo'),survey));await assertSucceeds(get(ref(db,'sisventas/relevamientos')));
 assert.equal(Object.keys((await get(ref(db,'sisventas/relevamientos/REL-demo/items'))).val()).some(k=>k.includes('.')),false);
 for(const p of ['mantenimiento','auditoria_integridad','migraciones','_integraciones_server'])await assertFails(get(ref(db,'sisventas/'+p)));
 await env.withSecurityRulesDisabled(c=>set(ref(c.database(),'sv_permisos/tecnico/indiceModulos/relevamientos'),false));await assertFails(get(ref(db,'sisventas/relevamientos')));await assertFails(set(ref(db,'sisventas/relevamientos/otro'),survey));
});

test('configuración heredada de acceso no es pública para internos; porcentajes siguen disponibles para ventas autorizadas',async()=>{
 for(const who of ['admin','tech','sales'])await assertFails(get(ref(env.authenticatedContext(who).database(),'sisventas/config/loginRapido')));
 for(const path of ['comisionesEmpleados','categoriasSuel'])await assertFails(get(ref(env.authenticatedContext('tech').database(),'sisventas/config/'+path)));
 await assertSucceeds(get(ref(env.authenticatedContext('sales').database(),'sisventas/config/comisionesEmpleados')));
 await assertFails(set(ref(env.authenticatedContext('sales').database(),'sisventas/config/comisionesEmpleados/e'),{pct:99}));
});
