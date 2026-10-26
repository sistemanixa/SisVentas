'use strict';
const assert=require('node:assert/strict'),Commands=require('../../cotizador/purchase-sale-cost-commands');
const {digest}=require('../../cotizador/labor-guard'),copy=structuredClone;
const actor={uid:'u',claims:{uid:'u',name:'Operador de prueba'}};
const permissions=(mods={ordenes:true,venta:true,productos:true})=>({indiceVersion:2,indiceRevision:4,indiceModulos:mods,acciones:{},bloqueados:[]});
function fixture(options={}){
 const state={sv_chat_roles:{u:{activo:true,rol:options.role||'administrativo',nombre:'Operador ficticio'}},sv_permisos:{},sv_access_resets:{},sv_labor_config:{schema:1,ready:true,commercialViews:{schema:1,enabled:true}},sisventas:{
  ventas:{s:{id:'V-FICTICIA',responsableUid:'u',subtotal:1000,total:1210,iva:210,items:[{cod:'P1',pid:'p1',qty:5,punit:200,costoUnitarioCompra:100,costoTotalCompra:500,costoUnitarioAntesPreparacion:100}],costoTotal:500,margenPct:50,ordenesCompraIds:['o'],listaMaterialesId:'l',pagos:{p:{monto:100,medio:'Efectivo'}},commissionPrivate:{pct:37,gananciaBase:991234.98}}},
  ordenes:{o:{numero:'OC-FICTICIA',ventaId:'V-FICTICIA',ventaFbKey:'s',listaMaterialesId:'l',estado:'enviada',items:[{productoKey:'p1',codigo:'P1',descripcion:'Producto ficticio',saleItemIndex:0,cantidadOrdenada:2,cantidadRecibida:0,costoUnitario:100,costoUnitarioPresupuestado:100}],recepciones:[],notas:'NOTA ORIGINAL',usuario:'Autor anterior',ts:1}},
  listas_materiales:{l:{ventaFbKey:'s',ordenesIds:['o'],estado:'ordenada',items:[{linea:0,productoKey:'p1',codigo:'P1'}],nota:'LISTA ORIGINAL'}},
  inventario_operativo:{p1:{general:10,reservado:0,enCompra:2,asignaciones:{},other:'VARIANTE ORIGINAL'}},proveedores:{p:{nombre:'Proveedor ficticio',activo:true},q:{nombre:'Otro proveedor',activo:true}},ctaemp:{keep:{monto:77}},gastos:{keep:{monto:88}},pagos:{keep:{monto:99}}}};
 const role=state.sv_chat_roles.u.rol;state.sv_permisos[role]=options.cfg===undefined?permissions():options.cfg;
 if(options.mutate)options.mutate(state);
 const reads=[],userReads=[],writes=[],actors=[],receipts=new Map();let hook=null,queue=Promise.resolve(),lost=false,deny=null;
 const get=p=>p.split('/').reduce((v,k)=>v?.[k],state)??null,put=(p,value)=>{const keys=p.split('/');let parent=state;for(const key of keys.slice(0,-1))parent=parent[key]??={};if(value===null)delete parent[keys.at(-1)];else parent[keys.at(-1)]=copy(value);};
 const read=async p=>{reads.push(p);return copy(get(p));},readAsUser=async p=>{userReads.push(p);if(deny&&deny(p))throw Object.assign(Error('Acceso revocado'),{statusCode:403});assert.ok(!p.startsWith('sisventas/ventas/'),'El usuario jamás recibe venta RAW');return read(p);};
 const guard={run(command,work){const running=queue.then(async()=>{actors.push(copy(command));assert.equal(command.mode,'user');assert.equal(command.uid,'u');const old=receipts.get(command.opId);if(old){if(old.digest!==command.transportDigest)throw Error('Digest diferente');return copy(old.result);}const staged={},before=[];const result=await work({get:read,getAsUser:readAsUser,beforeCommit:f=>before.push(f),update:async patch=>Object.assign(staged,copy(patch))});if(hook)await hook(state);for(const check of before)await check({readFresh:read,readFreshAsUser:readAsUser});for(const [p,v]of Object.entries(staged)){writes.push(p);put(p,v);}receipts.set(command.opId,{digest:command.transportDigest,result:copy(result)});if(lost){lost=false;throw Error('ACK perdido ficticio');}return result;});queue=running.catch(()=>{});return running;}};
 const service=Commands.createPurchaseSaleCostCommands({authorize:async()=>actor,db:{ref:p=>({get:async()=>({val:()=>copy(get(p))})})},guard,now:()=>1792893600000});
 let seq=0;function request(action='receipt',extra={}){return {id:'purchase_operation_'+(++seq),action,orderKey:'o',expectedOrderHash:Commands.sourceHash(get('sisventas/ordenes/o')),...(action==='receipt'?{movements:[{index:0,qty:1,costoUnitarioReal:80,proveedorKey:'p'}]}:action==='reconcile'?{changes:[{index:0,costoUnitarioReal:90,proveedorKey:'q'}]}:{}),...extra};}
 return {state,service,reads,userReads,writes,actors,get,put,request,hook:fn=>hook=fn,loseAck:()=>lost=true,deny:fn=>deny=fn};
}

module.exports={fixture,actor,permissions};
