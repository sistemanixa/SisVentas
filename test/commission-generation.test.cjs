'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../cotizador/commission-generation-model'),{createCommissionGeneration}=require('../cotizador/commission-generation'),{createCommercialOwnership}=require('../cotizador/commercial-ownership');
const {memoryDB}=require('./helpers/private-finance-fixtures.cjs');
function setup(options={}){
 const sale={id:'V-DEMO',responsableUid:'a',creadorOriginalNombre:'Autor de prueba',empleadoFbKey:'e',empleado:'Empleado de prueba',items:[{cod:'P-DEMO',desc:'Producto ficticio',qty:2,punit:100,disc:0,sub:200,costoUnitarioPresupuestado:40}],subtotal:200,descuento:0,descuentoGeneral:0,iva:0,conIva:false,total:200,totalPagado:200,estadoPago:'pago_total',comisionHabilitada:true,...options.sale};
 const store=memoryDB({sv_chat_roles:{a:{rol:'vendedor',activo:true},admin:{rol:'admin',activo:true},b:{rol:'vendedor',activo:true},tech:{rol:'tecnico',activo:true}},sv_usuarios:{a:{uid:'a',rol:'vendedor',nombre:'Persona a'},admin:{uid:'admin',rol:'admin',nombre:'Persona admin'},b:{uid:'b',rol:'vendedor',nombre:'Persona b'},tech:{uid:'tech',rol:'tecnico',nombre:'Persona tech'}},sv_permisos:{vendedor:{indiceVersion:2,indiceModulos:{venta:true,detalle:true,comisiones:false},bloqueados:['comisiones'],acciones:{comisiones:{crear:false,distribuir:false}}},tecnico:{indiceVersion:2,indiceModulos:{venta:false,detalle:false,comisiones:false}}},sisventas:{ventas:{sale},presupuestos:{},empleados:{e:{nombre:'Empleado de prueba',estado:'Activo'}},config:{maxComisionPct:25,comisionesEmpleados:{e:{pct:25}}},pagos:{p:{ventaFbKey:'sale',ventaId:'V-DEMO',monto:200,ts:2000}},ctaemp:{},gastos:{},comisiones_generacion:{}}});
 let failure=null,stamp=10000;
 const db={root:store.root,ref(path){const underlying=store.ref(path);return {...underlying,orderByChild(field){return {equalTo(value){return {get:async()=>({val:()=>Object.fromEntries(Object.entries(path.split('/').reduce((v,k)=>v?.[k],store.root)||{}).filter(([,r])=>r[field]===value))})};}};},transaction:async(fn,...args)=>{if(failure?.path===path){const e=failure;failure=null;throw Error(e.message||'Interrupción ficticia');}return underlying.transaction(fn,...args);}};}};
 const commercial=createCommercialOwnership({db,auth:{verifyIdToken:async uid=>{if(uid==='invalid')throw Error('invalid');return {uid};}},enabled:true});
 const proofChecks=[];const svc=createCommissionGeneration({db,commercial,enabled:options.enabled!==false,from:1000,now:()=>stamp,beforeCommit:Object.hasOwn(options,'beforeCommit')?options.beforeCommit:fn=>proofChecks.push(fn)});
 return {db,svc,proofChecks,runProofChecks:async()=>{for(const check of proofChecks)await check({readFresh:async p=>(await db.ref(p).get()).val()});},get sale(){return db.root.sisventas.ventas.sale;},actor:async(uid='a')=>svc.authorize({headers:{authorization:'Bearer '+uid}}),failAt:path=>failure={path},advance:ms=>stamp+=ms};
}
test('usuario sin acceso a Comisiones genera su venta; no necesita permiso para administrar comisiones',async()=>{
 const s=setup(),actor=await s.actor();const p=await s.svc.inspect(actor,'sale');assert.equal(p.status,'lista');assert.equal(p.base.ganancia,120);assert.equal(p.participantes[0].monto,30);
 const r=await s.svc.generate(actor,{ventaFbKey:'sale'});assert.equal(r.status,'generada');const expenses=Object.values(s.db.root.sisventas.gastos);assert.equal(expenses.length,1);assert.equal(expenses[0].monto,30);assert.equal(expenses[0].estado,'pendiente_aprobacion');assert.equal(expenses[0].requiereAprobacion,true);assert.equal(s.sale.audit[0].actorUid,'a');assert.equal(s.sale.creadorOriginalNombre,'Autor de prueba');
});

