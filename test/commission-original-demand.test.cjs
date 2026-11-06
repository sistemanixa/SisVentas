'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../js/modules/commissions.js'),'utf8');
function fixture(){
 const nodes=new Map(),events={},requests=[],notices=[];let resolve;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{style:{},dataset:{},innerHTML:'',textContent:'',disabled:false,value:'',contains:()=>true});return nodes.get(id);};
 const sale={fbKey:'sale',id:'V-FICTION',items:[{cod:'PRODUCT',qty:1,punit:1000,costoTotalCompra:500,costoUnitarioPresupuestado:600},{cod:'LABOR',qty:1,punit:500,costoTotalCompra:200,esManoDeObra:true}],subtotal:1500,descuentoGeneral:10,descuento:150,total:1200,iva:0,conIva:false};
 // Stored totals deliberately coherent with a 20% line discount on PRODUCT.
 sale.items[0].disc=20;sale.items[0].sub=800;sale.items[1].sub=500;sale.subtotal=1300;sale.descuento=130;sale.total=1170;
 const expense={fbKey:'g',tipoPagable:'comision',ventaId:'V-FICTION',ventaFbKey:'sale',empleadoFbKey:'e',empleadoNombre:'Persona ficticia',gananciaBase:370,pct:10,monto:37,estado:'pendiente_pago',aprobadoPor:'Admin'};
 const w={currentRole:'admin',currentUserUid:'u',fbAuth:{currentUser:{uid:'u'}},fbDB:{},PERMISOS_ROLES:{admin:{indiceRevision:1}},permisoModulo:()=>true,tienePermiso:()=>true,gastosData:[expense],ventasList:[],empData:{},APROBACION_CONFIG:{maxComisionPct:25},SVCommercialMoney:require('../js/core/commercial-money.v1'),SisVentas:{V3:{SalesReadModel:require('../js/v3/sales-read-model')}},notify:m=>notices.push(m),SVCommercialOwnership:{request:async(d,p)=>{requests.push([d,p]);return new Promise(r=>resolve=r);}},_calcularBaseComisionVenta:v=>({costoTotal:800,costoManoObra:200,baseNeta:1350,descuento:130,ganancia:550})};
 const doc={hidden:false,getElementById:node,querySelector:()=>({id:'page-comisiones'}),querySelectorAll:()=>[],addEventListener:(k,f)=>events[k]=f,removeEventListener(){}};
 vm.runInNewContext(source,{window:w,document:doc,setTimeout(){},console:{error(){}}});
 return {w,node,sale,expense,requests,notices,events,resolve:value=>resolve(value),async wait(){for(let i=0;i<12;i++)await Promise.resolve();}};
}
test('opening commission requests only its original, shows canonical net and preserves approved amounts',async()=>{
 const f=fixture(),before=JSON.stringify(f.expense),pending=f.w.abrirDetalleComision('sale');await f.wait();
 assert.deepEqual(f.requests,[['ventas','registro/sale']]);assert.match(f.node('com-det-info').textContent,/Cargando/);assert.equal(f.node('com-det-guardar').disabled,true);
 f.resolve({record:f.sale});await pending;const html=f.node('com-det-info').innerHTML;
 assert.match(html,/1\.170/);assert.match(html,/COSTO ORIGINAL/);assert.match(html,/800/);assert.match(html,/200/);assert.equal(JSON.stringify(f.expense),before);assert.equal(f.w.ventasList.length,0);
});
test('closing while original is delayed discards it and never repaints another modal',async()=>{
 const f=fixture(),pending=f.w.abrirDetalleComision('sale');await f.wait();f.w.cerrarDetalleComision();f.resolve({record:f.sale});await pending;assert.equal(f.node('modal-comision-gestion').style.display,'none');assert.equal(f.node('com-det-info').innerHTML,'');
});
test('permission revocation retires delayed original without showing its amounts',async()=>{
 const f=fixture(),pending=f.w.abrirDetalleComision('sale');await f.wait();f.w.currentRole='tecnico';f.resolve({record:f.sale});await pending;assert.doesNotMatch(f.node('com-det-info').innerHTML,/COSTO ORIGINAL/);
});
test('a cached sale never substitutes the fresh authorized original or gets overwritten',async()=>{
 const f=fixture();f.w.ventasList=[{fbKey:'sale',id:'V-FICTION',total:99999,items:[]}];const before=JSON.stringify(f.w.ventasList),pending=f.w.abrirDetalleComision('sale');await f.wait();f.resolve({record:f.sale});await pending;
 assert.match(f.node('com-det-info').innerHTML,/1\.170/);assert.equal(JSON.stringify(f.w.ventasList),before);
});
test('missing original costs stay an error, never a catalogue fallback or zero summary',async()=>{
 const f=fixture();delete f.sale.items[0].costoTotalCompra;delete f.sale.items[0].costoUnitarioPresupuestado;const before=JSON.stringify(f.expense),pending=f.w.abrirDetalleComision('sale');await f.wait();f.resolve({record:f.sale});await pending;
 assert.match(f.node('com-det-info').textContent,/costos originales sin confirmar/);assert.equal(f.node('com-det-guardar').disabled,true);assert.equal(JSON.stringify(f.expense),before);assert.doesNotMatch(f.node('com-det-info').innerHTML,/VENTA NETA/);
});
test('an original from another sale is rejected without painting its financial summary',async()=>{
 const f=fixture(),pending=f.w.abrirDetalleComision('sale');await f.wait();f.resolve({record:{...f.sale,id:'OTHER'}});await pending;
 assert.match(f.node('com-det-info').textContent,/no coincide/);assert.equal(f.node('com-det-guardar').disabled,true);
});
for(const [name,change]of Object.entries({auth:f=>f.w.fbAuth.currentUser={uid:'u'},database:f=>f.w.fbDB={},permissionRevision:f=>f.w.PERMISOS_ROLES.admin.indiceRevision++,viewAs:f=>f.w._impersonacionOriginal={}})){
 test('delayed original is retired after '+name,async()=>{const f=fixture(),pending=f.w.abrirDetalleComision('sale');await f.wait();change(f);f.resolve({record:f.sale});await pending;assert.doesNotMatch(f.node('com-det-info').innerHTML,/COSTO ORIGINAL/);assert.equal(f.node('com-det-guardar').disabled,true);});
}

