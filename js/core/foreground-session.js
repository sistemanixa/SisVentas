(function(root,factory){
 'use strict';
 const create=factory();
 if(typeof module==='object'&&module.exports)module.exports={create};
 if(root?.document&&!root.SVForegroundSession)root.SVForegroundSession=create(root);
})(typeof window==='object'?window:null,function(){
 'use strict';
 return function create(root){
  const document=root.document,waiting=new Set();
  let frozen=false,pageHidden=false,sessionStopped=false,lastVisible=null,lastDatabase=null,lastMode='',holds=0,holdGeneration=0;
  function isVisible(){return !frozen&&!pageHidden&&document.hidden!==true&&!['hidden','prerender'].includes(document.visibilityState);}
  function abortError(){const error=new Error('La espera de primer plano fue cancelada.');error.name='AbortError';return error;}
  function syncDatabase(){
   const database=root.fbDB;if(!database)return false;
   const mode=isVisible()&&!sessionStopped&&!!root.fbAuth?.currentUser?'online':'offline';
   // Una escritura ya iniciada puede terminar con su transporte actual. El
   // hold nunca abre red oculta y logout siempre vuelve a cerrar la sesión.
   if(mode==='offline'&&holds>0&&!sessionStopped)return false;
   const action=mode==='online'?root.fbGoOnline:root.fbGoOffline;
   if(typeof action!=='function')return false;
   if(lastDatabase===database&&lastMode===mode)return true;
   try{action(database);lastDatabase=database;lastMode=mode;return true;}
   catch(_){return false;}
  }
  function holdDatabase(){
   const generation=holdGeneration;let active=true;holds++;
   return function release(){if(!active)return;active=false;if(generation!==holdGeneration)return;holds--;syncDatabase();};
  }
  function finish(item,error){
   if(!waiting.delete(item))return;
   item.signal?.removeEventListener('abort',item.abort);
   if(error)item.reject(error);else item.resolve();
  }
  function waitVisible({signal}={}){
   if(signal?.aborted)return Promise.reject(abortError());
   // Una espera nueva representa un intento vigente del llamador. Los intentos
   // anteriores se cancelan en session-ended y mediante su AbortController.
   sessionStopped=false;
   if(isVisible()){syncDatabase();return Promise.resolve();}
   return new Promise((resolve,reject)=>{
    const item={resolve,reject,signal,abort:null};item.abort=()=>finish(item,abortError());
    waiting.add(item);signal?.addEventListener('abort',item.abort,{once:true});
    if(signal?.aborted)item.abort();
   });
  }
  function changed(){
   const visible=isVisible();syncDatabase();
   if(lastVisible!==null&&lastVisible!==visible)document.dispatchEvent(new (root.Event||Event)('sisventas:foreground-'+(visible?'restored':'paused')));
   lastVisible=visible;
   if(visible)for(const item of [...waiting])finish(item,item.signal?.aborted?abortError():null);
  }
  document.addEventListener('visibilitychange',changed);
  document.addEventListener('freeze',()=>{frozen=true;changed();});
  document.addEventListener('resume',()=>{frozen=false;changed();});
  root.addEventListener('pagehide',()=>{pageHidden=true;changed();});
  root.addEventListener('pageshow',()=>{pageHidden=false;frozen=false;changed();});
  document.addEventListener('firebase-ready',changed);
  document.addEventListener('sisventas:session-ready',()=>{sessionStopped=false;changed();});
  document.addEventListener('sisventas:session-ended',()=>{
   sessionStopped=true;holdGeneration++;holds=0;for(const item of [...waiting])finish(item,abortError());syncDatabase();
  });
  changed();
  return {isVisible,waitVisible,syncDatabase,holdDatabase};
 };
});