test('confirmed collection proof generates original commission without giving commercial ownership',async()=>{
 const s=setup(),cfg=s.db.root.sv_permisos.vendedor;cfg.indiceModulos.cobranzas=true;cfg.acciones.cobranzas={registrar:true};
 const actor=await s.actor('b'),id='fictitious-collection-proof',digest='a'.repeat(64);
 s.db.root.sv_labor_receipts={[id]:{actorUid:'b',confirmedAt:1000,digest,result:{ok:true,committed:true,grupoPago:'group',links:[{ventaKey:'sale',pagoKey:'p'}]}}};
 s.db.root.sisventas.cobros_grupos={group:{commandId:id,commandDigest:digest,pagoKeys:{p:true}}};s.db.root.sisventas.pagos.p.grupoPago='group';
 const first=await s.svc.generate(actor,{ventaFbKey:'sale',cobroOperacionId:id});assert.equal(first.status,'generada');await s.runProofChecks();
 assert.equal((await s.svc.generate(actor,{ventaFbKey:'sale',cobroOperacionId:id})).reutilizada,true);
 await assert.rejects(s.svc.inspect(actor,'sale'),{statusCode:404});await assert.rejects(s.svc.generate(actor,{ventaFbKey:'sale'}),{statusCode:404});
 assert.equal(s.sale.responsableUid,'a');assert.equal(s.sale.empleadoFbKey,'e');assert.equal(s.sale.creadorOriginalNombre,'Autor de prueba');assert.equal(Object.keys(s.db.root.sisventas.gastos).length,1);assert.equal(Object.values(s.db.root.sisventas.gastos)[0].monto,30);
 cfg.acciones.cobranzas.registrar=false;await assert.rejects(s.runProofChecks(),{statusCode:403});await assert.rejects(s.svc.generate(actor,{ventaFbKey:'sale',cobroOperacionId:id}),{statusCode:403});
});

test('collection proof fails closed without a final commit verifier',async()=>{
 const s=setup({beforeCommit:null});await assert.rejects(s.svc.generate(await s.actor('b'),{ventaFbKey:'sale',cobroOperacionId:'fictitious-operation'}),{statusCode:503});
 assert.equal(Object.keys(s.db.root.sisventas.gastos).length,0);assert.equal(s.db.root.sv_commission_generation,undefined);
});

