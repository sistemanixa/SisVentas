(function () {
  'use strict';
  var rules = [], recognition = null;
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
  async function manage() {
    if (!admin()) return;
    try { await load(); } catch(e) { notify('No se pudieron leer las reglas: '+e.message); return; }
    var d=document.createElement('dialog'); d.style.cssText='position:fixed;inset:0;margin:auto;width:min(650px,92vw);max-height:85vh;overflow:auto;padding:24px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:14px';
    function el(tag,text,parent) {var e=document.createElement(tag);e.textContent=text||'';(parent||d).appendChild(e);return e;}
    el('h3','Reglas compartidas de instalación');
    el('p','Cada regla agrega un material o servicio por unidad de una categoría. El admin la confirma; se aplica también a la administrativa.');
    var productos=Object.values(typeof prodData!=='undefined'?prodData:{}).filter(function(p){return !p.eliminado&&p.activo!==false;});
    function select(label,options){var l=el('label',label),s=el('select','',l);s.className='search-input';s.style.cssText='display:block;width:100%;margin:8px 0 16px';options.forEach(function(o){var op=el('option',o[1],s);op.value=o[0];});return s;}
    var cat=select('Cuando el producto pertenece a',Array.from(new Set(productos.map(function(p){return p.categoria;}).filter(Boolean))).sort().map(function(c){return [c,c];}));
    var prod=select('Agregar este producto o mano de obra',productos.map(function(p){return [p.codigo,p.codigo+' · '+(p.nombre||p.descripcion)+' · '+(p.unidad||'Unidad')];}));
    var l=el('label','Cantidad por unidad de la categoría'),q=el('input','',l);q.type='number';q.min='1';q.step='1';q.value='1';q.className='search-input';
    var preview=el('p');function update(){preview.textContent='Por cada producto de '+cat.value+', agregar '+q.value+' × '+prod.options[prod.selectedIndex]?.textContent+'. Reemplaza la sugerencia de ese mismo código.';}cat.onchange=prod.onchange=q.oninput=update;update();
    function button(text,fn){var b=el('button',text);b.type='button';b.className='btn btn-sm';b.onclick=fn;return b;}
    button('Confirmar y guardar regla',async function(){if(!admin())return;var n=Number(q.value);if(!cat.value||!prod.value||!Number.isInteger(n)||n<=0){notify('Revisá categoría, producto y cantidad.');return;}var b=this;b.disabled=true;try{var key=encodeURIComponent(cat.value+'|'+prod.value).replace(/\./g,'%2E');await window.fbSet(window.fbRef(window.fbDB,'sv_ia_reglas/'+key),{categoria:cat.value,codigo:prod.value,cantidad:n,activa:true,actualizadaEn:Date.now(),autor:currentUserUid||''});notify('Regla compartida guardada.');d.close();}catch(e){notify('No se guardó la regla: '+e.message);}finally{b.disabled=false;}});
    el('h4','Reglas activas');rules.forEach(function(r){el('p',r.categoria+' → '+r.cantidad+' × '+r.codigo);button('Desactivar',async function(){if(!admin())return;this.disabled=true;try{var key=encodeURIComponent(r.categoria+'|'+r.codigo).replace(/\./g,'%2E');await window.fbSet(window.fbRef(window.fbDB,'sv_ia_reglas/'+key+'/activa'),false);d.close();notify('Regla desactivada.');}catch(e){this.disabled=false;notify(e.message);}});});
    button('Cerrar',function(){d.close();});d.addEventListener('close',function(){d.remove();});document.body.appendChild(d);d.showModal();
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
  window.svIaLearning={load:load,apply:apply,manage:manage,dictate:dictate,stop:stop};
})();
