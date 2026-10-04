const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const dependency=require('node:module').createRequire(require('node:path').resolve(process.env.SV_SECURITY_TOOLS_ROOT || 'tmp/firebase-security-tools','package.json'));
const {initializeTestEnvironment,assertSucceeds,assertFails}=dependency('@firebase/rules-unit-testing');
const {ref,set,get,query,orderByChild,equalTo}=dependency('firebase/database');
let env,db;
before(async()=>{
  if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9005')throw Error('Solo emulador local');
  env=await initializeTestEnvironment({projectId:'demo-sisventas-security',database:{host:'127.0.0.1',port:9005,rules:fs.readFileSync('security/database.paraguay.rules.json','utf8')}});
  await env.withSecurityRulesDisabled(async c=>set(ref(c.database()),{
    sv_chat_roles:{dist:{rol:'distribuidora',activo:true},distBaja:{rol:'distribuidora',activo:false},...Object.fromEntries(['administrativo','vendedor','tecnico','tecnico_vendedor'].map(rol=>[rol,{rol,activo:true}])),py:{rol:'compras_paraguay',activo:true},otro:{rol:'compras_paraguay',activo:true},admin:{rol:'admin',activo:true},baja:{rol:'compras_paraguay',activo:false}},
    sv_usuarios:{userpy:{uid:'py',rol:'compras_paraguay',nombre:'Prueba'},admin:{uid:'admin',rol:'admin'}},
    sisventas:{productos:{py1:{categoria:'COMPRAS PARAGUAY',nombre:'Patinete',codigo:'P-1',stock:12,proveedores:[{nombre:'Prueba'}]},local1:{categoria:'CAMARAS IP',nombre:'Local'}},clientes:{privado:true},ventas:{privado:true}}
  }));
  db=env.authenticatedContext('py').database();
});
after(async()=>{if(env)await env.cleanup();});
test('Ofertas puede leer cotizaciones pero no escribirlas ni leer la configuración completa',async()=>{
  await assertSucceeds(get(ref(db,'sisventas/config/tipoCambio')));
  await assertFails(set(ref(db,'sisventas/config/tipoCambio'),{oficial:1}));
  await assertFails(get(ref(db,'sisventas/config')));
  await assertFails(get(ref(db,'sisventas/config/empresa')));
  await assertFails(get(ref(env.authenticatedContext('baja').database(),'sisventas/config/tipoCambio')));
  await assertFails(get(ref(env.unauthenticatedContext().database(),'sisventas/config/tipoCambio')));
});
test('query de categoría devuelve exclusivamente Paraguay y bloquea lectura general o individual ajena',async()=>{
  const snap=await assertSucceeds(get(query(ref(db,'sisventas/productos'),orderByChild('categoria'),equalTo('COMPRAS PARAGUAY'))));
  assert.deepEqual(Object.keys(snap.val()),['py1']);
  for(const path of ['sisventas','sisventas/productos','sisventas/productos/local1','sisventas/clientes','sisventas/ventas','sv_chat_directorio','sv_permisos'])await assertFails(get(ref(db,path)));
  await assertFails(get(query(ref(db,'sisventas/productos'),orderByChild('categoria'),equalTo('CAMARAS IP'))));
});
test('lee solo su ficha y no puede cambiar productos, usuarios ni roles',async()=>{
  const snap=await assertSucceeds(get(query(ref(db,'sv_usuarios'),orderByChild('uid'),equalTo('py'))));
  assert.deepEqual(Object.keys(snap.val()),['userpy']);
  await assertFails(get(ref(db,'sv_usuarios')));
  await assertFails(get(query(ref(db,'sv_usuarios'),orderByChild('uid'),equalTo('admin'))));
  for(const path of ['sisventas/productos/py1/nombre','sv_chat_roles/py/rol','sv_usuarios/userpy/rol'])await assertFails(set(ref(db,path),'admin'));
});
const list={nombre:'Viaje',productos:{py1:2},actualizadoEn:Date.now()};
test('compra real conserva cantidad solicitada y valida moneda, costo y pertenencia',async()=>{
 const value={...list,comprasFinales:{py1:{cantidad:1,precioUnitario:400,moneda:'USD',proveedor:'Tienda'}}};
 const path='sv_listas_paraguay/py/compra-real';
 await assertSucceeds(set(ref(db,path),value));
 const stored=(await get(ref(db,path))).val();assert.equal(stored.productos.py1,2);assert.equal(stored.comprasFinales.py1.cantidad,1);
 for(const patch of [{cantidad:-1},{cantidad:1.5},{precioUnitario:-1},{moneda:'BTC'},{extra:true}])await assertFails(set(ref(db,path),{...value,comprasFinales:{py1:{...value.comprasFinales.py1,...patch}}}));
 await assertFails(set(ref(db,path),{...value,comprasFinales:{local1:value.comprasFinales.py1}}));
});
test('guarda y recupera su lista; otra cuenta no puede leerla ni modificarla',async()=>{
  await assertSucceeds(set(ref(db,'sv_listas_paraguay/py/lista1'),list));
  assert.equal((await assertSucceeds(get(ref(db,'sv_listas_paraguay/py/lista1')))).val().productos.py1,2);
  const other=env.authenticatedContext('otro').database();
  await assertFails(get(ref(other,'sv_listas_paraguay/py')));
  await assertFails(set(ref(other,'sv_listas_paraguay/py/lista1'),list));
  await assertSucceeds(get(ref(env.authenticatedContext('admin').database(),'sv_listas_paraguay/py')));
});
test('rechaza productos ajenos, cantidades inválidas, campos extra y usuarios inactivos',async()=>{
  for(const productos of [{local1:1},{py1:0},{py1:1.5},{py1:10000}])await assertFails(set(ref(db,'sv_listas_paraguay/py/invalida'),{...list,productos}));
  await assertFails(set(ref(db,'sv_listas_paraguay/py/invalida'),{...list,rol:'admin'}));
  await assertFails(get(query(ref(env.authenticatedContext('baja').database(),'sisventas/productos'),orderByChild('categoria'),equalTo('COMPRAS PARAGUAY'))));
  await assertSucceeds(get(ref(env.authenticatedContext('admin').database(),'sisventas')));
});

