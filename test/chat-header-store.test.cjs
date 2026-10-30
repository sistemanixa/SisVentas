'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{createChatHeaderStore}=require('../cotizador/chat-header-store');
test('protected edit uses one conditional atomic patch, not a full channel or financial lock',async()=>{
 const requests=[],store=createChatHeaderStore({databaseURL:'https://example.firebaseio.com',accessToken:async()=>'fixture-token',fetchImpl:async(url,options)=>{requests.push({url:new URL(url),options});return {ok:true,body:{cancel:async()=>{}}};}});
 const before={texto:'Original',editadoEn:10,leidoNonce:'read-2',leido:{other:true},audioUrl:'attachment',reacciones:{other:{emoji:'👍'}}};
 await store.commit({uid:'u',channel:'general',claims:{svAccessVersion:'v'}},{key:'m',action:'editar'},before,{...before,texto:'Nuevo',editadoEn:11,editadoPorUid:'u'},false);
 assert.equal(requests.length,1);const {url,options}=requests[0];assert.equal(options.method,'PATCH');const patch=JSON.parse(options.body);
 assert.deepEqual(patch,{'sv_chat/general/m/texto':'Nuevo','sv_chat/general/m/editadoEn':11,'sv_chat/general/m/editadoPorUid':'u','sv_chat_headers/general/m/texto':'Nuevo','sv_chat_headers/general/m/editadoEn':11});
 const actor=JSON.parse(url.searchParams.get('auth_variable_override'));assert.equal(actor.uid,'u');assert.equal(actor.token.svChatExpectedRead,'read-2');assert.equal(actor.token.svChatExpectedEdit,10);assert.equal(actor.token.svAccessVersion,'v');assert.equal(actor.token.svLaborService,undefined);
});
test('failed commit is reported; it never retries with an unconditional Admin SDK write',async()=>{
 let calls=0;const store=createChatHeaderStore({databaseURL:'https://example.firebaseio.com',accessToken:async()=>'fixture',fetchImpl:async()=>{calls++;return {ok:false,status:403,body:{cancel:async()=>{}}};}});
 await assert.rejects(store.commit({uid:'u',channel:'general'},{key:'m',action:'editar'},{texto:'a'},{texto:'b',editadoEn:1,editadoPorUid:'u'},false),e=>e.statusCode===409);assert.equal(calls,1);
});
