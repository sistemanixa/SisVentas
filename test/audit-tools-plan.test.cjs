'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
test('las herramientas transferibles no autentican ni modifican nada al ejecutarlas sin modo explícito',()=>{
 for(const script of ['audit-user-metadata','verify-audit-read-contexts','remove-obsolete-credentials']){
  const run=spawnSync(process.execPath,['scripts/'+script+'.cjs'],{encoding:'utf8',env:{...process.env,PATH:''}});assert.equal(run.status,0,script+' '+run.stderr);assert.equal(JSON.parse(run.stdout).mode,'plan');
 }
});
