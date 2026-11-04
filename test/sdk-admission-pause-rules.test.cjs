'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Pause=require('../scripts/lib/sdk-admission-pause-rules.cjs');
const fixture=()=>({rules:{'.write':false,'.read':false,...Object.fromEntries(Pause.roots.map(name=>[name,{'.read':'auth != null','.write':'auth != null',child:{'.write':'auth.uid === "u"','.validate':'newData.isString()'},$id:{deep:{'.write':'auth != null'}}}])),sv_labor_config:{'.read':false,'.write':'auth != null && auth.token.svLaborService === true','.validate':'newData.hasChildren(["schema","ready"])',$other:{'.validate':false}},privateFinance:{'.read':false,'.write':'auth.uid === "private-owner"'}}});
test('SDK pause wraps every existing scoped write and preserves all other rules and input',()=>{
 const before=fixture(),out=Pause.prepare(before);assert.deepEqual(before,fixture());assert.deepEqual(Pause.strip(out),before);assert.deepEqual(Pause.prepare(out),out);
 for(const name of Pause.roots){assert.equal(out.rules[name]['.read'],before.rules[name]['.read']);assert.equal(out.rules[name].child['.validate'],before.rules[name].child['.validate']);for(const node of [out.rules[name],out.rules[name].child,out.rules[name].$id.deep])assert(node['.write'].includes(Pause.open));}
 assert.deepEqual(out.rules.privateFinance,before.rules.privateFinance);assert.equal(out.rules.sv_labor_config['.write'],before.rules.sv_labor_config['.write']);assert.deepEqual(out.rules.sv_labor_config.sdkAdmissionPaused,{'.validate':'newData.isBoolean()'});
});
test('only absent or false pause admits SDK; original denial always wins',()=>{
 const wrapped=Pause.prepare(fixture()).rules.sv_usuarios['.write'];
 for(const value of [undefined,false,true,0,1,'false',{},[]])for(const authorized of [true,false]){
  const root={child:p=>{assert.equal(p,'sv_labor_config/sdkAdmissionPaused');return {exists:()=>value!==undefined,val:()=>value};}};
  assert.equal(Function('root','auth','return '+wrapped)(root,authorized?{uid:'u'}:null),authorized&&(value===undefined||value===false));
 }
});
test('service bypass is allowed only if every original OR branch required reserved service claim',()=>{
 const input=fixture();input.rules.sisventas['.write']='(auth.token.svLaborService === true && auth.uid === "sv-labor-service") || (auth.token.svLaborService === true && auth.uid === "u")';
 input.rules.sv_usuarios['.write']='auth.token.svLaborService === true || auth.uid === "admin"';
 const out=Pause.prepare(input);assert.match(out.rules.sisventas['.write'],/\|\| \(auth != null && auth.token.svLaborService === true\)\)$/);assert(out.rules.sv_usuarios['.write'].endsWith(Pause.open));
 const root={child:()=>({exists:()=>true,val:()=>true})};assert.equal(Function('root','auth','return '+out.rules.sv_usuarios['.write'])(root,{uid:'admin',token:{svLaborService:true}}),false);
 assert.equal(Pause.requiresService("auth.uid === 'auth.token.svLaborService === true'"),false);
 assert.equal(Pause.requiresService('auth.uid === "admin" ? true : false && auth.token.svLaborService === true'),false);
});
for(const grant of [true,'auth != null'])test('global ancestor grant refuses composition: '+grant,()=>{const input=fixture();input.rules['.write']=grant;assert.throws(()=>Pause.prepare(input),/padre/);});
test('unscoped root wildcard grants, including nested ones, refuse composition',()=>{for(const node of [{'.write':'auth != null'},{'.write':false,$child:{'.write':true}}]){const input=fixture();input.rules.$anything=node;assert.throws(()=>Pause.prepare(input),/comodín/);}});
test('closed root wildcard and scoped wildcard stay closed or receive the gate',()=>{const input=fixture();input.rules.$anything={'.write':false};const out=Pause.prepare(input);assert.equal(out.rules.$anything['.write'],false);assert(out.rules.sisventas.$id.deep['.write'].endsWith(Pause.open));});
test('no invented config authority, root or metadata overwrite',()=>{for(const mutate of [r=>delete r.sv_usuarios,r=>r.sv_labor_config['.write']='auth != null',... [false,null,0,{'.validate':true}].map(value=>r=>r.sv_labor_config.sdkAdmissionPaused=value)]){const input=fixture();mutate(input.rules);assert.throws(()=>Pause.prepare(input));}});
test('partial or altered envelope is rejected rather than normalized by substring',()=>{for(const mutate of [r=>r.sv_usuarios['.write']+=' || true',r=>r.sv_usuarios.child['.write']='auth != null',r=>r.sv_labor_config.sdkAdmissionPaused['.read']=true,r=>r['.write']='auth != null']){const input=Pause.prepare(fixture());mutate(input.rules);assert.throws(()=>Pause.strip(input));}});
test('boolean false grants stay false and true grants retain only their original scope',()=>{const input=fixture();input.rules.sv_usuarios.child['.write']=false;input.rules.sv_usuarios.$id.deep['.write']=true;const out=Pause.prepare(input);assert.equal(out.rules.sv_usuarios.child['.write'],false);assert.equal(out.rules.sv_usuarios.$id.deep['.write'],'(true) && '+Pause.open);});
