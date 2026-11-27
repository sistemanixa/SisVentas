(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../core/record-list-model'));
  else root.SVMaintenanceExpenses=factory(root.SVRecordListModel);
})(typeof globalThis!=='undefined'?globalThis:this,function(Model){
  'use strict';
  const CONFIG='sv_record_list_config',INDEX='sisventas/listados_resumen/gastos';
  const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const key=v=>typeof v==='string'&&v.length>0&&Model.key(v);
  function sourceLabel(path){
    if(path.startsWith('sisventas/gastos/'))return 'gasto';
    if(path.startsWith('sisventas/empleados/'))return 'empleado';
    if(path.startsWith('sisventas/ctaemp/'))return 'cuenta laboral';
    if(path.startsWith('sisventas/aguinaldos/'))return 'SAC';
    if(path.startsWith('sisventas/hsextra_solicitudes/'))return 'solicitud de horas extra';
    return 'cobertura del listado';
  }
  function readFailure(error,path){
    const code=typeof error?.code==='string'?error.code.toLowerCase():'',status=Number(error?.statusCode||error?.status);
    let reason='error de lectura';
    if(status===403||['permission-denied','permission_denied','database/permission-denied'].includes(code))reason='acceso denegado';
    else if(status===401||['unauthorized','unauthenticated','auth/id-token-expired','auth/user-token-expired'].includes(code))reason='sesión no autorizada';
    else if(status===501||['unavailable','failed-precondition'].includes(code))reason='acceso no habilitado';
    else if(status===429||code==='resource-exhausted')reason='límite de consultas';
    else if([408,504].includes(status)||['network-request-failed','auth/network-request-failed','network_error','timeout','deadline-exceeded'].includes(code))reason='error de red o tiempo agotado';
    return 'No se pudo consultar '+sourceLabel(path)+': '+reason+'.';
  }
  const canonical=v=>JSON.stringify(v&&typeof v==='object'?(Array.isArray(v)?v.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))]))):v);
  function create({read,valid,onProgress}={}){
    if(typeof read!=='function'||typeof valid!=='function')throw TypeError('Se requieren lector y contexto autorizado.');
    let snapshot=null;
    async function run(){
      let reads=0,checked=0,total=0;const memo=new Map(),results=[];
      snapshot=()=>JSON.parse(JSON.stringify({kind:'expenses',complete:false,partial:true,checked,total,results:results.filter(Boolean),reads}));
      function active(){if(valid()!==true)throw Object.assign(Error('La sesión o la revisión cambió.'),{name:'AbortError'});}
      async function get(path,fresh=false){
        active();if(!fresh&&memo.has(path))return memo.get(path);
        const promise=(async()=>{reads++;try{const value=await read(path);active();if(value===undefined)throw Error('Lectura incompleta.');return value;}catch(error){active();throw Object.assign(Error(readFailure(error,path)),{name:'MaintenanceReadError'});}})();
        if(!fresh)memo.set(path,promise);return promise;
      }
      const config=await get(CONFIG);if(!object(config)||config.schema!==1||config.ready!==true)throw Error('El listado todavía no está preparado.');
      const index=await get(INDEX),summaries=Model.parseIndex('gastos',index),ids=Object.keys(summaries).sort();total=ids.length;
      async function inspect(id){
        const row={key:id,label:id,status:'ok',issues:[],checks:[]};
        function issue(message){row.issues.push(message);if(row.status!=='unavailable')row.status='review';}
        async function target(path,check){const value=await get(path);if(value===null){issue('Falta '+check+'.');return null;}if(!object(value)){issue('Formato inválido: '+check+'.');return null;}row.checks.push(check);return value;}
        try{
          const g=await target('sisventas/gastos/'+id,'original del gasto');
          if(!g)return row;
          if(g._svListSummary===true){issue('El original es un resumen incompleto.');return row;}
          if(g.fbKey!==undefined&&g.fbKey!==id)issue('La identidad del gasto no coincide.');
          const revision=Object.prototype.hasOwnProperty.call(g,Model.revision)?g[Model.revision]:0;
          if(!Number.isSafeInteger(revision)||revision<0)issue('La revisión del original tiene un formato inválido.');
          else if(revision!==summaries[id][Model.revision])issue('El original y el listado tienen revisiones distintas.');
          if(typeof g.descripcion==='string')row.label=g.descripcion.slice(0,160);
          const legacy=typeof g.legacyKey==='string'?g.legacyKey.split('/'):[],employees=[g.empleadoFbKey,g.empleadoId,legacy[0]==='ctaemp'||legacy[0]==='aguinaldos'?legacy[1]:undefined].filter(v=>v!==undefined&&v!==null&&v!=='');
          if(employees.some(v=>!key(v))||new Set(employees).size>1)issue('Las referencias del empleado son inválidas o contradictorias.');
          const employee=employees[0];if(key(employee))await target('sisventas/empleados/'+employee,'empleado');
          let originPath=null,kind=null;
          if(legacy[0]==='ctaemp'||legacy[0]==='aguinaldos'){
            if(legacy.length!==3||!key(legacy[1])||!key(legacy[2]))issue('La referencia de origen es inválida.');
            else {originPath='sisventas/'+legacy.join('/');kind=legacy[0];}
          }else if(legacy[0]==='hsextra_solicitudes'){
            if(legacy.length!==2||!key(legacy[1]))issue('La solicitud de horas extra es inválida.');
            else {originPath='sisventas/'+legacy.join('/');kind=legacy[0];}
          }else if(g.legacyKey)issue('El origen histórico no está cubierto por esta revisión.');
          if(g.movimientoCtaKey!==undefined){
            if(!key(g.movimientoCtaKey)||!key(employee))issue('Falta identificar el movimiento y su empleado.');
            else {const p='sisventas/ctaemp/'+employee+'/'+g.movimientoCtaKey;if(originPath&&originPath!==p)issue('Las referencias de origen son contradictorias.');else {originPath=p;kind='ctaemp';}}
          }
          if(originPath){
            const source=await target(originPath,'origen vinculado');
            if(source){
              const links=[source.gastoFbKey,source.gastoKey].filter(v=>v!==undefined&&v!==null&&v!=='');
              if(!links.length||links.some(v=>v!==id))issue('El origen no confirma el vínculo de regreso al gasto.');
              const es=[source.empFbKey,source.empleadoFbKey,source.empleadoId].filter(v=>v!==undefined&&v!==null&&v!=='');
              if(es.some(v=>!key(v)||!employee||v!==employee))issue('El empleado del origen no coincide.');
              if(kind==='hsextra_solicitudes'&&(!es.length||g.tipoPagable!=='hextra'||source.estado!=='aprobado'))issue('No se confirma la solicitud aprobada de horas extra.');
              if(kind==='aguinaldos'&&(g.tipoPagable!=='aguinaldo'||!/^\d{4}_S[12]$/.test(legacy[2])))issue('No se confirma el semestre del SAC.');
              if(kind==='ctaemp'&&g.tipoPagable==='comision'&&source.tipo!=='comision')issue('El movimiento no confirma una comisión.');
              if(kind==='ctaemp'&&g.tipoPagable==='aguinaldo'&&source.tipo!=='aguinaldo')issue('El movimiento no confirma un SAC.');
            }
          }else if(g.tipoPagable||g.origenLegacy||g.origen==='comision')issue('No hay referencia puntual suficiente para comprobar el origen.');
          if(g.pagos!==undefined&&g.pagos!==null&&!object(g.pagos)&&!Array.isArray(g.pagos))issue('Formato de pagos no comprobable.');
          row.checks.push('Sólo forma de pagos; conciliación monetaria no disponible. Adjuntos sin evaluar.');
        }catch(error){if(error.name==='AbortError')throw error;row.status='unavailable';row.issues.push(error.name==='MaintenanceReadError'?error.message:'No se pudo comprobar el registro: error de revisión.');}
        return row;
      }
      let cursor=0;
      const workers=Array.from({length:Math.min(3,total)},async()=>{while(cursor<total){active();const pos=cursor++,row=await inspect(ids[pos]);active();results[pos]=row;checked++;if(onProgress)onProgress({checked,total});}});
      const settled=await Promise.allSettled(workers);const failed=settled.find(r=>r.status==='rejected');if(failed)throw failed.reason;
      const final=await Promise.allSettled([get(CONFIG,true),get(INDEX+'/_svCoverage',true)]);active();
      const unchanged=final.every(r=>r.status==='fulfilled')&&canonical(config)===canonical(final[0].value)&&canonical(index._svCoverage)===canonical(final[1].value);
      if(!unchanged)for(const row of results){if(row.status==='ok')row.status='review';row.issues.push('La cobertura cambió o no pudo verificarse al finalizar.');}
      return {kind:'expenses',complete:unchanged&&results.every(r=>r.status!=='unavailable'),checked,total,results,reads};
    }
    return Object.freeze({run,snapshot(){return snapshot?snapshot():null;}});
  }
  return Object.freeze({create});
});
