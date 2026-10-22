'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createCommercialOwnership}=require('../cotizador/commercial-ownership');
const {fixture}=require('./helpers/commercial-ownership-fixtures.cjs');
const copy=value=>structuredClone(value),turn=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
function setup(options={}){
 const initial=fixture(),db=initial.db,reads=[],transactions=[],off=[],getRef=db.ref.bind(db);let downloaded=0,hook;
 db.ref=path=>{
  const ref=getRef(path);
  return {...ref,
   get:async()=>{reads.push(path);await options.beforeGet?.(path,db);const result=await ref.get();downloaded+=Buffer.byteLength(JSON.stringify(result.val()));return result;},
   on:(event,callback,error)=>{reads.push(path+' [on]');return ref.on(event,snap=>{downloaded+=Buffer.byteLength(JSON.stringify(snap.val()));callback(snap);},error);},
   off:(...args)=>{off.push(path);return ref.off(...args);},
   transaction:async(...args)=>{transactions.push(path);if(hook)hook(path,transactions.length,db);return ref.transaction(...args);}
  };
 };
 const api=createCommercialOwnership({db,auth:{verifyIdToken:async uid=>({uid})},enabled:true,now:()=>1000,collectionReader:options.collectionReader});
 const auth=(uid='admin',domain='ventas',view)=>api.authorize({headers:{authorization:'Bearer '+uid}},domain,view);
 return {db,reads,transactions,off,api,auth,beforeTransaction(fn){hook=fn;},get bytes(){return downloaded;}};
}

test('listar Ventas conserva registros completos, propietario, autor original y auditoría leyendo sólo los orígenes únicos',async()=>{
 const f=setup(),sale=f.db.root.sisventas.ventas.converted,budget=f.db.root.sisventas.presupuestos.budget;
 budget.audit.push({fecha:'2026-10-01T10:00:00Z',usuario:'Persona b',accion:'Cliente considerado visto y aceptado al convertir a venta'});
 f.db.root.sisventas.ventas.canonical={...copy(sale),id:'V-CANONICA',responsableUid:'b',items:[{cod:'P-FICTICIO',qty:2,punit:10}],factura:{comprobante:{data:'data:application/pdf;base64,REVNTw=='}},pagos:{old:{monto:20}}};
 const before=copy(f.db.root),result=await f.api.list(await f.auth());
 assert.equal(f.reads.filter(path=>path==='sisventas/presupuestos/budget').length,1);assert.ok(!f.reads.includes('sisventas/presupuestos'));
 assert.equal(result.records.converted._svOwnerUid,'a');assert.equal(result.records.canonical._svOwnerUid,'b');
 for(const key of ['converted','canonical']){
  assert.equal(result.records[key]._svOriginalAuthor.name,'Persona a');assert.equal(result.records[key]._svConversionAudit.usuario,'Persona b');assert.match(result.records[key]._svConversionAudit.accion,/PP|presupuesto/);
  for(const [field,value]of Object.entries(before.sisventas.ventas[key]))assert.deepEqual(result.records[key][field],value);
 }
 assert.deepEqual(f.db.root,before);assert.equal(f.transactions.length,0);
});

test('pertenencia y Ver como conservan el alcance exacto aunque el presupuesto de origen sea de otra persona',async()=>{
 for(const [uid,view,keys]of [['a',undefined,['one','converted']],['b',undefined,['other']],['admin','a',['one','converted']]]){
  const f=setup(),result=await f.api.list(await f.auth(uid,'ventas',view));assert.deepEqual(Object.keys(result.records),keys);assert.ok(!f.reads.includes('sisventas/presupuestos'));
 }
});

