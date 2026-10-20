'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
const plain=value=>JSON.parse(JSON.stringify(value));
function setup(options={}){
 const product={fbKey:'p',codigo:'P-DEMO',nombre:'Producto ficticio'},business={productos:{p:product},ventas:{s:{items:[{cod:'P-DEMO',qty:2,precio:150}]}},presupuestos:{b:{items:[{cod:'P-DEMO',qty:1,precio:99}]}},pagos:{a:{monto:50}},gastos:{comision:{monto:5}}};
 const historic=JSON.stringify({...business,productos:undefined}),calls={reads:0,removes:[],updates:[],confirmations:[],messages:[],renders:[],audit:[],opened:[],cache:0};
 let allowed=options.allowed!==false;
 const c={window:null,currentRole:options.role||'administrativo',currentUserUid:'u',fbAuth:{currentUser:{uid:'u'}},PERMISOS_ROLES:{administrativo:{indiceRevision:3},admin:{indiceRevision:2}},prodData:{p:product},fbDB:{},FB_PATHS:{productos:'sisventas/productos',ventas:'sisventas/ventas'},document:{addEventListener(){},getElementById:id=>id==='prod-search'?{value:'demo'}:null,querySelectorAll:()=>[{value:'p'},{value:'unknown'}]},_actualizadorSesionPrecios:{candidatos:[],fallos:[],procesados:{}},notify:message=>calls.messages.push(message),tienePermiso:action=>action==='productos.eliminar'&&allowed,svPuedeLeerDominio:()=>options.domain!==false,productoCoincideItemVenta:(p,item)=>p.codigo===item.cod,fbRef:(_,path)=>path,fbGet:async()=>{calls.reads++;throw Error('No se debe leer ventas ni la raíz');},fetch:async()=>{calls.reads++;throw Error('No se debe consultar la red');},fbRemove:async path=>{calls.removes.push(path);if(options.removeError)throw Error('Rechazo ficticio');delete business.productos[path.split('/').pop()];await options.afterRemove?.(c);},fbUpdate:async(path,updates)=>{calls.updates.push({path,updates:plain(updates)});for(const key of Object.keys(updates))delete business.productos[key];},renderTablaProductos:filter=>calls.renders.push(filter),actualizarStatProductos(){},registrarActividad:(...args)=>calls.audit.push(args),cerrarDetalleProducto:()=>calls.closed=true,sincronizarActualizadorTrasEliminarProductos:ids=>calls.synced=plain(ids),abrirVentaDesdeAdvertenciaProducto:sale=>calls.opened.push(sale.fbKey)};
 c.window=c;
 c.SVCommercialOwnership={cachedRecords:()=>{calls.cache++;return options.records||null;},belongs:sale=>(sale.responsableUid||sale._svOwnerUid)===c.currentUserUid};
 c.svConfirm=async(message,settings)=>{const number=calls.confirmations.length+1;calls.confirmations.push({message,settings});await options.confirm?.(number,c,settings);return options.cancel!==number;};
 load(c,['capturarContextoEliminarProducto','contextoEliminarProductoVigente','ventasCargadasParaAdvertenciaProducto','eliminarProductoPorId','eliminarProducto','eliminarProductosNoDisponiblesActualizador']);
 return {c,calls,business,revoke:()=>{allowed=false;},assertHistory(){assert.equal(JSON.stringify({...business,productos:undefined}),historic);assert.equal(calls.reads,0);}};
}

for(const role of ['admin','administrativo'])test(role+' autorizado elimina sólo el producto con dos confirmaciones y cero lecturas comerciales',async()=>{
 const f=setup({role});assert.equal(await f.c.eliminarProducto({dataset:{pid:'p'}}),true);
 assert.deepEqual(f.calls.removes,['sisventas/productos/p']);assert.equal(f.calls.confirmations.length,2);assert.deepEqual(f.calls.renders,['demo']);assert.equal(f.c.prodData.p,undefined);assert.equal(f.calls.audit.length,1);f.assertHistory();
 assert.match(f.calls.confirmations[0].message,/No se modifican las ventas ni los presupuestos guardados/);
 assert.doesNotMatch(f.calls.confirmations[0].message,/ninguna venta|0 ventas|historial completo/);
});

test('el permiso denegado o ausente bloquea antes de confirmar y no exige ser administrador',async()=>{
 for(const missing of [false,true]){const f=setup({allowed:false});if(missing)delete f.c.tienePermiso;
 assert.equal(await f.c.eliminarProductoPorId('p',false),false);assert.equal(f.calls.removes.length,0);assert.equal(f.calls.confirmations.length,0);assert.match(f.calls.messages[0],/No tenés permiso/);assert.doesNotMatch(f.calls.messages[0],/administrador/);f.assertHistory();}
});

for(const cancel of [1,2])test('cancelar la confirmación '+cancel+' conserva catálogo e históricos',async()=>{
 const f=setup({cancel});assert.equal(await f.c.eliminarProductoPorId('p',true),false);assert.equal(f.calls.confirmations.length,cancel);assert.equal(f.calls.removes.length,0);assert.ok(f.c.prodData.p);assert.equal(f.calls.closed,undefined);f.assertHistory();
});

