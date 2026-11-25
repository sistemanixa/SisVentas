'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./helpers/sales-search-retention.cjs');
for(const text of ['Cliente ficticio 0','Nada que corresponda a la página'])test('un nuevo texto no publica filas provisionales de la consulta anterior: '+text,async()=>{
 const x=await fixture(),totals=x.totalsReads(),debt=x.nodes.get('vm-pendiente').textContent;
 assert.equal(x.rows().length,50);x.input(text);
 assert.equal(x.rows().length,0,'Entre input y respuesta no deben verse filas de la página anterior ni un subconjunto provisorio.');
 assert.match(x.nodes.get('ventas-search-status').textContent,/Cargando|Buscando/);
 assert.equal(x.nodes.get('vm-pendiente').textContent,debt);assert.equal(x.totalsReads(),totals);
});
test('una consulta indexada pendiente no revive filas anteriores por repintado de otro consumidor',async()=>{
 const x=await fixture(),held=x.hold(),pending=x.search('Gerardo');await held.began;
 try{assert.equal(x.rows().length,0);x.host.renderList();assert.equal(x.rows().length,0);}finally{held.release();await pending;}
 assert.equal(x.rows().length,20);
});
test('un error de una búsqueda distinta no presenta como resultado las filas verificadas de otra búsqueda',async()=>{
 const x=await fixture(),held=x.hold(),pending=x.search('Gerardo');await held.began;held.fail(Object.assign(Error('offline transport'),{code:'unavailable'}));await pending;
 assert.equal(x.rows().length,0);assert.match(x.nodes.get('ventas-search-status').textContent,/intentar|completar|offline/);
 assert.equal(x.ready().ready,true,'La presentación de búsqueda no invalida los totales globales verificados.');
});
