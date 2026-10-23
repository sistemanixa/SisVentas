(function(root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SVPersonalHours = api;
})(typeof window === 'object' ? window : null, function() {
  'use strict';
  var fields = ['auth','uid','role','revision','epoch','view','employeeId','monthCurrent','monthPrev'];
  var months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var own = function(value, key) { return Object.prototype.hasOwnProperty.call(value,key); };
  function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function validKey(value) { return typeof value === 'string' && !!value && new TextEncoder().encode(value).length <= 768 && !/[.#$\[\]\/\x00-\x1f\x7f]/.test(value); }
  function validMonth(value) { return typeof value === 'string' && /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value); }
  function previousMonth(current) {
    if (!validMonth(current)) throw new Error('No se pudo establecer el período de horas extra.');
    var year=Number(current.slice(0,4)), month=Number(current.slice(5,7));
    return String(month===1?year-1:year)+'-'+String(month===1?12:month-1).padStart(2,'0');
  }
  function profile(scope) { return scope && scope.viewProfile != null ? scope.viewProfile : ''; }
  function validScope(scope) {
    return !!scope && !!scope.auth && validKey(scope.uid) && scope.uid.length<=128 && scope.auth.uid===scope.uid && validKey(scope.employeeId) &&
      (profile(scope)==='' || validKey(profile(scope))) && validMonth(scope.monthCurrent) && validMonth(scope.monthPrev) && previousMonth(scope.monthCurrent)===scope.monthPrev;
  }
  function sameScope(first, second) {
    return validScope(first) && validScope(second) && profile(first)===profile(second) && fields.every(function(field) { return first[field]===second[field]; });
  }
  function select(value, employeeId) {
    if (value===null || value===undefined) return [];
    if (!object(value)) throw new Error('No se pudo comprobar el detalle de las solicitudes.');
    return Object.keys(value).filter(function(key) {
      var record=value[key];
      return object(record) && record.empFbKey===employeeId;
    }).map(function(key) { return {key:key,value:value[key]}; });
  }
  function project(value, input) {
    if (!input || !validKey(input.employeeId) || !validMonth(input.monthCurrent) || !validMonth(input.monthPrev) || previousMonth(input.monthCurrent)!==input.monthPrev) throw new Error('No se pudo establecer el período de horas extra.');
    var records=select(value,input.employeeId), pending=[], approved=[];
    records.forEach(function(record) {
      if (record.value.estado==='pendiente') pending.push(record);
      if (record.value.estado==='aprobado') approved.push(record);
    });
    var pendingHours=pending.reduce(function(total,record) { return total+(parseFloat(record.value.horas)||0); },0);
    // Display threshold only: every own record stays in the dataset, including
    // legacy future dates. No rounding or financial operation happens here.
    var approvedHours=approved.filter(function(record) { return (record.value.fecha||'').slice(0,7)>=input.monthPrev; })
      .reduce(function(total,record) { return total+(parseFloat(record.value.horas)||0); },0);
    var previousLabel=months[Number(input.monthPrev.slice(5,7))-1]+' de '+input.monthPrev.slice(0,4), text, color;
    if (pending.length) {
      text=pending.length+' solicitud'+(pending.length===1?'':'es')+' pendiente'+(pending.length===1?'':'s')+' ('+pendingHours+' hs)';color='var(--amber)';
    } else if (approvedHours>0) { text=approvedHours+' hs aprobadas desde '+previousLabel;color='var(--green)'; }
    else { text=records.length?'Sin solicitudes pendientes':'Sin solicitudes';color='var(--text3)'; }
    return {status:'ready',employeeId:input.employeeId,monthCurrent:input.monthCurrent,monthPrev:input.monthPrev,
      ids:records.map(function(record) { return record.key; }),records:records,pendingCount:pending.length,pendingHours:pendingHours,approvedHours:approvedHours,text:text,color:color};
  }
  function failure(code,status) {
    var error=new Error('No se pudieron consultar tus horas extra.');error.code=code;
    if (status) error.status=status;
    return error;
  }
  function aborted() { var error=failure('SV_PERSONAL_HOURS_CANCELLED');error.name='AbortError';return error; }
  function withAbort(task, signal) {
    if (signal.aborted) return Promise.reject(aborted());
    var cancel;
    var stopped=new Promise(function(_,reject) { cancel=function() { reject(aborted()); };signal.addEventListener('abort',cancel,{once:true}); });
    return Promise.race([Promise.resolve(task),stopped]).finally(function() { signal.removeEventListener('abort',cancel); });
  }
  function dictionary(body, employeeId) {
    if (!object(body) || body.ok!==true || body.employeeId!==employeeId || !Array.isArray(body.records) ||
        Object.keys(body).some(function(key) { return !['ok','employeeId','records'].includes(key); })) throw failure('SV_PERSONAL_HOURS_RESPONSE');
    for(var index=0;index<body.records.length;index++)if(!own(body.records,index))throw failure('SV_PERSONAL_HOURS_RESPONSE');
    var result=Object.create(null), keys=[], seen=new Set(), allowed=['empFbKey','estado','horas','fecha','mes'];
    body.records.forEach(function(record) {
      if (!object(record) || Object.keys(record).length!==2 || !own(record,'key') || !own(record,'value') || !validKey(record.key) || seen.has(record.key) ||
          !object(record.value) || !own(record.value,'empFbKey') || record.value.empFbKey!==employeeId || Object.keys(record.value).some(function(key) { return !allowed.includes(key); })) throw failure('SV_PERSONAL_HOURS_RESPONSE');
      var value=record.value, copy=Object.create(null);
      allowed.forEach(function(field) {
        if (!own(value,field)) return;
        var item=value[field], valid=field==='empFbKey'?item===employeeId : field==='horas' || field==='estado'
          ? item===null || typeof item==='string' || typeof item==='number' && Number.isFinite(item)
          : item===null || typeof item==='string';
        if (!valid) throw failure('SV_PERSONAL_HOURS_RESPONSE');
        copy[field]=item;
      });
      seen.add(record.key);keys.push(record.key);result[record.key]=Object.freeze(copy);
    });
    // Integer keys are enumerated numerically by JavaScript. Reject a server
    // sequence that could not retain its promised SDK Object.keys order.
    var actual=Object.keys(result);
    if (actual.length!==keys.length || keys.some(function(key,index) { return key!==actual[index]; })) throw failure('SV_PERSONAL_HOURS_ORDER');
    return Object.freeze(result);
  }
  async function readOwn(options) {
    if (!options || !validScope(options.scope) || !['headersServiceAuth','isCurrent','fetch','deadline'].every(function(key) { return typeof options[key]==='function'; })) throw failure('SV_PERSONAL_HOURS_CONFIG');
    var url;
    try {
      url=new URL(options.base);
      if (!['https:','http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw Error('base');
      url.pathname=url.pathname.replace(/\/$/,'')+'/laboral/horas-propias';
    } catch (_) { throw failure('SV_PERSONAL_HOURS_CONFIG'); }
    if (profile(options.scope)) url.searchParams.set('viewProfile',profile(options.scope));
    var controller=new AbortController(), signal=controller.signal, external=options.signal, cancel=function() { controller.abort(); };
    if (external) { external.addEventListener('abort',cancel,{once:true});if(external.aborted)cancel(); }
    function check() { if (signal.aborted || !validScope(options.scope) || options.isCurrent()!==true) { controller.abort();throw aborted(); } }
    var task=Promise.resolve().then(async function() {
      check();
      var headers=await withAbort(options.headersServiceAuth(),signal);
      check();
      var response=await withAbort(options.fetch(url.href,{method:'GET',headers:headers,cache:'no-store',credentials:'omit',redirect:'error',signal:signal}),signal);
      check();
      if (!response || response.ok!==true || response.status!==200) throw failure('SV_PERSONAL_HOURS_HTTP',response && response.status);
      var body;
      try { body=await withAbort(response.json(),signal); }
      catch(error) { if (signal.aborted) throw aborted();throw failure('SV_PERSONAL_HOURS_RESPONSE'); }
      check();
      var result=dictionary(body,options.scope.employeeId);
      check();return result;
    });
    try { var result=await options.deadline(task,20000);check();return result; }
    catch(error) { controller.abort();task.catch(function(){});throw error; }
    finally { if (external) external.removeEventListener('abort',cancel); }
  }
  function paint(element,state) {
    if (!element || element.isConnected===false) return false;
    state=state||{status:'none'};
    var texts={loading:'Consultando tus solicitudes…',error:'No se pudieron consultar tus horas extra.',none:'Estado de solicitudes sin consultar.'}, ready=state.status==='ready';
    element.textContent=ready?state.text:texts[state.status]||texts.none;
    element.style.color=ready?state.color:state.status==='error'?'var(--red)':'var(--text3)';
    element.setAttribute('role','status');element.setAttribute('aria-live','polite');element.setAttribute('aria-busy',String(state.status==='loading'));
    return true;
  }
  function create(options) {
    if (!options || !['capture','isVisible','read','present'].every(function(key) { return typeof options[key]==='function'; })) throw new Error('Lector de horas extra incompleto.');
    var generation=0,pending=null,cached=null,last={status:'none'};
    function capture() { try { return options.capture(); } catch (_) { return null; } }
    function current(scope) { return sameScope(scope,capture()); }
    function emit(state) { last=state;options.present(state);return state; }
    function cancelPending() { if(pending)pending.controller.abort();pending=null; }
    function stop() { generation++;cancelPending();cached=null;return emit({status:'none'}); }
    function pause() { generation++;cancelPending();return emit({status:'none'}); }
    function renderCached() {
      if(!options.isVisible())return emit({status:'none'});
      if(cached && current(cached.scope))return emit(cached.state);
      cached=null;return emit({status:pending && current(pending.scope)?'loading':'none'});
    }
    function load() {
      var captured=capture();
      if(!validScope(captured))return Promise.resolve(stop());
      if(!options.isVisible())return Promise.resolve(pause());
      if(pending && sameScope(pending.scope,captured))return pending.promise;
      cancelPending();
      var scope=Object.freeze(Object.assign({},captured)),token={scope:scope,generation:++generation,controller:new AbortController(),promise:null};
      cached=null;pending=token;
      token.promise=Promise.resolve().then(function() {
        if(token.generation!==generation)return null;
        if(!current(scope)){stop();return null;}
        if(!options.isVisible()){pause();return null;}
        return options.read(scope,{signal:token.controller.signal});
      }).then(function(value) {
        if(token.generation!==generation)return last;
        if(!current(scope)){stop();return last;}
        if(!options.isVisible()){pause();return last;}
        if(!object(value))throw failure('SV_PERSONAL_HOURS_RESPONSE');
        var state=project(value,scope);cached={scope:scope,state:state};return emit(state);
      }).catch(function() {
        if(token.generation!==generation)return last;
        if(!current(scope)){stop();return last;}
        if(!options.isVisible()){pause();return last;}
        var state={status:'error'};cached={scope:scope,state:state};return emit(state);
      }).finally(function() { if(pending===token)pending=null; });
      emit({status:'loading'});
      return token.promise;
    }
    return Object.freeze({load:load,pause:pause,stop:stop,renderCached:renderCached,state:function(){return last;}});
  }
  return Object.freeze({project:project,select:select,previousMonth:previousMonth,sameScope:sameScope,readOwn:readOwn,paint:paint,create:create});
});
