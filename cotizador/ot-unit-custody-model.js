'use strict';
const {key}=require('./ot-unit-confirmation-model');
const copy=structuredClone;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=(code,message)=>{throw Object.assign(Error(message),{statusCode:409,code});};
const STATES=new Set(['en_tecnico','devolucion_pendiente','devuelto','instalado']);
const fields={en_tecnico:'enTecnico',devolucion_pendiente:'devueltaPendiente',devuelto:'devuelta',instalado:'instalada'};
function amount(value){if(value===undefined||value===null||value==='')return 0;if(typeof value!=='number'&&(typeof value!=='string'||!/^\+?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())))fail('SV_OT_CUSTODY_COUNTER','Las cantidades de custodia requieren revisión.');const n=Number(value);if(!Number.isFinite(n)||n<0)fail('SV_OT_CUSTODY_COUNTER','Las cantidades de custodia requieren revisión.');return n;}
function serial(value){if(typeof value!=='string'||!value.trim()||value.trim().length>120||/[\x00-\x1f\x7f]/.test(value))fail('SV_OT_CUSTODY_SERIAL','Ingresá una serie válida para cada unidad.');return value.trim();}
const serialId=value=>serial(value).toLocaleUpperCase('es-AR');
function counts(registry,materialKey){const result={enTecnico:0,devueltaPendiente:0,devuelta:0,instalada:0};for(const row of Object.values(registry))if(row.materialKey===materialKey)result[fields[row.estado]]++;return result;}
/** Pure plan only: authorization, fresh reads, rules and atomic commit belong to
 * the dedicated service. No sale, product, equipment or warranty write is emitted.
 */