test('rol técnico con Cobranzas explícito confirma comisión sin lectura comercial',async()=>{
 const s=setup();s.db.root.sv_permisos.tecnico={indiceVersion:2,indiceModulos:{cobranzas:true,venta:false,detalle:false},acciones:{cobranzas:{registrar:true}}};
 const actor=await s.actor('tech'),id='fictitious-tech-collection',digest='b'.repeat(64);
 s.db.root.sv_labor_receipts={[id]:{actorUid:'tech',confirmedAt:1000,digest,result:{ok:true,committed:true,grupoPago:'group',links:[{ventaKey:'sale',pagoKey:'p'}]}}};
 s.db.root.sisventas.cobros_grupos={group:{commandId:id,commandDigest:digest,pagoKeys:{p:true}}};s.db.root.sisventas.pagos.p.grupoPago='group';
 assert.equal((await s.svc.generate(actor,{ventaFbKey:'sale',cobroOperacionId:id})).status,'generada');await s.runProofChecks();
 await assert.rejects(s.svc.inspect(actor,'sale'),{statusCode:404});assert.equal(s.sale.responsableUid,'a');
});
test('anónimo, inválido, inactivo, usuario ajeno y técnico sin módulo no generan',async()=>{
 const s=setup();await assert.rejects(s.svc.authorize({headers:{}}),{statusCode:401});await assert.rejects(s.actor('invalid'),{statusCode:401});await assert.rejects(s.actor('tech'),{statusCode:403});await assert.rejects(s.svc.generate(await s.actor('b'),{ventaFbKey:'sale'}),{statusCode:404});s.db.root.sv_chat_roles.a.activo=false;await assert.rejects(s.actor(),{statusCode:403});assert.equal(Object.keys(s.db.root.sisventas.gastos).length,0);
});
test('no usa totalPagado enviado o guardado sin cobros canónicos ni pagos anulados',async()=>{
 for(const p of [{monto:50},{monto:200,anulado:true}]){const s=setup();Object.assign(s.db.root.sisventas.pagos.p,p);assert.equal((await s.svc.generate(await s.actor(),{ventaFbKey:'sale'})).status,'pendiente_cobro');assert.equal(s.db.root.sv_commission_generation,undefined);}
});
test('no acepta importe, porcentaje, comisionado ni identidad suministrados por el navegador',async()=>{
 for(const extra of [{monto:1},{pct:99},{empleadoFbKey:'otro'},{uid:'admin'}]){const s=setup();await assert.rejects(s.svc.generate(await s.actor(),{ventaFbKey:'sale',...extra}),{statusCode:400});assert.equal(s.db.root.sv_commission_generation,undefined);}
});
test('sin costos históricos identifica faltantes sin sustituirlos por catálogo actual',async()=>{
 const s=setup();delete s.sale.items[0].costoUnitarioPresupuestado;s.db.root.sisventas.productos={x:{cod:'P-DEMO',compra:1}};const p=await s.svc.generate(await s.actor(),{ventaFbKey:'sale'});assert.equal(p.status,'revision');assert.equal(p.faltantes[0].codigo,'P-DEMO');assert.equal(s.db.root.sv_commission_generation,undefined);
});
test('deshabilitada, anulada, ganancia negativa o porcentaje cero no generan',async()=>{
 for(const sale of [{comisionHabilitada:false},{anulada:true},{items:[{qty:2,punit:100,sub:200,costoUnitarioPresupuestado:110}]}]){const s=setup({sale});assert.equal((await s.svc.generate(await s.actor(),{ventaFbKey:'sale'})).status,'no_aplica');}
 const s=setup();s.db.root.sisventas.config.comisionesEmpleados.e.pct=0;assert.equal((await s.svc.generate(await s.actor(),{ventaFbKey:'sale'})).status,'no_aplica');
});
test('base original respeta descuentos, excluye IVA y no usa mejora posterior de compra',()=>{
 const sale={fbKey:'s',id:'V',comisionHabilitada:true,empleadoFbKey:'e',items:[{qty:2,punit:100,disc:10,sub:180,costoUnitarioAntesPreparacion:40,costoUnitarioCompra:1}],subtotal:180,descuentoGeneral:10,descuento:38,conIva:true,iva:34.02,total:196.02};
 const p=M.preview({sale,payments:[{fbKey:'p',ventaFbKey:'s',monto:196.02}],employees:{e:{nombre:'Empleado'}},config:{maxComisionPct:25,comisionesEmpleados:{e:{pct:25}}}});assert.equal(p.status,'lista');assert.equal(p.base.ventaNeta,162);assert.equal(p.base.costoOriginal,80);assert.equal(p.participantes[0].monto,20.5);
});
test('dos comisionados comparten tope del servidor; no confunde creador con comisionado',async()=>{
 const s=setup({sale:{comisionado2FbKey:'e2'}});s.db.root.sisventas.empleados.e2={nombre:'Segundo'};s.db.root.sisventas.config.comisionesEmpleados.e2={pct:20};const p=await s.svc.inspect(await s.actor(),'sale');assert.deepEqual(p.participantes.map(e=>e.pct),[12.5,12.5]);await s.svc.generate(await s.actor(),{ventaFbKey:'sale'});assert.equal(Object.keys(s.db.root.sisventas.gastos).length,2);assert.equal(Object.keys(s.db.root.sisventas.ctaemp).length,2);
});
test('reintentos y llamadas simultáneas no duplican ni recalculan comisiones ya completadas',async()=>{
 const s=setup(),actor=await s.actor();const results=await Promise.allSettled(Array.from({length:6},()=>s.svc.generate(actor,{ventaFbKey:'sale'})));assert.ok(results.some(r=>r.status==='fulfilled'));assert.equal(Object.keys(s.db.root.sisventas.gastos).length,1);const before=JSON.stringify(s.db.root.sisventas.gastos);s.db.root.sisventas.config.comisionesEmpleados.e.pct=5;assert.equal((await s.svc.generate(actor,{ventaFbKey:'sale'})).reutilizada,true);assert.equal(JSON.stringify(s.db.root.sisventas.gastos),before);assert.equal(s.sale.audit.length,1);
});
test('comisión manual existente, incluso rechazada o pagada, queda idéntica',async()=>{
 for(const estado of ['pagado','rechazado','pendiente_aprobacion']){const s=setup();const original={tipo:'Comisión',origen:'legado',venta:'V-DEMO',empleadoFbKey:'e',monto:17,pct:9,estado};s.db.root.sisventas.gastos.manual=original;const before=JSON.stringify(s.db.root);assert.equal((await s.svc.generate(await s.actor(),{ventaFbKey:'sale'})).status,'existente');assert.equal(JSON.stringify(s.db.root),before);}
});
test('corte entre movimiento y gasto se retoma sin reemplazar ninguno',async()=>{
 const s=setup(),actor=await s.actor(),expense='sisventas/gastos/gasto_comision_sale_e';s.failAt(expense);await assert.rejects(s.svc.generate(actor,{ventaFbKey:'sale'}),/Interrupción/);assert.equal(s.db.root.sv_commission_generation.sale.estado,'error');const movement=JSON.stringify(s.db.root.sisventas.ctaemp.e.comision_sale_e);await s.svc.generate(actor,{ventaFbKey:'sale'});assert.equal(s.db.root.sv_commission_generation.sale.estado,'completada');assert.equal(JSON.stringify(s.db.root.sisventas.ctaemp.e.comision_sale_e),movement);assert.equal(Object.keys(s.db.root.sisventas.gastos).length,1);
});
test('conflicto con destino ajeno no lo sobrescribe y deja generación para revisión',async()=>{
 const s=setup(),actor=await s.actor();s.failAt('sisventas/gastos/gasto_comision_sale_e');await assert.rejects(s.svc.generate(actor,{ventaFbKey:'sale'}));s.db.root.sisventas.gastos.gasto_comision_sale_e={tipoPagable:'otro',monto:999};const before=JSON.stringify(s.db.root.sisventas.gastos);await assert.rejects(s.svc.generate(actor,{ventaFbKey:'sale'}),{statusCode:409});assert.equal(JSON.stringify(s.db.root.sisventas.gastos),before);
});
test('generación incompleta no recalcula cuando cambió la base',async()=>{
 const s=setup(),actor=await s.actor();s.failAt('sisventas/gastos/gasto_comision_sale_e');await assert.rejects(s.svc.generate(actor,{ventaFbKey:'sale'}));s.sale.items[0].costoUnitarioPresupuestado=50;await assert.rejects(s.svc.generate(actor,{ventaFbKey:'sale'}),{statusCode:409});assert.equal(s.db.root.sisventas.ctaemp.e.comision_sale_e.monto,30);
});
test('observador no hace backfill antiguo; nuevos cobros completos sí generan desde servidor',async()=>{
 const s=setup();s.db.root.sisventas.pagos.p.ts=500;assert.equal((await s.svc.systemGenerate('sale')).status,'historica');assert.equal(s.db.root.sv_commission_generation,undefined);s.db.root.sisventas.pagos.p.ts=2000;assert.equal((await s.svc.systemGenerate('sale')).status,'generada');assert.equal(s.sale.audit[0].actorUid,'servidor');
});

