'use strict';
const {digest}=require('./labor-guard');
const Fence=require('./sale-delete-fence');
const Relations=require('./sale-delete-relations');
const Activity=require('./sale-delete-activity');
const fail=message=>Object.assign(Error(message),{statusCode:409,code:'SV_SALE_DELETE_BLOCKED'});
const key=value=>{if(typeof value!=='string'||!value||/[.#$\[\]/\x00-\x1f]/.test(value))throw fail('Referencia inválida.');return value;};
function createSaleDeleteCommand({guard,store,enabled=false,now=Date.now,verifyActor}){
 if(enabled&&typeof verifyActor!=='function')throw fail('La eliminación requiere verificación fresca de Auth y acceso.');
 async function access(read,actor){
  await verifyActor(actor);
  if(!actor?.uid||actor.claims?.uid!==actor.uid||actor.viewing||actor.realUid&&actor.realUid!==actor.uid||actor.claims.svPasswordChangeRequired)throw fail('Volvé a tu cuenta administrativa.');
  const profile=await read('sv_chat_roles/'+key(actor.uid)),permissions=await read('sv_permisos/admin');
  if(profile?.activo!==true||profile.rol!=='admin'||permissions?.indiceVersion!==2||permissions.indiceModulos?.venta!==true||permissions.acciones?.ventas?.eliminar===false||Object.values(permissions.bloqueados||{}).includes('venta'))throw fail('Se requiere administrador con permiso ventas.eliminar.');
  return {profile,permissions};
 }
 async function plan(read,query,saleKey,actor,timestamp,expectedHash){
  const salePath='sisventas/ventas/'+saleKey,sale=await read(salePath);
  if(!sale)throw fail('La venta ya no existe. Consultá el resultado de la operación.');
  const original=structuredClone(sale);delete original.fbKey;
  if(sale.fbKey!=null&&sale.fbKey!==saleKey||digest(original)!==expectedHash)throw fail('La venta cambió. Volvé a abrir el original antes de eliminar.');
  const financial=await store.saleDeleteFinancialEvidence({saleKey,read,query});
  if(financial?.schema!==1||financial.saleKey!==saleKey||financial.scope!=='complete-financial-dependencies'||typeof financial.generation!=='string'||!financial.generation||!Number.isSafeInteger(financial.revision)||financial.revision<1||!['gastos','ctaemp','comisiones_generacion','sv_commission_generation'].every(domain=>/^[a-f0-9]{64}$/.test(financial.sources?.[domain]||''))||!Array.isArray(financial.dependencies))throw fail('Falta cobertura financiera completa de esta venta; no se eliminó ningún registro.');
  if(financial.dependencies.length)throw Object.assign(Error('La venta conserva comisiones o movimientos financieros. Resolvé esas dependencias antes de eliminar; no se modificó ningún registro.'),{statusCode:409,code:'SV_SALE_DELETE_FINANCIAL_DEPENDENCY'});
  if(sale.factura?.cae&&!sale.notaCredito?.cae)throw fail('Primero debe tener su nota de crédito.');
  const patch={[salePath]:null},snapshot={sale,financial};
  const collections={};for(const domain of ['ventas','pagos','ordenes_trabajo','presupuestos','reclamos'])collections[domain]=await read('sisventas/'+domain)||{};
  snapshot.collections=collections;
  const complete=Relations.resolve(collections,saleKey);
  snapshot.activity=await Activity.validate(read,{...sale,fbKey:saleKey},complete.ordenes_trabajo);
  query=async(path,field,value)=>Object.fromEntries(Object.entries(collections[path.replace('sisventas/','')]||{}).filter(([,row])=>row?.[field]===value));
  for(const domain of ['pagos','ordenes_trabajo','reclamos']){
   const rows=complete[domain];snapshot[domain]=rows;
   for(const [id,row]of Object.entries(rows)){
    if(domain==='reclamos')throw fail('Repará o cerrá primero el vínculo desde Reclamos.');
    patch['sisventas/'+domain+'/'+key(id)]=null;
    if(domain==='ordenes_trabajo'){
     for(const value of [id,row.id,row.otId,row.numero].filter(Boolean))for(const field of ['otKey','otId','otNumero']){
      const claims=await query('sisventas/reclamos',field,value)||{};snapshot['claim/'+id+'/'+field+'/'+value]=claims;
      if(Object.keys(claims).length)throw fail('Repará o cerrá primero el reclamo vinculado a la OT.');
     }
    }
   }
  }
  for(const field of ['reclamoKey','reclamoFbKey','reclamoFBKey','reclamoId'])if(sale[field])throw fail('Repará o cerrá primero el vínculo desde Reclamos.');
  const reverse=complete.presupuestos;
  snapshot.budgets=reverse;
  const budgets={...reverse};
  for(const value of [sale.presupuestoFbKey,sale.pptoFbKey].filter(Boolean)){const budget=await read('sisventas/presupuestos/'+key(value));if(!budget)throw fail('No se encontró el presupuesto de origen.');budgets[value]=budget;}
  snapshot.budgets=budgets;
  for(const [budgetKey,budget]of Object.entries(budgets)){
   const path='sisventas/presupuestos/'+key(budgetKey);
   if(!budget)throw fail('No se encontró el presupuesto de origen.');
   patch[path]={...budget,estado:'anulado',anulado:true,motivoAnulacion:'La venta generada '+(sale.id||sale.numero||'')+' fue eliminada.',ventaRetiradaId:sale.id||sale.numero||'',ventaRetiradaFbKey:saleKey,ventaRetiradaTipo:'eliminada',ventaRetiradaTs:timestamp,ventaRetiradaPor:actor.name,audit:[...(Array.isArray(budget.audit)?budget.audit:[]),{fecha:new Date(timestamp).toLocaleDateString('es-AR'),usuario:actor.name,accion:'Presupuesto anulado porque la venta generada fue eliminada',motivo:'Venta '+(sale.id||sale.numero||saleKey)+' eliminada'}]};
  }
  if(sale.notaCredito?.origen==='conciliacion_externa'){
   const fiscalKey=sale.notaCredito.comprobanteEmitidoFbKey;
   if(fiscalKey){const path='sisventas/comprobantesVenta/'+key(fiscalKey),document=await read(path);if(!document)throw fail('No se encontró el comprobante fiscal externo.');snapshot.fiscal=document;
    if(document.ventaConciliadaFbKey&&document.ventaConciliadaFbKey!==saleKey)throw fail('El comprobante fiscal está vinculado a otra venta.');
    patch[path]={...document,ventaEliminadaId:sale.id||'',ventaEliminadaTs:timestamp,ventaEliminadaPor:actor.name};
    for(const field of ['ventaConciliadaFbKey','ventaConciliadaId','conciliadaTs','conciliadaPor'])delete patch[path][field];
   }
  }
  return {patch,snapshot};
 }
 async function execute(actor,body){
  Fence.assertReady(guard,store);
  if(!enabled)throw fail('La eliminación coordinada todavía no está habilitada.');
  key(body?.id);key(body?.ventaKey);
  if(!/^[a-f0-9]{64}$/.test(body.expectedHash||''))throw fail('Falta verificar la revisión original de la venta.');
  const captured=await access(path=>store.read(path),actor),timestamp=now(),person={...actor,name:captured.profile.nombre||captured.profile.login||''};
  const commercialDeleteProof=await store.commercialDeleteReadiness?.capture('saleDelete');
  const result=await guard.run({uid:actor.uid,claims:actor.claims,commercialDeleteProof,mode:'user',role:'admin',permissionRevision:captured.permissions.indiceRevision,permissionDigest:digest(captured.permissions),opId:body.id,transportDigest:digest(body),operation:'sale-delete',input:body},async scope=>{
   if(commercialDeleteProof)await store.commercialDeleteReadiness.assertCurrent(commercialDeleteProof,scope.get);
   if(digest(await access(scope.get,actor))!==digest(captured))throw fail('Los permisos cambiaron.');
   const initial=await plan(scope.get,scope.query,body.ventaKey,person,timestamp,body.expectedHash);
   scope.beforeCommit(async({readFresh,queryFresh})=>{
    if(commercialDeleteProof)await store.commercialDeleteReadiness.assertCurrent(commercialDeleteProof,readFresh);
    if(digest(await access(readFresh,actor))!==digest(captured))throw fail('Los permisos cambiaron.');
    const fresh=await plan(readFresh,queryFresh,body.ventaKey,person,timestamp,body.expectedHash);
    if(digest(fresh.snapshot)!==digest(initial.snapshot))throw fail('Los vínculos cambiaron; no se eliminó ningún registro.');
   });
   await scope.update(initial.patch);
   return {ok:true,committed:true,ventaKey:body.ventaKey};
  });
  if(digest(await access(path=>store.read(path),actor))!==digest(captured))throw fail('Los permisos cambiaron. Consultá la operación antes de repetirla.');
  return result;
 }
 return {execute,capability:()=>enabled===true&&Fence.ready(guard,store)};
}
module.exports={createSaleDeleteCommand};
