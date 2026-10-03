(function(){
 'use strict';
 function init(){
  const box=document.getElementById('s-module-search');if(!box)return;
  const nav=box.parentElement,input=box.querySelector('input'),clear=box.querySelector('button'),results=box.querySelector('.s-module-results'),count=box.querySelector('[role="status"]');
  const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function reset(){input.value='';box.classList.remove('is-searching');results.replaceChildren();count.textContent='';clear.hidden=true;}
  function update(){
   const query=normalize(input.value).trim();box.classList.remove('is-searching');results.replaceChildren();clear.hidden=!query;
   if(!query){count.textContent='';return;}
   const words=query.split(/\s+/),matches=[];
   nav.querySelectorAll(':scope > .nav-item[onclick]').forEach(item=>{
    const route=(item.getAttribute('onclick')||'').match(/showPage\('([^']+)'/);
    if(!route||typeof permisoModulo!=='function'||!permisoModulo(route[1])||getComputedStyle(item).display==='none'||getComputedStyle(item).visibility==='hidden')return;
    const copy=item.cloneNode(true);copy.querySelectorAll('i,.badge-role,[id^="badge-"]').forEach(n=>n.remove());
    const label=copy.textContent.trim();if(!words.every(word=>normalize(label).includes(word)))return;
    matches.push({item,label,route:route[1]});
   });
   box.classList.add('is-searching');
   matches.forEach(({item,label,route})=>{
    const button=document.createElement('button');button.type='button';button.className='nav-item';
    const icon=item.querySelector('i');if(icon)button.appendChild(icon.cloneNode(true));button.appendChild(document.createTextNode(label));
    button.addEventListener('click',()=>{if(!permisoModulo(route))return;reset();item.click();});results.appendChild(button);
   });
   count.textContent=matches.length?(matches.length===1?'1 módulo encontrado':matches.length+' módulos encontrados'):'Sin resultados';
  }
  input.addEventListener('input',update);
  clear.addEventListener('click',()=>{reset();input.focus();});
  input.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();reset();}else if(e.key==='Enter'){const first=results.querySelector('button');if(first){e.preventDefault();e.stopPropagation();first.click();}}else if(e.key==='ArrowDown'){const first=results.querySelector('button');if(first){e.preventDefault();first.focus();}}});
  document.addEventListener('sisventas:session-ended',reset);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