test('reintento por evento consulta sólo su trabajo y conserva límite y plazo si falla antes de reservar',async()=>{
 const s=setup();s.failAt('sisventas/gastos/gasto_comision_sale_e');await assert.rejects(s.svc.systemGenerate('sale'));
 const expenseBefore=JSON.stringify(s.db.root.sisventas.gastos),ref=s.db.ref.bind(s.db),reads=[];
 s.db.root.sv_commission_generation.otra={estado:'error',intentos:1,leaseUntil:0};
 s.db.ref=path=>{assert.notEqual(path,'sv_commission_generation','no debe recorrer el historial');const r=ref(path);return {...r,get:async()=>{reads.push(path);if(path==='sisventas/ventas/sale')throw Error('Fallo transitorio ficticio antes de reservar');return r.get();}};};
 for(let attempt=2;attempt<=5;attempt++){s.advance(60001);await s.svc.retryPending('sale');const job=s.db.root.sv_commission_generation.sale;assert.equal(job.intentos,attempt);assert.equal(job.estado,'error');assert.ok(job.reintentarEn>0);}
 const saleReads=reads.filter(p=>p==='sisventas/ventas/sale').length;s.advance(60001);await s.svc.retryPending('sale');assert.equal(reads.filter(p=>p==='sisventas/ventas/sale').length,saleReads);assert.equal(saleReads,4);
 assert.equal(s.db.root.sv_commission_generation.otra.intentos,1);assert.equal(JSON.stringify(s.db.root.sisventas.gastos),expenseBefore);await assert.rejects(s.svc.retryPending('../otra'),{statusCode:400});
});
test('vista previa antigua se rechaza si cambia configuración antes de generar',async()=>{
 const s=setup(),actor=await s.actor(),p=await s.svc.inspect(actor,'sale');s.db.root.sisventas.config.maxComisionPct=10;await assert.rejects(s.svc.generate(actor,{ventaFbKey:'sale',digest:p.digest}),{statusCode:409});assert.equal(s.db.root.sv_commission_generation,undefined);
});
test('circuito deshabilitado y observador sin corte configurado fallan cerrados',async()=>{
 const s=setup({enabled:false});await assert.rejects(s.actor(),{statusCode:503});const c=createCommissionGeneration({db:s.db,commercial:{},enabled:true});assert.throws(()=>c.start(),/COMMISSION_GENERATION_FROM/);
});
test('salud del observador confirma conexión y suscripción sin registrar datos comerciales',()=>{
 const listeners=new Map(),removed=[],logs=[];
 const query={on(event,fn,error){listeners.set('query/'+event,{fn,error});},off(event){removed.push('query/'+event);}};
 const db={ref(path){if(path==='.info/connected')return {on(event,fn){listeners.set('connection',{fn});},off(){removed.push('connection');}};if(path==='sisventas/ventas')return {orderByChild:()=>({equalTo:()=>query})};return {get:async()=>({val:()=>null}),on(){},off(){}};}};
 const stop=createCommissionGeneration({db,commercial:{},enabled:true,from:1000,now:()=>2000,logger:v=>logs.push(v)}).start();
 listeners.get('connection').fn({val:()=>true});listeners.get('query/value').fn();
 assert.equal(logs.at(-1).connected,true);assert.equal(logs.at(-1).subscriptionReady,true);
 listeners.get('query/value').error(Error('dato privado'));assert.equal(logs.at(-1).subscriptionReady,false);assert.equal(logs.at(-1).errors,1);
 assert.doesNotMatch(JSON.stringify(logs),/dato privado|empleado|monto|ventaId/);stop();assert.equal(removed.length,4);
});
test('copias del modelo económico del servidor coinciden con el cliente y se empaquetan',()=>{
 for(const name of ['sales-read-model','budget-read-model','identity-index'])assert.equal(fs.readFileSync('cotizador/commercial-models/'+name+'.js','utf8'),fs.readFileSync('js/v3/'+name+'.js','utf8'));assert.match(fs.readFileSync('cotizador/Dockerfile','utf8'),/COPY commercial-models/);
});

