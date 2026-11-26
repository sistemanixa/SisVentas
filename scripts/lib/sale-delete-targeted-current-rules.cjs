'use strict';
// Reproducible offline successor of the reviewed LIVE candidate; never applies.
const crypto=require('node:crypto'),Live=require('./sale-delete-live-rules.cjs'),Writer=require('./sale-delete-targeted-writer-rules.cjs');
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
function prepare(bytes,options){const prior=Live.prepare(bytes,options),result=Writer.prepare(prior.rules);return{rules:result.rules,manifest:{schema:1,mode:'targeted-index',baselineSha256:Live.BASELINE_SHA256,previousCandidateSha256:prior.manifest.candidateSha256,candidateSha256:sha(JSON.stringify(result.rules)),stages:[...prior.manifest.stages,{name:'targeted-index-source-writer-closure',sha256:sha(JSON.stringify(result.rules))}],writer:result.manifest,installsHistoryFinancial:false,activatesStandaloneOTDelete:false,activated:false,activationReady:false,pending:['genuine-command-and-writer-native-emulator','all-source-writers-updated-before-index-installation','metadata-bootstrap-with-complete-originals','remote-baseline-recheck']}};}
module.exports={prepare,BASELINE_SHA256:Live.BASELINE_SHA256};
