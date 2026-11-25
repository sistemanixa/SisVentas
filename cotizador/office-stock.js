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
function create({authorize,store,guard,queryPage,resolver=null,initialInventoryReference=null,enabled=false,now=Date.now}){
 async function resolveCurrent(productKey,product,read,queryPageFresh=store.queryPage){
  const legacy=pointRead=>resolve(productKey,product,id=>pointRead(stockPath(id)));
  if(resolver===null)return legacy(read);
  if(typeof resolver?.resolve!=='function'||typeof resolver?.assertFresh!=='function')throw fail(503,'Falta el verificador de referencias de Stock.','SV_OFFICE_STOCK_NOT_READY');
  const ref=await resolver.resolve({productKey,product},{read,queryPage:queryPageFresh,legacy});
  if(!ref||!key(ref.inventoryKey)||ref.reference&&(ref.reference.productKey!==productKey||ref.reference.inventoryKey!==ref.inventoryKey))throw fail(409,'La referencia de Stock es inválida.','SV_OFFICE_STOCK_CONFLICT');
  return ref;
 }
 async function freshReference(ref,readFresh=store.read,queryFresh=store.query,queryPageFresh=store.queryPage){if(ref.readSet)await resolver.assertFresh(ref.readSet,readFresh,queryFresh,queryPageFresh);}
 async function access(identity){if(!enabled)throw fail(503,'Stock de oficina todavía no está habilitado.','SV_OFFICE_STOCK_DISABLED');if(!identity?.uid||identity.claims?.uid!==identity.uid)throw fail(401,'Sesión requerida.');const ready=await store.read('sv_operational_read_config');if((await store.read('sv_labor_config/officeStockVersion'))!==1||ready?.schema!==1||ready.ready!==true)throw fail(503,'Stock de oficina está pendiente de preparar.','SV_OFFICE_STOCK_NOT_READY');const profile=await store.read('sv_chat_roles/'+identity.uid);return context(profile,await store.read('sv_permisos/'+profile?.rol));}
 async function verify(identity,expected){const current=await access(identity);if(digest(current)!==digest(expected))throw fail(409,'Los permisos cambiaron. Volvé a abrir el módulo.');}
 async function list(identity,body={}){
  const actor=await access(identity),cursor=body.cursor;
  if(Object.keys(body).some(k=>!['cursor','limit','compact'].includes(k))||cursor!=null&&(!cursor||typeof cursor!=='object'||Array.isArray(cursor)||Object.keys(cursor).sort().join(',')!=='key,value'||!key(cursor.key)||!['string','number'].includes(typeof cursor.value)||typeof cursor.value==='string'||typeof cursor.value==='number'&&(!Number.isFinite(cursor.value)||cursor.value< -1))||body.limit!==undefined&&![50,100].includes(body.limit))throw fail(400,'Página de stock inválida.');
  const pageSize=100;
  const records=await store.read('sisventas/compras_resumen/inventario_operativo');
  const numeric=v=>{try{return Model.quantity(v);}catch(_){return null;}};
  const compareKey=(a,b)=>a<b?-1:a>b?1:0;
  const ordered=Object.entries(records||{}).filter(([k,v])=>k!=='_svCoverage'&&key(k)&&v)
   .map(([k,v])=>({key:k,inventory:v,amount:numeric(v.general),reserved:v.reservado==null?0:numeric(v.reservado)}))
   .filter(r=>r.amount===null||r.reserved===null||r.amount>0||r.reserved>0)
   .sort((a,b)=>(b.amount??-1)-(a.amount??-1)||compareKey(a.key,b.key));
  const cursorAmount=cursor?numeric(cursor.value):null;
  const remaining=cursor?ordered.filter(r=>(r.amount??-1)<(cursorAmount??-1)||(r.amount??-1)===(cursorAmount??-1)&&compareKey(r.key,cursor.key)>0):ordered;
  const hasMore=remaining.length>pageSize;
  const entries=remaining.slice(0,pageSize);
  const rows=[];
  const compact=body.compact===true;
  async function productFor(inventoryKey,inventory){
   const direct=await store.read(productPath(inventoryKey));if(direct)return{productKey:inventoryKey,product:direct};
   const references=[...new Set([inventory.codigo,inventoryKey].filter(v=>typeof v==='string'||typeof v==='number'))],matches=new Map();
   for(const field of ['codigo','cod','id'])for(const value of references){const variants=field==='id'&&typeof value==='string'&&/^\d+$/.test(value)?[value,Number(value)]:[value];for(const equalTo of variants){const found=await queryPage('sisventas/productos',{orderBy:field,equalTo,limit:2});for(const[k,p]of Object.entries(found||{}))if(key(k)&&p)matches.set(k,p);}}
   return matches.size===1?{productKey:[...matches.keys()][0],product:[...matches.values()][0]}:{productKey:null,product:null};
  }
  for(let start=0;start<entries.length;start+=12){
   const values=await Promise.all(entries.slice(start,start+12).map(async({key:inventoryKey,inventory,amount,reserved})=>{
    if(amount===null||reserved===null)return{key:inventoryKey,productKey:null,code:String(inventory.codigo||inventoryKey),name:String(inventory.descripcion||'Stock por revisar'),unitLabel:String(inventory.unidad||''),inventory:null,review:true,invalid:true};
    if(compact)return{key:inventoryKey,productKey:null,code:String(inventory.codigo||inventoryKey),name:String(inventory.descripcion||'Stock por revisar'),unitLabel:String(inventory.unidad||''),inventory:{general:amount,reservado:inventory.reservado==null?null:reserved,revision:inventory._svReadRevision??0},review:true};
    const {productKey,product}=await productFor(inventoryKey,inventory);
    const inactive=product?.activo===false||product?.estado==='inactivo';
    const canZero=inactive&&productKey===inventoryKey&&product.eliminado!==true&&!isService({},product);
    const review=!product||isService({},product)||product.eliminado===true||(inactive&&!canZero);
    return{key:inventoryKey,productKey:review?null:productKey,code:String(product?.codigo||product?.cod||inventory.codigo||inventoryKey),name:String(product?.nombre||product?.descripcion||inventory.descripcion||'Stock por revisar'),unitLabel:String(product?.unidad||inventory.unidad||'Sin unidad confirmada'),photo:/^(https?:|data:image\/)/i.test(product?.imagenUrl||'')?product.imagenUrl:'',inventory:{general:amount,reservado:inventory.reservado==null?null:reserved,revision:inventory._svReadRevision??0},review,canZero};
   }));
   rows.push(...values);
  }
  const last=entries.at(-1),next=hasMore&&last?{value:last.amount??-1,key:last.key}:null;
  await verify(identity,actor);return{rows,cursor:next,ready:true,scanned:entries.length,complete:!hasMore,reviewRequired:rows.some(row=>row.review),continuation:hasMore};
 }
 async function detail(identity,{productKey}={}){const actor=await access(identity);if(!key(productKey))throw fail(400,'Producto inválido.');const p=await store.read(productPath(productKey));if(!p||p.eliminado===true||isService({},p))throw fail(404,'El producto ya no está disponible.');const ref=await resolveCurrent(productKey,p,store.read);await freshReference(ref);await verify(identity,actor);return{inventory:summary(ref.inventory),expectedHash:referenceHash(ref),productKey,...(ref.reference?{reference:ref.reference}:{}),...(ref.reference?.status==='inactive'?{zeroOnly:true}:{})};}
 async function history(identity,{productKey}={}){const actor=await access(identity);if(!key(productKey))throw fail(400,'Producto inválido.');const p=await store.read(productPath(productKey));if(!p||p.eliminado===true||isService({},p))throw fail(404,'El producto ya no está disponible.');const ref=await resolveCurrent(productKey,p,store.read),records=await queryPage(stockPath(ref.inventoryKey)+'/ajustesConteo',{orderBy:'fecha',last:true,limit:50});await freshReference(ref);await verify(identity,actor);return{...(ref.reference?{reference:ref.reference}:{}),rows:Object.values(records||{}).filter(v=>v.tipo==='conteo_oficina').map(v=>({anterior:v.anteriorDesconocida?null:v.cantidadAnterior,nueva:v.cantidadContada,usuario:v.usuario||'Usuario sin identificar',observacion:v.motivo||'',ts:v.fecha})).sort((a,b)=>b.ts-a.ts).slice(0,50)};}
 async function save(identity,body){
  const actor=await access(identity);if(!body||Object.keys(body).some(k=>!['id','productKey','quantity','reason','expectedHash'].includes(k))||!key(body.id)||body.id.length<8||!key(body.productKey)||!/^[a-f0-9]{64}$/.test(body.expectedHash||''))throw fail(400,'Revisá el ajuste y su observación.');
  const runner={uid:identity.uid,claims:identity.claims,mode:'user',...actor,financialAction:'stock.ajustar',opId:body.id,operation:'office-stock-adjustment',transportDigest:digest(body),input:body};
  return guard.run(runner,async scope=>{const p=await scope.get(productPath(body.productKey));if(!p||p.eliminado===true||isService({},p))throw fail(409,'El producto requiere revisión.');const ref=await resolveCurrent(body.productKey,p,path=>scope.get(path)),path=stockPath(ref.inventoryKey),inv=ref.inventory;if(referenceHash(ref)!==body.expectedHash)throw fail(409,'El stock cambió. Actualizá la cantidad antes de guardar.','SV_OFFICE_STOCK_CONFLICT');let initialProof=null,initialPlan=null;if(ref.reference&&inv===null){if(!require('./initial-inventory-reference').isAuthority(initialInventoryReference))throw fail(503,'El inventario inicial requiere verificar todas sus fuentes históricas. No se creó ningún registro.','SV_INITIAL_INVENTORY_NOT_READY');const initial=await initialInventoryReference.resolve({productKey:body.productKey},{actor:runner,lease:scope.lease,read:path=>scope.get(path),queryPage:store.queryPage});initialProof=initial.evidence;initialPlan=initialInventoryReference.inspect(initialProof,{actor:runner,lease:scope.lease});if(initial.inventory!==null||digest(initialPlan.reference)!==digest(ref.reference)||digest(initialPlan.product)!==digest({...p,fbKey:body.productKey}))throw fail(409,'La prueba inicial no coincide con el producto.','SV_INITIAL_INVENTORY_NOT_READY');}const person={uid:identity.uid,name:(await scope.get('sv_chat_directorio/'+identity.uid))?.nombre||'Usuario',active:true,allowed:true,role:actor.role},plan=(()=>{try{if((ref.reference?.status==='inactive'||p.activo===false||p.estado==='inactivo')&&(ref.inventoryKey!==body.productKey||!inv||Model.quantity(body.quantity)!==0))throw Error('El producto inactivo solo admite conteo manual a cero.');const result=Model.plan(inv,{...body,expected:inv},person,now(),p);if(initialPlan)result.inventory={...initialPlan.initial.inventory,...result.inventory};return result;}catch(e){throw fail(409,e.message);}})();
   scope.beforeCommit(async({readFresh,queryFresh,queryPageFresh})=>{await verify(identity,actor);if(initialProof)await initialInventoryReference.assertFresh(initialProof,{actor:runner,lease:scope.lease,readFresh,queryFresh,queryPageFresh});await freshReference(ref,readFresh,queryFresh,queryPageFresh);const latest=await readFresh(productPath(body.productKey));if(digest(latest)!==digest(p)||referenceHash(await resolveCurrent(body.productKey,latest,readFresh,queryPageFresh??store.queryPage))!==body.expectedHash)throw fail(409,'El stock o el producto cambió. Revisá antes de guardar.','SV_OFFICE_STOCK_CONFLICT');});Policy.issue(runner,scope.lease,ref.inventoryKey,plan.inventory);await scope.update({[path]:plan.inventory});return{ok:true,committed:true,operationId:body.id,inventory:summary({...plan.inventory,_svReadRevision:Number(inv?._svReadRevision??0)+1})};});
 }
 async function authorizeRequest(req){if(req.headers?.['x-sv-view-as']||req.headers?.['x-sisventas-view-as'])throw fail(403,'Volvé a tu cuenta para modificar stock.');return authorize(req);}
 return{authorize:authorizeRequest,list,detail,history,save};
}
module.exports={create,context,summary};