for(const [name,change]of [
 ['Auth',c=>{c.fbAuth.currentUser={uid:'u'};}],['UID',c=>{c.currentUserUid='other';}],['rol',c=>{c.currentRole='admin';}],['revisión',c=>{c.PERMISOS_ROLES.administrativo.indiceRevision++;}],['permiso',c=>{c.tienePermiso=()=>false;}]
])for(const at of [1,2])test('cambio de '+name+' en confirmación '+at+' impide el borrado',async()=>{
 const f=setup({confirm:(number,c)=>{if(number===at)change(c);}});assert.equal(await f.c.eliminarProductoPorId('p',false),false);assert.equal(f.calls.removes.length,0);assert.equal(f.calls.confirmations.length,at);assert.ok(f.business.productos.p);f.assertHistory();
});

test('sin Auth o durante Ver como no confirma ni elimina con credenciales de otra identidad',async()=>{
 for(const change of [c=>{c.fbAuth.currentUser=null;},c=>{c.currentUserUid='impersonated';}]){const f=setup();change(f.c);assert.equal(await f.c.eliminarProductoPorId('p',false),false);assert.equal(f.calls.confirmations.length,0);assert.equal(f.calls.removes.length,0);f.assertHistory();}
});

test('rechazo de escritura conserva producto y no anuncia un éxito',async()=>{
 const f=setup({removeError:true});assert.equal(await f.c.eliminarProductoPorId('p',true),false);assert.ok(f.c.prodData.p);assert.ok(f.business.productos.p);assert.equal(f.calls.audit.length,0);assert.equal(f.calls.closed,undefined);assert.deepEqual(f.calls.renders,[]);assert.match(f.calls.messages.at(-1),/Rechazo ficticio/);f.assertHistory();
});

test('éxito elimina también la copia en array y cierra sólo su detalle',async()=>{
 const f=setup();f.c.prodData=[f.c.prodData.p,{fbKey:'kept',codigo:'OTHER'}];assert.equal(await f.c.eliminarProductoPorId('p',true),true);assert.deepEqual(plain(f.c.prodData),[{fbKey:'kept',codigo:'OTHER'}]);assert.equal(f.calls.closed,true);f.assertHistory();
});

test('una respuesta de borrado de la sesión anterior no modifica la grilla ni el detalle de la nueva',async()=>{
 const f=setup({afterRemove:c=>{c.currentUserUid='other';c.prodData={other:{fbKey:'other'}};}});assert.equal(await f.c.eliminarProductoPorId('p',true),true);assert.deepEqual(plain(f.c.prodData),{other:{fbKey:'other'}});assert.equal(f.calls.closed,undefined);assert.deepEqual(f.calls.renders,[]);assert.equal(f.calls.audit.length,0);f.assertHistory();
});

test('los enlaces usan sólo ventas propias autorizadas ya cargadas, incluso con detalle en objeto',async()=>{
 const f=setup({cancel:1,records:{own:{responsableUid:'u',id:'V-DEMO',cliente:'Cliente ficticio',detalle:{a:{cod:'P-DEMO'}}},foreign:{responsableUid:'other',items:[{cod:'P-DEMO'}]},ambiguous:{items:[{cod:'P-DEMO'}]},unrelated:{responsableUid:'u',items:[{cod:'OTHER'}]}}});
 await f.c.eliminarProductoPorId('p',false);const notice=f.calls.confirmations[0];assert.match(notice.message,/1 venta de las que tenés cargadas/);assert.equal(notice.settings.enlaces.length,1);notice.settings.enlaces[0].abrir();assert.deepEqual(f.calls.opened,['own']);assert.equal(f.calls.removes.length,0);f.assertHistory();
});

test('sin acceso a Ventas no consulta ni muestra su caché, y puede eliminar según el permiso de Productos',async()=>{
 const f=setup({domain:false,records:{foreign:{items:[{cod:'P-DEMO'}]}}});assert.equal(await f.c.eliminarProductoPorId('p',false),true);assert.equal(f.calls.cache,0);assert.equal(f.calls.confirmations[0].settings.enlaces.length,0);f.assertHistory();
});

test('admin conserva enlaces del historial cargado sin convertirlos en un recuento global',async()=>{
 const f=setup({role:'admin',cancel:1,records:{a:{items:[{cod:'P-DEMO'}]},b:{items:[{cod:'P-DEMO'}]}}});await f.c.eliminarProductoPorId('p',false);assert.equal(f.calls.confirmations[0].settings.enlaces.length,2);assert.match(f.calls.confirmations[0].message,/2 ventas de las que tenés cargadas/);f.assertHistory();
});

test('el lote confirma y elimina sólo productos seleccionados que existen, sin leer ventas',async()=>{
 const f=setup();await f.c.eliminarProductosNoDisponiblesActualizador();assert.equal(f.calls.confirmations.length,2);assert.deepEqual(f.calls.updates,[{path:'sisventas/productos',updates:{p:null}}]);assert.deepEqual(f.calls.synced,['p']);assert.equal(f.business.productos.p,undefined);assert.match(f.calls.confirmations[0].message,/No se modifican las ventas ni los presupuestos guardados/);assert.doesNotMatch(f.calls.confirmations[0].message,/0 tienen ventas/);f.assertHistory();
});

for(const cancel of [1,2])test('cancelar el lote en paso '+cancel+' no borra',async()=>{
 const f=setup({cancel});await f.c.eliminarProductosNoDisponiblesActualizador();assert.equal(f.calls.updates.length,0);assert.ok(f.business.productos.p);f.assertHistory();
});

test('el lote exige permiso y revalida la sesión después de cada confirmación',async()=>{
 for(const at of [0,1,2]){const f=setup({allowed:at!==0,confirm:(number,c)=>{if(number===at)c.currentRole='admin';}});await f.c.eliminarProductosNoDisponiblesActualizador();assert.equal(f.calls.updates.length,0);assert.ok(f.business.productos.p);f.assertHistory();}
});
