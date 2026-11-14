'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs'),{apply}=require('./helpers/labor-ui-flow.cjs');
const {createOTLifecycle}=require('../cotizador/ot-lifecycle'),{digest}=require('../cotizador/labor-guard'),Policy=require('../cotizador/ot-lifecycle-policy'),Index=require('../cotizador/record-list-model');
async function fixture({held=0,role='admin',additional=false,deployed=false}={}){
 const material={cod:'P-FICTICIO',productoKey:'p',vendida:3,entregada:0,instalada:0,devuelta:0,custodiaActiva:false};
 const ot={id:'OT-FICTICIA',clienteFbKey:'c',ventaFbKey:'s',ventaId:'V-FICTICIA',tecnico:'Técnico ficticio',estado:'en_curso',materiales:[material],audit:[]};
 if(additional)ot.materiales.push({...material,vendida:1,adicionalOT:true});
 const other={...structuredClone(ot),id:'OT-OTRA',materiales:[{...material,entregada:held,custodiaActiva:held>0}]};
 const sale={id:'V-FICTICIA',fecha:'2026-10-20',clienteFbKey:'c',responsableUid:'u',total:300,subtotal:300,iva:0,conIva:false,items:[{cod:material.cod,qty:3,punit:100,sub:300,costoUnitarioCompra:10,costoTotalCompra:30}]};
 const f=await createCoordinatedBackend({ventas:{s:sale},pagos:{p:{ventaFbKey:'s',monto:40,fecha:sale.fecha}},ordenes_trabajo:{ot,other},inventario_operativo:{p:{general:4,reservado:7,consumido:0,enCompra:1,_svReadRevision:1,asignaciones:{s:{reservado:2,consumido:0},foreign:{reservado:5,consumido:0}}}},comisiones:{sentinel:{monto:7}},productos:{p:{codigo:material.cod,nombre:'Producto ficticio'}}});
 apply(f.state,{sv_operational_read_config:{schema:1,ready:true,generation:'stock-generation'},sv_record_list_config:{schema:1,ready:true},'sv_labor_config/otLifecycleVersion':1,'sv_labor_config/otDeliveryVersion':1,'sv_chat_roles/u':{rol:role,activo:true},['sv_permisos/'+role]:{indiceVersion:2,indiceRevision:1,indiceModulos:{ordentrabajo:true},acciones:{ot:{entregarMateriales:true}}},[Index.index+'/ordenes_trabajo']:{_svCoverage:{schema:1,ready:true,baselineCount:2,sourceHash:'a'.repeat(64)},ot:Index.summary('ordenes_trabajo',ot),other:Index.summary('ordenes_trabajo',other)}});
 f.store.query=async(p,field,value)=>Object.fromEntries(Object.entries(f.get(p)||{}).filter(([,r])=>r[field]===value));
 f.store.verifyOTDeliveryFence=async()=>({schema:1,verified:true,canonicalOT:true,inventory:true,rulesDigest:'f'.repeat(64)});
 const commit=f.store.commit;f.store.commit=async(patch,lease,actor)=>{Policy.validate(actor,f.get('sv_chat_roles/u'),f.get('sv_permisos/'+role));assert.ok(['delivery','custody'].includes(Policy.token(actor,lease).svOTLifecycleKind));return commit(patch,lease,actor);};
 const deployedGuard=deployed?require('../cotizador/labor-guard').createLaborGuard({store:f.store,operationalSummaries:true,commercialPages:true,delay:async()=>{}}):f.guard;const db={ref:p=>({get:async()=>({val:()=>f.get(p)})})},api=createOTLifecycle({db,store:f.store,guard:deployedGuard,enabled:true,commercialPages:true,now:()=>1792530000000}),identity={uid:'u',claims:{uid:'u'}};
 const body=(otKey='ot',cantidad=2,id='delivery-fictional-1')=>({id,otKey,kind:'delivery',expectedOTHash:digest(f.get('sisventas/ordenes_trabajo/'+otKey)),changes:{entregas:[{index:0,cantidad}]},action:'Entrega ficticia'});
 return{...f,api,identity,body};
}


