'use strict';
const {isDeepStrictEqual}=require('node:util');
const {normalizeRtdb}=require('./payment-membership-index');
const Legacy=require('./payroll-legacy-sac-model');
const PURPOSE='employee-sac-batch',MIGRATION_PURPOSE=Legacy.PURPOSE;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const same=(a,b)=>isDeepStrictEqual(normalizeRtdb(a),normalizeRtdb(b));
const samePatch=(a,b)=>isDeepStrictEqual(Object.keys(a).sort(),Object.keys(b).sort())&&Object.keys(a).every(path=>same(a[path],b[path]));
const fail=(message,code='SV_SAC_BATCH_INVALID',statusCode=400)=>Object.assign(Error(message),{code,statusCode});
const safe=value=>typeof value==='string'&&!!value&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
const sac=value=>object(value)&&String(value.tipoPagable||'').trim().toLowerCase()==='aguinaldo';
const operationKey=(prefix,values)=>prefix+'_'+values.map(value=>String(value??'').replace(/[^A-Za-z0-9_-]/g,'_')).join('_');
const covered=(paths,path)=>paths.some(base=>path===base||path.startsWith(base+'/'));
function validDay(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
function expectedPaths(body){
 if(body?.kind!=='atomic'||body.path!==''||!object(body.value)||!object(body.expectedHashes))throw fail('El SAC requiere un único guardado protegido.');
 const paths=Object.keys(body.expectedHashes);
 if(!paths.length||paths.length>128||paths.some(path=>!/^[a-f0-9]{64}$/.test(body.expectedHashes[path]||'')))throw fail('Las fuentes del SAC están incompletas.');
 return paths;
}
function sourcePath(path){const p=path.split('/');return p[0]==='sisventas'&&(p[1]==='gastos'&&p.length===2||['haberes','empleados'].includes(p[1])&&(p.length===2||p.length===3&&safe(p[2]))||p[1]==='haberes'&&p.length===5&&safe(p[2])&&/^\d{4}_(0[1-9]|1[0-2])$/.test(p[3])&&p[4]==='sueldo'||p[1]==='config'&&p[2]==='cargos'&&(p.length===3||p.length===4&&safe(p[3])));}
function describe(body){
 const paths=expectedPaths(body);if(body.purpose!==PURPOSE||!paths.includes('sisventas/gastos')||paths.some(path=>!sourcePath(path)))throw fail('El SAC requiere comprobar Gastos y las fuentes usadas para calcularlo.');
 const rows=[];let period=null,date=null,suffix=null;
 for(const [path,value]of Object.entries(body.value)){
  const p=path.split('/');if(p.length!==3||p[0]!=='sisventas'||p[1]!=='gastos'||!safe(p[2])||!object(value)||!sac(value))throw fail('El lote de SAC sólo puede crear gastos completos.');
  const employee=value.empleadoFbKey,sem=value.semestre;
  if(!safe(employee)||value.empleadoId!==employee||typeof sem!=='string'||!/^\d{4}_S[12]$/.test(sem)||Number(sem.slice(0,4))<1000)throw fail('La referencia del empleado o semestre no es válida.');
  const base=operationKey('aguinaldo',[employee,sem]),tail=p[2]===base?'':p[2].startsWith(base+'_')?p[2].slice(base.length+1):null;
  if(tail===null||tail!==''&&!/^[A-Za-z0-9_-]+$/.test(tail)||!covered(paths,'sisventas/empleados/'+employee))throw fail('Las referencias y fuentes del lote no coinciden.');
  const months=Array.from({length:6},(_,i)=>sem.slice(0,4)+'_'+String(i+(sem.endsWith('1')?1:7)).padStart(2,'0'));
  if(months.some(month=>!covered(paths,'sisventas/haberes/'+employee+'/'+month+'/sueldo')))throw fail('Falta comprobar los seis sueldos usados para calcular el SAC.');
  if(period!==null&&(period!==sem||date!==value.fecha||suffix!==tail))throw fail('El lote debe compartir semestre, fecha e intento.');
  period=sem;date=value.fecha;suffix=tail;rows.push({path,key:p[2],employee,value,months});
 }
 if(!rows.length||new Set(rows.map(row=>row.employee)).size!==rows.length)throw fail('El lote no identifica una única liquidación por empleado.');
 return {paths,rows};
}
function describeMigration(body){
 const paths=expectedPaths(body);if(body.purpose!==MIGRATION_PURPOSE||!paths.includes('sisventas/gastos'))throw fail('La migración necesita comprobar Gastos y sus orígenes.');
 const sources=paths.filter(path=>path!=='sisventas/gastos'),roots=sources.filter(path=>/^sisventas\/(aguinaldos|ctaemp)$/.test(path));
 if(!sources.length||roots.length&&roots.length!==sources.length)throw fail('Las fuentes de la migración no tienen un alcance coherente.');
 if(!roots.length)for(const path of sources)try{Legacy.describe(path);}catch(_){throw fail('La migración incluye una fuente no permitida.');}
 const changedSources=[];
 for(const [path,value]of Object.entries(body.value)){
  if(/^sisventas\/gastos\/[^/]+$/.test(path)){if(!object(value)||!sac(value))throw fail('El gasto migrado no es un SAC completo.');continue;}
  try{Legacy.describe(path);}catch(_){throw fail('La migración sólo puede agregar el gasto y su vínculo de origen.');}
  if(!object(value)||!covered(paths,path))throw fail('Falta comprobar el origen completo de la migración.');changedSources.push(path);
 }
 if(!changedSources.length)throw fail('La migración no incluye una marca de origen verificable.');
 const sourcePaths=roots.length?changedSources:sources;
 if(!roots.length&&!same([...paths].sort(),Legacy.pathsFor(sourcePaths).sort()))throw fail('Las fuentes de la migración no coinciden con su selección.');
 return {paths,sourcePaths,changedSources};
}
async function snapshots(paths,raw){const values={};for(const path of paths)values[path]=await raw(path);return values;}
function current(values,path){if(Object.hasOwn(values,path))return values[path];const base=Object.keys(values).filter(base=>path.startsWith(base+'/')).sort((a,b)=>b.length-a.length)[0];if(!base)throw fail('Falta una fuente protegida del SAC.');return path.slice(base.length+1).split('/').reduce((value,key)=>object(value)&&Object.hasOwn(value,key)?value[key]:null,values[base])??null;}
function canonicalNew(value,employee,row){
 const expected={fecha:value.fecha,tipo:'Fijo',tipoPagable:'aguinaldo',descripcion:'Aguinaldo '+(employee.nombre||'')+' — '+(row.value.semestre.endsWith('1')?'1er':'2do')+' semestre '+row.value.semestre.slice(0,4),categoria:'Personal',monto:value.monto,medio:'Transferencia',estado:'Pendiente',empleadoId:row.employee,empleadoFbKey:row.employee,empleadoNombre:employee.nombre||'',mes:String(value.fecha).slice(0,7),periodoTrabajo:'',fechaTrabajo:'',fechaImputacion:value.fecha,aprobadoTs:null,semestre:value.semestre,mejorSueldo:value.mejorSueldo||null,hsExtra:null,origenLegacy:'',legacyKey:'sac/'+row.employee+'/'+value.semestre,migradoDesdeLegacy:false,ts:value.ts};
 if(!validDay(value.fecha)||typeof value.monto!=='number'||!Number.isFinite(value.monto)||value.monto<=0||Math.round(value.monto*100)/100!==value.monto||!Number.isSafeInteger(value.ts)||value.ts<=0||!same(value,expected))throw fail('Un SAC nuevo no puede incluir pagos ni un detalle ajeno al cálculo confirmado.');
}
async function forbidFabricatedSources({actor,raw,get,patch,migration}){
 if(actor.mode!=='user'||migration)return;
 const records=new Set();
 for(const path of Object.keys(patch))for(const domain of ['aguinaldos','ctaemp']){
  const root='sisventas/'+domain;
  if(path.startsWith(root+'/')&&path.split('/').length>=4)records.add(path.split('/').slice(0,4).join('/'));
  else if(path===root||path.startsWith(root+'/')||root.startsWith(path+'/')){
   const base=path.startsWith(root+'/')?path:root,[before,after]=await Promise.all([raw(base),get(base)]);
   if(base===root){for(const employee of new Set([...Object.keys(before||{}),...Object.keys(after||{})]))for(const key of new Set([...Object.keys(before?.[employee]||{}),...Object.keys(after?.[employee]||{})]))records.add(root+'/'+employee+'/'+key);}
   else for(const key of new Set([...Object.keys(before||{}),...Object.keys(after||{})]))records.add(base+'/'+key);
  }
 }
 for(const path of records){
  const [before,after]=await Promise.all([raw(path),get(path)]),isCTA=path.split('/')[1]==='ctaemp';
  const historical=value=>object(value)&&(!isCTA||String(value.tipo||'').trim().toLowerCase()==='aguinaldo');
  if(historical(after)&&!historical(before))throw fail('La aplicación ya registra SAC en Gastos. Una nueva marca histórica necesita revisión explícita.','SV_SAC_MIGRATION_REVIEW_REQUIRED',403);
 }
}
async function validateSACWrites({actor,raw,get,changes=[],patch={},digest}){
 const purpose=actor?.input?.purpose,grant=purpose===PURPOSE,migration=purpose===MIGRATION_PURPOSE;
 let approved=null;
 if(grant||migration){
  const action=grant?'empleados.registrarHaberes':'mantenimiento.migrar';
  if(actor.mode!=='user'||actor.claims?.uid!==actor.uid||actor.financialAction!==action||migration&&actor.role!=='admin')throw fail('El SAC requiere el permiso actual del usuario.','SV_SAC_ACCESS',403);
  approved=grant?describe(actor.input):describeMigration(actor.input);
  if(!samePatch(patch,actor.input.value))throw fail('El lote de SAC contiene cambios adicionales.');
  const values=await snapshots(approved.paths,raw);
  for(const path of approved.paths)if(digest(values[path])!==actor.input.expectedHashes[path])throw fail('Una fuente del SAC cambió. Volvé a comprobar el semestre.','SV_CAS_CONFLICT',409);
  if(grant){
   for(const row of approved.rows){
    if(current(values,row.path)!==null)throw fail('Ese SAC ya existe. Se conservaron sus importes y pagos.','SV_SAC_BATCH_CONFLICT',409);
    const employee=current(values,'sisventas/empleados/'+row.employee);
    if(!object(employee)||employee.activo===false||employee.fbKey&&employee.fbKey!==row.employee)throw fail('Uno de los empleados ya no está disponible.','SV_SAC_EMPLOYEE_UNAVAILABLE',409);
    canonicalNew(row.value,employee,row);
    let best=0;for(const month of row.months){const salary=current(values,'sisventas/haberes/'+row.employee+'/'+month+'/sueldo');if(salary&&salary>best)best=salary;}
    if(best===0){
     if(employee.cargoId&&!covered(approved.paths,'sisventas/config/cargos/'+employee.cargoId))throw fail('Falta comprobar el cargo usado para calcular el SAC.');
     const cargo=employee.cargoId?current(values,'sisventas/config/cargos/'+employee.cargoId):null;
     best=cargo?Math.round((parseFloat(cargo.valorHora)||0)*8*(parseFloat(cargo.diasMes)||0)):0;
    }
    // Preserve the canonical legacy coercions and month comparison exactly.
    // A manual maximum may lower the SAC, but may not raise its source ceiling.
    const monthsWorked=employee.fechaIngreso?row.months.filter(month=>month.replace('_','-')>=String(employee.fechaIngreso).slice(0,7)).length:6;
    const total=Math.round(((best/12)*monthsWorked)*100)/100;
    if(!same(row.value.mejorSueldo??null,best||null)||!Number.isFinite(total)||row.value.monto>total)throw fail('El importe o mejor sueldo del SAC no coincide con sus fuentes actuales.');
   }
  }else{
   const expenses=values['sisventas/gastos']||{},entries=[];
   for(const path of approved.sourcePaths){
    const descriptor=Legacy.describe(path),source=current(values,path),next=actor.input.value[path];
    if(next===undefined)continue; // Already linked selected rows need no write.
    const candidates=Object.entries({...expenses,...Object.fromEntries(Object.entries(patch).filter(([p])=>p.startsWith('sisventas/gastos/')).map(([p,v])=>[p.split('/')[2],v]))}).filter(([key,value])=>key===next.gastoFbKey||key===descriptor.expenseKey||value?.legacyKey===descriptor.legacyKey);
    if(candidates.length!==1)throw fail('No se pudo comprobar el gasto vinculado al origen histórico.','SV_SAC_MIGRATION_REVIEW_REQUIRED',409);
    const expense=candidates[0][1];
    entries.push({sourcePath:path,source,employeeName:expense.empleadoNombre||'',fallbackDate:expense.fecha,stamp:next.migradoTs});
   }
   let plan;try{plan=Legacy.planBatch({entries,gastos:expenses});}catch(error){throw fail(error.message,'SV_SAC_MIGRATION_REVIEW_REQUIRED',409);}
   if(!samePatch(plan.patch,patch))throw fail('La migración no coincide con su origen y pagos comprobados.','SV_SAC_MIGRATION_REVIEW_REQUIRED',409);
  }
 }
 for(const change of changes){
  if(change.domain!=='gastos'||sac(change.before)||!sac(change.after))continue;
  if(!grant&&!migration)throw fail('Actualizá la aplicación para registrar el SAC con sus fuentes y permiso actuales.',change.after.origenLegacy?'SV_SAC_MIGRATION_REVIEW_REQUIRED':'SV_SAC_PURPOSE_REQUIRED',403);
 }
 await forbidFabricatedSources({actor,raw,get,patch,migration});
 return approved;
}
module.exports={PURPOSE,MIGRATION_PURPOSE,describe,describeMigration,validateSACWrites};
