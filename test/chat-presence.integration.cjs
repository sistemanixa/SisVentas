const {test,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),dep=require('module').createRequire('C:/SisVentas/tmp/firebase-security-tools/package.json');const {initializeTestEnvironment,assertSucceeds,assertFails}=dep('@firebase/rules-unit-testing');const {ref,set,get,remove,serverTimestamp}=dep('firebase/database');let env;
after(async()=>env?.cleanup());
test('admin y Distribuidora comparten presencia sin habilitar datos privados',async()=>{
 env=await initializeTestEnvironment({projectId:'demo-chat-presence',database:{host:'127.0.0.1',port:9005,rules:fs.readFileSync('security/database.paraguay.rules.json','utf8')}});
 await env.withSecurityRulesDisabled(c=>set(ref(c.database()),{sv_chat_roles:{admin:{rol:'admin',activo:true},dist:{rol:'distribuidora',activo:true}},sv_chat_directorio:{admin:{nombre:'Admin'},dist:{nombre:'Yago'}},sv_distribuidora_permisos:{chat:true}}));
 const admin=env.authenticatedContext('admin').database(),dist=env.authenticatedContext('dist').database();const p=(uid,nombre,rol)=>({uid,nombre,rol,online:true,ultimaConexion:serverTimestamp()});
 await assertSucceeds(set(ref(admin,'sv_chat_presencia/admin/a'),p('admin','Admin','admin')));await assertSucceeds(set(ref(dist,'sv_chat_presencia/dist/a'),p('dist','Yago','distribuidora')));
 assert.equal(Object.keys((await assertSucceeds(get(ref(dist,'sv_chat_presencia')))).val()).length,2);assert.equal(Object.keys((await get(ref(admin,'sv_chat_presencia'))).val()).length,2);
 await assertFails(set(ref(dist,'sv_chat_presencia/admin/b'),p('admin','Admin','admin')));await assertFails(set(ref(dist,'sv_chat_presencia/dist/b'),{...p('dist','Yago','distribuidora'),email:'privado'}));await assertFails(get(ref(dist,'sisventas/presencia')));
 await assertSucceeds(remove(ref(dist,'sv_chat_presencia/dist/a')));assert.equal((await get(ref(admin,'sv_chat_presencia/dist'))).exists(),false);
 await assertSucceeds(set(ref(admin,'sv_distribuidora_permisos/chat'),false));await assertFails(get(ref(dist,'sv_chat_presencia')));await assertFails(set(ref(dist,'sv_chat_presencia/dist/a'),p('dist','Yago','distribuidora')));
});
