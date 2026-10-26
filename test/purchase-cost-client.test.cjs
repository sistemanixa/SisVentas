'use strict';
const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const {fixture,actor}=require('./helpers/purchase-command-fixture.cjs'),{digest}=require('../cotizador/labor-guard');
const source=fs.readFileSync('js/modules/purchase-orders.js','utf8'),copy=structuredClone;
function functionSource(name){const start=source.search(new RegExp('^  (?:async )?function '+name+'\\(','m'));if(start<0)throw Error(name);const ends=/^  \}/gm;ends.lastIndex=start;for(let m;(m=ends.exec(source));){const text=source.slice(start,m.index+3);try{new vm.Script(text);return text;}catch(_){}}throw Error(name);}
function client(server=fixture()){
 const notices=[],calls=[],button={tagName:'BUTTON',innerHTML:'Registrar',disabled:false,attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}},modal={style:{display:'flex'}},state={activeOrder:{...copy(server.get('sisventas/ordenes/o')),fbKey:'o'}};let seq=0,confirm=true,rows=[];
 const c={window:null,console,document:{activeElement:button,getElementById:()=>modal,querySelectorAll:()=>rows},state,fbDB:{},fbAuth:{currentUser:{uid:'u'}},currentUserUid:'u',currentRole:'administrativo',notify:msg=>notices.push(msg),svConfirm:async()=>confirm,
  SVLaborWrites:{hash:async value=>digest(value),command:async(resource,fields)=>{assert.equal(resource,'compras');const body={id:'client_operation_'+(++seq),...copy(fields)};calls.push(copy(body));return server.service.execute(actor,body);}},
  fbGet(){throw Error('Cliente no descarga fuentes');},fbUpdate(){throw Error('Cliente no muta orden fuera del comando');},fbRunTransaction(){throw Error('Cliente no modifica venta o stock');},fbRef(){throw Error('Cliente no crea ref RAW');},transactionInventory(){throw Error('Cliente no aplica inventario antes de validar');},update(){throw Error('Cliente no aplica efectos antes de validar');},remove(){throw Error('Cliente no elimina fuera de confirmación');}};c.window=c;vm.createContext(c);
 for(const n of ['purchaseCostCommand','syncSalePurchaseCosts','finishReceipt','saveActiveReconciliation','deleteActiveOrder'])vm.runInContext(functionSource(n),c);
 return {server,c,state,button,modal,notices,calls,order:()=>({...copy(server.get('sisventas/ordenes/o')),fbKey:'o'}),rows:value=>rows=value,confirm:value=>confirm=value};
}
const movement=(qty=1,cost=80)=>({index:0,item:{codigo:'P1',costoUnitario:100},qty,costoUnitarioReal:cost,proveedor:'NOMBRE CLIENTE NO CONFIABLE',proveedorKey:'p'});
test('cliente recibe por comando tipado y no envía copia del ítem ni nombre/costo de venta',async()=>{
 const f=client(),before=copy(f.state.activeOrder);await f.c.finishReceipt(f.state.activeOrder,[movement()]);assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].movements,[{index:0,qty:1,costoUnitarioReal:80,proveedorKey:'p'}]);assert.doesNotMatch(JSON.stringify(f.calls[0]),/NOMBRE CLIENTE|costoTotal|margen|ganancia|ventaFbKey/);assert.equal(f.server.state.sisventas.inventario_operativo.p1.reservado,1);assert.equal(f.server.state.sisventas.ventas.s.items[0].proveedorCompraReal,'Proveedor ficticio');assert.equal(f.modal.style.display,'none');assert.deepEqual(f.state.activeOrder,before);assert.equal(f.button.disabled,false);assert.equal(f.button.attrs['aria-busy'],undefined);assert.equal(f.button.innerHTML,'Registrar');
});
test('fallo del servidor deja TODO sin aplicar y permite un único reintento explícito',async()=>{
 const f=client(),before=copy(f.server.state);f.server.hook(()=>{throw Error('fallo simulado');});await assert.rejects(f.c.finishReceipt(f.order(),[movement()]),/simulado/);assert.deepEqual(f.server.state,before);assert.equal(f.modal.style.display,'flex');assert.equal(f.state.receiptBusy,false);assert.equal(f.state.purchaseCostBusy,false);f.server.hook(null);await f.c.finishReceipt(f.order(),[movement()]);assert.equal(f.server.state.sisventas.inventario_operativo.p1.reservado,1);assert.equal(f.server.state.sisventas.ordenes.o.recepciones.length,1);assert.equal(f.server.state.sisventas.ventas.s.items[0].costoRealCompraAcumulado,80);
});
test('orden desactualizada no duplica stock ni recepción',async()=>{
 const f=client(),stale=f.order();await f.c.finishReceipt(stale,[movement()]);const snapshot=copy(f.server.state);await assert.rejects(f.c.finishReceipt(stale,[movement()]),/orden cambió/);assert.deepEqual(f.server.state,snapshot);
});
test('reconciliación cliente sólo manda cambios legítimos de la compra y espera ACK',async()=>{
 const f=client();await f.c.finishReceipt(f.order(),[movement()]);f.state.activeOrder=f.order();f.modal.style.display='flex';f.rows([{dataset:{orderIndex:'0'},querySelector:s=>s.includes('provider')?{value:'q'}:{value:'95'}}]);await f.c.saveActiveReconciliation();assert.deepEqual(f.calls.at(-1).changes,[{index:0,proveedorKey:'q',costoUnitarioReal:95}]);assert.equal(f.server.state.sisventas.ventas.s.items[0].costoRealCompraAcumulado,95);assert.equal(f.modal.style.display,'none');assert.equal(f.notices.at(-1),'Conciliación actualizada');
});
test('eliminar solicita advertencia y sólo el comando puede retirar inventario y orden',async()=>{
 const f=client();await f.c.finishReceipt(f.order(),[movement()]);f.state.activeOrder=f.order();f.modal.style.display='flex';await f.c.deleteActiveOrder();assert.equal(f.calls.at(-1).action,'revert');assert.equal(f.server.get('sisventas/ordenes/o'),null);assert.equal(f.server.state.sisventas.inventario_operativo.p1.reservado,0);assert.equal(f.state.activeOrder,null);assert.equal(f.notices.at(-1),'Orden de compra eliminada');
});
test('Cancelar nunca envía eliminación ni cambia fuentes',async()=>{
 const f=client(),before=copy(f.server.state);f.confirm(false);await f.c.deleteActiveOrder();assert.equal(f.calls.length,0);assert.deepEqual(f.server.state,before);assert.equal(f.modal.style.display,'flex');
});
test('ledger ambiguo en eliminación no toca inventario antes del error',async()=>{
 const f=client();f.server.state.sisventas.ordenes.o.items[0].cantidadRecibida=1;f.server.state.sisventas.ventas.s.items[0].cantidadCompraReal=1;f.state.activeOrder=f.order();const before=copy(f.server.state);await f.c.deleteActiveOrder();assert.deepEqual(f.server.state,before);assert.equal(f.modal.style.display,'flex');assert.match(f.notices.at(-1),/^No se pudo eliminar la orden: (?:Hay recepciones anteriores sin una vinculación comprobable|Falta comprobar el importe de una recepción anterior)/);
});
test('doble clic mientras procesa no envía una segunda recepción',async()=>{
 const f=client();let release;const original=f.c.SVLaborWrites.command;f.c.SVLaborWrites.command=async(...args)=>{const ack=await original(...args);await new Promise(r=>release=r);return ack;};const running=f.c.finishReceipt(f.order(),[movement()]);await new Promise(r=>setImmediate(r));assert.equal(f.button.disabled,true);await f.c.finishReceipt(f.order(),[movement()]);assert.equal(f.calls.length,1);release();await running;assert.equal(f.button.disabled,false);
});
test('cambio de sesión mientras calcula proof impide enviar el comando',async()=>{
 const f=client();let release;f.c.SVLaborWrites.hash=async value=>{await new Promise(r=>release=r);return digest(value);};const running=f.c.finishReceipt(f.order(),[movement()]);f.c.currentUserUid='otra';release();await running;assert.equal(f.notices.length,0);assert.equal(f.calls.length,0);assert.equal(f.button.disabled,false);
});
test('ACK confirmado tras retirar sesión no pinta ni cierra pantalla posterior',async()=>{
 const f=client(),original=f.c.SVLaborWrites.command;f.c.SVLaborWrites.command=async(...args)=>{const result=await original(...args);f.c.currentUserUid='otra';return result;};await f.c.finishReceipt(f.order(),[movement()]);assert.equal(f.modal.style.display,'flex');assert.equal(f.notices.length,0);assert.equal(f.server.state.sisventas.ordenes.o.recepciones.length,1);
});
test('acuse recuperado no inventa importes, cantidades ni falla por faltar DTO',async()=>{
 const f=client();f.c.SVLaborWrites.command=async()=>({ok:true,committed:true,recovered:true});await f.c.finishReceipt(f.order(),[movement()]);assert.match(f.notices.at(-1),/^Recepción confirmada/);assert.doesNotMatch(f.notices.at(-1),/\$|0 unidades|no se pudo/i);assert.equal(f.modal.style.display,'none');
});
test('planifica referencia exacta para duplicados y conjunta sin derivar por SKU',()=>{
 const c={window:{},safeKey:String,today:()=> '2026-10-26'};vm.createContext(c);vm.runInContext(functionSource('buildPlannedOrders'),c);const list={fbKey:'l',ventaFbKey:'s',items:[{productoKey:'p',codigo:'P',linea:2,proveedorKey:'q',incluir:true,cantidadNecesaria:1},{productoKey:'p',codigo:'P',linea:5,proveedorKey:'q',incluir:true,cantidadNecesaria:1}]},sim={complete:true,chosen:'remote',parameters:{usd:1000},result:{remoteAllocation:[0,0]},rows:[{key:'p|2|q',sourceLine:2,include:true,qty:1,usd:1,code:'P',provider:'Q',providerKey:'q'},{key:'p|5|q',sourceLine:5,include:true,qty:1,usd:2,code:'P',provider:'Q',providerKey:'q'}]};const orders=c.buildPlannedOrders(list,sim);assert.deepEqual(copy(orders[0].items.map(i=>i.saleItemIndex)),[2,5]);assert.deepEqual(copy(orders[0].items.map(i=>i.costoUnitario)),[1000,2000]);
});

for(const change of ['owner','hidden','page'])test('confirmación tardía no cierra la orden posterior tras '+change,async()=>{const f=client(),events=new Map();f.c.document.addEventListener=(name,fn)=>events.set(name,fn);f.c.document.removeEventListener=(name,fn)=>{if(events.get(name)===fn)events.delete(name);};const original=f.c.SVLaborWrites.command;f.c.SVLaborWrites.command=async(...args)=>{const result=await original(...args);if(change==='owner')f.state.activeOrder={fbKey:'otra'};if(change==='hidden'){f.c.document.hidden=true;events.get('visibilitychange')();f.c.document.hidden=false;}if(change==='page')events.get('sisventas:page-changed')();return result;};await f.c.finishReceipt(f.order(),[movement()]);assert.equal(f.modal.style.display,'flex');assert.equal(f.notices.length,0);assert.equal(events.size,0);assert.equal(f.server.state.sisventas.ordenes.o.recepciones.length,1);});
