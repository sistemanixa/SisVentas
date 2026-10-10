const {test,after}=require('node:test'),fs=require('fs'),dep=require('module').createRequire('C:/SisVentas/tmp/firebase-security-tools/package.json');
const {initializeTestEnvironment,assertSucceeds,assertFails}=dep('@firebase/rules-unit-testing'),{ref,set,get}=dep('firebase/database');let env;
after(async()=>env?.cleanup());
test('portal interno requiere autorización explícita y mantiene aislamiento de listas',async()=>{
 const rules=JSON.parse(fs.readFileSync('security/database.paraguay.rules.json'));
 Object.assign(rules.rules,require('../scripts/catalog-request-rules.cjs').catalogRequestRules());require('../scripts/distribuidora-menu-rules.cjs').apply(rules);
 env=await initializeTestEnvironment({projectId:'demo-dist-menu',database:{host:'127.0.0.1',port:9005,rules:JSON.stringify(rules)}});
 await env.withSecurityRulesDisabled(c=>set(ref(c.database(),'sv_chat_roles'),{seller:{activo:true,rol:'vendedor'}}));
 const db=env.authenticatedContext('seller').database();
 await assertFails(get(ref(db,'sv_catalogo_solicitudes')));await assertFails(get(ref(db,'sv_listas_paraguay/seller')));
 await env.withSecurityRulesDisabled(c=>set(ref(c.database(),'sv_permisos/vendedor/distribuidora'),true));
 await assertSucceeds(get(ref(db,'sv_catalogo_solicitudes')));await assertSucceeds(get(ref(db,'sv_listas_paraguay/seller')));
 await assertFails(get(ref(db,'sv_listas_paraguay/other')));
 await assertFails(set(ref(db,'sv_catalogo_solicitudes_atencion/missing'),{uid:'seller',fecha:1,lista:'bad',usuario:'Seller'}));
 await env.withSecurityRulesDisabled(c=>set(ref(c.database(),'sv_permisos/vendedor/distribuidora'),false));await assertFails(get(ref(db,'sv_catalogo_solicitudes')));
});
