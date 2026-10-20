'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {createBackend,copy,apply}=require('./helpers/labor-ui-flow.cjs');
const {createFiscalLaborBridge}=require('../cloud-functions/emitir-factura/labor-bridge.cjs');
const authModule=require('../cloud-functions/emitir-factura/service-auth.cjs');
const {load}=require('./helpers/app-functions.cjs');
const sale=()=>({fbKey:'v',id:'V-FICTICIA',items:[{qty:1,punit:121,precioUnitarioSinIvaFiscal:100,desc:'Producto ficticio',cod:'FICTICIO'}],totalFiscalEsperado:121,total:121,cliente:'Cliente ficticio'});
const request=()=>({venta:sale(),tipoComprobante:'FACTURA B',provincia:'Buenos Aires',puntoVenta:1,usuario:'Titular ficticio'});
const authorized=(cae='CAE-FICTICIO-1')=>({ok:true,status:200,json:async()=>({error:'N',comprobante:{cae,cae_vencimiento:'30/10/2026',numero:'123',punto_venta:1,fecha:'20/10/2026',comprobante_pdf_url:'https://provider.invalid/comprobante.pdf'}})});
const originalFiscal=()=>({cae:'CAE-ANTERIOR',numero:'00001-00000100',tipo:'FACTURA B',punto_venta:1,fecha:'01/10/2026',datos_fiscales:{cae:'CAE-ANTERIOR',numero:100,tipo:'FACTURA B',punto_venta:1,fecha:'01/10/2026',total:121,detalle:[{codigo:'FICTICIO',descripcion:'Producto ficticio',cantidad:1,precio_unitario:100,precio_total:100,alicuota:21}]}});
function fixture(initial={}){
 const f=createBackend({ventas:{v:sale()},...initial});let transactionTail=Promise.resolve(),sequence=0,providerCalls=0,provider=()=>authorized(),jobFailures=0;
 const logs=[];
 const db={ref(path){return {get:async()=>({val:()=>f.get(path)}),
  transaction(update){const task=transactionTail.then(()=>{const before=f.get(path),next=update(copy(before));if(next!==undefined){if(path.startsWith('sv_fiscal_emissions/')&&next.resultado&&jobFailures>0){jobFailures--;throw Error('Error ficticio de persistencia');}apply(f.state,{[path]:next});}return {committed:next!==undefined,snapshot:{val:()=>f.get(path)}};});transactionTail=task.catch(()=>{});return task;},
  push:async value=>{assert.equal(path,'sisventas/log_actividad');apply(f.state,{[path+'/ficticio-'+(++sequence)]:value});return {key:'ficticio-'+sequence};}
 };}};
 const bridge=createFiscalLaborBridge({db,guard:f.guard,now:()=>1792497600000,uuid:()=> 'claim-fixture-'+(++sequence)});
 const database=()=>db;database.ServerValue={TIMESTAMP:1792497600000};
 const admin={initializeApp(){},database,auth:()=>({verifyIdToken:async(token,revoked)=>{assert.equal(token,'fixture-token');assert.equal(revoked,true);return {uid:'u'};}})};
 const context={exports:{},process:{env:{}},console:{log:(...args)=>logs.push(args),warn:(...args)=>logs.push(args),error:(...args)=>logs.push(args)},fetch:async(url,options)=>{assert.match(url,/tusfacturas\.app\/app\/api\/v2\/facturacion\/nuevo$/);providerCalls++;return provider(JSON.parse(options.body));},require:name=>{
  if(name==='firebase-functions/v2/https')return {onRequest:(_options,handler)=>handler};
  if(name==='firebase-functions/params')return {defineSecret:()=>({value:()=> 'secret-fixture'}),defineString:()=>({value:()=>''})};
  if(name.startsWith('firebase-functions/'))return {};
  if(name==='firebase-admin')return admin;
  if(name==='./service-auth.cjs')return authModule;
  if(name==='./fiscal-contract.cjs')return require('../cloud-functions/emitir-factura/fiscal-contract.cjs');
  if(name==='./labor-bridge.cjs')return {runtime:()=>bridge};
  return require(name);
 }};
 vm.runInNewContext(fs.readFileSync('cloud-functions/emitir-factura/index.js','utf8'),context);
 async function send(body=request()){
  const res={code:0,body:null,set(){},status(code){this.code=code;return this;},json(value){this.body=copy(value);return this;},send(){return this;}};
  await context.exports.emitirFactura({method:'POST',body:copy(body),get:name=>name==='Authorization'?'Bearer fixture-token':name==='Origin'?'https://ventas.sistemanixa.com':''},res);return res;
 }
 return {...f,db,bridge,send,logs,setProvider:fn=>{provider=fn;},failResultPersistence:count=>{jobFailures=count;},get providerCalls(){return providerCalls;}};
}

