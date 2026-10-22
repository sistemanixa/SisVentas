'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');

function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function setup(kind, options={}){
  const generation=deferred(), events=[], notices=[], timers=[], stages=[];
  const nodes={};
  const node=id=>nodes[id]||(nodes[id]={value:'',dataset:{},style:{},files:[],innerHTML:'',checked:false,focus(){}});
  const button={tagName:'BUTTON',disabled:false,innerHTML:'Registrar',dataset:{}};
  const sale={fbKey:'sale',id:'V-DEMO',cliente:'Cliente ficticio',clienteFbKey:'client',total:100,totalPagado:100,estadoPago:'pago_total',comisionHabilitada:true,...options.sale};
  const sales=options.sales||[sale];
  const rowNodes={'.prod-sel-cod':{textContent:'P-DEMO'},'.desc-txt-clean':{textContent:'Producto ficticio'},'.price':{value:'100',dataset:{}},'.qty':{value:'1'},'.disc':{value:'0'}};
  const row={dataset:{},querySelector:selector=>rowNodes[selector]||null};
  let paymentCalls=0, generationCalls=0, saleWrites=0, closed=0;
  const c={
    console, Date, Math, Object, Array, Promise, String, Number, parseFloat, parseInt,
    document:{getElementById:node,activeElement:button,querySelector:selector=>selector==='#venta-empleado'?{value:'employee'}:selector==='#venta-comisionado2'?null:button,querySelectorAll:()=>[row]},
    setTimeout(fn,delay){timers.push({fn,delay});return timers.length;},
    notify:message=>notices.push(message),currentUser:'Persona ficticia',currentRole:'vendedor',currentUserUid:'person',fbAuth:{currentUser:{uid:'person'}},
    SisVentas:{carga:{mostrar(text){const state={text,closed:false};stages.push(state);const close=()=>{state.closed=true;};close.actualizar=value=>state.text=value;return close;}}},
    SVCommissionGeneration:{generate(venta){generationCalls++;events.push('generation');assert.ok(sales.some(item=>item.fbKey===venta.fbKey));return options.generations?.[generationCalls-1]?.promise||generation.promise;}},
    fbDB:{},fbRef:(_db,path)=>path,fbPush:()=>({key:'payment'}),fbRunTransaction(){},fbUpdate(){},fbGet(){},fbOnDisconnect(){},
    async registrarCobrosCanonicos(){paymentCalls++;events.push('payment');if(options.paymentError)throw Error('Cobro no confirmado');return sales.map((venta,index)=>({pago:{fbKey:'payment'+(index||''),monto:venta.total},venta}));},
    async _ccGuardarPagoAcotado(){return c.registrarCobrosCanonicos();},
    getMontoRaw:()=>100,_ccPlanImputacion:()=>({plan:sales.map(venta=>({venta,monto:venta.total,saldoAnterior:venta.total,saldoRestante:0})),sinImputar:0}),
    _ccLeerComprobante:async()=>null,_svTotalVentaCanonico:venta=>venta.total,
    asegurarOTVentaConPago(){events.push('ot');},registrarActividad(){events.push('activity');},cerrarPagoCuentaCorriente(){closed++;events.push('close');},
    _cobranzaEstadoMonto:()=>({montoARS:100,montoOriginal:100,moneda:'ARS',tipoCambio:1,saldo:100}),
    _svResolverVentaRegistro:()=>sale,_cobroNuevaClave:()=> 'payment-group',_leerDocumentoGestion:async()=>null,
    _cobroBotonGuardar:busy=>{button.disabled=busy;},previewDocumentoCobro(){},iniciarMonedaCobranza(){},imprimirRecibo(){events.push('receipt');},
    _ccNombreActual:'Cliente ficticio',_ccClienteKeyActual:'client',
    SVCommercialDocument:{dateChoice:async()=>({value:'19/10/2026'}),auditDate(){}},
    _ventaEditandoFbKey:'sale',_ventaEditandoOriginal:sale,
    _ventaCambiarEstadoGuardado:busy=>{button.disabled=busy;},
    svCrearProgresoBoton(_button,text){const close=c.SisVentas.carga.mostrar(text);return {actualizar:close.actualizar,finalizar:close};},
    _ventaMostrarProcesoPantalla(text){const close=c.SisVentas.carga.mostrar(text);return {actualizar:close.actualizar,finalizar:close};},
    ventaRequiereAutorizacion:false,ventaAutorizadaPorAdmin:false,tienePermiso:()=>true,
    validarProductosActivosDocumento:()=>true,referenciasProductoDesdeFilas:()=>[],clientesData:[{fbKey:'client',id:'C-DEMO'}],
    clienteVinculoOperacion:()=>({clientePrincipalKey:'client',domicilioFbKey:'address',direccion:'Domicilio ficticio'}),_get:node,
    fechaVentaOrdenISO:()=> '2026-10-19',ventaEstaAnulada:()=>false,empData:{employee:{fbKey:'employee',nombre:'Empleado ficticio'}},
    _ventaMonedaActual:'ARS',_ventaConIva:false,_redondearPrecioActual:Math.round,obtenerProductoPorCodigoVenta:()=>({}),obtenerCostoUnitarioVenta:()=>40,
    ventaTieneDescuentoItem:()=>false,ventaNormalizarDescuentoParaVista:(_venta,value)=>value,ventaPorcentajeDescuentoEfectivo:()=>0,ventaEsSinCargo:()=>false,obtenerCostoItemVenta:()=>40,
    svAutorizarDescuentoVenta:async()=>true,
    async fbGuardarVenta(venta){saleWrites++;events.push('sale');return {fbKey:venta.fbKey};},
    mostrarConfirmacionVenta(){events.push('sale-confirmed');},mostrarDomicilioOperacionSeleccionado(){},_hide(){},_set(){},iniciarNuevaVenta(){events.push('new-sale');}
  };
  c.window=c;
  for(const [id,value]of Object.entries({'ccp-fecha':'2026-10-19','ccp-medio':'Efectivo','cob-venta':'V-DEMO','cob-medio':'Efectivo','cob-fecha':'2026-10-19','cli-inp':'Cliente ficticio','id-cli':'C-DEMO','cli-fbkey':'client'}))node(id).value=value;
  node('venta-generar-comision').checked=sale.comisionHabilitada;
  nodes['ccp-guardar']=button;
  load(c,['svCapturarContextoOperacion','_cobroPrepararIntento','_svConfirmarGeneracionComision','_svMensajeConfirmacionComisiones','generarComisionesVenta',kind==='cobranzas'?'registrarPago':kind==='cuenta'?'confirmarPagoCuentaCorriente':'confirmarVenta']);
  return {c,generation,events,notices,timers,stages,nodes,button,sale,get paymentCalls(){return paymentCalls;},get generationCalls(){return generationCalls;},get saleWrites(){return saleWrites;},get closed(){return closed;},start:()=>kind==='cobranzas'?c.registrarPago():kind==='cuenta'?c.confirmarPagoCuentaCorriente():c.confirmarVenta()};
}

