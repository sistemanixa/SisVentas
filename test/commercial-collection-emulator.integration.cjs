'use strict';
// Integración opt-in, exclusivamente en emulador local con identidades ficticias.
const {test,before,beforeEach}=require('node:test'),assert=require('node:assert/strict');
const {createCommercialCollectionReader}=require('../cotizador/commercial-collection-reader');
const {createCommercialOwnership}=require('../cotizador/commercial-ownership');
const base='http://127.0.0.1:9027/',namespace='demo-sisventas-collections';
if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9027')throw Error('Este test requiere únicamente el emulador 127.0.0.1:9027');
function target(path){const url=new URL(path+'.json',base);url.searchParams.set('ns',namespace);return url;}
const headers={Authorization:'Bearer owner','Content-Type':'application/json'};
async function write(path,value){const response=await fetch(target(path),{method:'PUT',headers,body:JSON.stringify(value)});assert.equal(response.status,200);await response.body?.cancel();}
const data=()=>({sv_usuarios:{a:{uid:'a',nombre:'Persona ficticia A',rol:'vendedor',activo:true},b:{uid:'b',nombre:'Persona ficticia B',rol:'administrativo',activo:true},admin:{uid:'admin',nombre:'Admin ficticio',rol:'admin',activo:true}},sv_chat_roles:{a:{rol:'vendedor',activo:true},b:{rol:'administrativo',activo:true},admin:{rol:'admin',activo:true}},sv_permisos:{},sisventas:{presupuestos:{one:{id:'PP-FICTICIO',responsableUid:'a',creadorOriginalNombre:'Persona ficticia A',estado:'aprobado_int',total:100.25,items:[{cod:'DEMO',qty:1,punit:100.25}],audit:[{accion:'Creado como ejemplo',usuario:'Persona ficticia A',fecha:'2026-10-21'}]},other:{id:'PP-OTRO',responsableUid:'b',total:9.75}},ventas:{sale:{id:'V-FICTICIA',responsableUid:'a',presupuestoFbKey:'one',total:100.25,totalPagado:40.10,estadoPago:'seniado',items:[{cod:'DEMO',qty:1,punit:100.25,costoUnitarioPresupuestado:40.35}],pagos:{old:{monto:40.10,fecha:'2026-10-21'}},comisionados:[{uid:'a',porcentaje:5}]}}}});
before(async()=>{const response=await fetch(target('.info/connected'),{headers:{Authorization:'Bearer owner'}});assert.ok(response.status<500);await response.body?.cancel();});
beforeEach(async()=>write('',data()));
function fixture(){
 const calls=[];
 const reader=createCommercialCollectionReader({databaseURL:base,accessToken:async()=> 'owner',fetchImpl:async(url,options)=>{assert.equal(new URL(url).origin,new URL(base).origin);const request=new URL(url);request.searchParams.set('ns',namespace);const response=await fetch(request,options);calls.push({path:request.pathname,status:response.status,validator:options.headers['If-None-Match']});return response;}});
 const paths=[],db={ref:path=>({get:async()=>{paths.push(path);const response=await fetch(target(path),{headers});assert.equal(response.status,200);const value=await response.json();return {val:()=>structuredClone(value)};}})};
 const api=createCommercialOwnership({auth:{verifyIdToken:async uid=>({uid})},db,enabled:true,collectionReader:reader});
 const list=async(uid,domain='presupuestos')=>api.list(await api.authorize({headers:{authorization:'Bearer '+uid}},domain));
 return {reader,api,list,calls,paths};
}

test('RTDB real del emulador devuelve304 sin JSON y un cambio de otra instancia se ve en el siguiente GET',async()=>{
 const a=fixture(),b=fixture(),first=await a.reader.read('sisventas/presupuestos');
 const second=await a.reader.read('sisventas/presupuestos');assert.deepEqual(second,first);assert.equal(a.calls[1].status,304);assert.ok(a.calls[1].validator);
 await b.reader.read('sisventas/presupuestos');await write('sisventas/presupuestos/one/total',125.75);
 const changed=await a.reader.read('sisventas/presupuestos');assert.equal(changed.one.total,125.75);assert.equal(a.calls[2].status,200);
 assert.equal((await b.reader.read('sisventas/presupuestos')).one.total,125.75);
});

test('un listado validado conserva registros antiguos, ítems, pagos y comisionados con centavos',async()=>{
 const f=fixture(),first=await f.list('admin','ventas'),second=await f.list('admin','ventas');
 assert.deepEqual(second,first);assert.equal(f.calls.at(-1).status,304);
 const sale=second.records.sale;assert.equal(sale.total,100.25);assert.equal(sale.totalPagado,40.10);assert.equal(sale.items[0].costoUnitarioPresupuestado,40.35);assert.equal(sale.pagos.old.monto,40.10);assert.equal(sale.comisionados[0].uid,'a');
 assert.equal(f.paths.includes('sisventas/presupuestos'),false);assert.ok(f.paths.includes('sisventas/presupuestos/one'));
 await write('sisventas/ventas/sale/totalPagado',100.25);await write('sisventas/ventas/sale/estadoPago','pago_total');
 const updated=await f.list('admin','ventas');assert.equal(updated.records.sale.totalPagado,100.25);assert.equal(updated.records.sale.estadoPago,'pago_total');assert.deepEqual(updated.records.sale.items,sale.items);assert.deepEqual(updated.records.sale.comisionados,sale.comisionados);
});

test('la caché de datos no comparte permisos ni registros ajenos entre usuarios',async()=>{
 const f=fixture();assert.equal(Object.keys((await f.list('admin')).records).length,2);
 const own=await f.list('a');assert.deepEqual(Object.keys(own.records),['one']);assert.equal(f.calls.at(-1).status,304);
 const other=await f.list('b');assert.deepEqual(Object.keys(other.records),['other']);assert.equal(f.calls.at(-1).status,304);
 const before=f.calls.length;await write('sv_chat_roles/a/activo',false);
 await assert.rejects(f.list('a'),{statusCode:403});assert.equal(f.calls.length,before,'Una cuenta revocada no llega al lector de colecciones');
});

test('altas, bajas y reasignaciones de otro cliente cambian la representación y el alcance visible',async()=>{
 const f=fixture();await f.list('a');
 await write('sisventas/presupuestos/one/responsableUid','b');assert.deepEqual(Object.keys((await f.list('a')).records),[]);
 await write('sisventas/presupuestos/new',{id:'PP-NUEVO-FICTICIO',responsableUid:'a',total:25.50});
 assert.deepEqual(Object.keys((await f.list('a')).records),['new']);
 await write('sisventas/presupuestos/new',null);assert.deepEqual(Object.keys((await f.list('a')).records),[]);
 assert.ok(f.calls.every(call=>call.status===200));
});

test('un origen modificado se vuelve a leer aunque la colección de ventas responda304',async()=>{
 const f=fixture(),before=await f.list('admin','ventas');
 await write('sisventas/presupuestos/one/creadorOriginalNombre','Autor corregido ficticio');
 await write('sisventas/presupuestos/one/audit',[{accion:'Origen corregido ficticio',usuario:'Autor corregido ficticio'}]);
 const after=await f.list('admin','ventas');
 assert.equal(f.calls.at(-1).status,304);
 assert.equal(after.records.sale._svOriginalAuthor.name,'Autor corregido ficticio');
 assert.notDeepEqual(after,before);
 assert.ok(f.paths.filter(p=>p==='sisventas/presupuestos/one').length>=2);
});