test('Fiscal preflight exige coordinación lista antes del proveedor y no tiene fallback Admin',async()=>{
 const f=fixture();f.state.sv_labor_config.ready=false;const before=copy(f.state.sisventas),res=await f.send();
 assert.equal(res.code,503);assert.equal(f.providerCalls,0);assert.deepEqual(f.state.sisventas,before);assert.equal(f.get('sv_fiscal_emissions'),null);
});

test('La emisión real del handler conserva resultado durable y vincula factura mediante el guard común',async()=>{
 const f=fixture(),res=await f.send();assert.equal(res.code,200);assert.equal(res.body.cae,'CAE-FICTICIO-1');assert.equal(res.body.persistenciaPendiente,false);assert.equal(f.providerCalls,1);
 assert.equal(f.get('sisventas/ventas/v/factura').cae,res.body.cae);assert.equal(f.get('sisventas/ventas/v/sentinel'),null);
 const job=f.get('sv_fiscal_emissions/'+res.body.emisionOperacionId);assert.equal(job.estado,'autorizada');assert.equal(job.resultado.cae,res.body.cae);assert.equal(job.uid,'u');
 assert.equal(f.get('sisventas/ventas/v/emisionesFiscales/'+res.body.emisionOperacionId).resultado,undefined);
 assert.equal(f.commits.filter(patch=>Object.keys(patch).some(path=>path.startsWith('sisventas/ventas/'))).length,1);
 assert.ok(!JSON.stringify(job).includes('secret-fixture'));assert.ok(!JSON.stringify(f.logs).includes('CAE-FICTICIO-1'));assert.ok(!f.reads.some(([,path])=>path==='sisventas'));
 const receipts=f.get('sv_labor_receipts');assert.ok(Object.values(receipts).every(receipt=>JSON.stringify(receipt.result).length<100),'Los recibos no duplican la venta ni el comprobante');
 const repeated=await f.send();assert.equal(repeated.body.cae,res.body.cae);assert.equal(f.providerCalls,1);
});

test('Respuesta fiscal perdida queda despachada: repetir o cambiar el payload jamás vuelve al proveedor',async()=>{
 const f=fixture();f.setProvider(()=>{throw Error('Fallo ficticio luego de despachar');});
 const first=await f.send();assert.equal(first.code,409);assert.match(first.body.mensaje,/No vuelvas a emitir/);assert.equal(f.providerCalls,1);
 const modified=request();modified.venta.items[0].desc='Otro texto ficticio';
 for(const input of [request(),modified]){const result=await f.send(input);assert.equal(result.code,409);assert.match(result.body.mensaje,/pendiente de verificación/);}
 assert.equal(f.providerCalls,1);assert.equal(Object.keys(f.get('sv_fiscal_emissions')).length,1);
});

test('Una respuesta desconocida no libera la reserva; sólo el rechazo explícito permite otra acción del usuario',async()=>{
 const unknown=fixture();unknown.setProvider(()=>({ok:true,status:200,json:async()=>({})}));await unknown.send();await unknown.send();assert.equal(unknown.providerCalls,1);
 const rejected=fixture();rejected.setProvider(()=>({ok:true,status:200,json:async()=>({error:'S',errores:['Rechazo ficticio confirmado']})}));assert.equal((await rejected.send()).code,422);
 rejected.setProvider(()=>authorized());assert.equal((await rejected.send()).code,200);assert.equal(rejected.providerCalls,2);
});

test('CAE autorizado y guard ocupado devuelven200 pendiente; reintentar vinculación no emite otra factura',async()=>{
 const f=fixture();f.setRejectPatch(patch=>{if(Object.keys(patch).some(path=>path.startsWith('sisventas/ventas/')))throw Error('Fallo ficticio de attachment');});
 const first=await f.send();assert.equal(first.code,200);assert.equal(first.body.cae,'CAE-FICTICIO-1');assert.equal(first.body.persistenciaPendiente,true);assert.equal(first.body.vinculacionDisponible,true);assert.equal(f.providerCalls,1);assert.equal(f.get('sisventas/ventas/v/factura'),null);
 const repeated=await f.send();assert.equal(repeated.code,200);assert.equal(repeated.body.cae,first.body.cae);assert.equal(f.providerCalls,1);
 f.setRejectPatch(null);const other=f.page();await other.context.fbUpdate(other.context.fbRef(other.context.fbDB,'sisventas/ventas/v'),{notaConcurrente:'Conservar'});
 const linked=await f.send({accion:'vincular_emision',operacionId:first.body.emisionOperacionId});assert.equal(linked.code,200);assert.equal(linked.body.persistenciaPendiente,false);assert.equal(f.providerCalls,1);assert.equal(f.get('sisventas/ventas/v/factura').cae,first.body.cae);assert.equal(f.get('sisventas/ventas/v/notaConcurrente'),'Conservar');
});

