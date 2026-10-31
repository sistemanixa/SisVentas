'use strict';
const crypto=require('node:crypto'),{isDeepStrictEqual:same}=require('node:util'),M=require('../../js/core/record-list-model');
const roots=M.domains.map(d=>'sisventas/'+d),target=M.index,config='sv_record_list_config';
function canonical(v){if(v==null)return 'null';if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
const hash=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
function storedIndex(value){const out=structuredClone(value);for(const row of Object.values(out?.ordenes_trabajo||{})){const d=row?._svListDocumental;if(d&&Array.isArray(d.faltantes)&&d.faltantes.length===0)delete d.faltantes;}return out;}
const sameIndex=(a,b)=>same(storedIndex(a),storedIndex(b));
function freezeRules(rules){const out=structuredClone(rules);function deny(node){for(const [k,v]of Object.entries(node))if(k==='.write')node[k]=false;else if(!k.startsWith('.')&&v&&typeof v==='object')deny(v);node['.write']=false;}for(const path of roots){const domain=path.split('/')[1];if(!out.rules?.sisventas?.[domain])throw Error('Falta regla original');deny(out.rules.sisventas[domain]);}return out;}
async function scan(read){const originals={},indexes={},counts={};let total=0;
 for(const root of roots){const keys=Object.keys(await read(root,{shallow:true})||{}).sort();if(keys.some(k=>!M.key(k))||keys.length>10000||(total+=keys.length)>25000)throw Error('Revisar las claves o el volumen del índice');let cursor=0;const values=new Array(keys.length);await Promise.all(Array.from({length:Math.min(3,keys.length)},async()=>{while(cursor<keys.length){const i=cursor++;values[i]=await read(root+'/'+keys[i]);}}));
  const records={},rows={},domain=root.split('/')[1];keys.forEach((key,i)=>{const record=values[i];M.requireComplete(record);if(!record||typeof record!=='object'||Array.isArray(record))throw Error('Original inválido');records[key]=record;rows[key]=M.summary(domain,record);});
  rows._svCoverage={schema:1,ready:true,baselineCount:keys.length,sourceHash:hash(records)};M.parseIndex(domain,rows);originals[root]=records;indexes[domain]=rows;if(domain==='gastos'){indexes.gastos_empleado=Object.fromEntries(Object.entries(records).map(([id,row])=>[id,M.publicExpense(row)]));indexes.gastos_empleado._svCoverage={...rows._svCoverage};}counts[domain]=keys.length;
 }return {originals,indexes,counts,sourceHash:hash(originals)};
}
async function activate({read,write,baseRules,candidateRules,prepared,onPhase=()=>{}}){
 const rulesPath='.settings/rules',labor='sv_labor_config',frozen=freezeRules(baseRules);let phase='preflight',paused;
 if(!same(await read(rulesPath),baseRules))throw Error('Las reglas cambiaron');if(await read(target)!==null)throw Error('Ya existe el índice: no se sobrescribe');
 const existingConfig=await read(config);if(existingConfig!==null)throw Error('Ya existe otra preparación');
 const originalLabor=await read(labor);if(originalLabor?.schema!==1||originalLabor.ready!==true)throw Error('Los guardados financieros ya están pausados o sin preparar');
 const lease=await read('sv_labor_guard');if(lease&&Number(lease.expiresAt)>Date.now())throw Error('Hay una operación financiera activa. No se inició el corte.');
 try{
  paused={...originalLabor,ready:false};await write(labor,paused);phase='paused';onPhase(phase);if(!same(await read(labor),paused))throw Error('No se confirmó la pausa financiera');
  const active=await read('sv_labor_guard');if(active&&Number(active.expiresAt)>Date.now())throw Error('Comenzó una operación financiera. Se cancela el corte.');
  await write(config,{schema:1,ready:false});phase='freezing';await write(rulesPath,frozen);phase='frozen';onPhase(phase);if(!same(await read(rulesPath),frozen))throw Error('No se confirmó la pausa de originales');
  const current=await scan(read);if(current.sourceHash!==prepared.sourceHash)throw Error('Los originales cambiaron. Preparar nuevamente sin sobrescribirlos.');
  if(await read(target)!==null)throw Error('Apareció un índice concurrente');await write(target,prepared.indexes);if(!sameIndex(await read(target),prepared.indexes))throw Error('No se confirmó el índice');
  if(!same(await read(rulesPath),frozen))throw Error('Otra publicación cambió las reglas');phase='activating';await write(rulesPath,candidateRules);phase='active';onPhase(phase);if(!same(await read(rulesPath),candidateRules))throw Error('No se confirmaron las reglas finales');
  await write(config,{schema:1,ready:true});if(!same(await read(config),{schema:1,ready:true}))throw Error('No se confirmó disponibilidad');
  if(!same(await read(labor),paused))throw Error('Otra tarea cambió la pausa financiera');await write(labor,originalLabor);paused=null;
  return {ready:true,sourceWrites:0,financialWrites:0,counts:prepared.counts,sourceHash:prepared.sourceHash,rulesHash:hash(candidateRules)};
 }catch(error){
  let currentRules;try{currentRules=await read(rulesPath);}catch(_){throw Error('No se pudo verificar la recuperación. Se conserva la pausa financiera. '+error.message);}
  if(phase!=='active'&&same(currentRules,frozen)){await write(rulesPath,baseRules);currentRules=await read(rulesPath);if(!same(currentRules,baseRules))throw Error('No se confirmó la recuperación de reglas. Se conserva la pausa financiera.');onPhase('restored');}
  if(same(currentRules,baseRules)&&paused&&same(await read(labor),paused)){await write(labor,originalLabor);paused=null;}
  // After activating new rules never blindly restore old authority. A partial
  // activation keeps financial writes paused for explicit verified recovery.
  throw error;
 }
}
module.exports={scan,activate,freezeRules,hash,roots,target,config,sameIndex};
