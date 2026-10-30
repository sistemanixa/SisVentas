const {test}=require('node:test'),assert=require('node:assert/strict'),{project,createSupplierDirectory}=require('../cotizador/supplier-directory');
const {createEmployeeDirectory}=require('../cotizador/employee-directory');
const permissionIndex=require('../js/core/permission-index');
test('Directorio comercial conserva proveedor y condición sin revelar credenciales ni secretos nuevos',()=>{const p=project({p:{nombre:'Proveedor',web:'https://example.test',usuario:'privado',password:'secreto',apikey:'secreto2',token:'secreto3',nuevoSecreto:'secreto4',condicionComercial:{activa:true,descuentoPorcentaje:10,password:'secreto5'}}}).p;assert.equal(p.nombre,'Proveedor');assert.equal(p.condicionComercial.descuentoPorcentaje,10);assert.equal(JSON.stringify(p).includes('secreto'),false);assert.equal(p.usuario,undefined);});

const modes=['productos','proveedores','actualizadorprecios','ordenes','balancecompra'];
const v2=(enabled=[])=>({indiceVersion:2,indiceRevision:7,bloqueados:[],indiceModulos:Object.fromEntries(modes.map(module=>[module,enabled.includes(module)]))});
function fixture(permissions,{role='vendedor'}={}){
 const calls=[],records={'sv_chat_roles/u':{rol:role,activo:true},['sv_permisos/'+role]:permissions,
  'sisventas/proveedores':{supplier:{nombre:'Proveedor ficticio',web:'https://example.invalid',activo:true,password:'SECRETO-FICTICIO',token:'TOKEN-FICTICIO',condicionComercial:{activa:true,descuentoPorcentaje:12,apikey:'CLAVE-FICTICIA'}}}};
 let verified=0;const db={ref:path=>({get:async()=>{calls.push(path);return {val:()=>records[path]??null};}})};
 const authorize=createEmployeeDirectory({auth:{verifyIdToken:async(token,revoked)=>{assert.equal(token,'FICTICIO');assert.equal(revoked,true);verified++;return {uid:'u'};}},db}).authorize;
 const service=createSupplierDirectory({authorize,db});
 return {service,calls,records,verified:()=>verified,identity:()=>service.authorize({headers:{authorization:'Bearer FICTICIO'}}),async read(){return service.read(await this.identity());}};
}

test('v2 con los cinco módulos deshabilitados rechaza aun sin bloqueados y no lee proveedores',async()=>{
 for(const role of ['vendedor','admin']){
  const f=fixture(v2(),{role});await assert.rejects(f.read(),{statusCode:403});
  assert.deepEqual(f.calls,['sv_chat_roles/u','sv_access_resets/u','sv_permisos/'+role,'sv_chat_roles/u','sv_permisos/'+role]);assert.equal(f.verified(),1);
 }
});

test('v2 exige true booleano de un módulo pertinente y no abre por índice ausente o incompleto',async()=>{
 for(const indiceModulos of [undefined,{},Object.fromEntries(modes.map(module=>[module,false])),{productos:'true'},{productos:1},{clientes:true}]){
  const f=fixture({indiceVersion:2,indiceModulos,bloqueados:[]});await assert.rejects(f.read(),{statusCode:403});assert.equal(f.calls.includes('sisventas/proveedores'),false);
 }
});

test('cada módulo habilitado v2 permite sólo la proyección comercial y conserva lecturas frescas de autorización',async()=>{
 for(const module of modes){
  const cfg=v2([module]),f=fixture(cfg),before=JSON.stringify(f.records),result=await f.read();
  assert.equal(result.supplier.nombre,'Proveedor ficticio');assert.deepEqual(result.supplier.condicionComercial,{activa:true,descuentoPorcentaje:12});
  assert.equal(JSON.stringify(result).includes('FICTICI'),false);assert.equal(result.supplier.password,undefined);assert.equal(result.supplier.token,undefined);
  assert.equal(f.verified(),1);assert.deepEqual(f.calls,['sv_chat_roles/u','sv_access_resets/u','sv_permisos/vendedor','sv_chat_roles/u','sv_permisos/vendedor','sisventas/proveedores']);assert.equal(JSON.stringify(f.records),before);
 }
});

test('bloqueados conserva su veto frente a un índice v2 contradictorio, incluso como objeto RTDB',async()=>{
 for(const bloqueados of [['productos'],{zero:'productos'}]){
  const f=fixture({...v2(['productos']),bloqueados});await assert.rejects(f.read(),{statusCode:403});assert.equal(f.calls.includes('sisventas/proveedores'),false);
 }
});

test('índice generado por las casillas de Roles conserva el módulo habilitado y cierra los demás',async()=>{
 const saved=permissionIndex.build({vendedor:{bloqueados:modes.filter(module=>module!=='ordenes')}}).vendedor;
 assert.equal(saved.indiceVersion,2);assert.deepEqual(modes.filter(module=>saved.indiceModulos[module]),['ordenes']);
 const f=fixture(saved);assert.equal((await f.read()).supplier.nombre,'Proveedor ficticio');
});

test('sin índice v2 mantiene configuración legacy y sin configuración mantiene defaults por rol',async()=>{
 assert.equal((await fixture({bloqueados:[]},{role:'tecnico'}).read()).supplier.nombre,'Proveedor ficticio');
 await assert.rejects(fixture({bloqueados:modes}).read(),{statusCode:403});
 for(const role of ['admin','administrativo','vendedor','tecnico_vendedor'])assert.equal((await fixture(null,{role}).read()).supplier.nombre,'Proveedor ficticio');
 await assert.rejects(fixture(null,{role:'tecnico'}).read(),{statusCode:403});
});

test('un cambio de permisos posterior a authorize se vuelve a comprobar sin cachear la autorización anterior',async()=>{
 const f=fixture(v2(['productos'])),identity=await f.identity();f.records['sv_permisos/vendedor']=v2();
 await assert.rejects(f.service.read(identity),{statusCode:403});assert.equal(f.calls.includes('sisventas/proveedores'),false);assert.equal(f.verified(),1);
 assert.equal(f.calls.filter(path=>path==='sv_chat_roles/u').length,2);assert.equal(f.calls.filter(path=>path==='sv_permisos/vendedor').length,2);
});

test('acceso que requiere recuperación de sesión no consulta proveedores',async()=>{const f=fixture(v2(['productos']));f.records['sv_access_resets/u']={required:true};await assert.rejects(f.read(),e=>e.statusCode===403);assert.equal(f.calls.includes('sisventas/proveedores'),false);});

test('identidad desactivada, externa o ausente entre authorize y read rechaza antes de leer proveedores',async()=>{
 for(const identity of [{rol:'vendedor',activo:false},{rol:'distribuidora',activo:true},{rol:'compras_paraguay',activo:true},null]){
  const f=fixture(v2(['productos'])),authorized=await f.identity();
  if(identity){f.records['sv_chat_roles/u']=identity;f.records['sv_permisos/'+identity.rol]=v2(['productos']);}else delete f.records['sv_chat_roles/u'];
  const before=JSON.stringify(f.records);await assert.rejects(f.service.read(authorized),{statusCode:403});
  assert.equal(f.calls.includes('sisventas/proveedores'),false);assert.deepEqual(f.calls,['sv_chat_roles/u','sv_access_resets/u','sv_permisos/vendedor','sv_chat_roles/u']);
  assert.equal(f.verified(),1);assert.equal(JSON.stringify(f.records),before);
 }
});
