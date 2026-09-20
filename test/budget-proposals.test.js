const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const integration=require('../js/v3/budget-integration');
const budget=require('../js/v3/budget-read-model');
const context={window:{},setInterval(){}};
vm.runInNewContext(fs.readFileSync('js/modules/budget-proposals.js','utf8'),context);
const {combine,scenario}=context.window.PropuestasComerciales;
const plain=v=>JSON.parse(JSON.stringify(v));
const source=require('./helpers/active-app').readActiveApp().source;
function extract(name,next){return source.slice(source.indexOf('function '+name+'('),source.indexOf('\nfunction '+next+'(',source.indexOf('function '+name+'(')));}
test('costos de propuesta sobreviven lectura, edición, guardado y conversión a venta',()=>{
 const row={dataset:{costoPropuesta:JSON.stringify({cod:'A',costoUnitarioCompra:66,origenCompra:'Paraguay',porcentajeVentaCompra:30})},querySelector(sel){return sel.includes('prod-sel-cod')?{textContent:'A'}:sel.includes('desc')?{textContent:'Cámara'}:sel.includes('qty')?{value:2}:sel.includes('price')?{value:'85.8',dataset:{}}:sel.includes('disc')?{value:'10'}:null;}};
 const c={document:{querySelectorAll:()=>[row]},_redondearPrecioActual:budget.roundMoney,obtenerProductoPorCodigoVenta:()=>null};
 vm.runInNewContext(extract('getPpItems','stockBadgeHTML'),c);
 const items=c.getPpItems();assert.equal(items[0].costoUnitarioCompra,66);assert.equal(items[0].origenCompra,'Paraguay');
 const record=integration.fields({items,descuentoGeneral:5,conIva:true});const sale=integration.toSale(record);assert.equal(sale.items[0].costoUnitarioCompra,66);
 row.dataset.costoPropuesta=JSON.stringify({cod:'OTHER',costoUnitarioCompra:66});assert.equal(c.getPpItems()[0].costoUnitarioCompra,undefined);
});
test('Flytec usa cotización vigente y diferencia contra el menor costo suministrado',()=>{
 const c={window:{TIPO_CAMBIO_CONFIG:{oficial:1530}},costoRealProveedorProducto:p=>p.precio};vm.runInNewContext(extract('costoExteriorVigenteARS','precioVentaDesdeCostoUnitarioProducto'),c);
 const html=c.mejoraCostoExteriorHTML(130050,120601.69,{precioOriginal:59,monedaOriginal:'USD',disponibilidadProveedor:'disponible'});
 assert.ok(html.includes('30.331,69'));assert.ok(html.includes('25.2%'));assert.ok(html.includes('menor costo local'));
});
test('Paraguay conserva mano de obra, descuentos y originales; distribuye flete',()=>{
 const items=[{cod:'a',qty:2,punit:200,disc:10,costoUnitarioCompra:150},{cod:'b',qty:3,punit:100,disc:0},{cod:'mo',qty:2,punit:80,disc:5}];
 const before=JSON.stringify(items),out=scenario(items,[{index:0,cost:60,markup:30,selected:true},{index:1,cost:20,markup:50,selected:true}],18);
 assert.equal(out[0].costoUnitarioCompra,66);assert.equal(out[0].punit,85.8);assert.equal(out[1].costoUnitarioCompra,22);assert.equal(out[1].punit,33);
 assert.deepEqual(plain(out[2]),items[2]);assert.equal(JSON.stringify(items),before);
 const stored=integration.fields({items:out,descuentoGeneral:10,conIva:true});
 assert.equal(stored.total,441.53);assert.equal(stored.items[0].costoUnitarioCompra,66);
 assert.equal(integration.printModel(stored).total,stored.total);
});
test('gastos conservan precisión con cantidades fraccionarias',()=>{
 const out=scenario([{cod:'a',qty:3,punit:100},{cod:'b',qty:2.5,punit:200}],[{index:0,cost:12.34,markup:30,selected:true},{index:1,cost:15.62,markup:20,selected:true}],1);
 assert.equal(budget.roundMoney(out.reduce((s,i)=>s+i.qty*i.costoUnitarioCompra,0)),77.07);
});
test('unión suma iguales pero separa precios, descuentos y costos distintos',()=>{
 const a={cod:'a',qty:2,punit:100,disc:5,costoUnitarioCompra:60};const records=[{items:[a]},{items:[{...a,qty:3},{...a,punit:110},{...a,disc:10},{...a,costoUnitarioCompra:50}]}];
 const before=JSON.stringify(records),out=combine(records);assert.equal(out.length,4);assert.equal(out[0].qty,5);assert.equal(out[0].sub,475);assert.equal(out[0].costoTotalCompra,300);assert.equal(JSON.stringify(records),before);
});
test('rechaza gastos y porcentajes inválidos; un ítem desmarcado se excluye',()=>{
 const items=[{cod:'a',qty:1,punit:100}];assert.throws(()=>scenario(items,[],5));assert.throws(()=>scenario(items,[],-1));
 assert.throws(()=>scenario(items,[{index:0,cost:40,markup:NaN,selected:true}],0));
 assert.deepEqual(plain(scenario(items,[{index:0,cost:40,markup:30,selected:false}],0)),[]);
});
test('selección incluye mano de obra y sin Paraguay sin recalcular sus valores',()=>{
 const items=[{cod:'local',qty:3,punit:123.45,disc:7,costoUnitarioCompra:90},{cod:'mo',qty:2,punit:500,disc:5}];
 const choices=items.map((_,index)=>({index,selected:true,useExterior:false,cost:0,markup:0}));
 assert.deepEqual(plain(scenario(items,choices,0)),items);
 choices[0].selected=false;assert.deepEqual(plain(scenario(items,choices,0)),[items[1]]);
 assert.throws(()=>scenario(items,choices,10));
});
test('sin permisos ninguna acción abre ni crea una propuesta',()=>{
 const denied={window:{tienePermiso:()=>false},tienePermiso:()=>false,setInterval(){},notify(){},document:{createElement(){throw Error('No debe abrir');}}};
 vm.runInNewContext(fs.readFileSync('js/modules/budget-proposals.js','utf8'),denied);
 denied.window.crearPropuestaExterior({});denied.window.combinarPresupuestos();
});
test('consulta no bloquea navegación ni edición, evita solapamiento y libera tras fallo',async()=>{
 let resolve,calls=0;const listeners=[];const c={window:{cotizarPreciosProveedores:()=>{calls++;return new Promise(r=>resolve=r);},notify(){},addEventListener:n=>listeners.push(n)},document:{getElementById:()=>null}};
 vm.runInNewContext(fs.readFileSync('js/modules/product-query-guard.js','utf8'),c);
 const p=c.window.cotizarPreciosProveedores();assert.equal(c.window.svBloquearSalidaCotizacion(),false);await c.window.cotizarPreciosProveedores();assert.equal(calls,1);assert.deepEqual(listeners,['beforeunload']);resolve();await p;assert.equal(c.window._svConsultaProductoEnCurso,false);
});
test('preparación crea copia ARS con referencia, descuento y título, sin persistir original',()=>{
 const nodes={'pp-titulo-solucion':{value:''},obs:{value:''}};let copied,loaded,calculated=0;const events=[];
 const c={window:{tienePermiso:()=>true,svDrafts:{flush(){events.push('flush');},begin(){events.push('begin');}}},tienePermiso:()=>true,setInterval(){},notify(){},_svResolverClienteRegistro:()=>({fbKey:'client'}),_cargarDuplicadoPresupuesto:(r)=>copied=structuredClone(r),pptoCargarItemsEnEditor:r=>loaded=r,document:{getElementById:id=>nodes[id],querySelector:()=>nodes.obs},calcPpTotales:()=>calculated++};c.svDrafts=c.window.svDrafts;
 vm.runInNewContext(fs.readFileSync('js/modules/budget-proposals.js','utf8').replace('window.PropuestasComerciales={combine:combine,scenario:scenario,origenExterior:origenExterior};','window.PropuestasComerciales={combine:combine,scenario:scenario,origenExterior:origenExterior,prepare:prepare};'),c);
 const original={id:'PP-1',moneda:'USD',descuento:10,items:[{qty:1,punit:10}]};const before=JSON.stringify(original);
 c.window.PropuestasComerciales.prepare(original,[{cod:'A',qty:1,punit:100,costoUnitarioCompra:70}],['PP-1','PP-2'],5,'Unificado');
 assert.equal(copied.moneda,'ARS');assert.equal(copied.descuentoGeneral,5);assert.equal(loaded.items[0].costoUnitarioCompra,70);assert.equal(nodes['pp-titulo-solucion'].value,'Unificado');assert.ok(nodes.obs.value.includes('PP-1, PP-2'));assert.equal(JSON.stringify(original),before);assert.equal(calculated,1);assert.deepEqual(events,['flush','begin','flush']);
});
test('combinar limita al mismo cliente y presupuestos vigentes',()=>{
 const c={window:{},setInterval(){},_svResolverClienteRegistro:r=>r.clientResolved?{fbKey:r.clientResolved}:null,pptoEstaVencidoParaActualizar:p=>p.vence==='2020-01-01'};
 vm.runInNewContext(fs.readFileSync('js/modules/budget-proposals.js','utf8').replace('window.PropuestasComerciales={combine:combine,scenario:scenario,origenExterior:origenExterior};','window.PropuestasComerciales={combine:combine,scenario:scenario,origenExterior:origenExterior,combinable:combinable};'),c);
 const fn=c.window.PropuestasComerciales.combinable,source={id:'PP-1',clientResolved:'A'};
 assert.equal(fn({id:'PP-2',clientResolved:'A',estado:'borrador'},source),true);
 assert.equal(fn({id:'PP-2',clientResolved:'B'},source),false);
 for(const estado of ['anulado','convertido','rechazado','vencido'])assert.equal(fn({id:'PP-2',clientResolved:'A',estado},source),false);
 assert.equal(fn({id:'PP-2',clientResolved:'A',vence:'2020-01-01'},source),false);
 assert.equal(fn(source,source),false);
 assert.equal(fn({id:'PP-2',cliente:'Consumidor final'},{id:'PP-1',cliente:'Consumidor final'}),false);
});
test('la marca exterior persiste en los ítems guardados y no confunde mano de obra local',()=>{
 const record={items:[
  {cod:'P-1',costoUnitarioCompra:130050,origenCompra:'Paraguay'},
  {cod:'P-2',costoUnitarioCompra:48960,origenCompra:'Paraguay'},
  {cod:'M-1',costoUnitarioCompra:80000,origenCompra:''},
  {cod:'P-3',costoUnitarioCompra:55000,origenCompra:'Local'}
 ]};
 const origen=context.window.PropuestasComerciales.origenExterior(record);
 assert.equal(origen.cantidad,2);
 assert.deepEqual(plain(origen.paises),['Paraguay']);
 assert.equal(context.window.PropuestasComerciales.origenExterior({items:record.items.slice(2)}).cantidad,0);
});
