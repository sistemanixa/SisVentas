const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
function context(){return load({window:{usuariosData:[{uid:'creator',nombre:'Creador',rol:'admin'},{uid:'recipient',nombre:'Destinatario',rol:'tecnico'}]},COMUNICADOS_LECTURAS:{x:{creator:{remitente:true},recipient:{usuario:'Destinatario',leidoEn:1},stale:{usuario:'Anterior'}}},currentUserUid:'creator',currentUserEmail:'',currentUser:'Creador',escapeHTML:x=>String(x??''),_comunicadoEditable:()=>false},['_comunicadoKey','_comunicadoRolNormalizado','_comunicadoAplicaUsuario','_comunicadoEsCreador','_comunicadoUsuariosEsperados','_comunicadoDestinoLabel','_comunicadoCardHTML']);}
test('conteo usa solo destinatarios, sin sumar remitente excluido ni lecturas antiguas',()=>{
 const c=context();const html=c._comunicadoCardHTML({fbKey:'x',destino:'todos',excluidos:{creator:true}});
 assert.match(html,/>1 \/ 1</);assert.match(html,/Participantes \(1\)/);assert.match(html,/>Privado</);assert.doesNotMatch(html,/>2 \/ 1</);
});
test('global sin exclusiones mantiene etiqueta y cuenta creador solo si participa',()=>{
 const c=context();const html=c._comunicadoCardHTML({fbKey:'x',destino:'todos',creadoPorUid:'creator'});
 assert.match(html,/>2 \/ 2</);assert.match(html,/>Global</);assert.match(html,/Creador · Creador/);
 assert.equal(c._comunicadoDestinoLabel({destino:'tecnico',excluidos:{}}),'Técnicos');
 assert.equal(c._comunicadoDestinoLabel({destino:'tecnico',excluidos:{creator:true}}),'Privado');
});
