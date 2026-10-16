'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
test('Hosting solo incluye activos públicos y la importación no autentica ni despliega',()=>{
 const {files,config}=require('../scripts/deploy-secure-hosting.cjs');assert.ok(files().includes('index.html'));
 for(const file of files())assert.ok(!/(^|\/)(security|docs|drafts|tmp|\.local|\.git|node_modules)(\/|$)/.test(file));
 for(const field of ['Content-Security-Policy','X-Frame-Options','X-Content-Type-Options','Strict-Transport-Security','Referrer-Policy'])assert.ok(config.headers[0].headers[field]);
});
test('Hosting no consulta credenciales por defecto y rechaza apply sin commit revisado',()=>{
 for(const args of [[],['--apply']]){const r=spawnSync(process.execPath,['scripts/deploy-secure-hosting.cjs',...args],{encoding:'utf8',env:{...process.env,PATH:''}});if(!args.length){assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).mode,'plan');}else{assert.notEqual(r.status,0);assert.match(r.stderr,/expected-commit/);}}
});
