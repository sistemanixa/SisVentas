'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
const copy=value=>value==null?value:structuredClone(value),flush=()=>new Promise(setImmediate);
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function fixture(kind){
 const calls=[],notices=[],timers=[],nodes={},listeners=new Map();let sequence=0,monto=40,doc=null,fileGate=null,sendGate=null,sendError=Object.assign(Error('Acuse incierto ficticio'),{code:'SV_LABOR_COMMIT_UNCONFIRMED',svLaborAttempted:true});
 const button={tagName:'BUTTON',disabled:false,innerHTML:'Registrar'},page={id:'page-fixture'};
 const node=id=>nodes[id]??={value:'',dataset:{},files:[],innerHTML:'',isConnected:true,focus(){}};
 const sale={fbKey:'v1',id:'V-1',total:100,cliente:'Cliente ficticio',clienteFbKey:'c1',estadoPago:'seniado',totalPagado:40};
 const c={console,Date,Math,Object,Array,Set,Map,JSON,Number,String,Promise,parseFloat,currentUser:'Persona ficticia',currentUserUid:'u',currentRole:'admin',fbAuth:{currentUser:{uid:'u'}},PERMISOS_ROLES:{admin:{indiceRevision:1}},
  fbDB:{},fbRef:(_,p)=>p,fbGet(){},fbUpdate(){},fbRunTransaction(){},fbOnDisconnect(){},fbPush:()=>({key:'payment-'+(++sequence)}),_cobroNuevaClave:()=> 'group-'+(++sequence),
  document:{getElementById:node,querySelector:selector=>selector.includes('button')?button:page,addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},dispatchEvent(event){for(const fn of listeners.get(event.type)||[])fn(event);}},notify:value=>notices.push(value),_ccNombreActual:'Cliente ficticio',_ccClienteKeyActual:'c1',
  _svTotalVentaCanonico:v=>v.total,getMontoRaw:()=>monto,_cobranzaEstadoMonto:()=>({montoARS:monto,montoOriginal:monto,moneda:'ARS',tipoCambio:1,saldo:100}),_svResolverVentaRegistro:()=>sale,_cobroBotonGuardar:value=>button.disabled=value,
  async _leerDocumentoGestion(){if(fileGate)await fileGate;return copy(doc);},async _ccLeerComprobante(){if(fileGate)await fileGate;return copy(doc);},_ccPlanImputacion:()=>({plan:[{venta:sale,monto,saldoAnterior:100,saldoRestante:100-monto}],sinImputar:0}),
  async registrarCobrosCanonicos(options){calls.push(copy(options));if(sendGate)await sendGate;if(sendError)throw sendError;return[{pago:{...copy(options.solicitudes[0].pago)},venta:{...sale}}];},
  asegurarOTVentaConPago(){},_svMensajeConfirmacionComisiones:text=>text,registrarActividad(){},cerrarPagoCuentaCorriente(){},previewDocumentoCobro(){},iniciarMonedaCobranza(){},imprimirRecibo(){c.printed=(c.printed||0)+1;},setTimeout(fn,delay){timers.push({fn,delay});return timers.length;}
 };c.window=c;
 for(const[id,value]of Object.entries({'cob-venta':'V-1','cob-medio':'Efectivo','cob-fecha':'2026-10-22','ccp-fecha':'2026-10-22','ccp-medio':'Efectivo'}))node(id).value=value;
 nodes['ccp-guardar']=button;node('ccp-monto');
 load(c,['svCapturarContextoOperacion','_cobroLimpiarIntentosSesion','_cobroReiniciarIntento','_cobroPrepararIntento','_ccGuardarPagoAcotado',kind==='cobranzas'?'registrarPago':'confirmarPagoCuentaCorriente']);
 return{c,calls,notices,timers,nodes,button,start:()=>kind==='cobranzas'?c.registrarPago():c.confirmarPagoCuentaCorriente(),setMonto:value=>monto=value,setDoc:value=>doc=value,setFileGate:value=>fileGate=value,setSendGate:value=>sendGate=value,setError:value=>sendError=value,get keysReserved(){return sequence;}};
}