function observerFixture(options){
 const f=setup(options),original=f.db.ref.bind(f.db),events={},reads=[];
 f.db.ref=path=>{
  if(path==='sisventas/ventas')return {orderByChild:()=>({equalTo:()=>({on:(event,fn)=>events[event]=fn,off(){}})})};
  if(path==='.info/connected')return {on(){},off(){}};
  const ref=original(path);return {...ref,get:async()=>{reads.push(path);return ref.get();}};
 };
 const stop=f.svc.start();return {...f,events,reads,stop};
}
test('observador descarta ventas sin comisión habilitada sin releer dependencias ni alterar históricos',async()=>{
 const f=observerFixture(),before=JSON.stringify(f.db.root);
 try{
  for(let i=0;i<1000;i++)f.events.child_added({key:'historic-'+i,val:()=>({estadoPago:'pago_total',comisionHabilitada:i%2?false:undefined})});
  await new Promise(setImmediate);
  assert.deepEqual(f.reads,[]);assert.equal(JSON.stringify(f.db.root),before);
 }finally{f.stop();}
});
test('habilitar comisión después del primer snapshot conserva la generación y la aprobación pendiente',async()=>{
 const f=observerFixture();try{
  f.events.child_added({key:'sale',val:()=>({comisionHabilitada:false})});await new Promise(setImmediate);
  assert.equal(Object.keys(f.db.root.sisventas.gastos).length,0);
  f.events.child_changed({key:'sale',val:()=>f.sale});await new Promise(setImmediate);
  assert.equal(Object.keys(f.db.root.sisventas.gastos).length,1);assert.equal(Object.values(f.db.root.sisventas.gastos)[0].estado,'pendiente_aprobacion');
  f.events.child_changed({key:'sale'});await new Promise(setImmediate);assert.equal(Object.keys(f.db.root.sisventas.gastos).length,1);
 }finally{f.stop();}
});