for(const kind of ['cobranzas','cuenta','venta']){
  test(kind+': confirma una sola escritura y espera la comisión antes de terminar',async()=>{
    const f=setup(kind), running=f.start();await flush();
    assert.equal(f.paymentCalls,kind==='venta'?0:1);assert.equal(f.saleWrites,kind==='venta'?1:0);
    assert.equal(f.generationCalls,1);assert.ok(f.events.indexOf(kind==='venta'?'sale':'payment')<f.events.indexOf('generation'));
    assert.equal(f.notices.length,0);assert.equal(f.closed,0);assert.equal(f.timers.length,0);
    assert.ok(f.stages.some(stage=>stage.text==='Generando comisión…'&&!stage.closed));
    assert.equal(f.button.disabled,true);
    if(kind==='cobranzas')assert.equal(f.nodes['cob-venta'].value,'V-DEMO');
    if(kind==='venta')assert.equal(f.nodes['cli-inp'].value,'Cliente ficticio');
    await f.start();assert.equal(f.generationCalls,1);assert.equal(f.paymentCalls,kind==='venta'?0:1);assert.equal(f.saleWrites,kind==='venta'?1:0);
    f.generation.resolve({status:'generada',participantes:[{monto:10}]});await running;await flush();
    assert.match(f.notices.at(-1),/Comisión pendiente de aprobación/);
    assert.equal(f.button.disabled,false);assert.ok(f.stages.every(stage=>stage.closed));
    if(kind==='cuenta')assert.equal(f.closed,1);
    if(kind==='cobranzas'){assert.equal(f.nodes['cob-venta'].value,'');assert.equal(f.c._ultimoPagoId,'payment');}
    if(kind==='venta'){assert.ok(!f.events.includes('sale-confirmed'));f.timers.find(timer=>timer.delay===800).fn();assert.equal(f.events.at(-1),'sale-confirmed');}
  });

  test(kind+': fallo de comisión conserva pago/venta y no ofrece un éxito falso ni reescribe',async()=>{
    const f=setup(kind), running=f.start();await flush();f.generation.reject(Error('Interrupción ficticia'));await running;await flush();
    assert.equal(f.paymentCalls,kind==='venta'?0:1);assert.equal(f.saleWrites,kind==='venta'?1:0);assert.equal(f.generationCalls,1);
    assert.match(f.notices.at(-1),/^No se pudo confirmar la generación de comisiones\./);
    assert.match(f.notices.at(-1),kind==='venta'?/Venta guardada/:/Pago (registrado|aplicado)/);
    assert.match(f.notices.at(-1),/pendiente de confirmación: Interrupción ficticia/);
    assert.doesNotMatch(f.notices.at(-1),/^(?:✓|Error al guardar:|No se pudo registrar el pago:|No se pudo guardar la venta:)/);
    assert.equal(f.button.disabled,false);assert.ok(f.stages.every(stage=>stage.closed));
    if(kind==='cuenta')assert.equal(f.c._ccPagoIntento,null);
    if(kind==='cobranzas'){assert.equal(f.c._cobroIntento,null);assert.equal(f.c._ultimoPagoId,'payment');}
  });
}

