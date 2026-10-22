(function(root){
 'use strict';
 const fields={'kpi-ventas-hoy':'Ventas hoy','kpi-cobrado-hoy':'Cobrado hoy','kpi-deuda':'Deuda clientes','kpi-iva':'Podés facturar hasta'},summary='dash-rentabilidad-card',ids=[...Object.keys(fields),summary];
 const privateAttributes=['title','aria-label','aria-valuenow','aria-valuetext','data-tooltip'],savedAttributes=new WeakMap(),savedText=new WeakMap(),savedAria=new WeakMap();
 let preferences={},identity='',ended=false,observer=null,observedPage=null;
 const admin=()=>root.currentRole==='admin'&&!root._impersonacionOriginal&&!ended;
 function persist(){try{localStorage.setItem('sv-dashboard-privacy:'+identity,JSON.stringify(preferences));}catch(_){} }
 function maskAttributes(node,hidden){
  const nodes=[node,...node.querySelectorAll('*')].filter(el=>!el.classList.contains('dashboard-eye'));
  nodes.forEach(el=>{
   if(hidden){let saved=savedAttributes.get(el);if(!saved){saved={};savedAttributes.set(el,saved);}privateAttributes.forEach(name=>{if(el.hasAttribute(name)){saved[name]=el.getAttribute(name);el.removeAttribute(name);}});
    if(['title','desc'].includes(String(el.tagName).toLowerCase())&&el.textContent){savedText.set(el,el.textContent);el.textContent='';}
   }else{const saved=savedAttributes.get(el);if(saved){Object.entries(saved).forEach(([name,value])=>{if(!el.hasAttribute(name))el.setAttribute(name,value);});savedAttributes.delete(el);}if(savedText.has(el)){if(!el.textContent)el.textContent=savedText.get(el);savedText.delete(el);}}
  });
 }
 function ariaMask(node,hidden){if(hidden){if(!savedAria.has(node))savedAria.set(node,node.getAttribute('aria-hidden'));node.setAttribute('aria-hidden','true');}else if(savedAria.has(node)){const prior=savedAria.get(node);if(prior===null)node.removeAttribute('aria-hidden');else node.setAttribute('aria-hidden',prior);savedAria.delete(node);} }
 function eye(card,id,label,host){let button=card.querySelector('.dashboard-eye');if(!button){button=document.createElement('button');button.type='button';button.className='dashboard-eye';button.dataset.metricId=id;(host||card).append(button);}const hidden=ended||admin()&&preferences[id]===true;
  button.hidden=!admin();button.setAttribute('aria-label',(hidden?'Mostrar':'Ocultar')+' '+label);button.title=button.getAttribute('aria-label');button.setAttribute('aria-pressed',String(hidden));button.innerHTML='<i aria-hidden="true" class="ti ti-eye'+(hidden?'-off':'')+'"></i>';return hidden;
 }
 function summaryContent(card){let content=card.querySelector('.dashboard-private-content');if(!content){const head=card.querySelector('.card-head');if(!head)return null;content=document.createElement('div');content.className='dashboard-private-content';Array.from(card.childNodes).forEach(node=>{if(node!==head)content.append(node);});card.append(content);const mask=document.createElement('div');mask.className='dashboard-section-mask';mask.textContent='Resumen oculto';mask.setAttribute('aria-hidden','true');card.append(mask);}return content;}
 function master(page){let toolbar=page.querySelector('.dashboard-privacy-toolbar');if(!toolbar){toolbar=document.createElement('div');toolbar.className='dashboard-privacy-toolbar';const button=document.createElement('button');button.type='button';button.className='dashboard-eye dashboard-eye-master';button.dataset.privacyAll='true';toolbar.append(button);page.prepend(toolbar);}toolbar.hidden=!admin();const button=toolbar.querySelector('button'),count=ids.filter(id=>preferences[id]===true).length,all=count===ids.length,mixed=count>0&&!all;
  button.hidden=!admin();button.setAttribute('aria-pressed',mixed?'mixed':String(all));button.setAttribute('aria-label',(all?'Mostrar':'Ocultar')+' todos los importes del Dashboard');button.title=button.getAttribute('aria-label');button.innerHTML='<i aria-hidden="true" class="ti ti-eye'+(all?'-off':'')+'"></i><span>'+(all?'Mostrar importes':'Ocultar importes')+'</span>';
 }
 function observe(page){if(!root.MutationObserver||!page)return;if(!observer)observer=new root.MutationObserver(refresh);observedPage=page;observer.observe(page,{subtree:true,childList:true,attributes:true,attributeFilter:privateAttributes,characterData:true});}
 function refresh(){
  observer?.disconnect();
  const uid=String(root.currentUserUid||'');if(identity!==uid){identity=uid;preferences={};try{const saved=JSON.parse(localStorage.getItem('sv-dashboard-privacy:'+uid)||'{}');preferences=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{};}catch(_){} }
  Object.entries(fields).forEach(([id,label])=>{const value=document.getElementById(id),card=value?.closest('.metric');if(!card)return;const hidden=eye(card,id,'importe de '+label);card.classList.toggle('dashboard-private',hidden);
   maskAttributes(card,hidden);card.querySelectorAll('.m-value,.m-sub').forEach(el=>ariaMask(el,hidden));
  });
  const card=document.getElementById(summary);if(card){const content=summaryContent(card),head=card.querySelector('.card-head');if(content&&head){const hidden=eye(card,summary,'Resumen operativo del mes',head);card.classList.toggle('dashboard-private-section',hidden);ariaMask(content,hidden);content.inert=hidden;maskAttributes(content,hidden);}}
  const page=document.getElementById('page-dashboard');if(page)master(page);observe(page||observedPage);
 }
 function setAll(hidden){if(!admin())return;refresh();const desired=hidden===true;if(ids.every(id=>(preferences[id]===true)===desired))return;ids.forEach(id=>{preferences[id]=desired;});persist();refresh();}
 document.addEventListener('click',event=>{const button=event.target.closest?.('.dashboard-eye');if(!button)return;event.preventDefault();event.stopImmediatePropagation();if(!admin())return;refresh();if(button.dataset.privacyAll==='true'){setAll(!ids.every(id=>preferences[id]===true));return;}const id=button.dataset.metricId;if(!ids.includes(id))return;preferences[id]=preferences[id]!==true;persist();refresh();},true);
 document.addEventListener('sisventas:session-ready',()=>{ended=false;refresh();});['sisventas:role-changed','sisventas:page-changed'].forEach(name=>document.addEventListener(name,refresh));
 document.addEventListener('sisventas:session-ended',()=>{ended=true;identity='';preferences={};refresh();});
 root.SVDashboardPrivacy={refresh,setAll};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh);else refresh();
})(window);