test('una comisión ya generada o venta anulada no vuelve a leer dependencias al iniciar o editar',async()=>{
 const f=observerFixture(),before=JSON.stringify(f.db.root);
 try{
  for(const sale of [{comisionHabilitada:true,comisionesGeneradas:true},{comisionHabilitada:true,anulada:true},{comisionHabilitada:true,anulado:true},{comisionHabilitada:true,estado:'Anulada'},{comisionHabilitada:true,estado:'sin_cargo'}]){
   for(const event of ['child_added','child_changed'])f.events[event]({key:'sale',val:()=>sale});
  }
  await new Promise(setImmediate);assert.deepEqual(f.reads,[]);assert.equal(JSON.stringify(f.db.root),before);
 }finally{f.stop();}
});
test('un snapshot habilitado no sustituye la validación actual de la venta en servidor',async()=>{
 const f=observerFixture({sale:{comisionHabilitada:false}}),before=JSON.stringify(f.db.root);try{
  f.events.child_added({key:'sale',val:()=>({comisionHabilitada:true})});await new Promise(setImmediate);
  assert.ok(f.reads.includes('sisventas/ventas/sale'));assert.equal(JSON.stringify(f.db.root),before);
 }finally{f.stop();}
});

test('una venta con identidad canónica lee sólo los empleados participantes, sin descargar la nómina',async()=>{
 const f=setup(),ref=f.db.ref.bind(f.db),reads=[];
 f.db.root.sisventas.empleados.other={nombre:'Otra persona ficticia',foto:'No descargar este perfil'};
 f.db.ref=path=>{assert.notEqual(path,'sisventas/empleados');assert.notEqual(path,'sisventas/empleados/other');const r=ref(path);return {...r,get:async()=>{reads.push(path);return r.get();}};};
 assert.equal((await f.svc.systemGenerate('sale')).status,'generada');assert.ok(reads.includes('sisventas/empleados/e'));
 assert.equal(Object.values(f.db.root.sisventas.gastos).length,1);
});

test('un identificador canónico inválido no se convierte en otra ruta ni autoriza una comisión',async()=>{
 const f=setup({sale:{empleadoFbKey:'../other'}}),ref=f.db.ref.bind(f.db),before=JSON.stringify(f.db.root);
 f.db.ref=path=>{assert.doesNotMatch(path,/\.\./);return ref(path);};
 assert.equal((await f.svc.systemGenerate('sale')).status,'revision');assert.equal(JSON.stringify(f.db.root),before);
});

