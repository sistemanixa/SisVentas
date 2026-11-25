(function(root,factory){'use strict';const create=factory();if(typeof module==='object'&&module.exports)module.exports={create};if(root&&!root.SVOTMetadata)root.SVOTMetadata=create(root);})(typeof window==='object'?window:null,function(){
'use strict';
const key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const schedule=['fecha','hora','horaFin','duracion'],details=['dir','direccion','direccionPersonalizada','tipoVisita','obs','prioridad'],signatures=['firmaClienteUrl','firmaUrl','firmaURL','firmaBase64','firmaCliente','firma','firmaStoragePath','firmada','fechaFirma','firmaTecnicoUrl','firmaTecnicoBase64','firmaTecnico','firmaTecnicoStoragePath','firmadaTecnico','fechaFirmaTecnico','conformidadCliente'];
const ignored=['fbKey','audit','_svListRevision','_svListOperation','_svReadRevision'];
const canonical=v=>v==null?'null':Array.isArray(v)?'['+v.map(canonical).join(',')+']':typeof v==='object'?'{'+Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const equal=(a,b)=>canonical(a)===canonical(b),copy=v=>structuredClone(v),fail=()=>Error('La OT cambió o contiene cambios fuera del guardado seguro. Volvé a abrirla.');
function classify(original,draft){
 const groups=new Map(),notes=[];let start=false;
 const add=(kind,field,value)=>{if(!groups.has(kind))groups.set(kind,{});groups.get(kind)[field]=value===undefined?null:copy(value);};
 for(const field of new Set([...Object.keys(original),...Object.keys(draft)])){
  if(ignored.includes(field)||equal(original[field],draft[field]))continue;
  if(schedule.includes(field))add('schedule',field,draft[field]);
  else if(details.includes(field))add('details',field,draft[field]);
  else if(field==='obsTecnico')add('work',field,draft[field]);
  else if(signatures.includes(field))add('signature',field,draft[field]);
  else if(field==='checks')add('checklist',field,draft[field]);
  else if(field==='progreso')continue;
  else if(['estado','fechaInicio'].includes(field)){if(field==='estado'&&draft[field]!=='en_progreso'||field==='fechaInicio'&&original.fechaInicio)throw fail();start=true;}
  else if(field==='notasTecnico'){
   const before=original[field]||{},after=draft[field]||{};if(typeof after!=='object'||Array.isArray(after)&&!Array.isArray(before))throw fail();
   for(const id of new Set([...Object.keys(before),...Object.keys(after)])){if(equal(before[id],after[id]))continue;if(!key(id))throw fail();const note=after[id];if(note==null){notes.push({kind:'note',changes:{key:id,note:null}});continue;}if(typeof note!=='object'||Array.isArray(note))throw fail();
    for(const name of Object.keys(note)){if(['texto','fotoUrl','fotoStoragePath'].includes(name))continue;if(name==='_firebaseKey'&&note[name]===id)continue;if(!before[id]&&['autor','rol','ts'].includes(name))continue;if(!['autor','autorUid','rol','ts'].includes(name)||!equal(note[name],before[id]?.[name]))throw fail();}
    const value={};for(const name of ['texto','fotoUrl','fotoStoragePath'])if(Object.hasOwn(note,name))value[name]=copy(note[name]);notes.push({kind:'note',changes:{key:id,note:value}});
   }
  }else throw fail();
 }
 if(!equal(original.progreso,draft.progreso)&&!groups.has('checklist'))throw fail();
 if(start){if(draft.estado!=='en_progreso')throw fail();groups.set('start',{});}
 const operations=[...groups].map(([kind,changes])=>({kind,changes})).concat(notes);if(operations.length>32)throw fail();return operations;
}
return function create(root){
 const busy=new Set();
 function session(){const uid=root.currentUserUid,user=root.fbAuth?.currentUser,role=root.currentRole,epoch=root._svOperacionesSesionEpoch||0,revision=root.PERMISOS_ROLES?.[role]?.indiceRevision;const check=()=>{if(!uid||user?.uid!==uid||root.currentUserUid!==uid||root.fbAuth?.currentUser!==user||root.currentRole!==role||(root._svOperacionesSesionEpoch||0)!==epoch||root.PERMISOS_ROLES?.[role]?.indiceRevision!==revision||root._impersonacionOriginal)throw Error('La sesión cambió.');};check();return{uid,check};}
 async function run(otKey,changes,context,full){
  if(!key(otKey)||busy.has(otKey))throw fail();const {uid,check}=session(),base=(root.SISVENTAS_FUNCTIONS?.cotizadorProveedor||'').replace(/\/$/,'');
  if(!base||!root.SVServiceAuth?.headers||!root.SVLaborWrites?.hash||!root.SVLaborWriteRecovery?.execute||!root.fbGet||!root.fbRef)throw Error('El guardado seguro de OT no está disponible.');
  busy.add(otKey);try{
   root.SVLaborWriteRecovery.assertAvailable();
   const headers=await root.SVServiceAuth.headers();check();const response=await root.fetch(base+'/ot/metadata/disponible?otKey='+encodeURIComponent(otKey)+'&kind=batch',{method:'GET',headers,cache:'no-store',signal:AbortSignal.timeout(20000)}),available=await response.json();check();
   if(!response.ok||available.ok!==true||available.version!==1)throw fail();if(available.installed===false)return Object.freeze({installed:false});
   if(available.installed!==true||available.ready!==true||available.otKey!==otKey||!Number.isSafeInteger(available.otRevision)||available.otRevision<0||!/^[a-f0-9]{64}$/.test(available.expectedOTHash||''))throw fail();
   const read=async()=>{const value=(await root.fbGet(root.fbRef(root.fbDB,'sisventas/ordenes_trabajo/'+otKey))).val();check();if(!value||typeof value!=='object'||Array.isArray(value))throw fail();return value;};
   const original=await read();if(original._svListSummary||original._svPagedSummary||(original._svListRevision??0)!==available.otRevision||await root.SVLaborWrites.hash(original)!==available.expectedOTHash)throw fail();check();
   if(!context||context._svListSummary||context._svPagedSummary||context.fbKey!==otKey||(context._svListRevision??0)!==available.otRevision)throw fail();
   if(!full){const clean=copy(context);if(!Object.hasOwn(original,'fbKey'))delete clean.fbKey;if(!Object.hasOwn(original,'_svReadRevision'))delete clean._svReadRevision;if(await root.SVLaborWrites.hash(clean)!==available.expectedOTHash)throw fail();check();}
   const draft=copy(original);
   for(const [field,value]of Object.entries(changes||{})){
    if(field.includes('/')){const parts=field.split('/');if(parts.length!==2||parts[0]!=='notasTecnico'||!key(parts[1]))throw fail();if(Object.hasOwn(changes,'notasTecnico'))throw fail();draft.notasTecnico=copy(draft.notasTecnico||{});if(value===null)delete draft.notasTecnico[parts[1]];else draft.notasTecnico[parts[1]]=copy(value);}
    else draft[field]=copy(value);
   }
   const operations=classify(original,draft);
   if(!operations.length)return{installed:true,confirmed:true,noop:true,ot:{...original,fbKey:otKey}};
   const command={id:root.crypto.randomUUID(),otKey,expectedOTHash:available.expectedOTHash,kind:'batch',changes:{operations}},digest=await root.SVLaborWrites.hash(command);check();
   const send=async()=>{const headers=await root.SVServiceAuth.headers({'Content-Type':'application/json'});check();const response=await root.fetch(base+'/ot/metadata',{method:'POST',headers,body:JSON.stringify(command),cache:'no-store',signal:AbortSignal.timeout(90000)}),data=await response.json();check();if(!response.ok||data.ok!==true||data.committed!==true||data.operationId!==command.id)throw Object.assign(Error(data.mensaje||'No se confirmó el guardado.'),{statusCode:response.status,code:data.code,...(data.svLaborAttempted===false?{svLaborAttempted:false}:{})});return data;};
   const result=await root.SVLaborWriteRecovery.execute({uid,id:command.id,digest},send,check);check();if(result?.ok!==true||result.committed!==true||(!result.recovered&&result.operationId!==command.id))throw fail();
   let current;try{current=result.recovered?await read():result.ot||await read();}catch(error){throw Object.assign(error,{confirmed:true,operationId:command.id});}
   return{installed:true,confirmed:true,operationId:command.id,ot:{...current,fbKey:otKey}};
  }finally{busy.delete(otKey);}
 }
 return Object.freeze({save:draft=>run(draft?.fbKey,draft,draft,true),update:(otKey,changes,knownOriginalContext)=>run(otKey,changes,knownOriginalContext,false)});
};
});
