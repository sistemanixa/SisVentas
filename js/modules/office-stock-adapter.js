(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SVStockCatalogJoin=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  function join(rows, catalog, isService){
    if(typeof isService!=='function')throw Error('Falta el criterio de productos y servicios.');
    const byKey=new Map();
    for(const product of Object.values(catalog??{})){
      if(!product?.fbKey)continue;
      byKey.set(product.fbKey,byKey.has(product.fbKey)?null:product);
    }
    return rows.map(row=>{
      if(row.invalid)return row;
      const product=byKey.get(row.key);
      if(!product||product.eliminado===true||isService(product))return row;
      const code=product.codigo||product.cod||row.code;
      if(row.code!==row.key&&String(row.code)!==String(code))return row;
      const inactive=product.activo===false||product.estado==='inactivo';
      return {...row,productKey:row.key,code:String(code),
        name:String(product.nombre||product.descripcion||row.name),
        unitLabel:String(product.unidad||row.unitLabel||'Sin unidad confirmada'),
        photo:typeof product.imagenUrl==='string'&&/^(?:https?:\/\/|data:image\/(?:png|jpeg|webp|gif);base64,)/i.test(product.imagenUrl)?product.imagenUrl:'',
        review:false,canZero:inactive};
    });
  }
  return {join};
});


