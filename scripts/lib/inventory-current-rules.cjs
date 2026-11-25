'use strict';
// Fixed offline checkpoint for the exact effective rules recovered on 2026-11-25.
// No filesystem, network, deployment, opt-in installation or injected builders.
const crypto=require('node:crypto'),Activation=require('../../cotizador/stock-link-activation-contract');
const Combined=require('./inventory-combined-rules.cjs'),Installed=require('./inventory-installed-rules.cjs'),Catalog=require('./inventory-catalog-interlock-rules.cjs'),SourceV2=require('./purchase-source-cost-v2-rules.cjs'),Numbering=require('./purchase-numbering-rules.cjs'),OT=require('./ot-final-family-rules.cjs'),Preserve=require('./inventory-ledger-preservation-rules.cjs'),Presence=require('./office-stock-precondition-rules.cjs');
const BASELINE_SHA256='5a5f7b34de6cbba2ae54517029de956b6be605e21143fe4a86c131255052e48f';
const STAGES=Object.freeze(['link-stock-order-source-v1','sticky-installation','catalog-original-authority-interlock','purchase-source-cost-v2','private-purchase-numbering','ot-final-families','ot-delete-prepared-v3','purchase-current-pending-atomic-authority','ledger-preservation','office-stock-atomic-presence']);
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function attributes(node,path=[],out=new Map()){
  for(const[k,v]of Object.entries(node))if(k.startsWith('.'))out.set(path.concat(k).join('/'),v);else attributes(v,path.concat(k),out);
  return out;
}
function prepare(bytes,options){
  if(!Buffer.isBuffer(bytes)&&typeof bytes!=='string')throw Error('Se requieren bytes del baseline exacto, no una candidata ni un objeto serializado.');
  if(sha(bytes)!==BASELINE_SHA256)throw Error('Baseline efectivo distinto: requiere revisión explícita.');
  if(!options||Object.keys(options).some(k=>k!=='activationPins'))throw Error('Sólo se admiten pins de activación; no opciones de permisos ni builders.');
  const activationPins=Activation.pins(options.activationPins);
  if(activationPins.baselineDigest!==BASELINE_SHA256)throw Error('Pins no ligados al baseline efectivo.');
  const input=JSON.parse(bytes.toString()),original=JSON.stringify(input),stages=[];
  let candidate=input;
  function stage(name,build){const result=build(candidate);candidate=result.rules;stages.push({name,digest:sha(JSON.stringify(candidate)),manifest:result.manifest});}
  stage(STAGES[0],value=>Combined.prepare(value,{activationPins,preparedFinancial:false}));
  stage(STAGES[1],value=>Installed.prepare(value,{activationPins}));
  stage(STAGES[2],value=>Catalog.prepare(value,{baseline:input,activationPins}));
  stage(STAGES[3],value=>SourceV2.prepare(value,{activationPins}));
  stage(STAGES[4],value=>Numbering.prepare(value,{activationPins}));
  stage(STAGES[5],value=>OT.prepare(value,{activationPins}));
  stage(STAGES[6],value=>require('./ot-delete-inventory-v3-rules.cjs').prepare(value,{activationPins,baseline:input}));
  stage(STAGES[7],value=>require('./purchase-current-pending-precondition-rules.cjs').prepare(value));
  stage(STAGES[8],value=>Preserve.prepare(value,{activationPins}));
  stage(STAGES[9],value=>Presence.prepare(value));
  if(JSON.stringify(input)!==original)throw Error('La composición alteró el baseline.');
  const before=attributes(input.rules),after=attributes(candidate.rules),diff=[];
  for(const path of [...new Set([...before.keys(),...after.keys()])].sort())if(JSON.stringify(before.get(path))!==JSON.stringify(after.get(path)))diff.push({path,beforePresent:before.has(path),afterPresent:after.has(path),beforeHash:before.has(path)?sha(JSON.stringify(before.get(path))):null,afterHash:after.has(path)?sha(JSON.stringify(after.get(path))):null});
  for(const path of ['.read','.write','sisventas/.read','sisventas/.write'])if(JSON.stringify(before.get(path))!==JSON.stringify(after.get(path)))throw Error('Cambió autoridad raíz: '+path);
  for(const[path,grant]of after)if(path.endsWith('.write')&&![false,'false',undefined].includes(grant)&&!grant.startsWith('('+Presence.predicate+') && ('))throw Error('Grant fuera del cierre final: '+path);
  const serialized=JSON.stringify(candidate);
  return{rules:candidate,manifest:{schema:1,baselineDigest:BASELINE_SHA256,candidateDigest:sha(serialized),candidateBytes:Buffer.byteLength(serialized),stages,diff,preparedFinancial:false,installsHistoryFinancialOptIns:false,activated:false,readyForActivation:false,pending:['full-command-combined-emulator','writer-closure-and-preparation'],presenceAppliedLast:true}};
}
module.exports={prepare,BASELINE_SHA256,STAGES};
