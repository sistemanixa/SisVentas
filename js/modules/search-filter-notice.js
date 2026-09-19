/* Contadores y avisos comunes. Sólo modifica la presentación de los listados. */
(function(){
  'use strict';
  var entries=new Map(),timer;
  var targets={'ventas-search':'ventas-tbody','ppto-buscar':'ppto-tbody-main','prod-search':'prod-tbody','ot-busq':'ot-tbody','cob-buscador':'pagos-tbody','cc-buscador':'cc-tbody','tes-buscar':'tes-lista','sp-busqueda':'sp-lista','eq-search':'eq-cards','com-f-buscar':'comisiones-tbody','gas-buscar':'gastos-tbody','inf-search':'informes-tbody','catalogo-buscar':'catalogo-grid','fv-ventas-facturadas-buscar':'fv-ventas-facturadas-lista','ot-sel-prod-buscar':'ot-sel-prod-lista','kit-sel-buscar':'kit-sel-lista'};
  function visible(n){return !!n&&!n.hidden&&n.getClientRects().length>0;}
  function text(n,s){if(n.textContent!==s)n.textContent=s;}
  function eligible(n){return n instanceof HTMLInputElement&&n.id!=='chat-buscar'&&(n.matches('.search-input')||n.type==='search')&&(/buscar/i.test(n.placeholder||'')||/busca|search/i.test(n.id)||n.type==='search');}
  function resultFor(n){if(targets[n.id])return document.getElementById(targets[n.id]);var scope=n.closest('.card,dialog,[role="dialog"]'),tables=scope?scope.querySelectorAll('tbody'):[];return tables.length===1?tables[0]:null;}
  function count(result){
    var rows=result.tagName==='TBODY'?Array.from(result.rows).filter(function(r){return r.cells.length>1&&!r.querySelector('td[colspan]');}):Array.from(result.children).filter(function(r){return !/^(sin |no hay|no encontramos|cargando|buscá|seleccioná)/i.test(r.textContent.trim())&&!r.matches('h2,h3,h4,.catalogo-grupo-titulo');});
    if(result.id==='catalogo-grid')rows=Array.from(result.querySelectorAll('.catalogo-tarjeta'));
    return rows.filter(visible).length;
  }
  function create(input,result){
    var wrap=document.createElement('div');wrap.className='sv-search-field';wrap.style.flex=input.style.flex||'1 1 180px';wrap.style.width=input.style.width||'100%';
    input.before(wrap);wrap.append(input);input.classList.add('sv-search-has-count');
    var counter=document.createElement('span');counter.className='sv-search-result-count';counter.setAttribute('aria-live','polite');wrap.append(counter);
    var native=document.getElementById(input.id==='prod-search'?'prod-search-status':input.id==='ventas-search'?'ventas-search-status':'__none');if(native)native.hidden=true;
    var notice=document.createElement('div');notice.className='sv-search-filter-notice';notice.setAttribute('role','status');
    var label=document.createElement('span'),clear=document.createElement('button');clear.type='button';clear.className='btn btn-sm';clear.textContent='Quitar filtros';notice.append(label,clear);
    (result.closest('.table-wrap')||result).before(notice);
    var e={input:input,result:result,scope:result.closest('.card')||input.closest('.page')||result.parentElement,counter:counter,native:native,notice:notice,label:label,controls:[],tabs:[]};
    clear.onclick=function(){
      if(input.id==='ventas-search'){limpiarFiltrosVentas();schedule();return;}
      input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));
      e.controls.forEach(function(n){
        if(n.tagName==='SELECT'){var neutral=Array.from(n.options).find(function(o){return /^(todos?|todas?|cualquier)(\b|$)/i.test(o.textContent.trim());});if(!neutral)return;n.value=neutral.value;}
        else if(n.type==='checkbox')n.checked=false;else n.value='';
        n.dispatchEvent(new Event('change',{bubbles:true}));
      });
      var all=e.tabs.find(function(b){return /^(todos?|todas?)$/i.test(b.textContent.trim());});if(all)all.click();schedule();input.focus();
    };
    return e;
  }
  function update(e){
    var input=e.input;if(!visible(input))return;
    var native=e.native&&e.native.textContent.trim();
    text(e.counter,input.id==='prod-search'&&native?native:count(e.result)+' resultados visibles');
    var parts=input.value.trim()?['«'+input.value.trim()+'»']:[];
    e.controls=Array.from(e.scope.querySelectorAll('select,input[type="date"],input[type="month"],input[type="checkbox"]')).filter(function(n){return visible(n)&&!n.closest('tbody')&&!/search-field|orden|page-size|pagination/i.test(n.id)&&(n.type==='date'||n.type==='month'||/filtro|filter|estado|periodo|mes|^gas-f-|^com-f-/.test(n.id));});
    e.controls.forEach(function(n){
      if(n.tagName==='SELECT'){var o=n.options[n.selectedIndex],label=o?o.textContent.trim():'';if(label&&!/^(todos?|todas?|cualquier|seleccion)/i.test(label))parts.push(label);}
      else if(n.type==='checkbox'){if(n.checked)parts.push((n.closest('label')||n).textContent.trim()||'Filtro activo');}
      else if(n.value)parts.push((n.getAttribute('aria-label')||(n.type==='month'?'Período':'Fecha'))+': '+n.value);
    });
    e.tabs=Array.from(e.scope.querySelectorAll('button[id]')).filter(function(b){return /^(vtab-|tab-|cob-filtro-|cc-filtro-)/.test(b.id);});
    e.tabs.forEach(function(b){if((b.classList.contains('btn-primary')||b.style.background==='var(--text)'||b.getAttribute('aria-selected')==='true')&&!/^(todos?|todas?)$/i.test(b.textContent.trim()))parts.push(b.textContent.trim());});
    if(input.id==='ventas-search'){var old=document.getElementById('ventas-filtro-activo-banner');if(old&&old.style.display!=='none')old.style.display='none';}
    text(e.label,'Filtro aplicado: '+Array.from(new Set(parts)).join(' · ')+'. Puede haber registros ocultos.');
    var hidden=!parts.length;if(e.notice.hidden!==hidden)e.notice.hidden=hidden;
  }
  function scan(){
    entries.forEach(function(e,n){if(!n.isConnected){e.notice.remove();entries.delete(n);}});
    document.querySelectorAll('input').forEach(function(n){var page=n.closest('.page');if(page&&!page.classList.contains('active'))return;if(!eligible(n)||!visible(n))return;var result=resultFor(n);if(!result)return;var e=entries.get(n);if(!e){e=create(n,result);entries.set(n,e);}e.result=result;update(e);});
  }
  function schedule(){if(timer)return;timer=setTimeout(function(){timer=null;scan();},100);}
  ['input','change','click','sisventas:page-changed'].forEach(function(name){document.addEventListener(name,schedule);});window.addEventListener('focus',schedule);
  function start(){scan();new MutationObserver(function(changes){if(changes.some(function(m){var n=m.target.nodeType===1?m.target:m.target.parentElement;if(!n || n.closest('.sv-search-filter-notice,.sv-search-field'))return false;var page=n.closest('.page');if(page&&!page.classList.contains('active'))return false;return m.type==='childList'||n.matches('tr,select,input,button');}))schedule();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','style','aria-selected']});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
