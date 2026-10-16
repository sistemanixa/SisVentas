'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {buildStages,stages}=require('../scripts/prepare-access-permission-stages.cjs');
const {rulesProtectPasswords}=require('../cotizador/password-policy.js');
const read=name=>JSON.parse(fs.readFileSync('security/database.'+name+'.candidate.json','utf8'));
test('las etapas combinadas conservan el guard en cada concesión y no mutan la base publicada',()=>{
 const current=read('password-access'),before=structuredClone(current),result=buildStages(current);
 assert.deepEqual(current,before);assert.equal(result.baseHash,'2fab3dfbda44e88c165729f4ab41bdcd8c3b36318f8dd280d81286675a20b56c');
 for(const stage of stages){const candidate=result.stages[stage];assert.equal(rulesProtectPasswords(candidate),true);assert.equal(candidate.rules.sv_access_resets['.read'],false);assert.equal(candidate.rules.sv_access_control['.write'],false);}
});
test('rechaza componer si la base protegida cambia o se elimina su restricción',()=>{
 for(const mutate of [r=>r.rules.sisventas['.read']=true,r=>delete r.rules.sv_access_control,r=>r.rules.extra={'.read':false}]){
  const input=read('password-access');mutate(input);assert.throws(()=>buildStages(input),/base protegida cambió/);
 }
});
test('las etapas heredadas no bastan para mantener la recuperación de acceso publicada',()=>{
 for(const stage of stages)assert.equal(rulesProtectPasswords(read(stage)),false);
});
for(const file of ['prepare-domain-reads','prepare-known-role-read'])test(file+' impide regenerar accidentalmente una base protegida sin su guard',()=>{
 const build=require('../scripts/'+file+'.cjs').build,current=read('password-access'),before=structuredClone(current);
 assert.throws(()=>build(current),/conservar el guard/);assert.deepEqual(current,before);
});
test('la composición solo modifica concesiones y añade los dos nodos privados',()=>{
 const {stages:result}=buildStages();
 function grants(node){for(const [k,v]of Object.entries(node)){if(k==='.read'||k==='.write')delete node[k];else if(v&&typeof v==='object')grants(v);}return node;}
 for(const stage of stages){const candidate=structuredClone(result[stage]);delete candidate.rules.sv_access_resets;delete candidate.rules.sv_access_control;assert.deepEqual(grants(candidate),grants(read(stage)));}
});
