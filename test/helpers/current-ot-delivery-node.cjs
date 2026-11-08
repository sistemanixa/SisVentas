'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const {createCoordinatedBackend}=require('./coordinated-backend.cjs'),{apply}=require('./labor-ui-flow.cjs');
const Operational=require('../../js/core/operational-writes'),Records=require('../../js/core/record-list-model'),Labor=require('../../js/core/labor-writes');
const root=path.resolve(__dirname,'../..');
async function fixture({coordinated=true}={}){
 const material={cod:'P-FICTICIO',desc:'Producto ficticio',productoKey:'p',unidad:'unidades',vendida:3,entregada:0,instalada:0,devuelta:0,custodiaActiva:false};
 const ot={id:'OT-FICTICIA',clienteFbKey:'c',ventaFbKey:'s',ventaId:'V-FICTICIA',tecnico:'Técnico ficticio',estado:'en_curso',materiales:[material],audit:[]};
 const sale={id:'V-FICTICIA',otId:'ot',estadoInst:'pendiente',fecha:'2026-10-20',clienteFbKey:'c',responsableUid:'u',total:300,subtotal:300,iva:0,conIva:false,items:[{cod:material.cod,qty:3,punit:100,sub:300,costoUnitarioCompra:10,costoTotalCompra:30,codigo:material.cod,productoKey:'p',productoFbKey:'p',costoUnitarioPresupuestado:10,costoTotalPresupuestado:30,costoVersion:1}]};
 const item={codigo:material.cod,productoKey:'p',descripcion:'Producto ficticio',cantidadOrdenada:3,cantidadRecibida:0,costoUnitario:10},order={numero:'OC-CHAIN',ventaFbKey:'s',ventaId:sale.id,estado:'ordenada',items:[item],recepciones:[]};
 const f=await createCoordinatedBackend({ventas:{s:sale},pagos:{pay:{ventaFbKey:'s',monto:40,fecha:sale.fecha}},ordenes:{o:order},ordenes_trabajo:{ot},inventario_operativo:{p:{general:4,reservado:5,consumido:0,enCompra:3,_svReadRevision:1,asignaciones:{foreign:{reservado:5,consumido:0}}}},comisiones:{sentinel:{monto:7}},productos:{p:{codigo:material.cod,nombre:'Producto ficticio',unidad:'unidades'}}});
 // Reuse only the existing Node receipt helper. Never call its browser fixture.
 const file=require.resolve('./commercial-partial-chain.cjs'),text=fs.readFileSync(file,'utf8'),Module=require('node:module'),receiptModule=new Module(file,module);
 receiptModule.filename=file;receiptModule.paths=Module._nodeModulePaths(path.dirname(file));receiptModule._compile(text+'\nmodule.exports={receivePurchase};',file);
 const purchase=await receiptModule.exports.receivePurchase(f,order,item,{loseInventoryAck:true});
 apply(f.state,{'sv_record_list_config':{schema:1,ready:true},'sv_labor_config/otLifecycleVersion':1,'sv_operational_read_config':{schema:1,ready:true,generation:'chain-stock'},'sv_permisos/admin':{indiceVersion:2,indiceRevision:1,indiceModulos:{ordentrabajo:true},acciones:{ot:{entregarMateriales:true,rendirMateriales:true,corregirMateriales:true}}}});
 apply(f.state,{[Records.index+'/ordenes_trabajo']:{_svCoverage:{schema:1,ready:true,baselineCount:1,sourceHash:require('../../cotizador/labor-guard').digest({ot:f.get('sisventas/ordenes_trabajo/ot')})},ot:Records.summary('ordenes_trabajo',f.get('sisventas/ordenes_trabajo/ot'))}});
 let sequence=0;const notes=[],commands=[],sdkPatches=[];
 const ref=(_,p='')=>({path:p,key:p.split('/').at(-1)||null,toString:()=> 'https://fixture.invalid/'+p});
 const sdk={ref,get:async r=>({val:()=>f.get(r.path)}),update:async(r,patch)=>{assert.equal(r.path,'');sdkPatches.push(structuredClone(patch));apply(f.state,patch);},set(){assert.fail('No raw set');},remove(){assert.fail('No raw remove');},push(){assert.fail('No raw push');},runTransaction(){assert.fail('No raw transaction');}};
 const w={otData:[{...f.get('sisventas/ordenes_trabajo/ot'),fbKey:'ot'}],otActualId:'ot',prodData:{p:f.get('sisventas/productos/p')},currentUser:'Ficticio',currentUserUid:'u',currentRole:'admin',PERMISOS_ROLES:f.state.sv_permisos,fbAuth:{currentUser:{uid:'u'}},fbDB:{},fbRef:ref,fbGet:sdk.get,crypto:{subtle:webcrypto.subtle,randomUUID:()=> 'delivery-node-'+(++sequence)},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},SVServiceAuth:{headers:async()=>({Authorization:'Bearer fixture-token'})},tienePermiso:()=>true,permisoModulo:()=>true,notify:m=>notes.push(m),svConfirm:async()=>true,scrollTo(){},SVClientAccountHost:{coordinated:()=>coordinated,start:async()=>coordinated,prepareWrite:async()=>coordinated},fetch:async(url,options)=>{assert.equal(url,'https://fixture.invalid/laboral/escritura');const body=JSON.parse(options.body);commands.push(body);const actor=await f.gateway.authorize({method:'POST',url:'/laboral/escritura',headers:{authorization:'Bearer fixture-token'}});try{const data=await f.gateway.write(actor,body);return{ok:true,status:200,json:async()=>data};}catch(error){return{ok:false,status:error.statusCode||503,json:async()=>({code:error.code,mensaje:error.message})};}}};
 w.SVCommercialMoney=require('../../js/core/commercial-money.v1');
 w.SVRecordListWrites=Operational.create(w,Records);w.SVRecordListWrites.install({sdk});
 w.SVLaborWrites=Labor.create(w);w.SVLaborWrites.install({sdk:{...sdk,set:w.fbSet,update:w.fbUpdate,push:w.fbPush,remove:w.fbRemove,runTransaction:w.fbRunTransaction}});
 const moduleContext={window:w,document:{getElementById:()=>null,documentElement:{},body:{},addEventListener(){}},requestAnimationFrame:()=>{}};vm.createContext(moduleContext);vm.runInContext(fs.readFileSync(path.join(root,'js/core/guarded-writes.js'),'utf8'),moduleContext);vm.runInContext(fs.readFileSync(path.join(root,'js/modules/ot-material-custody.js'),'utf8'),moduleContext);
 return{...f,w,document:moduleContext.document,purchase,notes,commands,sdkPatches};
}
module.exports={fixture};
