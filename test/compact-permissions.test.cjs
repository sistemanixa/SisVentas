'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const index=require('../js/core/permission-index'),{build}=require('../scripts/prepare-compact-permissions.cjs'),{rulesProtectPasswords}=require('../cotizador/password-policy');
const vm=require('node:vm'),source=require('./helpers/active-app').readActiveApp().source;
test('el índice conserva bloqueos y excepciones sin modificar el original ni decidir acciones',()=>{
 const original={_version:1,tecnico:{bloqueados:['venta','clientes'],permitidos:['nuevo'],acciones:{ot:{editar:false}}}},before=JSON.stringify(original),next=index.build(original,['nuevo']);
 assert.equal(JSON.stringify(original),before);assert.equal(next.tecnico.indiceVersion,2);assert.equal(next.tecnico.indiceModulos.venta,false);assert.equal(next.tecnico.indiceModulos.ordentrabajo,true);assert.equal(next.tecnico.indiceModulos.nuevo,true);assert.equal(next.tecnico.indiceModulos.procesos,false);assert.deepEqual(next.tecnico.acciones,original.tecnico.acciones);
});

test('Roles conserva la revisión al cargar y permite guardados sucesivos sin pisar otra sesión',()=>{
 const start=source.indexOf('function normalizarPermisosRolesGuardados('),end=source.indexOf('\n}',start)+2;
 const context={PERMISOS_DEFAULT:{admin:{bloqueados:[]},tecnico:{bloqueados:['venta']}},MODULOS_AGREGADOS_A_PERMISOS:[]};vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 const saved=index.build({_version:7,admin:{bloqueados:[]},tecnico:{bloqueados:['venta']}});
 const normalized=context.normalizarPermisosRolesGuardados(saved),next=index.build(normalized);
 assert.equal(normalized.tecnico.indiceRevision,1);assert.equal(next.tecnico.indiceRevision,2);
 assert.equal(index.build(context.normalizarPermisosRolesGuardados(next)).tecnico.indiceRevision,3);
 assert.throws(()=>index.build(saved,['__proto__']),/Módulo inválido/);
});
test('las candidatas compactas conservan guard, campos privados y reducen repetición sin aplicar nada',()=>{
 for(const stage of ['employee-account-read','audit-final']){
  const result=build(stage);assert.ok(result.replaced>100);assert.ok(result.bytes<700000);assert.equal(rulesProtectPasswords(result.rules),true);assert.equal(result.rules.rules.sisventas['.read'],false);assert.equal(result.rules.rules.sv_usuarios['.read'],false);
  assert.match(result.rules.rules.sv_permisos.$rol.indiceModulos.$modulo['.validate'],/bloqueados/);
  for(const name of Object.keys(index.additionalDomains))assert.match(name.split('/').reduce((node,key)=>node[key],result.rules.rules.sisventas)['.read'],/indiceModulos/);
  assert.equal(result.rules.rules.sisventas._integraciones_server['.read'],false);
 }
});
