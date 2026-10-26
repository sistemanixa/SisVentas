'use strict';
const {isDeepStrictEqual}=require('node:util');
const failure=(code='SV_ADVANCE_PERIOD_REVIEW_REQUIRED',message='Revisá el mes de descuento del adelanto antes de aplicar una compensación.')=>Object.assign(Error(message),{statusCode:409,code});
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const key=value=>typeof value==='string'&&!!value&&Buffer.byteLength(value)<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(value);
const validMonth=value=>typeof value==='string'&&/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value);
const explicit=value=>value!==undefined&&value!==null&&value!=='';
const periodField=value=>explicit(value?.periodoDescuento)?value.periodoDescuento:null;
const advance=value=>object(value)&&([value.tipo,value.tipoPagable].some(type=>String(type||'').toLowerCase()==='adelanto')||/^adelanto_personal/.test(String(value.origen||'')));
function delivered(value){
 if(!object(value))return false;
 const state=String(value.estado||'').toLowerCase(),payments=value.pagos&&typeof value.pagos==='object'?Object.values(value.pagos):[];
 // Detection is deliberately as conservative as the existing client reader;
 // it does not normalize or authorize any amount to be written.
 if(['pagado','pagado_parcial'].includes(state)||parseFloat(value.montoPagado)>0||parseFloat(value.saldoPagadoLegacy)>0||parseFloat(value.montoCompensado)>0)return true;
 if(payments.some(payment=>payment&&payment.anulado!==true&&String(payment.estado||'').toLowerCase()!=='anulado'&&parseFloat(payment.monto)>0))return true;
 return state==='aprobado'&&!payments.length&&!(parseFloat(value.montoPagado)>0)&&!value.fechaPago&&!value.gastoFbKey;
}
function periodPermission(profile,permissions){
 const role=profile?.rol;if(profile?.activo!==true||!['admin','administrativo','vendedor','tecnico_vendedor','tecnico'].includes(role))return false;
 if(permissions!=null&&(!object(permissions)||permissions.indiceVersion!==2||permissions.indiceModulos?.ctaemp!==true||Object.values(permissions.bloqueados||{}).includes('ctaemp')))return false;
 return ['gestionarAdelantos','aprobarMovimiento'].some(action=>{const override=permissions?.acciones?.empleados?.[action];return override!==undefined&&override!==null?override===true:action==='gestionarAdelantos'?['admin','administrativo'].includes(role):role==='admin';});
}

