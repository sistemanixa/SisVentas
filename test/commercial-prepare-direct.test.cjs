'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('js/core/commercial-ownership.js','utf8');
function fixture(domain='ventas'){
 const record={id:'DEMO',responsableUid:'owner',creadorOriginalUid:'creator',empleado:'Comisionado ficticio',total:121,pagado:20,items:[{cod:'DEMO',qty:1,costoUnitarioCompra:55,punit:100}]};
 const calls={point:[],api:[],writes:0};let beforeRead=()=>{},failure;
 const c={currentUserUid:'owner',currentRole:'administrativo',PERMISOS_ROLES:{administrativo:{indiceRevision:1}},fbAuth:{currentUser:{uid:'owner',getIdToken:async()=>'fictional'}},fbDB:{},fbRef:(_,path)=>path,fbGet:async path=>{calls.point.push(path);beforeRead();if(failure)throw failure;return{val:()=>structuredClone(record)};},ventasList:[],pptoData:[],navigator:{onLine:true},document:{addEventListener(){},hidden:false},addEventListener(){},AbortSignal,console,fetch:async(url,options)=>{calls.api.push({url,options});return{ok:true,status:200,json:async()=>({ok:true,record:structuredClone(record)})};},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fictional.invalid'}};
 c[domain==='ventas'?'ventasList':'pptoData']=[{...structuredClone(record),fbKey:'demo'}];c.window=c;vm.runInNewContext(source,c);
 return{c,calls,record,api:c.SVCommercialOwnership,beforeRead:fn=>{beforeRead=fn;},deny:()=>{failure=Error('Permission denied');}};
}
for(const domain of ['ventas','presupuestos'])test(domain+': preparar vinculado lee una ficha sin Cotizador ni escrituras',async()=>{
 const f=fixture(domain),before=structuredClone(f.record),r=await f.api.prepare(domain,'demo');
 assert.deepEqual(JSON.parse(JSON.stringify(r.record)),before);assert.deepEqual(f.calls.point,['sisventas/'+domain+'/demo']);assert.equal(f.calls.api.length,0);assert.equal(f.calls.writes,0);
});
test('baseline conserva valores originales y sólo actualiza metadatos de identidad',async()=>{
 const f=fixture(),baseline={...structuredClone(f.record),total:100,pagado:0,fbKey:'demo',_svOwnerUid:'owner'};f.record.responsableRevision=2;
 const r=await f.api.prepare('ventas','demo',baseline);assert.equal(r.baseline.total,100);assert.equal(r.baseline.pagado,0);assert.equal(r.baseline.responsableRevision,2);assert.equal(r.baseline.fbKey,undefined);assert.equal(r.baseline._svOwnerUid,undefined);assert.equal(baseline.fbKey,'demo');
});
test('admin puede preparar una ficha de otro responsable sin cambiarlo',async()=>{const f=fixture();f.c.currentRole='admin';const r=await f.api.prepare('ventas','demo');assert.equal(r.record.responsableUid,'owner');assert.equal(f.calls.api.length,0);});
for(const domain of ['ventas','presupuestos'])test(domain+': histórico sin identidad conserva el circuito protegido',async()=>{const f=fixture(domain);delete f.c[domain==='ventas'?'ventasList':'pptoData'][0].responsableUid;await f.api.prepare(domain,'demo');assert.equal(f.calls.point.length,0);assert.equal(f.calls.api.length,1);assert.match(f.calls.api[0].url,/\/preparar$/);});
test('pérdida de vínculo entre lista y ficha recurre al circuito histórico',async()=>{const f=fixture();delete f.record.responsableUid;await f.api.prepare('ventas','demo');assert.equal(f.calls.point.length,1);assert.equal(f.calls.api.length,1);});
test('no confía en responsable local ni entrega una ficha reasignada',async()=>{const f=fixture();f.record.responsableUid='other';await assert.rejects(f.api.prepare('ventas','demo'),/no está asignado/);assert.equal(f.calls.api.length,0);});
test('denegación de reglas no se reintenta con privilegios del servidor',async()=>{const f=fixture();f.deny();await assert.rejects(f.api.prepare('ventas','demo'),/Permission denied/);assert.equal(f.calls.point.length,1);assert.equal(f.calls.api.length,0);});
for(const [name,change] of [['sesión',f=>{f.c.fbAuth.currentUser=null;}],['UID',f=>{f.c.currentUserUid='other';}],['rol',f=>{f.c.currentRole='tecnico';}],['permisos',f=>{f.c.PERMISOS_ROLES.administrativo.indiceRevision++;}]])test('respuesta pendiente se descarta al cambiar '+name,async()=>{const f=fixture();f.beforeRead(()=>change(f));await assert.rejects(f.api.prepare('ventas','demo'),/sesión cambió/);assert.equal(f.calls.api.length,0);});
test('Ver como y desconexión no preparan operaciones con caché local',async()=>{for(const kind of ['view','offline']){const f=fixture();if(kind==='view')f.c.currentUserUid='other';else f.c.navigator.onLine=false;await assert.rejects(f.api.prepare('ventas','demo'),kind==='view'?/tu cuenta/:/Sin conexión/);assert.equal(f.calls.point.length+f.calls.api.length,0);}});
test('clave inválida no inicia lecturas ni permite consultar otra ruta',async()=>{const f=fixture();for(const id of ['','a/b','a.b','a#b'])await assert.rejects(f.api.prepare('ventas',id),/Registro inválido/);await assert.rejects(f.api.prepare('pagos','demo'),/Registro inválido/);assert.equal(f.calls.point.length+f.calls.api.length,0);});
