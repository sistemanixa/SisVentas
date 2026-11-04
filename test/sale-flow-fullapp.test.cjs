'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const {createBackend,apply}=require('./helpers/labor-ui-flow.cjs'),{functionSource}=require('./helpers/app-functions.cjs');
const Permission=require('../js/core/permission-index'),Membership=require('../cotizador/payment-membership-index'),Forms=require('../js/core/commercial-form-data.v1');
function duplicateFixture(item){const filename=require.resolve('./sale-duplicate-row-continuity.test.cjs'),source=fs.readFileSync(filename,'utf8'),context={require:createRequire(filename),module:{exports:{}},structuredClone};vm.runInNewContext(source.slice(0,source.indexOf("\ntest('"))+'\nmodule.exports=fixture;',context);return context.module.exports(item);}
async function flow({ackError=false,changeRole=false,revoke=false,lostAck=false,conIva=false,discount=0,zero=false,degraded=false}={}){
 const items=Array.from({length:16},(_,index)=>({cod:'P-'+index,productoFbKey:'p'+index,desc:'Fixture '+index,qty:2,punit:100+index,costoUnitarioCompra:10+index,costoVersion:1})),original={id:'FIXTURE-ORIGINAL',responsableUid:'u',items,total:3440};
 const backend=createBackend({ventas:{original},presupuestos:{},pagos:{}}),page=backend.page(),root=page.context;
 backend.setReturnCapability({ok:true,revision:'fixture-real',saleReturn:{version:1,enabled:!degraded,purpose:'sale-return-to-budget',coordinated:true,rules:{version:1,verified:true,digest:require('node:crypto').createHash('sha256').update('fictitious rules only').digest('hex')}}});
 backend.state.sv_permisos=Permission.build({admin:{acciones:{ventas:{moverPresupuesto:true,crear:true,editar:true},presupuestos:{crear:true}}}});
 backend.store.query=async(path,field,value)=>Object.fromEntries(Object.entries(backend.get(path)||{}).filter(([,record])=>record?.[field]===value));
 apply(backend.state,Membership.buildIndex({},{generation:'fixture-fullapp-generation',ready:true}).patch);
 const before=backend.get('sisventas'),copy=duplicateFixture(items[0]);copy.original.items=items;
 let directoryReady=false,releaseDirectory;const directory=new Promise(resolve=>{releaseDirectory=()=>{directoryReady=true;resolve();};});
 const loaded=new Set();const loading=Promise.all(Forms.loaders('venta',Object.fromEntries(Forms.requirements('venta').map(name=>[name,async()=>{if(name==='empleados')await directory;loaded.add(name);}]))).map(load=>load()));
 await Promise.resolve();assert.equal(directoryReady,false);assert.equal(loaded.has('empleados'),false);releaseDirectory();await loading;assert.equal(loaded.size,4);
 copy.ctx.prodData=Object.fromEntries(items.map((item,index)=>['p'+index,{fbKey:'p'+index,codigo:item.cod,nombre:item.desc,imagenUrl:'fixture-'+index+'.png',compraARS:20+index}]));copy.ctx.precioVentaCanonicoProducto=product=>({precioARS:200+Number(product.fbKey.slice(1))});copy.ctx.obtenerCostoUnitarioVenta=code=>copy.ctx.prodData['p'+code.slice(2)].compraARS;
 const prepared=copy.ctx._svPrepararDuplicadoVenta(copy.original);copy.ctx.duplicarVenta('original');assert.equal(copy.rows.length,16);
 for(const [index,row]of copy.rows.entries()){assert.match(row.innerHTML,new RegExp('fixture-'+index+'\\.png'));assert.equal(JSON.parse(row.dataset.itemComercial).costoUnitarioCompra,20+index);}
 root.SVSaleCosts=require('../js/core/sale-costs.v1').create(root);root.SVSaleWriter=require('../js/core/sale-writer.v1').create(root);root.fechaVentaOrdenISO=value=>value;root.fbPush=()=>({key:'fixture-copy'});root.pptoData=[];
 vm.runInContext(fs.readFileSync(require.resolve('../js/core/commercial-ownership.js'),'utf8'),root);
 for(const name of ['ventasPagosPersistirGuardarVenta','fbGuardarVenta','_svCargaOperacion_moverVentaAPresupuesto'])vm.runInContext(functionSource(name),root);
 const record={id:'FIXTURE-COPY',fecha:'2026-11-04',conIva,descuentoGeneral:discount,items:JSON.parse(JSON.stringify(prepared.items))};
 if(zero)record.items.forEach(item=>{item.punit=0;delete item.sub;});
 const key=await root.fbGuardarVenta(record);assert.equal(key,'fixture-copy');const reopened=(await root.fbGet(root.fbRef(root.fbDB,'sisventas/ventas/'+key))).val();assert.equal(reopened.items.length,16);
 reopened.items.forEach((item,index)=>{assert.equal(item.imagenUrl,'fixture-'+index+'.png');assert.equal(item.punit,zero?0:200+index);assert.equal(item.costoUnitarioCompra,20+index);});
 root.ventasList=[{...reopened,fbKey:key}];root._svResolverVentaRegistro=()=>root.ventasList.find(sale=>sale.fbKey===key);root.svConfirm=async()=>true;root.reservarSiguientePptoId=async()=> 'FIXTURE-BUDGET';root.SisVentasCompras={state:{lists:[]}};root.showPage=pageName=>{root.destination=pageName;};
 if(ackError)root.SVCommercialOwnership={...root.SVCommercialOwnership,confirmDelete(){throw Error('fixture ACK presentation failure');}};
 if(changeRole)root.reservarSiguientePptoId=async()=>{root.currentRole='tecnico';return 'FIXTURE-BUDGET';};
 if(revoke)backend.state.sv_chat_roles.u.activo=false;
 let reservations=0;const reserve=root.reservarSiguientePptoId;root.reservarSiguientePptoId=async()=>{reservations++;return reserve();};
 if(lostAck){const fetchOriginal=root.fetch;root.fetch=async(url,options)=>{const response=await fetchOriginal(url,options);if(JSON.parse(options.body).purpose==='sale-return-to-budget'&&response.ok)throw Error('fixture lost ACK after commit');return response;};}
 const commits=backend.commits.length,commands=backend.commands.length;
 await root._svCargaOperacion_moverVentaAPresupuesto('FIXTURE-COPY');
 if(degraded){assert.equal(reservations,0);assert.equal(backend.commands.length,commands);assert.equal(backend.capabilityCalls.length,1);}
 if(changeRole||revoke||degraded){assert.equal(backend.commits.length,commits);assert.ok(backend.get('sisventas/ventas/'+key));assert.equal(backend.get('sisventas/presupuestos/desde_venta_'+key),null);}
 else {const budget=backend.get('sisventas/presupuestos/desde_venta_'+key);assert.ok(budget,JSON.stringify(page.messages));assert.deepEqual(budget.items,reopened.items);assert.equal(budget.total,reopened.total);assert.equal(backend.get('sisventas/ventas/'+key),null);assert.equal(backend.commits.length,commits+1);assert.equal(backend.commands.length,commands+1);if(lostAck){const command=backend.commands.at(-1),receipt=backend.get('sv_labor_receipts/'+command.id);assert.equal(receipt.actorUid,'u');assert.ok(receipt.confirmedAt);assert.equal(root.pptoData.length,0);assert.equal(backend.commands.length,commands+1);}else {assert.equal(root.pptoData[0].fbKey,'desde_venta_'+key);if(ackError)assert.match(page.messages.at(-1),/quedó guardado/);else {assert.equal(root.ventasList.length,0);assert.equal(root.destination,'presupuesto');}}}
 if(!changeRole&&!revoke&&!degraded){const budget=backend.get('sisventas/presupuestos/desde_venta_'+key);root.SVSaleBudgetTransition.validateEconomicTransition(reopened,budget);assert.equal(budget.descuentoGeneral,discount);assert.equal(budget.conIva,conIva);if(zero)assert.equal(budget.total,0);}
 if(lostAck){
  const command=backend.commands.at(-1),actor=await backend.gateway.authorize({method:'POST',url:'/laboral/operacion',headers:{authorization:'Bearer fixture-token'}}),digest=require('../cotizador/labor-guard').digest(command);
  assert.deepEqual(await backend.gateway.resolve(actor,{id:command.id,digest}),{ok:true,status:'confirmed'});
  await assert.rejects(backend.gateway.resolve(actor,{id:command.id,digest:'0'.repeat(64)}));
  assert.equal(backend.commits.length,commits+1);assert.equal(backend.commands.length,commands+1);
 }
 if(!changeRole&&!revoke&&!zero&&!degraded){const budget=backend.get('sisventas/presupuestos/desde_venta_'+key),expected=root.SVSaleBudgetTransition.toBudget(reopened,{sourceFormat:'sale'}),presentation=require('../js/core/budget-presentation-model').fromRecord(budget);assert.equal(budget.subtotal,expected.subtotal);assert.equal(budget.descuentoAmt,expected.descuentoAmt);assert.equal(presentation.valid,true);assert.equal(presentation.subtotal,budget.subtotal);assert.equal(presentation.discount,budget.descuentoAmt);assert.equal(presentation.discountPct,discount);assert.equal(presentation.iva,budget.iva);assert.equal(presentation.total,budget.total);assert.equal(presentation.items.length,16);}
 assert.deepEqual(backend.get('sisventas/ventas/original'),before.ventas.original);assert.deepEqual(backend.get('sisventas/pagos'),before.pagos);assert.deepEqual(backend.get('sisventas/sentinel'),before.sentinel);assert.deepEqual(backend.direct,[]);
}
test('real duplicate16, delayed directory, writer/gateway/guard, reopen and return ACK in RAM',()=>flow());
test('committed return with presentation ACK failure sends no second POST',()=>flow({ackError:true}));
test('role change during return prevents commit',()=>flow({changeRole:true}));
test('server revocation before return prevents commit',()=>flow({revoke:true}));
test('transport ACK lost after commit leaves one receipt and never sends another POST',()=>flow({lostAck:true}));
test('ten percent discount and IVA retain real sale-to-budget semantics',()=>flow({discount:10,conIva:true}));
test('ten percent discount without IVA retains real sale-to-budget semantics',()=>flow({discount:10}));
test('explicit zero prices remain zero through save reopen and return',()=>flow({zero:true,conIva:true}));
test('degraded capability blocks before PP reservation and atomic write',()=>flow({degraded:true}));
