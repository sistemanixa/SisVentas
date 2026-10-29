'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/core/commission-generation.js','utf8');
const busy='La comisión se está generando en otra sesión. Reintentá';
const sale={fbKey:'venta-ficticia',comisionHabilitada:true};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({status=200,result={ok:true,status:'generada',participantes:[{empleadoFbKey:'e',monto:10}]},fetchError}={}){
 const calls=[],deadlines=[];let tokens=0,transport=null;
 const root={currentUserUid:'fixture-user',fbAuth:{currentUser:{uid:'fixture-user',getIdToken:async()=>{tokens++;return 'TOKEN-FICTICIO';}}},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},
  AbortSignal:{timeout:ms=>{deadlines.push(ms);return undefined;}},setInterval:assert.fail,setTimeout:assert.fail,
  fetch:async(url,options)=>{assert.equal(new URL(url).origin,'https://fixture.invalid');calls.push({url,options});if(transport)await transport;if(fetchError)throw fetchError;return {ok:status>=200&&status<300,status,json:async()=>result};}};
 root.window=root;vm.runInNewContext(source,root);
 return {root,calls,deadlines,result,tokens:()=>tokens,hold(){let release;transport=new Promise(resolve=>release=resolve);return release;}};
}

test('generación posterior al cobro envía sólo referencia y acuse, sin importes o costos',async()=>{
 const f=fixture();await f.root.SVCommissionGeneration.generate({...sale,cobroOperacionId:'fictitious-collection-01',costos:123,comisionPct:20});
 assert.deepEqual(JSON.parse(f.calls[0].options.body),{ventaFbKey:sale.fbKey,cobroOperacionId:'fictitious-collection-01'});
 await f.root.SVCommissionGeneration.request('revisar',{...sale,cobroOperacionId:'fictitious-collection-01'});
 assert.deepEqual(JSON.parse(f.calls[1].options.body),{ventaFbKey:sale.fbKey});
});
test('sin comisión habilitada devuelve no_aplica explícito sin pedir token ni llamar al servidor',async()=>{
 const f=fixture();for(const record of [null,{fbKey:sale.fbKey},{...sale,comisionHabilitada:false}]){const result=await f.root.SVCommissionGeneration.generate(record);assert.equal(result.status,'no_aplica');assert.deepEqual(Array.from(result.participantes),[]);}
 assert.equal(f.tokens(),0);assert.equal(f.calls.length,0);assert.deepEqual(f.deadlines,[]);
});
test('generar conserva los estados del servidor, motivos, faltantes y la reutilización sin aprobar ni reescribir',async()=>{
 for(const status of ['generada','existente','no_aplica','pendiente_cobro','revision']){
  const result={ok:true,status,motivo:'Motivo ficticio',participantes:[{empleadoFbKey:'e',monto:10}],faltantes:[{codigo:'FICTICIO'}],reutilizada:true};
  const f=fixture({result}),returned=await f.root.SVCommissionGeneration.generate(sale);assert.equal(returned,result,status);assert.equal(returned.status,status);assert.equal(returned.reutilizada,true);assert.equal(returned.faltantes[0].codigo,'FICTICIO');assert.equal(f.calls.length,1);
 }
});
test('espera una sola respuesta generar, envía sólo la clave y no consulta revisar ni inicia sondeos',async()=>{
 const f=fixture(),release=f.hold();let confirmed=false;const pending=f.root.SVCommissionGeneration.generate({...sale,total:999,pct:99,empleadoFbKey:'no-enviar'}).then(result=>{confirmed=true;return result;});
 await settle();assert.equal(confirmed,false);assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,'https://fixture.invalid/comisiones/generacion/generar');assert.equal(f.calls[0].options.method,'POST');assert.equal(f.calls[0].options.cache,'no-store');assert.deepEqual(JSON.parse(f.calls[0].options.body),{ventaFbKey:sale.fbKey});
 release();const result=await pending;assert.equal(result.status,'generada');assert.equal(confirmed,true);assert.equal(f.calls.length,1);assert.deepEqual(f.deadlines,[60000]);
});
test('sólo el409 exacto de lease expone procesando; los conflictos de cálculo requieren revisión',async()=>{
 for(const [httpStatus,message,expected]of [[409,busy,'procesando'],[409,'La venta cambió. Revisá el cálculo otra vez','revision'],[409,busy+' Otro motivo','revision'],[403,busy,'pendiente_confirmacion']]){
  const f=fixture({status:httpStatus,result:{ok:false,mensaje:message}});await assert.rejects(f.root.SVCommissionGeneration.generate(sale),error=>{assert.equal(error.message,message);assert.equal(error.statusCode,httpStatus);assert.equal(error.httpStatus,httpStatus);assert.equal(error.commissionStatus,expected);return true;});assert.equal(f.calls.length,1);assert.equal(f.tokens(),1);
 }
});
test('rechazo de permisos y fallo de servicio siguen siendo errores con estado y nunca repiten la solicitud',async()=>{
 for(const status of [401,403,503]){const f=fixture({status,result:{ok:false,mensaje:'No confirmado'}});await assert.rejects(f.root.SVCommissionGeneration.generate(sale),error=>error.statusCode===status&&error.httpStatus===status&&error.commissionStatus==='pendiente_confirmacion');assert.equal(f.calls.length,1);}
});
test('fallo de transporte permanece incierto y no se convierte en una comisión generada ni se reintenta',async()=>{
 const network=TypeError('Interrupción ficticia'),f=fixture({fetchError:network});await assert.rejects(f.root.SVCommissionGeneration.generate(sale),error=>error===network);assert.equal(f.calls.length,1);assert.equal(f.tokens(),1);
});
test('la respuesta de otra sesión se descarta y un UID de vista ajeno no inicia la operación',async()=>{
 const f=fixture(),release=f.hold(),pending=f.root.SVCommissionGeneration.generate(sale);await settle();f.root.fbAuth.currentUser={uid:'fixture-user'};release();await assert.rejects(pending,/La sesión cambió/);assert.equal(f.calls.length,1);
 const other=fixture();other.root.currentUserUid='otro';await assert.rejects(other.root.SVCommissionGeneration.generate(sale),/Volvé a tu cuenta/);assert.equal(other.calls.length,0);assert.equal(other.tokens(),0);
});