function nextMonth(value){
 const text=String(value||'').trim();let match=text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
 if(!match){const local=text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(local)match=[text,local[3],local[2],local[1]];}
 if(!match)return '';
 const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]),date=new Date(Date.UTC(year,month-1,day,12));
 if(year<1000||date.getUTCFullYear()!==year||date.getUTCMonth()+1!==month||date.getUTCDate()!==day)return '';
 const result=(month===12?year+1:year)+'-'+String(month===12?1:month+1).padStart(2,'0');return validMonth(result)?result:'';
}
function discountPeriod(value){
 const chosen=periodField(value);if(chosen!==null)return validMonth(String(chosen))?String(chosen):'';
 return nextMonth(value?.fechaPago)||nextMonth(value?.fecha);
}
function compensationMonth(value){
 const text=typeof value==='string'?value:'';if(validMonth(text))return text;
 return /^[1-9]\d{3}_(0[1-9]|1[0-2])$/.test(text)?text.replace('_','-'):'';
}
function amount(value){
 if(value===undefined||value===null||value==='')return 0;
 if(!['string','number'].includes(typeof value))return NaN;
 const number=Number(value);return Number.isFinite(number)&&number>=0?number:NaN;
}
function monthlyAmounts(value){
 const totals=new Map();if(!object(value))return totals;
 for(const [key,raw]of Object.entries(value)){const month=compensationMonth(key),money=amount(raw);if(month&&Number.isFinite(money))totals.set(month,(totals.get(month)||0)+money);}
 return totals;
}
function compensationIncreases(before,after){
 const old=object(before?.compensaciones)?before.compensaciones:{},next=object(after?.compensaciones)?after.compensaciones:{};
 // Old malformed entries are not revalidated during an unrelated correction.
 for(const [key,value]of Object.entries(next)){
  if(isDeepStrictEqual(value,old[key]))continue;
  const previous=amount(old[key]),current=amount(value);
  if(!Number.isFinite(current))throw failure();
  if(current>(Number.isFinite(previous)?previous:0)&&!compensationMonth(key))throw failure();
 }
 const oldTotals=monthlyAmounts(old),newTotals=monthlyAmounts(next),increases=[];
 for(const [month,value]of newTotals){const increment=value-(oldTotals.get(month)||0);if(increment>0)increases.push({month,amount:increment});}
 const oldAggregate=amount(before?.montoCompensado),newAggregate=amount(after?.montoCompensado);
 if(!isDeepStrictEqual(before?.montoCompensado,after?.montoCompensado)&&!Number.isFinite(newAggregate))throw failure();
 const aggregateIncrease=Number.isFinite(newAggregate)?newAggregate-(Number.isFinite(oldAggregate)?oldAggregate:0):0;
 const attributed=increases.reduce((sum,row)=>sum+row.amount,0),tolerance=Number.EPSILON*Math.max(1,Math.abs(aggregateIncrease),Math.abs(attributed))*4;
 if(aggregateIncrease>attributed+tolerance)throw failure('SV_ADVANCE_COMPENSATION_MONTH_REQUIRED','La nueva compensación requiere su mes y detalle. Revisá el adelanto antes de guardar.');
 return {increases,oldTotals,newTotals};
}
function detailIncreases(before,after){
 const old=object(before?.adelantosAplicados)?before.adelantosAplicados:{},next=object(after?.adelantosAplicados)?after.adelantosAplicados:{},result=[];
 for(const [id,row]of Object.entries(next)){
  if(isDeepStrictEqual(row,old[id]))continue;
  const previous=amount(object(old[id])?old[id].monto:old[id]),current=amount(object(row)?row.monto:row);
  if(!Number.isFinite(current))throw failure();
  if(current<=(Number.isFinite(previous)?previous:0))continue;
  if(!key(id)||!object(row)||explicit(row.adelantoFbKey)&&row.adelantoFbKey!==id)throw failure();
  result.push({id,amount:current-(Number.isFinite(previous)?previous:0)});
 }
 const previous=amount(before?.adelantoCompensado),current=amount(after?.adelantoCompensado);
 if(!isDeepStrictEqual(before?.adelantoCompensado,after?.adelantoCompensado)&&!Number.isFinite(current))throw failure();
 const aggregate=Number.isFinite(current)?current-(Number.isFinite(previous)?previous:0):0,attributed=result.reduce((sum,row)=>sum+row.amount,0),tolerance=Number.EPSILON*Math.max(1,Math.abs(aggregate),Math.abs(attributed))*4;
 if(aggregate>attributed+tolerance)throw failure('SV_ADVANCE_COMPENSATION_DETAIL_REQUIRED','La compensación requiere el detalle del adelanto en el mismo guardado. Actualizá la cuenta antes de continuar.');
 return result;
}
function recordMonth(value,path,linkedMonths=[]){
 const candidates=[...linkedMonths];
 for(const field of ['mes','periodoComputo','periodoTrabajo'])if(explicit(value?.[field])){if(!validMonth(value[field]))throw failure();candidates.push(value[field]);}
 const parts=path.split('/');if(parts[1]==='haberes')candidates.push(compensationMonth(parts[3]));
 else if(parts[1]==='ctaemp'&&/^haber_/.test(parts[3]||''))candidates.push(compensationMonth(parts[3].slice(6)));
 const months=new Set(candidates);if(months.size!==1||!validMonth([...months][0]))throw failure();return [...months][0];
}
function casCoverage(actor,path){
 const body=actor?.input||{},sources=body.kind==='atomic'?body.expectedHashes:body.kind==='compare'?{[body.path]:body.expectedHash}:{};
 return Object.entries(object(sources)?sources:{}).filter(([base,hash])=>typeof base==='string'&&/^[a-f0-9]{64}$/.test(hash||'')&&(path===base||path.startsWith(base+'/')))
  .filter(([base])=>base.split('/').length>=3&&base.startsWith('sisventas/')).sort((a,b)=>b[0].length-a[0].length)[0]||null;
}

