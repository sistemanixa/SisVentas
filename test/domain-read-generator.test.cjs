'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {build}=require('../scripts/prepare-domain-reads.cjs');
const policy=require('../js/core/domain-read-policy.js');
const base=()=>JSON.parse(fs.readFileSync('security/database.domain-write.candidate.json','utf8'));
test('generar lecturas no muta la base y conserva exactamente la excepción externa de productos',()=>{
 const input=base(),original=structuredClone(input),result=build(input);
 assert.deepEqual(input,original);
 const read=result.rules.sisventas.productos['.read'];
 assert.ok(read.endsWith(' || ('+original.rules.sisventas.productos['.read']+')'));
 assert.match(read,/query\.orderByChild === 'categoria'/);
 assert.match(read,/query\.equalTo === 'COMPRAS PARAGUAY'/);
 assert.deepEqual(result.rules.sisventas.productos['.indexOn'],original.rules.sisventas.productos['.indexOn']);
 assert.equal(result.rules.sisventas['.read'],false);
});
test('la generación conserva escrituras y validaciones; solo explicita escrituras previamente heredadas',()=>{
 const input=base(),result=build(input);
 function collect(o,p='',out={}){for(const [k,v]of Object.entries(o)){if(k==='.write'||k==='.validate')out[p+'/'+k]=v;else if(v&&typeof v==='object')collect(v,p+'/'+k,out);}return out;}
 const before=collect(input),after=collect(result);
 for(const name of Object.keys(policy.domains).filter(n=>!n.includes('/'))){if(!input.rules.sisventas[name]){
  const key='/rules/sisventas/'+name+'/.write';assert.equal(after[key],input.rules.sisventas.contadores['.write']);delete after[key];
 }}
 assert.deepEqual(after,before);
});
test('la candidata guardada coincide con el generador corregido y la base versionada',()=>{
 assert.deepEqual(JSON.parse(fs.readFileSync('security/database.domain-read.candidate.json','utf8')),build(base()));
});
