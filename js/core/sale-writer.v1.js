(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./commercial-money.v1.js'):root.SVCommercialMoney,typeof module==='object'&&module.exports?require('./sale-economics-model.v1.js'):root.SVSaleEconomicsModel);if(typeof module==='object'&&module.exports)module.exports=api;else root.SVSaleWriter=api.create(root);})(typeof window==='object'?window:null,function(Money,Economics){
 'use strict';
 const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
 const itemPrice=Economics.itemPrice;
 const protectedFields=['pagos','totalPagado','factura','facturas','comisionGenerada','comisionesGeneradas','comisionHabilitada','comisionados','empleado','empleadoUid','comisionadoPrincipalUid','comisionadoSecundarioUid'];
 const calculate=Economics.calculate;
 function create(root){
  function prepare(record,baseline,stockContext){
   if(!record||typeof record!=='object'||Array.isArray(record))throw Error('La venta no es válida.');
   if(record._svPagedSummary||record._svPagedCollectionRecord||record._svPageRow||baseline?._svPagedSummary||baseline?._svPagedCollectionRecord)throw Error('Abrí la ficha completa antes de guardar una venta.');
   if(!root.SVSaleCosts)throw Error('Recargá la aplicación antes de guardar la venta.');
   let next=clone(record);
   if(!baseline){
    next={moneda:'ARS',monedaOperativa:'ARS',pagos:[],totalPagado:0,estadoPago:'pendiente_pago',...next};
    const normalize=item=>{
     const qty=Number(item.qty??item.cantidad??1),punit=itemPrice(item),disc=Number(item.disc??item.descuento??0);
     if(!Number.isFinite(qty)||qty<=0||!Number.isFinite(punit)||!Number.isFinite(disc)||disc<0||disc>100)throw Error('Revisá cantidad, precio y descuento de la venta.');
     const sub=Number(item.sub??Math.round(qty*punit*(1-disc/100)*100)/100);
     if(!Number.isFinite(sub))throw Error('El subtotal del ítem no es válido.');
     return {...item,qty,punit,disc,sub};
    };
    if(Array.isArray(next.items))next.items=next.items.map(normalize);
    else if(next.items&&typeof next.items==='object')next.items=Object.fromEntries(Object.entries(next.items).map(([key,item])=>[key,normalize(item)]));
   }
   if(baseline){
    next=root.SVCommercialDocument.preserve(next,baseline);
    for(const key of protectedFields){
     const configurable=['comisionHabilitada','comisionados','empleado','empleadoUid','comisionadoPrincipalUid','comisionadoSecundarioUid'].includes(key);
     if(configurable&&root.tienePermiso?.('ventas.configurarComision')===true)continue;
     if(Object.hasOwn(baseline,key))next[key]=clone(baseline[key]);else delete next[key];
    }
   }
   if(Object.hasOwn(next,'items'))next=root.SVSaleCosts.prepare(next,baseline,stockContext);
   else if(!baseline)throw Error('La venta necesita ítems con costo.');
   const economics=value=>JSON.stringify({items:Object.values(value?.items||{}).map(i=>[i.qty??i.cantidad,i.punit??i.precio??i.precioUnitario,i.disc??i.descuento]),general:value?.descuentoGeneral??value?.descuentoPct??value?.porcentajeDescuento??0,conIva:value?.conIva});
   if(Object.hasOwn(next,'items')&&(!baseline||economics({...baseline,...next})!==economics(baseline)))next=calculate(next,baseline);
   if(!baseline){next.ventaFormatoVersion=1;if(!next.creadorOriginalUid&&!next.creadorOriginalNombre&&root.SVCommercialOwnership?.stamp)next=root.SVCommercialOwnership.stamp(next);}
   root.garantiaSnapshotVenta?.(next);
   return next;
  }
  function session(){const uid=root.currentUserUid,role=root.currentRole,auth=root.fbAuth,user=auth?.currentUser,db=root.fbDB,revision=root.PERMISOS_ROLES?.[role]?.indiceRevision,epoch=root._svOperacionesSesionEpoch;const check=()=>{if(!uid||!role||root._impersonacionOriginal||auth&&(!user||user.uid!==uid)||uid!==root.currentUserUid||role!==root.currentRole||auth!==root.fbAuth||user!==root.fbAuth?.currentUser||db!==root.fbDB||revision!==root.PERMISOS_ROLES?.[role]?.indiceRevision||epoch!==root._svOperacionesSesionEpoch)throw Error('La sesión cambió o se modificó el contexto. Volvé a abrir la venta.');};check();return check;}
  // Todos los documentos comerciales terminan aquí. Los vínculos se confirman
  // en la misma escritura existente; no se separan venta, OT y presupuesto.
  async function commit({record,baseline,key,related={},basePath='',partial=false,transaction,confirmLocal=false}={}){
   const check=session(),stockContext=await root.SVStockPurchaseCosts?.load(root,record,baseline);check();const next=prepare(record,baseline,stockContext);check();
   const localContext=confirmLocal?root.SVCommercialOwnership?.captureWriteContext?.('ventas'):null;
   if(transaction){
    const result=await root.fbRunTransaction(transaction.ref,current=>{check();return transaction.apply(current,clone(next));});check();return result;
   }
   if(!key||/[.#$\[\]/]/.test(key))throw Error('Falta la clave válida de la venta.');
   const collection=root.FB_PATHS?.ventas||'sisventas/ventas';
   const path=(basePath==='sisventas'?collection.replace(/^sisventas\//,''):collection)+ '/' + key;
   const updates=clone(related);
   for(const p of Object.keys(updates))if(p===path||p.startsWith(path+'/')||path.startsWith(p+'/'))throw Error('La venta no puede escribirse dos veces en la misma operación.');
   const data=clone(next);delete data.fbKey;
   if(partial){for(const [field,value]of Object.entries(data))updates[path+'/'+field]=value;}
   else updates[path]=data;
   if(typeof root.SVLaborWrites?.atomic!=='function')throw Error('No está listo el guardado protegido de la venta.');
   const absolute=Object.fromEntries(Object.entries(updates).map(([p,value])=>[[basePath,p].filter(Boolean).join('/'),value]));
   const salePath=collection+'/'+key,paths=[salePath];
   // Los vínculos no financieros conservan la escritura autorizada del origen;
   // no se exige leer notificaciones privadas para poder crear una venta.
   for(const p of Object.keys(absolute))if(root.SVLaborWrites.intersects?.(p)){const scoped=p.split('/').slice(0,3).join('/');if(!paths.includes(scoped))paths.push(scoped);}
   const equal=root.SVGuardedWrites?.equal||((a,b)=>JSON.stringify(a)===JSON.stringify(b));
   const clean=value=>{const out=clone(value);if(out)delete out.fbKey;return out;};
   let reused=false;
   check();const result=await root.SVLaborWrites.atomic({paths,build:values=>{
    check();const current=values[salePath];
    if(baseline){if(!equal(clean(current),clean(baseline)))throw Error('La venta cambió. Volvé a abrirla antes de guardar.');}
    else if(current){if(equal(clean(current),data)){reused=true;return undefined;}throw Error('La venta ya existe; no se sobrescribió.');}
    return absolute;
   }});check();if(!result?.committed&&!reused)throw Error('No se confirmó el guardado de la venta.');
   if(localContext&&typeof root.SVCommercialOwnership?.confirmWrite==='function')root.SVCommercialOwnership.confirmWrite('ventas',{...next,fbKey:key},localContext);
   else root.SVCommercialOwnership?.refresh?.('ventas');
   return {...next,fbKey:key};
  }
  async function save(record,baseline){
   const check=session(),key=record?.fbKey;
   if(key){const prepared=await root.SVCommercialOwnership.prepare('ventas',key,baseline);check();baseline=prepared.baseline||prepared.record;}
   const stockContext=await root.SVStockPurchaseCosts?.load(root,record,baseline);check();const next=prepare(record,baseline,stockContext);check();
   if(key){
    if(!baseline||!root.SVGuardedWrites)throw Error('No está listo el guardado protegido de la venta.');
    const saved=await root.SVGuardedWrites.save((root.FB_PATHS?.ventas||'sisventas/ventas')+'/'+key,baseline,next,true);check();root.SVCommercialOwnership?.refresh?.('ventas');return {...saved,fbKey:key};
   }
   const ref=root.fbPush(root.fbRef(root.fbDB,root.FB_PATHS?.ventas||'sisventas/ventas'));
   return commit({record:next,key:ref.key});
  }
  return Object.freeze({prepare,commit,save,calculate});
 }
 return Object.freeze({create,protectedFields,calculate});
});
