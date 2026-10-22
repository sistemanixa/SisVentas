'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createBackend,copy}=require('./helpers/labor-ui-flow.cjs');
const value={fecha:'2026-10-22',descripcion:'Gasto ficticio por acción',monto:123.45,tipo:'Variable',categoria:'Servicios',medio:'Efectivo',proveedor:'Ficticio',comprobante:'F-FICTICIO',vencimiento:'',montoPagado:0,estado:'pendiente',empleadoId:null,usuario:'Titular ficticio',ts:1792627200000};
function fixture(initial={}){
 const backend=createBackend(initial),page=backend.page(),c=page.context,calls=[];
 page.load(['svCapturarContextoOperacion','_gastoIdentidad','_crearGastoSinDuplicar','_gastoBaseEdicion','_gastoEmpleadosVinculados','_gastoMovimientosDesdeValores','_guardarGastoCompletoAtomico']);c._gastosAltasEnCurso=new Set();
 let submit=async()=>({key:'gasto-confirmado-ficticio'});c.SVFinancialCommands={createExpense:async(...args)=>{calls.push(copy(args));return submit(...args);}};
 return {...backend,page,c,calls,submit:fn=>{submit=fn;},quick:datos=>c._crearGastoSinDuplicar(copy(datos||value)),complete:(datos,foto)=>c._guardarGastoCompletoAtomico(null,null,copy(datos||value),foto||null)};
}
test('alta rápida administrativa usa expense-only antes de GET raíz o transacción antigua',async()=>{
 const f=fixture(),datos={...value,fotoBase64:'data:image/png;base64,QQ=='};assert.equal((await f.quick(datos)).key,'gasto-confirmado-ficticio');assert.deepEqual(f.calls,[[datos,null,'expense-only']]);assert.equal(f.reads.length,0);assert.equal(f.commands.length,0);assert.equal(f.commits.length,0);assert.equal(f.c._gastosAltasEnCurso.size,0);
});
test('alta completa usa complete y la foto separada sin leer historial, cuenta ni proyecciones en el cliente',async()=>{
 const f=fixture(),datos={...value,empleadoId:'e',fotoAdjunta:true},foto='data:image/png;base64,QQ==';assert.equal((await f.complete(datos,foto)).key,'gasto-confirmado-ficticio');assert.deepEqual(f.calls,[[datos,foto,'complete']]);assert.equal(f.reads.length,0);assert.equal(f.commands.length,0);assert.equal(f.commits.length,0);
});
test('sólo un resultado de capacidad deshabilitada previo al intento conserva explícitamente el circuito antiguo',async()=>{
 for(const complete of [false,true]){const f=fixture();f.submit(async()=>null);const result=await(complete?f.complete():f.quick());assert.match(result.key,/^gasto_[a-f0-9]{64}$/);assert.equal(f.calls.length,1);assert.equal(f.commits.length,1);assert.ok(f.reads.some(([where,path])=>where==='client'&&path==='sisventas/gastos'));assert.equal(f.commands.length,1);}
});
test('la API ausente mantiene compatibilidad con los clientes que todavía no tienen el helper',async()=>{
 for(const complete of [false,true]){const f=fixture();delete f.c.SVFinancialCommands;await(complete?f.complete():f.quick());assert.equal(f.commits.length,1);assert.ok(f.reads.some(([,p])=>p==='sisventas/gastos'));}
});
test('acuse ambiguo, error de cobertura y permiso no vuelven silenciosamente al circuito antiguo',async()=>{
 for(const code of ['SV_ACK_TIMEOUT','SV_GASTO_INDEX_UNREADY','PERMISSION_DENIED'])for(const complete of [false,true]){const f=fixture();f.submit(async()=>{throw Object.assign(Error('Rechazo ficticio '+code),{code});});await assert.rejects(complete?f.complete():f.quick(),{code});assert.equal(f.calls.length,1);assert.equal(f.reads.length,0);assert.equal(f.commands.length,0);assert.equal(f.commits.length,0);assert.equal(f.c._gastosAltasEnCurso.size,0);}
});
test('doble clic rápido comparte busy de identidad mientras consulta capacidad o espera acuse',async()=>{
 const f=fixture();let resolve;f.submit(()=>new Promise(r=>resolve=r));const first=f.quick();await assert.rejects(f.quick(),/ya se está guardando/);assert.equal(f.calls.length,1);assert.equal(f.c._gastosAltasEnCurso.size,1);resolve({key:'gasto-confirmado-ficticio'});await first;assert.equal(f.c._gastosAltasEnCurso.size,0);assert.equal(f.reads.length,0);
});
test('cambiar sesión, Auth o rol mientras se decide capacidad impide iniciar el fallback con otra cuenta',async()=>{
 for(const change of [c=>c.currentUserUid='otra',c=>c.fbAuth.currentUser={uid:'u'},c=>c.currentRole='vendedor'])for(const complete of [false,true]){const f=fixture();f.submit(async()=>{change(f.c);return null;});await assert.rejects(complete?f.complete():f.quick(),/sesión cambió/);assert.equal(f.reads.length,0);assert.equal(f.commands.length,0);assert.equal(f.commits.length,0);}
});
test('edición conserva CAS, pagos y ruta exacta; nunca usa el comando de alta',async()=>{
 const original={...value,pagos:{p:{monto:20}},montoPagado:20,estado:'pagado_parcial'},f=fixture({gastos:{g:original}});f.submit(async()=>{throw Error('No debe intentar un alta');});const result=await f.c._guardarGastoCompletoAtomico(copy(original),'g',{...copy(original),descripcion:'Descripción editada ficticia'},null);assert.equal(result.key,'g');assert.equal(f.calls.length,0);assert.equal(f.commits.length,1);assert.deepEqual(f.get('sisventas/gastos/g/pagos'),original.pagos);assert.ok(!f.reads.some(([,p])=>p==='sisventas/gastos'));
});
test('sin administrar sigue la solicitud laboral propia y no consulta el comando administrativo',async()=>{
 const f=fixture(),requests=[];f.c.tienePermiso=()=>false;f.c.fetch=async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return{ok:true,json:async()=>({ok:true,committed:true,key:'solicitud-propia'})};};assert.equal((await f.quick()).key,'solicitud-propia');assert.equal(f.calls.length,0);assert.equal(requests[0].url,'https://gateway.invalid/laboral/solicitar-gasto');assert.equal(f.reads.length,0);assert.equal((await f.complete()).key,'solicitud-propia');assert.equal(f.calls.length,0);assert.equal(requests.length,2);
});
test('límites canónicos se validan antes de la capacidad y un fallo libera busy para un reintento explícito',async()=>{
 const f=fixture();await assert.rejects(f.quick({...value,proveedor:'x'.repeat(501)}),/500/);await assert.rejects(f.complete({...value,comprobante:5}),/inválidos/);assert.equal(f.calls.length,0);f.submit(async()=>{throw Error('Fallo ficticio');});await assert.rejects(f.quick(),/Fallo ficticio/);assert.equal(f.c._gastosAltasEnCurso.size,0);f.submit(async()=>({key:'reintento-confirmado'}));assert.equal((await f.quick()).key,'reintento-confirmado');assert.equal(f.reads.length,0);
});
