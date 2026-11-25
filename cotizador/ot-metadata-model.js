'use strict';
const {digest}=require('./labor-guard'),Lifecycle=require('./ot-lifecycle-model');
const defaults={editar:['admin','administrativo','tecnico_vendedor','tecnico'],editarDatosAdministrativos:['admin','administrativo','vendedor','tecnico_vendedor']};
const details=['dir','direccion','direccionPersonalizada','fecha','hora','horaFin','duracion','tipoVisita','obs','prioridad'];
const schedule=['fecha','hora','horaFin','duracion'];
const signatures=['firmaClienteUrl','firmaUrl','firmaURL','firmaBase64','firmaCliente','firma','firmaStoragePath','firmada','fechaFirma','firmaTecnicoUrl','firmaTecnicoBase64','firmaTecnico','firmaTecnicoStoragePath','firmadaTecnico','fechaFirmaTecnico','conformidadCliente'];
const counts={preparacion:5,instalacion:3,verificacion:6};
const fail=(message,statusCode=409)=>Object.assign(Error(message),{statusCode,code:'SV_OT_METADATA_INVALID'}),key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['__proto__','prototype','constructor'].includes(v);
const kinds=['details','schedule','checklist','start','signature','note','work','batch'];
function operations(changes){
 if(!changes||Object.keys(changes).length!==1||!Array.isArray(changes.operations)||!changes.operations.length||changes.operations.length>32)throw fail('El lote requiere entre 1 y 32 operaciones.');
 const paths=new Set();for(const op of changes.operations){if(!op||Object.keys(op).sort().join(',')!=='changes,kind'||!kinds.includes(op.kind)||op.kind==='batch')throw fail('Operación de lote inválida.');const fields=op.kind==='note'?['notasTecnico/'+op.changes?.key]:op.kind==='start'?['estado','fechaInicio']:op.kind==='checklist'?['checks','progreso']:Object.keys(op.changes||{});for(const field of fields){if(paths.has(field))throw fail('El lote contiene campos solapados.');paths.add(field);}}return changes.operations;
}
function authority(profile,cfg,kind,changes){
 if(!kinds.includes(kind))throw fail('Operación inválida.');
 const ops=kind==='batch'&&changes!==undefined?operations(changes):[];
 const role=profile?.rol,action=kind==='details'?'editarDatosAdministrativos':'editar';
 if(profile?.activo!==true||!['admin','administrativo','tecnico_vendedor','tecnico','vendedor'].includes(role)||!cfg||cfg.indiceVersion!==2||cfg.indiceModulos?.ordentrabajo!==true||Object.values(cfg.bloqueados||{}).includes('ordentrabajo'))throw fail('No tenés acceso a la OT.',403);
 const allowed=typeof cfg.acciones?.ot?.[action]==='boolean'?cfg.acciones.ot[action]:defaults[action].includes(role);if(kind!=='batch'&&!allowed)throw fail('No tenés permiso para guardar estos datos de la OT.',403);
 for(const op of ops)authority(profile,cfg,op.kind,op.changes);
 return{role,permissionRevision:cfg.indiceRevision??null,permissionDigest:digest(cfg)};
}
function plan({ot,kind,changes,actor,at}){
 if(!ot||typeof ot!=='object'||Array.isArray(ot)||ot._svListSummary||ot._svPagedSummary||!key(actor?.uid)||typeof actor.name!=='string'||!actor.name.trim()||!Number.isFinite(Date.parse(at)))throw fail('Hace falta la OT y la identidad originales.');
 if(kind==='batch'){let next=structuredClone(ot),patch={};for(const op of operations(changes)){const result=plan({ot:next,...op,actor,at});next=result.next;Object.assign(patch,result.patch);}return{next,patch};}
 if(!changes||typeof changes!=='object'||Array.isArray(changes)||!kinds.includes(kind))throw fail('El cambio de OT no es válido.');
 const fields=kind==='work'?['obsTecnico']:kind==='details'?details:kind==='schedule'?schedule:kind==='signature'?signatures:kind==='checklist'?['checks']:kind==='note'?['key','note']:[];
 if(Object.keys(changes).some(field=>!fields.includes(field)))throw fail('El cambio contiene campos fuera de su operación.');
 const next=structuredClone(ot),patch={};
 if(['checklist','start'].includes(kind)&&Lifecycle.closed(ot))throw fail('La OT finalizada no permite cambiar su checklist o inicio.');
 if(kind==='checklist'){
  const checks=changes.checks;if(!checks||typeof checks!=='object'||Array.isArray(checks)||Object.keys(checks).length!==3)throw fail('El checklist requiere sus tres etapas originales.');
  for(const [phase,count]of Object.entries(counts))if(!Array.isArray(checks[phase])||checks[phase].length!==count||checks[phase].some(value=>typeof value!=='boolean'))throw fail('Los controles del checklist no son válidos.');
  patch.checks=structuredClone(checks);patch.progreso=Math.round(Object.values(checks).flat().filter(Boolean).length/14*100);
 }else if(kind==='start'){
  patch.estado='en_progreso';patch.fechaInicio=ot.fechaInicio||at;
 }else if(kind==='note'){
  if(!key(changes.key)||!Object.hasOwn(changes,'note'))throw fail('La nota no tiene una clave válida.');
  const before=ot.notasTecnico?.[changes.key],note=changes.note,isManager=['admin','administrativo'].includes(actor.role);
  if(before&&!isManager&&before.autorUid!==actor.uid)throw fail('Sólo podés modificar tus propias notas identificadas.',403);
  if(note===null){if(!before)throw fail('La nota ya no existe.');patch['notasTecnico/'+changes.key]=null;}
  else{
   if(!note||typeof note!=='object'||Array.isArray(note)||Object.keys(note).some(field=>!['texto','fotoUrl','fotoStoragePath'].includes(field))||typeof note.texto!=='string'||note.texto.length>10000||(!note.texto.trim()&&!note.fotoUrl))throw fail('El contenido de la nota no es válido.');
   for(const field of ['fotoUrl','fotoStoragePath'])if(note[field]!=null&&(typeof note[field]!=='string'||note[field].length>10000))throw fail('La referencia de la foto no es válida.');
   patch['notasTecnico/'+changes.key]={...structuredClone(note),autor:before?.autor||actor.name,rol:before?.rol||actor.role,...(before?before.autorUid?{autorUid:before.autorUid}:{}:{autorUid:actor.uid}),...(before?before.ts!=null?{ts:before.ts}:{}:{ts:Date.parse(at)})};
  }
 }else{
  for(const [field,value]of Object.entries(changes)){
   if(['prioridad','direccionPersonalizada','firmada','firmadaTecnico'].includes(field)){if(value!==null&&typeof value!=='boolean')throw fail('El indicador de la OT no es válido.');}
   else if(value!==null&&(typeof value!=='string'||value.length>(field.toLowerCase().includes('firma')?2000000:10000)))throw fail('El texto de la OT no es válido.');
   if(kind==='signature'&&field==='conformidadCliente'&&Lifecycle.closed(ot)&&value!==ot[field])throw fail('La conformidad de una OT cerrada requiere su circuito de cierre.');
   patch[field]=structuredClone(value);
  }
 }
 // Audit authorship and timestamps are server values, never a client trail.
 patch.audit=[...(Array.isArray(ot.audit)?structuredClone(ot.audit):[]),{fecha:at,usuario:actor.name,uid:actor.uid,accion:'OT: '+kind}];
 for(const [field,value]of Object.entries(patch)){if(field.startsWith('notasTecnico/')){next.notasTecnico=structuredClone(next.notasTecnico)||{};const id=field.split('/')[1];if(value===null)delete next.notasTecnico[id];else next.notasTecnico[id]=value;}else if(value===null)delete next[field];else next[field]=value;}
 return{next,patch};
}
module.exports={authority,plan,operations,kinds,details,schedule,signatures};