test('Si falla guardar resultado y vincular, se devuelve el original y nunca se habilita una reemisión',async()=>{
 const f=fixture();f.failResultPersistence(2);f.setRejectPatch(patch=>{if(Object.keys(patch).some(path=>path.startsWith('sisventas/ventas/')))throw Error('Fallo ficticio');});
 const first=await f.send();assert.equal(first.code,200);assert.equal(first.body.cae,'CAE-FICTICIO-1');assert.equal(first.body.pdf_url,'https://provider.invalid/comprobante.pdf');assert.equal(first.body.persistenciaPendiente,true);assert.equal(first.body.vinculacionDisponible,false);
 assert.equal((await f.send()).code,409);assert.equal(f.providerCalls,1);assert.equal((await f.send({accion:'vincular_emision',operacionId:first.body.emisionOperacionId})).code,409);
});

test('Otra factura concurrente se conserva y la nueva autorización queda pendiente, nunca sobrescrita',async()=>{
 const f=fixture(),other=f.page();f.setProvider(async()=>{await other.context.fbUpdate(other.context.fbRef(other.context.fbDB,'sisventas/ventas/v'),{factura:{cae:'CAE-CONCURRENTE',numero:'1-999'}});return authorized();});
 const res=await f.send();assert.equal(res.code,200);assert.equal(res.body.persistenciaPendiente,true);assert.equal(f.get('sisventas/ventas/v/factura').cae,'CAE-CONCURRENTE');assert.equal(f.get('sv_fiscal_emissions/'+res.body.emisionOperacionId+'/resultado').cae,'CAE-FICTICIO-1');assert.equal(f.providerCalls,1);
});

test('NC conserva factura original; refacturación autorizada conserva ambas en historial y no se duplica',async()=>{
 const original=originalFiscal(),f=fixture({ventas:{v:{...sale(),factura:original}}});
 const nc=request();nc.esNotaCredito=true;nc.tipoComprobante='NOTA DE CREDITO B';nc.comprobante_asociado={tipo:'FACTURA B',punto_venta:1,numero:100,fecha:'01/10/2026'};f.setProvider(()=>authorized('CAE-NC'));
 const canceled=await f.send(nc);assert.equal(canceled.code,200);assert.equal(canceled.body.persistenciaPendiente,false);assert.deepEqual(f.get('sisventas/ventas/v/factura'),original);assert.equal(f.get('sisventas/ventas/v/notaCredito').cae,'CAE-NC');assert.equal(f.get('sisventas/ventas/v/facturaAnulada'),true);
 await f.send(nc);assert.equal(f.providerCalls,1);f.setProvider(()=>authorized('CAE-NUEVA'));
 const renewed=await f.send(request());assert.equal(renewed.code,200);assert.equal(renewed.body.cae,'CAE-NUEVA');assert.equal(f.get('sisventas/ventas/v/factura').cae,'CAE-NUEVA');assert.equal(f.get('sisventas/ventas/v/notaCredito'),null);assert.equal(f.get('sisventas/ventas/v/historialFiscal')[0].factura.cae,'CAE-ANTERIOR');assert.equal(f.get('sisventas/ventas/v/historialFiscal')[0].notaCredito.cae,'CAE-NC');
 await f.send(request());assert.equal(f.providerCalls,2);
});

