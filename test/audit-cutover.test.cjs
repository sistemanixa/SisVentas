'use strict';
const {test}=require('node:test'),assert=require('assert/strict'),{spawnSync}=require('child_process'),{preparePermissions}=require('../scripts/apply-audit-cutover.cjs');
test('la migración solo agrega índice/revisión y conserva las decisiones y datos de cada rol',()=>{
 const config={_version:7};for(const r of ['admin','administrativo','vendedor','tecnico_vendedor','tecnico'])config[r]={bloqueados:r==='admin'?[]:['configuracion','usuarios'],permitidos:['nuevo'],acciones:{dashboard:{chat:false}},datoConservado:'ficticio'};
 const original=structuredClone(config),next=preparePermissions(config);assert.deepEqual(config,original);
 for(const role of Object.keys(config).filter(k=>k!=='_version')){const saved=structuredClone(next[role]);for(const k of ['indiceVersion','indiceRevision','indiceModulos'])delete saved[k];assert.deepEqual(saved,original[role]);}
 assert.throws(()=>preparePermissions({...config,_version:6}));assert.throws(()=>preparePermissions({...config,desconocido:{bloqueados:[]}}));
});
test('el corte por defecto es un plan sin autenticación ni red y apply exige las huellas',()=>{
 for(const args of [[],['--apply']]){const r=spawnSync(process.execPath,['scripts/apply-audit-cutover.cjs',...args],{encoding:'utf8',env:{...process.env,PATH:''}});if(!args.length){assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).mode,'plan');}else{assert.notEqual(r.status,0);assert.match(r.stderr,/huella/);}}
});
