'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/sales-search-retention.cjs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
for(const consumer of ['renderList','ensure'])test(consumer+' cannot requery the committed old text during a newer input debounce',async()=>{
 const x=await fixture(),debt=x.nodes.get('vm-pendiente').textContent,totals=x.totalsReads(),held=x.hold(),old=x.search('Gerardo');await held.began;
 x.input('Cliente ficticio 0');assert.equal(x.rows().length,1);const reads=x.f.calls.length;
 const repaint=x.host[consumer]();await tick();const extraReads=x.f.calls.length-reads;
 held.release();await Promise.all([old,repaint]);
 assert.equal(extraReads,0,'background repaint must not issue any reader IO before the new text settles');
 assert.equal(x.rows().length,1);assert.equal(x.rows()[0].cliente,'Cliente ficticio 0');assert.match(x.nodes.get('ventas-search-status').textContent,/provisori/i);
 assert.equal(x.nodes.get('vm-pendiente').textContent,debt);assert.equal(x.totalsReads(),totals);assert.equal(x.ready().errors.length,0);
 await x.search('Cliente ficticio 0');assert.equal(x.rows().length,1);assert.doesNotMatch(x.nodes.get('ventas-search-status').textContent,/provisori/i);assert.equal(x.totalsReads(),totals);
});
test('returning to verified text while another committed query is pending cannot revive that query',async()=>{
 const x=await fixture();await x.search('Cliente ficticio 0');x.input('Cliente ficticio 0');const held=x.hold(),old=x.search('Gerardo');await held.began;
 x.input('Cliente ficticio 0');const reads=x.f.calls.length,repaint=x.host.renderList();await tick();const extraReads=x.f.calls.length-reads;held.release();await Promise.all([old,repaint]);
 assert.equal(extraReads,0);assert.equal(x.rows().length,1);const before=x.f.calls.length;await x.search('Cliente ficticio 0');assert.equal(x.f.calls.length,before,'restoring an already verified query needs no historical read');assert.equal(x.nodes.get('ventas-list-view').attrs['data-sv-search-provisional'],undefined);
});
test('provisional repaint preserves the verified second-page cursor until the new query settles',async()=>{
 const x=await fixture();x.nodes.get('ventas-paginacion').buttons['[data-index-next]'].onclick();await tick();assert.match(x.nodes.get('ventas-paginacion').innerHTML,/Página 2/);
 const latest=x.rows()[0].cliente,held=x.hold(),old=x.search('Gerardo');await held.began;x.input(latest);const repaint=x.host.renderList();await tick();held.release();await Promise.all([old,repaint]);assert.match(x.nodes.get('ventas-paginacion').innerHTML,/Página 2/);assert.equal(x.rows().length,1);
 await x.search(latest);assert.match(x.nodes.get('ventas-paginacion').innerHTML,/Página 1/);assert.equal(x.rows().length,1);
});
test('pending input guard retires the preview if its permission revision changed',async()=>{
 const x=await fixture(),held=x.hold(),old=x.search('Gerardo');await held.began;x.input('Cliente ficticio 0');x.root.PERMISOS_ROLES.admin.indiceRevision++;
 const repaint=x.host.renderList();held.release();await Promise.all([old,repaint]);assert.equal(x.rows().length,0);assert.equal(x.ready().ready,false);assert.equal(x.host.financialState(),null);
});
