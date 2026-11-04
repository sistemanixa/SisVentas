const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createLaborGuard,child,parts,put,digest}=require('../cotizador/labor-guard');
const {createLaborWriteGateway}=require('../cotizador/labor-write-gateway');
const Transition=require('../js/core/sale-budget-transition.v1.js'),Payments=require('../cotizador/payment-membership-index');
function fixture(conIva){
 const sale={id:'VENTA-FICTICIA',items:[{cod:'P',qty:2,punit:100,disc:10,sub:180,costoUnitarioCompra:25,costoTotalCompra:50,costoOrigen:'stock_ultimo_ingreso_final'},{desc:'Cero',qty:1,punit:0,sub:0,costoUnitarioCompra:0,costoVersion:1}],subtotal:162,descuento:38,descuentoGeneral:10,iva:conIva?34.02:0,total:conIva?196.02:162,conIva};
 let data={sv_labor_config:{schema:1,ready:true},sv_chat_roles:{u:{activo:true,rol:'admin'}},sv_permisos:{admin:{acciones:{ventas:{moverPresupuesto:true}}}},sisventas:{ventas:{s:sale}}},sequence=0,commits=0;
 const read=path=>child(data,parts(path)),set=(path,value)=>{data=put(data,parts(path),value);};
 set('sv_permisos/admin/indiceVersion',2);set('sv_permisos/admin/indiceModulos',{venta:true,presupuesto:true});
 for(const [path,value]of Object.entries(Payments.buildIndex({},{generation:'ficticia',ready:true}).patch))set(path,value);
 const store={read:async path=>read(path),readAsUser:async path=>read(path),query:async()=>({}),acquire:async lease=>set('sv_labor_guard',lease),abort:async()=>set('sv_labor_guard',null),commit:async patch=>{commits++;for(const [path,value]of Object.entries(patch))set(path,value);}};
 const guard=createLaborGuard({store,uuid:()=> 'fixture-'+(++sequence),delay:async()=>{}}),gateway=createLaborWriteGateway({auth:{verifyIdToken:async()=>({uid:'u'})},db:{ref:path=>({get:async()=>({val:()=>read(path)})})},guard,store,enabled:true});
 const budget={...Transition.toBudget(sale,{sourceFormat:'sale'}),id:'PP-FICTICIO',ventaOrigenFbKey:'s',ts:1},path='sisventas/presupuestos/desde_venta_s';
 const command={id:'economic-fixture',kind:'atomic',purpose:'sale-return-to-budget',path:'',value:{'sisventas/ventas/s':null,[path]:budget},expectedHashes:{'sisventas/ventas/s':digest(sale),[path]:digest(null)}};
 return {gateway,command,budget,sale,read,get commits(){return commits;}};
}
for(const iva of [false,true])test('real gateway commits normalized discount and VAT with ACK '+iva,async()=>{const f=fixture(iva),result=await f.gateway.write({uid:'u',claims:{uid:'u'}},f.command);assert.equal(result.committed,true);assert.equal(f.commits,1);const saved=f.read('sisventas/presupuestos/desde_venta_s');assert.equal(saved.descuento,10);assert.equal(saved.descuentoAmt,18);assert.equal(saved.subtotal,180);assert.equal(saved.total,f.sale.total);assert.deepEqual(saved.items,f.sale.items);assert.equal(f.read('sisventas/ventas/s'),null);});
test('real gateway rejects altered discount or cost without commit',async()=>{for(const change of ['discount','cost']){const f=fixture(false);if(change==='discount')f.budget.descuentoGeneral=38;else f.budget.items[0].costoUnitarioCompra=0;await assert.rejects(f.gateway.write({uid:'u',claims:{uid:'u'}},f.command));assert.equal(f.commits,0);assert.equal(f.read('sisventas/ventas/s').total,162);}});
test('server packaged helpers exactly match browser canonical sources',()=>{for(const name of ['commercial-money.v1.js','sale-budget-transition.v1.js'])assert.equal(fs.readFileSync(require.resolve('../cotizador/commercial-models/'+name),'utf8').replace(/\r\n/g,'\n'),fs.readFileSync(require.resolve('../js/core/'+name),'utf8').replace(/\r\n/g,'\n'));});

test('real gateway rejects forged canonical transition metadata before commit',async()=>{
 for(const change of [{neto:89},{descuentoGeneralPorcentaje:99},{subtotalItems:1},{schema:2},{sourceFormat:'budget'},{porcentajeDerivado:true},null]){
  const f=fixture(false);if(change===null)delete f.budget.transicionEconomica;else Object.assign(f.budget.transicionEconomica,change);
  await assert.rejects(f.gateway.write({uid:'u',claims:{uid:'u'}},f.command),/metadatos económicos/);
  assert.equal(f.commits,0);assert.equal(f.read('sisventas/ventas/s').total,162);assert.equal(f.read('sisventas/presupuestos/desde_venta_s'),null);
 }
});
