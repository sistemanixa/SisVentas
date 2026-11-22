'use strict';
// Explicit invocation only: full private rules stay outside Git; local emulator only.
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {prepare}=require('../scripts/lib/catalog-write-fence-rules.cjs');
const base='http://127.0.0.1:9058',ns='demo-catalog-fence-20261122';
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
async function request(method,path,value,actor){
 const url=new URL(base+'/'+path+'.json');url.searchParams.set('ns',ns);
 const headers={'Content-Type':'application/json'};
 if(actor){const now=Math.floor(Date.now()/1000);url.searchParams.set('auth',encode({alg:'none',typ:'JWT'})+'.'+encode({iss:'https://securetoken.google.com/'+ns,aud:ns,sub:actor.uid,user_id:actor.uid,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'custom'},...actor.token})+'.');}
 else headers.Authorization='Bearer owner';
 return fetch(url,{method,headers,...(value===undefined?{}:{body:JSON.stringify(value)})});
}
async function owner(method,path,value){const r=await request(method,path,value);a.equal(r.status,200,'local owner '+method+' '+path);return r.json();}
function seed(){return {sv_labor_config:{schema:1,ready:true},sv_chat_roles:{admin:{activo:true,rol:'admin'},dist:{activo:true,rol:'distribuidora'},tech:{activo:true,rol:'tecnico'}},sv_permisos:{admin:{indiceVersion:2,indiceRevision:1,indiceModulos:{productos:true}}},sv_distribuidora_permisos:{editar:true,crear:true},sisventas:{productos:{p:{nombre:'Producto ficticio',codigo:'OLD',categoria:'COMPRAS PARAGUAY',activo:true}}}};}
const sdk={uid:'admin',token:{}},lease=()=>({fence:'fiction-fence',opId:'fiction-catalog-operation',digest:'a'.repeat(64),actorUid:'admin',mode:'user',expiresAt:Date.now()+50000});
function native(){
 const {createLaborRtdbStore}=require('../cotizador/labor-rtdb-store'),{createLaborGuard}=require('../cotizador/labor-guard');
 const fetchImpl=async(target,init)=>{const u=new URL(target);a.equal(u.origin,base);a.equal(u.searchParams.get('ns'),ns);const raw=u.searchParams.get('auth_variable_override');if(!raw)return fetch(u,init);return request(init.method,decodeURIComponent(u.pathname.slice(1,-5)),init.body===undefined?undefined:JSON.parse(init.body),JSON.parse(raw));};
 const store=createLaborRtdbStore({databaseURL:base+'/?ns='+ns,accessToken:async()=>'owner',fetchImpl});return {store,guard:createLaborGuard({store})};
}
test('full copied rules: catalog barrier and native coordinated writer', {timeout:90000},async t=>{
 a.ok(process.env.SV_CATALOG_RULES_FILE,'Explicit private baseline path required');
 const bytes=fs.readFileSync(process.env.SV_CATALOG_RULES_FILE);
 a.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'ea197750dc668aedffc5e182dd6a6e7fd6e939279690cf4a8077ac4cd975f3db');
 const baseline=JSON.parse(bytes),candidate=prepare(baseline);
 await t.test('full candidate changes only catalog write envelopes and preserves every validator/index',()=>{
  let changed=0;function compare(before,after,path=[]){a.deepEqual(Object.keys(after),Object.keys(before));for(const key of Object.keys(before)){
   const p=path.concat(key);if(JSON.stringify(before[key])===JSON.stringify(after[key]))continue;
   if(before[key]&&after[key]&&typeof before[key]==='object'&&typeof after[key]==='object')compare(before[key],after[key],p);
   else {a.equal(key,'.write');a.equal(p[1],'sisventas');a.ok(['productos','$dominio'].includes(p[2]));a.ok(after[key].includes('&& ('+before[key]+')'));changed++;}
  }}compare(baseline,candidate);a.equal(changed,6);a.deepEqual(prepare(candidate),candidate);
 });
 await t.test('baseline reproduction admits SDK catalog during a live lease',async()=>{await owner('PUT','.settings/rules',baseline);const s=seed();s.sv_labor_guard=lease();await owner('PUT','',s);a.equal((await request('PUT','sisventas/productos/p/codigo','BASELINE',sdk)).status,200);});
 await owner('PUT','.settings/rules',candidate);
 await t.test('SDK allowed before and after guard, blocked at parent, record and alias during lease',async()=>{
  await owner('PUT','',seed());a.equal((await request('PUT','sisventas/productos/p/codigo','BEFORE',sdk)).status,200);
  await owner('PUT','sv_labor_guard',lease());const before=await owner('GET','sisventas/productos');
  for(const [path,value]of [['sisventas/productos',{p:{nombre:'Falso'}}],['sisventas/productos/p',{nombre:'Falso'}],['sisventas/productos/p/codigo','DURING'],['sisventas/productos/p/cod','DURING']])a.equal((await request('PUT',path,value,sdk)).status,401,path);
  a.deepEqual(await owner('GET','sisventas/productos'),before);await owner('DELETE','sv_labor_guard');a.equal((await request('PUT','sisventas/productos/p/codigo','AFTER',sdk)).status,200);
 });
 await t.test('distribuidora child concession cannot bypass parent barrier',async()=>{
  await owner('PUT','',seed());const actor={uid:'dist',token:{}};a.equal((await request('PUT','sisventas/productos/p/nombre','Antes',actor)).status,200);await owner('PUT','sv_labor_guard',lease());a.equal((await request('PUT','sisventas/productos/p/nombre','Durante',actor)).status,401);await owner('DELETE','sv_labor_guard');a.equal((await request('PUT','sisventas/productos/p/nombre','Después',actor)).status,200);
 });
 await t.test('native guard/store commit preserves legitimate catalog writer and immutable receipt replay',async()=>{
  await owner('PUT','',seed());const {createLaborRtdbStore}=require('../cotizador/labor-rtdb-store'),{createLaborGuard}=require('../cotizador/labor-guard');
  const fetchImpl=async(target,init)=>{const u=new URL(target);a.equal(u.origin,base);a.equal(u.searchParams.get('ns'),ns);const raw=u.searchParams.get('auth_variable_override');if(!raw)return fetch(u,init);const actor=JSON.parse(raw);const path=decodeURIComponent(u.pathname.slice(1,-5));return request(init.method,path,init.body===undefined?undefined:JSON.parse(init.body),actor);};
  const store=createLaborRtdbStore({databaseURL:base+'/?ns='+ns,accessToken:async()=>'owner',fetchImpl}),guard=createLaborGuard({store}),actor={uid:'admin',claims:{uid:'admin'},mode:'user',role:'admin',permissionRevision:1,operation:'fiction-catalog-edit',opId:'fiction-catalog-legit',input:{code:'NEW'}};let effects=0;
  const work=async scope=>{effects++;await scope.update({'sisventas/productos/p/codigo':'NEW'});return {ok:true};};
  await guard.run(actor,work);await guard.run(actor,work);a.equal(effects,1);a.equal(await owner('GET','sisventas/productos/p/codigo'),'NEW');a.equal(await owner('GET','sv_labor_guard'),null);a.equal((await owner('GET','sv_labor_receipts/'+actor.opId)).actorUid,'admin');
 });
 await t.test('invalid session and revoked module remain denied when idle',async()=>{
  for(const change of ['password','version','inactive','module']){const s=seed();if(change==='password')s.sv_access_resets={admin:{required:true}};if(change==='version')s.sv_access_resets={admin:{version:'new'}};if(change==='inactive')s.sv_chat_roles.admin.activo=false;if(change==='module')s.sv_permisos.admin.indiceModulos.productos=false;await owner('PUT','',s);a.equal((await request('PUT','sisventas/productos/p/codigo','BAD',sdk)).status,401,change);}
 });
 await t.test('expired lease restores original SDK authority; forged service claims cannot bypass live guard',async()=>{
  await owner('PUT','',seed());await owner('PUT','sv_labor_guard',{...lease(),expiresAt:Date.now()-1000});a.equal((await request('PUT','sisventas/productos/p/codigo','EXPIRED',sdk)).status,200);
  const live=lease();await owner('PUT','sv_labor_guard',live);
  for(const patch of [{fence:'wrong'}, {opId:'wrong-operation'}, {digest:'b'.repeat(64)}, {actorUid:'other'}]){
   const token={svLaborService:true,mode:'commit',...live,...patch};a.equal((await request('PUT','sisventas/productos/p/codigo','FORGED',{uid:'admin',token})).status,401);
  }a.equal(await owner('GET','sisventas/productos/p/codigo'),'EXPIRED');
 });
 await t.test('stale permission revision is rejected through existing beforeCommit hook',async()=>{
  const s=seed();s.sv_permisos.admin.indiceRevision=2;await owner('PUT','',s);const {guard}=native();
  await a.rejects(guard.run({uid:'admin',claims:{uid:'admin'},mode:'user',operation:'fiction-catalog-edit',opId:'fiction-stale-revision',input:{revision:1}},async scope=>{
   const expectedRevision=1;scope.beforeCommit(async({readFresh})=>{a.equal((await readFresh('sv_permisos/admin')).indiceRevision,expectedRevision,'permission revision changed');});
   await scope.update({'sisventas/productos/p/codigo':'STALE'});return {ok:true};
  }),/permission revision changed/);a.equal(await owner('GET','sisventas/productos/p/codigo'),'OLD');a.equal(await owner('GET','sv_labor_receipts/fiction-stale-revision'),null);
 });
 await t.test('session revoked after planning blocks native commit without receipt or data change',async()=>{
  await owner('PUT','',seed());const {guard}=native();
  await a.rejects(guard.run({uid:'admin',claims:{uid:'admin'},mode:'user',operation:'fiction-catalog-edit',opId:'fiction-session-revoked',input:{}},async scope=>{
   await scope.update({'sisventas/productos/p/codigo':'REVOKED'});await owner('PUT','sv_access_resets/admin',{required:true});return {ok:true};
  }));a.equal(await owner('GET','sisventas/productos/p/codigo'),'OLD');a.equal(await owner('GET','sv_labor_receipts/fiction-session-revoked'),null);
 });
 await t.test('overlapping parent and child wildcards cannot bypass barrier; unrelated domain remains exact',async()=>{
  // Synthetic permissive overlaps deliberately added ONLY to the emulator fixture.
  const overlap=structuredClone(baseline);overlap.rules.sisventas.$dominio['.write']='auth != null';overlap.rules.sisventas.$dominio.$record={'.write':'auth != null'};
  overlap.rules.$branch={'.write':false,productos:{'.write':'auth != null','$record':{'.write':'auth != null'}}};
  await owner('PUT','.settings/rules',prepare(overlap));await owner('PUT','',seed());await owner('PUT','sv_labor_guard',lease());
  // Use the already authorized admin so field validators cannot mask a fence bypass.
  const actor=sdk;for(const p of ['sisventas/productos/p/codigo','sisventas/productos/p/cod'])a.equal((await request('PUT',p,'BYPASS',actor)).status,401,p);
  a.equal((await request('PUT','sisventas/fiction_unrelated/record',{value:1},actor)).status,200);
  await owner('DELETE','sv_labor_guard');a.equal((await request('PUT','sisventas/productos/p/codigo','IDLE',actor)).status,200);
  await owner('PUT','.settings/rules',candidate);
 });
});