for(const kind of ['cobranzas','cuenta']){
 test(kind+': retry incierto conserva cuerpo completo, claves y fechas, aunque vuelva a leerse el PDF',async()=>{
  const f=fixture(kind);f.setDoc({nombre:'ficticio.pdf',tipo:'application/pdf',data:'data:application/pdf;base64,AA==',ts:1});await f.start();
  const first=copy(f.calls[0]),keys=f.keysReserved;
  f.setDoc({nombre:'ficticio.pdf',tipo:'application/pdf',data:'data:application/pdf;base64,AA==',ts:999});await f.start();
  assert.equal(f.calls.length,2);assert.deepEqual(f.calls[1],first);assert.equal(f.keysReserved,keys);assert.equal(f.button.disabled,false);assert.ok(f.notices.every(x=>!x.startsWith('✓')));
 });

 test(kind+': cambiar importe tras ambiguo bloquea un nuevo grupo y permite restaurar el intento original',async()=>{
  const f=fixture(kind);await f.start();const first=copy(f.calls[0]),keys=f.keysReserved;f.setMonto(45);await f.start();
  assert.equal(f.calls.length,1);assert.equal(f.keysReserved,keys);assert.match(f.notices.at(-1),/cobro anterior sin confirmar/);
  f.setMonto(40);await f.start();assert.equal(f.calls.length,2);assert.deepEqual(f.calls[1],first);
 });

 test(kind+': mismo nombre/tamaño con otro contenido de comprobante no reutiliza silenciosamente el intento',async()=>{
  const f=fixture(kind);f.setDoc({nombre:'ficticio.pdf',tipo:'application/pdf',data:'data:application/pdf;base64,AA==',ts:1});await f.start();const keys=f.keysReserved;
  f.setDoc({nombre:'ficticio.pdf',tipo:'application/pdf',data:'data:application/pdf;base64,AQ==',ts:1});await f.start();
  assert.equal(f.calls.length,1);assert.equal(f.keysReserved,keys);assert.match(f.notices.at(-1),/cobro anterior sin confirmar/);
 });

 test(kind+': doble clic durante el guardado mantiene una sola solicitud y su indicador ocupado',async()=>{
  const f=fixture(kind),gate=deferred();f.setSendGate(gate.promise);const running=f.start();await flush();await f.start();
  assert.equal(f.calls.length,1);assert.equal(f.button.disabled,true);gate.resolve();await running;assert.equal(f.button.disabled,false);
 });

 test(kind+': rechazo definitivo permite otra carga con nueva identidad y datos corregidos',async()=>{
  const f=fixture(kind);f.setError(Object.assign(Error('No se guardó'),{code:'SV_LABOR_REJECTED'}));await f.start();const old=f.calls[0].grupoPago;
  f.setMonto(45);await f.start();assert.equal(f.calls.length,2);assert.notEqual(f.calls[1].grupoPago,old);assert.equal(f.calls[1].solicitudes[0].monto,45);
 });

 for(const change of [c=>{c.currentUserUid='otro';c.fbAuth.currentUser={uid:'otro'};},c=>{c.currentRole='administrativo';},c=>{c.PERMISOS_ROLES.admin.indiceRevision=2;},c=>{c._svOperacionesSesionEpoch=1;},c=>{c._impersonacionOriginal={uid:'u'};}])test(kind+': un intento retenido no se reutiliza con otra identidad, rol, revisión o vista',async()=>{
  const f=fixture(kind);await f.start();change(f.c);await f.start();assert.equal(f.calls.length,1);assert.ok(!f.notices.some(x=>x.startsWith('✓')));
 });

 test(kind+': sesión cambiada mientras se lee el adjunto no envía un cobro ni limpia el formulario siguiente',async()=>{
  const f=fixture(kind),gate=deferred();f.setFileGate(gate.promise);const running=f.start();await flush();f.c.currentUserUid='otro';f.c.fbAuth.currentUser={uid:'otro'};f.nodes['cob-venta'].value='Otra sesión';gate.resolve();await running;
  assert.equal(f.calls.length,0);assert.equal(f.nodes['cob-venta'].value,'Otra sesión');assert.equal(f.notices.length,0);
 });

 test(kind+': un acuse viejo no libera el botón ni el busy de una operación posterior',async()=>{
  const f=fixture(kind),gate=deferred();f.setSendGate(gate.promise);f.setError(null);const running=f.start();await flush();
  const token={};if(kind==='cobranzas'){f.c._cobroOperacionGuardado=token;f.c._cobroGuardadoEnCurso=true;}else{f.c._pagoCuentaOperacion=token;f.c._pagoCuentaGuardando=true;}
  f.button.innerHTML='Guardando otra operación';f.button.disabled=true;gate.resolve();await running;
  assert.equal(f.button.disabled,true);assert.equal(f.button.innerHTML,'Guardando otra operación');assert.equal(kind==='cobranzas'?f.c._cobroGuardadoEnCurso:f.c._pagoCuentaGuardando,true);assert.equal(f.notices.length,0);
 });

 test(kind+': logout/relogin en el mismo DOM descarta el payload antiguo y una reapertura explícita puede preparar otro',async()=>{
  const f=fixture(kind);await f.start();const first=f.calls[0].grupoPago;f.c.fbAuth.currentUser=null;f.c.currentUserUid='';f.c.document.dispatchEvent({type:'sisventas:session-ended'});
  assert.equal(f.c._cobroIntento,null);assert.equal(f.c._ccPagoIntento,null);
  f.c.fbAuth.currentUser={uid:'u'};f.c.currentUserUid='u';f.c._cobroReiniciarIntento(kind==='cuenta'?'cuenta':'cobranzas');f.setMonto(45);await f.start();
  assert.equal(f.calls.length,2);assert.notEqual(f.calls[1].grupoPago,first);assert.equal(f.calls[1].solicitudes[0].monto,45);
 });

 test(kind+': abrir otra ficha no descarta el intento cuando recovery sigue pendiente',async()=>{
  const f=fixture(kind);await f.start();const slot=kind==='cuenta'?'_ccPagoIntento':'_cobroIntento',saved=f.c[slot],keys=f.keysReserved;
  f.c.SVLaborWriteRecovery={assertAvailable(){throw Object.assign(Error('Consultar operación'),{code:'SV_LABOR_PENDING_OPERATION'});}};
  assert.throws(()=>f.c._cobroReiniciarIntento(kind==='cuenta'?'cuenta':'cobranzas'),{code:'SV_LABOR_PENDING_OPERATION'});assert.equal(f.c[slot],saved);assert.equal(f.keysReserved,keys);assert.equal(f.calls.length,1);
 });

 test(kind+': falla secundaria después del acuse conserva cobro confirmado y bloquea un segundo pago',async()=>{
  const f=fixture(kind);f.setError(null);f.c.asegurarOTVentaConPago=()=>{throw Error('Fallo OT ficticio');};await f.start();
  const slot=kind==='cuenta'?'_ccPagoIntento':'_cobroIntento';assert.equal(f.c[slot].confirmado,true);assert.match(f.notices.at(-1),/se guardó.*paso posterior/);assert.ok(!f.notices.at(-1).startsWith('Error al guardar:'));assert.equal(f.button.disabled,false);
  const keys=f.keysReserved;await f.start();assert.equal(f.calls.length,1);assert.equal(f.keysReserved,keys);assert.match(f.notices.at(-1),/ya está guardado/);
  f.c._cobroReiniciarIntento(kind==='cuenta'?'cuenta':'cobranzas');assert.equal(f.c[slot],null);
 });
}

