(function () {
  'use strict';
  var rules = [], recognition = null, teachingTurns = [];
  function admin() { return typeof currentRole !== 'undefined' && currentRole === 'admin'; }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
  async function load() {
    if (!window.fbDB || !window.fbGet) throw Error('Esperá a que conecte el sistema.');
    var snap = await window.fbGet(window.fbRef(window.fbDB, 'sv_ia_reglas'));
    rules = Object.values(snap.val() || {}).filter(function (r) { return r && r.activa === true; });
  }
  function apply(items, base) {
    var out = base.slice();
    rules.forEach(function (r) {
      var qty = items.filter(function(i) { return !i.automatico && norm(i.p.categoria) === norm(r.categoria); }).reduce(function(n,i) { return n + Number(i.qty || 0); },0);
      if (!qty) return;
      // One admin rule owns an accessory for a category; replace its built-in suggestion.
      out = out.filter(function(b) { return b.codigo !== r.codigo || b.id === 'admin-' + r.codigo; });
      var existing = out.find(function(b) { return b.id === 'admin-' + r.codigo; });
      if (existing) existing.qty += qty * r.cantidad;
      else out.push({id:'admin-'+r.codigo,codigo:r.codigo,qty:qty*r.cantidad,label:r.cantidad+' × '+r.codigo+' por producto de '+r.categoria,metros:false});
    });
    return out;
  }
  async function manage(proposal) {
    if (!admin()) return;
    try { await load(); } catch(e) { notify('No se pudieron leer las reglas: '+e.message); return; }
    var d=document.createElement('dialog'); d.className='ia-settings'; d.style.cssText='position:fixed;inset:0;margin:auto;width:min(650px,92vw);max-height:85vh;overflow:auto;padding:24px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:14px';
    function el(tag,text,parent) {var e=document.createElement(tag);e.textContent=text||'';(parent||d).appendChild(e);return e;}
    var head=el('div');head.className='ia-settings-head';el('h3','Configuración del asistente',head);var close=el('button','×',head);close.className='btn btn-sm';close.setAttribute('aria-label','Cerrar configuración');close.onclick=function(){d.close();};
    el('p','Las reglas confirmadas se aplican también a administración.').className='ia-settings-help';var manual=el('details');manual.className='ia-settings-section';manual.open=!!proposal;el('summary','Configurar una regla manualmente',manual);var original=d;d=manual;
    var productos=Object.values(typeof prodData!=='undefined'?prodData:{}).filter(function(p){return !p.eliminado&&p.activo!==false;});
    function select(label,options){var l=el('label',label),s=el('select','',l);s.className='search-input';s.style.cssText='display:block;width:100%;margin:8px 0 16px';options.forEach(function(o){var op=el('option',o[1],s);op.value=o[0];});return s;}
    var cat=select('Cuando el producto pertenece a',Array.from(new Set(productos.map(function(p){return p.categoria;}).filter(Boolean))).sort().map(function(c){return [c,c];}));
    var prod=select('Agregar este producto o mano de obra',productos.map(function(p){return [p.codigo,p.codigo+' · '+(p.nombre||p.descripcion)+' · '+(p.unidad||'Unidad')];}));
    var l=el('label','Cantidad por unidad de la categoría'),q=el('input','',l);q.type='number';q.min='1';q.step='1';q.value='1';q.className='search-input';
    if(proposal){cat.value=proposal.categoria;prod.value=proposal.codigo;q.value=proposal.cantidad;}
    var preview=el('p');function update(){preview.textContent='Por cada producto de '+cat.value+', agregar '+q.value+' × '+prod.options[prod.selectedIndex]?.textContent+'. Reemplaza la sugerencia de ese mismo código.';}cat.onchange=prod.onchange=q.oninput=update;update();
    function button(text,fn){var b=el('button',text);b.type='button';b.className='btn btn-sm';b.onclick=fn;return b;}
    button('Confirmar y guardar regla',async function(){if(!admin())return;var n=Number(q.value);if(!cat.value||!prod.value||!Number.isInteger(n)||n<=0){notify('Revisá categoría, producto y cantidad.');return;}var b=this;b.disabled=true;try{var key=encodeURIComponent(cat.value+'|'+prod.value).replace(/\./g,'%2E');await window.fbSet(window.fbRef(window.fbDB,'sv_ia_reglas/'+key),{categoria:cat.value,codigo:prod.value,cantidad:n,activa:true,actualizadaEn:Date.now(),autor:currentUserUid||''});notify('Regla compartida guardada.');d.close();}catch(e){notify('No se guardó la regla: '+e.message);}finally{b.disabled=false;}});
    d=original;el('h4','Reglas guardadas ('+rules.length+')');if(!rules.length)el('p','Todavía no hay reglas guardadas.').className='ia-settings-help';rules.forEach(function(r){el('p',r.categoria+' → '+r.cantidad+' × '+r.codigo);button('Desactivar',async function(){if(!admin())return;this.disabled=true;try{var key=encodeURIComponent(r.categoria+'|'+r.codigo).replace(/\./g,'%2E');await window.fbSet(window.fbRef(window.fbDB,'sv_ia_reglas/'+key+'/activa'),false);d.close();notify('Regla desactivada.');}catch(e){this.disabled=false;notify(e.message);}});});
    button('Cerrar',function(){d.close();});d.addEventListener('close',function(){d.remove();});document.body.appendChild(d);d.showModal();
  }
  async function teach(){
    if(!admin())return;
    var input=document.getElementById('ia-teaching-input')||document.getElementById('ia-input'),text=input.value.trim();
    if(!text){notify('Escribí o dictá la regla y luego presioná Enseñar.');return;}
    var button=document.getElementById('ia-ensenar');button.disabled=true;button.textContent='Interpretando…';
    try{
      var products=Object.values(prodData||{}).filter(p=>p.activo!==false&&!p.eliminado).map(p=>({codigo:p.codigo,nombre:p.nombre||p.descripcion,categoria:p.categoria,unidad:p.unidad}));
      teachingTurns.push({role:'user',content:text});
      var response=await fetch((window.SV_IA_ENDPOINT||'https://asistente-171899432710.southamerica-east1.run.app')+'/learn',{method:'POST',headers:{'Content-Type':'application/json','X-Frontend-Key':SISVENTAS_FUNCTIONS.frontendKey},body:JSON.stringify({system:'Convertí una enseñanza de instalación en JSON estricto, sin Markdown. No ejecutes acciones. Formato: {"categoria":"categoría exacta","codigo":"código exacto del material o servicio a agregar","cantidad":entero positivo}. La cantidad es por unidad del producto de la categoría. Usá únicamente referencias del catálogo. Si hay ambigüedad, varias reglas, exclusiones, o la regla no puede expresarse con esos tres campos, devolvé {"pregunta":"aclaración breve"}. No pierdas condiciones ni supongas un modelo entre varios. Catálogo: '+JSON.stringify(products),messages:teachingTurns.slice(-8)})});
      var data=await response.json();if(!response.ok||data.error)throw Error('No se pudo interpretar la enseñanza.');
      var raw=(data.content||[]).map(b=>b.text||'').join('');var fenced=raw.match(/```(?:json)?\s*([\s\S]*?)```/i);var rule=JSON.parse(fenced?fenced[1]:raw);
      if(rule.pregunta){teachingTurns.push({role:'assistant',content:JSON.stringify(rule)});input.value='';iaMostrarMensaje('bot',String(rule.pregunta)+' Respondé y tocá Enseñar para continuar.');syncComposer();return;}
      if(!products.some(p=>p.categoria===rule.categoria)||!products.some(p=>p.codigo===rule.codigo)||!Number.isInteger(rule.cantidad)||rule.cantidad<=0)throw Error('La regla necesita aclaraciones; no se guardó.');
      iaMostrarMensaje('bot','Interpreté la enseñanza. Revisá la categoría, el producto y la cantidad antes de confirmar.');var current=input.closest('dialog');if(current)current.close();await manage(rule);teachingTurns=[];
    }catch(e){notify(e.message||'No se interpretó la regla. No se guardaron cambios.');}finally{button.disabled=false;button.textContent='Enseñar';syncComposer();}
  }
  function stop(){if(recognition){recognition.abort();recognition=null;}}
  function dictate(){
    if(recognition){recognition.stop();return;}
    var R=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!R){notify('Este navegador no admite dictado. Podés usar el micrófono del teclado del celular.');return;}
    var input=document.getElementById('ia-input'),button=document.getElementById('ia-dictar'),prefix=input.value.trim();
    var r=new R();recognition=r;r.lang='es-AR';r.continuous=false;r.interimResults=false;
    r.onresult=function(e){var text=Array.from(e.results).map(function(result){return result[0].transcript;}).join(' ');input.value=(prefix?prefix+' ':'')+text;input.dispatchEvent(new Event('input',{bubbles:true}));};
    r.onerror=function(e){notify(e.error==='not-allowed'?'Permití el micrófono para dictar.':'No se pudo transcribir el audio. Intentá nuevamente.');};
    r.onend=function(){recognition=null;button.textContent='Dictar';button.setAttribute('aria-pressed','false');};
    try{r.start();button.textContent='Detener';button.setAttribute('aria-pressed','true');}catch(e){recognition=null;notify(e.message);}
  }
  function syncComposer(){var i=document.getElementById('ia-input'),b=document.getElementById('ia-ensenar');if(b)b.hidden=!admin()||!i||!i.value.trim();}
  document.addEventListener('input',function(e){if(e.target.id==='ia-input')syncComposer();});
  window.svIaLearning={syncComposer:syncComposer,teach:teach,load:load,apply:apply,manage:manage,dictate:dictate,stop:stop};
})();
