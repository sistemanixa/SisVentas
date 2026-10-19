'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createRootTransaction}=require('../cotizador/labor-transaction');
const {createLaborSubmissions}=require('../cotizador/labor-submissions');
const {createLaborOperations}=require('../cotizador/labor-operations');
const {createPersonalExpenses}=require('../cotizador/personal-expenses');

// Simula sólo el contrato REST/ETag, sin SDK, red ni datos reales.
function transport(initial,{beforePut}={}){
 let stored=structuredClone(initial),version=1;
 const requests=[];
 const transaction=createRootTransaction({databaseURL:'https://labor-fixture.invalid',accessToken:async()=>'fixture',fetchImpl:async(url,options)=>{
  assert.equal(url,'https://labor-fixture.invalid/sisventas.json');
  const method=options.method||'GET';requests.push({method,body:options.body});
  if(method==='GET')return {ok:true,headers:{get:()=>String(version)},json:async()=>structuredClone(stored)};
  assert.equal(method,'PUT');
  const next=JSON.parse(options.body);
  const concurrent=beforePut?.({stored:structuredClone(stored),next,number:requests.filter(r=>r.method==='PUT').length});
  if(concurrent!==undefined){stored=structuredClone(concurrent);version++;}
  if(options.headers['if-match']!==String(version))return {ok:false,status:412,headers:{get:()=>String(version)},json:async()=>structuredClone(stored)};
  stored=next;version++;
  return {ok:true,status:200,body:{cancel:async()=>{}}};
 }});
 return {transaction,requests,read:()=>structuredClone(stored),mutate:fn=>{fn(stored);version++;},count:method=>requests.filter(r=>r.method===method).length};
}
const unrelated={ventas:{original:{importe:123.45}},presupuestos:{historico:{fecha:'2020-02-10'}},configExterna:{noTocar:true}};
const initial=()=>({...structuredClone(unrelated),empleados:{e:{nombre:'Empleado ficticio',cargoId:'c'}},config:{cargos:{c:{valorHoraExtra:100}}},hsextra_solicitudes:{},gastos:{}});
const employee={uid:'u',nombre:'Empleado ficticio',empleadoFbKey:'e',manager:false};
const contribution={empFbKey:'e',mes:'2026-10',aporteId:'ap_fixture',detalleDias:[{fecha:'2026-10-13',horas:2,lugar:'Obra ficticia'}],observaciones:'Comentario ficticio'};
const approval={claves:['a'],monto:200};
function approvalInitial(){const root=initial();root.hsextra_solicitudes.a={estado:'pendiente',empFbKey:'e',empNombre:'Empleado ficticio',mes:'2026-10',fecha:'2026-10-13',horas:2};return root;}
const expense={fecha:'2026-10-13',descripcion:'Gasto ficticio',monto:123.45};
function assertUnrelated(root){for(const [key,value]of Object.entries(unrelated))assert.deepEqual(root[key],value);}

test('UNCHANGED explícito confirma sin PUT; mutar y devolver el mismo objeto todavía escribe',async()=>{
 const io=transport(initial());
 const result=await io.transaction((root,control)=>{assert.equal(root.ventas.original.importe,123.45);return control.UNCHANGED;});
 assert.deepEqual(result,{committed:true,unchanged:true});assert.equal(io.count('GET'),1);assert.equal(io.count('PUT'),0);
 assert.deepEqual(await io.transaction(root=>{root.gastos.nuevo={monto:1};return root;}),{committed:true});
 assert.equal(io.count('PUT'),1);assert.equal(io.read().gastos.nuevo.monto,1);assertUnrelated(io.read());
});

test('Repetir aporte verifica el payload y UID, conserva el registro y omite PUT',async()=>{
 const io=transport(initial()),svc=createLaborSubmissions({auth:{},db:{},transaction:io.transaction,now:()=>1000});
 await svc.submit(employee,contribution);const confirmed=io.read();
 await svc.submit({...employee,nombre:'Nombre actual'},contribution);
 assert.equal(io.count('GET'),2);assert.equal(io.count('PUT'),1);assert.deepEqual(io.read(),confirmed);assertUnrelated(io.read());
 for(const input of [{...contribution,observaciones:'Otro comentario'},{...contribution,detalleDias:[{...contribution.detalleDias[0],horas:3}]}])await assert.rejects(svc.submit(employee,input),{statusCode:409});
 await assert.rejects(svc.submit({...employee,uid:'otro'},contribution),{statusCode:409});
 assert.equal(io.count('PUT'),1);assert.deepEqual(io.read(),confirmed);
});

