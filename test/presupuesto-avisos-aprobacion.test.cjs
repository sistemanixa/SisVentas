'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
const approval=require('../js/modules/commercial-approval.js');

function fixture({admin=false,discount=15,itemDiscount=0,total=1500000}={}){
 const nodes={'pp-total':{textContent:String(total)},'pp-descuento':{value:String(discount)},'form-alerta-aprobacion':{style:{}},'form-alerta-txt':{textContent:''}};
 const c={document:{getElementById:id=>nodes[id]},APROBACION_CONFIG:{descuentoLimite:5,montoLimite:600000},SVCommercialApproval:approval,
  getPpItems:()=>[{qty:1,punit:100,disc:itemDiscount}],normalizarNumeroExcel:value=>value,tienePermiso:permission=>admin&&permission==='presupuestos.aprobar'};
 c.window=c;load(c,['checkAprobacion']);return {c,nodes,run(summary){c.checkAprobacion(summary);return nodes['form-alerta-txt'].textContent;}};
}

test('admin no recibe pedido de aprobación propio por monto o descuento alto',()=>{
 const f=fixture({admin:true});assert.equal(f.run(),'');assert.equal(f.nodes['form-alerta-aprobacion'].style.display,'none');
});
test('usuario sin aprobación ve el mismo límite efectivo general y por ítem del guardado',()=>{
 const f=fixture({discount:3,itemDiscount:3,total:100});assert.match(f.run(),/descuento.*5%.*Requiere aprobación/);assert.equal(f.nodes['form-alerta-aprobacion'].style.display,'flex');
});
test('el aviso usa el total recién calculado y desaparece al corregir el exceso',()=>{
 const f=fixture({discount:0,total:10});assert.match(f.run({total:900000}),/total.*Requiere aprobación/);assert.equal(f.run({total:10}),'');assert.equal(f.nodes['form-alerta-aprobacion'].style.display,'none');
});
test('descuento cero o vacío no requiere aprobación y el inválido se avisa también al admin',()=>{
 for(const discount of [0,'']){const f=fixture({discount,total:10});assert.equal(f.run(),'');}
 const f=fixture({admin:true,discount:101});assert.match(f.run(),/entre 0% y 100%/);assert.equal(f.nodes['form-alerta-aprobacion'].style.display,'flex');
});