test('authorized current-cost snapshot preserves 15 percent, approved amount and basis on reopen',async()=>{
 const f=fixture();Object.assign(f.sale,{subtotal:2217805.24,descuentoGeneral:0,descuento:0,total:2217805.24,items:[{cod:'FICTION',qty:1,punit:2217805.24,sub:2217805.24,costoTotalCompra:1284833.79}]});
 Object.assign(f.expense,{gananciaBase:932971.45,pct:15,monto:139945.72,baseComisionAjustada:{schema:1,ventaFbKey:'sale',neto:2217805.24,costo:1284833.79,costoManoObra:405000,ganancia:932971.45,pct:15,monto:139945.72}});
 const before=JSON.stringify(f.expense);
 for(let n=0;n<2;n++){const task=f.w.abrirDetalleComision('sale');await f.wait();f.resolve({record:f.sale});await task;const html=f.node('com-det-info').innerHTML;assert.match(html,/COSTO DE CÁLCULO/);assert.match(html,/1\.284\.833/);assert.match(html,/139\.945/);assert.match(html,/932\.971/);assert.doesNotMatch(html,/COSTO ORIGINAL/);f.w.cerrarDetalleComision();}
 assert.equal(JSON.stringify(f.expense),before);assert.equal(f.requests.length,2);
});

test('inconsistent authorized snapshot fails closed without changing approved records',async()=>{
 const f=fixture();f.expense.baseComisionAjustada={schema:1,ventaFbKey:'sale',neto:1170,costo:700,costoManoObra:200,ganancia:470,pct:10,monto:47};const before=JSON.stringify(f.expense),task=f.w.abrirDetalleComision('sale');await f.wait();f.resolve({record:f.sale});await task;assert.match(f.node('com-det-info').textContent,/base ajustada.*revisión/);assert.equal(f.node('com-det-guardar').disabled,true);assert.equal(JSON.stringify(f.expense),before);
});