const vm=require('node:vm'),fs=require('node:fs');
test('OT186 public Entregar todos then Todo instalado: six materials, one remito and one stock movement per stage',async()=>{
 const f=await fixture({deployed:true});f.state.sisventas.ventas.s.estadoInst='en_instalacion';f.state.sv_permisos.admin.acciones.ot.rendirMateriales=true;
 const ot=f.state.sisventas.ordenes_trabajo.ot,template=structuredClone(ot.materiales[0]);
 for(let i=1;i<6;i++){const key='fiction'+i;ot.materiales.push({...template,cod:'FICTION'+i,productoKey:key,vendida:2});f.state.sisventas.productos[key]={codigo:'FICTION'+i};f.state.sisventas.inventario_operativo[key]={general:2,reservado:0,consumido:0,asignaciones:{},_svReadRevision:1};}
 Object.assign(ot,{_svListRevision:24,fotos:{fiction:'a'},firma:'b',adjuntos:{fiction:'c'}});const summary=Index.summary('ordenes_trabajo',ot);summary._svListAttachments.reverse();f.state.sisventas.listados_resumen.ordenes_trabajo.ot=summary;
 const before=structuredClone(f.state.sisventas),commands=[],notes=[];let sequence=0;
 const root={otData:[{...structuredClone(ot),fbKey:'ot'}],otActualId:'ot',currentUserUid:'u',currentRole:'admin',currentUser:'Fiction admin',fbAuth:{currentUser:{uid:'u'}},fbDB:{},fbRef:(_,p)=>p,fbGet:async p=>({val:()=>f.get(p)}),crypto:{randomUUID:()=> 'fiction-all-'+(++sequence)},SVLaborWrites:{hash:async value=>digest(value)},SVLaborWriteRecovery:{assertAvailable(){},execute:async(meta,send)=>send()},SVServiceAuth:{headers:async()=>({})},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},SVCommercialMoney:require('../js/core/commercial-money.v1'),prodData:f.state.sisventas.productos,tienePermiso:()=>true,svConfirm:async()=>true,notify:m=>notes.push(m),scrollTo(){},fetch:async(url,args)=>{const body=args.body?JSON.parse(args.body):Object.fromEntries(new URL(url).searchParams);let data;if(url.includes('/disponible?'))data=await f.api.available(f.identity,body);else{commands.push(body);data=await f.api.execute(f.identity,body);}return{ok:true,status:200,json:async()=>data};}};
 root.SVOTLifecycle=require('../js/modules/ot-lifecycle').create(root);
 const context={window:root,document:{getElementById:()=>null,body:{},documentElement:{}},requestAnimationFrame(){},console};vm.createContext(context);vm.runInContext(fs.readFileSync('js/modules/ot-material-custody.js','utf8'),context);
 await root.otCustodiaEntregar();assert.equal(f.commits.length,1,notes.join('|'));const delivered=structuredClone(f.state.sisventas);
 assert.equal(commands[0].kind,'delivery');assert.equal(commands[0].changes.entregas.length,6);assert.equal(Object.keys(f.get('sisventas/ordenes_trabajo/ot/remitosEntrega')).length,1);
 for(const material of f.get('sisventas/ordenes_trabajo/ot/materiales')){assert.equal(material.entregada,material.vendida);assert.equal(material.instalada,0);}
 await root.otCustodiaEntregar();assert.equal(commands.length,1);await f.api.execute(f.identity,commands[0]);assert.deepEqual(f.state.sisventas,delivered);
 await root.otCustodiaTodoInstalado();assert.equal(f.commits.length,2,notes.join('|'));assert.equal(commands[1].kind,'custody');const installed=structuredClone(f.state.sisventas);
 for(const material of f.get('sisventas/ordenes_trabajo/ot/materiales')){assert.equal(material.instalada,material.vendida);const inventory=f.get('sisventas/inventario_operativo/'+material.productoKey);assert.equal(inventory.consumido,material.vendida);assert.equal(inventory.asignaciones.s.reservado,0);}
 assert.equal(Object.keys(f.get('sisventas/ordenes_trabajo/ot/remitosEntrega')).length,1);await f.api.execute(f.identity,commands[1]);assert.deepEqual(f.state.sisventas,installed);
 await root.otCustodiaTodoInstalado();assert.equal(commands.length,2);assert.equal(f.commits.length,2);assert.deepEqual(f.state.sisventas,installed);
 for(const domain of ['ventas','pagos','comisiones'])assert.deepEqual(installed[domain],before[domain]);
});