(function(root){'use strict';
function create({lookupInventory=null}={}){
 const uid=root.currentUserUid,user=root.fbAuth?.currentUser,role=root.currentRole,epoch=root._svOperacionesSesionEpoch||0;
 function session(){return{uid:root.currentUserUid,role:root.currentRole,revision:root._svOperacionesSesionEpoch||0,active:root.fbAuth?.currentUser===user&&user?.uid===uid&&root.currentUserUid===uid&&root.currentRole===role&&(root._svOperacionesSesionEpoch||0)===epoch,viewAs:!!root._impersonacionOriginal,allowed:root.permisoModulo?.('stockoficina')===true&&root.tienePermiso?.('stock.ajustar')===true};}
 function check(){const s=session();if(!s.active||s.viewAs||!s.allowed||!['admin','administrativo'].includes(s.role))throw Error('La sesión o los permisos cambiaron.');}
 async function request(action,body,{signal}={}){check();const base=(root.SISVENTAS_FUNCTIONS?.cotizadorProveedor||'').replace(/\/$/,'');if(!base)throw Object.assign(Error('No está disponible Stock de oficina.'),{svLaborAttempted:false});const headers=await root.SVServiceAuth.headers({'Content-Type':'application/json'});check();let response,data;try{const timeout=AbortSignal.timeout(action==='ajustar'?90000:20000);response=await root.fetch(base+'/stock-oficina/'+action,{method:'POST',headers,body:JSON.stringify(body),cache:'no-store',signal:signal?AbortSignal.any([signal,timeout]):timeout});data=await response.json();}catch(e){check();throw e;}check();if(!response.ok||data.ok!==true)throw Object.assign(Error(data.mensaje||'No se pudo completar la consulta.'),{code:data.code,...(data.svLaborAttempted===false?{svLaborAttempted:false}:{})});return data;}
 async function provenance(row){
 check();const valid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['constructor','prototype','__proto__'].includes(v);if(!valid(row.key)||!valid(row.productKey||row.key)||row.review)throw Error('Primero hay que identificar el producto de este registro.');
 const adjustments=await request('historial',{productKey:row.productKey||row.key});check();const binding=adjustments.reference;if(binding&&(!valid(binding.inventoryKey)||binding.productKey!==(row.productKey||row.key)))throw Error('No se pudo confirmar el vínculo del historial.');const inventoryKey=binding?.inventoryKey||row.key;const result={adjustments:adjustments.rows||[],purchases:[],notice:'Estos registros no permiten atribuir todas las unidades disponibles a una compra concreta.',purchaseNotice:''};
 if(!root.fbDB||!root.fbGet||!root.fbRef){result.purchaseNotice='No está disponible la consulta de compras vinculadas.';return result;}
 const read=async path=>{check();const value=(await root.fbGet(root.fbRef(root.fbDB,path))).val();check();return value;};
 try{const ref=await read('sisventas/inventario_operativo/'+inventoryKey+'/costoReferenciaStock');if(!ref||typeof ref!=='object'||!valid(ref.order)){result.purchaseNotice='No hay una compra de referencia registrada.';return result;}
 if(root.permisoModulo?.('ordenes')!==true||root.permisoModulo?.('balancecompra')!==true){result.purchaseNotice='Tu rol no permite consultar la compra vinculada.';return result;}
 const order=await read('sisventas/ordenes/'+ref.order);if(root.permisoModulo?.('ordenes')!==true||root.permisoModulo?.('balancecompra')!==true)throw Error('Los permisos cambiaron.');if(!order){result.purchaseNotice='La compra de referencia ya no está disponible.';return result;}
 const matches=item=>item&&((item.productoKey&&item.productoKey===(row.productKey||row.key))||(!item.productoKey&&String(item.codigo||'').trim()===String(row.code||'').trim()&&!!row.code));
 const receipts=Object.values(order.recepciones||{}).filter(r=>r&&ref.receipt&&r.id===ref.receipt),items=receipts.length===1&&!order.ventaId&&!order.ventaFbKey?receipts.flatMap(r=>Object.values(r.items||{}).filter(item=>matches(item)&&item.destino!=='venta'&&Number.isFinite(Number(item.cantidad))&&Number(item.cantidad)>0).map(item=>({quantity:item.cantidad,date:r.fecha||'',stamp:r.ts||null}))):[];
 if(items.length){result.purchases.push({key:ref.order,number:String(order.numero||ref.number||'Compra vinculada'),provider:String(order.proveedor||''),receipts:items});result.purchaseNotice='Última recepción vinculada. No representa necesariamente todo el stock disponible.';}
 else if(Object.values(order.items||{}).some(matches)){result.purchases.push({key:ref.order,number:String(order.numero||ref.number||'Compra vinculada'),provider:String(order.proveedor||''),receipts:[]});result.purchaseNotice='Compra usada como referencia de costo; no hay una recepción vinculada verificable.';}
 else result.purchaseNotice='La referencia guardada no coincide con los productos de esa compra.';
 }catch(error){check();result.purchaseNotice='No se pudo consultar la compra vinculada. '+(error.code==='PERMISSION_DENIED'?'Tu rol no autoriza esa lectura.':'Volvé a intentar.');}check();return result;
 }
 const rawRows=new Map(),confirmedReferences=new Map();let listEpoch=0,listController=null;
 const validReferenceKey=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)&&!['constructor','prototype','__proto__'].includes(value);
 function cancel(){listEpoch++;listController?.abort();listController=null;}
 function loadedCatalog(){
   const catalog=root.prodData;
   return root.SVDataReadiness?.status(['productos']).ready&&catalog&&Object.keys(catalog).length&&typeof root.esProductoManoDeObra==='function'?catalog:null;
 }
 function redecorate(rows){
   const catalog=loadedCatalog();
   const pending=catalog?rows.filter(row=>rawRows.has(row.key)).map(row=>({...rawRows.get(row.key),inventory:row.inventory})):[],enriched=new Map(catalog?root.SVStockCatalogJoin.join(pending,catalog,root.esProductoManoDeObra).map(row=>[row.key,row]):[]),products=catalog&&confirmedReferences.size?new Map():null;if(products)for(const product of Object.values(catalog))if(product?.fbKey)products.set(product.fbKey,products.has(product.fbKey)?null:product);
   return rows.map(row=>{const ordinary=enriched.get(row.key)||row,known=confirmedReferences.get(row.key);if(!known)return ordinary;const product=products?products.get(known.productKey):known.product;if(!product||product.eliminado===true||typeof root.esProductoManoDeObra!=='function'||root.esProductoManoDeObra(product))return{...ordinary,productKey:null,review:true,canZero:false};const inactive=product.activo===false||product.estado==='inactivo',canZero=inactive&&known.productKey===row.key;return{...ordinary,productKey:inactive&&!canZero?null:known.productKey,name:String(product.nombre||product.descripcion||ordinary.name),code:String(product.codigo||product.cod||ordinary.code),unitLabel:String(product.unidad||ordinary.unitLabel),photo:typeof product.imagenUrl==='string'&&/^(?:https?:\/\/|data:image\/(?:png|jpeg|webp|gif);base64,)/i.test(product.imagenUrl)?product.imagenUrl:'',reference:{...known.reference},review:inactive&&!canZero,canZero};});
 }
 async function list({cursor,limit,signal}={}){
   cancel();const turn=listEpoch,controller=typeof lookupInventory==='function'?new AbortController():null;listController=controller;
   const combined=controller?(signal?AbortSignal.any([controller.signal,signal]):controller.signal):signal;
   const current=()=>{check();if(turn!==listEpoch||combined?.aborted)throw Object.assign(Error('La consulta se canceló.'),{name:'AbortError'});};
   const compact=!!loadedCatalog();
   const data=await request('listar',compact?{cursor,limit,compact:true}:{cursor,limit},{signal:combined});current();if(!Array.isArray(data.rows)||data.rows.length>100)throw Error('El listado de Stock requiere una página válida.');
   if(!cursor){rawRows.clear();confirmedReferences.clear();}
   for(const row of data.rows)if(compact||row.productKey===row.key){
     rawRows.set(row.key,{...row,productKey:null,photo:'',review:true,canZero:false});
   }
   let rows=redecorate(data.rows);
   if(typeof lookupInventory==='function'&&root.permisoModulo?.('productos')===true){
    const unknown=rows.filter(row=>row.review&&!row.invalid&&validReferenceKey(row.key));let index=0;
    await Promise.all(Array.from({length:Math.min(6,unknown.length)},async()=>{while(index<unknown.length){current();const row=unknown[index++];let result;try{result=await lookupInventory({inventoryKey:row.key},{signal:combined});}catch(error){current();continue;}current();if(root.permisoModulo?.('productos')!==true)throw Error('Los permisos de Productos cambiaron.');const reference=result?.reference,product=result?.product;if(!result||!reference||reference.mapped!==true||reference.inventoryKey!==row.key||reference.productKey!==result.productKey||!validReferenceKey(result.productKey)||!validReferenceKey(reference.receiptIdentityKey)||!Number.isSafeInteger(reference.mappingRevision)||reference.mappingRevision<1||!product||typeof product!=='object'||Array.isArray(product)||product.fbKey!==undefined&&product.fbKey!==result.productKey||product.eliminado===true||product.activo===false||product.estado==='inactivo'||typeof root.esProductoManoDeObra!=='function'||root.esProductoManoDeObra(product))continue;confirmedReferences.set(row.key,{productKey:result.productKey,product:{...product},reference:{...reference}});}}));
    current();rows=redecorate(data.rows);
   }
   if(listController===controller)listController=null;
   return {...data,rows};
 }
 function onCatalogChange(callback){
   document.addEventListener('sisventas:stock-catalog-changed',callback);
   return ()=>document.removeEventListener('sisventas:stock-catalog-changed',callback);
 }
 return{session,provenance,redecorate,onCatalogChange,cancel,openPurchase:async key=>{check();if(!/^[A-Za-z0-9_-]{1,128}$/.test(key)||root.permisoModulo?.('ordenes')!==true||root.permisoModulo?.('balancecompra')!==true)throw Error('No tenés permiso para abrir esta compra.');if(!root.SisVentasCompras?.openOrder)throw Error('No está disponible el detalle de Compras.');await root.SisVentasCompras.openOrder(key);check();},products:async({signal}={})=>{check();if(!root.SVDataReadiness?.waitForPage||typeof root.fbCargarProductos!=='function')throw Error('No está disponible el catálogo.');root.fbCargarProductos();const state=await root.SVDataReadiness.waitForPage('productos',{signal,isCurrent:()=>session().active&&session().allowed&&!session().viewAs});check();if(!state.ready)throw Error(state.cancelled?'La consulta se canceló.':'No se pudo cargar el catálogo. Volvé a intentar.');const catalog=root.prodData;if(!catalog||!Object.keys(catalog).length)throw Error('El catálogo todavía no está listo. Volvé a intentar en unos instantes.');return Object.values(catalog).filter(p=>p&&p.fbKey&&p.activo!==false&&p.estado!=='inactivo'&&!p.eliminado&&typeof root.esProductoManoDeObra==='function'&&!root.esProductoManoDeObra(p)).map(p=>({key:p.fbKey,code:String(p.codigo||p.cod||p.fbKey),name:String(p.nombre||p.descripcion||'Producto'),unitLabel:String(p.unidad||'Sin unidad confirmada'),photo:p.imagenUrl||'',inventory:null}));},list,detail:productKey=>request('detalle',{productKey}),history:async productKey=>(await request('historial',{productKey})).rows,save:async body=>{check();if(!root.SVLaborWriteRecovery?.execute||!root.SVLaborWrites?.hash)throw Object.assign(Error('El guardado seguro no está listo.'),{svLaborAttempted:false});root.SVLaborWriteRecovery.assertAvailable();const command={id:body.id,productKey:body.productKey,quantity:body.quantity,reason:body.reason,expectedHash:body.expectedHash},digest=await root.SVLaborWrites.hash(command);check();return root.SVLaborWriteRecovery.execute({uid,id:command.id,digest},()=>request('ajustar',command),check);}};
}
root.SVOfficeStockAdapter=Object.freeze({create});
})(window);
