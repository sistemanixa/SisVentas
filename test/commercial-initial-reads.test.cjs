'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/commercial-ownership-fixtures.cjs');
function tracked(){const f=fixture(),reads=[],ref=f.db.ref.bind(f.db);f.db.ref=p=>{const r=ref(p),get=r.get.bind(r);r.get=async()=>{reads.push(p);return get();};return r;};return {...f,reads};}

test('listado usa una sola lectura de identidad/permisos en su petición y conserva todo el registro',async()=>{
 const f=tracked();f.db.root.sisventas.ventas.one.factura={referencia:'FICTICIA',documento:'contenido ficticio conservado'};
 const actor=await f.auth('admin');const result=await f.api.list(actor);
 for(const p of ['sv_usuarios','sv_chat_roles','sv_permisos'])assert.equal(f.reads.filter(x=>x===p).length,1,p);
 assert.equal(f.reads.length,5);assert.deepEqual(result.records.one.factura,f.db.root.sisventas.ventas.one.factura);
 assert.equal(result.records.converted._svOriginalAuthor.name,'Persona a');assert.equal(Object.keys(result.records).length,4);
 const fallback=await f.api.list({...actor});assert.deepEqual(result,fallback);
});

test('nueva petición vuelve a comprobar revocación de cuenta y permisos, sin cachearlos',async()=>{
 for(const kind of ['cuenta','rol']){const f=tracked();await f.api.list(await f.auth('a'));
 if(kind==='cuenta')f.db.root.sv_chat_roles.a.activo=false;
 else{f.db.root.sv_permisos.vendedor.indiceModulos.venta=false;f.db.root.sv_permisos.vendedor.indiceModulos.detalle=false;f.db.root.sv_permisos.vendedor.indiceModulos.cobranzas=false;}
 await assert.rejects(f.auth('a'),e=>e.statusCode===403);
 assert.equal(f.reads.filter(p=>p==='sv_permisos').length,2);
 }
});

test('instantáneas de autorización de dos cuentas no se cruzan y los registros siguen leyéndose actuales',async()=>{
 const f=tracked(),a=await f.auth('a'),b=await f.auth('b');f.db.root.sisventas.ventas.one.total=123.45;
 const ra=await f.api.list(a),rb=await f.api.list(b);assert.deepEqual(Object.keys(ra.records),['one','converted']);assert.deepEqual(Object.keys(rb.records),['other']);assert.equal(ra.records.one.total,123.45);
});

test('el contexto se consume una vez y no se agrega a objetos serializables del actor',async()=>{
 const f=tracked(),actor=await f.auth('a');assert.equal(JSON.stringify(actor).includes('permissions'),false);await f.api.list(actor);f.reads.length=0;await f.api.list(actor);
 for(const p of ['sv_usuarios','sv_chat_roles','sv_permisos'])assert.equal(f.reads.filter(x=>x===p).length,1);
});
