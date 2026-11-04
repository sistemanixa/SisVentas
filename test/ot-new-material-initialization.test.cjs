'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const workflow=fs.readFileSync(require.resolve('../js/modules/ot-workflow.js'),'utf8'),clone=value=>structuredClone(value);
function fixture({save,raw=false}={}){
 let number=0;const writes=[],ctx={document:{getElementById:()=>null,querySelectorAll:()=>[],addEventListener(){}},structuredClone,setTimeout:()=>0,clearTimeout(){},Promise,console,FB_PATHS:{ordenesTrabajo:'sisventas/ordenes_trabajo'},otData:[],fbDB:{},fbRef:(_,path)=>path,fbRunTransaction:async()=>({snapshot:{val:()=>++number}}),tienePermiso:()=>true};ctx.window=ctx;
 async function persist(record){writes.push(clone(record));if(save)return save(record);return {...clone(record),fbKey:'new-'+number,_svListRevision:1,_svListOperation:'confirmed-'+number};}
 if(raw)ctx.fbPush=async(_ref,record)=>{await persist(record);return {key:'new-'+number};};else ctx.otPersistirGuardar=persist;
 vm.createContext(ctx);vm.runInContext(workflow,ctx);return {ctx,writes};
}
const material=(extra={})=>({cod:'P-FICTICIO',vendida:0.001,instalada:0,costoUnitarioCompra:17.123456,punit:39.87654,...extra});
test('new rows get explicit zeros once, retain costs/quantities and return the saved revision without sharing source rows',async()=>{
 const f=fixture(),source=[material()],before=clone(source),input={estado:'pendiente',materiales:source,audit:[{accion:'OT creada desde venta'}]};const result=await f.ctx.crearRegistroOTSeguro(input);
 assert.deepEqual(source,before);assert.equal(source[0].entregada,undefined);assert.notEqual(input.materiales,source);assert.notEqual(input.materiales,result.record.materiales);assert.equal(result.record.materiales[0].entregada,0);assert.equal(result.record.materiales[0].devuelta,0);assert.equal(input.materiales[0].entregada,0);assert.equal(result.record._svListRevision,1);assert.equal(result.record._svListOperation,'confirmed-1');assert.equal(result.record.id,'OT-001');assert.equal(result.record.materiales[0].vendida,0.001);assert.equal(result.record.materiales[0].costoUnitarioCompra,17.123456);assert.equal(result.record.materiales[0].punit,39.87654);assert.equal(result.record.remitosEntrega,undefined);assert.equal(result.record.materiales[0].stockRegistro,undefined);
 assert.equal(input._svListRevision,1);assert.equal(input._svListOperation,'confirmed-1');result.record.materiales[0].vendida=99;assert.equal(input.materiales[0].vendida,0.001);assert.equal(f.writes[0].materiales[0].vendida,0.001);
});
test('existing identities, cloned histories and recovered lines retain every quantity and missing field',async()=>{
 for(const identity of [{id:'OT-ANTERIOR'},{fbKey:'old'},{key:'old'},{_firebaseKey:'old'},{_arrayIndex:0},{_svListRevision:0},{_svReadRevision:1}]){
  const f=fixture(),input={...identity,id:'OT-ANTERIOR',materiales:[material()]},before=clone(input),result=await f.ctx.crearRegistroOTSeguro(input);assert.deepEqual(result.record.materiales,before.materiales);assert.deepEqual(input,before);
 }
 for(const evidence of [{entregada:0},{devuelta:0},{entregada:2,devuelta:1},{custodiaActiva:false},{estadoCustodia:''},{stockRevision:0},{stockRegistro:'receipt'},{stockPendiente:false},{origenMaterialHistorico:'items:0'},{_recuperado:true},{_recuperado:false},{enTecnico:0},{devueltaPendiente:0},{entregadoEn:123},{audit:[]},{origen:'historico'},{instalada:0.001},{instalada:'0'},{instalada:null},{cantidadInstalada:1},{vendida:'2'},{vendida:2,qty:3}]){
  const f=fixture(),row=material(evidence),result=await f.ctx.crearRegistroOTSeguro({materiales:[row]});assert.deepEqual(result.record.materiales[0],row,JSON.stringify(evidence));
 }
 const f=fixture(),missing=material();delete missing.instalada;const result=await f.ctx.crearRegistroOTSeguro({materiales:[missing]});assert.deepEqual(result.record.materiales[0],missing);
});
test('a mixed new order initializes only its clean row, without altering shared historical or recovered input',async()=>{
 const f=fixture(),source=[material(),material({_recuperado:true,origenMaterialHistorico:'items:0'}),material({entregada:3,devuelta:0.001,stockRegistro:'legacy'})],before=clone(source),input={materiales:source},result=await f.ctx.crearRegistroOTSeguro(input);
 assert.equal(result.record.materiales[0].entregada,0);assert.equal(result.record.materiales[0].devuelta,0);assert.deepEqual(result.record.materiales.slice(1),before.slice(1));assert.deepEqual(source,before);assert.notEqual(input.materiales,source);
});
test('order custody, stock, embedded history and non-creation audit prevent any initialization',async()=>{
 for(const evidence of [{remitosEntrega:{}},{custodiaIniciada:false},{stock:{cantidad:0}},{historial:[]},{items:[material()]},{estado:'en_proceso'},{progreso:1},{audit:[{accion:'Generado remito de entrega'}]},{audit:[{accion:'Titularidad transferida'}]}]){
  const f=fixture(),input={materiales:[material()],...evidence},before=clone(input.materiales),result=await f.ctx.crearRegistroOTSeguro(input);assert.deepEqual(result.record.materiales,before,JSON.stringify(evidence));
 }
});
test('failed persistence and missing key preserve all original evidence and do not publish initialized materials',async()=>{
 for(const save of [async()=>{throw Error('Rechazado');},async()=>({})]){
  const f=fixture({save}),source=[material(),material({stockRegistro:'original',entregada:2,devuelta:1})],input={materiales:source},before=clone(input);await assert.rejects(f.ctx.crearRegistroOTSeguro(input,{evitarDoble:true}));assert.deepEqual(input,before);assert.equal(input.materiales,source);assert.equal(f.ctx._otCreacionEnCurso,null);assert.equal(f.writes.length,1);
 }
});
test('concurrent creation retains the same promise/counter/write and raw push returns coherent data',async()=>{
 let release;const f=fixture({save:record=>new Promise(resolve=>{release=()=>resolve({...clone(record),fbKey:'new'});})}),input={materiales:[material()]};const a=f.ctx.crearRegistroOTSeguro(input,{evitarDoble:true}),b=f.ctx.crearRegistroOTSeguro(input,{evitarDoble:true});assert.equal(a,b);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.writes.length,1);release();const result=await a;assert.equal(result.key,'new');assert.equal(result.record.materiales[0].devuelta,0);assert.equal(f.ctx._otCreacionEnCurso,null);
 const g=fixture({raw:true}),raw=await g.ctx.crearRegistroOTSeguro({materiales:[material()]});assert.equal(raw.key,'new-1');assert.equal(raw.record.materiales[0].entregada,0);assert.equal(raw.record.remitosEntrega,undefined);
});
test('real creator followed by actual technician assignment keeps explicit zeros through the coordinated gateway',async()=>{
 const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs'),{load,apply}=require('./helpers/labor-ui-flow.cjs'),Lists=require('../js/core/record-list-model'),Operational=require('../js/core/operational-writes'),Labor=require('../js/core/labor-writes');
 const backend=await createCoordinatedBackend({ventas:{},pagos:{},ordenes_trabajo:{},clientes:{c:{id:'C-FICTICIO',nombre:'Cliente ficticio'}}}),page=backend.page(),ctx=page.context;let counter=0;
 apply(backend.state,{sv_record_list_config:{schema:1,ready:true}});ctx.structuredClone=structuredClone;ctx.setTimeout=()=>0;ctx.clearTimeout=()=>{};ctx.FB_PATHS={ordenesTrabajo:'sisventas/ordenes_trabajo'};ctx.otData=[];ctx.CHECKLISTS={};ctx.document.getElementById=()=>null;
 const sdk={ref:ctx.fbRef,get:ctx.fbGet,set(){assert.fail('SDK set');},update(){assert.fail('SDK update');},remove(){assert.fail('SDK remove');},push(){assert.fail('SDK push');},runTransaction(){assert.fail('SDK transaction');}};
 ctx.SVClientAccountHost={start:async()=>true,prepareWrite:async()=>true,coordinated:()=>true};ctx.SVRecordListWrites=Operational.create(ctx,Lists);ctx.SVRecordListWrites.install({sdk});ctx.SVLaborWrites=Labor.create(ctx);ctx.SVLaborWrites.install({sdk});
 ctx.fbRunTransaction=async ref=>{assert.match(String(ref),/contadores\/ordenTrabajo$/);return {snapshot:{val:()=>++counter}};};
 ctx.otPersistirGuardar=async record=>{const path='sisventas/ordenes_trabajo/new';const result=await ctx.SVRecordListWrites.records([path],values=>({...values,[path]:clone(record)}));return {...result.values[path],fbKey:'new'};};
 ctx.fbGuardarOT=async record=>{const path='sisventas/ordenes_trabajo/'+record.fbKey;return ctx.SVRecordListWrites.records([path],values=>({...values,[path]:{...values[path],...clone(record)}}));};
 vm.runInContext(workflow,ctx);load(ctx,['cambiarTecnicoOT']);ctx.svConsultarDisponibilidadVacaciones=async()=>{};ctx.periodoVacacionesPara=()=>null;ctx.ventaDetalleOTFinalizada=()=>false;ctx.svConfirm=async()=>true;ctx.otHuellaDetalle=()=> 'huella';
 const source=[material()],input={estado:'pendiente',clienteFbKey:'c',responsableUid:'u',materiales:source,audit:[{accion:'OT creada desde venta'}]},before=clone(source),result=await ctx.crearRegistroOTSeguro(input);input.fbKey=result.key;ctx.otData=[input];ctx.otActualId=result.key;
 const select={value:'Persona ficticia',dataset:{previousValue:''},disabled:false};assert.equal(await ctx.cambiarTecnicoOT(select),true);const saved=backend.get('sisventas/ordenes_trabajo/new');assert.equal(saved.tecnico,'Persona ficticia');assert.equal(saved.materiales[0].entregada,0);assert.equal(saved.materiales[0].devuelta,0);assert.equal(saved._svListRevision,2);assert.equal(saved.audit.length,2);assert.deepEqual(source,before);assert.equal(backend.commands.length,2);assert.equal(backend.commits.length,2);assert.equal(saved.remitosEntrega,undefined);assert.equal(saved.materiales[0].stockRegistro,undefined);assert.equal(backend.get('sv_client_history/v1/coverage/all/ordenes_trabajo/originalRecords'),1);
});
test('creator original object in otData prepares and saves custody through real client, service and guard',async()=>{
 const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs'),{apply}=require('./helpers/labor-ui-flow.cjs'),Lists=require('../js/core/record-list-model'),Operational=require('../js/core/operational-writes'),Labor=require('../js/core/labor-writes');
 const sale={id:'V-FICTICIA',clienteFbKey:'c',responsableUid:'u',total:100,subtotal:100,estadoInst:'en_instalacion',otId:'new',items:[{cod:'P-FICTICIO',qty:1,punit:100,sub:100,costoUnitarioCompra:17}]};
 const backend=await createCoordinatedBackend({ventas:{s:sale},pagos:{},ordenes_trabajo:{},productos:{p:{codigo:'P-FICTICIO',nombre:'Producto ficticio'}},clientes:{c:{id:'C-FICTICIO',nombre:'Cliente ficticio'}}}),ctx=backend.page().context;
 apply(backend.state,{sv_record_list_config:{schema:1,ready:true},sv_operational_read_config:{schema:1,ready:true},'sv_labor_config/otLifecycleVersion':1,'sv_permisos/admin':{indiceVersion:2,indiceRevision:1,indiceModulos:{ordentrabajo:true,venta:true,detalle:true},acciones:{ot:{rendirMateriales:true}}}});
 backend.store.query=async(path,field,value)=>Object.fromEntries(Object.entries(backend.get(path)||{}).filter(([,row])=>row[field]===value));
 apply(backend.state,{'sisventas/listados_resumen/ordenes_trabajo/_svCoverage':{schema:1,ready:true,baselineCount:0,sourceHash:require('../cotizador/labor-guard').digest({})}});
 ctx.structuredClone=structuredClone;ctx.setTimeout=()=>0;ctx.clearTimeout=()=>{};ctx.FB_PATHS={ordenesTrabajo:'sisventas/ordenes_trabajo'};ctx.otData=[];ctx.CHECKLISTS={};ctx.document.getElementById=()=>null;
 const sdk={ref:ctx.fbRef,get:ctx.fbGet,set(){assert.fail('SDK set');},update(){assert.fail('SDK update');},remove(){assert.fail('SDK remove');},push(){assert.fail('SDK push');},runTransaction(){assert.fail('SDK transaction');}};
 ctx.SVClientAccountHost={start:async()=>true,prepareWrite:async()=>true,coordinated:()=>true};ctx.SVRecordListWrites=Operational.create(ctx,Lists);ctx.SVRecordListWrites.install({sdk});ctx.SVLaborWrites=Labor.create(ctx);ctx.SVLaborWrites.install({sdk});ctx.fbRunTransaction=async()=>({snapshot:{val:()=>1}});
 ctx.otPersistirGuardar=async record=>{const path='sisventas/ordenes_trabajo/new',result=await ctx.SVRecordListWrites.records([path],values=>({...values,[path]:clone(record)}));return {...result.values[path],fbKey:'new'};};
 const server=require('../cotizador/ot-lifecycle').createOTLifecycle({db:{ref:path=>({get:async()=>({val:()=>backend.get(path)})})},store:backend.store,guard:backend.guard,enabled:true,commercialPages:true}),regularFetch=ctx.fetch;let prepares=0,saves=0;
 ctx.fetch=async(url,options)=>{const target=new URL(url);if(!target.pathname.startsWith('/ot/ciclo'))return regularFetch(url,options);const actor={uid:'u',claims:{uid:'u'}};if(target.pathname.endsWith('/disponible')){prepares++;const data=await server.available(actor,{otKey:target.searchParams.get('otKey'),kind:target.searchParams.get('kind')});return {ok:true,status:200,json:async()=>data};}saves++;const data=await server.execute(actor,JSON.parse(options.body));return {ok:true,status:200,json:async()=>data};};
 vm.runInContext(workflow,ctx);const source=[material()],before=clone(source),input={estado:'pendiente',ventaFbKey:'s',ventaId:'V-FICTICIA',clienteFbKey:'c',responsableUid:'u',materiales:source,audit:[{accion:'OT creada desde venta'}]},created=await ctx.crearRegistroOTSeguro(input);
 input.fbKey=created.key;ctx.otData.push(input);assert.equal(ctx.otData[0],input);assert.notEqual(ctx.otData[0],created.record);
 ctx.SVOTLifecycle=require('../js/modules/ot-lifecycle').create(ctx);await ctx.SVOTLifecycle.prepare(ctx.otData[0],{kind:'custody'});const saved=await ctx.SVOTLifecycle.save(ctx.otData[0],ctx.otData[0],{kind:'custody',action:'Guardar custodia ficticia sin movimientos'});
 assert.equal(prepares,1);assert.equal(saves,1);assert.equal(saved.confirmed,true);assert.equal(saved.ot._svListRevision,2);assert.equal(input._svListRevision,1);assert.equal(input._svListOperation,created.record._svListOperation);assert.equal(backend.commits.length,2);assert.deepEqual(source,before);assert.deepEqual(saved.ot.materiales,created.record.materiales);assert.equal(saved.ot.remitosEntrega,undefined);assert.equal(saved.ot.materiales[0].stockRegistro,undefined);assert.equal(input.materiales[0].costoUnitarioCompra,17.123456);
});
