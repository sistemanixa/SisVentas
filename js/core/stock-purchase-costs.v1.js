(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVStockPurchaseCosts=api;})(typeof window==='object'?window:globalThis,function(){
'use strict';
const number=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0;
const round=v=>Math.round((v+Number.EPSILON)*100)/100;
const key=v=>String(v||'').replace(/[.#$\[\]\/]/g,'_').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,120);
function reference(product,state){
 if(!product||!state)return null;
 if(!state.loaded?.inventario_operativo)throw Error('Esperá a que termine de cargar el costo del stock antes de guardar.');
 const ids=[product.fbKey,product.id,product.codigo,product.cod].filter(Boolean).map(key),inventory=state.inventory||{};
 const stock=ids.map(id=>inventory[id]).find(Boolean),available=Number(stock?.general)||0;if(!(available>0))return null;
 if(stock.costoReferenciaStock){const c=stock.costoReferenciaStock;if(!number(c.unit)||!number(c.stamp)||!c.order)throw Error('El costo del stock requiere revisión.');return {...c,available};}
 if(!state.loaded?.ordenes)return null;
 const code=String(product.codigo||product.cod||'').trim().toUpperCase(),candidates=[];
 for(const order of state.orders||[]){
  if(order.ventaId||order.ventaFbKey||order.cancelacionPendiente||order.recepcionPendiente||!['recibida','recepcion_parcial'].includes(order.estado)||order.moneda&&order.moneda!=='ARS')continue;
  const matches=Object.values(order.items||{}).filter(i=>i.destino!=='venta'&&(i.productoKey&&ids.includes(key(i.productoKey))||code&&String(i.codigo||'').trim().toUpperCase()===code));
  let qty=0,total=0;for(const item of matches){const count=Number(item.cantidadCostoReal??item.cantidadRecibida)||0;if(!(count>0))continue;const unit=number(item.ultimoCostoReal)?Number(item.ultimoCostoReal):number(item.costoUnitarioReal)?Number(item.costoUnitarioReal):null;if(unit===null)continue;qty+=count;total+=count*unit;}
  if(qty)candidates.push({order:order.fbKey||order.numero,number:order.numero||'',stamp:Number(order.recibidoEn)||0,unit:total/qty,available});
 }
 candidates.sort((a,b)=>b.stamp-a.stamp||String(a.order).localeCompare(String(b.order)));
 if(candidates.length>1&&candidates[0].stamp===candidates[1].stamp&&candidates[0].unit!==candidates[1].unit)throw Error('Hay dos ingresos con costos distintos para este producto. Revisá el costo antes de guardar.');
 return candidates[0]||null;
}
function apply(item,ref,fallback,used=0){
 const qty=Number(item.qty??item.cantidad??1);if(!Number.isFinite(qty)||qty<=0)throw Error('Revisá la cantidad del producto.');
 if(!ref)return {...item};const stockQty=Math.min(qty,Math.max(0,ref.available-used)),remaining=qty-stockQty;if(!stockQty)return {...item};
 if(remaining&&!number(fallback))throw Error('Falta definir el costo de las unidades que no están en stock.');
 const total=round(stockQty*ref.unit+remaining*Number(fallback||0));
 return {...item,costoUnitarioCompra:total/qty,costoTotalCompra:total,costoUnitarioPresupuestado:total/qty,costoVersion:1,costoOrigen:'stock_ultimo_ingreso_final',costoCapturadoEn:Date.now(),costoStockReferencia:{orden:ref.order,numero:ref.number,fecha:ref.stamp,cantidad:stockQty,costoUnitario:ref.unit,cantidadFueraStock:remaining}};
}
async function load(root,record,baseline){
 const previous=Object.values(baseline?.items||{}),used=new Set(),products=new Map();
 for(const item of Object.values(record.items||{})){const index=previous.findIndex((p,i)=>!used.has(i)&&String(p.cod||p.codigo||p.pid)===String(item.cod||item.codigo||item.pid));if(index>=0){used.add(index);continue;}if(item.costoStockReferencia||item.preparacionCompra||item.compraExteriorAplicada||item.costoOrigen==='correccion_manual_autorizada')continue;const product=root.obtenerProductoPorCodigoVenta?.(item.cod||item.codigo,item);if(product&&!root.esProductoManoDeObra?.(product))products.set(String(product.fbKey||product.codigo),product);}
 if(!products.size||!root.fbGet||!root.fbDB)return root.SisVentasCompras?.state;
 const uid=root.currentUserUid,role=root.currentRole,db=root.fbDB,check=()=>{if(uid!==root.currentUserUid||role!==root.currentRole||db!==root.fbDB)throw Error('La sesión cambió. Volvé a abrir la venta.');};
 const state={inventory:{},orders:[],loaded:{inventario_operativo:true}},status=root.SVDataReadiness?.beginSource('inventario_operativo','costo-stock-guardado');
 try{for(const product of products.values()){check();const ids=[...new Set([product.fbKey,product.id,product.codigo,product.cod].filter(Boolean).map(key))];for(const id of ids){const snapshot=await root.fbGet(root.fbRef(db,'sisventas/compras_resumen/inventario_operativo/'+id));check();const value=snapshot.val();if(value){state.inventory[id]=value;break;}}}status?.ready();return state;}catch(error){if(uid!==root.currentUserUid||role!==root.currentRole||db!==root.fbDB)status?.cancel();else status?.error();throw error;}
}
function seed(products,state){
 const result=[];for(const product of products){const ids=[product.fbKey,product.id,product.codigo,product.cod].filter(Boolean).map(key),id=ids.find(k=>state.inventory?.[k]);if(!id||state.inventory[id].costoReferenciaStock)continue;const ref=reference(product,state);if(!ref)continue;const baseline=JSON.parse(JSON.stringify(state.inventory[id])),next={...baseline,costoReferenciaStock:{unit:ref.unit,order:ref.order,number:ref.number,stamp:ref.stamp,basis:'costo_final_con_gastos'}};result.push({key:id,baseline,next});}return result;
}
return Object.freeze({reference,apply,load,seed});
});
