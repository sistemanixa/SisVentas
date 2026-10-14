const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {canonicalQuote,createCatalogRequest}=require('../catalog-request');
const periodsAPI=require('../catalog-promotions');
const date=Date.parse('2026-10-05T12:00:00-03:00');
function setup(){
 const records=new Map([['sisventas/productos/p1',{categoria:'COMPRAS PARAGUAY',activo:true}],['sv_catalogo_publico/p1',{nombre:'Producto',precioUSD:100}],['sv_catalogo_periodos',{periodos:periodsAPI.defaultPeriods}]]);let time=date;
 const snap=value=>({val:()=>value,exists:()=>value!==undefined&&value!==null});
 const db={ref:path=>({get:async()=>snap(records.get(path)),transaction:async fn=>{const next=fn(records.get(path));if(next===undefined)return {committed:false,snapshot:snap(records.get(path))};records.set(path,next);return {committed:true,snapshot:snap(next)};}})};
 return {records,api:createCatalogRequest({db,periodsAPI,now:()=>time}),setTime:value=>time=value};
}
const body=()=>({id:crypto.randomUUID(),nombre:'Prueba',lista:'Prueba técnica',telefono:'',email:'test@example.test',codigo:'',items:[{id:'p1',cantidad:2,precioUSD:100,nombre:'Nombre adulterado'}]});
test('cotización canónica ignora nombre enviado y calcula precio/oferta reales',()=>{
 const offer={codigo:'PRUEBA',activa:true,inicio:date-1000,fin:date+1000,porcentaje:10,alcance:'productos',productos:['p1']};
 const rows=canonicalQuote([{id:'p1',cantidad:2,precioUSD:0.01}],{p1:{nombre:'Real',precioUSD:100}},offer,'PRUEBA',date);
 assert.equal(rows[0].precioUSD,90);assert.equal(rows[0].nombre,'Real');assert.equal(rows[0].precioOriginalUSD,100);
});
test('rechaza duplicados, producto inexistente, cantidades inválidas y códigos vencidos',()=>{
 for(const items of [[{id:'p1',cantidad:0}],[{id:'p1',cantidad:1.5}],[{id:'p1',cantidad:1},{id:'p1',cantidad:1}],[{id:'otro',cantidad:1}]])assert.throws(()=>canonicalQuote(items,{p1:{precioUSD:100}},null,'',date));
 assert.throws(()=>canonicalQuote([{id:'p1',cantidad:1}],{p1:{precioUSD:100}},null,'FALSO',date));
});
test('no acepta precio adulterado ni crea una solicitud',async()=>{
 const {api,records}=setup(),request=body();request.items[0].precioUSD=0.01;
 await assert.rejects(api.submit(request),e=>e.statusCode===409);
 assert.equal(records.has('sv_catalogo_solicitudes/'+request.id),false);
});
test('reintentos conservan precio acordado, fecha original y no duplican pedidos',async()=>{
 const {api,records,setTime}=setup(),request=body();const first=await api.submit(request);
 assert.equal(JSON.parse(first.contenido)[0].nombre,'Producto');
 records.set('sv_catalogo_publico/p1',{nombre:'Producto',precioUSD:150});setTime(Date.parse('2026-10-12T12:00:00-03:00'));
 assert.deepEqual(await api.submit(request),first);
 const changed={...request,lista:'Otra lista'};await assert.rejects(api.submit(changed),e=>e.statusCode===409);
});
test('reserva recupera la persistencia tras corte de red sin recalcular precios',async()=>{
 const {api,records}=setup(),request=body(),first=await api.submit(request);records.delete('sv_catalogo_solicitudes/'+request.id);
 assert.deepEqual(await api.submit(request),first);assert.deepEqual(records.get('sv_catalogo_solicitudes/'+request.id),first);
});
test('rechaza pedidos nuevos fuera del período con hora del servidor',async()=>{
 const {api,records,setTime}=setup(),request=body();setTime(Date.parse('2026-10-12T12:00:00-03:00'));
 await assert.rejects(api.submit(request),e=>e.statusCode===403);assert.equal(records.has('sv_catalogo_solicitudes/'+request.id),false);
});
test('limita pedidos por contacto sin contar los reintentos aceptados',async()=>{
 const {api}=setup();let last;for(let i=0;i<5;i++){last=body();await api.submit(last);}
 await api.submit(last);await assert.rejects(api.submit(body()),e=>e.statusCode===429);
});
test('copia de períodos y descuentos coincide con el cliente vigente',()=>{
 const path=require('node:path'),fs=require('node:fs');
 assert.equal(fs.readFileSync(path.join(__dirname,'../catalog-promotions.js'),'utf8'),fs.readFileSync(path.join(__dirname,'../../js/catalog-promotions.js'),'utf8'));
});
