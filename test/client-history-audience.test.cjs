'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Access=require('../js/core/client-history-audience.v1');
const employee={fbKey:'e',codigo:'T1',nombre:'Técnico ficticio'};
const context=(change={})=>({uid:'u',authUid:'u',role:'tecnico',active:true,viewing:false,passwordResetRequired:false,moduleAllowed:m=>['soporte','equipos','ordentrabajo'].includes(m),actionAllowed:()=>false,financialHistoryAccess:{},employee,employeeDirectory:{e:employee},...change});
test('operational originals follow real module alternatives rather than fixed roles',()=>{
 for(const role of ['admin','administrativo','vendedor','tecnico_vendedor','tecnico'])for(const domain of ['reclamos','tickets','equipos'])assert(Access.allows(context({role}),domain,{origin:'original'}),role+'/'+domain);
 for(const domain of ['reclamos','tickets','equipos'])assert.equal(Access.plan(context({moduleAllowed:()=>false}),domain),null);
 assert(Access.allows(context({moduleAllowed:m=>m==='garantias'||m==='clientes'}),'equipos',{origin:'original'}));
});
test('OT uses the effective view-all permission, including an admin override and a technician grant',()=>{
 const mine={origin:'original',record:{tecnicoFbKey:'e'}},other={origin:'original',record:{tecnicoFbKey:'other',tecnico:employee.nombre}};
 assert(Access.allows(context(),'ordenes_trabajo',mine));assert.equal(Access.allows(context(),'ordenes_trabajo',other),false);
 assert.equal(Access.allows(context({role:'admin'}),'ordenes_trabajo',other),false);
 assert(Access.allows(context({actionAllowed:a=>a==='ot.verTodas'}),'ordenes_trabajo',other));
 assert(Access.plan(context({moduleAllowed:m=>m==='agenda'||m==='clientes'}),'ordenes_trabajo'));
 assert(Access.plan(context({moduleAllowed:m=>m==='clientes',actionAllowed:a=>a==='dashboard.otsPendientes'}),'ordenes_trabajo'));
});
test('OT never substitutes Auth UID for employee identity or resolves an ambiguous legacy name',()=>{
 assert.equal(Access.allows(context({employee:null}),'ordenes_trabajo',{origin:'original',record:{tecnicoFbKey:'u'}}),false);
 const source={origin:'original',record:{tecnico:employee.nombre}};
 assert(Access.allows(context(),'ordenes_trabajo',source));
 assert.equal(Access.allows(context({employeeDirectory:{e:employee,other:{fbKey:'other',nombre:employee.nombre}}}),'ordenes_trabajo',source),false);
 assert.equal(Access.allows(context({employee:{...employee,activo:false}}),'ordenes_trabajo',source),false);
});
test('support or equipment never opens embedded records of an inaccessible sale',()=>{
 const source={origin:'embedded',ownerUid:'u'};
 for(const domain of ['equipos','tickets']){
  assert.equal(Access.allows(context(),domain,source),false);
  const c=context({moduleAllowed:m=>['soporte','equipos','detalle'].includes(m),financialHistoryAccess:{ventas:true}});
  assert(Access.allows(c,domain,source));assert.equal(Access.allows(c,domain,{...source,ownerUid:'another'}),false);
  assert(Access.allows({...c,role:'admin'},domain,{...source,ownerUid:'another'}));
 }
});
test('commercial readers retain embedded equipment and tickets even without an operational module',()=>{
 for(const role of ['admin','administrativo','vendedor'])for(const domain of ['equipos','tickets']){
  const c=context({role,moduleAllowed:m=>m==='clientes'||m==='detalle',financialHistoryAccess:{ventas:true}});
  assert.equal(Access.plan(c,domain).originals,'none');assert(Access.allows(c,domain,{origin:'embedded',ownerUid:'u'}));
  assert.equal(Access.allows(c,domain,{origin:'original',ownerUid:'u'}),false);
  assert.equal(Access.allows(c,domain,{origin:'embedded',ownerUid:'another'}),role==='admin');
 }
});
test('commission-only access cannot enable financial history or commercial embedded records',()=>{
 const c=context({moduleAllowed:m=>['comisiones','clientes','equipos'].includes(m)});
 assert.equal(Access.plan(c,'ventas'),null);assert.equal(Access.allows(c,'equipos',{origin:'embedded',ownerUid:'u'}),false);
 assert.equal(Access.plan({...c,financialHistoryAccess:{ventas:'true'}},'ventas'),null);
 const financial=context({moduleAllowed:m=>['detalle','clientes'].includes(m),financialHistoryAccess:{ventas:true}});
 assert(Access.allows(financial,'ventas',{origin:'original',ownerUid:'u'}));assert.equal(Access.allows(financial,'ventas',{origin:'original',ownerUid:'another'}),false);
});
test('revocation, reset, view-as and malformed origins fail closed on every decision',()=>{
 const source={origin:'original',record:{tecnicoFbKey:'e'}};
 for(const change of [{active:false},{authUid:'other'},{viewing:true},{passwordResetRequired:true},{passwordResetRequired:undefined},{uid:'bad/id'},{role:'distribuidora'}])assert.equal(Access.allows(context(change),'ordenes_trabajo',source),false);
 for(const origin of [undefined,null,false,'other'])assert.equal(Access.allows(context(),'equipos',{origin}),false);
 const c=context({moduleAllowed:()=>true});assert(Access.plan(c,'equipos'));c.moduleAllowed=()=>false;assert.equal(Access.plan(c,'equipos'),null);
});
test('browser and CommonJS use the same pure policy with no IO or storage',()=>{
 const window={SVDomainReads:require('../js/core/domain-read-policy'),SVOTPersonalScope:require('../js/core/ot-personal-scope')};
 vm.runInNewContext(fs.readFileSync('js/core/client-history-audience.v1.js','utf8'),{window,fetch(){assert.fail('No network');}});
 assert.equal(JSON.stringify(window.SVClientHistoryAudience.plan(context(),'equipos')),JSON.stringify(Access.plan(context(),'equipos')));
 assert(Object.isFrozen(window.SVClientHistoryAudience));
});
