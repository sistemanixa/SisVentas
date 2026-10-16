(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVProjectsModel=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const stages={relevamiento:'Relevamiento',planificacion:'Planificación',presupuestando:'Presupuestando',presentado:'Presentado',aprobado:'Aprobado',descartado:'Descartado'};
 const needStates={pendiente:'A definir',revisar:'Por verificar',definido:'Definido'};
 const kinds={equipo:'Equipo',material:'Material',mano:'Mano de obra',tarea:'Tarea'};
 const fail=(code,message)=>{throw Object.assign(Error(message),{statusCode:code});};
 const text=(v,max,required=false)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail(400,'Completá los campos requeridos y respetá su longitud');return v.trim();};
 const key=v=>{if(typeof v!=='string'||!v||v.length>128||/[.#$\[\]\/\u0000-\u001f]/.test(v)||['__proto__','constructor','prototype','hasOwnProperty'].includes(v))fail(400,'Identificador inválido');return v;};
 const clean=v=>JSON.parse(JSON.stringify(v));
 // RTDB omite arrays vacíos y campos null; también puede devolver arrays como mapas.
 function hydrate(value){const p=clean(value);p.needs=Object.values(p.needs||{}).map(n=>({...n,qty:n.qty??null}));p.budgets=Object.values(p.budgets||{}).map(b=>({...b,needIds:Object.values(b.needIds||{})}));p.activity=Object.values(p.activity||{});return p;}
 const view=(p,a)=>!!p&&!!a?.enabled&&(a.role==='admin'||!!p?.members&&Object.hasOwn(p.members,a.uid));
 const edit=(p,a)=>view(p,a)&&a.editAllowed!==false&&(a.role==='admin'||p.owner===a.uid||p.members[a.uid]?.access==='editor');
 const manage=(p,a)=>edit(p,a)&&(a.role==='admin'||p.owner===a.uid);
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
  if(command.type==='update'){
   const client=d.clientId?key(d.clientId):'';if(client!==p.clientId&&p.budgets.some(b=>b.kind==='linked'))fail(409,'Quitá los vínculos de presupuestos antes de cambiar el cliente');
   p.name=text(d.name,120,true);p.clientId=client;p.clientName=text(d.clientName||'',160);p.address=text(d.address||'',240);p.goal=text(d.goal||'',2000);p.due=text(d.due||'',10);
   if(!Object.hasOwn(stages,d.stage))fail(400,'Estado inválido');p.stage=d.stage;action='Ficha actualizada';
  }else if(command.type==='members'){
   if(!manage(p,actor))fail(403,'Solo el responsable o un administrador puede cambiar integrantes');p.members=memberMap(command.members,p.owner,ctx.directory);action='Integrantes actualizados';
  }else if(command.type==='need-save'){
   const quantity=d.qty===''||d.qty==null?null:Number(d.qty);if(quantity!==null&&(!Number.isFinite(quantity)||quantity<=0||quantity>100000))fail(400,'La cantidad debe ser mayor que cero');
   if(!Object.hasOwn(kinds,d.kind)||!Object.hasOwn(needStates,d.status))fail(400,'Tipo o estado de necesidad inválido');
   const n={id:d.id?key(d.id):key(id),area:text(d.area||'General',80,true),title:text(d.title,200,true),kind:d.kind,qty:quantity,unit:text(d.unit||'unid.',24,true),status:d.status,notes:text(d.notes||'',1200),productId:d.productId?key(d.productId):''};
   const index=p.needs.findIndex(x=>x.id===n.id);if(d.id&&index<0)fail(404,'Necesidad no disponible');if(index<0){if(p.needs.length>=150)fail(400,'Máximo de 150 necesidades');p.needs.push(n);}else p.needs[index]=n;action=index<0?'Necesidad agregada':'Necesidad actualizada';
  }else if(command.type==='need-remove'){
   const id=key(command.id);if(p.budgets.some(b=>(b.needIds||[]).includes(id)))fail(409,'La necesidad está vinculada a un presupuesto. Quitá primero ese vínculo.');p.needs=p.needs.filter(n=>n.id!==id);action='Necesidad quitada';
  }else if(command.type==='budget-brief'){
   if(!actor.quoteAllowed)fail(403,'Tu rol no permite preparar presupuestos');
   if(!Array.isArray(d.needIds)||!d.needIds.length||new Set(d.needIds).size!==d.needIds.length||d.needIds.some(n=>!p.needs.some(x=>x.id===n)))fail(400,'Elegí necesidades del proyecto');
   if(p.budgets.length>=30)fail(400,'Máximo de 30 presupuestos');p.budgets.push({id:key(id),kind:'brief',title:text(d.title,140,true),notes:text(d.notes||'',1200),needIds:d.needIds,createdAt:now});action='Borrador preparado';
  }else if(command.type==='budget-link'){
   if(!actor.quoteAllowed)fail(403,'Tu rol no permite vincular presupuestos');
   const quote=ctx.quote;if(!quote)fail(404,'Presupuesto no disponible');if(!p.clientId||quote.clientId!==p.clientId)fail(400,'El presupuesto debe pertenecer al cliente del proyecto');
   if(p.budgets.some(b=>b.sourceId===quote.id))fail(409,'Ese presupuesto ya está vinculado');
   const b={id:key(id),kind:'linked',title:quote.title,sourceId:key(quote.id),needIds:[],createdAt:now};
   if(d.briefId){const brief=p.budgets.find(x=>x.id===d.briefId&&x.kind==='brief');if(!brief)fail(404,'Borrador no disponible');b.needIds=brief.needIds;b.id=brief.id;p.budgets=p.budgets.filter(x=>x.id!==brief.id);}
   if(p.budgets.length>=30)fail(400,'Máximo de 30 presupuestos');p.budgets.push(b);action='Presupuesto vinculado';
  }else if(command.type==='budget-remove'){
   if(!actor.quoteAllowed)fail(403,'Tu rol no permite cambiar presupuestos');p.budgets=p.budgets.filter(b=>b.id!==key(command.id));action='Vínculo de presupuesto quitado';
  }else if(!['create','update','members'].includes(command.type))fail(400,'Acción no disponible');
  if(p.due&&!/^\d{4}-\d{2}-\d{2}$/.test(p.due))fail(400,'Fecha objetivo inválida');
  p.revision++;p.updatedAt=now;p.activity=[{id:key(id),at:now,actor:actor.name,action},...p.activity].slice(0,60);
  if(new TextEncoder().encode(JSON.stringify(p)).length>220000)fail(413,'El proyecto supera el tamaño permitido');return p;
 }
 function project(p,actor,quotes=[]){
  if(!view(p,actor))fail(404,'Proyecto no disponible');const result=hydrate(p);
  result.access={edit:edit(p,actor),manage:manage(p,actor),quote:edit(p,actor)&&!!actor.quoteAllowed};
  result.budgets=result.budgets.map(b=>{
   if(!actor.quoteAllowed)return {id:b.id,kind:'restricted',title:'Presupuesto vinculado',needIds:[]};
   if(b.kind==='brief')return b;const q=quotes.find(q=>q.id===b.sourceId);return q?{...b,quote:clean(q)}:{id:b.id,kind:'restricted',title:'Presupuesto vinculado',needIds:[]};
  });return result;
 }
 function stats(p){const all=p.needs.length,defined=p.needs.filter(n=>n.status==='definido').length;return {all,defined,pending:all-defined,areas:new Set(p.needs.map(n=>n.area)).size,percent:all?Math.round(defined/all*100):0};}
 return {stages,needStates,kinds,apply,project,view,edit,manage,stats,key};
});
