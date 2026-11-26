'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),B=require('../scripts/lib/sale-delete-current-rules.cjs');
const baseline='C:/SisVentas/tmp/runtime-6b6276dd/rules-current-20261125.private.json';
test('exact effective baseline composes only H/Financial and narrowed Activity/H3 existing grants',()=>{
 const raw=fs.readFileSync(baseline),original=JSON.parse(raw),r=B.prepare(raw,{expectedBaselineSha256:B.BASELINE_SHA256});
 a.deepEqual(r.manifest.stages.map(x=>x.name),B.STAGES);a.equal(r.manifest.activationReady,false);a.equal(r.manifest.sourceGrantsAdded,false);
 const prefix=require('../scripts/lib/sale-delete-actor-precondition-rules.cjs').prefix;
 function unpin(node){const copy=structuredClone(node);function visit(n){if(!n||typeof n!=='object')return;if(typeof n['.write']==='string'&&n['.write'].startsWith(prefix))n['.write']=n['.write'].slice(prefix.length,-1);for(const[k,v]of Object.entries(n))if(!k.startsWith('.'))visit(v);}visit(copy);return copy;}
 for(const d of ['sv_client_accounts','sv_client_accounts_config','sv_commercial_pages','sv_commercial_pages_config','sv_labor_indexes','sv_labor_guard','sv_labor_receipts','sv_labor_config'])a.deepEqual(unpin(r.rules.rules[d]),original.rules[d],d+' exact after removing the sole conditional actor AND');
 for(const d of ['ordenes','listas_materiales','reclamos','equipos','tickets','agenda','remitos','ordenesTrabajo']){
  function check(old,next){for(const[k,v]of Object.entries(old)){if(k==='.write'&&typeof v==='string'&&v!=='false')a(next[k].includes('('+v+')'),d+' retains every original grant');else if(k.startsWith('.'))a.deepEqual(next[k],v);else check(v,next[k]);}}
  check(original.rules.sisventas[d],r.rules.rules.sisventas[d]);
 }
 a.equal(r.rules.rules['.write'],original.rules['.write']);a.equal(r.rules.rules.sisventas['.write'],original.rules.sisventas['.write']);
 a.deepEqual(fs.readFileSync(baseline),raw);
});
test('wrong baseline bytes/options and injected permission choices fail closed',()=>{
 const raw=fs.readFileSync(baseline);for(const opts of [undefined,{}, {expectedBaselineSha256:'0'.repeat(64)},{expectedBaselineSha256:B.BASELINE_SHA256,enable:true}])a.throws(()=>B.prepare(raw,opts));
 a.throws(()=>B.prepare(Buffer.from('{}'),{expectedBaselineSha256:B.BASELINE_SHA256}));a.throws(()=>B.prepare(JSON.parse(raw),{expectedBaselineSha256:B.BASELINE_SHA256}));
});
