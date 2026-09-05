const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=require('./helpers/active-app').readActiveApp().source;
function extract(name){const start=src.indexOf('function '+name+'(');const end=src.indexOf('\nfunction ',start+10);return src.slice(start,end);}
const ctx={};vm.createContext(ctx);vm.runInContext(extract('_redondearPrecioActual'),ctx);vm.runInContext(extract('spIntegrarMaterialesOT'),ctx);
const merge=(v,ot)=>JSON.parse(JSON.stringify(ctx.spIntegrarMaterialesOT(v,ot)));
test('agrega mano de obra existente y adicionales con centavos, sin modificar originales',()=>{const v={items:[{cod:'MO',qty:1,punit:96480,sub:96480}]};const ot={fbKey:'ot',materiales:[{cod:'C',adicionalOT:true,qty:2,punit:2557.1,desc:'Cable'}]};const out=merge(v,ot);assert.equal(out.length,2);assert.equal(out[1].sub,5114.2);assert.equal(v.items.length,1);assert.deepEqual(merge({items:out},ot),out);});
test('mismo código en venta original y adicionales suma sólo la cantidad pendiente',()=>{const v={items:[{cod:'C',qty:2,punit:10,sub:20}]};const ot={materiales:[{cod:'C',vendida:2},{cod:'C',adicionalOT:true,qty:3,punit:12.25}]};const out=merge(v,ot);assert.equal(out[1].qty,3);assert.equal(out[1].sub,36.75);assert.deepEqual(merge({items:out},ot),out);});
test('material ya incorporado manualmente no se duplica',()=>{const v={items:[{cod:'C',qty:3,punit:10}]};assert.equal(merge(v,{materiales:[{cod:'C',adicionalOT:true,qty:3,punit:10}]}).length,1);});
test('precio ausente o ambiguo impide cerrar con importes inventados',()=>{assert.throws(()=>merge({items:[]},{materiales:[{cod:'C',adicionalOT:true,qty:1}]}),/precio/);assert.throws(()=>merge({items:[]},{materiales:[{cod:'C',adicionalOT:true,qty:1,punit:10},{cod:'C',adicionalOT:true,qty:1,punit:20}]}),/precio/);});

test('cerrar cobra o bonifica sólo mano de obra y persiste materiales y reclamo juntos',async()=>{
 for(const bonificada of [false,true]){
  const venta={fbKey:'v',items:[{cod:'MO',qty:1,punit:100,sub:100}],subtotal:100,iva:0,estadoPago:'pendiente_pago'};
  const reclamo={estado:'ot_activa',otKey:'ot'};
  const ot={fbKey:'ot',estado:'completada',materiales:[{cod:'C',qty:2,punit:10.25,adicionalOT:true}]};
  const writes=[];const c={...ctx,SP_DATA:{r:reclamo},SP_MODAL_KEY:'r',FB_PATHS:{ordenesTrabajo:'sisventas/ordenes_trabajo'},currentUser:'Vendedor',
   _svResolverVentaRegistro:()=>venta,_buscarOTCanonicaPorClave:()=>ot,otEstaCerrada:o=>o.estado==='completada',spVentaTieneDefinicionComercial:()=>false,
   svCrearProgresoBoton:()=>({finalizar(){}}),svFechaLocalISO:()=> '2026-09-05',spRenderLista(){},spActualizarMetricas(){},spAbrirModal(){},notify:m=>{if(m.startsWith('No se pudo'))throw Error(m);},
   window:{fbDB:{},fbRef:(_,p)=>p||'',fbGet:async p=>({val:()=>p.includes('reclamos')?reclamo:p.includes('ordenes_trabajo')?ot:venta}),fbUpdate:async(p,data)=>writes.push({p,data})}};
  vm.createContext(c);vm.runInContext(extract('spIntegrarMaterialesOT'),c);const start=src.indexOf('async function spConfirmarResolucionVisita('),end=src.indexOf('\nfunction ',start+10);vm.runInContext(src.slice(start,end),c);
  await c.spConfirmarResolucionVisita('r','v','MO',{querySelector:()=>({value:bonificada?'bonificada':'cobrada'}),remove(){}});
  assert.equal(writes.length,1);assert.equal(writes[0].p,'');assert.equal(writes[0].data['sisventas/ventas/v/total'],bonificada?20.5:120.5);assert.equal(writes[0].data['sisventas/reclamos/r/estado'],'cerrado');assert.equal(writes[0].data['sisventas/ventas/v/items'][1].sub,20.5);
 }
});

test('corrección de OT cerrada sincroniza eliminación y agregado con su venta',async()=>{
 const ot={fbKey:'ot',id:'OT',estado:'completada',materiales:[{cod:'C',qty:1,punit:10,adicionalOT:true}]};
 const venta={fbKey:'v',items:[{cod:'MO',qty:1,punit:100,sub:100},{cod:'C',qty:1,punit:10,sub:10}],subtotal:110,iva:0};
 const writes=[];const c={...ctx,currentRole:'vendedor',currentUser:'Vendedor',FB_PATHS:{ordenesTrabajo:'sisventas/ordenes_trabajo'},svFechaLocalISO:()=> '2026-09-05',otBuscarVentaOrigen:()=>venta,spVentaTieneDefinicionComercial:()=>false,window:{tienePermiso:()=>true,fbDB:{},fbRef:(_,p)=>p||'',fbGet:async p=>({val:()=>p.includes('ordenes_trabajo')?ot:venta}),fbUpdate:async(p,d)=>writes.push(d)}};
 vm.createContext(c);vm.runInContext(extract('spIntegrarMaterialesOT'),c);vm.runInContext(extract('otPuedeCorregirProductos'),c);
 const start=src.indexOf('async function otGuardarCorreccionProductos('),end=src.indexOf('\nasync function otEliminarProductoMaterial',start);vm.runInContext(src.slice(start,end),c);
 await c.otGuardarCorreccionProductos(ot,[{cod:'D',qty:2,punit:20.25,adicionalOT:true}],'Corrección',ot.materiales[0]);
 assert.equal(writes.length,1);assert.equal(writes[0]['sisventas/ventas/v/total'],140.5);assert.equal(writes[0]['sisventas/ventas/v/items'].some(i=>i.cod==='C'),false);assert.equal(writes[0]['sisventas/ordenes_trabajo/ot/materiales'][0].cod,'D');
});
