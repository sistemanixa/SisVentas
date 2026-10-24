(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SVDashboardAccountSource=api;
})(typeof window==='object'?window:null,function(){
  'use strict';
  var fields=['authenticated','allowed','foreground','active','auth','authUid','uid','role','revision','permissionSignature','epoch','dataEpoch','view','viewUid','viewRole','viewProfile','employeeId','page','card','history','body','route','hash','db','onValue','ref','moduleAccess','accountAccess','ownEmployee','foregroundSession'];
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
      !value.auth||!key(value.uid)||value.uid.length>128||value.auth.uid!==value.uid||value.authUid!==value.uid||typeof value.role!=='string'||!value.role||
      !Number.isSafeInteger(value.revision)||value.revision<0||typeof value.permissionSignature!=='string'||
      !Number.isSafeInteger(value.epoch)||value.epoch<0||!Number.isSafeInteger(value.dataEpoch)||value.dataEpoch<0||!(value.view===null||typeof value.view==='object')||
      typeof value.viewProfile!=='string'||!key(employeeId)||value.employeeId!==employeeId||!value.page||
      value.page.isConnected===false||value.route!=='dashboard'||typeof value.hash!=='string'||!value.db||
      typeof value.onValue!=='function'||typeof value.ref!=='function'||typeof value.moduleAccess!=='function'||typeof value.accountAccess!=='function'||typeof value.ownEmployee!=='function')return null;
    var result={};fields.forEach(function(field){result[field]=value[field];});return Object.freeze(result);
  }
  function same(first,second){return !!first&&!!second&&fields.every(function(field){return first[field]===second[field];});}
  function create(options){
    if(!options||typeof options.capture!=='function')throw Error('No se pudo preparar la lectura de tu cuenta.');
    var current=null,serial=0;
    function capture(employeeId){try{return select(options.capture(employeeId),employeeId);}catch(_){return null;}}
    function valid(entry){return !!entry&&entry.active&&current===entry&&same(entry.scope,capture(entry.employeeId));}
    function view(entry){return entry?Object.freeze({status:entry.status,data:entry.data,employeeId:entry.employeeId,serial:entry.serial,valid:function(){return valid(entry);}}):null;}
    function close(entry){if(!entry.closed&&typeof entry.unsubscribe==='function'){entry.closed=true;try{entry.unsubscribe();}catch(_){}}}
    function notify(entry){
      if(typeof options.changed!=='function')return;
      try{options.changed(view(entry));}catch(_){
        if(current!==entry||!entry.active||entry.status==='error')return;
        entry.status='error';entry.data=null;close(entry);
        try{options.changed(view(entry));}catch(_){}
      }
    }
    function invalidate(silent){
      var entry=current;if(!entry||!entry.active&&entry.status==='paused')return;
      entry.active=false;entry.status='paused';entry.data=null;close(entry);if(silent!==true)notify(entry);
    }
    function peek(){if(current&&current.active&&!valid(current))invalidate();return view(current);}
    function ensure(employeeId,explicit){
      var scope=capture(employeeId);
      if(!scope){invalidate();return peek();}
      if(current&&valid(current))return view(current);
      if(current){var previous=current;invalidate();if(explicit!==true)return view(current);if(current!==previous)return ensure(employeeId,true);}
      var entry={active:true,scope:scope,employeeId:employeeId,serial:++serial,status:'loading',data:null,unsubscribe:null,closed:false};
      current=entry;notify(entry);
      function fresh(){if(valid(entry))return true;if(current===entry)invalidate(true);return false;}
      function failure(){if(!fresh()||entry.status==='error')return;entry.status='error';entry.data=null;close(entry);notify(entry);}
      // Register the attempt before SDK code: reentrant renders share it. No
      // timers or GETs supplement this live source, even after an empty result.
      try{
        if(!fresh()||entry.status==='error')return view(entry);
        var reference=scope.ref(scope.db,'sisventas/ctaemp/'+employeeId);
        if(!fresh())return view(entry);
        entry.unsubscribe=scope.onValue(reference,function(snapshot){
          if(!fresh()||entry.status==='error')return;
          var data;try{data=snapshot.val();if(!fresh())return;if(data!==null&&typeof data!=='object')throw Error('Snapshot inválido');}catch(_){failure();return;}
          entry.data=data;entry.status='ready';notify(entry);
        },failure);
        if(!entry.active||entry.status==='error')close(entry);
      }catch(_){failure();}
      return view(entry);
    }
    function retry(employeeId){
      var entry=current;
      if(entry&&valid(entry)&&entry.status!=='error')return view(entry);
      if(entry&&entry.status==='error')invalidate();
      return ensure(employeeId,true);
    }
    return Object.freeze({ensure:ensure,retry:retry,peek:peek,invalidate:invalidate,matches:function(employeeId){return !!current&&same(current.scope,capture(employeeId));}});
  }
  return Object.freeze({create:create});
});