test('La recuperación de una NC vuelve a validar el permiso específico del actor actual',async()=>{
 const original=originalFiscal(),f=fixture({ventas:{v:{...sale(),factura:original}}});
 f.setRejectPatch(patch=>{if(Object.keys(patch).some(path=>path.startsWith('sisventas/ventas/')))throw Error('Fallo ficticio');});
 const nc={...request(),esNotaCredito:true,tipoComprobante:'NOTA DE CREDITO B',comprobante_asociado:{tipo:'FACTURA B',punto_venta:1,numero:100,fecha:'01/10/2026'}};
 const first=await f.send(nc);assert.equal(first.code,200);assert.equal(first.body.persistenciaPendiente,true);
 f.state.sv_chat_roles.u.rol='administrativo';f.state.sv_permisos={administrativo:{acciones:{facturas:{notaCredito:false}}}};f.setRejectPatch(null);
 const resumed=await f.send({accion:'vincular_emision',operacionId:first.body.emisionOperacionId});assert.equal(resumed.code,403);assert.equal(f.providerCalls,1);assert.equal(f.get('sisventas/ventas/v/notaCredito'),null);
});

test('Dos requests simultáneos reservan un solo despacho fiscal',async()=>{
 const f=fixture();let release;const wait=new Promise(resolve=>{release=resolve;});let entered;const started=new Promise(resolve=>{entered=resolve;});
 f.setProvider(async()=>{entered();await wait;return authorized();});const first=f.send();await started;
 const second=await f.send();assert.equal(second.code,409);assert.equal(f.providerCalls,1);release();assert.equal((await first).code,200);
});

test('La llamada fiscal externa ocurre sin lease y la vinculación adquiere otro fence corto',async()=>{
 const f=fixture();f.setProvider(()=>{assert.equal(f.get('sv_labor_guard'),null,'El proveedor no retiene el fence global');return authorized();});
 const response=await f.send();assert.equal(response.code,200);assert.equal(f.commits.length,2);
 const receipts=f.commits.map(patch=>Object.keys(patch).find(path=>path.startsWith('sv_labor_receipts/')));assert.notEqual(receipts[0],receipts[1]);assert.equal(f.get('sv_labor_guard'),null);
});

function browser(f){
 const messages=[],dialogs=[],documents=[],requests=[],views=[];let loading=0;
 const c={window:null,console,Date,Promise,JSON,Number,Math,Object,Array,parseInt,parseFloat,URL,SISVENTAS_FUNCTIONS:{emitirFactura:'https://fiscal.invalid',frontendKey:'fixture-public'},SVServiceAuth:{headers:async value=>({...value,Authorization:'Bearer fixture-token'})},
  SisVentas:{carga:{mostrar(){loading++;return()=>{loading--;};}}},notify:message=>messages.push(message),_svCrearDialogoSistema:async options=>{dialogs.push(options);},_abrirFuentePdfFactura:(url,name)=>documents.push({url,name}),verFacturaEmitida:(...args)=>views.push(args),
  fetch:async(url,options)=>{assert.equal(url,'https://fiscal.invalid');assert.equal(options.headers.Authorization,'Bearer fixture-token');const body=JSON.parse(options.body);requests.push(body);const result=await f.send(body);return {ok:result.code>=200&&result.code<300,status:result.code,json:async()=>copy(result.body)};}
 };c.window=c;load(c,['mostrarVinculacionFiscalPendiente','vincularEmisionFiscalPendiente']);
 return {c,messages,dialogs,documents,requests,views,get loading(){return loading;}};
}

test('El aviso pendiente muestra original y vincula sólo ante el clic, conservando el resultado del servidor',async()=>{
 const f=fixture();f.setRejectPatch(patch=>{if(Object.keys(patch).some(path=>path.startsWith('sisventas/ventas/')))throw Error('Fallo ficticio');});const pending=(await f.send()).body,b=browser(f);
 await b.c.mostrarVinculacionFiscalPendiente(pending,'V-FICTICIA');assert.equal(b.requests.length,0);assert.equal(b.dialogs[0].centrado,true);assert.equal(b.dialogs[0].desplazable,true);assert.equal(b.dialogs[0].enlaces.length,2);
 b.dialogs[0].enlaces[0].abrir();assert.equal(b.documents[0].url,pending.pdf_url);assert.equal(b.requests.length,0);
 await b.dialogs[0].enlaces[1].abrir();assert.equal(b.requests.length,1);assert.deepEqual(b.requests[0],{accion:'vincular_emision',operacionId:pending.emisionOperacionId});assert.equal(b.dialogs.length,2);assert.equal(f.providerCalls,1);assert.equal(b.loading,0);
 f.setRejectPatch(null);await b.dialogs[1].enlaces[1].abrir();assert.equal(b.requests.length,2);assert.equal(f.providerCalls,1);assert.equal(b.views.length,1);assert.match(b.messages.at(-1),/vinculado/);assert.equal(b.loading,0);
});

