'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Overlay=require('../scripts/lib/employee-resources-runtime-overlay.cjs');
const inject="Object.assign(override.token,require('./employee-resources-policy').reserved(actor?.claims));if(actor?.employeeResources||actor.operation?.startsWith('employee-resources-')){Object.assign(override.token,require('./employee-resources-policy').validate(actor,lease,patch));}";
const fixture=api=>"function commit(){const override=service('commit',lease,actor);return override;}\nconst api={"+api+",acquire,commit,abort,query};";
test('native and Accounts-derived stores are the only two accepted API anchors',()=>{
 for(const name of ['read','read,readQuery']){const source=fixture(name),out=Overlay.store(source);assert.ok(out.includes('employeeResourcesCommitVersion:1,'+name));assert.equal(out.replace('employeeResourcesCommitVersion:1,','').replace(inject,''),source);assert.throws(()=>Overlay.store(out));}
 for(const source of [fixture('read,query'),fixture('read')+'\n'+fixture('read,readQuery'),fixture('read')+'\nconst api={read,acquire,commit,abort,',fixture('read').replace('const api=','const api =')])assert.throws(()=>Overlay.store(source));
});
test('real reviewed Accounts assembly preserves readQuery, writer claims and all unrelated native bytes',{skip:!process.env.SV_CLIENT_ACCOUNTS_ASSEMBLY},()=>{
 const root=process.env.SV_CLIENT_ACCOUNTS_ASSEMBLY,source=fs.readFileSync(path.join(root,'labor-rtdb-store.js'),'utf8'),out=Overlay.store(source);
 assert.ok(source.includes('const api={read,readQuery,acquire,commit,abort,'));assert.equal(out.replace('employeeResourcesCommitVersion:1,','').replace(inject,''),source);new vm.Script(out,{filename:'combined-labor-rtdb-store.js'});
 const originalIndex=fs.readFileSync(path.join(root,'index.js'),'utf8'),index=Overlay.index(originalIndex);
 assert.equal((index.match(/await employeeResourcesHTTP\(req,res\)/g)||[]).length,1);assert.ok(index.includes("if(req.method!=='OPTIONS'&&await employeeResourcesHTTP(req,res))return;"));new vm.Script(index,{filename:'combined-index.js'});assert.throws(()=>Overlay.index(index));
});
