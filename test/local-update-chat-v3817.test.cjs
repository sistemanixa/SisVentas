const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/app.v3.8.17.js','utf8');
function extract(name){const start=source.indexOf('function '+name+'(');return source.slice(start,source.indexOf('\n}',start)+2);}
for(const [label,complete,consult,expected] of [['consulta completa',true,true,'reload'],['edición abierta',true,false,'notice'],['publicación incompleta',false,true,'retry']])test('actualización local: '+label,async()=>{
 const actions=[];const ctx={Date,APP_CONFIG:{VERSION:'v3.8.16-firebase'},location:{hostname:'127.0.0.1'},window:{fbDB:{},fbGet:()=>{throw Error('No debe modificar versión remota desde local');},fbSet:()=>{throw Error('No debe escribir');}},document:{querySelector:s=>s.startsWith('#page-dashboard')?consult:null},_actualizandoAhora:false,_verificacionVersionEnCurso:false,_versionNuevaDisponible:'',_reintentoVersionTimer:null,_versionMasNueva:()=>true,_verificarVersionPublicadaCompleta:async()=>complete,clearTimeout(){},setTimeout(){actions.push('retry');},actualizarAutomaticamente(){actions.push('reload');},mostrarAvisoVersionNueva(){actions.push('notice');}};
 vm.createContext(ctx);vm.runInContext(extract('_dispararActualizacion'),ctx);ctx._dispararActualizacion('v3.8.17-firebase');await new Promise(setImmediate);assert.deepEqual(actions,[expected]);
});
test('identidad del chat corresponde al UID y no al perfil simulado',()=>{
 const c={window:{_chatDirectorio:{u1:{nombre:'Administrador real'}},_impersonacionOriginal:{user:'Administrador real'}},currentUserUid:'u1',currentUser:'Yago'};vm.createContext(c);vm.runInContext(extract('chatNombreSesion'),c);assert.equal(c.chatNombreSesion(),'Administrador real');delete c.window._chatDirectorio.u1;assert.equal(c.chatNombreSesion(),'Administrador real');
});
