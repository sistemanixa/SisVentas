'use strict';
// Server-only projections. A dirty flag belongs to the same transaction as the
// original; monotonic rows prevent a slow older writer restoring revoked access.
function createProjectListStore(db){
 const scopes=p=>['all',...Object.keys(p.members||{}).map(uid=>'u_'+uid)];
 const summary=p=>({id:p.id,number:p.number,name:p.name,clientName:p.clientName||'',address:p.address||'',goal:p.goal||'',stage:p.stage,due:p.due||'',owner:p.owner,members:p.members,updatedAt:p.updatedAt,revision:p.revision,needs:[],budgets:[],activity:[],materials:[],summary:{all:Object.values(p.needs||{}).length,defined:Object.values(p.needs||{}).filter(n=>n.status==='definido').length,done:Object.values(p.needs||{}).filter(n=>n.execution?.completed).length,budgets:Object.values(p.budgets||{}).length},order:String(9999999999999-p.updatedAt).padStart(13,'0')+'_'+p.id});
 function mark(next,old){next._listProjectionPending=true;next._listProjectionScopes=[...new Set([...Object.values(old?._listProjectionScopes||{}),...(old?scopes(old):[]),...scopes(next)])];return next;}
 async function sync(p){const active=new Set(scopes(p)),row=summary(p);for(const scope of Object.values(p._listProjectionScopes||scopes(p))){await db.ref('sv_project_lists/'+scope+'/'+p.id).transaction(old=>old&&old.revision>p.revision?undefined:active.has(scope)?row:{id:p.id,revision:p.revision,removed:true,order:'~'+p.id},undefined,false);}if(p._listProjectionPending===true)await db.ref('sv_proyectos/'+p.id).transaction(current=>current?.revision===p.revision?{...current,_listProjectionPending:false,_listProjectionScopes:scopes(current)}:undefined,undefined,false);}
 async function list(actor,cursor=''){
  const cfg=(await db.ref('sv_project_list_config').get()).val();if(cfg?.ready!==true)throw Object.assign(Error('El listado de proyectos se está preparando. Reintentá en unos instantes.'),{statusCode:503});
  const dirty=(await db.ref('sv_proyectos').orderByChild('_listProjectionPending').equalTo(true).limitToFirst(11).get()).val()||{};
  for(const p of Object.values(dirty).slice(0,10))await sync(p);if(Object.keys(dirty).length>10)throw Object.assign(Error('Hay proyectos pendientes de actualizar. Reintentá en unos instantes.'),{statusCode:503});
  let query=db.ref('sv_project_lists/'+(actor.role==='admin'?'all':'u_'+actor.uid)).orderByChild('order');if(cursor)query=query.startAfter(cursor);const data=(await query.limitToFirst(51).get()).val()||{},rows=Object.values(data).sort((a,b)=>a.order.localeCompare(b.order)).filter(p=>!p.removed);return {projects:rows.slice(0,50),next:rows.length>50?rows[49].order:''};
 }
 return {mark,sync,list,summary};
}
module.exports={createProjectListStore};