test('ventas sin vínculo no leen ningún presupuesto y un origen ausente conserva el fallback del registro',async()=>{
 const f=setup();delete f.db.root.sisventas.ventas.converted.presupuestoFbKey;
 await f.api.list(await f.auth());assert.equal(f.reads.filter(path=>path.startsWith('sisventas/presupuestos')).length,0);
 const missing=setup();missing.db.root.sisventas.ventas.converted.presupuestoFbKey='missing';const rows=(await missing.api.list(await missing.auth())).records;
 assert.equal(rows.converted._svOriginalAuthor.name,'Persona b');assert.equal(rows.converted._svConversionAudit,undefined);assert.equal(missing.reads.filter(path=>path==='sisventas/presupuestos/missing').length,1);
});

test('referencias de origen con espacios, Unicode y valores primitivos mantienen la clave literal',async()=>{
 const f=setup(),source=copy(f.db.root.sisventas.presupuestos.budget);f.db.root.sisventas.ventas={};f.db.root.sisventas.presupuestos={};
 const keys=[' presupuesto con espacios ','liquidación-ñ',17,true,'ñ'.repeat(300)];
 keys.forEach((id,index)=>{f.db.root.sisventas.presupuestos[String(id)]=copy(source);f.db.root.sisventas.ventas['sale-'+index]={id:'V-'+index,presupuestoFbKey:id,total:100,usuario:'Persona b'};});
 const rows=(await f.api.list(await f.auth('a'))).records;
 assert.equal(Object.keys(rows).length,keys.length);for(const id of keys)assert.ok(f.reads.includes('sisventas/presupuestos/'+String(id)));
});

test('referencias inválidas no se vuelven rutas de lectura ni permiten propiedades especiales',async()=>{
 const f=setup(),bad=['bad/path','bad.key','bad#key','bad$key','bad[key','bad]key','bad\u0000key','bad\u007fkey','__proto__','prototype','constructor','hasOwnProperty','ñ'.repeat(385),{},{toString:'invalid'},[],null,false,0,''];
 f.db.root.sisventas.ventas=Object.fromEntries(bad.map((ref,i)=>['s'+i,{usuario:'Persona a',presupuestoFbKey:ref,total:100}]));
 const rows=(await f.api.list(await f.auth('a'))).records;assert.equal(Object.keys(rows).length,bad.length);assert.equal(f.reads.filter(path=>path.startsWith('sisventas/presupuestos')).length,0);
});

test('muchos orígenes usan como máximo seis lecturas simultáneas y deduplican referencias repetidas',async()=>{
 let active=0,peak=0;const f=setup({beforeGet:async path=>{if(!path.startsWith('sisventas/presupuestos/'))return;active++;peak=Math.max(peak,active);await turn();active--;}});
 const source=copy(f.db.root.sisventas.presupuestos.budget);f.db.root.sisventas.ventas={};f.db.root.sisventas.presupuestos={};
 for(let i=0;i<23;i++){f.db.root.sisventas.presupuestos['b'+i]=copy(source);for(let j=0;j<3;j++)f.db.root.sisventas.ventas['s'+i+'-'+j]={presupuestoFbKey:'b'+i,total:100};}
 const rows=(await f.api.list(await f.auth())).records;assert.equal(Object.keys(rows).length,69);assert.equal(f.reads.filter(path=>path.startsWith('sisventas/presupuestos/')).length,23);assert.equal(peak,6);assert.equal(active,0);
});

test('un fallo de origen espera todo el trabajo enviado y no entrega una lista parcial',async()=>{
 const holds=new Map(),failure=Error('Fallo ficticio del origen');let settled=false;
 const f=setup({beforeGet:path=>{if(!path.startsWith('sisventas/presupuestos/'))return;if(path.endsWith('/b0'))throw failure;const hold=deferred();holds.set(path,hold);return hold.promise;}});
 const source=copy(f.db.root.sisventas.presupuestos.budget);f.db.root.sisventas.ventas={};f.db.root.sisventas.presupuestos={};
 for(let i=0;i<12;i++){f.db.root.sisventas.presupuestos['b'+i]=copy(source);f.db.root.sisventas.ventas['s'+i]={presupuestoFbKey:'b'+i,total:100};}
 const task=f.api.list(await f.auth());task.finally(()=>{settled=true;}).catch(()=>{});await turn();
 assert.equal(settled,false);assert.equal(f.reads.filter(path=>path.startsWith('sisventas/presupuestos/')).length,6);assert.equal(holds.size,5);
 for(const hold of holds.values())hold.resolve();await assert.rejects(task,error=>error===failure);assert.equal(settled,true);assert.equal(f.reads.filter(path=>path.startsWith('sisventas/presupuestos/')).length,6);
});