test('Repetición de aprobación conserva autor, importes e históricos sin PUT adicional',async()=>{
 const io=transport(approvalInitial()),svc=createLaborOperations({auth:{},db:{},transaction:io.transaction,now:()=>1791817200000});
 await svc.approve({uid:'admin-a',nombre:'Primer aprobador'},approval);const confirmed=io.read();
 await svc.approve({uid:'admin-b',nombre:'Otro aprobador autorizado'},approval);
 assert.equal(io.count('GET'),2);assert.equal(io.count('PUT'),1);assert.deepEqual(io.read(),confirmed);
 assert.equal(io.read().hsextra_solicitudes.a.aprobadoPor,'Primer aprobador');assert.equal(io.read().gastos.hextra_a.monto,200);assertUnrelated(io.read());
});

test('Aprobación con gasto faltante o grupo diferente no usa éxito idempotente',async()=>{
 const io=transport(approvalInitial()),svc=createLaborOperations({auth:{},db:{},transaction:io.transaction});
 await svc.approve({nombre:'Admin'},approval);
 io.mutate(root=>{delete root.gastos.hextra_a;});
 await assert.rejects(svc.approve({nombre:'Admin'},approval),{statusCode:409});
 await assert.rejects(svc.approve({nombre:'Admin'},{claves:['a','b'],monto:200}),{statusCode:409});
 assert.equal(io.count('PUT'),1);assertUnrelated(io.read());
});

test('Repetir gasto propio omite PUT; otro actor no puede apropiárselo y otro payload crea su registro',async()=>{
 const io=transport(initial()),svc=createPersonalExpenses({transaction:io.transaction,now:()=>1000});
 const first=await svc.submit(employee,expense),confirmed=io.read();
 assert.deepEqual(await svc.submit(employee,expense),first);
 assert.equal(io.count('GET'),2);assert.equal(io.count('PUT'),1);assert.deepEqual(io.read(),confirmed);
 await assert.rejects(svc.submit({...employee,uid:'otro'},expense),{statusCode:409});assert.equal(io.count('PUT'),1);
 const second=await svc.submit(employee,{...expense,descripcion:'Otro gasto ficticio'});
 assert.notEqual(second.key,first.key);assert.equal(io.count('PUT'),2);assert.deepEqual(io.read().gastos[first.key],confirmed.gastos[first.key]);assertUnrelated(io.read());
});

test('Reenvíos de aporte y gasto vuelven a validar empleado activo antes de omitir escritura',async()=>{
 for(const [factory,body]of [[createLaborSubmissions,contribution],[createPersonalExpenses,expense]]){
  const io=transport(initial()),svc=factory({auth:{},db:{},transaction:io.transaction});
  await svc.submit(employee,body);io.mutate(root=>{root.empleados.e.activo=false;});const deactivated=io.read();
  await assert.rejects(svc.submit(employee,body),e=>[403,409].includes(e.statusCode));
  assert.equal(io.count('PUT'),1);assert.deepEqual(io.read(),deactivated);
 }
});

test('Conflicto de operación nueva conserva cambio ajeno y reintenta el PUT con el ETag recibido',async()=>{
 const io=transport(approvalInitial(),{beforePut:({stored,number})=>number===1?{...stored,externo:{concurrente:true}}:undefined});
 const svc=createLaborOperations({auth:{},db:{},transaction:io.transaction});await svc.approve({nombre:'Admin'},approval);
 assert.equal(io.count('GET'),1);assert.equal(io.count('PUT'),2);assert.deepEqual(io.read().externo,{concurrente:true});
 assert.equal(Object.keys(io.read().gastos).length,1);assertUnrelated(io.read());
});

test('Conflicto ya confirmado por otra solicitud permite UNCHANGED sin segundo PUT ni perder cambios ajenos',async()=>{
 for(const [factory,body,root,who]of [[createLaborSubmissions,contribution,initial(),employee],[createLaborOperations,approval,approvalInitial(),{nombre:'Admin'}],[createPersonalExpenses,expense,initial(),employee]]){
  const io=transport(root,{beforePut:({next,number})=>number===1?{...next,externo:{concurrente:true}}:undefined});
  const svc=factory({auth:{},db:{},transaction:io.transaction,now:()=>1791817200000});
  await (svc.submit?svc.submit(who,body):svc.approve(who,body));
  assert.equal(io.count('GET'),1);assert.equal(io.count('PUT'),1);assert.deepEqual(io.read().externo,{concurrente:true});assertUnrelated(io.read());
 }
});
