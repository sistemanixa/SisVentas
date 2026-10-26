'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
const {readActiveApp}=require('./active-app');
const {createLaborGuard}=require('../../cotizador/labor-guard');
const {createLaborWriteGateway}=require('../../cotizador/labor-write-gateway');
const Index=require('../../cotizador/labor-index');
const active=readActiveApp();
const copy=value=>value==null?null:structuredClone(value);
const at=(root,path)=>path.split('/').filter(Boolean).reduce((value,key)=>value&&Object.hasOwn(value,key)?value[key]:null,root)??null;
function apply(root,patch){for(const [path,value]of Object.entries(patch)){const keys=path.split('/'),last=keys.pop();let node=root;for(const key of keys){if(!Object.hasOwn(node,key)||!node[key]||typeof node[key]!=='object')Object.defineProperty(node,key,{value:{},enumerable:true,configurable:true,writable:true});node=node[key];}if(value===null)delete node[last];else Object.defineProperty(node,last,{value:copy(value),enumerable:true,configurable:true,writable:true});}}
function load(context,names){const source=active.source;for(const name of names){const expression=new RegExp('^(?:async )?function '+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\(', 'm'),match=expression.exec(source);assert.ok(match,'Función activa: '+name);const tail=source.slice(match.index+match[0].length),next=/\n(?:async )?function [\w$]+\(/.exec(tail),chunk=source.slice(match.index,next?match.index+match[0].length+next.index:source.length);vm.runInContext(chunk,context,{filename:active.filename+':'+name});}}
function createBackend(initial={}){
 const state={sisventas:{empleados:{e:{nombre:'Persona ficticia',activo:true,cargoId:'c'}},gastos:{},ctaemp:{e:{}},ventas:{v:{id:'V-FICTICIA',fbKey:'v',comisionHabilitada:true,subtotal:2000,costoTotal:1000}},haberes:{},config:{maxComisionPct:10,cargos:{c:{valorHora:100}}},sentinel:{privado:'Conservar'},...copy(initial)},sv_labor_config:{ready:true,schema:1},sv_chat_roles:{u:{activo:true,rol:'admin'}}};
 apply(state,Index.buildIndex(state.sisventas));let sequence=0,hook=null,rejectPatch=null;
 const reads=[],commits=[],commands=[],direct=[],tokens={u:{uid:'u',name:'Titular ficticio',passwordAccessVersion:1}};
 const store={
  async read(path){assert.notEqual(path,'sisventas','No descargar la base completa');reads.push(['server',path]);return copy(at(state,path));},
  async readAsUser(path,actor){assert.ok(tokens[actor.uid]);reads.push(['user',path]);return copy(at(state,path));},
  async acquire(lease){assert.equal(state.sv_labor_guard??null,null);state.sv_labor_guard=copy(lease);},
  async commit(patch,lease,actor){assert.equal(state.sv_labor_guard?.fence,lease.fence);assert.ok(lease.expiresAt>Date.now());if(actor.mode!=='server')assert.equal(state.sv_chat_roles[actor.uid]?.activo,true);else assert.equal(actor.uid,'sv-labor-service');assert.equal(patch.sv_labor_guard,null);assert.ok(patch['sv_labor_receipts/'+lease.opId]);if(rejectPatch)await rejectPatch(patch,actor);commits.push(copy(patch));apply(state,patch);},
  async abort(lease){if(state.sv_labor_guard?.fence===lease.fence)delete state.sv_labor_guard;}
 };
 const guard=createLaborGuard({store,uuid:()=> 'fixture-guard-'+(++sequence),delay:async()=>{}}),auth={verifyIdToken:async(token,revoked)=>{assert.equal(revoked,true);assert.equal(token,'fixture-token');return tokens.u;}},db={ref:path=>({get:async()=>({val:()=>copy(at(state,path))})})};
 const gateway=createLaborWriteGateway({auth,db,store,guard,enabled:true});
 function page(){
  const nodes=new Map(),messages=[];let holds=0;
  const node=id=>{if(!nodes.has(id))nodes.set(id,{id,value:'',dataset:{},style:{},innerHTML:'',textContent:'',disabled:false,isConnected:true,remove(){this.isConnected=false;},classList:{add(){},remove(){},toggle(){}}});return nodes.get(id);};
  const ref=(_,path='')=>({key:path.split('/').filter(Boolean).at(-1)||null,toString:()=> 'https://fixture.invalid/'+path});
  const sdk={ref,async get(r){const path=new URL(r.toString()).pathname.replace(/^\//,'');assert.notEqual(path,'sisventas');reads.push(['client',path]);const value=copy(at(state,path));return {val:()=>copy(value),exists:()=>value!==null,key:r.key};},
   set(){direct.push('set');throw Error('No guardar directamente');},update(){direct.push('update');throw Error('No guardar directamente');},remove(){direct.push('remove');throw Error('No guardar directamente');},runTransaction(){direct.push('transaction');throw Error('No guardar directamente');},
   push(r){const child=ref(null,new URL(r.toString()).pathname.slice(1)+'/fixture-push-'+(++sequence));return child;}
  };
  const context={URL,TextEncoder,Uint8Array,AbortSignal,Promise,console,Date,Math,Set,Map,WeakMap,Number,Object,Array,JSON,String,parseFloat,parseInt,setTimeout,clearTimeout,fbDB:{},fbAuth:{currentUser:{uid:'u'}},currentUserUid:'u',currentUser:'Titular ficticio',currentRole:'admin',PERMISOS_ROLES:{admin:{indiceRevision:1}},
   crypto:{subtle:crypto.webcrypto.subtle,randomUUID:()=> 'fixture-browser-'+(++sequence)},SVForegroundSession:{holdDatabase(){holds++;return()=>{holds--;};}},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://gateway.invalid'},SVServiceAuth:{headers:async headers=>({...headers,Authorization:'Bearer fixture-token'})},
   document:{getElementById:node,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},notify:message=>messages.push(message),tienePermiso:()=>true,permisoModulo:()=>true,svFechaLocalISO:()=> '2026-10-20',_habRegistroEnCurso:false,_comisionManualGuardando:false,_gastosPagosCache:new WeakMap(),APROBACION_CONFIG:{maxComisionPct:10},ctaEmpActual:null,
   SisVentas:{carga:{mostrar:()=>()=>{}}},empData:{e:{fbKey:'e',nombre:'Persona ficticia',cargoId:'c'}},_habFilasActuales:[],gastosData:[],ventasList:[],_comisionManualVentasMap:{},_gastosFechaImputacionCache:new WeakMap(),
   fetch:async(url,options)=>{assert.equal(url,'https://gateway.invalid/laboral/escritura');const command=JSON.parse(options.body);commands.push(copy(command));try{if(hook)await hook(command);const actor=await gateway.authorize({method:'POST',url:'/laboral/escritura',headers:{authorization:options.headers.Authorization}});const result=await gateway.write(actor,command);return {ok:true,status:200,json:async()=>copy(result)};}catch(error){return {ok:false,status:error.statusCode||503,json:async()=>({ok:false,code:error.code,mensaje:error.message})};}}
  };
  context.window=context;context.fbGet=sdk.get;context.fbRef=ref;
  vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../../js/core/labor-writes.js'),'utf8'),context);context.SVLaborWrites.install({sdk});
  load(context,['rolActualNormalizado','svEsAdministradorFinanciero','svRevisionVistaLaboral','svComandoCuentaEmpleado','svComandoGastos','svComprobanteComandoGasto']);
  load(context,['_adelantoMesSiguiente','_adelantoPeriodoDescuento','_adelantoDescontableEnMes']);
  load(context,['_gastoEstaRetirado','_gastoTieneHistoriaLiquidada','_pagableNormFecha','_pagableNormMonto','_pagableEstadoPendiente','_pagableGastoBase','_claveOperacionConcurrente','pagoGastoEstaAnulado','_gastoPagosArray','totalPagadoGasto','normalizarEstadoGasto','_normalizarComprobantePagoGasto','_movimientosVinculadosGasto','_actualizarCtaEmpPorPagoGasto','_registrarPagosGastosAtomico','_registrarPagoGastoUnitario','_calcularBaseComisionVenta','_generarComisionVentaAtomica','_guardarAguinaldosAtomico']);
  load(context,['_pagoGastoToken','_pagoGastoResumenSimulado','_esGastoAdelanto','_persistirAjustePagoGasto','_svCargaOperacion__persistirAjustePagoGasto','_adelantoEsEntregaLegacy','_adelantoMontoEntregado','_normalizarAdelantoLegacyAlAplicar','_habAdelantoDisponibleRaw','_habPrepararCompensacion','_habDetalleAplicaciones','_registrarHaberesAtomico','_svCargaOperacion_confirmarRegistroHaberes','_bonificacionMesValido','_bonificacionPeriodoComputo','_guardarBonificacionEmpleadoAtomica']);
  load(context,['_movEmpPagosArray','_gastoLaboralDesdeMovimiento','_guardarMovimientoVinculadoAtomico','_crearGastoAdelantoDesdeMovimiento','_crearGastoEmpresaDesdeMovimiento','_buscarEmpleadoPorKeyCta','_comisionNormFecha','_estadoGastoComisionDesdeMovimiento','_crearGastoComisionDesdeMovimiento','_cambiarEstadoGastoVinculadoAtomico']);
  return {context,nodes,node,messages,get holds(){return holds;},load:names=>load(context,names),refresh(){context.gastosData=Object.entries(state.sisventas.gastos||{}).map(([fbKey,g])=>({...copy(g),fbKey}));context.ventasList=Object.entries(state.sisventas.ventas||{}).map(([fbKey,v])=>({...copy(v),fbKey}));}};
 }
 return {state,store,guard,gateway,reads,commits,commands,direct,page,get:path=>copy(at(state,path)),setHook:fn=>{hook=fn;},setRejectPatch:fn=>{rejectPatch=fn;}};
}
module.exports={createBackend,load,copy,apply};
