'use strict';
const {test,before,beforeEach,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,'127.0.0.1:9019','Sólo emulador dedicado');
const dep=require('node:module').createRequire(path.join(process.env.SV_SECURITY_TOOLS,'package.json'));
const {initializeTestEnvironment,assertSucceeds,assertFails}=dep('@firebase/rules-unit-testing'),{ref,get,set,update}=dep('firebase/database');
const M=require('../js/core/provider-writes'),Rules=require('../scripts/lib/provider-projection-rules.cjs');
const input=JSON.parse(fs.readFileSync(process.env.SV_PROVIDER_RULES_FILE,'utf8')),candidate=Rules.build(input);let env;
const db=uid=>env.authenticatedContext(uid).database(),row={nombre:'Ficticio',web:'https://example.com',activo:true,usuario:'privado',password:'ficticia'};
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-provider-projection',database:{host:'127.0.0.1',port:9019,rules:JSON.stringify(candidate)}});});
beforeEach(async()=>{await env.clearDatabase();await env.withSecurityRulesDisabled(c=>set(ref(c.database()),{sv_chat_roles:{admin:{activo:true,rol:'admin'},delegate:{activo:true,rol:'administrativo'},sales:{activo:true,rol:'vendedor'},tech:{activo:true,rol:'tecnico'},dist:{activo:true,rol:'distribuidora'},revoked:{activo:false,rol:'admin'}},sv_distribuidora_permisos:{editar:true},sisventas:{proveedores:{p:row}},sv_catalogo_proveedores:{p:{nombre:row.nombre,web:row.web,activo:true}}}));});
after(async()=>{await env?.cleanup();});
for(const uid of ['admin','delegate'])test(uid+' creates, edits, batches and deletes paired data atomically',async()=>{
 const client=db(uid);await assertSucceeds(update(ref(client),M.plan([{fbKey:'p',changes:{nombre:'Nombre nuevo',usuario:'nuevo privado'}},{fbKey:'q',changes:{nombre:'Segundo',base:true}}])));
 assert.equal((await get(ref(db('admin'),'sisventas/proveedores/p/nombre'))).val(),'Nombre nuevo');
 const publicRows=(await get(ref(db('dist'),'sv_catalogo_proveedores'))).val();assert.equal(publicRows.p.nombre,'Nombre nuevo');assert.equal(publicRows.p.usuario,undefined);
 await assertSucceeds(update(ref(client),M.plan([{fbKey:'p',remove:true}])));assert.equal((await get(ref(db('dist'),'sv_catalogo_proveedores/p'))).exists(),false);
});
test('legacy writes cannot desynchronize public fields, including deletion; private access metadata remains writable',async()=>{
 const client=db('admin');await assertFails(update(ref(client,'sisventas/proveedores/p'),{nombre:'No confirmado'}));await assertFails(set(ref(client,'sisventas/proveedores/p'),null));
 await assertSucceeds(update(ref(client,'sisventas/proveedores/p'),{conexionAutomatica:{estado:'verificado'}}));
 assert.equal((await get(ref(client,'sisventas/proveedores/p/nombre'))).val(),row.nombre);
});
test('public-only tampering, leaked credentials and stale mirror snapshots are rejected',async()=>{
 const client=db('admin');await assertFails(set(ref(client,'sv_catalogo_proveedores/p/nombre'),'Falso'));await assertFails(set(ref(client,'sv_catalogo_proveedores/p/password'),'ficticia'));
 await assertFails(set(ref(client,'sv_catalogo_proveedores'),{p:{nombre:'Antiguo'}}));
 const patch=M.plan([{fbKey:'p',changes:{nombre:'Confirmado'}}]);patch['sv_catalogo_proveedores/p/nombre']='Distinto';await assertFails(update(ref(client),patch));
});
for(const uid of ['sales','tech','dist','revoked'])test(uid+' receives no new write authority',async()=>assertFails(update(ref(db(uid)),M.plan([{fbKey:'p',changes:{nombre:'No autorizado'}}]))));
test('permissions revoked before submission reject both halves without financial writes',async()=>{
 await env.withSecurityRulesDisabled(c=>set(ref(c.database(),'sv_permisos/administrativo'),{indiceVersion:2,indiceModulos:{proveedores:false},acciones:{proveedores:{editar:false}}}));
 await assertFails(update(ref(db('delegate')),M.plan([{fbKey:'p',changes:{nombre:'No autorizado'}}])));
 assert.equal((await get(ref(db('admin'),'sisventas/proveedores/p/nombre'))).val(),row.nombre);
});
test('independent concurrent field edits preserve both private/public results',async()=>{
 await Promise.all([update(ref(db('admin')),M.plan([{fbKey:'p',changes:{nombre:'Concurrente'}}])),update(ref(db('delegate')),M.plan([{fbKey:'p',changes:{web:'https://example.org'}}]))]);
 const a=(await get(ref(db('admin'),'sisventas/proveedores/p'))).val(),b=(await get(ref(db('dist'),'sv_catalogo_proveedores/p'))).val();assert.equal(a.nombre,b.nombre);assert.equal(a.web,b.web);assert.equal(a.nombre,'Concurrente');assert.equal(a.web,'https://example.org');
});