test('roles existentes conservan lectura y escritura comercial',async()=>{
 for(const rol of ['admin','administrativo','vendedor','tecnico','tecnico_vendedor']){
  const other=env.authenticatedContext(rol).database();
  await assertSucceeds(get(ref(other,'sisventas')));
  await assertSucceeds(set(ref(other,'sisventas/compatibilidad/'+rol),true));
 }
});

test('admin crea listas propias y edita las de Paraguay sin habilitar otros roles',async()=>{
 const admin=env.authenticatedContext('admin').database();
 await assertSucceeds(set(ref(admin,'sv_listas_paraguay/admin/propia'),list));
 await assertSucceeds(set(ref(admin,'sv_listas_paraguay/py/lista1'),{...list,nombre:'Editada por admin',productos:{py1:3}}));
 assert.equal((await get(ref(db,'sv_listas_paraguay/py/lista1'))).val().productos.py1,3);
 await assertFails(set(ref(admin,'sv_listas_paraguay/py/invalida'),{...list,productos:{local1:1}}));
 for(const rol of ['administrativo','vendedor','tecnico','tecnico_vendedor','baja','otro']){
   await assertFails(set(ref(env.authenticatedContext(rol).database(),'sv_listas_paraguay/py/lista1'),list));
 }
});
test('permite elegir proveedor antes de comprar y rechaza compra incompleta',async()=>{
 const path='sv_listas_paraguay/py/proveedor-pendiente';
 const value={...list,comprasFinales:{py1:{moneda:'USD',proveedor:'Flytec Paraguay'}}};
 await assertSucceeds(set(ref(db,path),value));
 for(const partial of [{cantidad:1},{precioUnitario:25}])await assertFails(set(ref(db,path),{...value,comprasFinales:{py1:{...value.comprasFinales.py1,...partial}}}));
});

 test('estados de revisión: pedido sin precio, comprado exige cantidad y precio final',async()=>{
 const path='sv_listas_paraguay/py/estados';
 const row={moneda:'USD',proveedor:'Tienda',estado:'pedido'};
 await assertSucceeds(set(ref(db,path),{...list,comprasFinales:{py1:row}}));
 await assertFails(set(ref(db,path),{...list,comprasFinales:{py1:{...row,estado:'comprado'}}}));
 await assertFails(set(ref(db,path),{...list,comprasFinales:{py1:{...row,estado:'otro'}}}));
 await assertSucceeds(set(ref(db,path),{...list,comprasFinales:{py1:{...row,estado:'comprado',cantidad:1,precioUnitario:0}}}));
 });

 test('Distribuidora: catálogo y listas propios, chat general/directo sin módulos administrativos',async()=>{
 const dist=env.authenticatedContext('dist').database();
 await assertSucceeds(get(query(ref(dist,'sisventas/productos'),orderByChild('categoria'),equalTo('COMPRAS PARAGUAY'))));
 await assertSucceeds(get(query(ref(dist,'sv_usuarios'),orderByChild('uid'),equalTo('dist'))));
 await assertSucceeds(get(ref(dist,'sisventas/config/tipoCambio')));
 await assertSucceeds(set(ref(dist,'sv_listas_paraguay/dist/propia'),list));
 for(const path of ['sisventas','sisventas/ventas','sisventas/clientes','sisventas/productos','sv_usuarios','sv_permisos','sv_listas_paraguay/py','sv_chat/admin','sv_chat/tecnicos','sv_chat/directo_admin_otro'])await assertFails(get(ref(dist,path)));
 await assertFails(set(ref(dist,'sisventas/productos/py1/nombre'),'Cambiar'));
 await assertFails(set(ref(dist,'sv_chat_roles/dist/rol'),'admin'));
 await assertSucceeds(get(ref(dist,'sv_chat_directorio')));
 for(const path of ['sv_chat/general/test','sv_chat/directo_dist_admin/test','sv_chat_escribiendo/general/dist'])await assertSucceeds(set(ref(dist,path),{texto:'Prueba aislada'}));
 for(const path of ['sv_chat/admin/test','sv_chat/tecnicos/test','sv_chat/directo_admin_otro/test'])await assertFails(set(ref(dist,path),{texto:'Bloqueado'}));
 await assertFails(get(ref(env.authenticatedContext('distBaja').database(),'sv_chat/general')));
 });
 test('Distribuidora: permisos separados y escritura limitada a datos de su catálogo',async()=>{
 const d=env.authenticatedContext('dist').database(),a=env.authenticatedContext('admin').database();
 await assertFails(set(ref(d,'sisventas/productos/py1/nombre'),'Bloqueado'));
 await assertFails(set(ref(d,'sv_distribuidora_permisos/editar'),true));
 await assertSucceeds(set(ref(a,'sv_distribuidora_permisos'),{chat:true,detalle:true,editar:true,crear:true}));
 await assertSucceeds(set(ref(d,'sisventas/productos/py1/nombre'),'Editado'));
 await assertSucceeds(set(ref(d,'sisventas/productos/py1/codWeb'),'https://example.com/producto'));
 await assertFails(set(ref(d,'sisventas/productos/local1/nombre'),'Fuera de catálogo'));
 await assertFails(set(ref(d,'sisventas/productos/py1/categoria'),'OTRA'));
 await assertSucceeds(set(ref(d,'sisventas/productos/py1/stock'),100));
 await assertSucceeds(set(ref(d,'sisventas/productos/py1/compraARS'),150));
 await assertFails(set(ref(d,'sisventas/productos/py1/codigo'),'P-otro'));
 await assertFails(set(ref(d,'sisventas/productos/py1/esManoDeObra'),true));
 await assertFails(set(ref(d,'sisventas/productos/py1/compraARS'),-1));
 await assertFails(set(ref(d,'sisventas/productos/py1'),null));
 const p={nombre:'Creado',codigo:'D-1',categoria:'COMPRAS PARAGUAY',activo:true,estado:'Activo',ventaARS:0,iva:21,moneda:'ARS'};
 await assertSucceeds(set(ref(d,'sisventas/productos/creado'),{...p,stock:100,compraARS:10,proveedores:[{nombre:'Flytec',proveedorKey:'flytec'}]}));
 await assertSucceeds(set(ref(a,'sv_catalogo_proveedores'),{flytec:{nombre:'FLYTEC PARAGUAY',pais:'Paraguay',web:'https://example.com'}}));
 await assertSucceeds(get(ref(d,'sv_catalogo_proveedores')));
 await assertFails(get(ref(d,'sisventas/proveedores')));
 await assertFails(set(ref(d,'sv_catalogo_proveedores/flytec/nombre'),'Otro'));
 await assertSucceeds(set(ref(a,'sisventas/contadores/codigoProducto'),62999));
 await assertSucceeds(set(ref(d,'sisventas/contadores/codigoProducto'),63000));
 await assertFails(set(ref(d,'sisventas/contadores/codigoProducto'),70000));
 await assertFails(set(ref(d,'sisventas/productos/otra'),{...p,categoria:'OTRA'}));
 await assertFails(set(ref(d,'sisventas/productos/extra'),{...p,campoDesconocido:100}));
 await assertSucceeds(set(ref(a,'sv_distribuidora_permisos'),{chat:false,detalle:true,editar:false,crear:false}));
 await assertFails(set(ref(d,'sisventas/productos/py1/nombre'),'Revocado'));
 await assertFails(set(ref(d,'sv_chat/general/test2'),{texto:'Revocado'}));
 await assertFails(get(ref(d,'sv_chat_directorio')));
 });
