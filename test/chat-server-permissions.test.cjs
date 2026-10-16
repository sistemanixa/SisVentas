'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{createChatOperations}=require('../cotizador/chat-operations');
function fixture(){
 const data={sv_chat_roles:{tech:{rol:'tecnico',activo:true},other:{rol:'vendedor',activo:true},portal:{rol:'compras_paraguay',activo:true}},sv_chat_directorio:{tech:{nombre:'Persona ficticia'},other:{nombre:'Otra persona'}},sv_chat:{general:{m:{autorUid:'tech',autor:'Persona ficticia',rol:'tecnico',texto:'Inicial',leido:{other:true},reacciones:{other:{emoji:'❤️'}}}}}};
 const ref=path=>({get:async()=>({val:()=>path.split('/').reduce((o,k)=>o?.[k],data)??null}),transaction:async fn=>{assert.equal(fn(null),null);const parts=path.split('/'),last=parts.pop(),parent=parts.reduce((o,k)=>o[k],data),value=fn(parent[last]);if(value!==undefined)parent[last]=value;return {committed:value!==undefined,snapshot:{val:()=>value}};}});
 const service=createChatOperations({db:{ref},auth:{verifyIdToken:async uid=>{if(uid==='invalid')throw Error('Invalid');return {uid};}},enabled:true});return {data,service,req:uid=>({headers:{authorization:'Bearer '+uid}})};
}
test('chat rechaza sesión ausente, inválida, portal y conversación ajena sin depender de la UI',async()=>{
 const f=fixture();await assert.rejects(f.service.authorize({headers:{}},'general'),e=>e.statusCode===401);
 await assert.rejects(f.service.authorize(f.req('invalid'),'general'),e=>e.statusCode===401);
 await assert.rejects(f.service.authorize(f.req('portal'),'general'),e=>e.statusCode===403);
 await assert.rejects(f.service.authorize(f.req('tech'),'directo_other_stranger'),e=>e.statusCode===403);
 assert.equal((await f.service.authorize(f.req('tech'),'directo_other_tech')).uid,'tech');
});
test('chat respeta revocación y permiso de chat al autorizar cada solicitud',async()=>{
 const f=fixture();f.data.sv_chat_roles.tech.activo=false;await assert.rejects(f.service.authorize(f.req('tech'),'general'),e=>e.statusCode===403);
 f.data.sv_chat_roles.tech.activo=true;f.data.sv_permisos={tecnico:{acciones:{dashboard:{chat:false}}}};await assert.rejects(f.service.authorize(f.req('tech'),'general'),e=>e.statusCode===403);
});
test('edición tras lectura conserva todos los demás datos y no permite editar o borrar ajenos',async()=>{
 const f=fixture(),actor=await f.service.authorize(f.req('tech'),'general'),other=await f.service.authorize(f.req('other'),'general');
 await f.service.modify(actor,{key:'m',action:'editar',expectedText:'Inicial',texto:'Nuevo'});const m=f.data.sv_chat.general.m;
 assert.equal(m.texto,'Nuevo');assert.equal(m.leido.other,true);assert.equal(m.reacciones.other.emoji,'❤️');assert.equal(m.autorUid,'tech');
 await assert.rejects(f.service.modify(other,{key:'m',action:'editar',expectedText:'Nuevo',texto:'Ajeno'}),e=>e.statusCode===409);
 await assert.rejects(f.service.modify(actor,{key:'m',action:'eliminar'}),e=>e.statusCode===409);
 await assert.rejects(f.service.modify(actor,{key:'m',action:'editar',expectedText:'Inicial',texto:'Viejo'}),e=>e.statusCode===409);
});
test('reacción cambia únicamente al actor y retirar una reacción no elimina la de otra persona',async()=>{
 const f=fixture(),actor=await f.service.authorize(f.req('tech'),'general');await f.service.modify(actor,{key:'m',action:'reaccion',emoji:'👍',remove:false});
 assert.equal(f.data.sv_chat.general.m.reacciones.tech.nombre,'Persona ficticia');await f.service.modify(actor,{key:'m',action:'reaccion',emoji:'👍',remove:true});assert.equal(f.data.sv_chat.general.m.reacciones.tech,undefined);assert.equal(f.data.sv_chat.general.m.reacciones.other.emoji,'❤️');
});
