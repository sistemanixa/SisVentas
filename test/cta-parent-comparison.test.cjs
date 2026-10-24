'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createBackend,copy}=require('./helpers/labor-ui-flow.cjs');
const {digest}=require('../cotizador/labor-guard');
const {normalizeRtdb}=require('../cotizador/payment-membership-index');
const paid={tipo:'haber',monto:100,estado:'pagado',montoPagado:100,pagos:{p:{monto:100}},historial:{h:{nota:'Conservar ficticio'}}};
const legacy={tipo:'bonificacion',monto:5,estado:'aprobado'};
const quantity={...legacy,bonificacionCantidad:1,bonificacionValorUnitario:5,bonificacionGrupoId:'bonus-group-fixture-001',bonificacionDestinatarios:['e'],bonificacionGrupoTotal:5,bonificacionGrupoPersonas:1};
let sequence=0;
const fixture=(initial={paid})=>createBackend({ctaemp:initial===null?{}:{e:copy(initial)}});
const request=(f,value)=>({id:'cta-parent-regression-'+String(++sequence).padStart(4,'0'),kind:'compare',path:'sisventas/ctaemp/e',value:copy(value),expectedHash:digest(f.get('sisventas/ctaemp/e'))});
async function actor(f){return f.gateway.authorize({method:'POST',url:'/laboral/escritura',headers:{authorization:'Bearer fixture-token'}});}
async function write(f,body){return f.gateway.write(await actor(f),body);}
function intact(f,before){for(const field of ['empleados','gastos','haberes','ventas','config','sentinel'])assert.deepEqual(f.state.sisventas[field],before[field],field);assert.equal(f.direct.length,0);}
for(const [name,initial,value]of [
 ['añadir hijo sin perder sueldo, pagos ni historial',{paid},{paid,new:legacy}],
 ['crear primer hijo en cuenta inexistente',null,{new:legacy}],
 ['eliminar un hijo legacy conservando los restantes',{paid,old:legacy},{paid}],
 ['conservar una cuenta sin cambios',{paid},{paid}],
 ['añadir hijo preservando unidades de otra bonificación',{paid,quantity},{paid,quantity,new:legacy}]
])test('CTA padre permite '+name+' bajo el CAS vigente',async()=>{const f=fixture(initial),before=copy(f.state.sisventas);await write(f,request(f,value));assert.equal(f.commits.length,1);assert.deepEqual(f.get('sisventas/ctaemp/e'),value);intact(f,before);});
for(const [name,initial,value,code]of [
 ['introducir unidades sin propósito',{paid},{paid,new:quantity},'SV_BONUS_PURPOSE_REQUIRED'],
 ['omitir unidades existentes',{paid,quantity},{paid,quantity:legacy},'SV_BONUS_PURPOSE_REQUIRED'],
 ['recalcular unidades existentes',{paid,quantity},{paid,quantity:{...quantity,bonificacionCantidad:2,monto:10,bonificacionGrupoTotal:10}},'SV_BONUS_PURPOSE_REQUIRED'],
 ['crear marca SAC sin revisión',{paid},{paid,sac:{tipo:'aguinaldo',monto:50}},'SV_SAC_MIGRATION_REVIEW_REQUIRED']
])test('CTA padre continúa rechazando '+name,async()=>{const f=fixture(initial),before=copy(f.state.sisventas);await assert.rejects(write(f,request(f,value)),{code});assert.equal(f.commits.length,0);assert.deepEqual(f.state.sisventas,before);intact(f,before);});
test('un CAS de padre vencido no agrega el hijo ni altera el registro concurrente',async()=>{const f=fixture(),body=request(f,{paid,new:legacy});f.state.sisventas.ctaemp.e.other={tipo:'bonificacion',monto:9};const before=copy(f.state.sisventas);await assert.rejects(write(f,body),{code:'SV_CAS_CONFLICT'});assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);intact(f,before);});
test('denegar la lectura autorizada del padre impide su reemplazo y no ejecuta PATCH',async()=>{const f=fixture(),before=copy(f.state.sisventas),read=f.store.readAsUser;f.store.readAsUser=async(path,a)=>{if(path==='sisventas/ctaemp/e')throw Object.assign(Error('Denegación ficticia'),{statusCode:403,code:'FIXTURE_DENIED'});return read(path,a);};await assert.rejects(write(f,request(f,{paid,new:legacy})),{code:'FIXTURE_DENIED'});assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);});
test('un actor revocado no puede agregar el hijo de CTA',async()=>{const f=fixture(),body=request(f,{paid,new:legacy}),before=copy(f.state.sisventas);f.state.sv_chat_roles.u.activo=false;await assert.rejects(write(f,body),{statusCode:403});assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);});
test('undefined real del payload sigue siendo inválido y no se confunde con hijo ausente',async()=>{const f=fixture(),body=request(f,{paid,new:legacy}),before=copy(f.state.sisventas);body.value.new.monto=undefined;await assert.rejects(write(f,body),{statusCode:400});assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);assert.throws(()=>normalizeRtdb(undefined),{code:'SV_PAYMENT_INDEX_INPUT'});});
test('replay de transporte idéntico recupera el recibo sin duplicar el hijo',async()=>{const f=fixture(),body=request(f,{paid,new:legacy});await write(f,body);const before=copy(f.state.sisventas),count=f.commits.length;const result=await write(f,copy(body));assert.equal(result.committed,true);assert.equal(f.commits.length,count);assert.deepEqual(f.state.sisventas,before);assert.equal(Object.keys(f.get('sisventas/ctaemp/e')).length,2);});
test('dos reemplazos concurrentes del mismo padre no pierden el hijo confirmado',async()=>{const f=fixture(),a=await actor(f),first=request(f,{paid,first:legacy}),second=request(f,{paid,second:{...legacy,monto:9}});const results=await Promise.allSettled([f.gateway.write(a,first),f.gateway.write(a,second)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const rejected=results.find(r=>r.status==='rejected');assert.equal(rejected.reason.code,'SV_CAS_CONFLICT');assert.equal(f.commits.length,1);const value=f.get('sisventas/ctaemp/e');assert.deepEqual(value.paid,paid);assert.equal(Object.keys(value).length,2);assert.notEqual(!!value.first,!!value.second);});
test('el alcance raíz de todas las cuentas continúa prohibido',async()=>{const f=fixture(),before=copy(f.state.sisventas),body=request(f,{e:{paid,new:legacy}});body.path='sisventas/ctaemp';body.expectedHash=digest(f.get(body.path));await assert.rejects(write(f,body),{code:'SV_LABOR_CTA_SCOPE_REQUIRED'});assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);});