// All reads belong to the command's existing fence. No timer, background task,
// collection query, mutation, new permission or historical rewrite lives here.
async function validateAdvanceDiscount({actor,raw,get,changes=[],patch={},digest,readFresh}){
 if(actor?.mode!=='user')return;
 if(typeof raw!=='function'||typeof get!=='function'||typeof digest!=='function')throw failure();
 const pairs=new Map(),moves=new Set(),months=new Set(),expenses=new Map(),validated=new Map(),cas=new Map();let authority=null;
 for(const change of changes)if(change.domain==='gastos')expenses.set('sisventas/gastos/'+change.key,{before:change.before,after:change.after});
 async function pair(path){
  if(expenses.has(path))return expenses.get(path);
  if(!pairs.has(path))pairs.set(path,(async()=>{const values=await Promise.allSettled([raw,get].map(read=>Promise.resolve().then(()=>read(path))));const failed=values.find(value=>value.status==='rejected');if(failed)throw failed.reason;return {before:values[0].value,after:values[1].value};})());
  return pairs.get(path);
 }
 function commandCAS(path,action){
  if(actor?.mode!=='user'||actor.operation!=='employee-account-command'||actor.input?.action!==action)return null;
  const proof=require('./employee-account-commands').trustedCommand(actor),body=actor.input,movement='sisventas/ctaemp/'+body.employeeId+'/'+body.movementKey;
  return proof&&proof.uid===actor.uid&&actor.claims?.uid===actor.uid&&proof.action===body.action&&proof.employeeId===body.employeeId&&proof.movementKey===body.movementKey&&proof.expectedRevision===body.expectedRevision&&/^[A-Za-z0-9_-]{16,128}$/.test(body.expectedRevision||'')&&Object.hasOwn(proof.paths,path)&&(path===movement||path==='sisventas/gastos/'+proof.gastoKey)?[path,proof.paths[path]]:null;
 }
 async function checkedCAS(path,legacyMedium=false){
  const source=casCoverage(actor,path)||commandCAS(path,'deliver-advance')||(legacyMedium?commandCAS(path,'correct-medium'):null);
  if(!source)throw failure('SV_ADVANCE_PERIOD_CAS_REQUIRED','Actualizá la cuenta y elegí el mes de descuento antes de guardar.');
  const [base,hash]=source;if(!cas.has(base))cas.set(base,Promise.resolve().then(()=>raw(base)).then(value=>{if(digest(value)!==hash)throw failure('SV_CAS_CONFLICT','El adelanto cambió. Actualizá la cuenta antes de guardar.');}));await cas.get(base);
 }
 async function requirePeriodPermission(){
  if(!authority)authority=(async()=>{
   if(!key(actor.uid)||actor.claims?.uid!==actor.uid||typeof readFresh!=='function')throw failure('SV_ADVANCE_PERIOD_PERMISSION_DENIED','No tenés permiso para elegir o cambiar el mes de una entrega.');
   const profile=await raw('sv_chat_roles/'+actor.uid),role=profile?.rol;
   if(!['admin','administrativo','vendedor','tecnico_vendedor','tecnico'].includes(role))throw failure('SV_ADVANCE_PERIOD_PERMISSION_DENIED','No tenés permiso para elegir o cambiar el mes de una entrega.');
   const permissions=await raw('sv_permisos/'+role);
   if(!periodPermission(profile,permissions))throw failure('SV_ADVANCE_PERIOD_PERMISSION_DENIED','No tenés permiso para elegir o cambiar el mes de una entrega.');
   return {role,revision:permissions?.indiceRevision??null,digest:digest(permissions||{})};
  })();return authority;
 }
 async function approvedMaterialization(path,before,after,chosen){
  if(advance(before)&&delivered(before)&&periodField(before)===null&&discountPeriod(before)===chosen)return true;
  if(before!==null||!path.startsWith('sisventas/gastos/'))return false;
  const legacy=String(after?.legacyKey||'').match(/^ctaemp\/([^/]+)\/([^/]+)$/);
  if(!legacy||!key(legacy[1])||!key(legacy[2]))return false;
  const source='sisventas/'+legacy[0],legacyMedium=!!commandCAS(source,'correct-medium');if(!casCoverage(actor,source)&&!legacyMedium)return false;
  await checkedCAS(source,legacyMedium);await checkedCAS(path,legacyMedium);const {before:original,after:current}=await pair(source),id=path.split('/')[2];
  if(!advance(original)||!advance(current)||!delivered(original)||discountPeriod(original)!==chosen||discountPeriod(current)!==chosen||original.gastoFbKey&&original.gastoFbKey!==id||current.gastoFbKey!==id)return false;
  if(!original.gastoFbKey&&id!=='adelanto_'+legacy[1].replace(/[^a-zA-Z0-9_-]/g,'_')+'_'+legacy[2].replace(/[^a-zA-Z0-9_-]/g,'_'))return false;
  if(after.empleadoId!==legacy[1]||after.empleadoFbKey!==legacy[1]||amount(after.monto)!==amount(original.monto)||amount(current.monto)!==amount(original.monto)||amount(after.montoPagado)!==amount(current.montoPagado)||!isDeepStrictEqual(after.pagos??null,current.pagos??null)||after.medio!==current.medioPago)return false;
  const payments=original.pagos&&typeof original.pagos==='object'?Object.values(original.pagos):[];
  if(payments.length){
   if(!legacyMedium)return isDeepStrictEqual(original.pagos,current.pagos)&&amount(current.montoPagado)===amount(original.montoPagado);
   // Existing delivery only: retain the original month, payment keys, amounts,
   // dates, annulments and private history. This command may change medium only.
   if(!isDeepStrictEqual(periodField(original),periodField(current))||amount(current.montoPagado)!==amount(original.montoPagado)||Array.isArray(original.pagos)!==Array.isArray(current.pagos)||!isDeepStrictEqual(Object.keys(original.pagos||{}),Object.keys(current.pagos||{})))return false;
   return Object.keys(original.pagos).every(id=>{const before={...original.pagos[id]},after={...current.pagos[id]};delete before.medio;delete after.medio;return isDeepStrictEqual(before,after);});
  }
  const normalized=current.pagos&&typeof current.pagos==='object'?Object.entries(current.pagos):[];
  // The existing legacy normalizer represents an already delivered amount; it
  // does not authorize a second delivery or a larger synthetic payment.
  return String(original.estado||'').toLowerCase()==='aprobado'&&!(parseFloat(original.montoPagado)>0)&&!original.fechaPago&&normalized.length===1&&normalized[0][0]==='pago_legacy_'+legacy[2].replace(/[^a-zA-Z0-9_-]/g,'_')&&amount(normalized[0][1]?.monto)===amount(original.monto)&&amount(current.montoPagado)===amount(original.monto)&&normalized[0][1]?.origen==='compatibilidad_legacy'&&normalized[0][1]?.medio==='Sin especificar'&&current.medioPago==='Sin especificar';
 }
 for(const [path,value]of Object.entries(patch)){
  const p=path.split('/');if(p[0]!=='sisventas')continue;
  if(p[1]==='ctaemp'){
   if(p.length>=4)moves.add(p.slice(0,4).join('/'));
   else if(p.length===3){const data=await pair(path);for(const id of new Set([...Object.keys(object(data.before)?data.before:{}),...Object.keys(object(data.after)?data.after:{})]))if(!isDeepStrictEqual(data.before?.[id]??null,data.after?.[id]??null)){if(!key(id))throw failure();moves.add(path+'/'+id);}}
   // The existing commission validator rejects a complete ctaemp replacement.
  }else if(p[1]==='haberes'){
   if(p.length>=4)months.add(p.slice(0,4).join('/'));
   else if(p.length===3&&object(value)){for(const id of Object.keys(value)){if(!key(id))throw failure();months.add(path+'/'+id);}}
   else if(p.length===2&&object(value)){for(const [employee,records]of Object.entries(value)){if(!key(employee))throw failure();for(const id of Object.keys(object(records)?records:{})){if(!key(id))throw failure();months.add(path+'/'+employee+'/'+id);}}}
  }
 }
 const owners=new Map(),monthProofs=new Map(),mirrors=[];
 function ownExpense(id,employee){if(!key(id)||!key(employee))return;if(!owners.has(id))owners.set(id,new Set());owners.get(id).add(employee);}
 for(const path of [...moves,...months]){const data=await pair(path),p=path.split('/');if(object(data.after)&&key(data.after.gastoFbKey))ownExpense(data.after.gastoFbKey,p[2]);if(detailIncreases(data.before,data.after).length){
   mirrors.push({path,...data,employee:p[2]});
   const expense=data.after?.gastoFbKey;
   // A legacy expense may lack its month. Only original, CAS-protected
   // counterparts (or a jointly created pair) may supply the missing metadata.
   if(key(expense)&&(data.before?.gastoFbKey===expense||data.before===null&&expenses.get('sisventas/gastos/'+expense)?.before==null)){
    if(!monthProofs.has(expense))monthProofs.set(expense,[]);monthProofs.get(expense).push({path,employee:p[2],before:data.before,after:data.after});
   }
  }}
 for(const [path,data]of expenses){const rows=detailIncreases(data.before,data.after);if(rows.length)mirrors.push({path,...data,expense:path.split('/')[2]});}
 async function validateAdvance(path,data){
  if(validated.has(path))return validated.get(path);
  const result=(async()=>{
   const {before,after}=data;if(!object(after)||!advance(before)&&!advance(after))return null;
   const delta=compensationIncreases(before,after),oldPeriod=periodField(before),newPeriod=periodField(after),created=!advance(before),changed=!isDeepStrictEqual(oldPeriod,newPeriod);
   if(changed){if(!validMonth(String(newPeriod??'')))throw failure();if(object(before))await checkedCAS(path);}
   const selectingDeliveryMonth=newPeriod!==null&&(changed&&(delivered(before)||delivered(after))||!delivered(before)&&delivered(after));
   if(selectingDeliveryMonth&&!await approvedMaterialization(path,before,after,String(newPeriod)))await requirePeriodPermission();
   // Existing undated legacy history stays untouched. A new allocation uses its
   // original delivery metadata unless an explicit, CAS-checked month changed.
   const target=discountPeriod(created||changed?after:before);
   if((created||changed||delta.increases.length)&&!target)throw failure();
   for(const row of delta.increases)if(row.month<target)throw failure('SV_ADVANCE_COMPENSATION_TOO_EARLY','El adelanto todavía no corresponde al mes que se está liquidando. Revisá su mes de descuento.');
   return {target,...delta};
  })();validated.set(path,result);return result;
 }
 for(const path of moves)await validateAdvance(path,await pair(path));
 for(const [path,data]of expenses)await validateAdvance(path,data);
 for(const mirror of mirrors){
  let employee=mirror.employee;
  if(!employee){const candidates=owners.get(mirror.expense);if(candidates?.size===1)employee=[...candidates][0];
   else{const legacy=String(mirror.after?.legacyKey||'').match(/^ctaemp\/([^/]+)\/([^/]+)$/);if(!legacy||!key(legacy[1])||!key(legacy[2]))throw failure();const source='sisventas/'+legacy[0];await checkedCAS(source);const linked=await pair(source);if(linked.after?.gastoFbKey!==mirror.expense)throw failure();employee=legacy[1];}}
  if(!key(employee))throw failure();
  const linkedMonths=[];
  if(mirror.expense && !['mes','periodoComputo','periodoTrabajo'].some(field=>explicit(mirror.after?.[field]))){
   for(const proof of monthProofs.get(mirror.expense)||[])if(proof.employee===employee){await checkedCAS(proof.path);const current=recordMonth(proof.after,proof.path),original=proof.before===null?current:recordMonth(proof.before,proof.path);if(original!==current)throw failure();linkedMonths.push(original);}
   if(!linkedMonths.length){const legacy=String(mirror.after?.legacyKey||'').match(/^ctaemp\/([^/]+)\/([^/]+)$/);if(legacy&&legacy[1]===employee){const source='sisventas/'+legacy[0];await checkedCAS(source);const linked=await pair(source);if(linked.before?.gastoFbKey===mirror.expense&&linked.after?.gastoFbKey===mirror.expense){const original=recordMonth(linked.before,source);if(original!==recordMonth(linked.after,source))throw failure();linkedMonths.push(original);}}}
  }
  const month=recordMonth(mirror.after,mirror.path,linkedMonths);
  for(const row of detailIncreases(mirror.before,mirror.after)){
   const path='sisventas/ctaemp/'+employee+'/'+row.id;
   // A mirror cannot open another employee by a payload ID. Its original
   // source is either a touched CTA route or an already authorized CAS source.
   if(!moves.has(path))await checkedCAS(path);
   const original=await pair(path);if(!advance(original.before)&&!advance(original.after))throw failure();
   const checked=await validateAdvance(path,original),increment=checked?.increases.find(value=>value.month===month)?.amount||0;
   if(!checked||!checked.target||month<checked.target)throw failure('SV_ADVANCE_COMPENSATION_TOO_EARLY','El adelanto todavía no corresponde al mes que se está liquidando. Revisá su mes de descuento.');
   const tolerance=Number.EPSILON*Math.max(1,Math.abs(increment),Math.abs(row.amount))*4;if(increment+tolerance<row.amount)throw failure('SV_ADVANCE_COMPENSATION_DETAIL_REQUIRED','La compensación requiere el detalle del adelanto en el mismo guardado. Actualizá la cuenta antes de continuar.');
  }
 }
 if(authority){const initial=await authority;return async function revalidateAdvancePeriodPermission(){
  const values=await Promise.allSettled(['sv_chat_roles/'+actor.uid,'sv_permisos/'+initial.role].map(path=>Promise.resolve().then(()=>readFresh(path))));
  if(values.some(value=>value.status==='rejected'))throw failure('SV_ADVANCE_PERIOD_PERMISSION_UNCONFIRMED','No se pudo confirmar el permiso de la entrega. Revisá la conexión antes de reintentar.');
  const [profile,permissions]=values.map(value=>value.value);
  if(profile?.rol!==initial.role||!periodPermission(profile,permissions)||(permissions?.indiceRevision??null)!==initial.revision||digest(permissions||{})!==initial.digest)throw failure('SV_LABOR_AUTH_CHANGED','Los permisos cambiaron. Volvé a revisar la entrega antes de guardar.');
 };}
}
module.exports={validateAdvanceDiscount,validMonth,nextMonth,discountPeriod,compensationMonth,compensationIncreases,detailIncreases,delivered,periodPermission};
