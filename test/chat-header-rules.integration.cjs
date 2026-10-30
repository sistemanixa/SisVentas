'use strict';
const {test,before,beforeEach,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,'127.0.0.1:9041','Sólo emulador dedicado');
const dep=require('node:module').createRequire(path.join(process.env.SV_SECURITY_TOOLS,'package.json'));
const {initializeTestEnvironment,assertSucceeds,assertFails}=dep('@firebase/rules-unit-testing'),{ref,get,set,update,query,orderByChild,limitToLast,endBefore}=dep('firebase/database');
const Model=require('../js/core/chat-header-model'),Rules=require('../scripts/lib/chat-header-rules.cjs');
const base=JSON.parse(fs.readFileSync(process.env.SV_CHAT_RULES_BASE,'utf8')),rules=require('../scripts/lib/sale-return-query-indexes.cjs').prepare(Rules.prepare(require('../scripts/lib/operational-summary-rules.cjs').prepare(base)));
let env;const client=(uid,claims={})=>env.authenticatedContext(uid,claims).database();
const message=()=>({autor:'Persona ficticia',autorUid:'tech',rol:'tecnico',canal:'general',ts:Date.now(),texto:'Inicial'});
const pair=(m,key='m')=>({['sv_chat/general/'+key]:m,['sv_chat_headers/general/'+key]:Model.chat(m)});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-chat-header-audit',database:{host:'127.0.0.1',port:9041,rules:JSON.stringify(rules)}});});
beforeEach(async()=>{await env.clearDatabase();await env.withSecurityRulesDisabled(ctx=>set(ref(ctx.database()),{sv_chat_roles:{tech:{rol:'tecnico',activo:true},other:{rol:'tecnico',activo:true},admin:{rol:'admin',activo:true},inactive:{rol:'tecnico',activo:false}},sv_chat_directorio:{tech:{nombre:'Persona ficticia',activo:true},other:{nombre:'Otra ficticia',activo:true},admin:{nombre:'Admin ficticio',activo:true}},sisventas:{ventas:{unchanged:{total:123}}}}));});
after(async()=>{await env?.cleanup();});
test('paired send is authorized, source-only and mismatched metadata are rejected',async()=>{
 const db=client('tech'),m=message();await assertFails(set(ref(db,'sv_chat/general/m'),m));
 await assertSucceeds(update(ref(db),pair(m)));const changed=pair({...m,texto:'Otro'},'n');changed['sv_chat_headers/general/n'].texto='Falso';await assertFails(update(ref(db),changed));
});
test('recipient cannot clear or forge metadata, author or unread markers',async()=>{
 const db=client('tech'),m=message();await update(ref(db),pair(m));const other=client('other');
 await assertFails(set(ref(other,'sv_chat_headers/general/m'),null));await assertFails(set(ref(other,'sv_chat_headers/general/m/texto'),'Falso'));
 await assertFails(update(ref(other),{'sv_chat/general/m/leido/tech':true,'sv_chat_headers/general/m/leido/tech':true}));
});
test('read acknowledgement is atomic and can coexist with somebody else reading',async()=>{
 const m=message();await update(ref(client('tech')),pair(m));const db=client('other');
 await assertFails(set(ref(db,'sv_chat/general/m/leido/other'),true));
 await assertSucceeds(update(ref(db),{'sv_chat/general/m/leido/other':true,'sv_chat_headers/general/m/leido/other':true,'sv_chat/general/m/leidoNonce':'read-1','sv_chat_headers/general/m/leidoNonce':'read-1'}));
 assert.equal((await get(ref(db,'sv_chat_headers/general/m/leido/other'))).val(),true);
});
test('clear requires admin permission and deletes both roots together',async()=>{
 await update(ref(client('tech')),pair(message()));const db=client('admin');
 await assertFails(set(ref(db,'sv_chat/general'),null));await assertFails(set(ref(db,'sv_chat_headers/general'),null));
 await assertFails(update(ref(client('tech')),{'sv_chat/general':null,'sv_chat_headers/general':null}));
 await assertSucceeds(update(ref(db),{'sv_chat/general':null,'sv_chat_headers/general':null}));
});
test('revocation, password reset and foreign direct channel stay closed',async()=>{
 for(const db of [client('inactive'),env.unauthenticatedContext().database()])await assertFails(get(ref(db,'sv_chat_headers/general')));
 await assertFails(get(ref(client('tech'),'sv_chat_headers/directo_admin_other')));
 await env.withSecurityRulesDisabled(ctx=>set(ref(ctx.database(),'sv_access_resets/tech'),{required:true,version:'new'}));
 await assertFails(get(ref(client('tech'),'sv_chat_headers/general')));await assertFails(update(ref(client('tech')),pair(message())));
});
test('protected edit preserves author, receipt and unrelated business records',async()=>{
 const m={...message(),leido:{other:true},reacciones:{other:{emoji:'👍',nombre:'Otra ficticia'}}};await env.withSecurityRulesDisabled(ctx=>update(ref(ctx.database()),pair(m)));
 const claims={svChatService:true,svChatAction:'editar',svChatExpectedText:'Inicial',svChatExpectedEdit:null,svChatLegacyOwner:false,svChatReadCount:1};
 const db=client('tech',claims),patch={'sv_chat/general/m/texto':'Editado','sv_chat/general/m/editadoEn':1,'sv_chat/general/m/editadoPorUid':'tech','sv_chat_headers/general/m/texto':'Editado','sv_chat_headers/general/m/editadoEn':1};
 await assertSucceeds(update(ref(db),patch));
 await assertFails(update(ref(db),patch));
 await env.withSecurityRulesDisabled(async ctx=>{const database=ctx.database(),record=(await get(ref(database,'sv_chat/general/m'))).val();assert.equal(record.autorUid,'tech');assert.equal(record.leido.other,true);assert.equal(record.reacciones.other.emoji,'👍');assert.equal((await get(ref(database,'sisventas/ventas/unchanged/total'))).val(),123);});
});
test('a new read acknowledgement invalidates an in-flight deletion',async()=>{
 const m=message();await update(ref(client('tech')),pair(m));
 const stale=client('tech',{svChatService:true,svChatAction:'eliminar',svChatExpectedText:'Inicial',svChatExpectedEdit:null,svChatExpectedRead:null});
 await update(ref(client('other')),{'sv_chat/general/m/leido/other':true,'sv_chat_headers/general/m/leido/other':true,'sv_chat/general/m/leidoNonce':'read-new','sv_chat_headers/general/m/leidoNonce':'read-new'});
 await assertFails(update(ref(stale),{'sv_chat/general/m/texto':'Mensaje eliminado','sv_chat/general/m/eliminado':true,'sv_chat/general/m/eliminadoEn':1,'sv_chat/general/m/eliminadoPorUid':'tech','sv_chat_headers/general/m/texto':'Mensaje eliminado','sv_chat_headers/general/m/eliminado':true}));
 assert.equal((await get(ref(client('tech'),'sv_chat/general/m/texto'))).val(),'Inicial');
});
test('unbounded message history is denied while bounded pages and an authorized single message work',async()=>{
 const db=client('tech');await update(ref(db),pair(message()));
 await assertFails(get(ref(db,'sv_chat/general')));await assertFails(get(query(ref(db,'sv_chat/general'),orderByChild('ts'),limitToLast(101))));
 await assertSucceeds(get(query(ref(db,'sv_chat/general'),orderByChild('ts'),limitToLast(75))));
 await assertSucceeds(get(query(ref(db,'sv_chat/general'),orderByChild('ts'),endBefore(Date.now()+1),limitToLast(75))));
 await assertSucceeds(get(ref(db,'sv_chat/general/m')));
});
