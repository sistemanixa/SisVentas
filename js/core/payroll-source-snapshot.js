(function(root,factory){
 'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.SVPayrollSourceSnapshot=api;
})(typeof window==='object'?window:null,function(){
 'use strict';
 const MAX_PATHS=128,REPLAN_CODE='SV_PAYROLL_SOURCES_REPLAN',GASTOS='sisventas/gastos',HABERES='sisventas/haberes',EMPLOYEES='sisventas/empleados',CARGOS='sisventas/config/cargos';
 const own=(object,key)=>Object.hasOwn(object||{},key),object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const failure=message=>Object.assign(new Error(message),{code:REPLAN_CODE,svLaborAttempted:false});
 const clone=value=>value==null?null:JSON.parse(JSON.stringify(value));
 function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
 function key(value,label){if(typeof value!=='string'||!value||value.length>256||/[.#$\[\]\/\x00-\x1f\x7f]/.test(value)||['__proto__','constructor','prototype','hasOwnProperty'].includes(value))throw failure('La referencia de '+label+' no es válida. Volvé a cargar el semestre.');return value;}
 function profile(employee){return {activo:employee.activo!==false,nombre:employee.nombre??null,fechaIngreso:employee.fechaIngreso??null,cargoId:employee.cargoId??null,uid:employee.uid??null,usuario:employee.usuario??null,legajo:employee.legajo??null};}
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function employeeMap(value){if(Array.isArray(value)){const result=Object.create(null);for(const row of value){const id=key(row?.fbKey,'empleado');if(own(result,id))throw failure('Hay un empleado repetido.');result[id]=row;}return result;}if(!object(value))throw failure('No se pudo comprobar el listado de empleados.');return value;}
 function cargoId(employee){if(!employee.cargoId)return null;return key(String(employee.cargoId),'cargo');}
 function needsCargo(salaries){let best=0;for(const salary of salaries)if(salary&&salary>best)best=salary;return best===0;}
 function child(value,parts){for(const part of parts){if(value===null||typeof value!=='object'||!own(value,part))return null;value=value[part];}return value??null;}
 function pathsFor(ids,months,cargoIds,scope){
  const paths=[GASTOS];
  if(scope.haberes==='all')paths.push(HABERES);else for(const id of ids){if(scope.haberes==='employee')paths.push(HABERES+'/'+id);else for(const month of months)paths.push(HABERES+'/'+id+'/'+month+'/sueldo');}
  if(scope.employees==='all')paths.push(EMPLOYEES);else for(const id of ids)paths.push(EMPLOYEES+'/'+id);
  if(scope.cargos==='all')paths.push(CARGOS);else if(scope.cargos==='selected')for(const id of cargoIds)paths.push(CARGOS+'/'+id);
  return paths;
 }
 function plan({employeeIds,employees,haberes,year,half,budget=MAX_PATHS}={}){
  if(!Number.isInteger(year)||year<1000||year>9999||![1,2].includes(half)||!Number.isInteger(budget)||budget<3||budget>MAX_PATHS)throw failure('No se pudo identificar el semestre o el límite de fuentes.');
  if(!Array.isArray(employeeIds)||!employeeIds.length)throw failure('Seleccioná al menos un empleado.');
  const ids=employeeIds.map(id=>key(id,'empleado'));if(new Set(ids).size!==ids.length)throw failure('Hay un empleado repetido en la selección.');
  const staff=employeeMap(employees),profiles=Object.create(null),months=Array.from({length:6},(_,index)=>year+'_'+String((half===1?1:7)+index).padStart(2,'0')),fallback=new Set();
  if(!object(haberes))throw failure('No se pudo comprobar el semestre completo.');
  for(const id of ids){const employee=own(staff,id)?staff[id]:null;if(!object(employee)||employee.activo===false||employee.fbKey!=null&&employee.fbKey!==id)throw failure('Uno de los empleados cambió o ya no está activo. Volvé a cargar el semestre.');profiles[id]=clone(profile(employee));
   if(!own(haberes,id))throw failure('Falta comprobar el semestre de un empleado.');
   const salaries=months.map(month=>child(haberes[id],[month,'sueldo']));if(needsCargo(salaries)){const cargo=cargoId(employee);if(cargo)fallback.add(cargo);}
  }
  const fallbackCargoIds=[...fallback].sort();let strategy='employee-history',scope={haberes:'employee',employees:'selected',cargos:fallbackCargoIds.length?'selected':'none'},paths=pathsFor(ids,months,fallbackCargoIds,scope);
  if(paths.length>budget){strategy='adaptive-parents';for(const domain of ['cargos','employees','haberes']){
   if(domain==='cargos'&&fallbackCargoIds.length<2)continue;if(domain==='employees'&&ids.length<2)continue;
   scope={...scope,[domain]:'all'};paths=pathsFor(ids,months,fallbackCargoIds,scope);if(paths.length<=budget)break;
  }}
  if(paths.length>budget)throw failure('El lote no cabe en una confirmación atómica con las fuentes necesarias.');
  return freeze({schema:1,ids:[...ids],year,half,months,paths,scope,strategy,fallbackCargoIds,profiles,readScope:{sourceCount:paths.length,employeeHistoryAtConfirmation:scope.haberes!=='months',globalHaberesAtConfirmation:scope.haberes==='all',globalEmployeesAtConfirmation:scope.employees==='all',allCargosAtConfirmation:scope.cargos==='all'}});
 }
 function materialize(description,values){
  if(!object(description)||description.schema!==1||!Array.isArray(description.paths)||!object(values)||description.paths.some(path=>!own(values,path)))throw failure('Faltan fuentes verificadas del semestre. Volvé a cargarlo.');
  const snapshot={employees:[],haberes:Object.create(null),cargos:Object.create(null)},scope=description.scope;
  function read(path){if(!own(values,path))throw failure('Falta una fuente verificada del semestre.');return values[path]??null;}
  for(const id of description.ids){
   const employee=scope.employees==='all'?child(read(EMPLOYEES),[id]):read(EMPLOYEES+'/'+id);
   if(!object(employee)||employee.activo===false||employee.fbKey!=null&&employee.fbKey!==id)throw failure('Uno de los empleados cambió o ya no está activo. Volvé a cargar el semestre.');
   if(!equal(profile(employee),description.profiles[id]))throw failure('Cambió la identidad, el ingreso o el cargo de un empleado. Volvé a revisar el semestre.');
   snapshot.employees.push({...clone(employee),fbKey:id});const history=Object.create(null),salaries=[];
   for(const month of description.months){const value=scope.haberes==='all'?child(read(HABERES),[id,month,'sueldo']):scope.haberes==='employee'?child(read(HABERES+'/'+id),[month,'sueldo']):read(HABERES+'/'+id+'/'+month+'/sueldo');salaries.push(value);if(value!==null)history[month]={sueldo:clone(value)};}
   snapshot.haberes[id]=history;
   if(needsCargo(salaries)){const cargo=cargoId(employee);if(cargo){let actual;if(scope.cargos==='all')actual=child(read(CARGOS),[cargo]);else if(scope.cargos==='selected'&&description.fallbackCargoIds.includes(cargo))actual=read(CARGOS+'/'+cargo);else throw failure('Cambió el sueldo y ahora se necesita comprobar el cargo. Volvé a cargar el semestre.');snapshot.cargos[cargo]=clone(actual);}}
  }
  return snapshot;
 }
 return Object.freeze({MAX_PATHS,REPLAN_CODE,plan,materialize});
});
