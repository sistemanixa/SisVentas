(function(root,factory){
 'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(!root?.document)return;
 const monitor=api.create({active:()=>!!sessionUid&&root.fbAuth?.currentUser?.uid===sessionUid&&!root.document.hidden&&root.SVForegroundSession?.isVisible?.()!==false,online:()=>root.navigator.onLine!==false,probe:async()=>{
  const base=root.SISVENTAS_FUNCTIONS?.cotizadorProveedor;if(!base)throw Error('Servidor sin configurar');
  // API externa, sin sesión ni datos. El401 esperado acredita red real; nunca pasa por el caché local del SW.
  const response=await root.fetch(base+'/?sv_connection_probe=1',{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(5000)});return response.status;
 },changed:()=>root.fbMostrarEstadoConexion?.(),lost:()=>root.dispatchEvent(new Event('sisventas:connection-lost')),restored:()=>root.dispatchEvent(new Event('sisventas:connection-restored'))});
 let sessionUid='';
 function start(){if(!sessionUid||root.fbAuth?.currentUser?.uid!==sessionUid||!root.currentUserUid)return;monitor.check();}
 root.document.addEventListener('sisventas:session-ready',()=>{sessionUid=root.fbAuth?.currentUser?.uid||'';start();});
 // Auth puede conservar su usuario mientras se cierra o verifica el acceso.
 // Sólo una sesión de la aplicación confirmada habilita la sonda de red.
 root.document.addEventListener('sisventas:session-ended',()=>{sessionUid='';monitor.stop();});
 root.document.addEventListener('visibilitychange',()=>{if(!root.document.hidden)start();});
 root.addEventListener('offline',()=>monitor.offline());root.addEventListener('online',start);
 root.SVConnectionMonitor=monitor;
})(typeof window==='object'?window:null,function(){
 'use strict';
 function create({active=()=>true,online=()=>true,probe,changed=()=>{},lost=()=>{},restored=()=>{}}){
  let network='unknown',pending=null,generation=0,proof=0;const failed=new Set();
  function set(value){const recovering=['down','service'].includes(network)&&value==='up',disconnect=network!=='down'&&value==='down';network=value;if(disconnect)lost();changed();if(recovering)restored();}
  function offline(){proof++;set('down');}
  function check(){
   if(!active())return Promise.resolve();
   if(!online()){offline();return Promise.resolve();}if(pending)return pending;
   const epoch=generation,started=proof;
   pending=Promise.resolve().then(probe).then(status=>{if(epoch===generation&&started===proof)set(status>=500?'service':'up');},()=>{if(epoch===generation&&started===proof)set('down');}).finally(()=>{if(epoch===generation)pending=null;});return pending;
  }
  function success(domain){proof++;failed.delete(domain);set('up');}
  function failure(domain,error){failed.add(domain);changed();if(!error?.status&&network!=='down')check();else if(error?.status>=500)set('service');}
  function view(firebase){
   if(!online()||network==='down')return {label:'Sin conexión',title:'No se puede contactar al servidor. La información recibida se conserva.',connected:false};
   if(network==='service')return {label:'Servidor no disponible',title:'El servidor no respondió correctamente. Volvé a intentar desde Sincronizar ahora.',connected:false};
   if(failed.size)return {label:'Sincronización pendiente',title:'Pendiente de sincronizar: '+Array.from(failed).join(', ')+'. Usá Sincronizar ahora o volvé a abrir el módulo.',connected:false};
   if(network!=='up'||!firebase)return {label:'Reconectando',title:'Comprobando la conexión con el servidor.',connected:false};
   return {label:'Sincronizado',title:'Conexión con el servidor comprobada y Firebase conectado.',connected:true};
  }
  return {check,offline,success,failure,view,canSync:()=>online()&&!['down','service'].includes(network),stop(){generation++;proof++;pending=null;network='unknown';failed.clear();}};
 }
 return {create};
});
