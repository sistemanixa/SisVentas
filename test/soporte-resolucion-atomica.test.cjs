'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs');
const Writer=require('../js/core/sale-writer.v1.js'),Costs=require('../js/core/sale-costs.v1.js');
async function fixture(){
 const sale={id:'SP-FICTICIA',fecha:'2026-11-24',clienteFbKey:'c',cliente:'Persona ficticia',responsableUid:'u',subtotal:100,iva:0,total:100,estadoPago:'pendiente_pago',pagos:[],totalPagado:0,comisionados:['original'],audit:[],items:[{cod:'VISITA',qty:1,punit:100,sub:100,disc:0,costoUnitarioCompra:50}]};
 const claim={clienteFbKey:'c',ventaFbKey:'v',otKey:'ot',estado:'ot_activa',historial:[{texto:'Nota original',ts:1}]};
 const ot={id:'OT-FICTICIA',clienteFbKey:'c',ventaFbKey:'v',estado:'cerrada',materiales:[]};
 const b=await createCoordinatedBackend({ventas:{v:sale},reclamos:{r:claim},ordenes_trabajo:{ot}}),p=b.page(),r=p.context;
 vm.runInContext(fs.readFileSync('js/modules/commercial-document-controls.js','utf8'),r);
 r.SVCommercialOwnership={clean:v=>structuredClone(v),refresh(){}};r.SVSaleCosts=Costs.create(r);r.SVSaleWriter=Writer.create(r);
 r.SP_MODAL_KEY='r';r.SP_DATA={r:structuredClone(claim)};r.FB_PATHS={ordenesTrabajo:'sisventas/ordenes_trabajo',ventas:'sisventas/ventas'};
 r.SVPostventaDemand={perform:fn=>fn({financialByKey:async()=>({...b.get('sisventas/ventas/v'),fbKey:'v'}),assertCurrent(){},current:()=>true})};
 r.svCrearProgresoBoton=button=>{button.disabled=true;return{finalizar(){button.disabled=false;}};};
 r._buscarOTCanonicaPorClave=()=>({...b.get('sisventas/ordenes_trabajo/ot'),fbKey:'ot'});r.otEstaCerrada=v=>v.estado==='cerrada';
 r._svMontoPagadoVenta=()=>0;r._redondearPrecioActual=n=>Math.round(n*100)/100;
 r.SVCommercialApproval={recalculateSale:()=>({})};r.svAutorizarDescuentoVenta=async()=>true;
 r._svResolverVentaRegistro=()=>null;r.spRenderLista=()=>{};r.spActualizarMetricas=()=>{};r.spAbrirModal=()=>{};
 p.load(['spVentaTieneDefinicionComercial','spIntegrarMaterialesOT','spConfirmarResolucionVisita']);
 const button={disabled:false},modal={removed:false,querySelector:s=>s.includes('input')?{value:'cobrada'}:button,remove(){this.removed=true;}};
 return{b,r,claim,ot,sale,button,modal,messages:p.messages,run:()=>r.spConfirmarResolucionVisita('r','v','VISITA',modal)};
}
test('la resolución real confirma venta y reclamo juntos con verificaciones de venta, reclamo y OT',async()=>{
 const f=await fixture();await f.run();
 assert.equal(f.b.commits.length,1,JSON.stringify(f.messages));assert.equal(f.b.direct.length,0);
 const cmd=f.b.commands[0];for(const p of ['sisventas/ventas/v','sisventas/reclamos/r','sisventas/ordenes_trabajo/ot'])assert.match(cmd.expectedHashes[p],/^[a-f0-9]{64}$/);
 assert.equal(f.b.get('sisventas/reclamos/r').estado,'cerrado');assert.equal(f.b.get('sisventas/ventas/v').manoObraPostVenta,'con_cargo');
 assert.deepEqual(f.b.get('sisventas/ordenes_trabajo/ot'),f.ot);
 for(const k of ['pagos','totalPagado','comisionados','total'])assert.deepEqual(f.b.get('sisventas/ventas/v')[k],f.sale[k]);
 assert.equal(f.modal.removed,true);assert.equal(f.button.disabled,false);assert(f.r.notify);
});
for(const domain of ['reclamos/r','ordenes_trabajo/ot'])test('un cambio concurrente de '+domain+' veta la resolución sin perder datos',async()=>{
 const f=await fixture();let changed=false;f.b.setHook(()=>{if(!changed){changed=true;const [d,k]=domain.split('/');f.b.state.sisventas[d][k].observacion='Cambio concurrente';}});await f.run();
 assert.equal(f.b.commits.length,0);assert.equal(f.b.get('sisventas/reclamos/r').estado,'ot_activa');assert.equal(f.b.get('sisventas/'+domain).observacion,'Cambio concurrente');
 assert.equal(f.modal.removed,false);assert.equal(f.button.disabled,false);assert.deepEqual(f.b.get('sisventas/ventas/v'),f.sale);
});
