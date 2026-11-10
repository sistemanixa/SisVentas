'use strict';
// Server-only source classification. No client marker or missing amount is proof.
const Rows=require('./ot-material-rows-model'),{digest}=require('./labor-guard'),Money=require('./commercial-models/commercial-money');
const own=(o,k)=>Object.hasOwn(o||{},k),same=(a,b)=>digest(a)===digest(b);
const fail=message=>Object.assign(Error(message),{statusCode:409,code:'SV_OT_MATERIAL_REVIEW'});
const key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const quantities=['entregada','devuelta','devueltaPendiente','enTecnico','danada','faltante','cantidadInstalada'];
const stockFields=['stockRegistro','stockRevision','stockPendiente','stockBaseInstalada'];
const deliveryFields=['entregada','custodiaActiva','entregadoEn','entregadoPor','entregadoA'];
const consumptionFields=['instalada','cantidadInstalada',...stockFields];
const group=row=>JSON.stringify([String(row.cod||row.codigo||row.sku||'').trim().toUpperCase(),Rows.extra(row),String(row.destinoVenta||'original'),String(row.destinoVenta==='nueva'?(row.ventaDestinoFbKey||row.ventaDestinoId||''):'')]);
const zeroOrAbsent=(row,k)=>!own(row,k)||row[k]===0;
function units(value){if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw fail('Hay cantidades de custodia o stock inválidas.');return Money.quantitySum([value]);}
const sum=values=>Money.quantitySum(values);
function legacyReceiptIdentity({otKey,rowKey,productKey,row}){if(!/^(0|[1-9][0-9]*)$/.test(String(rowKey)))throw fail('La fila del material es ambigua.');return require('node:crypto').createHash('sha256').update(JSON.stringify([otKey,Number(rowKey),productKey,row.destinoVenta||'original',row.ventaDestinoFbKey||'',row.agregadoEn||''])).digest('hex');}
function receiptBoundToRow({otKey,rowKey,productKey,allocation,row,receipt,entry}){return !!entry&&entry.ot===otKey&&entry.venta===allocation&&(entry.fila!==undefined?entry.fila===String(rowKey):row.stockRegistro===receipt||legacyReceiptIdentity({otKey,rowKey,productKey,row})===receipt);}
function bounds(row,{unchanged=false}={}){
 const delivered=row.entregada==null?null:units(row.entregada),known=sum(['instalada','devueltaPendiente','devuelta','enTecnico','danada','faltante'].filter(name=>row[name]!=null).map(name=>units(row[name])));
 if(delivered!==null&&known>delivered||delivered===null&&known>0&&!unchanged)throw fail('La instalación y clasificación superan la entrega verificada.');
}
function pristine(ot,inventory,otKey){
 if(!key(otKey)||!Array.isArray(ot?.materiales)||!ot.materiales.length||!['pendiente','asignada','programada','en_curso'].includes(ot.estado)||!key(ot.ventaFbKey))throw fail('La OT sin cantidades necesita revisar su origen.');
 if(ot.items&&Object.keys(ot.items).length)throw fail('Un histórico no se puede tratar como una OT nueva.');
 for(const k of ['remitosEntrega','historial','auditoria'])if(ot[k]!=null&&(typeof ot[k]!=='object'||Object.keys(ot[k]).length))throw fail('La OT ya tiene evidencia histórica.');
 for(const k of ['custodiaIniciada','custodiaRendida','custodiaTecnico','custodiaEntregadaEn','custodiaRendidaEn','custodiaRendidaPor','fechaCierre','fechaCompletada','firmada','firmaClienteUrl'])if(own(ot,k)&&ot[k]!==false&&ot[k]!==0&&ot[k]!=='')throw fail('La OT ya tiene evidencia de custodia o cierre.');
 if(own(ot,'progreso')&&ot.progreso!==0)throw fail('La OT ya tiene progreso registrado.');
 const audit=Object.values(ot.audit||{}),metadata=entry=>{
  if(!entry||entry.tipo||entry.kind)return false;
  if(['Datos de la OT actualizados','Datos de la OT actualizados · Marcada como PRIORIDAD'].includes(entry.accion))return true;
  return typeof entry.tecnicoAnterior==='string'&&typeof entry.tecnicoNuevo==='string'&&entry.accion==='Titularidad de OT transferida: '+(entry.tecnicoAnterior||'Sin asignar')+' -> '+(entry.tecnicoNuevo||'Sin asignar')&&['tecnicoAnteriorFbKey','tecnicoNuevoFbKey'].every(k=>entry[k]==null||entry[k]===''||key(entry[k]));
 };
 if(!audit.length||!['OT creada y asociada desde la venta','OT creada manualmente'].includes(audit[0]?.accion)||audit[0]?.tipo||audit[0]?.kind||audit.slice(1).some(entry=>!metadata(entry)))throw fail('No se puede acreditar el origen sin movimientos de la OT.');
 for(const row of ot.materiales){if(!row||row.instalada!==0||row.origenMaterialHistorico||row._recuperado||!Number.isFinite(row.vendida)||row.vendida<=0||quantities.some(k=>!zeroOrAbsent(row,k))||stockFields.some(k=>own(row,k))||['entregadoEn','entregadoPor','entregadoA','recibidoEn','recibidoPor','estadoCustodia'].some(k=>own(row,k))||['custodiaActiva','custodiaClasificada'].some(k=>own(row,k)&&row[k]!==false))throw fail('La fila no acredita cantidades iniciales sin movimientos.');}
 for(const inv of Object.values(inventory)){
  if(!inv||!Number.isFinite(inv.general)||!Number.isFinite(inv.reservado)||!Number.isFinite(inv.consumido)||inv.general<0||inv.reservado<0||inv.consumido<0)throw fail('El stock inicial requiere cantidades conocidas.');
  const assigned=inv.asignaciones?.[ot.ventaFbKey];if(!assigned||!Number.isFinite(assigned.reservado)||assigned.reservado<0||['consumido','liberado','recibidas'].some(k=>own(assigned,k)&&assigned[k]!==0)||['ultimaDevolucionEn','ultimaDevolucion'].some(k=>own(assigned,k)))throw fail('La asignación tiene consumo o es desconocida.');
  const receipts=inv.rendicionesOT;if(receipts!=null&&(typeof receipts!=='object'||Array.isArray(receipts)))throw fail('Los recibos de stock son ambiguos.');
  const entries=Object.values(receipts||{});if(inv.consumido>0&&!entries.length)throw fail('El consumo sin recibos no acredita un origen limpio.');
  for(const receipt of entries)if(!receipt||!key(receipt.ot)||!key(receipt.venta)||!Number.isSafeInteger(receipt.revision)||receipt.revision<1||!Number.isFinite(receipt.instalada)||receipt.instalada<0||receipt.ot===otKey)throw fail('Hay consumo previo o un recibo ambiguo para la OT.');
 }
}
function deliveryZeroOrigin(ot,{inventory,otKey,deliveryContext,selectedIndexes,catalog}){
 const token=require('./ot-lifecycle-policy').token(deliveryContext.actor,deliveryContext.lease);
 if(token.svOTLifecycleVersion!==1||token.svOTLifecycleKind!=='delivery'||token.svOTLifecycleOTKey!==otKey||token.svOTLifecycleSaleKey!==ot.ventaFbKey||!['admin','administrativo'].includes(token.svOTLifecycleRole))throw fail('La entrega requiere autorización física vigente.');
 if(!Array.isArray(selectedIndexes)||!selectedIndexes.length||new Set(selectedIndexes).size!==selectedIndexes.length||selectedIndexes.some(i=>!Number.isInteger(i)||i<0||!ot.materiales?.[i]))throw fail('La selección de entrega es ambigua.');
 const checked=structuredClone(ot);checked.estado='pendiente';checked.progreso=0;
 // Documentary signatures do not prove a physical stock movement or close this open OT.
 if(own(ot,'firmada')&&typeof ot.firmada!=='boolean'||own(ot,'firmaClienteUrl')&&typeof ot.firmaClienteUrl!=='string')throw fail('La firma documental requiere revisión.');
 delete checked.firmada;delete checked.firmaClienteUrl;
 if(!['pendiente','asignada','programada','en_curso','en_progreso'].includes(ot.estado)||own(ot,'progreso')&&(typeof ot.progreso!=='number'||!Number.isFinite(ot.progreso)||ot.progreso<0||ot.progreso>100))throw fail('El estado de la OT requiere revisión.');
 const workflow=new Set(['OT iniciada','✓ Completó toda la etapa: Preparación','✓ Completó toda la etapa: Instalación','✓ Completó toda la etapa: Verificación y entrega']);
 checked.audit=Object.values(ot.audit||{}).filter(e=>!e||e.tipo||e.kind||!workflow.has(e.accion));
 const selected=new Set(selectedIndexes),products=new Set(),codes=new Set(),cleanInventory={},code=row=>String(row.cod||row.codigo||row.sku||'').trim().toUpperCase();
 for(const i of selectedIndexes){const row=ot.materiales[i],product=row.productoKey;if(require('./ot-lifecycle-model').service(row,catalog[product]))throw Object.assign(fail('La entrega física no admite servicios ni mano de obra.'),{code:'SV_OT_DELIVERY_SERVICE'});if(!key(product)||products.has(product))throw fail('La identidad física de la entrega es ambigua.');products.add(product);if(code(row))codes.add(code(row));const inv=inventory[product];if(!inv||typeof inv!=='object')throw fail('El inventario inicial requiere revisión.');cleanInventory[product]=structuredClone(inv);const assigned=inv.asignaciones?.[ot.ventaFbKey];if(!assigned)cleanInventory[product].asignaciones={...inv.asignaciones,[ot.ventaFbKey]:{reservado:0,consumido:0,liberado:0,recibidas:0}};}
 // Reuse the strict evidence checks; only workflow metadata and absent own reservation differ.
 pristine(checked,cleanInventory,otKey);
 for(let i=0;i<ot.materiales.length;i++){const row=ot.materiales[i];if(!selected.has(i)&&(products.has(row.productoKey)||codes.has(code(row)))&&(!own(row,'entregada')||!own(row,'devuelta')))throw fail('Otra fila del producto tiene custodia desconocida.');}
 const next=structuredClone(ot);for(const i of selectedIndexes){const row=next.materiales[i];if(!own(row,'entregada'))row.entregada=0;if(!own(row,'devuelta'))row.devuelta=0;}return next;
}
function normalizePristine(ot,{inventory={},otKey,deliveryContext,selectedIndexes,catalog={}}={}){
 const relevant=(ot?.materiales||[]).filter(m=>key(m?.productoKey)&&own(inventory,m.productoKey));
 if(!relevant.some(m=>!own(m,'entregada')||!own(m,'devuelta')))return structuredClone(ot);
 if(deliveryContext)return deliveryZeroOrigin(ot,{inventory,otKey,deliveryContext,selectedIndexes,catalog});
 pristine(ot,inventory,otKey);const next=structuredClone(ot);
 for(const row of next.materiales)if(own(inventory,row.productoKey)){if(!own(row,'entregada'))row.entregada=0;if(!own(row,'devuelta'))row.devuelta=0;}
 return next;
}
function provenance(ot,rows,index){
 const row=rows[index];if(!row._recuperado&&!own(row,'origenMaterialHistorico'))return false;
 const match=/^items:(0|[1-9][0-9]*)$/.exec(row.origenMaterialHistorico||''),source=match&&ot.items?.[Number(match[1])];
 if(!source||typeof source!=='object'||!Rows.quantity(source)||group(source)!==group(row)||Rows.quantity(source)!==Rows.quantity(row)||source.productoKey!=null&&source.productoKey!==row.productoKey||row.productoKey!=null&&!key(row.productoKey)||Object.values(ot.items||{}).filter(m=>m&&group(m)===group(source)).length!==1||rows.filter(m=>m.origenMaterialHistorico===row.origenMaterialHistorico||group(m)===group(row)).length!==1)throw fail('La procedencia del material histórico es ambigua o no coincide.');
 return true;
}
function transitions(ot,after){
 const rows=Rows.view(ot),before=Rows.persisted(rows),targets=Array.isArray(after)?Rows.persisted(Rows.view({materiales:after})):null;
 if(!targets||targets.length!==before.length)throw fail('La lista de materiales cambió. Volvé a abrir la OT.');
 const receipts=new Set();for(const row of targets)if(row.stockRegistro){if(receipts.has(row.stockRegistro))throw fail('Dos materiales no pueden reutilizar el mismo recibo de stock.');receipts.add(row.stockRegistro);}
 return before.map((row,i)=>{
  const historical=provenance(ot,rows,i),target=targets[i],unchanged=same(row,target),source=historical?ot.items[Number(row.origenMaterialHistorico.slice(6))]:null;
  const deliveryChanged=deliveryFields.some(k=>!same(row[k],target[k]));
  bounds(target,{unchanged});
  const uninitialized=(!own(row,'entregada')||row.entregada===0)&&row.custodiaActiva!==true&&['devuelta','devueltaPendiente','enTecnico','danada','faltante'].every(k=>zeroOrAbsent(row,k))&&!['entregadoEn','entregadoPor','entregadoA','stockRegistro','stockRevision','stockBaseInstalada'].some(k=>own(row,k))&&(!own(row,'stockPendiente')||row.stockPendiente===false);
  if(historical&&deliveryChanged&&!uninitialized)throw fail('La custodia histórica existente no se puede reinicializar.');
  return {row,target,source,historical,unchanged,productCompletion:historical&&row.productoKey==null&&key(target.productoKey),needsProductBinding:historical&&source.productoKey==null&&key(target.productoKey),recovery:historical&&deliveryChanged&&uninitialized,needsStockReceipt:!unchanged&&(consumptionFields.some(k=>!same(row[k],target[k]))||historical&&deliveryChanged)};
 });
}
function allocation(ot,row){if(row.destinoVenta!=null&&!['original','nueva'].includes(row.destinoVenta))throw fail('El destino histórico es ambiguo.');const sale=row.destinoVenta==='nueva'?row.ventaDestinoFbKey:ot.ventaFbKey;if(!key(sale))throw fail('El destino de stock necesita una referencia canónica.');return sale;}
async function resolveProduct(row,{read,query,source}){
 if(!source&&key(row.productoKey)){const product=await read('sisventas/productos/'+row.productoKey);if(!product||typeof product!=='object')throw fail('El producto de la rendición no existe.');return row.productoKey;}
 const code=(source||row).cod||(source||row).codigo;if(typeof code!=='string'||!code||typeof query!=='function')throw fail('El producto de la rendición requiere resolución autoritativa.');
 const matches={};for(const field of ['codigo','cod'])Object.assign(matches,await query('sisventas/productos',field,code)||{});const ids=Object.keys(matches);if(ids.length!==1||!key(ids[0])||source&&ids[0]!==row.productoKey)throw fail('El producto de la rendición falta o es ambiguo.');return ids[0];
}
async function verifyReceipt({ot,otKey,transition,productKey,read,stockExceptionContext}){
 const m=transition.target;if(!key(productKey)||!/^[a-f0-9]{64}$/.test(m.stockRegistro||'')||!Number.isSafeInteger(m.stockRevision)||m.stockRevision<1||!Number.isFinite(m.instalada)||m.instalada<0||transition.recovery&&m.instalada<=0)throw fail('El movimiento requiere una referencia de stock verificable.');
 if(m.stockPendiente===true)throw fail('El movimiento todavía está pendiente de confirmar.');
 const inventory=await read('sisventas/inventario_operativo/'+productKey),sale=allocation(ot,m),receipt=inventory?.rendicionesOT?.[m.stockRegistro];
 if(!receipt||receipt.ot!==otKey||receipt.venta!==sale||receipt.revision!==m.stockRevision||receipt.instalada!==m.instalada)throw fail('El consumo de stock no coincide con la OT, destino o revisión.');
 if(units(m.devueltaPendiente??0)>units(receipt.enReserva??0)||units(m.devuelta??0)>units(receipt.recibidas??0))throw fail('La devolución no tiene respaldo en el recibo de stock.');
 if(!inventory.asignaciones||typeof inventory.asignaciones!=='object'||Array.isArray(inventory.asignaciones)||!inventory.rendicionesOT||typeof inventory.rendicionesOT!=='object'||Array.isArray(inventory.rendicionesOT))throw fail('El ledger de stock requiere revisión.');
 units(inventory.general);const reserved=units(inventory.reservado),consumed=units(inventory.consumido),perSale=new Map();let reservedAllocations=0,consumedAllocations=0,receiptConsumed=0,receiptHeld=0;
 for(const [id,assigned]of Object.entries(inventory.asignaciones)){if(!key(id)||!assigned||typeof assigned!=='object')throw fail('La asignación del ledger es inválida.');reservedAllocations=sum([reservedAllocations,units(assigned.reservado)]);consumedAllocations=sum([consumedAllocations,units(assigned.consumido)]);}
 for(const [id,entry]of Object.entries(inventory.rendicionesOT)){
  if(!/^[a-f0-9]{64}$/.test(id)||!entry||!key(entry.ot)||!key(entry.venta)||!Number.isSafeInteger(entry.revision)||entry.revision<1)throw fail('Un recibo del ledger es inválido.');
  const installed=units(entry.instalada),fromReserve=units(entry.deReserva),fromGeneral=units(entry.deGeneral),held=units(entry.enReserva??0),received=units(entry.recibidas??0);
  if(sum([fromReserve,fromGeneral])!==installed)throw fail('El origen del consumo no coincide con la instalación.');
  const totals=perSale.get(entry.venta)||{installed:0,held:0,received:0};totals.installed=sum([totals.installed,installed]);totals.held=sum([totals.held,held]);totals.received=sum([totals.received,received]);perSale.set(entry.venta,totals);receiptConsumed=sum([receiptConsumed,installed]);receiptHeld=sum([receiptHeld,held]);
 }
 if(consumedAllocations>consumed||receiptConsumed>consumed||receiptHeld>reserved)throw fail('Los recibos no tienen consumo o reserva respaldados en el ledger.');
 for(const [id,totals]of perSale){const assigned=inventory.asignaciones[id];if(!assigned||totals.installed>units(assigned.consumido)||totals.held>units(assigned.reservado)||totals.received>units(assigned.liberado??0))throw fail('El consumo o devolución excede la asignación del ledger.');}
 const c=stockExceptionContext,token=c&&require('./ot-lifecycle-policy').token(c.actor,c.lease),custodyContext=token?.svOTLifecycleVersion===1&&token.svOTLifecycleKind==='custody'&&token.svOTLifecycleOTKey===otKey&&typeof c.readOriginal==='function'&&Array.isArray(c.group);
 const originalInventory=custodyContext?await c.readOriginal('sisventas/inventario_operativo/'+productKey):null;
 const groupRow=custodyContext&&c.group.find(entry=>entry.transition===transition),originalReceipt=originalInventory?.rendicionesOT?.[m.stockRegistro];
 if(custodyContext&&originalReceipt&&(!groupRow||!transition.row||!receiptBoundToRow({otKey,rowKey:groupRow.rowKey,productKey,allocation:sale,row:transition.row,receipt:m.stockRegistro,entry:originalReceipt})))throw fail('El recibo histórico no identifica esta fila del material.');
 let originalDrift=false;
 if(originalInventory!=null){
  const originalAssigned=originalInventory.asignaciones??{};
  if(!originalAssigned||typeof originalAssigned!=='object'||Array.isArray(originalAssigned))throw fail('La reserva original del inventario requiere revisión.');
  const originalReserved=units(originalInventory.reservado),assignedValues=Object.values(originalAssigned).map(a=>{if(!a||typeof a!=='object'||Array.isArray(a))throw fail('La asignación original del inventario requiere revisión.');return Object.hasOwn(a,'reservado')?units(a.reservado):0;});
  originalDrift=sum(assignedValues)>originalReserved;
 }
 if(reservedAllocations>reserved||originalDrift){
  // An existing reservation discrepancy is never excused by persisted flags.
  // Only a genuine custody command may prove a general-only consumption from
  // the committed original, leaving every reservation and foreign row intact.
  if(!custodyContext||!['admin','administrativo'].includes(token.svOTLifecycleRole)||c.actor.role!==token.svOTLifecycleRole||!transition.row||!c.group.some(entry=>entry.transition===transition))throw fail('Los recibos no tienen consumo o reserva respaldados en el ledger.');
  try{const changes=c.group.map(({transition:t,rowKey})=>{
   const pending=t.row.stockPendiente===true,beforeInstalled=pending?t.row.stockBaseInstalada:t.row.instalada??0;
   // Legacy pending rows may already carry the applied receipt revision. Only
   // an identical committed receipt can then prove adoption without stock edits.
   const adoptedRevision=pending&&beforeInstalled<t.row.instalada&&t.target.stockRegistro===t.row.stockRegistro&&t.target.stockRevision===t.row.stockRevision;
   return{allocation:allocation(ot,t.target),receipt:t.target.stockRegistro,beforeInstalled,targetInstalled:t.target.instalada,revision:(t.row.stockRevision??0)-(adoptedRevision?1:0),rowKey,sourceReceipt:t.row.stockRegistro??null,legacyReceipt:legacyReceiptIdentity({otKey,rowKey,productKey,row:t.row})};
  });require('./ot-general-consumption-exception').validate({before:originalInventory,after:inventory,otKey,productKey,actor:{uid:c.actor.uid,role:token.svOTLifecycleRole,allowed:true},operationId:c.actor.opId,changes});}catch(error){throw fail('No se acredita el consumo de General sin alterar las reservas existentes.');}
 }
 return receipt;
}
module.exports={normalizePristine,transitions,resolveProduct,verifyReceipt,provenance,bounds,legacyReceiptIdentity,receiptBoundToRow};