test('preparar una Venta carga su origen puntual y conserva una sola transacción normal',async()=>{
 const f=setup(),before=copy(f.db.root.sisventas.ventas.converted);const result=await f.api.prepare(await f.auth('a'),{id:'converted'});
 assert.equal(result.record.responsableUid,'a');assert.equal(result.record.creadorOriginalNombre,'Persona a');assert.equal(result.record.total,before.total);assert.equal(result.record.usuario,before.usuario);
 assert.deepEqual(f.reads.filter(path=>path.startsWith('sisventas/')),['sisventas/ventas/converted [on]','sisventas/presupuestos/budget']);assert.equal(f.transactions.length,1);assert.deepEqual(f.off,['sisventas/ventas/converted']);
});

test('un fallo al leer el origen de la preparación no escribe y libera el listener exacto',async()=>{
 const failure=Error('Origen ficticio no disponible'),f=setup({beforeGet:path=>{if(path==='sisventas/presupuestos/budget')throw failure;}}),before=copy(f.db.root);
 await assert.rejects(f.api.prepare(await f.auth('a'),{id:'converted'}),error=>error===failure);assert.deepEqual(f.db.root,before);assert.equal(f.transactions.length,0);assert.deepEqual(f.off,['sisventas/ventas/converted']);
});

test('cambiar el origen concurrentemente obliga a cargarlo y revalidar su propietario antes de vincular',async()=>{
 const f=setup();f.db.root.sisventas.presupuestos.other={creadoPor:'Persona b',total:200};
 f.beforeTransaction((_path,count)=>{if(count===1)f.db.root.sisventas.ventas.converted.presupuestoFbKey='other';});
 await assert.rejects(f.api.prepare(await f.auth('a'),{id:'converted'}),{statusCode:403});
 const actual=f.db.root.sisventas.ventas.converted;assert.equal(actual.presupuestoFbKey,'other');assert.equal(actual.responsableUid,undefined);assert.equal(actual.total,200);assert.equal(f.transactions.length,2);assert.ok(f.reads.includes('sisventas/presupuestos/other'));
});

test('cambios repetidos del origen terminan en conflicto acotado sin escribir una identidad parcial',async()=>{
 const f=setup();for(let i=1;i<=3;i++)f.db.root.sisventas.presupuestos['next'+i]={creadoPor:'Persona a'};
 f.beforeTransaction((_path,count)=>{f.db.root.sisventas.ventas.converted.presupuestoFbKey='next'+count;});
 await assert.rejects(f.api.prepare(await f.auth('a'),{id:'converted'}),{statusCode:409});assert.equal(f.transactions.length,3);assert.equal(f.db.root.sisventas.ventas.converted.responsableUid,undefined);assert.ok(!f.reads.includes('sisventas/presupuestos/next3'));assert.equal(f.off.length,1);
});

test('asignar Venta conserva contexto fresco, autor original y decisión concurrente',async()=>{
 const f=setup(),actor=await f.auth(),before=copy(f.db.root.sisventas.ventas.converted);
 const saved=(await f.api.assign(actor,{id:'converted',uid:'b',revision:0,owner:''})).record;assert.equal(saved.responsableUid,'b');assert.equal(saved.creadorOriginalNombre,'Persona a');assert.equal(saved.total,before.total);assert.equal(saved.usuario,before.usuario);assert.ok(!f.reads.includes('sisventas/presupuestos'));
 await assert.rejects(f.api.assign(await f.auth(),{id:'converted',uid:'a',revision:0,owner:''}),{statusCode:409});assert.equal(f.db.root.sisventas.ventas.converted.responsableUid,'b');
});