test('el recibo conserva su temporizador explícito tras finalizar el cobro confirmado',async()=>{
 const f=fixture('cobranzas');f.setError(null);await f.start();assert.equal(f.button.disabled,false);assert.equal(f.c.printed||0,0);
 const timer=f.timers.find(x=>x.delay===400);assert.ok(timer);timer.fn();assert.equal(f.c.printed,1);
});

test('cerrar y abrir la ventana real de Cuenta corriente descarta sólo un intento ya retirado',async()=>{
 const f=fixture('cuenta');await f.start();const previous=f.c._ccPagoIntento;
 const baseGet=f.c.document.getElementById;let modal={id:'modal-pago-cuenta',isConnected:true,remove(){this.isConnected=false;modal=null;}};
 f.c.document.getElementById=id=>id==='modal-pago-cuenta'?modal:baseGet(id);
 f.c.document.createElement=()=>({isConnected:true,style:{},remove(){this.isConnected=false;modal=null;}});
 f.c.document.body={appendChild(node){modal=node;}};f.c.document.activeElement=f.button;
 Object.assign(f.c,{clearTimeout(){},_ccVentasPendientesActuales:()=>[{total:100}],_svSaldoPendienteVenta:()=>100,svFechaLocalISO:()=> '2026-10-22',MEDIOS_PAGO_CONFIG:[],escapeHTML:String,formatoMedioPago:String,prepararVentanaPagoCuentaCorriente(){},initMoneyInputsEn(){},actualizarVistaPagoCuentaCorriente(){},svSincronizarPilaModales(){}});
 load(f.c,['cerrarPagoCuentaCorriente','abrirPagoCuentaCorriente']);
 f.c.cerrarPagoCuentaCorriente();assert.equal(f.c._ccPagoIntento,null);assert.equal(modal,null);
 f.c.abrirPagoCuentaCorriente();assert.ok(modal);assert.equal(f.c._ccPagoIntento,null);assert.ok(previous);
 const current=modal;f.c._ccPagoIntento=previous;f.c.SVLaborWriteRecovery={assertAvailable(){throw Error('Consultar operación');}};f.c.abrirPagoCuentaCorriente();assert.equal(modal,current);assert.equal(f.c._ccPagoIntento,previous);
});
