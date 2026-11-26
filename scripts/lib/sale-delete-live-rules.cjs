'use strict';
// Separate LIVE proposal. Never installs H/Financial or prepares business data.
const crypto=require('node:crypto'),Indexed=require('./sale-delete-current-rules.cjs'),Cascade=require('./sale-delete-ot-cascade-rules.cjs'),Actor=require('./sale-delete-actor-precondition-rules.cjs'),Namespaces=require('./sale-delete-namespace-precondition-rules.cjs');
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const STAGES=Object.freeze(['activity-and-h3-existing-authority','sale-delete-live-ot-cascade','sale-delete-current-actor-all-grants','sale-delete-namespace-pre-post-cas']);
function prepare(bytes,options){
 if(!Buffer.isBuffer(bytes)&&typeof bytes!=='string')throw Error('Se requieren bytes del baseline exacto.');
 if(!options||Object.keys(options).join(',')!=='expectedBaselineSha256'||options.expectedBaselineSha256!==Indexed.BASELINE_SHA256||sha(bytes)!==Indexed.BASELINE_SHA256)throw Error('Baseline efectivo distinto o contrato de opciones inválido.');
 const original=JSON.parse(bytes.toString()),before=JSON.stringify(original),stages=[];let candidate=original;
 function stage(name,result){candidate=result.rules;stages.push({name,sha256:sha(JSON.stringify(candidate))});return result;}
 stage(STAGES[0],Indexed.activity(candidate));const cascade=stage(STAGES[1],Cascade.prepare(candidate,{mode:'live-originals'}));stage(STAGES[2],Actor.prepare(candidate));stage(STAGES[3],Namespaces.prepare(candidate));
 for(const p of Namespaces.ROOTS)if(JSON.stringify(candidate.rules[p])!==JSON.stringify(original.rules[p]))throw Error('El modo LIVE alteró autoridad de H/Financial.');
 if(JSON.stringify(original)!==before)throw Error('Baseline modificado.');
 return{rules:candidate,manifest:{schema:1,mode:'live-originals',baselineSha256:Indexed.BASELINE_SHA256,candidateSha256:sha(JSON.stringify(candidate)),stages,namespaceRoots:Namespaces.ROOTS,namespaceCAS:'pre-and-post-all-existing-grants',technicalRootsAdded:[],sourceGrantExtension:cascade.manifest,parentGrantsAdded:false,installsHistoryFinancial:false,activatesStandaloneOTDelete:false,activated:false,activationReady:false,pending:['genuine-live-provider-full-http-native-emulator','unchanged-native-ot-delete-v2-regression','writer-closure-and-live-root-absence','remote-baseline-recheck']}};
}
module.exports={prepare,STAGES,BASELINE_SHA256:Indexed.BASELINE_SHA256};
