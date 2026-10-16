'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{load}=require('./helpers/app-functions.cjs');
test('adjuntos históricos no convierten protocolos activos en enlaces y no se modifica el mensaje guardado',()=>{
 const c=load({escapeHTML:x=>String(x).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;')},['chatMsgContenido']);
 for(const url of ['javascript:alert(1)','JaVaScRiPt:alert(1)','data:text/html,<script>alert(1)</script>','file:///private','https://example.test/\nmalformado'])for(const field of ['archivoUrl','fotoUrl','audioUrl']){
  const message={[field]:url},before=JSON.stringify(message),html=c.chatMsgContenido(message);assert.doesNotMatch(html,/<a |<img |<audio /);assert.match(html,/Adjunto no disponible/);assert.equal(JSON.stringify(message),before);
 }
 const html=c.chatMsgContenido({archivoUrl:'https://example.test/file.pdf',archivoNombre:'Documento'});assert.match(html,/href="https:\/\/example.test\/file.pdf"/);assert.match(html,/noopener noreferrer/);
});

test('la UI usa UID para mensajes nuevos aunque cambie el nombre y no confía en nombres coincidentes',()=>{
 const c=load({window:{fbAuth:{currentUser:{uid:'own'}}},_chatUsuarioKey:x=>x},['chatMensajeEditable','chatMensajeModificable']);
 assert.equal(c.chatMensajeEditable({autorUid:'other',autor:'Mismo nombre'},'Mismo nombre'),false);
 assert.equal(c.chatMensajeEditable({autorUid:'own',autor:'Nombre anterior'},'Nombre nuevo'),true);
 assert.equal(c.chatMensajeModificable({autorUid:'own',autor:'Nombre anterior',leido:{own:true}},'Nombre nuevo'),true);
});