test('Sin resultado durable, el aviso conserva el PDF y no ofrece un reintento de emisión ni de vinculación',async()=>{
 const f=fixture(),b=browser(f);await b.c.mostrarVinculacionFiscalPendiente({cae:'CAE-FICTICIO',pdf_url:'https://provider.invalid/original.pdf',persistenciaPendiente:true,vinculacionDisponible:false,emisionOperacionId:'a'.repeat(64)},'V-FICTICIA');
 assert.equal(b.dialogs[0].enlaces.length,1);assert.equal(b.dialogs[0].enlaces[0].texto,'Ver comprobante original');assert.equal(b.requests.length,0);assert.match(b.dialogs[0].mensaje,/no vuelvas a emitir/i);
});

test('emitirFactura del frontend conserva200 pendiente y no lo convierte en un error de emisión',async()=>{
 const f=fixture(),b=browser(f);f.setRejectPatch(patch=>{if(Object.keys(patch).some(path=>path.startsWith('sisventas/ventas/')))throw Error('Fallo ficticio');});
 Object.assign(b.c,{svValidarSalidaComercial:()=>true,TFAPP_CONFIG:{activo:true,provincia:'Buenos Aires',punto_venta:1,rubro:'Ficticio'},obtenerCuitClienteVenta:()=>'',obtenerRazonSocialClienteVenta:()=>'',prepararVentaParaFacturacion:venta=>({venta,totalEsperado:121}),importeComprobanteVenta:String,currentUser:'Titular ficticio',currentUserEmail:''});
 load(b.c,['emitirFactura']);const result=await b.c.emitirFactura(sale(),'FACTURA B');assert.equal(result.cae,'CAE-FICTICIO-1');assert.equal(result.persistenciaPendiente,true);assert.match(b.messages.at(-1),/no hace falta emitirlo otra vez/);assert.equal(f.providerCalls,1);
});

test('La confirmación pendiente se detiene antes de refacturar/reescribir la venta y ofrece la vinculación',async()=>{
 const f=fixture(),b=browser(f);let writes=0;
 const pending={cae:'CAE-FICTICIO',pdf_url:'https://provider.invalid/original.pdf',persistenciaPendiente:true,vinculacionDisponible:true,emisionOperacionId:'a'.repeat(64)};
 Object.assign(b.c,{ventasList:[sale()],_svTxtClave:value=>String(value||''),resolverClienteDeVenta:()=>null,document:{getElementById:()=>({remove(){}})},_obtenerTipoFacturaSeleccionado:()=> 'FACTURA B',emitirFactura:async()=>pending,_facturaEmisionPendiente:{v:{refacturar:true}},fbDB:{},fbUpdate:async()=>{writes++;throw Error('No guardar una autorización pendiente');}});
 load(b.c,['_svCargaOperacion_confirmarEmisionFactura']);await b.c._svCargaOperacion_confirmarEmisionFactura('v');assert.equal(writes,0);assert.equal(b.dialogs.length,1);assert.equal(b.views.length,0);assert.equal(b.requests.length,0);
});

test('Una venta cambiada en precio, cantidad, descuento o descripción se rechaza antes de despachar',async()=>{
 const changed=[
  {...sale(),items:[{...sale().items[0],punit:242}],totalFiscalEsperado:242,total:242},
  {...sale(),items:[{...sale().items[0],qty:2,punit:60.5}]},
  {...sale(),items:[{...sale().items[0],desc:'Descripción nueva'}]},
  {...sale(),subtotal:90,iva:18.9,conIva:true,descuento:10,total:108.9}
 ];
 for(const live of changed){const f=fixture({ventas:{v:live}}),before=copy(f.state.sisventas),res=await f.send();assert.equal(res.code,409);assert.match(res.body.mensaje,/venta.*cambi/i);assert.equal(f.providerCalls,0);assert.deepEqual(f.state.sisventas,before);assert.equal(f.get('sv_fiscal_emissions'),null);}
});

test('NC usa el importe fiscal original aun si cambió la venta comercial y bloquea otra factura asociada',async()=>{
 const original=originalFiscal();original.datos_fiscales.tipo='6';
 const f=fixture({ventas:{v:{...sale(),items:[{...sale().items[0],punit:999}],total:999,factura:original}}});
 const nc={...request(),esNotaCredito:true,tipoComprobante:'NOTA DE CREDITO B',comprobante_asociado:{tipo:'FACTURA B',punto_venta:1,numero:100,fecha:'01/10/2026'}};
 const incorrect=copy(nc);incorrect.comprobante_asociado.numero=999;assert.equal((await f.send(incorrect)).code,409);assert.equal(f.providerCalls,0);
 const correct=await f.send(nc);assert.equal(correct.code,200);assert.equal(correct.body.importe_total,121);assert.equal(f.get('sisventas/ventas/v/total'),999);assert.equal(f.providerCalls,1);
});

