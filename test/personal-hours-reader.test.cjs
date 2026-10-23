'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict');
const {createPersonalHoursReader, project} = require('../cotizador/personal-hours-reader');
const Permissions = require('../js/core/permission-index');
const copy = value => value === undefined ? undefined : structuredClone(value);
const request = (url='/laboral/horas-propias',extra={}) => ({method:'GET',url,headers:{authorization:'Bearer fixture-token'},...extra});
const readPath = (state,path) => path.split('/').reduce((value,key)=>value?.[key],state) ?? null;
function fixture(role='tecnico') {
  const state = {sv_chat_roles:{u:{activo:true,rol:role},target:{activo:true,rol:'tecnico'}},sv_permisos:Permissions.build(Object.fromEntries(['admin','administrativo','vendedor','tecnico_vendedor','tecnico'].map(name=>[name,{bloqueados:[],acciones:{dashboard:{miCuenta:true},usuarios:{impersonar:true},empleados:{autorizarHoras:true}}}]))),
    sv_empleado_uid:{u:{perfilFbKey:'p'},target:{perfilFbKey:'target-p'}},sv_usuarios:{p:{uid:'u',rol:role,activo:true,empleadoFbKey:'e'},'target-p':{uid:'target',rol:'tecnico',activo:true,empleadoFbKey:'target-e'}},
    sisventas:{hsextra_solicitudes:{'10':{empFbKey:'e',estado:'pendiente',horas:0.2},'2':{empFbKey:'e',estado:'pendiente',horas:0.1},z:{empFbKey:'e',estado:'aprobado',horas:0.4,fecha:'2026-10-20',mes:'2026-10',fbKey:'embedded-wrong',aportes:{secret:true}},foreign:{empFbKey:'target-e',estado:'rechazado',horas:99,fecha:'2026-09-20'}}}};
  const reads=[],writes=[],tokens=[],actor={uid:'u'},f={state,reads,writes,tokens,actor,queryHook:null,queryValue:undefined};
  const db={ref(path){
    let field,value;
    const ref={orderByChild(next){field=next;return ref;},equalTo(next){value=next;return ref;},async get(){
      reads.push({path,...(field?{field,value}:{})});
      let saved=field?(f.queryValue!==undefined?f.queryValue:Object.fromEntries(Object.entries(readPath(state,path)||{}).filter(([,row])=>row?.[field]===value))):readPath(state,path);
      saved=copy(saved);if(field&&f.queryHook)await f.queryHook(f);return {val:()=>copy(saved)};
    }};
    for(const method of ['set','update','remove','push','transaction','on'])ref[method]=()=>{writes.push({path,method});assert.fail('No side effects');};
    return ref;
  }};
  f.reader=createPersonalHoursReader({db,auth:{async verifyIdToken(token,revoked){tokens.push([token,revoked]);if(f.authError)throw f.authError;return copy(f.actor);}}});return f;
}
async function denied(f,req=request(),status=403) {await assert.rejects(()=>f.reader.read(req),error=>error.statusCode===status);assert.deepEqual(f.writes,[]);}

