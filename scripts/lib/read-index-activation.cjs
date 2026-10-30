'use strict';
// One-time technical indexes. Never changes original messages, orders or stock.
const crypto=require('node:crypto'),Chat=require('../../js/core/chat-header-model'),Ops=require('../../js/core/operational-read-model');
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const roots=['sv_chat',...Ops.domains.map(d=>'sisventas/'+d)],targets=['sv_chat_headers','sisventas/compras_resumen'];
const key=k=>Ops.key(k)&&/^[A-Za-z0-9_-]{1,240}$/.test(k);
function freezeRules(base){const out=structuredClone(base);function deny(node){for(const [k,v]of Object.entries(node)){if(k==='.write')node[k]=false;else if(!k.startsWith('.')&&v&&typeof v==='object')deny(v);}node['.write']=false;}for(const root of roots){let node=out.rules;for(const part of root.split('/'))node=node?.[part];if(!node)throw Error('Falta la regla original de '+root);deny(node);}return out;}
async function scan(read){const values={},chat={},operational={};let records=0;
 async function mapped(keys,fn){let cursor=0;const rows=new Array(keys.length);await Promise.all(Array.from({length:Math.min(6,keys.length)},async()=>{while(cursor<keys.length){const i=cursor++;rows[i]=await fn(keys[i]);}}));return rows;}
 for(const root of roots){const keys=Object.keys(await read(root,{shallow:true})||{});if(keys.length>10000)throw Error('Revisar el volumen de '+root);values[root]={};
  for(const id of keys)if(!key(id))throw Error('Identificador histórico que requiere revisión en '+root);
  if(root==='sv_chat'){
   for(const id of keys){const messageKeys=Object.keys(await read(root+'/'+id,{shallow:true})||{});if(messageKeys.length>10000)throw Error('Revisar volumen del canal');for(const messageId of messageKeys)if(!key(messageId))throw Error('Mensaje histórico que requiere revisión');records+=messageKeys.length;if(records>25000)throw Error('Revisar el volumen de la preparación');const messages=await mapped(messageKeys,messageId=>read(root+'/'+id+'/'+messageId));values[root][id]={};chat[id]={};messageKeys.forEach((messageId,i)=>{values[root][id][messageId]=messages[i];chat[id][messageId]=Chat.chat(messages[i]);});}
  }else{records+=keys.length;if(records>25000)throw Error('Revisar el volumen de la preparación');const data=await mapped(keys,id=>read(root+'/'+id));keys.forEach((id,i)=>{const record=data[i];if(!record||typeof record!=='object'||Array.isArray(record))throw Error('Registro operativo histórico inválido');values[root][id]=record;});const domain=root.split('/')[1],source=values[root],rows={};for(const [id,record]of Object.entries(source))rows[id]=Ops.summary(domain,record);rows._svCoverage={schema:1,ready:true,baselineCount:keys.length,sourceHash:hash(source)};Ops.parseIndex(domain,rows);operational[domain]=rows;}
 }
 return {values,indexes:{sv_chat_headers:chat,'sisventas/compras_resumen':operational},sourceHash:hash(values),counts:Object.fromEntries(roots.map(root=>[root,root==='sv_chat'?Object.values(values[root]).reduce((n,c)=>n+Object.keys(c).length,0):Object.keys(values[root]).length]))};
}

async function activate({read,write,baseRules,candidateRules,prepared,onPhase=()=>{}}){
 const same=require('node:util').isDeepStrictEqual,rulesPath='.settings/rules',frozen=freezeRules(baseRules);let phase='preflight';
 if(!same(await read(rulesPath),baseRules))throw Error('Otra publicación cambió las reglas');
 for(const target of targets)if(await read(target)!==null)throw Error('El índice ya existe: no sobrescribirlo');
 const lease=await read('sv_labor_guard');if(lease&&Number(lease.expiresAt)>Date.now())throw Error('Hay un guardado financiero en curso; reintentar cuando termine');
 // Server editing is paused; browser sends and operational mutations are then
 // frozen by exact rules. No financial permission or historical value changes.
 await write('sv_chat_headers_config',{schema:1,ready:false});await write('sv_operational_read_config',{schema:1,ready:false});
 try{
  phase='freezing';await write(rulesPath,frozen);phase='frozen';onPhase(phase);if(!same(await read(rulesPath),frozen))throw Error('No se confirmó la pausa técnica');
  const current=await scan(read);if(current.sourceHash!==prepared.sourceHash)throw Error('Los originales cambiaron: preparar nuevamente antes de activar');
  for(const target of targets){if(await read(target)!==null)throw Error('Apareció un índice concurrente');await write(target,prepared.indexes[target]);if(!same(await read(target),prepared.indexes[target]))throw Error('No se confirmó el índice');}
  if(!same(await read(rulesPath),frozen))throw Error('Otra publicación cambió la pausa');
  await write(rulesPath,candidateRules);phase='active';onPhase(phase);if(!same(await read(rulesPath),candidateRules))throw Error('Verificar reglas antes de continuar');
  await write('sv_chat_headers_config',{schema:1,ready:true});await write('sv_operational_read_config',{schema:1,ready:true});
  return {ready:true,sourceWrites:0,financialWrites:0,counts:prepared.counts,sourceHash:prepared.sourceHash,rulesHash:hash(candidateRules)};
 }catch(error){if(['freezing','frozen'].includes(phase)&&same(await read(rulesPath),frozen)){await write(rulesPath,baseRules);if(!same(await read(rulesPath),baseRules))throw Error('No se confirmó la recuperación de reglas');onPhase('restored');}throw error;}
}
module.exports={scan,activate,freezeRules,hash,roots,targets};
