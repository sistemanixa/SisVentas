(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVProjectsModel=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const stages={relevamiento:'Relevamiento',planificacion:'Planificación',presupuestando:'Presupuestando',presentado:'Presentado',aprobado:'Aprobado',en_ejecucion:'En ejecución',finalizado:'Finalizado',descartado:'Descartado'};
 const needStates={pendiente:'A definir',revisar:'Por verificar',definido:'Definido'};
 const kinds={equipo:'Equipo',material:'Material',mano:'Mano de obra',tarea:'Tarea'};
 const fail=(code,message)=>{throw Object.assign(Error(message),{statusCode:code});};
 const text=(v,max,required=false)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail(400,'Completá los campos requeridos y respetá su longitud');return v.trim();};
 const key=v=>{if(typeof v!=='string'||!v||v.length>128||/[.#$\[\]\/\u0000-\u001f]/.test(v)||['__proto__','constructor','prototype','hasOwnProperty'].includes(v))fail(400,'Identificador inválido');return v;};
 const clean=v=>JSON.parse(JSON.stringify(v));
 // RTDB omite arrays vacíos y campos null; también puede devolver arrays como mapas.
 function hydrate(value){const p=clean(value);p.needs=Object.values(p.needs||{}).map(n=>({...n,qty:n.qty??null}));p.budgets=Object.values(p.budgets||{}).map(b=>({...b,needIds:Object.values(b.needIds||{})}));p.activity=Object.values(p.activity||{});p.materials=Object.values(p.materials||{});p.archivedNeeds=Object.values(p.archivedNeeds||{});return p;}
 const view=(p,a)=>!!p&&!!a?.enabled&&(a.role==='admin'||!!p?.members&&Object.hasOwn(p.members,a.uid));
 const edit=(p,a)=>view(p,a)&&a.editAllowed!==false&&(a.role==='admin'||p.owner===a.uid||p.members[a.uid]?.access==='editor');
 const manage=(p,a)=>edit(p,a)&&(a.role==='admin'||p.owner===a.uid);
 const execute=(p,a)=>edit(p,a)&&p.stage!=='finalizado';
 const commercial=a=>a?.role!=='tecnico'&&a?.quoteAllowed===true;
 function memberMap(input,owner,directory){
  if(!Array.isArray(input)||input.length>40)fail(400,'Seleccioná hasta 40 integrantes');
  const out=Object.create(null);
  for(const m of input){key(m.uid);if(!['viewer','editor'].includes(m.access))fail(400,'Acceso de integrante inválido');const person=directory.find(d=>d.uid===m.uid);if(!person)fail(400,'Hay un integrante inactivo o no disponible');if(out[m.uid])fail(400,'Integrante repetido');out[m.uid]={name:person.name,access:m.access};}
  const person=directory.find(d=>d.uid===owner);if(!person)fail(400,'El responsable ya no está disponible');out[owner]={name:person.name,access:'owner'};return clean(out);
 }
 function apply(previous,command,actor,ctx){
  if(!actor?.enabled)fail(403,'No tenés acceso a Proyectos');
  const now=ctx.now,id=ctx.id;let p;
  if(command.type==='create'){
   if(!actor.createAllowed)fail(403,'No podés crear proyectos');
   const d=command.data||{};p={id:key(id),number:'PR-'+id.replace(/-/g,'').slice(0,8).toUpperCase(),name:text(d.name,120,true),clientId:d.clientId?key(d.clientId):'',clientName:text(d.clientName||'',160),address:text(d.address||'',240),goal:text(d.goal||'',2000),due:text(d.due||'',10),stage:'planificacion',owner:actor.uid,members:memberMap(d.members||[],actor.uid,ctx.directory),needs:[],budgets:[],activity:[],createdAt:now,updatedAt:now,revision:0};
  }else{
   if(!previous||!view(previous,actor))fail(404,'Proyecto no disponible');if(!edit(previous,actor))fail(403,'Este proyecto es de solo lectura');
   if(!Number.isInteger(command.revision)||command.revision!==previous.revision)fail(409,'El proyecto cambió en otra sesión. Actualizá antes de guardar.');p=hydrate(previous);
  }
  const d=command.data||{};let action='Proyecto creado';
  if(p.stage==='finalizado'&&!['reopen','members'].includes(command.type))fail(409,'Reabrí el proyecto antes de modificarlo');
  if(command.type==='finish'||command.type==='reopen'){
   if(!manage(p,actor))fail(403,'Solo el responsable o un administrador puede cerrar o reabrir');
   const pending=p.needs.filter(n=>!n.execution?.completed).length,reason=text(d.reason||'',500,true);
   if(command.type==='finish'){if(pending&&d.confirmPending!==true)fail(409,'Quedan tareas pendientes. Confirmá el cierre con motivo');p.previousStage=p.stage;p.stage='finalizado';}else{if(p.stage!=='finalizado')fail(409,'El proyecto no está finalizado');p.stage=p.previousStage||'en_ejecucion';}
   p.closures=[...Object.values(p.closures||{}),{at:now,by:actor.uid,reason,pending,action:command.type}];action=command.type==='finish'?'Proyecto finalizado':'Proyecto reabierto';
  }else
  if(command.type==='update'){
   const client=d.clientId?key(d.clientId):'';if(client!==p.clientId&&p.budgets.some(b=>b.kind==='linked'))fail(409,'Quitá los vínculos de presupuestos antes de cambiar el cliente');
   p.name=text(d.name,120,true);p.clientId=client;p.clientName=text(d.clientName||'',160);p.address=text(d.address||'',240);p.goal=text(d.goal||'',2000);p.due=text(d.due||'',10);
   if(d.stage==='finalizado')fail(400,'Usá Finalizar proyecto para confirmar el cierre');if(!Object.hasOwn(stages,d.stage))fail(400,'Estado inválido');p.stage=d.stage;action='Ficha actualizada';
  }else if(command.type==='members'){
   if(!manage(p,actor))fail(403,'Solo el responsable o un administrador puede cambiar integrantes');p.members=memberMap(command.members,p.owner,ctx.directory);action='Integrantes actualizados';
  }else if(command.type==='need-save'){
   const quantity=d.qty===''||d.qty==null?null:Number(d.qty);if(quantity!==null&&(!Number.isFinite(quantity)||quantity<=0||quantity>100000))fail(400,'La cantidad debe ser mayor que cero');
   if(!Object.hasOwn(kinds,d.kind)||!Object.hasOwn(needStates,d.status))fail(400,'Tipo o estado de necesidad inválido');
   const n={id:d.id?key(d.id):key(id),area:text(d.area||'General',80,true),title:text(d.title,200,true),kind:d.kind,qty:quantity,unit:text(d.unit||'unid.',24,true),status:d.status,notes:text(d.notes||'',1200),productId:d.productId?key(d.productId):''};
   const index=p.needs.findIndex(x=>x.id===n.id);if(d.id&&index<0)fail(404,'Necesidad no disponible');if(index<0){if(p.needs.length>=150)fail(400,'Máximo de 150 necesidades');p.needs.push(n);}else p.needs[index]={...p.needs[index],...n};action=index<0?'Necesidad agregada':'Necesidad actualizada';
  }else if(command.type==='need-execution'){
   const n=p.needs.find(n=>n.id===key(d.id));if(!n)fail(404,'Necesidad no disponible');
   const e={...(n.execution||{})};if(Object.hasOwn(d,'completed')){if(typeof d.completed!=='boolean')fail(400,'Indicá si la tarea está realizada');e.completed=d.completed;e.completedAt=d.completed?now:null;e.completedBy=d.completed?actor.uid:null;}
   if(Object.hasOwn(d,'notes'))e.notes=text(d.notes,4000);e.updatedAt=now;e.updatedBy=actor.uid;n.execution=e;action=d.completed===true?'Tarea realizada':d.completed===false?'Tarea pendiente':'Información técnica actualizada';
  }else if(command.type==='need-photo'){
   const n=p.needs.find(n=>n.id===key(d.id));if(!n)fail(404,'Necesidad no disponible');const photo=ctx.photo;if(!photo||!ctx.photoValidated)fail(400,'Foto no validada');
   const photos=Object.values(n.execution?.photos||{});if(photos.length>=12)fail(400,'Máximo de 12 fotos por necesidad');if(photos.some(x=>x.id===photo.id))fail(409,'La foto ya está registrada');
   n.execution={...(n.execution||{}),photos:[...photos,clean(photo)],updatedAt:now,updatedBy:actor.uid};action='Foto técnica agregada';
  }else if(command.type==='photo-remove'){
   const n=p.needs.find(n=>n.id===key(d.id)),photo=Object.values(n?.execution?.photos||{}).find(x=>x.id===d.photoId);if(!photo)fail(404,'Foto no disponible');if(!manage(p,actor)&&photo.by!==actor.uid)fail(403,'Solo el autor o el responsable puede retirar la foto');const reason=text(d.reason||'',500,true);n.execution.archivedPhotos=[...Object.values(n.execution.archivedPhotos||{}),{...photo,removedAt:now,removedBy:actor.uid,reason}];n.execution.photos=Object.values(n.execution.photos||{}).filter(x=>x.id!==photo.id);action='Foto técnica retirada';
  }else if(command.type==='need-restore'){
   if(!manage(p,actor))fail(403,'Solo el responsable puede restaurar necesidades');const n=p.archivedNeeds.find(n=>n.id===key(d.id));if(!n)fail(404,'Necesidad archivada no disponible');if(p.needs.length>=150)fail(400,'Máximo de 150 necesidades');delete n.archivedAt;delete n.archivedBy;p.needs.push(n);p.archivedNeeds=p.archivedNeeds.filter(x=>x.id!==n.id);action='Necesidad restaurada';
  }else if(command.type==='materials-import'){
   if(!commercial(actor))fail(403,'Tu rol no permite elegir presupuestos');const sourceId=key(d.sourceId),linked=p.budgets.find(b=>b.kind==='linked'&&b.sourceId===sourceId),quote=ctx.quote;
   if(quote&&quote.clientId!==p.clientId)fail(409,'El presupuesto cambió de cliente. Revisá el vínculo');if(!linked||!quote||quote.id!==sourceId)fail(404,'Presupuesto vinculado no disponible');if(!['aprobado','aprobado_int','aceptado','convertido'].includes(quote.status))fail(409,'Elegí un presupuesto aprobado para preparar materiales');
   const previous=p.materials.filter(m=>m.sourceId===sourceId);const fresh=Object.values(quote.items||{}).filter(i=>i.operational===true);
   if(!fresh.length)fail(400,'El presupuesto no tiene materiales identificados');
   const ids=new Set(fresh.map(i=>i.lineId));if(previous.some(m=>!ids.has(m.sourceLineId)))fail(409,'El presupuesto cambió. Revisá los materiales ya incorporados');
   for(const i of fresh){const lineId=key(i.lineId),id=key(sourceId+'_'+lineId),planned=Number(i.qty);if(!Number.isFinite(planned)||planned<=0||planned>100000)fail(400,'Revisá la cantidad presupuestada');
    const old=p.materials.find(m=>m.id===id);const identity=text(i.sourceIdentity||JSON.stringify([i.code||'',i.description||'']),1000);if(old&&((old.sourceIdentity&&old.sourceIdentity!==identity)||old.code!==(i.code||'')||old.name!==(i.description||'Material')))fail(409,'La identidad del material cambió. Conservá la rendición anterior y revisá el presupuesto');if(old&&(old.used||0)+(old.returned||0)>planned)fail(409,'La nueva cantidad es menor que la ya rendida');
    const line={id,sourceId,sourceNumber:text(quote.number||'',80),sourceLineId:lineId,sourceIdentity:identity,code:text(i.code||'',80),name:text(i.description||'Material',200,true),photo:typeof i.photo==='string'&&/^https:\/\//.test(i.photo)?i.photo.slice(0,2000):'',planned,used:old?.used||0,returned:old?.returned||0,updatedAt:now,updatedBy:actor.uid};
    if(old)Object.assign(old,line);else p.materials.push(line);
   }if(p.materials.length>300)fail(400,'Máximo de 300 materiales');action='Materiales preparados';
  }else if(command.type==='material-use'){
   const m=p.materials.find(m=>m.id===key(d.id));if(!m)fail(404,'Material no disponible');const used=Number(d.used),returned=Number(d.returned);if(!Number.isFinite(used)||!Number.isFinite(returned)||used<0||returned<0||used+returned>m.planned)fail(400,'Lo utilizado y devuelto no puede superar la cantidad prevista');
   m.used=used;m.returned=returned;m.updatedAt=now;m.updatedBy=actor.uid;action='Uso de materiales actualizado';
  }else if(command.type==='need-remove'){
   const id=key(command.id);if(p.budgets.some(b=>(b.needIds||[]).includes(id)))fail(409,'La necesidad está vinculada a un presupuesto. Quitá primero ese vínculo.');const n=p.needs.find(n=>n.id===id);if(!n)fail(404,'Necesidad no disponible');p.archivedNeeds.push({...n,archivedAt:now,archivedBy:actor.uid});p.needs=p.needs.filter(n=>n.id!==id);action='Necesidad archivada';
  }else if(command.type==='budget-brief'){
   if(!commercial(actor))fail(403,'Tu rol no permite preparar presupuestos');
   if(!Array.isArray(d.needIds)||!d.needIds.length||new Set(d.needIds).size!==d.needIds.length||d.needIds.some(n=>!p.needs.some(x=>x.id===n)))fail(400,'Elegí necesidades del proyecto');
   if(p.budgets.length>=30)fail(400,'Máximo de 30 presupuestos');p.budgets.push({id:key(id),kind:'brief',title:text(d.title,140,true),notes:text(d.notes||'',1200),needIds:d.needIds,createdAt:now});action='Borrador preparado';
  }else if(command.type==='budget-link'){
   if(!commercial(actor))fail(403,'Tu rol no permite vincular presupuestos');
   const quote=ctx.quote;if(!quote)fail(404,'Presupuesto no disponible');if(!p.clientId||quote.clientId!==p.clientId)fail(400,'El presupuesto debe pertenecer al cliente del proyecto');
   if(p.budgets.some(b=>b.sourceId===quote.id))fail(409,'Ese presupuesto ya está vinculado');
   const b={id:key(id),kind:'linked',title:quote.title,sourceId:key(quote.id),needIds:[],createdAt:now};
   if(d.briefId){const brief=p.budgets.find(x=>x.id===d.briefId&&x.kind==='brief');if(!brief)fail(404,'Borrador no disponible');b.needIds=brief.needIds;b.id=brief.id;p.budgets=p.budgets.filter(x=>x.id!==brief.id);}
   if(p.budgets.length>=30)fail(400,'Máximo de 30 presupuestos');p.budgets.push(b);action='Presupuesto vinculado';
  }else if(command.type==='budget-remove'){
   if(!commercial(actor))fail(403,'Tu rol no permite cambiar presupuestos');const source=p.budgets.find(b=>b.id===command.id);if(source&&p.materials.some(m=>m.sourceId===source.sourceId))fail(409,'El presupuesto tiene materiales preparados. Conservá el vínculo para mantener su origen');p.budgets=p.budgets.filter(b=>b.id!==key(command.id));action='Vínculo de presupuesto quitado';
  }else if(!['create','update','members'].includes(command.type))fail(400,'Acción no disponible');
  if(p.due&&!/^\d{4}-\d{2}-\d{2}$/.test(p.due))fail(400,'Fecha objetivo inválida');
  p.revision++;p.updatedAt=now;p.activity=[{id:key(id),at:now,actor:actor.name,action},...p.activity].slice(0,60);
  if(new TextEncoder().encode(JSON.stringify(p)).length>220000)fail(413,'El proyecto supera el tamaño permitido');return p;
 }
 function project(p,actor,quotes=[]){
  if(!view(p,actor))fail(404,'Proyecto no disponible');const result=hydrate(p);result.pendingPhotos=Object.values(p._pendingPhotos||{}).filter(x=>x.by===actor.uid||manage(p,actor)).map(x=>Object.fromEntries(['id','needId','name','type','size','createdAt','by','thumbnail'].filter(k=>Object.hasOwn(x,k)).map(k=>[k,x[k]])));delete result._creationRequest;delete result._creationSignature;delete result._pendingPhotos;delete result._listProjectionPending;delete result._listProjectionScopes;
  result.access={execute:execute(p,actor),edit:edit(p,actor),manage:manage(p,actor),commercial:commercial(actor),quote:edit(p,actor)&&commercial(actor)};
  if(actor.role==='tecnico'){
   const operational=['id','number','name','clientId','clientName','address','goal','due','stage','owner','members','needs','materials','activity','createdAt','updatedAt','revision','access'];
   const safe=Object.fromEntries(operational.filter(k=>Object.hasOwn(result,k)).map(k=>[k,result[k]]));
   safe.pendingPhotos=result.pendingPhotos;if(result.summary)safe.summary={all:result.summary.all,defined:result.summary.defined,done:result.summary.done};safe.budgets=[];safe.materials=result.materials.map(m=>Object.fromEntries(['id','sourceId','sourceNumber','sourceLineId','code','name','photo','planned','used','returned','updatedAt','updatedBy'].filter(k=>Object.hasOwn(m,k)).map(k=>[k,m[k]])));
   const needFields=['id','area','title','kind','qty','unit','status','notes','productId','execution'];
   safe.needs=result.needs.map(n=>{const safe=Object.fromEntries(needFields.filter(k=>k!=='execution'&&Object.hasOwn(n,k)).map(k=>[k,n[k]]));if(n.execution){safe.execution=Object.fromEntries(['completed','completedAt','completedBy','notes','updatedAt','updatedBy'].filter(k=>Object.hasOwn(n.execution,k)).map(k=>[k,n.execution[k]]));safe.execution.photos=Object.values(n.execution.photos||{}).map(p=>Object.fromEntries(['id','name','type','size','createdAt','by','thumbnail'].filter(k=>Object.hasOwn(p,k)).map(k=>[k,p[k]])));}return safe;});
   const operationalActions=['Proyecto creado','Ficha actualizada','Integrantes actualizados','Necesidad agregada','Necesidad actualizada','Necesidad quitada','Tarea realizada','Tarea pendiente','Información técnica actualizada','Foto técnica agregada','Proyecto finalizado','Proyecto reabierto','Necesidad archivada','Materiales preparados','Uso de materiales actualizado'];
   safe.activity=result.activity.filter(a=>operationalActions.includes(a.action)).map(a=>Object.fromEntries(['id','at','actor','action'].filter(k=>Object.hasOwn(a,k)).map(k=>[k,a[k]])));return safe;
  }
  result.budgets=result.budgets.map(b=>{
   if(!commercial(actor))return {id:b.id,kind:'restricted',title:'Presupuesto vinculado',needIds:[]};
   if(b.kind==='brief')return b;const q=quotes.find(q=>q.id===b.sourceId);return q?{...b,quote:clean(q)}:{id:b.id,kind:'restricted',title:'Presupuesto vinculado',needIds:[]};
  });return result;
 }
 function stats(p){if(p.summary){const {all,defined}=p.summary;return {all,defined,pending:all-defined,areas:0,percent:all?Math.round(defined/all*100):0};}const all=p.needs.length,defined=p.needs.filter(n=>n.status==='definido').length;return {all,defined,pending:all-defined,areas:new Set(p.needs.map(n=>n.area)).size,percent:all?Math.round(defined/all*100):0};}
 return {stages,needStates,kinds,apply,project,view,edit,execute,manage,commercial,stats,key};
});