for(const role of ['admin','administrativo','vendedor','tecnico_vendedor','tecnico'])test('own authenticated '+role+' gets only a fixed own query, exact IDs/order/IEEE and minimal unchanged fields',async()=>{
  const f=fixture(role),before=copy(f.state),result=await f.reader.read(request());
  assert.equal(result.employeeId,'e');assert.deepEqual(result.records.map(row=>row.key),['2','10','z']);
  assert.equal(result.records.reduce((sum,row)=>sum+row.value.horas,0),0.7000000000000001);
  assert.deepEqual(result.records[2].value,{empFbKey:'e',estado:'aprobado',horas:0.4,fecha:'2026-10-20',mes:'2026-10'});
  assert.deepEqual(f.tokens,[['fixture-token',true]]);assert.equal(f.reads.length,11);
  assert.deepEqual(f.reads.filter(row=>row.field),[{path:'sisventas/hsextra_solicitudes',field:'empFbKey',value:'e'}]);
  assert.ok(!f.reads.some(row=>row.path==='sisventas/hsextra_solicitudes'&&!row.field));assert.deepEqual(f.state,before);assert.deepEqual(f.writes,[]);
});
test('legacy scalar fields and missing fields are preserved without coercion or migration',async()=>{
  const f=fixture();f.queryValue={legacy:{empFbKey:'e',estado:0,horas:'0.10',fecha:null,mes:null},missing:{empFbKey:'e'}};
  const result=await f.reader.read(request());assert.deepEqual(result.records.map(row=>row.value),Object.values(f.queryValue));
});
test('dense SDK array keys, nullable gaps and null query snapshots preserve actual enumeration',async()=>{
  const f=fixture();f.queryValue=[{empFbKey:'e',estado:'pendiente',horas:0.1},null,{empFbKey:'e',estado:'pendiente',horas:0.2}];
  assert.deepEqual((await f.reader.read(request())).records.map(row=>row.key),['0','2']);
  f.queryValue=null;assert.deepEqual(await f.reader.read(request()),{employeeId:'e',records:[]});
});
for(const [label,mutate]of [
 ['missing config',f=>delete f.state.sv_permisos.tecnico],['wrong index',f=>f.state.sv_permisos.tecnico.indiceVersion=1],
 ['dashboard blocked',f=>f.state.sv_permisos.tecnico.indiceModulos.dashboard=false],['miCuenta revoked',f=>f.state.sv_permisos.tecnico.acciones.dashboard.miCuenta=false],
 ['invalid action',f=>f.state.sv_permisos.tecnico.acciones.dashboard.miCuenta='true'],['inactive role',f=>f.state.sv_chat_roles.u.activo=false],
 ['external role',f=>f.state.sv_chat_roles.u.rol='distribuidor'],['missing binding',f=>delete f.state.sv_empleado_uid.u],
 ['missing profile',f=>delete f.state.sv_usuarios.p],['inactive profile',f=>f.state.sv_usuarios.p.activo=false],
 ['wrong profile UID',f=>f.state.sv_usuarios.p.uid='target'],['wrong profile role',f=>f.state.sv_usuarios.p.rol='admin'],
 ['empty employee',f=>f.state.sv_usuarios.p.empleadoFbKey=''],['path employee',f=>f.state.sv_usuarios.p.empleadoFbKey='other/employee'],
 ['reset claim',f=>f.actor.svPasswordChangeRequired=true],['reset required',f=>f.state.sv_access_resets={u:{required:true,version:2}}],
 ['stale access version',f=>{f.actor.svAccessVersion=1;f.state.sv_access_resets={u:{required:false,version:2}};}]
])test(label+' fails before the hours query',async()=>{const f=fixture();mutate(f);await denied(f);assert.ok(!f.reads.some(row=>row.field));});
test('matching reset version and published absent action default retain internal own access',async()=>{
  const f=fixture();f.actor.svAccessVersion=2;f.state.sv_access_resets={u:{required:false,version:2}};delete f.state.sv_permisos.tecnico.acciones.dashboard.miCuenta;
  assert.equal((await f.reader.read(request())).records.length,3);
});
for(const [url,extra,status]of [
 ['/laboral/horas-propias?employeeId=other',{},400],['/laboral/horas-propias?path=sisventas',{},400],['/laboral/horas-propias?verComo=p',{},400],
 ['/laboral/horas-propias?viewProfile=p&viewProfile=target-p',{},400],['/laboral/horas-propias?viewProfile=',{},400],['/laboral/horas-propias?viewProfile=bad%2Fkey',{},400],
 ['/other',{},400],['/laboral/horas-propias',{method:'POST'},405],['/laboral/horas-propias',{body:{}},400],
 ['/laboral/horas-propias',{headers:{authorization:'Bearer fixture-token','content-length':'2'}},400],['/laboral/horas-propias',{headers:{}},401]
])test('request injection is rejected: '+url+' '+JSON.stringify(extra),async()=>{const f=fixture();await denied(f,request(url,extra),status);assert.equal(f.reads.length,0);assert.deepEqual(f.writes,[]);});
test('token verification failures and invalid identities are not authoritative empty reads',async()=>{
  const f=fixture();f.authError=Error('invalid');await denied(f,request(),401);f.authError=null;f.actor.uid='bad/path';await denied(f,request(),401);
});
for(const [label,mutate]of [
 ['action',f=>f.state.sv_permisos.tecnico.acciones.dashboard.miCuenta=false],['role',f=>f.state.sv_chat_roles.u.activo=false],
 ['profile',f=>f.state.sv_usuarios.p.activo=false],['binding',f=>f.state.sv_empleado_uid.u.perfilFbKey='target-p'],
 ['reset',f=>f.state.sv_access_resets={u:{required:true,version:2}}],
 ['revision',f=>f.state.sv_permisos.tecnico.indiceRevision++],['employee link',f=>f.state.sv_usuarios.p.empleadoFbKey='changed-e']
])test('midflight '+label+' change withholds the entire response',async()=>{
  const f=fixture();f.queryHook=mutate;await assert.rejects(()=>f.reader.read(request()),error=>[403,409].includes(error.statusCode));assert.equal(f.reads.filter(row=>row.field).length,1);assert.deepEqual(f.writes,[]);
});
test('View as preserves only real administrator with existing impersonation AND root-hours access',async()=>{
  const f=fixture('admin'),req=request('/laboral/horas-propias?viewProfile=target-p'),before=copy(f.state);
  assert.deepEqual(await f.reader.read(req),{employeeId:'target-e',records:[{key:'foreign',value:{empFbKey:'target-e',estado:'rechazado',horas:99,fecha:'2026-09-20'}}]});
  assert.deepEqual(f.state,before);assert.deepEqual(f.writes,[]);
});
for(const [label,mutate]of [
 ['not admin',f=>{f.state.sv_chat_roles.u.rol='administrativo';f.state.sv_usuarios.p.rol='administrativo';}],
 ['impersonation revoked',f=>f.state.sv_permisos.admin.acciones.usuarios.impersonar=false],['users blocked',f=>f.state.sv_permisos.admin.indiceModulos.usuarios=false],
 ['root hours revoked',f=>f.state.sv_permisos.admin.acciones.empleados.autorizarHoras=false],['CTA blocked',f=>f.state.sv_permisos.admin.indiceModulos.ctaemp=false],
 ['target disabled',f=>f.state.sv_chat_roles.target.activo=false],['target profile disabled',f=>f.state.sv_usuarios['target-p'].activo=false],
 ['target binding stale',f=>f.state.sv_empleado_uid.target.perfilFbKey='p'],['target Dashboard revoked',f=>f.state.sv_permisos.tecnico.acciones.dashboard.miCuenta=false],
 ['external target',f=>f.state.sv_chat_roles.target.rol='distribuidor']
])test('View as rejects '+label,async()=>{const f=fixture('admin');mutate(f);await denied(f,request('/laboral/horas-propias?viewProfile=target-p'));assert.ok(!f.reads.some(row=>row.field));});
test('target reset does not impersonate a target token; the real authorized administrator remains the actor',async()=>{
  const f=fixture('admin');f.state.sv_access_resets={target:{required:true,version:2}};assert.equal((await f.reader.read(request('/laboral/horas-propias?viewProfile=target-p'))).employeeId,'target-e');
});
test('View as revalidates both target and actor authority after the query',async()=>{
  for(const change of [f=>f.state.sv_permisos.admin.acciones.usuarios.impersonar=false,f=>f.state.sv_permisos.admin.indiceRevision++,f=>f.state.sv_usuarios['target-p'].empleadoFbKey='new',f=>f.state.sv_permisos.tecnico.indiceRevision++]){
    const f=fixture('admin');f.queryHook=change;await assert.rejects(()=>f.reader.read(request('/laboral/horas-propias?viewProfile=target-p')),error=>[403,409].includes(error.statusCode));assert.deepEqual(f.writes,[]);
  }
});
for(const bad of [false,42,'invalid',{foreign:{empFbKey:'other',horas:1}},{bad:{empFbKey:'e',horas:{nested:1}}},{bad:{empFbKey:'e',estado:[]}},{bad:{empFbKey:'e',fecha:7}}])test('malformed or foreign query data never turns into a confirmed zero: '+JSON.stringify(bad),async()=>{
  const f=fixture();f.queryValue=bad;await assert.rejects(()=>f.reader.read(request()),error=>error.statusCode===503);assert.deepEqual(f.writes,[]);
});
test('query failure is not hidden by a root fallback or a cached prior response',async()=>{
  const f=fixture();await f.reader.read(request());f.queryHook=()=>{throw Error('source denied');};await assert.rejects(()=>f.reader.read(request()),error=>error.statusCode===503);
  assert.equal(f.reads.filter(row=>row.field).length,2);assert.ok(!f.reads.some(row=>row.path==='sisventas/hsextra_solicitudes'&&!row.field));
});
test('projection preserves the source and never accepts embedded record identities',()=>{
  const source={real:{empFbKey:'e',estado:null,horas:null,fbKey:'wrong',other:'private'}},before=copy(source),result=project(source,'e');
  assert.deepEqual(result,[{key:'real',value:{empFbKey:'e',estado:null,horas:null}}]);result[0].value.estado='changed';assert.deepEqual(source,before);
});
test('valid long RTDB request, profile and employee keys keep their exact identity; Auth UID limit stays separate',async()=>{
  const f=fixture('admin'),profile='p'.repeat(300),employee='empleado_'+ 'x'.repeat(300),recordKey='solicitud_'+ 'x'.repeat(400);
  f.state.sv_empleado_uid.target.perfilFbKey=profile;f.state.sv_usuarios[profile]={...f.state.sv_usuarios['target-p'],empleadoFbKey:employee};
  f.state.sisventas.hsextra_solicitudes[recordKey]={empFbKey:employee,estado:'pendiente',horas:1};
  const result=await f.reader.read(request('/laboral/horas-propias?viewProfile='+profile));assert.equal(result.employeeId,employee);assert.equal(result.records[0].key,recordKey);
  f.actor.uid='u'.repeat(129);await denied(f,request(),401);
});
test('RTDB key boundaries use UTF-8 bytes, preserving valid Unicode and rejecting overflow',()=>{
  const valid='é'.repeat(384),invalid='é'.repeat(385),row={empFbKey:'e',horas:1};
  assert.equal(project({[valid]:row},'e')[0].key,valid);assert.throws(()=>project({[invalid]:row},'e'),error=>error.statusCode===503);
});
