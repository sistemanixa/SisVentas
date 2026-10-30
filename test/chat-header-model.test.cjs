'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),models=require('../js/core/chat-header-model');
test('chat preserves every unread marker without copying historical attachments',()=>{
 const message={autor:'Persona',autorUid:'u',rol:'tecnico',ts:1,texto:'Texto',fotoUrl:'data:image/jpeg;base64,'+'x'.repeat(2000000),foto:{data:'secret'},audioUrl:'data:audio/x',leido:{u:true,v:true},reacciones:{w:{emoji:'👍'}},replyTexto:'cita'};
 const before=structuredClone(message),summary=models.chat(message);
 assert.deepEqual(summary,{autor:'Persona',autorUid:'u',rol:'tecnico',ts:1,texto:'Texto',fotoUrl:true,audioUrl:true,leido:{u:true,v:true}});
 assert.deepEqual(message,before);assert.ok(JSON.stringify(summary).length<250);
});
