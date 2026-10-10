const {test,after}=require('node:test'),assert=require('node:assert/strict'),dep=require('module').createRequire('C:/SisVentas/tmp/firebase-security-tools/package.json');
const {initializeTestEnvironment,assertSucceeds,assertFails}=dep('@firebase/rules-unit-testing'),{ref,set,get}=dep('firebase/database');let env;after(async()=>env?.cleanup());
test('Admin guarda ofertas; público lee; solicitud conserva el precio descontado',async()=>{
 env=await initializeTestEnvironment({projectId:'demo-catalog-promotions',database:{host:'127.0.0.1',port:9005,rules:JSON.stringify({rules:{...require('../scripts/catalog-request-rules.cjs').catalogRequestRules(),sv_catalogo_ofertas:require('../scripts/catalog-promotions-rules.cjs')}})}});
 await env.withSecurityRulesDisabled(c=>set(ref(c.database(),'sv_chat_roles'),{admin:{rol:'admin',activo:true},dist:{rol:'distribuidora',activo:true}}));
 const admin=env.authenticatedContext('admin').database(),pub=env.unauthenticatedContext().database(),dist=env.authenticatedContext('dist').database(),offer={codigo:'PRUEBA',activa:true,inicio:Date.now()-1000,fin:Date.now()+60000,porcentaje:15,alcance:'productos',productos:['a']};
 await assertSucceeds(set(ref(admin,'sv_catalogo_ofertas/PRUEBA'),offer));
 assert.equal((await assertSucceeds(get(ref(pub,'sv_catalogo_ofertas/PRUEBA')))).val().porcentaje,15);
 await assertFails(set(ref(pub,'sv_catalogo_ofertas/PRUEBA'),offer));await assertFails(set(ref(dist,'sv_catalogo_ofertas/PRUEBA'),offer));
 for(const invalid of [{...offer,porcentaje:101},{...offer,fin:offer.inicio},{...offer,activa:'true'}])await assertFails(set(ref(admin,'sv_catalogo_ofertas/PRUEBA'),invalid));
 const items=require('../js/catalog-promotions').quote([{id:'a',nombre:'Prueba',precioUSD:100,cantidad:2}],{offer},'PRUEBA');
 const id='abcd1234-abcd-1234-abcd-123456789012',request={lista:'Prueba',nombre:'Cliente de prueba',telefono:'123',email:'',creadaEn:Date.now(),contenido:JSON.stringify(items)};
 await assertSucceeds(set(ref(pub,'sv_catalogo_solicitudes/'+id),request));const saved=(await get(ref(admin,'sv_catalogo_solicitudes/'+id))).val();assert.equal(JSON.parse(saved.contenido)[0].precioUSD,85);
 await assertSucceeds(set(ref(admin,'sv_catalogo_ofertas/PRUEBA'),{...offer,porcentaje:20}));assert.equal(JSON.parse((await get(ref(admin,'sv_catalogo_solicitudes/'+id))).val().contenido)[0].precioUSD,85);
});
