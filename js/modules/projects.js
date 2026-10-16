(function(){
 'use strict';
 const M=window.SVProjectsModel,host=()=>document.getElementById('page-proyectos');
 const icons={equipo:'device-cctv',material:'package',mano:'tools',tarea:'list-check'};
 const state={projects:[],selected:'',tab:'resumen',search:'',filter:'all',options:null,canCreate:false,epoch:0,loading:false};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const icon=(name)=>'<i class="ti ti-'+name+'" aria-hidden="true"></i>';
 const button=(label,action,cls='',extra='')=>'<button type="button" class="btn '+cls+'" data-px="'+action+'" '+extra+'>'+label+'</button>';
 const date=t=>new Date(t).toLocaleDateString('es-AR',{day:'numeric',month:'short'});
 const money=(v,c='ARS')=>v==null?'Por cotizar':(c==='USD'?'US$ ':'$ ')+Number(v).toLocaleString('es-AR',{maximumFractionDigits:c==='USD'?0:2});
 const quoteStatus=s=>({borrador:'Borrador',revision:'En revisión',aprobado_int:'Aprobado',aprobado:'Aprobado',enviado:'Enviado',aceptado:'Aceptado',rechazado:'Rechazado',vencido:'Vencido',convertido:'Convertido a venta'}[s]||s||'');
 const initials=n=>String(n||'').split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]).join('').toUpperCase();
 const preview=()=>['127.0.0.1','localhost'].includes(location.hostname)&&new URLSearchParams(location.search).get('proyectos_preview')==='1'&&window.currentRole==='admin'&&!window._impersonacionOriginal;
 const people=[{uid:'preview-admin',name:'Administrador',role:'admin'},{uid:'preview-lucia',name:'Lucía Méndez',role:'administrativo'},{uid:'preview-mateo',name:'Mateo Rivas',role:'tecnico'},{uid:'preview-julia',name:'Julia Torres',role:'vendedor'}];
 const sampleClients=[{id:'client-a',name:'Consorcio Aurora',address:'Av. del Parque 1240 · Mar del Plata'},{id:'client-b',name:'Depósito Norte',address:'Complejo industrial · Sector 2'},{id:'client-c',name:'Estudio del Sur',address:'Oficinas · Piso 3'}];
 const sampleQuotes=[{id:'quote-a',number:'PP-DEMO-01',title:'Control de acceso · Propuesta recomendada',clientId:'client-a',total:1240000,currency:'ARS',status:'revision',items:[{description:'Equipamiento de control de acceso',qty:1,unitPrice:620000},{description:'Instalación y configuración',qty:1,unitPrice:620000}]},{id:'quote-b',number:'PP-DEMO-02',title:'Sistema de cámaras · Depósito',clientId:'client-b',total:2385000,currency:'ARS',status:'aprobado_int',items:[]}];
 sampleQuotes.push({id:'quote-a-alt',number:'PP-DEMO-03',title:'Control de acceso · Alternativa básica',clientId:'client-a',total:975000,currency:'ARS',status:'borrador',items:[]});
 const demoActor=()=>({uid:'preview-admin',name:'Administrador',role:'admin',enabled:true,createAllowed:true,editAllowed:true,quoteAllowed:true});
 const DEMO_KEY='sv-projects-preview-v1';
 function seed(){
  const all=[],now=Date.now();
  const specs=[['Acceso inteligente · Edificio Aurora','client-a','Controlar el ingreso peatonal y vehicular, mejorar la seguridad y simplificar la administración de accesos.','presupuestando'],['Videovigilancia · Depósito Norte','client-b','Cubrir los accesos y las zonas de carga con un sistema de grabación centralizado.','presentado'],['Red Wi-Fi · Oficinas','client-c','Revisar la cobertura actual y definir una solución estable para las áreas de trabajo.','relevamiento']];
  specs.forEach(([name,clientId,goal,stage],index)=>{
   const c=sampleClients.find(c=>c.id===clientId),stamp=now-index*86400000-3600000;let counter=0;
   const ctx=()=>({id:'demo-'+index+'-'+(++counter),now:stamp+counter,directory:people});
   let p=M.apply(null,{type:'create',data:{name,clientId,clientName:c.name,address:c.address,goal,members:[{uid:people[index===2?3:1].uid,access:'editor'},{uid:people[2].uid,access:'viewer'}]}},demoActor(),ctx());
   const needs=index===0?[
    ['Acceso principal','Lector biométrico de ingreso','equipo',1,'unid.','definido','Ingreso mediante huella o tarjeta. Definir el modelo al cotizar.'],
    ['Acceso principal','Cerraduras electromagnéticas','equipo',2,'unid.','definido','Verificadas las dos hojas de la puerta.'],
    ['Infraestructura','Canalización y cableado','material',null,'m','revisar','Medir el recorrido desde el gabinete hasta los accesos.'],
    ['Puesta en marcha','Instalación y configuración','mano',8,'horas','definido','Incluye pruebas de apertura y capacitación inicial.']
   ]:index===1?[
    ['Zonas de carga','Cámaras exteriores','equipo',6,'unid.','definido','Cubrir circulación y descarga.'],['Grabación','Grabador y almacenamiento','equipo',1,'conjunto','definido','Revisar retención solicitada.'],['Instalación','Tendido y puesta en marcha','mano',null,'horas','pendiente','Relevar los recorridos elevados.']
   ]:[['Piso 3','Relevar cobertura y puntos de red','tarea',null,'puntos','pendiente','Identificar áreas sin señal y disponibilidad de energía.']];
   needs.forEach(([area,title,kind,qty,unit,status,notes])=>{p=M.apply(p,{type:'need-save',revision:p.revision,data:{area,title,kind,qty,unit,status,notes}},demoActor(),ctx());});
   if(index<2){const q=sampleQuotes[index];p=M.apply(p,{type:'budget-link',revision:p.revision,data:{}},demoActor(),{...ctx(),quote:q});}
   if(index===0)p=M.apply(p,{type:'budget-brief',revision:p.revision,data:{title:'Alternativa con acceso vehicular',needIds:[p.needs[0].id,p.needs[2].id],notes:'Evaluar lector de largo alcance para la cochera.'}},demoActor(),ctx());
   p=M.apply(p,{type:'update',revision:p.revision,data:{...p,stage}},demoActor(),ctx());all.push(p);
  });return all;
 }
 function demoData(){const raw=localStorage.getItem(DEMO_KEY);if(raw===null){const data=seed();localStorage.setItem(DEMO_KEY,JSON.stringify(data));return data;}let data;try{data=JSON.parse(raw);}catch(_){throw Error('No se pudo leer la vista previa guardada. Conservá los datos del navegador.');}if(!Array.isArray(data))throw Error('La vista previa guardada tiene un formato no válido');return data;}
 async function request(path,body){
  if(window._impersonacionOriginal)throw Error('Para verificar Proyectos usá una sesión propia, fuera de «Ver como».');
  const user=window.fbAuth?.currentUser,uid=window.currentUserUid;if(!user||user.uid!==uid)throw Error('La sesión cambió. Volvé a ingresar.');
  const base=window.SISVENTAS_FUNCTIONS?.cotizadorProveedor;if(!base)throw Error('No está disponible el servicio de Proyectos');
  const token=await user.getIdToken();if(window.fbAuth.currentUser!==user||window.currentUserUid!==uid)throw Error('La sesión cambió.');
  const r=await fetch(base+'/proyectos'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(20000)});
  const value=await r.json().catch(()=>({}));if(window.fbAuth.currentUser!==user||window.currentUserUid!==uid)throw Error('La sesión cambió.');if(!r.ok||value.ok===false)throw Object.assign(Error(value.mensaje||'No se pudo sincronizar Proyectos. Reintentá.'),{status:r.status});return value;
 }
 async function options(){
  const epoch=state.epoch,selected=state.selected;
  if(preview())return {people,clients:sampleClients,budgets:sampleQuotes};
  const result=await request('/opciones'+(selected?'?proyecto='+encodeURIComponent(selected):''));
  if(epoch!==state.epoch||selected!==state.selected)throw Error('La vista cambió. Volvé a abrir la acción.');return result;
 }
 async function mutate(command){
  const p=current();if(command.type!=='create'){command.projectId=state.selected;command.revision=p.revision;}
  let result;
  if(preview()){
   const data=demoData(),old=data.find(x=>x.id===state.selected),quote=sampleQuotes.find(q=>q.id===command.data?.sourceId);
   const next=M.apply(old,command,demoActor(),{id:crypto.randomUUID(),now:Date.now(),directory:people,quote});
   localStorage.setItem(DEMO_KEY,JSON.stringify([next,...data.filter(x=>x.id!==next.id)]));result={project:M.project(next,demoActor(),sampleQuotes)};
  }else result=await request('/guardar',command);
  state.projects=[result.project,...state.projects.filter(x=>x.id!==result.project.id)];state.selected=result.project.id;return result.project;
 }
 const current=()=>state.projects.find(p=>p.id===state.selected);
 function avatars(p){const entries=Object.entries(p.members);return '<div class="px-avatars">'+entries.slice(0,4).map(([,m])=>'<span class="px-avatar" title="'+esc(m.name)+'">'+esc(initials(m.name))+'</span>').join('')+(entries.length>4?'<span class="px-avatar">+'+(entries.length-4)+'</span>':'')+'</div>';}
 const pill=(name,label)=>'<span class="px-pill '+esc(name)+'">'+esc(label)+'</span>';
 function empty(title,description,action=''){return '<div class="px-empty">'+icon('folders')+'<strong>'+esc(title)+'</strong><p>'+esc(description)+'</p>'+action+'</div>';}
 function shell(content){host().innerHTML='<div class="px-shell">'+content+'</div>';}
 function overview(){
  const active=state.projects.filter(p=>!['aprobado','descartado'].includes(p.stage)).length;
  const pending=state.projects.reduce((sum,p)=>sum+M.stats(p).pending,0),budgets=state.projects.reduce((sum,p)=>sum+p.budgets.length,0);
  shell('<section class="px-hero"><div><div class="px-eyebrow">PLANIFICAR · COMPARTIR · COTIZAR</div><h2>Planificá el próximo trabajo</h2><p>De las primeras necesidades a una propuesta lista para presentar.</p></div><div class="px-hero-actions">'+(preview()?'<span class="px-preview">Vista previa · datos de ejemplo</span>':'')+(state.canCreate?button(icon('plus')+' Nuevo proyecto','new','px-primary'):'')+'</div></section>'+
   '<div class="px-stats">'+[['folders',state.projects.length,'Proyectos'],['route',active,'En preparación'],['list-check',pending,'Necesidades por definir'],['file-description',budgets,'Presupuestos y borradores']].map(([i,n,t])=>'<div class="px-stat">'+icon(i)+'<div><strong>'+n+'</strong><span>'+t+'</span></div></div>').join('')+'</div>'+
   '<div class="px-toolbar"><label class="px-search">'+icon('search')+'<input type="search" data-px-search value="'+esc(state.search)+'" placeholder="Buscar proyecto, cliente o dirección" aria-label="Buscar proyectos"></label><div class="px-filters">'+[['all','Todos'],['active','En preparación'],['approved','Aprobados']].map(([key,label])=>'<button type="button" class="px-filter" data-px="filter" data-id="'+key+'" aria-pressed="'+(state.filter===key)+'">'+label+'</button>').join('')+button(icon('refresh'),'refresh','btn-icon','aria-label="Actualizar proyectos"')+'</div></div><div class="px-grid" data-px-cards></div>');cards();
 }
 function cards(){
  const target=host().querySelector('[data-px-cards]');if(!target)return;
  const filtered=state.projects.filter(p=>(state.filter==='all'||(state.filter==='approved'?p.stage==='aprobado':!['aprobado','descartado'].includes(p.stage)))&&norm([p.name,p.clientName,p.address].join(' ')).includes(norm(state.search)));
  target.innerHTML=filtered.map(p=>{const s=M.stats(p);return '<article class="px-card"><div class="px-card-top"><span class="px-project-icon">'+icon('folder')+'</span>'+pill(p.stage,M.stages[p.stage])+'</div><div><div class="px-code">'+esc(p.number)+'</div><button type="button" class="px-card-open" data-px="open" data-id="'+esc(p.id)+'"><h3>'+esc(p.name)+'</h3></button><div class="px-muted">'+esc(p.clientName||'Cliente a definir')+'</div><p class="px-goal">'+esc(p.goal||'Comenzá definiendo el objetivo del proyecto.')+'</p></div><div><div class="px-progress-label"><span>Necesidades definidas</span><span>'+s.defined+' de '+s.all+'</span></div><div class="px-track"><span style="width:'+s.percent+'%"></span></div></div><div class="px-card-foot">'+avatars(p)+'<small>'+icon('file-description')+' '+p.budgets.length+' · '+date(p.updatedAt)+'</small></div></article>';}).join('')||empty(state.projects.length?'No encontramos proyectos':'Tu próximo proyecto empieza acá',state.projects.length?'Probá otro texto o cambiá el filtro.':'Definí el objetivo, organizá las necesidades y sumá a tu equipo.',!state.projects.length&&state.canCreate?button('Crear primer proyecto','new','px-primary'):'');
 }
 function details(){
  const p=current();if(!p){state.selected='';overview();return;}
  const steps=Object.entries(M.stages).filter(([k])=>k!=='descartado'),pos=steps.findIndex(([k])=>k===p.stage);
  shell('<div class="px-topline">'+button(icon('arrow-left')+' Todos los proyectos','back','px-back')+'<div class="px-inline-actions">'+(preview()?'<span class="px-preview">Vista previa · datos de ejemplo</span>':'')+button(icon('refresh'),'refresh','btn-icon','aria-label="Actualizar proyecto"')+'</div></div><section class="px-hero px-detail-hero"><div><div class="px-eyebrow">'+esc(p.number)+' · '+esc(p.clientName||'Cliente a definir')+'</div><h2>'+esc(p.name)+'</h2><div class="px-meta"><span>'+icon('map-pin')+esc(p.address||'Domicilio a definir')+'</span><span>'+icon('user')+esc(p.members[p.owner]?.name||'Responsable')+'</span>'+(p.due?'<span>'+icon('calendar')+esc(p.due.split('-').reverse().join('/'))+'</span>':'')+'</div></div><div class="px-hero-actions">'+pill(p.stage,M.stages[p.stage])+(p.access.edit?button(icon('pencil')+' Editar ficha','edit'):'<span class="px-preview">Solo lectura</span>')+'</div></section><div class="px-steps">'+steps.map(([key,label],index)=>'<div class="px-step '+(index===pos?'is-current':index<pos?'is-done':'')+'"><span>'+(index<pos?icon('check'):index+1)+'</span>'+label+'</div>').join('')+'</div><div class="px-tabs" role="tablist" aria-label="Secciones del proyecto">'+[['resumen','layout-dashboard','Resumen',null],['necesidades','list-check','Necesidades',p.needs.length],['presupuestos','file-description','Presupuestos',p.budgets.length],['integrantes','users','Integrantes',Object.keys(p.members).length]].map(([tab,i,label,count])=>'<button type="button" class="px-tab" role="tab" data-px="tab" data-id="'+tab+'" aria-selected="'+(state.tab===tab)+'">'+icon(i)+label+(count!=null?'<span class="px-count">'+count+'</span>':'')+'</button>').join('')+'</div><div data-px-content></div>');content();
 }
 function personRows(p){return Object.entries(p.members).sort(([a],[b])=>a===p.owner?-1:b===p.owner?1:0).map(([,m])=>'<div class="px-person"><span class="px-avatar big">'+esc(initials(m.name))+'</span><div><strong>'+esc(m.name)+'</strong><small>'+({owner:'Responsable',editor:'Puede editar',viewer:'Puede ver'}[m.access])+'</small></div></div>').join('');}
 function content(){
  const p=current(),el=host().querySelector('[data-px-content]');if(!p||!el)return;
  if(state.tab==='resumen'){
   const areas=[...new Set(p.needs.map(n=>n.area))],s=M.stats(p);
   el.innerHTML='<div class="px-columns"><div><section class="px-panel"><h3>'+icon('target-arrow')+' Objetivo del proyecto</h3><p>'+esc(p.goal||'Todavía no se describió el objetivo.')+'</p></section><section class="px-panel"><div class="px-panel-header"><h3>'+icon('list-check')+' Planificación por sector</h3>'+button('Ver necesidades','tab','btn-sm','data-id="necesidades"')+'</div>'+(areas.length?areas.map(area=>{const items=p.needs.filter(n=>n.area===area),ready=items.filter(n=>n.status==='definido').length;return '<div class="px-area-meter"><span>'+esc(area)+'</span><div class="px-track"><span style="width:'+Math.round(ready/items.length*100)+'%"></span></div><small>'+ready+'/'+items.length+'</small></div>';}).join(''):'<p>Agregá las primeras necesidades para organizar el alcance.</p>')+'<p style="font-size:11px;margin-top:18px">'+s.defined+' de '+s.all+' necesidades definidas'+(s.pending?' · '+s.pending+' por completar o verificar':'')+'</p></section><section class="px-panel"><h3>'+icon('history')+' Actividad reciente</h3>'+p.activity.slice(0,5).map(a=>'<div class="px-activity">'+esc(a.action)+'<small>'+esc(a.actor)+' · '+date(a.at)+'</small></div>').join('')+'</section></div><aside><section class="px-panel"><div class="px-panel-header"><h3>'+icon('users')+' Equipo del proyecto</h3>'+button('Ver todos','tab','btn-sm','data-id="integrantes"')+'</div>'+personRows(p)+'</section><section class="px-panel"><h3>'+icon('file-description')+' Próximo paso</h3><p>'+(s.pending?'Completá las necesidades pendientes para preparar una propuesta con el alcance claro.':'Las necesidades están definidas. Podés preparar un borrador con los puntos que vas a cotizar.')+'</p><div style="margin-top:16px">'+(p.access.quote?button('Preparar presupuesto','brief','px-primary btn-sm'):button('Ver necesidades','tab','btn-sm','data-id="necesidades"'))+'</div></section></aside></div>';
  }else if(state.tab==='necesidades'){
   const areas=[...new Set(p.needs.map(n=>n.area))];el.innerHTML='<div class="px-panel-header"><div><h3>Alcance y necesidades</h3><p class="px-muted">Organizá por sector. Lo que falta confirmar puede quedar pendiente.</p></div>'+(p.access.edit?button(icon('plus')+' Agregar necesidad','need','px-primary'):'')+'</div>'+areas.map(area=>{const items=p.needs.filter(n=>n.area===area);return '<section class="px-need-group"><div class="px-group-title">'+icon('map-pin')+esc(area)+'<small>'+items.length+' necesidades</small></div>'+items.map(n=>'<div class="px-need">'+icon(icons[n.kind])+'<div><strong>'+esc(n.title)+'</strong><p>'+esc(n.notes||M.kinds[n.kind])+'</p></div><div class="px-qty">'+(n.qty==null?'A definir':esc(n.qty))+'<small>'+esc(n.unit)+'</small></div>'+pill(n.status,M.needStates[n.status])+(p.access.edit?'<button type="button" class="px-icon" data-px="need" data-id="'+esc(n.id)+'" aria-label="Editar '+esc(n.title)+'">'+icon('pencil')+'</button>':'')+'</div>').join('')+'</section>';}).join('')+(p.needs.length?'':empty('Definí qué necesita el trabajo','Podés empezar por un equipo, un material, mano de obra o una tarea.'));
  }else if(state.tab==='integrantes'){
   el.innerHTML='<section class="px-panel"><div class="px-panel-header"><div><h3>Un equipo, el mismo proyecto</h3><p class="px-muted">Los integrantes pueden verlo. La edición depende del acceso asignado.</p></div>'+(p.access.manage?button(icon('user-plus')+' Gestionar integrantes','members','px-primary'):'')+'</div>'+personRows(p)+'</section>';
  }else{
   el.innerHTML='<div class="px-panel-header"><div><h3>Presupuestos del proyecto</h3><p class="px-muted">Prepará el alcance o vinculá una propuesta comercial existente.</p></div><div class="px-inline-actions">'+(p.access.quote?button(icon('link')+' Vincular','link')+button(icon('plus')+' Preparar','brief','px-primary'):'')+'</div></div>'+p.budgets.map(b=>'<article class="px-budget">'+icon(b.kind==='brief'?'file-pencil':'file-description')+'<div class="px-budget-info"><h3>'+esc(b.title)+'</h3><small>'+esc(b.kind==='restricted'?'Acceso limitado por tu rol':b.kind==='brief'?b.needIds.length+' necesidades · borrador de alcance':(b.quote?.number||'Referencia no disponible'))+'</small></div><div class="px-budget-total">'+(b.kind==='restricted'?'':b.kind==='brief'?'Por cotizar':money(b.quote?.total,b.quote?.currency))+'<small>'+esc(b.kind==='brief'?'Sin importe todavía':b.quote?.status||'')+'</small></div>'+(b.kind!=='restricted'?'<div class="px-inline-actions">'+button('Ver','budget','btn-sm','data-id="'+esc(b.id)+'"')+(p.access.quote?button(icon('unlink'),'unlink','btn-sm btn-icon','data-id="'+esc(b.id)+'" aria-label="Quitar vínculo de '+esc(b.title)+'"'):'')+'</div>':'')+'</article>').join('')+(p.budgets.length?'':empty('Del alcance a una propuesta','Elegí las necesidades que querés cotizar o vinculá un presupuesto del mismo cliente.'));
  }
 }
 let dialog=null,oldOverflow='',dialogEpoch=0;
 function closeDialog(){if(!dialog)return;dialog.remove();dialog=null;dialogEpoch++;document.body.style.overflow=oldOverflow;}
 function modal(title,body,submit,label='Guardar',after){
  closeDialog();oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog=document.createElement('dialog');dialog.className='px-dialog';dialog.setAttribute('aria-labelledby','px-modal-title');
  dialog.innerHTML='<form><header class="px-dialog-head"><h2 id="px-modal-title">'+esc(title)+'</h2><button type="button" class="px-icon" data-px-close aria-label="Cerrar">'+icon('x')+'</button></header><div class="px-dialog-body">'+body+'<p class="px-error" role="status" aria-live="polite"></p></div><footer class="px-dialog-foot">'+button('Cancelar','close')+(submit?'<button type="submit" class="btn px-primary">'+esc(label)+'</button>':'')+'</footer></form>';
  document.body.appendChild(dialog);const local=dialog,epoch=dialogEpoch;let busy=false;
  const close=()=>{if(!busy)closeDialog();};local.querySelector('[data-px-close]').onclick=close;local.querySelector('[data-px="close"]').onclick=close;
  local.addEventListener('cancel',e=>{e.preventDefault();close();});
  local.querySelector('form').onsubmit=async e=>{e.preventDefault();if(!submit||busy)return;busy=true;local.querySelectorAll('button').forEach(b=>b.disabled=true);const button=local.querySelector('[type=submit]'),before=button.textContent;button.textContent='Guardando…';
   try{await submit(new FormData(local.querySelector('form')),local);if(epoch!==dialogEpoch)return;closeDialog();details();}catch(err){if(epoch===dialogEpoch)local.querySelector('.px-error').textContent=err.message;}finally{busy=false;if(epoch===dialogEpoch){local.querySelectorAll('button').forEach(b=>b.disabled=false);button.textContent=before;}}
  };after?.(local);local.showModal();return local;
 }
 const field=(name,label,value='',type='text',required=false)=>'<label class="px-field"><span>'+label+'</span><input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+(required?'required':'')+' maxlength="'+(name==='name'?120:240)+'"></label>';
 const select=(name,label,values,value)=>'<label class="px-field"><span>'+label+'</span><select name="'+name+'" aria-label="'+esc(label)+'">'+Object.entries(values).map(([id,t])=>'<option value="'+esc(id)+'" '+(id===value?'selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label>';
 const textarea=(name,label,value='')=>'<label class="px-field"><span>'+label+'</span><textarea name="'+name+'" maxlength="'+(name==='goal'?2000:1200)+'">'+esc(value)+'</textarea></label>';
 function memberPicker(chosen,owner){return '<p class="px-help">El responsable siempre conserva acceso. Podés sumar integrantes con permiso para ver o editar.</p><input type="search" data-px-person-search placeholder="Buscar integrante" aria-label="Buscar integrante">'+state.options.people.filter(p=>p.uid!==owner).map(p=>'<label class="px-pick" data-person="'+esc(norm(p.name))+'"><input type="checkbox" name="member" value="'+esc(p.uid)+'" '+(chosen[p.uid]?'checked':'')+'><span class="px-avatar big">'+esc(initials(p.name))+'</span><span class="px-pick-text">'+esc(p.name)+'<small>'+esc({admin:'Administrador',administrativo:'Administrativo',tecnico:'Técnico',vendedor:'Vendedor',tecnico_vendedor:'Técnico-vendedor'}[p.role]||'Integrante')+'</small></span><select name="access-'+esc(p.uid)+'" aria-label="Acceso de '+esc(p.name)+'"><option value="viewer">Puede ver</option><option value="editor" '+(chosen[p.uid]?.access==='editor'?'selected':'')+'>Puede editar</option></select></label>').join('');}
 function readMembers(f){return f.getAll('member').map(uid=>({uid,access:f.get('access-'+uid)}));}
 function wirePeople(el){el.querySelector('[data-px-person-search]')?.addEventListener('input',e=>{el.querySelectorAll('[data-person]').forEach(row=>row.hidden=!row.dataset.person.includes(norm(e.target.value)));});}
 async function editProject(isNew){
  state.options=await options();const p=isNew?{}:current(),actor=preview()?'preview-admin':window.currentUserUid;
  const clientChoices={'':'Cliente a definir',...Object.fromEntries(state.options.clients.map(c=>[c.id,c.name]))};if(p.clientId&&!clientChoices[p.clientId])clientChoices[p.clientId]=p.clientName;
  modal(isNew?'Nuevo proyecto':'Editar proyecto',field('name','Nombre del proyecto',p.name||'','text',true)+select('clientId','Cliente',clientChoices,p.clientId||'')+field('address','Domicilio o sector',p.address||'')+textarea('goal','¿Qué queremos resolver?',p.goal||'')+'<div class="px-form-grid">'+field('due','Fecha objetivo',p.due||'','date')+(isNew?'':select('stage','Estado',M.stages,p.stage))+'</div>'+(isNew?'<span class="px-form-label">Integrantes</span>'+memberPicker({},actor):''),async f=>{
   const client=state.options.clients.find(c=>c.id===f.get('clientId'));
   await mutate({type:isNew?'create':'update',data:{name:f.get('name'),clientId:f.get('clientId'),clientName:client?.name||(p.clientId===f.get('clientId')?p.clientName:''),address:f.get('address'),goal:f.get('goal'),due:f.get('due'),stage:f.get('stage'),...(isNew?{members:readMembers(f)}:{})}});state.tab='resumen';
  },isNew?'Crear proyecto':'Guardar cambios',el=>{wirePeople(el);el.querySelector('[name=clientId]').onchange=e=>{const c=state.options.clients.find(c=>c.id===e.target.value);if(c)el.querySelector('[name=address]').value=c.address;};});
 }
 function needDialog(id){
  const p=current(),n=p.needs.find(n=>n.id===id)||{};
  modal(n.id?'Editar necesidad':'Agregar necesidad',field('title','¿Qué hace falta?',n.title||'','text',true)+'<div class="px-form-grid">'+field('area','Sector o etapa',n.area||'General','text',true)+select('kind','Tipo',M.kinds,n.kind||'equipo')+'</div><div class="px-form-grid">'+field('qty','Cantidad · puede quedar pendiente',n.qty??'','number')+field('unit','Unidad',n.unit||'unid.','text',true)+'</div>'+select('status','Definición',M.needStates,n.status||'pendiente')+textarea('notes','Notas para cotizar',n.notes||'')+(n.id?'<div class="px-label-row"><span class="px-help">Quitarla no modifica productos ni stock.</span>'+button('Quitar necesidad','remove-need','btn-sm','data-id="'+esc(n.id)+'"')+'</div>':''),async f=>mutate({type:'need-save',data:{id:n.id,title:f.get('title'),area:f.get('area'),kind:f.get('kind'),qty:f.get('qty'),unit:f.get('unit'),status:f.get('status'),notes:f.get('notes'),productId:n.productId||''}}),'Guardar necesidad',el=>{el.querySelector('[name=qty]').min='.001';el.querySelector('[name=qty]').step='any';const remove=el.querySelector('[data-px=remove-need]');if(remove)remove.onclick=async()=>{if(await confirm('¿Quitar esta necesidad del proyecto?')){try{await mutate({type:'need-remove',id:n.id});closeDialog();details();}catch(e){el.querySelector('.px-error').textContent=e.message;}}};});
 }
 async function membersDialog(){state.options=await options();const p=current();modal('Integrantes del proyecto',memberPicker(p.members,p.owner),async f=>mutate({type:'members',members:readMembers(f)}),'Guardar integrantes',wirePeople);}
 function briefDialog(){const p=current();if(!p.needs.length){state.tab='necesidades';details();return;}
  modal('Preparar presupuesto',field('title','Nombre de la propuesta',p.name,'text',true)+'<p class="px-help">Elegí el alcance de este borrador. Los importes y las condiciones se trabajan en Presupuestos.</p>'+p.needs.map(n=>'<label class="px-pick"><input type="checkbox" name="need" value="'+esc(n.id)+'" checked><span class="px-pick-text">'+esc(n.title)+'<small>'+esc(n.area)+' · '+(n.qty==null?'Cantidad a definir':esc(n.qty)+' '+esc(n.unit))+'</small></span></label>').join('')+textarea('notes','Condiciones o alternativas'),async f=>{await mutate({type:'budget-brief',data:{title:f.get('title'),needIds:f.getAll('need'),notes:f.get('notes')}});state.tab='presupuestos';},'Guardar borrador');
 }
 async function linkDialog(briefId){state.options=await options();const p=current(),available=state.options.budgets.filter(b=>b.clientId===p.clientId&&!p.budgets.some(x=>x.sourceId===b.id));
  modal('Vincular presupuesto','<p class="px-help">Se vincula un presupuesto existente del mismo cliente. No se cambia su contenido ni sus permisos comerciales.</p>'+(available.length?available.map((b,i)=>'<label class="px-pick"><input type="radio" name="budget" value="'+esc(b.id)+'" '+(!i?'checked':'')+'><span class="px-pick-text">'+esc(b.number)+' · '+esc(b.title)+'<small>'+money(b.total,b.currency)+' · '+esc(quoteStatus(b.status))+'</small></span></label>').join(''):'<p class="px-notice">'+(p.clientId?'No hay otros presupuestos de este cliente para vincular.':'Primero elegí el cliente en la ficha del proyecto.')+'</p>'),available.length?async f=>{await mutate({type:'budget-link',data:{sourceId:f.get('budget'),briefId}});state.tab='presupuestos';}:null,'Vincular presupuesto');
 }
 function budgetDialog(id){const p=current(),b=p.budgets.find(x=>x.id===id);if(!b||b.kind==='restricted')return;
  const needs=p.needs.filter(n=>b.needIds.includes(n.id));
  const body=b.kind==='brief'?'<div class="px-notice">Borrador de alcance · todavía sin importe comercial.</div>'+needs.map(n=>'<div class="px-pick"><span class="px-pick-text">'+esc(n.title)+'<small>'+esc(n.area)+' · '+(n.qty==null?'Cantidad a definir':esc(n.qty)+' '+esc(n.unit))+'</small></span></div>').join('')+'<p class="px-help">'+esc(b.notes)+'</p><div style="display:flex;gap:9px;margin-top:18px">'+(preview()?'':button('Armar en Presupuestos','prepare-commercial','px-primary','data-id="'+esc(b.id)+'"'))+button('Vincular presupuesto','link-brief','','data-id="'+esc(b.id)+'"')+'</div>':b.quote?'<div class="px-notice">'+esc(b.quote.number)+' · '+esc(quoteStatus(b.quote.status))+'</div>'+(b.quote.items||[]).map(i=>'<div class="px-pick"><span class="px-pick-text">'+esc(i.description)+'<small>'+esc(i.qty)+' × '+money(i.unitPrice,b.quote.currency)+'</small></span></div>').join('')+'<p style="font-size:23px;font-weight:700;margin-top:20px">'+money(b.quote.total,b.quote.currency)+'</p>':'<p class="px-help">La referencia comercial no está disponible para esta sesión.</p>';
  modal(b.title,body,null);dialog.querySelector('[data-px=link-brief]')?.addEventListener('click',()=>{closeDialog();linkDialog(b.id).catch(report);});dialog.querySelector('[data-px=prepare-commercial]')?.addEventListener('click',()=>prepareCommercial(b));
 }
 let pendingBudget=null;
 async function prepareCommercial(brief){
  if(preview())return;const p=current(),needs=p.needs.filter(n=>brief.needIds.includes(n.id));
  if(!p.clientId){dialog.querySelector('.px-error').textContent='Elegí el cliente del proyecto antes de armar el presupuesto.';return;}
  if(needs.some(n=>!n.qty)){dialog.querySelector('.px-error').textContent='Definí las cantidades antes de abrir el presupuesto comercial.';return;}
  if(!window.tienePermiso?.('presupuestos.crear')){dialog.querySelector('.px-error').textContent='Tu rol no permite crear presupuestos.';return;}
  if((window._pptoEditandoFbKey||window.getPpItems?.().length)&&!await confirm('Hay un presupuesto abierto. ¿Preparar uno nuevo sin guardar el formulario anterior?'))return;
  closeDialog();window.showPage('presupuesto');window.abrirNuevoPresupuesto();
  const body=document.getElementById('pp-body');body.innerHTML='';needs.forEach(n=>{const row=window.crearFilaProducto('',n.title,0,n.qty,0);row.dataset.unidad=n.unit;row.querySelector('.qty').min='.001';row.querySelector('.qty').step='any';row.querySelectorAll('.qty,.price,.disc').forEach(inp=>inp.addEventListener('input',()=>{window.calcRow(inp);window.calcPpTotales();}));body.appendChild(row);window.calcRow(row.querySelector('.qty'));});
  document.getElementById('pp-cli').value=p.clientName;document.getElementById('pp-cli-id').value=p.clientId;document.getElementById('pp-titulo-solucion').value=brief.title;window._pptoAsegurarFilaVacia();window.calcPpTotales();
  pendingBudget={projectId:p.id,briefId:brief.id,uid:window.currentUserUid,nonce:crypto.randomUUID()};document.getElementById('ppto-form-view').dataset.projectBrief=pendingBudget.nonce;window.notify('Alcance preparado. Revisá productos, precios y condiciones antes de guardar.');
 }
 async function confirm(message){return window.svConfirm?window.svConfirm(message):window.confirm(message);}
 function report(e){window.notify?.(e.message||'No se pudo completar la acción');}
 async function load(){
  if(state.loading)return;const epoch=++state.epoch;state.loading=true;
  try{
   if(window._impersonacionOriginal)throw Error('Proyectos requiere una sesión propia para comprobar integrantes y permisos.');
   let data;if(preview())data={canCreate:true,projects:demoData().map(p=>M.project(p,demoActor(),sampleQuotes))};else data=await request('');
   if(epoch!==state.epoch)return;state.projects=data.projects;state.canCreate=data.canCreate;state.options=null;state.selected?details():overview();
  }catch(e){if(epoch===state.epoch)shell(empty('No se pudo abrir Proyectos',e.message,button('Reintentar','refresh')));}finally{if(epoch===state.epoch)state.loading=false;}
 }
 async function open(){if(!host()||!window.permisoModulo?.('proyectos'))return;shell('<div class="px-empty">'+icon('loader')+'<strong>Cargando proyectos…</strong></div>');await load();}
 document.addEventListener('input',e=>{if(e.target.matches('#page-proyectos [data-px-search]')){state.search=e.target.value;cards();}});
 document.addEventListener('click',async e=>{
  const b=e.target.closest('#page-proyectos [data-px]');if(!b)return;const action=b.dataset.px,id=b.dataset.id;
  try{
   if(action==='new')await editProject(true);else if(action==='edit')await editProject(false);else if(action==='open'){state.selected=id;state.tab='resumen';details();host().scrollIntoView({block:'start'});}
   else if(action==='back'){state.selected='';overview();}else if(action==='filter'){state.filter=id;host().querySelectorAll('[data-px=filter]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.id===id)));cards();}
   else if(action==='tab'){state.tab=id;details();}else if(action==='refresh')await load();else if(action==='need')needDialog(id);else if(action==='members')await membersDialog();else if(action==='brief')briefDialog();else if(action==='link')await linkDialog();else if(action==='budget')budgetDialog(id);
   else if(action==='unlink'&&await confirm('¿Quitar este vínculo del proyecto? El presupuesto comercial se conserva.')){await mutate({type:'budget-remove',id});details();}
  }catch(err){report(err);}
 });
 document.addEventListener('sisventas:page-changed',e=>{if(e.detail.page==='proyectos')open();else closeDialog();});
 document.addEventListener('sisventas:session-ended',()=>{state.epoch++;state.loading=false;state.projects=[];state.selected='';state.options=null;pendingBudget=null;closeDialog();if(host())host().innerHTML='';});
 document.addEventListener('sisventas:budget-saved',async e=>{
  const pending=pendingBudget;if(!pending||pending.uid!==window.currentUserUid||preview()||e.detail.context!==pending.nonce)return;pendingBudget=null;
  try{await request('/guardar',{type:'budget-link',projectId:pending.projectId,revision:state.projects.find(p=>p.id===pending.projectId)?.revision,data:{sourceId:e.detail.key,briefId:pending.briefId}});window.notify('Presupuesto vinculado al proyecto.');}catch(_){window.notify('El presupuesto quedó guardado. Vinculalo desde Proyectos para completar la asociación.');}
 });
 window.SVProjects={open,resetBudgetContext(){pendingBudget=null;const form=document.getElementById('ppto-form-view');if(form)delete form.dataset.projectBrief;}};
})();