test('El estado de rechazo con CAE tampoco habilita reemisión automática',async()=>{
 const f=fixture();f.setProvider(()=>({ok:true,status:200,json:async()=>({error:'S',cae:'CAE-DEVUELTO-CON-AVISO',errores:['Verificar']})}));
 await f.send();const repeated=await f.send();assert.equal(repeated.code,409);assert.equal(f.providerCalls,1);
});

test('Tipo fiscal y bandera contradictorios se rechazan antes del permiso, fence o proveedor',async()=>{
 const invalid=[
  {tipoComprobante:'NOTA DE CREDITO B',esNotaCredito:false},
  {tipoComprobante:'FACTURA B',esNotaCredito:true},
  {tipoComprobante:'NOTA DE CREDITO B',esNotaCredito:'true'},
  {tipoComprobante:'NOTA DE DEBITO B'},
  {tipoComprobante:'FACTURA Z'},
  {tipoComprobante:{tipo:'FACTURA B'}}
 ];
 for(const change of invalid){
  const f=fixture(),input={...request(),...change};
  f.state.sv_chat_roles.u.rol='administrativo';f.state.sv_permisos={administrativo:{acciones:{facturas:{notaCredito:false}}}};
  const business=copy(f.state.sisventas),res=await f.send(input);
  assert.equal(res.code,400);assert.equal(f.providerCalls,0);assert.deepEqual(f.state.sisventas,business);assert.equal(f.commits.length,0);assert.equal(f.get('sv_fiscal_emissions'),null);
 }
});

test('Omitir la bandera de NC no evita el permiso específico y conserva el negocio',async()=>{
 for(const tipo of ['NOTA DE CREDITO A','NOTA DE CREDITO B','NOTA DE CREDITO C',3,8,13]){
  const f=fixture(),input={...request(),tipoComprobante:tipo};
  f.state.sv_chat_roles.u.rol='administrativo';f.state.sv_permisos={administrativo:{acciones:{facturas:{notaCredito:false}}}};
  const before=copy(f.state.sisventas),res=await f.send(input);
  assert.equal(res.code,403);assert.equal(f.providerCalls,0);assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);
 }
});

test('Los seis tipos actuales y sus códigos conservan clase fiscal canónica y las facturas admitidas',async()=>{
 const fiscal=require('../cloud-functions/emitir-factura/fiscal-contract.cjs');
 const types=[[1,'FACTURA A'],[6,'FACTURA B'],[11,'FACTURA C'],[3,'NOTA DE CREDITO A'],[8,'NOTA DE CREDITO B'],[13,'NOTA DE CREDITO C']];
 for(const [code,type]of types)for(const raw of [type,code,String(code).padStart(3,'0')]){
  const normalized=fiscal.normalizarSolicitudEmisionFiscal({tipoComprobante:raw},true);
  assert.equal(normalized.tipoComprobante,type);assert.equal(normalized.esNotaCredito,type.startsWith('NOTA DE CREDITO'));
 }
 for(const type of ['FACTURA A','FACTURA B','FACTURA C']){
  const f=fixture(),input={...request(),tipoComprobante:type};
  input.venta.clienteCuit='20111111112';input.venta.clienteRazonSocial='Cliente fiscal ficticio';
  f.state.sv_chat_roles.u.rol='administrativo';
  const res=await f.send(input);assert.equal(res.code,200);assert.equal(res.body.tipo,type);assert.equal(f.providerCalls,1);
 }
});

test('El puente fiscal también impide una clase contradictoria antes de reservar',async()=>{
 const f=fixture(),data={...request(),tipoComprobante:'NOTA DE CREDITO B',esNotaCredito:false};
 await assert.rejects(f.bridge.begin({data,provider:{comprobante:{tipo:'NOTA DE CREDITO B'}}}),error=>error.statusCode===400);
 await assert.rejects(f.bridge.begin({data:request(),provider:{comprobante:{tipo:'NOTA DE CREDITO B'}}}),error=>error.statusCode===400);
 assert.equal(f.commits.length,0);assert.equal(f.get('sv_fiscal_emissions'),null);
});

module.exports={fixture,request,sale,authorized};