function plan({action,selected,expectedUnits,registry={},materials,inventory={},allocationKey,uid,technicianKey,timestamp,assets={}}){
 if(!['entregar','devolver','recibir','instalar'].includes(action)||!key(uid)||!key(technicianKey)||!key(allocationKey)||!Number.isSafeInteger(timestamp)||timestamp<0)fail('SV_OT_CUSTODY_CONTEXT','La operación de custodia no es válida.');
 if(!Array.isArray(selected)||!selected.length||selected.length>200||!Array.isArray(expectedUnits)||!object(registry)||!materials||typeof materials!=='object')fail('SV_OT_CUSTODY_INPUT','Seleccioná las unidades de esta OT.');
 const next=copy(registry),nextMaterials=copy(materials),stock=Object.create(null),touched=new Set(),seen=new Set(),events=[];
 for(const [unitKey,row]of Object.entries(next))if(!key(unitKey)||!object(row)||row.unitKey!==unitKey||!key(row.materialKey)||!STATES.has(row.estado)||!key(row.technicianKey)||!Number.isInteger(row.n)||row.n<0||!key(row.itemKey)||!Array.isArray(row.historial)||row.historial.length>500)fail('SV_OT_CUSTODY_EXISTING','La custodia registrada requiere revisión.');
 function moveInventory(unit,direction){
  const productKey=unit.productKey;if(!key(productKey))return {tracked:false};
  const current=stock[productKey]||inventory[productKey];if(!object(current)||!object(current.asignaciones)||!Object.hasOwn(current.asignaciones,allocationKey)||!object(current.asignaciones[allocationKey]))return {tracked:false};
  const inv=stock[productKey]||(stock[productKey]=copy(current)),allocation=inv.asignaciones[allocationKey];
  if(amount(allocation.reservado)<1||amount(inv.reservado)<1)fail('SV_OT_CUSTODY_STOCK','La reserva de esta venta no alcanza. Revisá inventario antes de confirmar.');
  allocation.reservado=amount(allocation.reservado)-1;inv.reservado=amount(inv.reservado)-1;
  if(direction==='instalar'){allocation.consumido=amount(allocation.consumido)+1;inv.consumido=amount(inv.consumido)+1;}
  else{allocation.liberado=amount(allocation.liberado)+1;inv.general=amount(inv.general)+1;allocation.ultimaDevolucionEn=timestamp;}
  inv.actualizadoEn=timestamp;return {tracked:true};
 }
 for(const input of selected){
  if(!object(input)||Object.keys(input).some(name=>!['key','serie','materialKey'].includes(name))||!key(input.key)||seen.has(input.key))fail('SV_OT_CUSTODY_SELECTION','Hay unidades duplicadas o inválidas.');seen.add(input.key);
  const matches=expectedUnits.filter(u=>u.key===input.key);if(matches.length!==1)fail('SV_OT_CUSTODY_SELECTION','La unidad ya no pertenece a esta OT.');
  const unit=matches[0];if(!key(unit.itemKey)||!Number.isInteger(unit.n)||unit.n<0||unit.service===true||unit.measured===true)fail('SV_OT_CUSTODY_SELECTION','Este renglón no admite custodia por serie.');
  const previous=Object.hasOwn(next,input.key)?next[input.key]:null;let materialKey=previous?.materialKey||input.materialKey;
  if(!key(materialKey)||!Object.hasOwn(nextMaterials,materialKey)||!object(nextMaterials[materialKey]))fail('SV_OT_CUSTODY_MATERIAL','Elegí el renglón de materiales correspondiente.');
  if(unit.materialKey!==undefined&&unit.materialKey!==materialKey||input.materialKey!==undefined&&input.materialKey!==materialKey)fail('SV_OT_CUSTODY_MATERIAL','El renglón de materiales cambió.');
  if(previous&&(previous.itemKey!==unit.itemKey||previous.n!==unit.n||previous.sourceDigest!==unit.sourceDigest||previous.productKey!==(unit.productKey||'')||previous.technicianKey!==technicianKey))fail('SV_OT_CUSTODY_IDENTITY','La identidad o asignación de la unidad cambió. No se modificó.');
  const chosen=action==='entregar'?serial(input.serie):previous?.serie;
  if(action!=='entregar'&&!previous)fail('SV_OT_CUSTODY_MISSING','Primero debe registrarse la entrega de esa unidad.');
  if(previous&&input.serie!==undefined&&serial(input.serie)!==previous.serie)fail('SV_OT_CUSTODY_IDENTITY','La serie registrada se conserva.');
  if(action==='entregar'&&assets[input.key]||['devolver','recibir'].includes(action)&&assets[input.key])fail('SV_OT_CUSTODY_INSTALLED','La unidad ya tiene equipo o garantía. Su devolución requiere el circuito de posventa.');
  if(action==='entregar'&&previous){if(previous.estado==='en_tecnico'&&previous.serie===chosen)continue;fail('SV_OT_CUSTODY_PRESERVED','La custodia previa se conserva; no se reasigna automáticamente.');}
  if(action==='devolver'&&previous.estado==='devolucion_pendiente'||action==='recibir'&&previous.estado==='devuelto'||action==='instalar'&&previous.estado==='instalado')continue;
  if(action==='devolver'&&previous.estado!=='en_tecnico'||action==='recibir'&&previous.estado!=='devolucion_pendiente'||action==='instalar'&&previous.estado!=='en_tecnico')fail('SV_OT_CUSTODY_TRANSITION','Ese cambio no corresponde al estado actual de la unidad.');
  if(action==='entregar'&&Object.entries(next).some(([id,r])=>id!==input.key&&r.estado!=='devuelto'&&serialId(r.serie)===serialId(chosen)))fail('SV_OT_CUSTODY_DUPLICATE_SERIAL','La serie ya está en otra unidad bajo custodia.');
  const row=previous?copy(previous):{unitKey:unit.key,itemKey:unit.itemKey,n:unit.n,materialKey,productKey:unit.productKey||'',sourceDigest:unit.sourceDigest,technicianKey,serie:chosen,historial:[]};
  if(row.historial.length>=500)fail('SV_OT_CUSTODY_HISTORY','El historial de esta unidad requiere revisión administrativa.');
  const state={entregar:'en_tecnico',devolver:'devolucion_pendiente',recibir:'devuelto',instalar:'instalado'}[action];
  const inventoryResult=['recibir','instalar'].includes(action)?moveInventory(unit,action):{tracked:false};
  const event={accion:action,estado:state,uid,technicianKey,ts:timestamp};row.historial.push(event);row.estado=state;row.actualizadoEn=timestamp;row.actualizadoPor=uid;
  if(action==='entregar')row.entregadoEn=timestamp;if(action==='devolver')row.devolucionSolicitadaEn=timestamp;if(action==='recibir')row.recibidoEn=timestamp;if(action==='instalar')row.instaladoEn=timestamp;
  if(['recibir','instalar'].includes(action))row.inventarioOperativo=inventoryResult.tracked;
  Object.defineProperty(next,input.key,{value:row,enumerable:true,writable:true,configurable:true});touched.add(materialKey);events.push({unitKey:input.key,...event});
 }
 for(const materialKey of touched){
  const before=counts(registry,materialKey),after=counts(next,materialKey),m=nextMaterials[materialKey],old=materials[materialKey];
  const priorUnits=Object.values(registry).filter(r=>r.materialKey===materialKey).length,totalUnits=Object.values(next).filter(r=>r.materialKey===materialKey).length;
  const sold=amount(old.vendida);if(!Number.isInteger(sold)||sold<1||totalUnits>sold)fail('SV_OT_CUSTODY_QUANTITY','Las series superan la cantidad del renglón.');
  if(!priorUnits&&['instalada','devuelta','devueltaPendiente','danada','faltante'].some(f=>amount(old[f])>0))fail('SV_OT_CUSTODY_LEGACY','El renglón ya tiene una rendición histórica. Revisá su identificación sin reemplazarla.');
  const newlyCaptured=totalUnits-priorUnits,untrackedDelivered=Math.max(0,amount(old.entregada)-priorUnits),capturedExisting=Math.min(newlyCaptured,untrackedDelivered);
  for(const field of Object.values(fields)){let legacy=amount(old[field])-before[field];if(legacy<0)fail('SV_OT_CUSTODY_COUNTER','La rendición anterior no coincide con sus unidades.');if(field==='enTecnico')legacy=Math.max(0,legacy-capturedExisting);m[field]=legacy+after[field];}
  m.entregada=Math.max(amount(old.entregada),totalUnits);if(m.entregada>sold)fail('SV_OT_CUSTODY_QUANTITY','La entrega supera la cantidad solicitada.');
  const classified=['instalada','devuelta','devueltaPendiente','enTecnico','danada','faltante'].reduce((sum,f)=>sum+amount(m[f]),0);if(classified>m.entregada)fail('SV_OT_CUSTODY_COUNTER','Las cantidades clasificadas superan la entrega.');
  m.custodiaActiva=true;m.custodiaClasificada=classified===m.entregada;m.custodiaSerialRevision=amount(old.custodiaSerialRevision)+1;
  m.estadoCustodia=m.devueltaPendiente?'devolucion_pendiente':m.enTecnico?'en_tecnico':m.instalada?'instalado':'devuelto';
 }
 return {registry:next,materials:nextMaterials,inventory:stock,events,changed:events.length>0};
}
module.exports=Object.freeze({plan,serial,serialId,STATES});
