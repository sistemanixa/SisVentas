(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVPostventaDemand=api.create(root);})(typeof window==='object'?window:null,function(){
 'use strict';
 const safe=k=>typeof k==='string'&&k.length>0&&k.length<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(k)&&!['__proto__','constructor','prototype'].includes(k);
 const text=v=>String(v==null?'':v).trim();
 function create(root){
  let epoch=0,opening=0,point=null,navigating=false;const listeners=[],financial=new WeakMap();
  const route=()=>root.document?.querySelector?.('.page.active')?.id?.replace(/^page-/,'')||root._svPaginaDesdeRuta?.();
  const capture=()=>({auth:root.fbAuth?.currentUser,uid:root.currentUserUid,role:root.currentRole,db:root.fbDB,base:root.SISVENTAS_FUNCTIONS?.cotizadorProveedor,revision:root.PERMISOS_ROLES?.[root.currentRole]?.indiceRevision,route:route(),epoch});
  const valid=(c,includeRoute=true)=>{const n=capture();return !!c?.auth&&c.auth.uid===c.uid&&c.auth===n.auth&&c.uid===n.uid&&c.role===n.role&&c.db===n.db&&c.base===n.base&&c.revision===n.revision&&c.epoch===n.epoch&&(!includeRoute||c.route===n.route)&&!root.document?.hidden&&!root._impersonacionOriginal&&root.navigator?.onLine!==false;};
  const stale=()=>Object.assign(Error('La sesión o la pantalla cambió. Volvé a intentar.'),{name:'AbortError'});
  function reset(){const hadPoint=!!point;epoch++;opening++;point=null;const el=root.document?.getElementById?.('venta-detalle-view');if(hadPoint&&el){el.style.display='none';if(el.dataset)delete el.dataset.svPostventaPoint;}}
  function begin(isCurrent=()=>true,onRevocation){
   const actor=capture();const current=()=>valid(actor)&&isCurrent()===true;
   const assertCurrent=()=>{if(!current())throw stale();};
   async function request(path){assertCurrent();try{const result=await root.SVCommercialOwnership.request('ventas',path);assertCurrent();return result;}catch(error){assertCurrent();if([401,403].includes(error.status)){reset();onRevocation?.(error);}throw error;}}
   const record=(value,key)=>{if(!value||typeof value!=='object'||Array.isArray(value)||value._svListSummary||value._svPagedSummary||value.fbKey!=null&&value.fbKey!==key)throw Error('No se pudo verificar la venta completa.');return {...value,fbKey:key};};
   async function byKey(key){if(!safe(key))throw Error('Referencia de venta inválida.');return record((await request('registro/'+encodeURIComponent(key))).record,key);}
   async function financialByKey(key){
    assertCurrent();if(!safe(key)||!root.SVCommercialPagesReader?.create)throw Error('El detalle financiero puntual no está disponible.');
    let original;
    const reader=root.SVCommercialPagesReader.create({sdk:{ref:root.fbRef,get:root.fbGet},capture:()=>current()?{...actor,permissionRevision:actor.revision,hidden:false,viewing:false,online:true}:null,detailRead:async()=>{original=await byKey(key);return original;}});
    try{const result=await reader.detail('sales',key);assertCurrent();const value=record(original,key),summary=result.summary;
     if(summary?.key!==key||!['totalCents','paidCents','balanceCents'].every(k=>Number.isSafeInteger(summary[k])&&summary[k]>=0))throw Error('No se pudo verificar el estado financiero vigente.');
     financial.set(value,{actor,summary});return value;
    }finally{reader.reset();}
   }
   async function complete(){const data=await request('');if(!data.records||typeof data.records!=='object'||Array.isArray(data.records))throw Error('No se pudo verificar la búsqueda completa.');return Object.entries(data.records).map(([key,value])=>{if(!safe(key))throw Error('Referencia de venta inválida.');return record(value,key);});}
   async function saleKey(reclamo={},ot={}){
    const sources=[reclamo,ot||{}],keys=[...new Set(sources.flatMap(r=>[r.ventaFbKey,r.ventaKey]).map(text).filter(Boolean))];
    if(keys.length>1)throw Error('Hay referencias de venta distintas. Revisá el vínculo antes de continuar.');
    if(keys.length){if(!safe(keys[0]))throw Error('Referencia de venta inválida.');return keys[0];}
    const refs=[...new Set(sources.flatMap(r=>[r.ventaId,r.venta]).map(text).filter(Boolean))];if(!refs.length)return null;
    const rows=(await complete()).filter(v=>[v.fbKey,v.id,v.numero,v.idOriginal,v.ventaId].some(x=>refs.includes(text(x))));
    if(rows.length>1)throw Error('La referencia histórica coincide con varias ventas. Repará el vínculo.');
    if(!rows.length)throw Error('La venta referenciada no está disponible para tu cuenta.');return rows[0].fbKey;
   }
   async function sale(reclamo,ot){const key=await saleKey(reclamo,ot);return key?byKey(key):null;}
   return {actor,current,assertCurrent,byKey,financialByKey,complete,saleKey,sale};
  }
  async function perform(action,isCurrent=()=>true){const reported=new WeakSet(),read=begin(isCurrent,error=>{reported.add(error);root.notify?.(error.message||'No se pudo consultar la venta.');});try{return await action(read);}catch(error){const revoked=[401,403].includes(error.status)&&valid({...read.actor,epoch})&&isCurrent()===true;if(!reported.has(error)&&error.name!=='AbortError'&&(read.current()||revoked))root.notify?.(error.message||'No se pudo consultar la venta.');return false;}}
  function name(row,resolve){const client=resolve?.(row);return String(client?.nombre||row?.cliente||row?.clienteNombre||row?.nombreCliente||'—');}
  function claimsPointView(page){return !!point&&page==='detalle'&&(route()==='detalle'||navigating)&&valid(point.actor,false)&&root.permisoModulo?.('detalle')===true&&root.svPuedeLeerDominio?.('ventas')===true;}
  function resolve(ref){if(!claimsPointView('detalle'))return null;return [point.record.fbKey,point.record.id,point.record.numero].includes(typeof ref==='object'?ref?.fbKey:ref)?point.record:null;}
  function summary(value){const item=value&&financial.get(value);return item&&valid(item.actor,false)?item.summary:null;}
  async function open(reclamo,ot,isCurrent=()=>true){const intent=++opening;return perform(async read=>{
   if(root.permisoModulo?.('detalle')!==true||root.svPuedeLeerDominio?.('ventas')!==true)throw Error('Tu rol no permite abrir ventas.');
   const key=await read.saleKey(reclamo,ot);read.assertCurrent();if(!key)throw Error('El reclamo no tiene una venta referenciada.');
   const value=await read.financialByKey(key);read.assertCurrent();
   if(root.permisoModulo?.('detalle')!==true||root.svPuedeLeerDominio?.('ventas')!==true)throw Error('Tu rol no permite abrir ventas.');
   const view={...value,_svOwnerUid:summary(value).ownerUid};financial.set(view,financial.get(value));
   point={actor:read.actor,record:view,reclamoKey:reclamo.fbKey,origin:route(),focus:root.document?.activeElement,scroll:root.document?.querySelector?.('.content')?.scrollTop};
   navigating=true;let opened=false;try{opened=root.svNavegarDirecto('detalle',()=>{if(!claimsPointView('detalle'))return;root.spCerrarModal?.();root.verVenta(value.fbKey);});}catch(error){reset();throw error;}finally{navigating=false;}
   if(opened!==true||!claimsPointView('detalle')){reset();return false;}const panel=root.document?.getElementById?.('venta-detalle-view');if(panel?.dataset)panel.dataset.svPostventaPoint='true';return true;
  },()=>intent===opening&&isCurrent()===true);}
  function back(){if(!claimsPointView('detalle'))return false;const old=point;root.svNavegarDirecto(old.origin,()=>{reset();root.spAbrirModal?.(old.reclamoKey);});if(valid(old.actor,false)){const content=root.document?.querySelector?.('.content');if(content&&Number.isFinite(old.scroll))content.scrollTop=old.scroll;if(old.focus?.isConnected)old.focus.focus?.({preventScroll:true});}return true;}
  for(const event of ['sisventas:session-ended','sisventas:role-changed','sisventas:session-changed','sisventas:permissions-changed']){root.document?.addEventListener?.(event,reset);listeners.push([event,reset]);}
  const check=()=>{if(point&&!navigating&&!claimsPointView('detalle'))reset();};for(const event of ['sisventas:page-changed','visibilitychange','sisventas:data-state-changed']){root.document?.addEventListener?.(event,check);listeners.push([event,check]);}
  return {begin,perform,name,open,resolve,summary,claimsPointView,back,reset,dispose(){reset();for(const [event,handler]of listeners)root.document?.removeEventListener?.(event,handler);}};
 }
 return {create};
});
