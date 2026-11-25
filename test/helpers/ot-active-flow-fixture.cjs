'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{webcrypto}=require('node:crypto'),Fixture=require('./ot-performance-fixture.cjs'),Physical=require('../../cotizador/ot-physical-confirmation-model'),Index=require('../../cotizador/record-list-model');
async function create({latency=0,productCount=641,otherCount=1100,rowCount=12,lifecycleModule,clientLifecycle}={}){
 const f=await Fixture.create({latency,rowCount,otherCount,lifecycleModule,tracePhases:true,prepare:data=>{
  const ot=data.sisventas.ordenes_trabajo.ot;for(const [i,row]of ot.materiales.entries()){const key='product'+i,result=Physical.confirm({actor:{uid:'u',role:'admin',allowed:true},otKey:'ot',rowKey:String(i),productKey:key,allocation:'sale',operationId:'fixture-prior-delivery',at:1792530000000,kind:'delivery',beforeDelivered:0,targetDelivered:2,beforeInstalled:0,targetInstalled:0,heldByOthers:0,revision:0,inventory:{general:10,reservado:0,consumido:0,asignaciones:{sale:{reservado:0,consumido:0}}}});Object.assign(row,{productoKey:key,stockRegistro:result.receipt,stockRevision:result.revision});data.sisventas.inventario_operativo[key]=result.inventory;data.sisventas.productos[key].id=1000+i;}
  for(let i=rowCount;i<productCount;i++)data.sisventas.productos['extra'+i]={id:2000+i,codigo:'EXTRA'+i,unidad:'unidades'};data.sisventas.listados_resumen.ordenes_trabajo.ot=Index.summary('ordenes_trabajo',ot);
 }});
 const client=[],storage=new Map(),user={uid:'u',getIdToken:async()=> 'FICTION_ONLY'},document=new EventTarget(),root={currentUserUid:'u',currentRole:'admin',fbAuth:{currentUser:user},fbDB:{},crypto:webcrypto,setTimeout,clearTimeout,document,CustomEvent:class extends Event{constructor(type){super(type);}},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fbRef:(_,p)=>p};let lostAck=false;
 const wait=async()=>{if(latency)await new Promise(resolve=>setTimeout(resolve,latency));};
 root.fbGet=async p=>{client.push({kind:'SDK',path:p});await wait();return{val:()=>f.get(p)};};
 root.fetch=async(url,options={})=>{const u=new URL(url);if(u.hostname!=='fixture.invalid')throw Error('No external fixture requests');client.push({kind:options.method||'GET',path:u.pathname});await wait();let data;try{
  if(u.pathname==='/ot/ciclo/disponible')data=await f.api.available(f.identity,{otKey:u.searchParams.get('otKey'),kind:u.searchParams.get('kind')});
  else if(u.pathname==='/ot/ciclo'){data=await f.api.execute(f.identity,JSON.parse(options.body));if(lostAck){lostAck=false;throw Error('FICTION_ACK_LOST');}}
  else if(u.pathname==='/laboral/operacion'){const body=JSON.parse(options.body),receipt=f.get('sv_labor_receipts/'+body.id);data={ok:true,status:receipt?'confirmed':'pending'};}
  else throw Error('Unknown fixture route');
  return{ok:true,status:200,json:async()=>data};
 }catch(error){if(error.message==='FICTION_ACK_LOST')throw error;return{ok:false,status:error.statusCode||500,json:async()=>({mensaje:error.message,code:error.code,...(error.svLaborAttempted===false?{svLaborAttempted:false}:{})})};}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../../js/core/service-auth.js'),'utf8'),{window:root,Promise});
 root.SVLaborWrites=require('../../js/core/labor-writes.js').create(root);root.SVLaborWriteRecovery=require('../../js/core/labor-write-recovery.js').create(root);root.SVOTLifecycle=(clientLifecycle||require('../../js/modules/ot-lifecycle.js')).create(root);
 const context={...f.get('sisventas/ordenes_trabajo/ot'),fbKey:'ot'},draft={...structuredClone(context),...f.body.changes};
 return{...f,client,storage,clientRoot:root,context,draft,loseClientAck:()=>{lostAck=true;},async save(){const prepared=await root.SVOTLifecycle.prepare(context,{kind:'custody'});return root.SVOTLifecycle.save(context,draft,{kind:'custody',action:'Instalación exclusivamente ficticia',prepared});}};
}
module.exports={create};