for(const [result,expected,warning]of [
  [{status:'generada',reutilizada:true},'Comisión ya registrada',false],
  [{status:'existente'},'Comisión ya registrada',false],
  [{status:'no_aplica'},'Sin comisión aplicable',false],
  [{status:'revision',motivo:'Falta costo original'},'Comisión pendiente de revisión: Falta costo original',true],
  [{status:'pendiente_cobro'},'El servidor aún no confirmó el cobro completo para la comisión',true],
  [{status:'desconocido'},'Comisión pendiente de confirmación',true]
])test('el aviso conserva el estado real '+result.status+(result.reutilizada?' reutilizada':''),async()=>{
  const f=setup('cobranzas'),running=f.start();await flush();f.generation.resolve(result);await running;
  assert.ok(f.notices.at(-1).includes(expected));assert.equal(f.notices.at(-1).startsWith('No se pudo confirmar'),warning);
  if(result.status!=='generada'||result.reutilizada)assert.doesNotMatch(f.notices.at(-1),/pendiente de aprobación/);
});

test('409 de lease en proceso se diferencia de colisión que requiere revisión, sin sondeo',async()=>{
  for(const [commissionStatus,text]of [['procesando','Comisión en proceso; todavía sin confirmación'],['revision','Comisión pendiente de revisión']]){
    const f=setup('cobranzas'),running=f.start();await flush();f.generation.reject(Object.assign(Error('Conflicto ficticio'),{statusCode:409,commissionStatus}));await running;
    assert.ok(f.notices.at(-1).includes(text));assert.equal(f.generationCalls,1);assert.equal(f.paymentCalls,1);
    assert.ok(f.timers.every(timer=>timer.delay===400),'sólo se conserva la impresión existente');
  }
});

test('seña o comisión deshabilitada no inicia generación y conserva confirmación de pago',async()=>{
  for(const kind of ['cobranzas','cuenta','venta'])for(const sale of [{estadoPago:'seniado',totalPagado:40},{comisionHabilitada:false}]){
    const f=setup(kind,{sale});await f.start();await flush();assert.equal(f.generationCalls,0);
    assert.equal(f.paymentCalls,kind==='venta'?0:1);assert.equal(f.saleWrites,kind==='venta'?1:0);assert.ok(!f.stages.some(stage=>stage.text==='Generando comisión…'));
  }
});

test('un cobro no confirmado nunca inicia comisión ni anuncia pago guardado',async()=>{
  for(const kind of ['cobranzas','cuenta']){
    const f=setup(kind,{paymentError:true});await f.start();await flush();assert.equal(f.paymentCalls,1);assert.equal(f.generationCalls,0);
    assert.match(f.notices.at(-1),/Cobro no confirmado/);assert.doesNotMatch(f.notices.at(-1),/Pago (registrado|aplicado)/);
  }
});

test('Cuenta corriente espera las dos comisiones y conserva la imputación única si una requiere revisión',async()=>{
  const first=deferred(),second=deferred();
  const sales=['sale','sale-2'].map(fbKey=>({fbKey,id:fbKey,total:50,totalPagado:50,estadoPago:'pago_total',comisionHabilitada:true}));
  const f=setup('cuenta',{sales,generations:[first,second]}),running=f.start();await flush();
  assert.equal(f.paymentCalls,1);assert.equal(f.generationCalls,2);assert.equal(f.closed,0);
  first.resolve({status:'generada'});await flush();assert.equal(f.closed,0);assert.equal(f.notices.length,0);assert.equal(f.button.disabled,true);
  second.resolve({status:'revision',motivo:'Costo original faltante'});await running;
  assert.equal(f.paymentCalls,1);assert.equal(f.generationCalls,2);assert.equal(f.closed,1);
  assert.match(f.notices.at(-1),/Pago aplicado a 2 ventas/);assert.match(f.notices.at(-1),/pendiente de aprobación/);assert.match(f.notices.at(-1),/pendiente de revisión: Costo original faltante/);
  assert.ok(f.stages.every(stage=>stage.closed));assert.equal(f.button.disabled,false);
});

