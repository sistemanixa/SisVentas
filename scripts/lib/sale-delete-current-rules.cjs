'use strict';
// Offline proposal only: no flags, runtime, IO, preparation or activation.
const crypto=require('node:crypto'),History=require('./client-history-write-rules.cjs'),Financial=require('./sale-financial-write-rules.cjs'),Fence=require('../../cotizador/labor-fence-policy');
const BASELINE_SHA256='5a5f7b34de6cbba2ae54517029de956b6be605e21143fe4a86c131255052e48f';
const ACTIVITY=Object.freeze(['agenda','ordenes','listas_materiales','remitos','equipos','tickets','ordenesTrabajo']);
const H3=Object.freeze(['reclamos','equipos','tickets']),TARGETS=Object.freeze([...new Set([...ACTIVITY,...H3])]);
const STAGES=Object.freeze(['history-write-side','financial-write-side','activity-and-h3-existing-authority','sale-delete-pristine-ot-cascade','sale-delete-current-actor-all-grants']);
const sha=v=>crypto.createHash('sha256').update(v).digest('hex'),closed=v=>[undefined,false,'false'].includes(v);
function activity(input){
 const out=structuredClone(input),data=out.rules.sisventas,changed=[];
 if(!closed(out.rules['.write'])||!closed(data['.write']))throw Error('Autoridad padre fuera del cierre.');
 for(const[k,v]of Object.entries(out.rules))if(k.startsWith('$')&&JSON.stringify(v).includes('".write"'))throw Error('Comodín raíz fuera del cierre.');
 function visit(node,depth,path,condition){
  if(!node||typeof node!=='object'||Array.isArray(node))throw Error('Fuente no revisable.');
  const old=node['.write'];
  if(!closed(old)){
   if(typeof old!=='string')throw Error('Grant no revisable.');
   // Existing original authority remains an independent AND: never adds the
   // generic financialRule server grant or removes a native writer restriction.
   const live='('+Fence.fence(depth,Fence.userActor)+') || ('+Fence.fence(depth,Fence.serverActor)+')';
   const precondition='('+Fence.permissionsIdle+') || ('+live+')';
   node['.write']='('+old+') && ('+(condition?'!('+condition+') || ('+precondition+')':precondition)+')';changed.push(path+'/.write');
  }
  for(const[k,v]of Object.entries(node))if(!k.startsWith('.'))visit(v,depth+1,path+'/'+k,condition);
 }
 for(const d of TARGETS){if(!data[d])throw Error('Falta fuente '+d);visit(data[d],2,'sisventas/'+d);}
 for(const[k,v]of Object.entries(data))if(k.startsWith('$')){if(!/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(k))throw Error('Comodín no revisable.');visit(v,2,'sisventas/'+k,TARGETS.map(d=>k+" === '"+d+"'").join(' || '));}
 return{rules:out,changed};
}
function prepare(bytes,options){
 if(!Buffer.isBuffer(bytes)&&typeof bytes!=='string')throw Error('Se requieren bytes del baseline exacto.');
 if(!options||Object.keys(options).join(',')!=='expectedBaselineSha256'||options.expectedBaselineSha256!==BASELINE_SHA256||sha(bytes)!==BASELINE_SHA256)throw Error('Baseline efectivo distinto o contrato de opciones inválido.');
 const original=JSON.parse(bytes.toString()),before=JSON.stringify(original),stages=[];let candidate=original;
 for(const[name,build]of [[STAGES[0],History.prepare],[STAGES[1],Financial.prepare]]){candidate=build(candidate);stages.push({name,sha256:sha(JSON.stringify(candidate))});}
 const restricted=activity(candidate);candidate=restricted.rules;stages.push({name:STAGES[2],sha256:sha(JSON.stringify(candidate))});
 const cascade=require('./sale-delete-ot-cascade-rules.cjs').prepare(candidate);candidate=cascade.rules;stages.push({name:STAGES[3],sha256:sha(JSON.stringify(candidate)),manifest:cascade.manifest});
 const pinned=require('./sale-delete-actor-precondition-rules.cjs').prepare(candidate);candidate=pinned.rules;stages.push({name:STAGES[4],sha256:sha(JSON.stringify(candidate))});
 if(JSON.stringify(original)!==before)throw Error('Baseline modificado.');
 return{rules:candidate,manifest:{schema:1,baselineSha256:BASELINE_SHA256,candidateSha256:sha(JSON.stringify(candidate)),stages,activity:ACTIVITY,h3:H3,activityChanged:restricted.changed,sourceGrantsAdded:true,parentGrantsAdded:false,sourceGrantExtension:cascade.manifest,addsTechnicalRootsOnly:['sv_client_history','sv_client_history_config','sv_sale_financial_dependencies'],activated:false,activationReady:false,includesOrderDelete:false,includesOTDelete:false,includesSaleReturn:false,preservesExistingAccountsPagesPayment:true,pending:['genuine-full-command-native-emulator','all-scoped-writers-closure','remote-baseline-recheck','metadata-preparation-and-verification']}};
}
module.exports={prepare,BASELINE_SHA256,ACTIVITY,H3,TARGETS,STAGES,activity};