test('la identidad legada conserva resolución por nombre y bloquea coincidencias ambiguas',async()=>{
 const f=setup({sale:{empleadoFbKey:null}});assert.equal((await f.svc.inspect(await f.actor(),'sale')).status,'lista');
 f.db.root.sisventas.empleados.other={nombre:'Empleado de prueba',activo:true};
 assert.equal((await f.svc.inspect(await f.actor(),'sale')).status,'revision');
});
test('el navegador envía solo referencia, sin exigir acceso al módulo Comisiones',async()=>{
 let request;const user={uid:'u',getIdToken:async()=>'demo'};const c={window:null,fbAuth:{currentUser:user},currentUserUid:'u',SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://demo.invalid'},AbortSignal,fetch:async(url,options)=>{request={url,body:JSON.parse(options.body)};return {ok:true,json:async()=>({ok:true,status:'generada',participantes:[{monto:30}]})};}};c.window=c;vm.runInNewContext(fs.readFileSync('js/core/commission-generation.js','utf8'),c);await c.SVCommissionGeneration.generate({fbKey:'sale',comisionHabilitada:true,total:999,pct:99});assert.deepEqual(request.body,{ventaFbKey:'sale'});c.currentUserUid='view';await assert.rejects(c.SVCommissionGeneration.generate({fbKey:'sale',comisionHabilitada:true}),/Volvé a tu cuenta/);
});
test('alta captura costo del momento; edición conserva snapshot y legado incompleto sigue pendiente',()=>{
 const c={window:null,obtenerProductoPorCodigoVenta:()=>({cod:'p'}),obtenerCostoUnitarioVenta:()=>40};c.window=c;vm.runInNewContext(fs.readFileSync('js/core/commission-generation.js','utf8'),c);const api=c.SVCommissionGeneration,record={items:[{cod:'p',qty:1,punit:100}]},stamped=api.snapshotCosts(record);assert.equal(stamped.items[0].costoUnitarioPresupuestado,40);assert.equal(record.items[0].costoUnitarioPresupuestado,undefined);const edited=api.preserveCosts({items:[{cod:'p',costoUnitarioCompra:80,costoUnitarioPresupuestado:80}]},stamped);assert.equal(edited.items[0].costoUnitarioPresupuestado,40);assert.equal(api.preserveCosts(record,record).items[0].costoUnitarioPresupuestado,undefined);
});

test('el reintento del servidor recupera un corte sin depender de una nueva solicitud del navegador',async()=>{
 const s=setup();s.failAt('sisventas/gastos/gasto_comision_sale_e');await assert.rejects(s.svc.generate(await s.actor(),{ventaFbKey:'sale'}));s.advance(61000);await s.svc.retryPending();assert.equal(s.db.root.sv_commission_generation.sale.estado,'completada');assert.equal(Object.keys(s.db.root.sisventas.gastos).length,1);assert.equal(s.sale.audit.length,1);
});
test('la carga manual no toma una reserva del servidor aunque haya vencido el plazo anterior',async()=>{
 const {createBackend,copy}=require('./helpers/labor-ui-flow.cjs');
 for(const reserva of [{generacionServidorId:'srv-demo',estado:'procesando',ts:0},{generacionServidorId:'srv-demo',estado:'error',ts:0}]){
  const f=createBackend({comisiones_generacion:{comision_v_e:reserva}}),p=f.page(),before=copy(f.state.sisventas);
  await assert.rejects(p.context._generarComisionVentaAtomica(p.context.empData.e,{ventaFbKey:'v',ventaId:'V-FICTICIA'}),/ya tiene una comisión/);
  assert.equal(f.commands.length,0);assert.equal(f.commits.length,0);assert.deepEqual(f.state.sisventas,before);assert.deepEqual(f.direct,[]);
 }
});
test('control previo sin movimiento no se confunde con una comisión generada',async()=>{
 const s=setup();s.db.root.sisventas.comisiones_generacion.comision_sale_e={estado:'error'};const before=JSON.stringify(s.db.root);assert.equal((await s.svc.generate(await s.actor(),{ventaFbKey:'sale'})).status,'revision');assert.equal(JSON.stringify(s.db.root),before);
});
test('resolución de cargo conserva alias técnicos, valores predeterminados y excepción individual cero',async()=>{
 const s=setup();delete s.db.root.sisventas.config.comisionesEmpleados.e;s.db.root.sisventas.empleados.e.cargoId='nuevo';s.db.root.sisventas.config.cargos={nuevo:{categoriaBase:'Técnico C'}};let p=await s.svc.inspect(await s.actor(),'sale');assert.equal(p.participantes[0].pct,2.5);s.db.root.sisventas.config.comisionesEmpleados.e={pct:0};assert.equal((await s.svc.inspect(await s.actor(),'sale')).status,'no_aplica');
});
test('editar un legado sin costo no transforma el costo actual del catálogo en histórico',()=>{
 const c={window:null};c.window=c;vm.runInNewContext(fs.readFileSync('js/core/commission-generation.js','utf8'),c);
 const old={items:[{cod:'p',qty:1,punit:100}]},newValues={items:[{cod:'p',qty:1,punit:100,costoUnitarioCompra:40,costoUnitarioPresupuestado:40}]};
 const record=c.SVCommissionGeneration.preserveCosts(newValues,old);assert.equal(record.items[0].comisionCostoHistoricoPendiente,true);assert.equal(M.originalCost(record.items[0]),null);
 const known=c.SVCommissionGeneration.preserveCosts(newValues,{items:[{cod:'p',qty:1,costoUnitarioCompra:20}]});assert.equal(M.originalCost(known.items[0]),20);
});
