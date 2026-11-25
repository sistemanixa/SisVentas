'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {audit}=require('../scripts/audit-server-inventory-current.cjs');
test('diagnóstico usa aplicación activa y no convierte slash genérico en endpoint demostrado',()=>{
 const result=audit(path.resolve(__dirname,'..'));
 const active=require('./helpers/active-app').readActiveApp();
 assert.equal(result.activeApp,'js/'+active.filename);
 assert.equal(result.summary.routes,90);assert.ok(result.summary.genericSlashReferences>20);
 assert.ok(result.routes.find(r=>r.route==='/').callers.every(c=>c.evidence==='generic-slash-is-not-endpoint-evidence'&&c.lines.length===0));
 assert.ok(result.routes.every(r=>r.runtime==='not-verified'&&r.measurement==='not-measured-by-this-script'));
 assert.ok(result.routes.flatMap(r=>r.callers).filter(c=>/^js\/app\.v/.test(c.file)).every(c=>c.file===result.activeApp));
 assert.ok(result.routes.flatMap(r=>r.callers).every(c=>c.loadStatus==='not-proven-by-literal-match'));
});
