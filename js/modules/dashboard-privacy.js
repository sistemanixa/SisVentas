(function(root){
 'use strict';
 const fields={'kpi-ventas-hoy':'Ventas hoy','kpi-cobrado-hoy':'Cobrado hoy','kpi-deuda':'Deuda clientes','kpi-iva':'Pod\u00e9s facturar hasta'};
 let preferences={},identity='';
 const admin=()=>root.currentRole==='admin'&&!root._impersonacionOriginal;
 function refresh(){
  const uid=String(root.currentUserUid||'');
  if(identity!==uid){identity=uid;preferences={};try{const saved=JSON.parse(localStorage.getItem('sv-dashboard-privacy:'+uid)||'{}');preferences=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{};}catch(_){}}
  Object.entries(fields).forEach(([id,label])=>{
   const value=document.getElementById(id),card=value?.closest('.metric');if(!card)return;
   let button=card.querySelector('.dashboard-eye');
   if(!button){button=document.createElement('button');button.type='button';button.className='dashboard-eye';card.append(button);button.addEventListener('click',event=>{event.stopPropagation();if(!admin())return;preferences[id]=!preferences[id];try{localStorage.setItem('sv-dashboard-privacy:'+identity,JSON.stringify(preferences));}catch(_){}refresh();});button.addEventListener('keydown',event=>event.stopPropagation());}
   const hidden=admin()&&preferences[id]===true;
   button.hidden=!admin();button.setAttribute('aria-label',(hidden?'Mostrar':'Ocultar')+' importe de '+label);button.title=button.getAttribute('aria-label');button.setAttribute('aria-pressed',String(hidden));button.innerHTML='<i aria-hidden="true" class="ti ti-eye'+(hidden?'-off':'')+'"></i>';
   card.classList.toggle('dashboard-private',hidden);card.querySelectorAll('.m-value,.m-sub').forEach(el=>{if(hidden)el.setAttribute('aria-hidden','true');else el.removeAttribute('aria-hidden');});
  });
 }
 ['sisventas:session-ready','sisventas:role-changed','sisventas:page-changed'].forEach(name=>document.addEventListener(name,refresh));
 document.addEventListener('sisventas:session-ended',()=>{identity='';preferences={};document.querySelectorAll('.dashboard-eye').forEach(el=>el.hidden=true);});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh);else refresh();
})(window);
