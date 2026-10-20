(function(root,factory){
 'use strict';
 var api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.SVOTPersonalScope=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 var own=Object.prototype.hasOwnProperty;
 var identityFields=['fbKey','id','codigo'];
 var assignmentFields=['tecnicoFbKey','empleadoFbKey','tecnicoKey'];
 function record(value){return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.prototype.toString.call(value)==='[object Object]';}
 function normalize(value){return typeof value==='string'?value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase():'';}
 function key(value){
  if(value===null||value===undefined||typeof value==='string'&&!value.trim())return {empty:true};
  if(typeof value==='number')return Number.isFinite(value)?{value:String(value)}:{invalid:true};
  if(typeof value!=='string'||/[\x00-\x1f\x7f]/.test(value))return {invalid:true};
  return {value:value.trim()};
 }
 function aliases(employee){
  var result=[];
  for(var i=0;i<identityFields.length;i++){
   if(!own.call(employee,identityFields[i]))continue;
   var parsed=key(employee[identityFields[i]]);
   if(parsed.invalid)return null;
   if(!parsed.empty&&result.indexOf(parsed.value)<0)result.push(parsed.value);
  }
  return result;
 }
 function names(employee){return ['nombre','apellidoNombre'].map(function(field){return own.call(employee,field)?normalize(employee[field]):'';}).filter(Boolean);}
 function sameEmployee(candidate,employee,employeeKeys){
  var candidateKeys=aliases(candidate);
  if(!candidateKeys||!candidateKeys.length)return false;
  var candidatePrimary=key(candidate.fbKey),employeePrimary=key(employee.fbKey);
  if(candidatePrimary.value!==undefined&&employeePrimary.value!==undefined)return candidatePrimary.value===employeePrimary.value;
  return candidateKeys.some(function(value){return employeeKeys.indexOf(value)>=0;});
 }
 function assigned(ot,employee,directory){
  if(!record(ot)||!record(employee))return false;
  var employeeKeys=aliases(employee);
  if(!employeeKeys||!employeeKeys.length)return false;
  // Una clave de mayor prioridad decide la asignación. Sólo los valores
  // vacíos de compatibilidad permiten continuar con el campo siguiente.
  for(var i=0;i<assignmentFields.length;i++){
   if(!own.call(ot,assignmentFields[i]))continue;
   var parsed=key(ot[assignmentFields[i]]);
   if(parsed.invalid)return false;
   if(!parsed.empty)return employeeKeys.indexOf(parsed.value)>=0;
  }
  var otName='';
  for(var j=0;j<2;j++){
   var field=j?'tecnicoNombre':'tecnico';
   if(!own.call(ot,field)||ot[field]===null||ot[field]===undefined||typeof ot[field]==='string'&&!ot[field].trim())continue;
   if(typeof ot[field]!=='string')return false;
   otName=normalize(ot[field]);break;
  }
  if(!otName||names(employee).indexOf(otName)<0)return false;
  // El fallback histórico necesita un directorio conocido y una identidad
  // inequívoca. No se inventa propiedad si faltan esos datos.
  if(!Array.isArray(directory)&&!record(directory))return false;
  var matches=Object.values(directory).filter(function(candidate){return record(candidate)&&names(candidate).indexOf(otName)>=0;});
  return matches.length>0&&matches.every(function(candidate){return sameEmployee(candidate,employee,employeeKeys);});
 }
 return Object.freeze({assigned:assigned,normalize:normalize});
});
