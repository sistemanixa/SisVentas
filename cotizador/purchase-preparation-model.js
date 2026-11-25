'use strict';
// Pure decisions -> canonical v6 preparation. No authority, IO or catalog repricing.
const Canon=require('./commercial-models/exterior-preparation.v6'),Money=require('./commercial-models/commercial-money'),{digest}=require('./labor-guard');
const clone=v=>structuredClone(v),own=(o,k)=>Object.hasOwn(o||{},k);
const fail=m=>Object.assign(Error(m),{code:'SV_PURCHASE_PREPARATION_REVIEW',statusCode:409});
function demand(ok,m){if(!ok)throw fail(m);}
function key(v){demand(typeof v==='string'&&v.length>0&&v.length<=180&&!/[.#$\[\]/\x00-\x1f\x7f]/.test(v)&&!['__proto__','constructor','prototype'].includes(v),'Clave inválida.');return v;}
function n(v){demand(typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=Number.MAX_SAFE_INTEGER,'Falta cantidad o importe original.');Money.decimal(v);return v;}
function text(v){demand(typeof v==='string'&&v.trim().length>0,'Falta descripción original.');return v;}
function shape(v,allowed){demand(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>allowed.includes(k)),'La declaración contiene campos no autorizados.');}
function full(v){demand(v&&typeof v==='object'&&!Array.isArray(v)&&!v._svSummary&&!v._svListSummary&&!v._svPagedSummary&&Array.isArray(v.items),'Falta original completo.');return v;}
function editable(l,child=false){full(l);demand(['borrador','preparacion'].includes(l.estado)&&!l.desagrupada&&!l.compraConfirmacion&&(!l.compraConjuntaId||child)&&!l.stockExistenteReservado&&!Object.keys(l.reservasInventario||{}).length&&!(l.ordenesIds?.length)&&!Object.keys(l).some(k=>/(Pendiente|Bloqueo)$/.test(k)&&l[k]),'La lista está confirmada, vinculada o tiene operaciones pendientes.');}
// Preparation may reprice a linked plan, never silently change its stock identity.
function linkEntries(l,lk,sk){
 const present=own(l,'vinculosInventario'),entries=present?l.vinculosInventario:[];
 demand(Array.isArray(entries),'Los vínculos v2 requieren un array original.');
 demand(l.stockExistenteVinculado===undefined||l.stockExistenteVinculado===false||l.stockExistenteVinculado===true,'Flag de vínculo ambiguo.');
 demand(!entries.length||l.stockExistenteVinculado===true,'La traza v2 no tiene su marca de vínculo.');
 demand(l.stockExistenteVinculado!==true||present,'Falta la traza original del vínculo v2.');
 const used=new Set(),physical=new Map(),receipts=new Map();
 for(const entry of entries){demand(entry&&typeof entry==='object'&&!Array.isArray(entry)&&Object.keys(entry).length===9&&['schema','productKey','inventoryKey','receiptIdentityKey','listKey','saleKey','cantidad','operationId','ts'].every(k=>own(entry,k)),'Traza v2 incompleta.');
  demand(entry.schema===2&&entry.listKey===lk&&entry.saleKey===sk&&!used.has(entry.productKey)&&n(entry.cantidad)>0&&Number.isSafeInteger(entry.ts)&&entry.ts>0,'Identidad o cantidad de vínculo v2 contradictoria.');
  for(const k of ['productKey','inventoryKey','receiptIdentityKey','listKey','saleKey','operationId'])key(entry[k]);
  demand(!physical.has(entry.inventoryKey)&&!receipts.has(entry.receiptIdentityKey),'Identidad física de vínculo ambigua.');used.add(entry.productKey);physical.set(entry.inventoryKey,entry.productKey);receipts.set(entry.receiptIdentityKey,entry.productKey);
 }
 return entries;
}
function protectLinkedSources({list,listKey,sources,rows,rowSources,covered}){
 const linked=sources.filter(s=>s.list.stockExistenteVinculado===true||own(s.list,'vinculosInventario'));
 for(const source of sources){const entries=linkEntries(source.list,source.listKey,source.saleKey);if(source.list.stockExistenteVinculado!==true&&!entries.length)continue;
  const expected=new Map(),actual=new Map();
  for(const row of rows.filter(r=>covered.get(r.key)?.listKey===source.listKey)){const original=rowSources.get(row.key);demand(row.productKey===original.productKey&&row.sourceLine===original.sourceLine&&row.sourceListId===original.sourceListId&&typeof row.existing==='number'&&row.existing===original.existing,'No se puede cambiar stock o identidad de un plan ya vinculado.');const requested=own(row,'requestedQty')?row.requestedQty:row.needed-row.existing;demand(typeof requested==='number'&&requested===original.sourceQty,'No se puede cambiar la cantidad solicitada de un plan ya vinculado.');actual.set(row.productKey,Money.quantitySum([actual.get(row.productKey)||0,row.existing]));}
  for(const item of source.list.items){if(item.esManoDeObra===true||item.incluir!==true)continue;expected.set(item.productoKey,Money.quantitySum([expected.get(item.productoKey)||0,n(item.usarExistente)]));}
  const positive=m=>[...m].filter(([,q])=>q>0).sort(([a],[b])=>a.localeCompare(b));
  demand(digest(positive(expected))===digest(entries.map(e=>[e.productKey,e.cantidad]).sort(([a],[b])=>a.localeCompare(b)))&&digest(positive(actual))===digest(positive(expected)),'Las cantidades de la preparación no coinciden con sus vínculos v2.');
  const prior=list.simuladorParaguay?.rows;
  if(Array.isArray(prior))for(const row of rows.filter(r=>covered.get(r.key)?.listKey===source.listKey)){const old=prior.filter(r=>r.key===row.key);demand(old.length===1&&old[0].productKey===row.productKey&&old[0].sourceLine===row.sourceLine&&old[0].sourceListId===row.sourceListId&&old[0].existing===row.existing,'La captura previa contradice el vínculo de stock.');}
 }
 if(list.origen==='conjunta'){
  const active=list.stockExistenteVinculado===true||own(list,'vinculosInventario')||linked.length>0;
  if(active){demand(list.stockExistenteVinculado===true&&Array.isArray(list.vinculosInventario),'El padre y sus fuentes no conservan el mismo vínculo v2.');
   const entries=sources.flatMap(s=>linkEntries(s.list,s.listKey,s.saleKey)),sorted=xs=>xs.map(e=>digest(e)).sort();
   demand(digest(sorted(list.vinculosInventario))===digest(sorted(entries)),'Los vínculos del padre conjunto contradicen sus fuentes.');
  }
 }else if(!sources.length){demand(list.stockExistenteVinculado!==true&&!own(list,'vinculosInventario'),'El stock independiente no admite vínculos de venta.');}
}
function qty(i){const values=['qty','cantidad','cant'].filter(k=>i[k]!=null).map(k=>n(i[k]));demand(values.length&&values[0]>0&&values.every(v=>v===values[0]),'Cantidad de venta ambigua.');return values[0];}
function cost(i){demand(i.comisionCostoHistoricoPendiente!==true,'Costo histórico pendiente de revisión.');const q=qty(i);for(const k of ['costoTotalCompra','costoTotal','costo'])if(i[k]!=null)return n(i[k]);for(const k of ['costoUnitarioCompra','costoUnitario','costoCompra','compra','precioCompra','precio_compra','costoUnitarioAntesPreparacion','costoUnitarioPresupuestado'])if(i[k]!=null)return Money.rawProduct(n(i[k]),q);throw fail('Falta costo capturado; no se usa catálogo ni cero.');}
function originalUnit(i){for(const k of ['costoUnitarioAntesPreparacion','costoCompraAnterior','costoUnitarioPresupuestado'])if(i[k]!=null)return n(i[k]);return cost(i)/qty(i);}
function income(s){const subtotal=s.subtotal==null?null:n(s.subtotal);if(subtotal>0)return subtotal;const total=n(s.total??s.totalVenta),iva=s.conIva===false?0:n(s.iva??0);return Math.max(0,total-iva);}
const parameterFields=['usd','usdMode','usdt','usdtExchange','payment','usdtPerUsd','shippingInsuredUSD','shippingUninsuredUSD','shippingMode','fee','remoteOther','balance','valuation','allocation','historic','extraLogisticsUSD','remoteTotalARS','tripTotalARS','logisticsARS','transportARS','courierARS','bus','tolls','flight','border','cargo','packARS','night','nights','airport','food','days','other','tripDetailsVersion','pack'];
function parameters(input){shape(input,parameterFields);for(const [k,v]of Object.entries(input)){if(k==='tripDetailsVersion'){demand(v===1,'Versión de detalle de viaje inválida.');}else if(k==='usdMode'){demand(['manual','auto'].includes(v),'Preferencia dólar inválida.');}else if(k==='usdtExchange'){demand(typeof v==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(v),'Preferencia USDT inválida.');}else if(['payment','shippingMode','valuation','allocation'].includes(k)){demand(({payment:['USD','USDT'],shippingMode:['insured','uninsured'],valuation:['current','historic'],allocation:['value']})[k].includes(v),'Opción de cálculo inválida.');}else if(v!=='')n(v);}return clone(input);}
function finiteTree(v){if(typeof v==='number')demand(Number.isFinite(v)&&Math.abs(v)<=Number.MAX_SAFE_INTEGER,'Resultado de cálculo fuera de rango.');else if(v&&typeof v==='object')Object.values(v).forEach(finiteTree);}
function plan({list,listKey,sales={},sourceLists={},products={},providers={},decisions,applyCosts,documents,context}={}){
 key(listKey);editable(list);shape(decisions,['parameters','rows','extras','chosen']);demand(typeof applyCosts==='boolean','Indicá guardar o aplicar costos.');shape(context,['id','at','actor']);key(context.id);demand(Number.isSafeInteger(context.at)&&context.at>0,'Falta instante del servidor.');key(context.actor?.uid);text(context.actor?.name);
 demand(Array.isArray(decisions.rows)&&Array.isArray(decisions.extras)&&decisions.rows.length<=500&&decisions.extras.length<=100,'Faltan decisiones de filas.');demand(['remote','onsite'].includes(decisions.chosen),'Modalidad inválida.');
 const patch=Object.create(null),preconditions=Object.create(null),readDependencies=Object.create(null),dependencies=(path,v)=>{readDependencies[path]=clone(v);preconditions[path]=clone(v);};
 dependencies('sisventas/listas_materiales/'+listKey,list);
 const sources=[],saleKeys=new Set(),listKeys=new Set();
 function source(lk,l,sk,group){key(lk);key(sk);editable(l,group);const sale=full(sales[sk]);demand(l.ventaFbKey===sk&&sale.listaMaterialesId===lk&&!sale.anulada&&!sale.anulado&&!sale.eliminado&&!sale.ordenesCompraIds?.length&&!Object.keys(sale).some(k=>/Pendiente$/.test(k)&&sale[k]),'Venta o enlace de origen incoherente.');demand(!saleKeys.has(sk)&&!listKeys.has(lk),'Fuente duplicada.');saleKeys.add(sk);listKeys.add(lk);dependencies('sisventas/ventas/'+sk,sale);dependencies('sisventas/listas_materiales/'+lk,l);sources.push({listKey:lk,list:l,saleKey:sk,sale});}
 const stockOnly=list.origen==='stock_paraguay';
 if(list.origen==='conjunta'){
  demand(Array.isArray(list.sources)&&list.sources.length>=2&&list.sources.length<=100&&!list.ventaFbKey,'Fuentes conjuntas ambiguas.');
  for(const s of list.sources){demand(s.listId!==listKey&&sourceLists[s.listId]?.compraConjuntaId===listKey&&sourceLists[s.listId]?.ventaFbKey===s.ventaFbKey,'Fuente conjunta desvinculada.');source(s.listId,sourceLists[s.listId],s.ventaFbKey,true);const sale=sales[s.ventaFbKey];demand(s.saleFingerprint===JSON.stringify({items:sale.items||[],total:sale.total||0,descuento:sale.descuento||0}),'La venta cambió desde la agrupación.');}
 }else if(stockOnly){demand(!list.ventaFbKey&&!list.ventaId&&!list.sources?.length&&list.items.length===0,'Preparación stock con fuentes ambiguas.');}
 else {demand(!list.sources?.length,'Fuentes ambiguas.');source(listKey,list,list.ventaFbKey,false);}
 let revenue=0,baseline=0;for(const s of sources){revenue+=income(s.sale);baseline+=s.sale.items.reduce((sum,i)=>sum+Money.rawProduct(qty(i),originalUnit(i)),0);}n(revenue);n(baseline);
 const rowSources=new Map(),covered=new Map();
 for(const s of sources){const seen=new Set();for(const item of s.list.items){
  demand(Number.isSafeInteger(item.linea)&&item.linea>=0&&!seen.has(item.linea),'Línea de origen ambigua.');seen.add(item.linea);const line=s.sale.items[item.linea];demand(line,'Falta renglón de venta.');
  const productKey=key(item.productoKey),code=text(item.codigo);demand(String(line.cod??line.codigo)===code&&[line.productoKey,line.pid,line.productoFbKey,line.fbKeyProducto].filter(v=>v!=null).every(v=>v===productKey),'Producto/código de origen cambió.');demand(n(item.cantidadNecesaria)===qty(line),'Cambió la cantidad de origen.');
  if(item.esManoDeObra===true||line.esManoDeObra===true)continue;
  if(item.incluir!==true)continue;
  if(item.origenVentaItem){demand(qty(item.origenVentaItem)===qty(line)&&String(item.origenVentaItem.cod??item.origenVentaItem.codigo)===code,'La captura de origen ya no coincide.');}
  const group=list.origen==='conjunta',joined=group?list.items.filter(i=>i.sourceListId===s.listKey&&i.linea===s.listKey+':'+item.linea):[item];demand(joined.length===1,'Material conjunto ausente o duplicado.');const material=joined[0];
  demand(material.productoKey===productKey&&material.codigo===code&&material.cantidadNecesaria===item.cantidadNecesaria&&(material.proveedorKey||material.proveedor)===(item.proveedorKey||item.proveedor),'Material conjunto cambió respecto de su fuente.');
  const rowKey=[productKey,material.linea,material.proveedorKey||material.proveedor].join('|');demand(!rowSources.has(rowKey),'Clave de preparación duplicada.');
  const ref=item.referenciaCompra==null?null:clone(item.referenciaCompra);if(ref){n(ref.amount);demand(['ARS','USD'].includes(ref.currency),'Moneda de captura inválida.');}
  const unit=originalUnit(line),needed=qty(line);rowSources.set(rowKey,{key:rowKey,sourceLine:material.linea,sourceListId:group?s.listKey:'',saleLabel:material.saleLabel||'',productKey,code,description:text(item.descripcion),unit:text(item.unidad),needed,sourceQty:n(item.cantidadComprar),baselineUnit:unit,baselinePart:Money.rawProduct(needed,unit),localUnitARS:n(item.costoUnitario),reference:ref,localReference:item.localReference?clone(item.localReference):null,providerKey:item.proveedorKey||'',provider:item.proveedor||'',qty:n(item.cantidadComprar),existing:n(item.usarExistente),include:ref?.currency==='USD',usd:ref?.currency==='USD'?ref.amount:'',weight:1});covered.set(rowKey,{...s,line,index:item.linea});
 }}
 if(list.origen==='conjunta')demand(list.items.filter(i=>i.incluir===true&&i.esManoDeObra!==true).length===rowSources.size,'Hay materiales conjuntos sin fuente.');
 demand(decisions.rows.length===rowSources.size,'Faltan decisiones para materiales originales.');
 const seen=new Set();
 function selection(row,decision,extra=false){
  shape(decision,extra?['productKey','method','providerKey','agreed','qty']:['key','method','providerKey','agreed','requestedQty','existing']);demand((extra?['local','exterior']:['local','exterior','stock']).includes(decision.method),'Destino inválido.');
  if(extra){if(decision.qty!==''){n(decision.qty);demand(decision.qty>0,'Cantidad extra inválida.');}}else {
   if(own(decision,'requestedQty')&&decision.requestedQty!=='')n(decision.requestedQty);
   if(decision.existing!=='')n(decision.existing);
   if(decision.existing!=='')demand(decision.existing<=row.needed,'Cantidad declarada supera el origen.');
   if(typeof decision.requestedQty==='number')demand(decision.requestedQty<=row.needed,'Cantidad declarada supera el origen.');
   if(decision.existing!==''&&decision.requestedQty!=='')demand((decision.requestedQty??row.needed-decision.existing)+decision.existing<=row.needed,'Cantidad declarada supera el origen.');
   if(decision.method==='stock'){
    if(decision.existing!=='')demand(decision.existing===row.needed,'Stock debe cubrir el renglón completo.');
    if(own(decision,'requestedQty')&&decision.requestedQty!=='')demand(decision.requestedQty===0,'Stock debe cubrir el renglón completo.');
   }
  }
  const quantity=extra?decision.qty:own(decision,'requestedQty')?decision.requestedQty:decision.existing===''?'':row.needed-decision.existing;
  if(/^(unidad|unidades|u|un|uni|ud|uds)$/i.test(row.unit||''))demand((quantity===''||Number.isInteger(quantity))&&(extra||decision.existing===''||Number.isInteger(decision.existing)),'El producto requiere cantidades enteras.');
  const result={...row,method:decision.method,include:decision.method==='exterior',agreed:decision.agreed,existing:extra?0:decision.existing,...(extra?{qty:decision.qty}:decision.requestedQty!=null?{requestedQty:decision.requestedQty}:{})};
  if(decision.agreed!=='')n(decision.agreed);
  result.providerKey=decision.providerKey||'';result.provider='';
  if(result.providerKey){key(result.providerKey);const p=providers[result.providerKey];demand(p&&p.fbKey===result.providerKey&&p.activo!==false,'Falta proveedor original activo.');text(p.nombre);dependencies('sisventas/proveedores/'+result.providerKey,p);result.provider=p.nombre;}
  if(result.method==='stock'){demand(!result.providerKey,'Stock no admite proveedor ajeno.');result.agreed='';}
  return result;
 }
 const rows=decisions.rows.map(d=>{demand(d&&rowSources.has(d.key)&&!seen.has(d.key),'Fila desconocida o duplicada.');seen.add(d.key);return selection(rowSources.get(d.key),d);});
 protectLinkedSources({list,listKey,sources,rows,rowSources,covered});
 const extras=decisions.extras.map((d,index)=>{key(d.productKey);const p=products[d.productKey];demand(p&&p.fbKey===d.productKey&&p.activo!==false&&p.esManoDeObra!==true,'Falta producto extra canónico.');dependencies('sisventas/productos/'+d.productKey,p);const row={key:'extra:'+index+':'+d.productKey,productKey:d.productKey,code:text(p.codigo),description:text(p.nombre),unit:text(p.unidad),destination:'stock',reference:null};return selection(row,d,true);});
 const declaredParameters=parameters(decisions.parameters),previousParameters=list.simuladorParaguay?.parameters||{};
 // Omission is not an instruction to reset a saved amount/preference to zero.
 // Carry only recognized server selections, never saved baseline/revenue/results
 // or metadata submitted as decisions. Explicit ''/0 still replace the old value.
 const priorSelections=Object.fromEntries(parameterFields.filter(k=>own(previousParameters,k)&&!own(declaredParameters,k)).map(k=>[k,clone(previousParameters[k])]));
 // The persisted insured slot can contain the selected uninsured calculation.
 // On omission, restore the original decision quote, not that normalized slot.
 if(previousParameters.shippingMode==='uninsured')for(const [field,quote]of [['shippingInsuredUSD','insuredUSD'],['shippingUninsuredUSD','uninsuredUSD']]){
  if(!own(declaredParameters,field)&&own(list.simuladorParaguay?.shippingQuotes,quote))priorSelections[field]=clone(list.simuladorParaguay.shippingQuotes[quote]);
 }
 const normalizedParameters=parameters({...priorSelections,...declaredParameters});
 // v5 callers must send normalized payment, allocation and shipping choices.
 // No saved v5 result, weights, expense exclusions or retained cost are trusted.
 if(list.simuladorParaguay?.version<6){demand(own(declaredParameters,'payment')&&own(declaredParameters,'allocation')&&normalizedParameters.allocation==='value','Normalizá explícitamente el pago y reparto v5 antes de guardar.');
  demand(!(list.simuladorParaguay.rows||[]).some(r=>r.expenseExcluded===true)&&list.simuladorParaguay.parameters?.allocation!=='manual','La distribución histórica v5 requiere revisión.');}
 // Preserve the selected USD shipping base in the unchanged v6 calculator.
 // Both input bases remain stored, so switching back never loses the quote.
 const calcParameters=clone(normalizedParameters);
 if(calcParameters.tripDetailsVersion===1)calcParameters.tripTotalARS=Canon.tripTotal(calcParameters);
 if(calcParameters.shippingMode==='uninsured')calcParameters.shippingInsuredUSD=calcParameters.shippingUninsuredUSD??'';
 const initialized=Canon.initialize({rows:[],saved:{version:6,parameters:calcParameters},initial:{revenue,baseline}});
 // Canon.initialize has UI defaults; do not persist missing expense components
 // as invented zero fields. Copied/initialized metadata belongs only to the
 // previous server capture, not to a new body or a synthetic default.
 for(const field of ['fee','remoteOther','balance','extraLogisticsUSD'])if(!own(normalizedParameters,field))delete initialized.parameters[field];
 for(const field of ['expensesInitialized','expensesCopiedFrom']){
  if(own(previousParameters,field))initialized.parameters[field]=clone(previousParameters[field]);
  else delete initialized.parameters[field];
 }
 // An explicit USD shipping decision must retain the original USD base; do not
 // introduce remoteTotalARS='', which would mask the canonical USD calculation.
 if(!own(normalizedParameters,'remoteTotalARS')&&!['logisticsARS','transportARS','courierARS'].some(k=>own(normalizedParameters,k)))delete initialized.parameters.remoteTotalARS;
 const snapshot=Canon.calculateDraft({parameters:initialized.parameters,rows,extras,chosen:decisions.chosen});finiteTree(snapshot);
 // Canon.num('') is an ESTIMATE only. Keep the literal unknown decision in
 // persisted rows and explicitly mark pending before any applyCosts admission;
 // neither an assumed zero nor an inferred full quantity is an inventory fact.
 snapshot.rows.forEach((row,index)=>{
  const decision=decisions.rows[index];
  if(decision.existing===''){row.existing='';snapshot.pending.push('Confirmar cantidad de stock: '+row.description);}
  if(decision.requestedQty===''){row.requestedQty='';row.qty='';snapshot.pending.push('Confirmar cantidad a comprar: '+row.description);}
  else if(decision.existing===''&&!own(decision,'requestedQty')&&decision.method!=='stock')row.qty='';
 });
 snapshot.extras.forEach((row,index)=>{if(decisions.extras[index].qty===''){row.qty='';snapshot.pending.push('Confirmar cantidad extra: '+row.description);}});
 snapshot.complete=snapshot.pending.length===0;
 // v6's canonical shippingInsuredUSD slot holds the SELECTED shipping base.
 // Preserve both decision quotes separately without changing canonical math.
 if(normalizedParameters.shippingMode==='uninsured')snapshot.shippingQuotes={insuredUSD:normalizedParameters.shippingInsuredUSD??'',uninsuredUSD:normalizedParameters.shippingUninsuredUSD??''};
 snapshot.updatedAt=context.at;snapshot.updatedBy=context.actor.name;
 // Keep evidence of an earlier application when saving a new draft. No client
 // timestamp can make an incomplete draft look newly applied.
 for(const k of ['exteriorAppliedAt','exteriorAppliedBy'])if(own(list.simuladorParaguay,k))snapshot[k]=clone(list.simuladorParaguay[k]);
 if(applyCosts){demand(snapshot.complete,'La preparación tiene pendientes: '+snapshot.pending.join('; '));
  for(const s of sources){demand(s.sale.items.every(i=>n(i.cantidadCompraReal??0)===0&&n(i.costoRealCompraAcumulado??0)===0),'La venta ya tiene recepciones.');const selected=snapshot.rows.filter(r=>covered.get(r.key)?.saleKey===s.saleKey);demand(selected.length>0,'Faltan materiales de una fuente.');const next=Canon.applySaleCosts(s.sale,selected,snapshot.parameters.usd,cost,income);next.aplicacionExteriorId=context.id;patch['sisventas/ventas/'+s.saleKey]=next;}
  snapshot.exteriorAppliedAt=context.at;snapshot.exteriorAppliedBy=context.actor.name;
 }
 const nextList=clone(list);nextList.simuladorParaguay=snapshot;
 if(applyCosts){nextList.estado='preparacion';nextList.aplicacionExteriorId=context.id;delete nextList.exteriorCanceladoEn;}
 // The strict fingerprint above describes the ORIGINAL source sale. Applying
 // costs changes its items, so its derived fingerprint must advance in the
 // SAME patch as that exact nextSale. Otherwise a legitimate save/ungroup is
 // mistaken for an external edit. Original fingerprints/sales remain in CAS
 // preconditions/readDependencies; never recompute revenue/baseline or replace
 // commission/PVP history, and never refresh against client-supplied snapshots.
 if(applyCosts&&list.origen==='conjunta')nextList.sources=nextList.sources.map(source=>{
  const nextSale=patch['sisventas/ventas/'+source.ventaFbKey];
  demand(nextSale&&own(preconditions,'sisventas/ventas/'+source.ventaFbKey),'Falta la venta autorizada para actualizar su fingerprint.');
  return {...source,saleFingerprint:JSON.stringify({items:nextSale.items||[],total:nextSale.total||0,descuento:nextSale.descuento||0})};
 });
 // documents is SERVER context only: new attachments were validated externally.
 // This model does not parse, validate or authorize client pdfImport blobs.
 if(documents!==undefined){demand(documents&&typeof documents==='object'&&!Array.isArray(documents),'Falta mapa de documentos validado por servidor.');nextList.comprobantesCompra=clone(list.comprobantesCompra||{});for(const [sha,doc]of Object.entries(documents)){key(sha);demand(doc?.id===sha,'Identidad de documento incoherente.');demand(!own(nextList.comprobantesCompra,doc.id)||digest(nextList.comprobantesCompra[doc.id])===digest(doc),'Comprobante existente diferente.');nextList.comprobantesCompra[doc.id]=clone(doc);}}
 patch['sisventas/listas_materiales/'+listKey]=nextList;
 return {patch,preconditions,readDependencies,result:{ok:true,operationId:context.id,listKey,applied:applyCosts,complete:snapshot.complete,pending:clone(snapshot.pending)}};
}
module.exports={plan};