test('logout, otro UID, rol o revisión durante la comisión no altera la interfaz siguiente',async()=>{
  const changes=[c=>{c.currentUserUid='';c.fbAuth.currentUser=null;c._svOperacionesSesionEpoch=1;},c=>{c.currentUserUid='other';c.fbAuth.currentUser={uid:'other'};},c=>{c.currentRole='administrativo';},c=>{c.PERMISOS_ROLES={vendedor:{indiceRevision:2}};}];
  for(const kind of ['cobranzas','cuenta','venta'])for(const change of changes){
    const f=setup(kind),running=f.start();await flush();assert.equal(f.generationCalls,1);
    change(f.c);f.nodes['cob-venta'].value='Otra sesión';f.nodes['cli-inp'].value='Otra sesión';
    f.generation.resolve({status:'generada'});await running;await flush();f.timers.forEach(timer=>timer.fn());
    assert.equal(f.notices.length,0);assert.equal(f.closed,0);assert.equal(f.nodes['cob-venta'].value,'Otra sesión');assert.equal(f.nodes['cli-inp'].value,'Otra sesión');
    assert.ok(!f.events.includes('receipt'));assert.ok(!f.events.includes('sale-confirmed'));assert.ok(!f.events.includes('new-sale'));
    assert.equal(f.generationCalls,1);assert.equal(f.paymentCalls,kind==='venta'?0:1);assert.equal(f.saleWrites,kind==='venta'?1:0);
  }
});

test('timers ya programados de recibo y confirmación también descartan una sesión posterior',async()=>{
  for(const kind of ['cobranzas','venta']){
    const f=setup(kind),running=f.start();await flush();f.generation.resolve({status:'generada'});await running;
    f.c._svOperacionesSesionEpoch=1;f.nodes['cli-inp'].value='Otra sesión';f.timers.forEach(timer=>timer.fn());
    assert.equal(f.nodes['cli-inp'].value,'Otra sesión');assert.ok(!f.events.includes('receipt'));assert.ok(!f.events.includes('sale-confirmed'));assert.ok(!f.events.includes('new-sale'));
  }
});

test('un fallo al presentar o cerrar progreso no cambia el cobro confirmado ni omite la generación',async()=>{
  for(const kind of ['cobranzas','cuenta'])for(const phase of ['abrir','cerrar']){
    const f=setup(kind);f.c.SisVentas.carga.mostrar=()=>{if(phase==='abrir')throw Error('Vista desmontada');return ()=>{throw Error('Vista desmontada');};};
    const running=f.start();await flush();assert.equal(f.paymentCalls,1);assert.equal(f.generationCalls,1);f.generation.resolve({status:'generada'});await running;
    assert.match(f.notices.at(-1),/pendiente de aprobación/);assert.doesNotMatch(f.notices.at(-1),/Error al guardar|No se pudo registrar el pago/);assert.equal(f.paymentCalls,1);
  }
  const f=setup('venta');const result=f.c._svConfirmarGeneracionComision(f.sale,100,()=>{throw Error('Vista desmontada');});
  f.generation.resolve({status:'generada'});assert.equal((await result).texto,'Comisión pendiente de aprobación');assert.equal(f.generationCalls,1);assert.equal(f.saleWrites,0);
});

test('el cierre de un progreso de venta antiguo no modifica ni retira el nuevo',()=>{
  let overlay=null;const text={textContent:''};
  const body={appendChild(node){overlay=node;node.parentNode=body;},removeChild(node){assert.equal(node,overlay);node.parentNode=null;overlay=null;}};
  const c=load({document:{body,getElementById:()=>overlay,createElement:()=>({style:{},setAttribute(){},querySelector:()=>text})}},['_ventaMostrarProcesoPantalla']);
  const old=c._ventaMostrarProcesoPantalla('Primero'),current=c._ventaMostrarProcesoPantalla('Segundo');
  old.actualizar('Respuesta antigua');assert.equal(text.textContent,'Segundo');old.finalizar();assert.ok(overlay);
  current.actualizar('Confirmando comisión');assert.equal(text.textContent,'Confirmando comisión');current.finalizar();assert.equal(overlay,null);
});
