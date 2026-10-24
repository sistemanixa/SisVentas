(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SVDashboardAccountRead=api;
})(typeof window==='object'?window:null,function(){
  'use strict';
  var fields=['authenticated','allowed','foreground','active','auth','uid','role','revision','permissionSignature','epoch','view','viewProfile','employeeId','page','route','hash','db','get','ref'];
  function cancelled(){var error=new Error('La lectura de tu cuenta fue retirada.');error.name='AbortError';error.code='SV_DASHBOARD_ACCOUNT_CANCELLED';return error;}
  function utf8Length(value){
    var bytes=0;
    for(var i=0;i<value.length;i++){
      var code=value.charCodeAt(i);
      if(code<=0x7f)bytes++;
      else if(code<=0x7ff)bytes+=2;
      else if(code>=0xd800&&code<=0xdbff){
        var low=value.charCodeAt(++i);
        if(!(low>=0xdc00&&low<=0xdfff))return Infinity;
        bytes+=4;
      }else if(code>=0xdc00&&code<=0xdfff)return Infinity;
      else bytes+=3;
    }
    return bytes;
  }
  function key(value){return typeof value==='string'&&value.length>0&&value.length<=768&&utf8Length(value)<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(value);}
  function select(value,employeeId){
    if(!value||value.authenticated!==true||value.allowed!==true||value.foreground!==true||value.active!==true||
      !value.auth||!key(value.uid)||value.uid.length>128||value.auth.uid!==value.uid||typeof value.role!=='string'||!value.role||
      !Number.isSafeInteger(value.revision)||value.revision<0||typeof value.permissionSignature!=='string'||
      !Number.isSafeInteger(value.epoch)||value.epoch<0||!(value.view===null||typeof value.view==='object')||
      typeof value.viewProfile!=='string'||!key(employeeId)||value.employeeId!==employeeId||!value.page||
      value.page.isConnected===false||value.route!=='dashboard'||typeof value.hash!=='string'||!value.db||
      typeof value.get!=='function'||typeof value.ref!=='function')return null;
    var result={};fields.forEach(function(field){result[field]=value[field];});return Object.freeze(result);
  }
  function same(first,second){return !!first&&!!second&&fields.every(function(field){return first[field]===second[field];});}
  function create(options){
    if(!options||typeof options.capture!=='function')throw Error('No se pudo preparar la lectura de tu cuenta.');
    var pending=null;
    function capture(employeeId){try{return select(options.capture(employeeId),employeeId);}catch(_){return null;}}
    function finish(entry,error,snapshot){
      if(!entry.active)return;
      entry.active=false;if(pending===entry)pending=null;
      // Retire before notifying callers. A render after this ACK/error must
      // start a fresh read, even from a Promise callback or synchronous retry.
      if(error)entry.reject(error);else entry.resolve(snapshot);
    }
    function invalidate(){if(pending)finish(pending,cancelled());}
    function valid(entry){return entry.active&&pending===entry&&same(entry.scope,capture(entry.employeeId));}
    function get(employeeId){
      var scope=capture(employeeId);
      if(!scope){invalidate();return Promise.reject(cancelled());}
      if(pending&&pending.active&&same(pending.scope,scope))return pending.promise;
      invalidate();
      var entry={active:true,scope:scope,employeeId:employeeId,promise:null,resolve:null,reject:null};
      entry.promise=new Promise(function(resolve,reject){entry.resolve=resolve;entry.reject=reject;});
      pending=entry;
      // Establish the shared Promise before invoking SDK code: a reentrant
      // render joins it. No read is issued when the context retires meanwhile.
      Promise.resolve().then(function(){
        if(!valid(entry))throw cancelled();
        var reference=scope.ref(scope.db,'sisventas/ctaemp/'+employeeId);
        if(!valid(entry))throw cancelled();
        return scope.get(reference);
      }).then(function(snapshot){
        if(!valid(entry)){finish(entry,cancelled());return;}
        // The caller retains its existing generation fence before snap.val().
        // This module never decodes, clones or retains a ready snapshot.
        finish(entry,null,snapshot);
      },function(error){finish(entry,valid(entry)?error:cancelled());});
      return entry.promise;
    }
    return Object.freeze({get:get,invalidate:invalidate});
  }
  return Object.freeze({create:create});
});
