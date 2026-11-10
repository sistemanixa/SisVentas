'use strict';
const M=require('./commercial-pages-model'),Index=require('./payment-membership-index'),Own=require('./commercial-ownership'),Matcher=require('./payment-membership-matcher'),crypto=require('crypto');
const same=(a,b)=>require('./labor-guard').canonical(a)===require('./labor-guard').canonical(b);
const InstallationDisplay=require('./ot-installation-display-delta');
function refs(s){if(!s)return[];const r=Matcher.saleReferences(s);return Object.entries(r).flatMap(([kind,values])=>values.map(v=>kind+'/'+M.hash(v)));}
function recordIds(patch,domain){const found=new Set();for(const p of Object.keys(patch)){if(p==='sisventas'||p==='sisventas/'+domain)throw Error('La proyección comercial requiere registros individuales.');const a=p.split('/');if(a[0]==='sisventas'&&a[1]===domain&&a[2])found.add(a[2]);}return found;}
async function augment({patch,raw,get}){if(!Object.keys(patch).some(p=>/^sisventas\/(ventas|pagos|presupuestos)(\/|$)/.test(p)||p==='sisventas'))return;const config=await raw('sv_commercial_pages_config');if(config?.ready!==true)return;if(config.schema!==1)throw Error('La configuración del listado comercial requiere revisión.');const coverage=await raw(M.ROOT+'/coverage');if(coverage?.ready!==true||coverage.schema!==1||coverage.generation!==config.generation||!Number.isSafeInteger(coverage.revision))throw Error('La cobertura comercial no está lista.');
 if(config.nativeCollectionsReady===true&&(config.nativeCollectionsSchema!==1||coverage.nativeCollectionsSchema!==1))throw Error('La cobertura nativa de Cobranzas no está completa.');
 const saleKeys=recordIds(patch,'ventas'),paymentKeys=recordIds(patch,'pagos'),saleSources=new Map(),rowCache=new Map(),refDelta=new Map();
 const budgetKeys=recordIds(patch,'presupuestos');
 for(const id of budgetKeys){
  const before=await raw('sisventas/presupuestos/'+id),after=await get('sisventas/presupuestos/'+id),ownerFields=['responsableUid','creadaPorUid','creadoPorUid','usuarioUid','empleadoUid','creadaPor','creadoPor','createdBy','usuario','empleado'];
  if(before&&after&&ownerFields.every(k=>same(before[k]??null,after[k]??null)))continue;
  const linked=await raw(M.ROOT+'/budgetSales/'+M.hash(id));for(const [sale,v]of Object.entries(linked||{}))if(v===true){const source=await get('sisventas/ventas/'+sale);if(source&&!Object.hasOwn(source,'responsableUid'))saleKeys.add(sale);}
 }
 if(saleKeys.size===0&&paymentKeys.size===0)return;

 // Metadata-only sale changes do not need to download or rewrite related payments.
 // Compare the full before/after images excluding only these non-economic fields.
 if(paymentKeys.size===0&&saleKeys.size>0&&!Object.keys(patch).some(p=>p.startsWith('sisventas/presupuestos/'))){
  const ignored=new Set(['audit','estadoInst','observaciones','obs','factura']),economic=s=>Object.fromEntries(Object.entries(s||{}).filter(([k])=>!ignored.has(k)));
  const changes=[];let safe=true;
  for(const id of saleKeys){const before=await raw('sisventas/ventas/'+id),after=await get('sisventas/ventas/'+id),old=await raw(M.ROOT+'/records/sales/'+id);if(!before||!after||!old||!same(economic(before),economic(after))){safe=false;break;}
   const row={...old,installation:String(after.estadoInst||'').slice(0,60),invoiced:!!after.factura,notes:String(after.observaciones||after.obs||'').slice(0,2000),...M.displayFields(after)};
   if(!same(row,old))changes.push({kind:'sales',key:id,before:old,after:row});
  }
  if(safe){if(changes.length){const revision=coverage.revision+1;if(!Number.isSafeInteger(revision))throw Error('Secuencia comercial agotada.');Object.assign(patch,config.nativeCollectionsReady!==true&&InstallationDisplay.plan(changes,M)||await M.delta(changes,{read:raw,generation:coverage.generation,revision,nativeCollections:config.nativeCollectionsReady===true&&config.nativeCollectionsSchema===1}));patch[M.ROOT+'/coverage']={...coverage,revision};}return;}
 }

 const readSale=async id=>{if(!saleSources.has(id))saleSources.set(id,await get('sisventas/ventas/'+id));return saleSources.get(id);};
 for(const id of saleKeys){const before=await raw('sisventas/ventas/'+id),after=await readSale(id);if(before?.presupuestoFbKey)patch[M.ROOT+'/budgetSales/'+M.hash(String(before.presupuestoFbKey))+'/'+id]=null;if(after?.presupuestoFbKey)patch[M.ROOT+'/budgetSales/'+M.hash(String(after.presupuestoFbKey))+'/'+id]=true;for(const r of refs(before?{...before,fbKey:id}:null))refDelta.set(r+'/'+id,null);for(const r of refs(after?{...after,fbKey:id}:null))refDelta.set(r+'/'+id,true);}
 async function relatedSale(p){if(!p)return null;const r=Matcher.paymentReferences(p),candidates=new Set();for(const [kind,values]of Object.entries(r)){if(!Array.isArray(values))continue;for(const value of values){const bucket=kind+'/'+M.hash(value),data={...await raw(M.ROOT+'/saleRefs/'+bucket)};for(const [path,v]of refDelta)if(path.startsWith(bucket+'/')){const id=path.slice(bucket.length+1);if(v)data[id]=true;else delete data[id];}for(const[id,v]of Object.entries(data))if(v===true)candidates.add(id);}}
 const matches=[];for(const id of candidates){const s=await readSale(id);if(s&&Matcher.belongsToSale(p,{...s,fbKey:id}))matches.push(id);}if(matches.length>1)throw Error('El cobro tiene referencias ambiguas.');return matches[0]||null;}
 for(const id of paymentKeys){const old=await raw(M.ROOT+'/records/payments/'+id);if(old?.saleKey)saleKeys.add(old.saleKey);const next=await get('sisventas/pagos/'+id),sale=await relatedSale(next);if(sale)saleKeys.add(sale);}
 let people;async function owner(s,id,old){
  if(Object.hasOwn(s,'responsableUid'))return M.key(s.responsableUid)?s.responsableUid:'';
  // Match the canonical commercial reader: linked budget precedes legacy authors.
  const budget=s.presupuestoFbKey?await get('sisventas/presupuestos/'+s.presupuestoFbKey):null,candidate=budget||s,domain=budget?'presupuestos':'ventas';
  if(Object.hasOwn(candidate,'responsableUid'))return M.key(candidate.responsableUid)?candidate.responsableUid:'';
  if(!people)people=Own.profiles(await raw('sv_usuarios'),await raw('sv_chat_roles'));
  return Own.owner(candidate,domain,people)||'';
 }
 async function clientKey(s,before,old){
  if(old?.clientKey&&['clientePrincipalKey','clienteFbKey','clienteKey','clienteId','idCliente','cliente'].every(k=>same(before?.[k]??null,s[k]??null)))return old.clientKey;
  if(s.clientePrincipalKey)return String(s.clientePrincipalKey);
  const ref=s.clienteFbKey||s.clienteKey;if(ref&&M.key(String(ref))){const index=await get('sisventas/clientes_unificados_indice/'+ref);if(index?.clienteKey)return String(index.clienteKey);}
  return M.clientIdentity(s);
 }
 const changes=[],allPayments=new Map();for(const id of saleKeys){const before=await raw('sisventas/ventas/'+id),source=await readSale(id),old=await raw(M.ROOT+'/records/sales/'+id);if(before&&!old)throw Error('Falta una venta en el listado preparado.');const candidateKeys=new Set(paymentKeys);for(const s of [before,source])if(s)for(const path of Index.queryPaths({...s,fbKey:id})){const bucket=await raw(path);for(const[k,v]of Object.entries(bucket||{}))if(v===true)candidateKeys.add(k);}
 const related=[];for(const k of candidateKeys){let p;if(allPayments.has(k))p=allPayments.get(k);else{p=await get('sisventas/pagos/'+k);allPayments.set(k,p);}if(p&&[before,source].some(s=>s&&Matcher.belongsToSale(p,{...s,fbKey:id})))paymentKeys.add(k);if(p&&source&&Matcher.belongsToSale(p,{...source,fbKey:id}))related.push({...p,fbKey:k});}
 const row=source?M.saleRow(id,source,related,{ownerUid:await owner(source,id,old),clientKey:await clientKey(source,before,old)}):null;rowCache.set(id,row);changes.push({kind:'sales',key:id,before:old,after:row});}
 for(const id of paymentKeys){const source=allPayments.has(id)?allPayments.get(id):await get('sisventas/pagos/'+id),before=await raw('sisventas/pagos/'+id),old=await raw(M.ROOT+'/records/payments/'+id);if(before&&!old)throw Error('Falta un cobro en el listado preparado.');const idSale=await relatedSale(source),sale=idSale?(rowCache.get(idSale)||await raw(M.ROOT+'/records/sales/'+idSale)):null;changes.push({kind:'payments',key:id,before:old,after:source?M.paymentRow(id,source,sale,{nativeCollections:config.nativeCollectionsReady===true&&config.nativeCollectionsSchema===1,related:idSale?Array.from(allPayments,([fbKey,payment])=>payment?{...payment,fbKey}:null).filter(payment=>payment&&Matcher.belongsToSale(payment,{...saleSources.get(idSale),fbKey:idSale})):[]}):null});}
 const revision=coverage.revision+1;if(!Number.isSafeInteger(revision))throw Error('Secuencia comercial agotada.');Object.assign(patch,await M.delta(changes,{read:raw,generation:coverage.generation,revision,nativeCollections:config.nativeCollectionsReady===true&&config.nativeCollectionsSchema===1}));for(const[p,v]of refDelta)patch[M.ROOT+'/saleRefs/'+p]=v;patch[M.ROOT+'/coverage']={...coverage,scopes:{...coverage.scopes,...Object.fromEntries(changes.flatMap(c=>c.after?M.scopes(c.after.ownerUid):[]).map(k=>[k,true]))},revision,sales:coverage.sales+changes.filter(c=>c.kind==='sales').reduce((n,c)=>n+Number(!!c.after)-Number(!!c.before),0),payments:coverage.payments+changes.filter(c=>c.kind==='payments').reduce((n,c)=>n+Number(!!c.after)-Number(!!c.before),0)};
}
async function prepare(input){input={...input,sales:structuredClone(input.sales||{}),payments:structuredClone(input.payments||{})};const built=await M.build(input);for(const[id,s]of Object.entries(input.sales||{})){for(const r of refs({...s,fbKey:id}))built.patch[M.ROOT+'/saleRefs/'+r+'/'+id]=true;if(s.presupuestoFbKey)built.patch[M.ROOT+'/budgetSales/'+M.hash(String(s.presupuestoFbKey))+'/'+id]=true;}
 // Offline receipt from the SAME canonical build, not from an arbitrary pair of snapshots.
 // Never written to RTDB. No second calculation of historical money or ownership.
 const hash=value=>require('./labor-guard').digest(Index.normalizeRtdb(value)),rows={sales:{},payments:{}};
 for(const kind of ['sales','payments']){const prefix=M.ROOT+'/records/'+kind+'/';for(const[path,row]of Object.entries(built.patch))if(path.startsWith(prefix))rows[kind][path.slice(prefix.length)]=row;}
 built.activitySnapshot=Object.freeze({schema:1,kind:'canonical-pages-build-snapshot',salesHash:hash(input.sales||{}),paymentsHash:hash(input.payments||{}),rowsHash:hash(rows),coverageHash:hash(built.coverage)});
 return built;
}
module.exports={augment,prepare,refs};
