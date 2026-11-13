(function(root){
 'use strict';
 if(root.SVBudgetPresentation)return;
 let active=null,sequence=0;
 const model=()=>root.SVBudgetLivePresentationModel||(typeof root.SVBudgetPresentationModel?.fromRecord==='function'?root.SVBudgetPresentationModel:null);
 const products=()=>Object.values(root.prodData||{});
 // La aplicación mantiene estas variables con let; no depender de que existan
 // también como propiedades de window para reconocer o invalidar la sesión.
 const context=()=>({uid:typeof currentUserUid==='undefined'?'':currentUserUid,user:root.fbAuth?.currentUser,role:typeof currentRole==='undefined'?'':currentRole,authenticated:typeof isAuthenticated!=='undefined'&&!!isAuthenticated,permissionRevision:root.PERMISOS_ROLES?.[typeof currentRole==='undefined'?'':currentRole]?.indiceRevision,epoch:root._svOperacionesSesionEpoch||0,dataEpoch:root._svDataEpoch||0,route:root.location?.hash});
 function allowed(){const c=context();return c.authenticated&&!!c.uid&&c.user?.uid===c.uid&&!root._impersonacionOriginal&&typeof root.permisoModulo==='function'&&root.permisoModulo('presupuesto');}
 function valid(session){const c=context();return active===session&&allowed()&&session.context.uid===c.uid&&session.context.user===c.user&&session.context.role===c.role&&session.context.permissionRevision===c.permissionRevision&&session.context.epoch===c.epoch&&session.context.dataEpoch===c.dataEpoch&&session.context.route===c.route;}
 function clean(value){return root.SVCommercialOwnership?.clean?root.SVCommercialOwnership.clean(value):Object.fromEntries(Object.entries(value||{}).filter(([k])=>k!=='fbKey'&&!k.startsWith('_sv')));}
 function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));return value;}
 function same(a,b){return JSON.stringify(stable(clean(a)))===JSON.stringify(stable(clean(b)));}
 function candidates(session){return session.records.filter(d=>d&&d.schema===1&&d.kind==='presupuesto'&&d.data?.edit===session.key&&d.original&&same(d.original,session.record));}
 function readRecord(key){return typeof root.buscarPptoPorRef==='function'?root.buscarPptoPorRef(key):null;}
 function close(){const session=active;if(!session)return;active=null;sequence++;session.unsubscribe?.();session.view?.close();}
 function status(session){if(root.document.hidden)return 'En pausa';if(root.navigator?.onLine===false||root.SVConnectionMonitor?.canSync?.()===false)return 'Sin conexión';if(session.ended)return 'Edición finalizada';if(session.pinned)return session.ready?'En edición':'En pausa';return 'Versión guardada';}
 function draw(session){if(!valid(session)){if(active===session)close();return;}if(root.document.hidden)return;const options={loading:!session.snapshot,status:status(session),updated:session.updated,selectedDraft:session.pinned,alternatives:session.candidates.map((d,i)=>({id:d.id,label:'Edición '+(i+1)+' · '+new Date(d.updated).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}))};const signature=JSON.stringify([session.snapshot,options]);if(signature===session.signature)return;session.signature=signature;session.view.render(session.snapshot||{number:session.record.id||session.record.numero||'',client:session.record.cliente||''},options);}
 function chooseDraft(id){const session=active;if(!valid(session))return;const draft=session.candidates.find(d=>d.id===id);if(!draft||!draft.original||!same(draft.original,session.record))return;session.request++;session.pinned=draft.id;session.ended=false;session.updated=draft.updated;session.snapshot=model().fromDraft(draft,session.record,products());draw(session);}
 async function loadSaved(session){
  if(!valid(session)||session.loading)return;
  session.loading=true;const request=++session.request;
  try{
   // Una lectura puntual por acción explícita o finalización real del borrador.
   // No se usa preparar (que puede escribir identidad), ni se relee el listado.
   if(!root.fbDB||typeof root.fbGet!=='function'||typeof root.fbRef!=='function')throw Error('Lectura no disponible');
   const task=typeof root.SVCommercialOwnership?.request==='function'?root.SVCommercialOwnership.request('presupuestos','registro/'+encodeURIComponent(session.key)).then(response=>({val:()=>response?.record})):root.fbGet(root.fbRef(root.fbDB,'sisventas/presupuestos/'+session.key));
   const snap=await(root.SVSessionRecovery?.deadline?root.SVSessionRecovery.deadline(task):task);
   if(!valid(session)||request!==session.request){if(active===session&&!valid(session))close();return;}
   const record=snap?.val?.();if(!record||typeof record!=='object'||Array.isArray(record)||record._svListSummary||record._svPagedSummary||record.eliminado===true||record.fbKey&&record.fbKey!==session.key)throw Error('Presupuesto no disponible');
   session.record={...record,fbKey:session.key};session.candidates=candidates(session);session.snapshot=model().fromRecord(session.record,products());session.pinned='';session.ended=false;session.updated=null;draw(session);
  }catch(_){if(valid(session)&&request===session.request){session.ended=true;if(!session.snapshot){close();root.notify?.('No se pudo consultar el presupuesto completo. Revisá la conexión y volvé a intentar.');}else{draw(session);root.notify?.('No se pudo actualizar la vista guardada. Revisá la conexión y volvé a intentar.');}}}
  finally{session.loading=false;}
 }
 function receive(session,event){
  if(!valid(session)){if(active===session)close();return;}
  if(event.ownerUid!==session.context.uid){close();return;}
  session.ready=event.ready===true;
  session.records=Array.isArray(event.records)?event.records:[];session.candidates=candidates(session);
  if(session.pinned){
   const draft=session.candidates.find(d=>d.id===session.pinned);
   if(draft){session.snapshot=model().fromDraft(draft,session.record,products());session.updated=draft.updated;}
   else if((event.deletedIds||[]).includes(session.pinned)){
    session.pinned='';session.ended=true;
    // Guardar y descartar usan el mismo tombstone. Releer el registro exacto
    // evita presentar una edición descartada como si hubiera sido guardada.
    draw(session);void loadSaved(session);return;
   }else{session.pinned='';session.ended=true;}
  }else if(!session.ended&&session.candidates.length===1){session.pinned=session.candidates[0].id;session.snapshot=model().fromDraft(session.candidates[0],session.record,products());session.updated=session.candidates[0].updated;}
  draw(session);
 }
 function open(key){
  if(!allowed()){root.notify?.('No tenés acceso a este visualizador.');return;}
  const record=readRecord(key);if(typeof record?.fbKey!=='string'||!record.fbKey||record.fbKey.length>768||/[.#$\[\]\/\x00-\x1f\x7f]/.test(record.fbKey)||['__proto__','constructor','prototype'].includes(record.fbKey)){root.notify?.('Abrí un presupuesto del listado para visualizarlo.');return;}
  if(typeof model()?.fromRecord!=='function'||typeof model()?.fromDraft!=='function'||!root.SVBudgetPresentationView||!root.svDrafts?.subscribe){root.notify?.('El visualizador todavía no está disponible.');return;}
  close();
  const session={id:++sequence,key:record.fbKey,record:JSON.parse(JSON.stringify(record)),context:context(),pinned:'',records:[],candidates:[],snapshot:record._svListSummary||record._svPagedSummary||!record.items?null:model().fromRecord(record,products()),ready:false,ended:false,request:0,loading:false,updated:null};active=session;
  session.view=root.SVBudgetPresentationView.create({onClose:close,onSaved:()=>loadSaved(session),onChooseDraft:chooseDraft,onFullscreen:element=>{if(valid(session)&&element.requestFullscreen)return element.requestFullscreen();}});
  draw(session);
  if(!session.snapshot){void loadSaved(session).then(()=>{if(valid(session)&&session.snapshot)session.unsubscribe=root.svDrafts.subscribe(event=>receive(session,event));});}
  else session.unsubscribe=root.svDrafts.subscribe(event=>receive(session,event));
  if(active!==session)session.unsubscribe?.();
 }
 function mountEyes(){
  if(!allowed())return;
  root.document.querySelectorAll('#ppto-tbody-main tr[data-ppto-ref]').forEach(row=>{
   const cell=row.querySelector('td.ppto-actions-cell')||row.lastElementChild;
   const actions=cell?.querySelector('.sv-grid-actions-original')||cell?.querySelector('.ppto-row-actions');if(!actions)return;
   // Ownership adds its own column after rendering. Keep exactly one eye in
   // the actions container, never in an adjacent ownership cell.
   const eyes=[...row.querySelectorAll('[data-budget-view]')];
   const retained=eyes.find(button=>button.parentElement===actions);
   eyes.forEach(button=>{if(button!==retained)button.remove();});
   if(retained)return;
   const key=row.dataset.pptoRef;if(!key)return;
   const b=root.document.createElement('button');b.type='button';b.className='btn btn-sm ppto-row-action';b.dataset.budgetView=key;b.title='Visualizar presupuesto';b.setAttribute('aria-label','Visualizar presupuesto');
   const icon=root.document.createElement('i');icon.className='ti ti-eye';icon.setAttribute('aria-hidden','true');b.appendChild(icon);actions.prepend(b);
  });
 }
 root.document.addEventListener('click',e=>{const b=e.target.closest?.('[data-budget-view]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();open(b.dataset.budgetView);},true);
 root.document.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.closest?.('[data-budget-view]'))e.stopPropagation();},true);
 for(const name of ['sisventas:session-ended','sisventas:role-changed','sisventas:page-changed'])root.document.addEventListener(name,()=>{close();mountEyes();});
 root.document.addEventListener('sisventas:data-state-changed',()=>{if(active&&!valid(active))close();mountEyes();});
 root.document.addEventListener('visibilitychange',()=>{if(active)draw(active);});
 root.addEventListener('sisventas:connection-lost',()=>{if(active)draw(active);});root.addEventListener('sisventas:connection-restored',()=>{if(active)draw(active);});
 root.document.addEventListener('sisventas:session-ready',mountEyes);
 const body=root.document.getElementById('ppto-tbody-main');if(body&&typeof MutationObserver==='function')new MutationObserver(mountEyes).observe(body,{childList:true});
 root.SVBudgetPresentation={open,close};mountEyes();
})(window);