test('collectionReader sólo recibe raíces de list; fichas, contexto, visibleRecords y preparar siguen usando SDK',async()=>{
 const calls=[],f=setup({collectionReader:{read:async path=>{calls.push(path);return copy(path==='sisventas/ventas'?f.db.root.sisventas.ventas:f.db.root.sisventas.presupuestos);}}});
 await f.api.list(await f.auth());await f.api.list(await f.auth('a','presupuestos'));assert.ok(!f.reads.includes('sisventas/ventas'));assert.ok(!f.reads.includes('sisventas/presupuestos'));
 await f.api.prepare(await f.auth('a'),{id:'converted'});await f.api.visibleRecords(await f.auth('a'),'ventas');await f.api.visibleRecords(await f.auth('a','presupuestos'),'presupuestos');
 assert.deepEqual(calls,['sisventas/ventas','sisventas/presupuestos']);assert.ok(f.reads.includes('sisventas/ventas'));assert.ok(f.reads.includes('sisventas/presupuestos'));assert.ok(f.reads.includes('sv_usuarios'));assert.ok(f.reads.includes('sv_chat_roles'));assert.ok(f.reads.includes('sv_permisos'));assert.ok(f.reads.includes('sisventas/presupuestos/budget'));assert.ok(f.reads.includes('sisventas/ventas/converted [on]'));
});

test('un collectionReader que rechaza nunca intercepta visibleRecords, preparar ni reasignar',async()=>{
 const f=setup({collectionReader:{read:async()=>{throw Error('El lector condicional no puede entrar al guardado');}}});
 await f.api.visibleRecords(await f.auth('a'),'ventas');await f.api.visibleRecords(await f.auth('a','presupuestos'),'presupuestos');
 const saved=(await f.api.prepare(await f.auth('a'),{id:'converted'})).record;assert.equal(saved.responsableUid,'a');
 const assigned=(await f.api.assign(await f.auth(),{id:'converted',uid:'b',revision:1,owner:'a'})).record;assert.equal(assigned.responsableUid,'b');assert.equal(assigned.creadorOriginalNombre,'Persona a');
});

test('un fallo del collectionReader se propaga sin usar un historial alternativo ni omitir el error',async()=>{
 const failure=Error('Colección ficticia fallida'),f=setup({collectionReader:{read:async()=>{throw failure;}}});await assert.rejects(f.api.list(await f.auth()),error=>error===failure);assert.ok(!f.reads.some(path=>path.startsWith('sisventas/')));
});

test('medición ficticia conserva todo el historial de Ventas y evita transferir presupuestos sin relación',async()=>{
 const f=setup();for(let i=0;i<200;i++)f.db.root.sisventas.presupuestos['unused-'+i]={creadoPor:'Persona a',total:100,archivo:'DOCUMENTO-FICTICIO-'.repeat(500)};
 const baseline=Buffer.byteLength(JSON.stringify(f.db.root.sisventas.ventas))+Buffer.byteLength(JSON.stringify(f.db.root.sisventas.presupuestos));
 const rows=(await f.api.list(await f.auth())).records;
 const narrowed=Buffer.byteLength(JSON.stringify(f.db.root.sisventas.ventas))+Buffer.byteLength(JSON.stringify(f.db.root.sisventas.presupuestos.budget));
 assert.equal(Object.keys(rows).length,Object.keys(f.db.root.sisventas.ventas).length);assert.ok(narrowed<baseline/100);assert.equal(f.reads.filter(path=>path.startsWith('sisventas/')).length,2);assert.ok(!f.reads.some(path=>path.includes('/unused-')));
});
