(function(root){
  'use strict';
  function bounded(task){
    if(root.SVSessionRecovery?.deadline)return root.SVSessionRecovery.deadline(task);
    let timer;return Promise.race([task,new Promise((_,reject)=>{timer=root.setTimeout(()=>reject(Object.assign(Error('La verificación de acceso demoró demasiado. Podés volver a intentar.'),{name:'TimeoutError'})),20000);})]).finally(()=>root.clearTimeout(timer));
  }
  root.SVServiceAuth={async headers(base,forceRefresh){
    const user=root.fbAuth?.currentUser,valid=root.svCapturarContextoOperacion?.();
    if(!user)throw Error('La sesión venció. Volvé a ingresar.');
    if(valid&&!valid())throw Error('La sesión cambió. Reintentá.');
    const token=await bounded(user.getIdToken(forceRefresh===true));
    if(root.fbAuth.currentUser!==user||valid&&!valid())throw Error('La sesión cambió. Reintentá.');
    if(!token)throw Error('No se pudo validar la sesión. Volvé a intentar.');
    return {...base,Authorization:'Bearer '+token};
  }};
})(window);
