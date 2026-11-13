'use strict';
const {digest}=require('./labor-guard'),Model=require('./office-stock-model'),isService=require('./ot-lifecycle-model').service,Policy=require('./office-stock-policy');
const key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['constructor','prototype','__proto__'].includes(v),fail=(statusCode,message,code)=>Object.assign(Error(message),{statusCode,code,svLaborAttempted:false});
const stockPath=k=>'sisventas/inventario_operativo/'+k,productPath=k=>'sisventas/productos/'+k;
const alias=v=>String(v||'').replace(/[.#$\[\]\/]/g,'_').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,120);
async function resolve(productKey,product,read){const candidates=[...new Set([productKey,product?.id,product?.codigo,product?.cod].filter(Boolean).map(alias))].filter(key),values=await Promise.all(candidates.map(async k=>[k,await read(k)])),found=values.filter(([,v])=>v!==null);if(found.length>1)throw fail(409,'Hay más de un registro de stock para este producto. Revisá las referencias antes de ajustar.','SV_OFFICE_STOCK_AMBIGUOUS');return found.length?{inventoryKey:found[0][0],inventory:found[0][1]}:{inventoryKey:candidates[0],inventory:null};}
const referenceHash=ref=>digest(ref);
function context(profile,cfg){
 const role=profile?.rol;if(profile?.activo!==true||!['admin','administrativo'].includes(role)||cfg?.indiceVersion!==2||cfg.indiceModulos?.stockoficina!==true||cfg.indiceModulos?.productos!==true||Object.values(cfg.bloqueados||{}).some(v=>['stockoficina','productos'].includes(v))||cfg.acciones?.stock?.ajustar===false)throw fail(403,'No tenés permiso para acceder a Stock de oficina.');
 return{role,permissionRevision:cfg.indiceRevision??null,permissionDigest:digest(cfg)};
}
function summary(inv){return inv&&Object.hasOwn(inv,'general')?{general:Model.quantity(inv.general),reservado:inv.reservado==null?null:Model.quantity(inv.reservado),revision:inv._svReadRevision??0}:null;}
function create({authorize,store,guard,queryPage,enabled=false,now=Date.now}){
 async function access(identity){if(!enabled)throw fail(503,'Stock de oficina todavía no está habilitado.','SV_OFFICE_STOCK_DISABLED');if(!identity?.uid||identity.claims?.uid!==identity.uid)throw fail(401,'Sesión requerida.');const ready=await store.read('sv_operational_read_config');if((await store.read('sv_labor_config/officeStockVersion'))!==1||ready?.schema!==1||ready.ready!==true)throw fail(503,'Stock de oficina está pendiente de preparar.','SV_OFFICE_STOCK_NOT_READY');const profile=await store.read('sv_chat_roles/'+identity.uid);return context(profile,await store.read('sv_permisos/'+profile?.rol));}
 async function verify(identity,expected){const current=await access(identity);if(digest(current)!==digest(expected))throw fail(409,'Los permisos cambiaron. Volvé a abrir el módulo.');}
 async function list(identity,body={}){
  const actor=await access(identity),cursor=body.cursor;
  if(Object.keys(body).some(k=>!['cursor','limit'].includes(k))||cursor!=null&&(!cursor||typeof cursor!=='object'||Array.isArray(cursor)||Object.keys(cursor).sort().join(',')!=='key,value'||!key(cursor.key)||!['string','number'].includes(typeof cursor.value)||typeof cursor.value==='string'&&cursor.value.length>128||typeof cursor.value==='number'&&(!Number.isFinite(cursor.value)||cursor.value<=0))||body.limit!==undefined&&body.limit!==50)throw fail(400,'Página de stock inválida.');
  // Numeric positives precede legacy strings in RTDB ordering. Preserve the
  // typed value and key so equal quantities and string zeros cannot skip rows.
  const records=await queryPage('sisventas/compras_resumen/inventario_operativo',{orderBy:'general',startAt:cursor?.value??Number.MIN_VALUE,after:cursor?.key||null,limit:cursor?52:51});
  const compareKey=(a,b)=>{const integer=k=>/^(0|[1-9]\d*)$/.test(k)&&Number(k)<=2147483647,ai=integer(a),bi=integer(b);return ai&&bi?Number(a)-Number(b):ai?-1:bi?1:a<b?-1:a>b?1:0;},rank=v=>typeof v==='number'?0:typeof v==='string'?1:2;
  let entries=Object.entries(records||{}).sort(([ak,a],[bk,b])=>rank(a?.general)-rank(b?.general)||(a?.general<b?.general?-1:a?.general>b?.general?1:0)||compareKey(ak,bk));if(cursor)entries=entries.filter(([k,v])=>!(k===cursor.key&&v?.general===cursor.value));
  const hasMore=entries.length>50;entries=entries.slice(0,50);const rows=[];let blocked=false;
  async function productFor(inventoryKey,inventory){
   const direct=await store.read(productPath(inventoryKey));if(direct)return{productKey:inventoryKey,product:direct};
   const references=[...new Set([inventory.codigo,inventoryKey].filter(v=>typeof v==='string'||typeof v==='number'))],matches=new Map();
   for(const field of ['codigo','cod','id'])for(const value of references){const variants=field==='id'&&typeof value==='string'&&/^\d+$/.test(value)?[value,Number(value)]:[value];for(const equalTo of variants){const found=await queryPage('sisventas/productos',{orderBy:field,equalTo,limit:2});for(const[k,p]of Object.entries(found||{}))if(key(k)&&p)matches.set(k,p);}}
   return matches.size===1?{productKey:[...matches.keys()][0],product:[...matches.values()][0]}:{productKey:null,product:null};
  }
  for(let start=0;start<entries.length;start+=6){const values=await Promise.all(entries.slice(start,start+6).map(async([inventoryKey,inventory])=>{
   if(!key(inventoryKey)||!inventory)throw fail(409,'Hay referencias de stock que necesitan revisión.');
   if(!['string','number'].includes(typeof inventory.general)){blocked=true;return null;}
   let amount;try{amount=Model.quantity(inventory.general);}catch(_){return{key:inventoryKey,productKey:null,code:String(inventory.codigo||inventoryKey),name:String(inventory.descripcion||'Stock por revisar'),unitLabel:String(inventory.unidad||''),inventory:null,review:true,invalid:true};}
   if(amount<=0)return null;
   const {productKey,product}=await productFor(inventoryKey,inventory),review=!product||isService({},product)||product.activo===false||product.estado==='inactivo'||product.eliminado===true;
   return{key:inventoryKey,productKey:review?null:productKey,code:String(product?.codigo||product?.cod||inventory.codigo||inventoryKey),name:String(product?.nombre||product?.descripcion||inventory.descripcion||'Stock por revisar'),unitLabel:String(product?.unidad||inventory.unidad||'Sin unidad confirmada'),photo:/^(https?:|data:image\/)/i.test(product?.imagenUrl||'')?product.imagenUrl:'',inventory:{general:amount,reservado:inventory.reservado==null?null:Model.quantity(inventory.reservado),revision:inventory._svReadRevision??0},review};
  }));rows.push(...values.filter(Boolean));}
  const last=entries.at(-1),next=hasMore&&last&&['string','number'].includes(typeof last[1]?.general)?{value:last[1].general,key:last[0]}:null;
  await verify(identity,actor);return{rows,cursor:next,ready:true,scanned:entries.length,complete:!hasMore&&!blocked,reviewRequired:blocked||rows.some(row=>row.review),continuation:hasMore};
 }
 async function detail(identity,{productKey}={}){const actor=await access(identity);if(!key(productKey))throw fail(400,'Producto inválido.');const p=await store.read(productPath(productKey));if(!p||isService({},p))throw fail(404,'El producto ya no está disponible.');const ref=await resolve(productKey,p,id=>store.read(stockPath(id)));await verify(identity,actor);return{inventory:summary(ref.inventory),expectedHash:referenceHash(ref),productKey};}
 async function history(identity,{productKey}={}){const actor=await access(identity);if(!key(productKey))throw fail(400,'Producto inválido.');const p=await store.read(productPath(productKey));if(!p||isService({},p))throw fail(404,'El producto ya no está disponible.');const ref=await resolve(productKey,p,id=>store.read(stockPath(id))),records=await queryPage(stockPath(ref.inventoryKey)+'/ajustesConteo',{orderBy:'fecha',last:true,limit:50});await verify(identity,actor);return{rows:Object.values(records||{}).filter(v=>v.tipo==='conteo_oficina').map(v=>({anterior:v.anteriorDesconocida?null:v.cantidadAnterior,nueva:v.cantidadContada,usuario:v.usuario||'Usuario sin identificar',observacion:v.motivo||'',ts:v.fecha})).sort((a,b)=>b.ts-a.ts).slice(0,50)};}
 async function save(identity,body){
  const actor=await access(identity);if(!body||Object.keys(body).some(k=>!['id','productKey','quantity','reason','expectedHash'].includes(k))||!key(body.id)||body.id.length<8||!key(body.productKey)||!/^[a-f0-9]{64}$/.test(body.expectedHash||''))throw fail(400,'Revisá el ajuste y su observación.');
  const runner={uid:identity.uid,claims:identity.claims,mode:'user',...actor,financialAction:'stock.ajustar',opId:body.id,operation:'office-stock-adjustment',transportDigest:digest(body),input:body};
  return guard.run(runner,async scope=>{const p=await scope.get(productPath(body.productKey));if(!p||isService({},p))throw fail(409,'El producto requiere revisión.');const ref=await resolve(body.productKey,p,id=>scope.get(stockPath(id))),path=stockPath(ref.inventoryKey),inv=ref.inventory;if(referenceHash(ref)!==body.expectedHash)throw fail(409,'El stock cambió. Actualizá la cantidad antes de guardar.','SV_OFFICE_STOCK_CONFLICT');const person={uid:identity.uid,name:(await scope.get('sv_chat_directorio/'+identity.uid))?.nombre||'Usuario',active:true,allowed:true,role:actor.role},plan=(()=>{try{return Model.plan(inv,{...body,expected:inv},person,now(),p);}catch(e){throw fail(409,e.message);}})();
   scope.beforeCommit(async({readFresh})=>{await verify(identity,actor);const latest=await readFresh(productPath(body.productKey));if(digest(latest)!==digest(p)||referenceHash(await resolve(body.productKey,latest,id=>readFresh(stockPath(id))))!==body.expectedHash)throw fail(409,'El stock o el producto cambió. Revisá antes de guardar.','SV_OFFICE_STOCK_CONFLICT');});Policy.issue(runner,scope.lease,ref.inventoryKey,plan.inventory);await scope.update({[path]:plan.inventory});return{ok:true,committed:true,operationId:body.id,inventory:summary({...plan.inventory,_svReadRevision:Number(inv?._svReadRevision??0)+1})};});
 }
 async function authorizeRequest(req){if(req.headers?.['x-sv-view-as']||req.headers?.['x-sisventas-view-as'])throw fail(403,'Volvé a tu cuenta para modificar stock.');return authorize(req);}
 return{authorize:authorizeRequest,list,detail,history,save};
}
module.exports={create,context,summary};
