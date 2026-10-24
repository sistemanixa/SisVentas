(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SVActivityPeriod=api;
})(typeof window==='object'?window:null,function(){
  'use strict';
  var object=function(value){return value!==null&&typeof value==='object';};
  function dateLabel(date){
    return String(date.getFullYear()).padStart(4,'0')+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
  }
  function localDay(value){
    if(value===undefined)value=new Date();
    var year,month,day;
    if(typeof value==='string'){
      var match=/^([1-9]\d{3})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(value);
      if(!match)throw Error('No se pudo establecer el período de actividad.');
      year=Number(match[1]);month=Number(match[2])-1;day=Number(match[3]);
    }else if(Object.prototype.toString.call(value)==='[object Date]'&&Number.isFinite(value.getTime())){
      year=value.getFullYear();month=value.getMonth();day=value.getDate();
    }else throw Error('No se pudo establecer el período de actividad.');
    // Noon is a stable calendar anchor even in zones whose DST transition is
    // at midnight. The endpoints below are local start-of-day instants.
    var result=new Date(year,month,day,12,0,0,0);
    if(result.getFullYear()!==year||result.getMonth()!==month||result.getDate()!==day||year<1000||year>9999)throw Error('No se pudo establecer el período de actividad.');
    return result;
  }
  function isCanonicalFecha(value){
    if(typeof value!=='string'||!/^[1-9]\d{3}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))return false;
    var parsed=new Date(value);
    return Number.isFinite(parsed.getTime())&&parsed.toISOString()===value;
  }
  function create(mode,today){
    if(mode===undefined)mode='30d';
    if(mode!=='30d'&&mode!=='all')throw Error('Período de actividad no válido.');
    if(mode==='all')return Object.freeze({mode:mode,fromInclusive:null,toExclusive:null,fromLocal:null,toLocal:null});
    var end=localDay(today),from=new Date(end.getTime()),until=new Date(end.getTime());
    from.setDate(from.getDate()-29);until.setDate(until.getDate()+1);
    var first=dateLabel(from),last=dateLabel(end);
    from.setHours(0,0,0,0);until.setHours(0,0,0,0);
    var fromISO=from.toISOString(),untilISO=until.toISOString();
    if(!isCanonicalFecha(fromISO)||!isCanonicalFecha(untilISO))throw Error('No se pudo establecer el período de actividad.');
    return Object.freeze({mode:mode,fromInclusive:fromISO,toExclusive:untilISO,fromLocal:first,toLocal:last});
  }
  function filter(data,period){
    if(!period||(period.mode!=='30d'&&period.mode!=='all'))throw Error('Período de actividad no válido.');
    // Full history keeps its exact original object/array and enumeration. Its
    // existing stable sort and 300-row display limit belong to the caller.
    if(period.mode==='all')return data;
    if(!isCanonicalFecha(period.fromInclusive)||!isCanonicalFecha(period.toExclusive)||period.fromInclusive>=period.toExclusive)throw Error('Período de actividad no válido.');
    if(data===null||data===undefined)return data;
    if(!object(data))throw Error('No se pudo comprobar el historial de actividad.');
    var result=Array.isArray(data)?new Array(data.length):{};
    Object.keys(data).forEach(function(key){
      var record=data[key],fecha=record&&record.fecha;
      if(!object(record)||!isCanonicalFecha(fecha)||fecha<period.fromInclusive||fecha>=period.toExclusive)return;
      // Defining the property preserves sparse/numeric keys without treating a
      // legacy key such as __proto__ as a prototype mutation.
      Object.defineProperty(result,key,{value:record,enumerable:true,writable:true,configurable:true});
    });
    return result;
  }
  return Object.freeze({create:create,filter:filter,isCanonicalFecha:isCanonicalFecha});
});
