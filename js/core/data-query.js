(function(window){
  'use strict';
  var SV=window.SisVentas=window.SisVentas||{};
  function iso(date){
    var d=new Date(date.getFullYear(),date.getMonth(),date.getDate());
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function range(cursor,view){
    var d=new Date(cursor||new Date()), start, end;
    if(view==='dia') start=end=new Date(d);
    else if(view==='semana'){
      start=new Date(d); start.setDate(start.getDate()-((start.getDay()+6)%7));
      end=new Date(start); end.setDate(end.getDate()+6);
    }else{
      start=new Date(d.getFullYear(),d.getMonth(),1);
      end=new Date(d.getFullYear(),d.getMonth()+1,0);
    }
    return {start:iso(start),end:iso(end)};
  }
  function toRows(value){
    return Object.entries(value||{}).map(function(entry){ return Object.assign({fbKey:entry[0]},entry[1]||{}); });
  }
  var sources=new Map();
  function retiredError(){var error=new Error('La lectura de agenda fue retirada. Volvé a abrirla para consultar.');error.code='SV_AGENDA_SOURCE_RETIRED';return error;}
  function actor(){return {uid:typeof currentUserUid==='undefined'?'':currentUserUid,role:typeof currentRole==='undefined'?'':currentRole,authenticated:typeof isAuthenticated!=='undefined'&&isAuthenticated===true};}
  function context(){
    var initialActor=actor(),doc=window.document,user=window.fbAuth&&window.fbAuth.currentUser,uid=initialActor.uid,role=initialActor.role;
    var revision=window.PERMISOS_ROLES&&window.PERMISOS_ROLES[role]&&window.PERMISOS_ROLES[role].indiceRevision,epoch=window._svOperacionesSesionEpoch||0;
    var view=window._impersonacionOriginal,profile=view&&view.usuarioFbKey,page=doc&&doc.querySelector('.page.active'),hash=window.location&&window.location.hash;
    var db=window.fbDB,ref=window.fbRef,onValue=window.fbOnValue,moduleAccess=window.permisoModulo,domainAccess=window.svPuedeLeerDominio;
    function valid(){
      try{var currentActor=actor();return currentActor.authenticated&&!!uid&&!!user&&user.uid===uid&&user===window.fbAuth.currentUser&&uid===currentActor.uid&&role===currentActor.role&&
        revision===(window.PERMISOS_ROLES&&window.PERMISOS_ROLES[role]&&window.PERMISOS_ROLES[role].indiceRevision)&&epoch===(window._svOperacionesSesionEpoch||0)&&view===window._impersonacionOriginal&&profile===(view&&view.usuarioFbKey)&&
        db===window.fbDB&&!!db&&ref===window.fbRef&&typeof ref==='function'&&onValue===window.fbOnValue&&typeof onValue==='function'&&
        moduleAccess===window.permisoModulo&&typeof moduleAccess==='function'&&moduleAccess('agenda')&&domainAccess===window.svPuedeLeerDominio&&typeof domainAccess==='function'&&domainAccess('agenda')&&
        page===doc.querySelector('.page.active')&&page&&page.id==='page-agenda'&&page.isConnected!==false&&page.classList.contains('active')&&hash===(window.location&&window.location.hash)&&
        doc.hidden!==true&&doc.visibilityState!=='hidden'&&doc.visibilityState!=='prerender'&&(!window.SVForegroundSession||window.SVForegroundSession.isVisible()!==false);
      }catch(_){return false;}
    }
    return {valid:valid,db:db,ref:ref,onValue:onValue,doc:doc};
  }
  function current(source){return !source.closed&&sources.get(source.path)===source&&source.context.valid();}
  function report(consumer,error){
    Promise.resolve().then(function(){
      if(!consumer.active)return;
      // A replacement established by an explicit action owns the caller now.
      // Its predecessor must not clear the replacement's loading signature.
      var replacement=sources.get(consumer.source.path);
      consumer.active=false;
      if(replacement&&replacement!==consumer.source&&current(replacement))return;
      try{consumer.onError(error);}catch(callbackError){console.error('[DataQuery]',consumer.source.path,callbackError);}
    });
  }
  function stop(source,error){
    if(source.closed)return;
    source.closed=true;source.rows=null;
    if(sources.get(source.path)===source)sources.delete(source.path);
    source.listeners.forEach(function(entry){entry[0].removeEventListener(entry[1],entry[2]);});source.listeners=[];
    if(typeof source.unsubscribe==='function'){var unsubscribe=source.unsubscribe;source.unsubscribe=null;unsubscribe();}
    var consumers=Array.from(source.consumers);source.consumers.clear();
    if(error)consumers.forEach(function(consumer){report(consumer,error);});
  }
  function stopWhenUnused(source){
    var generation=++source.releaseGeneration;
    Promise.resolve().then(function(){if(!source.closed&&generation===source.releaseGeneration&&!source.consumers.size)stop(source);});
  }
  function deliver(source,consumer){
    if(!consumer.active||source.closed)return;
    if(!current(source)){stop(source,retiredError());return;}
    var bounds=consumer.bounds;
    var rows=source.rows.filter(function(row){ return String(row.fecha||'').slice(0,10)>=bounds.start&&String(row.fecha||'').slice(0,10)<=bounds.end; });
    if(!current(source)){stop(source,retiredError());return;}
    try{consumer.onRows(rows,bounds);}catch(error){stop(source,error);}
  }
  function watch(source){
    function check(){if(!current(source))stop(source,retiredError());}
    function retire(){stop(source,retiredError());}
    function listen(target,type,callback){target.addEventListener(type,callback);source.listeners.push([target,type,callback]);}
    ['sisventas:session-ended','sisventas:role-changed'].forEach(function(type){listen(source.context.doc,type,retire);});
    ['sisventas:page-changed','visibilitychange','sisventas:foreground-paused'].forEach(function(type){listen(source.context.doc,type,check);});
    listen(window,'hashchange',check);listen(window,'pagehide',retire);
    try{
      var unsubscribe=source.context.onValue(source.context.ref(source.context.db,source.path),function(snapshot){
        if(!current(source)){stop(source,retiredError());return;}
        if(!source.consumers.size)return;
        var rows;
        try{rows=toRows(snapshot.val());}catch(error){stop(source,error);return;}
        if(!current(source)){stop(source,retiredError());return;}
        source.rows=rows;source.ready=true;source.version++;
        Array.from(source.consumers).forEach(function(consumer){deliver(source,consumer);});
      },function(error){if(!source.closed)stop(source,error||retiredError());});
      if(source.closed){if(typeof unsubscribe==='function')unsubscribe();}else source.unsubscribe=unsubscribe;
    }catch(error){stop(source,error);}
  }
  function subscribeDateRange(path,bounds,onRows,onError){
    var captured=context(),source=sources.get(path);
    if(source&&!current(source)){stop(source,retiredError());source=null;}
    if(!source){source={path:path,context:captured,consumers:new Set(),rows:null,ready:false,version:0,releaseGeneration:0,closed:false,listeners:[],unsubscribe:null};sources.set(path,source);}
    var consumer={source:source,bounds:bounds,onRows:onRows,onError:onError||function(error){console.error('[DataQuery]',path,error);},active:true};
    source.consumers.add(consumer);source.releaseGeneration++;
    function unsubscribe(){if(!consumer.active)return;consumer.active=false;source.consumers.delete(consumer);if(!source.consumers.size)stopWhenUnused(source);}
    unsubscribe.valid=function(){return consumer.active&&current(source);};
    if(!captured.valid()){stop(source,retiredError());return unsubscribe;}
    // One authorized root source survives only a synchronous range handoff.
    // Filtering remains local until a compatible fecha index is deployed.
    if(source.ready){var version=source.version;Promise.resolve().then(function(){if(source.version===version)deliver(source,consumer);});}
    else if(source.consumers.size===1&&source.unsubscribe===null)watch(source);
    return unsubscribe;
  }
  SV.DataQuery={iso:iso,range:range,subscribeDateRange:subscribeDateRange};
})(window);
