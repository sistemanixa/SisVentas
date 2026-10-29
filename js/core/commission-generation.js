(function(root){
 'use strict';
 const number=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))&&Number(v)>=0;
 function snapshotCosts(record){
  if(!Array.isArray(record.items))return record;
  return {...record,items:record.items.map(item=>{
   if(number(item.costoUnitarioAntesPreparacion)||number(item.costoUnitarioPresupuestado))return item;
   let cost=null;for(const k of ['costoUnitarioCompra','costoUnitario','costoCompra'])if(number(item[k])){cost=Number(item[k]);break;}
   const qty=Number(item.qty??item.cantidad??1);
   if(cost===null&&qty>0&&number(item.costoTotalCompra))cost=Number(item.costoTotalCompra)/qty;
   if(cost===null){const product=root.obtenerProductoPorCodigoVenta?.(item.cod||item.codigo,item);if(product){const amount=root.obtenerCostoUnitarioVenta?.(item.cod||item.codigo,item);if(number(amount))cost=Number(amount);}}
   return cost===null?item:{...item,costoUnitarioPresupuestado:Math.round(cost*100)/100};
  })};
 }
 function preserveCosts(record,base){
  if(!Array.isArray(record.items)||!Array.isArray(base?.items))return record;
  const used=new Set();return {...record,items:record.items.map(item=>{
   const identity=i=>i.productoFbKey||i.pid||i.cod||i.codigo||i.desc||i.descripcion;
   const index=base.items.findIndex((old,i)=>!used.has(i)&&identity(old)&&identity(old)===identity(item));
   if(index<0)return item;used.add(index);const old=base.items[index],out={...item};
   const oldKnown=['costoUnitarioAntesPreparacion','costoUnitarioPresupuestado','costoUnitarioCompra','costoUnitario','costoCompra','costoTotalCompra'].some(k=>number(old[k]));
   if(old.comisionCostoHistoricoPendiente||!oldKnown){out.comisionCostoHistoricoPendiente=true;delete out.costoUnitarioAntesPreparacion;delete out.costoUnitarioPresupuestado;return out;}
   for(const k of ['costoUnitarioAntesPreparacion','costoUnitarioPresupuestado'])if(number(old[k]))out[k]=old[k];
   if(!number(out.costoUnitarioAntesPreparacion)&&!number(old.costoUnitarioPresupuestado)){
    for(const k of ['costoUnitarioCompra','costoUnitario','costoCompra'])if(number(old[k])){out.costoUnitarioPresupuestado=Number(old[k]);break;}
    const qty=Number(old.qty??old.cantidad??1);if(!number(out.costoUnitarioPresupuestado)&&qty>0&&number(old.costoTotalCompra))out.costoUnitarioPresupuestado=Number(old.costoTotalCompra)/qty;
   }
   return out;
  })};
 }
 async function request(action,venta){
  const user=root.fbAuth?.currentUser,uid=root.currentUserUid;
  if(!user||user.uid!==uid)throw Error('Volvé a tu cuenta para gestionar la venta');
  if(!venta?.fbKey)throw Error('Falta la referencia guardada de la venta');
  const token=await user.getIdToken();if(user!==root.fbAuth.currentUser||uid!==root.currentUserUid)throw Error('La sesión cambió');
  const base=root.SISVENTAS_FUNCTIONS?.cotizadorProveedor;if(!base)throw Error('Servicio no disponible');
  const payload={ventaFbKey:venta.fbKey};if(action==='generar'&&typeof venta.cobroOperacionId==='string'&&/^[A-Za-z0-9_-]{8,160}$/.test(venta.cobroOperacionId))payload.cobroOperacionId=venta.cobroOperacionId;
  const res=await fetch(base+'/comisiones/generacion/'+action,{method:'POST',cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)});
  const result=await res.json();if(user!==root.fbAuth.currentUser||uid!==root.currentUserUid)throw Error('La sesión cambió');
  if(!res.ok||!result.ok){
   const message=result.mensaje||'La comisión quedó pendiente';
   const commissionStatus=res.status===409?(message==='La comisión se está generando en otra sesión. Reintentá'?'procesando':'revision'):'pendiente_confirmacion';
   throw Object.assign(Error(message),{statusCode:res.status,httpStatus:res.status,commissionStatus});
  }
  return result;
 }
 // La operación que cobró la venta necesita el estado completo para confirmar
 // el registro o informar revisión sin presentar el cobro guardado como fallido.
 async function generate(venta){if(!venta||venta.comisionHabilitada!==true)return {status:'no_aplica',motivo:'La venta no tiene comisión habilitada',participantes:[]};return request('generar',venta);}
 root.SVCommissionGeneration={snapshotCosts,preserveCosts,request,generate};
})(window);
