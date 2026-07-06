(function(){
  function q(id){ return document.getElementById(id); }
  function arr(v){ return Array.isArray(v) ? v : Object.values(v||{}); }
  function esc(s){ return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function roleAdmin(){ return ['admin','administrativo'].includes(String(window.currentRole||'').toLowerCase()); }
  function findOT(id){
    var actual = String(id || window.otActualId || '');
    return arr(window.otData).find(function(o){ return o && (String(o.fbKey||'')===actual || String(o.id||'')===actual); }) || null;
  }
  function nextOTId(){
    var max=0;
    arr(window.otData).forEach(function(o){
      var m=String((o&&o.id)||'').match(/OT-(\d+)/i);
      if(m) max=Math.max(max,parseInt(m[1],10)||0);
    });
    return 'OT-' + String(max+1).padStart(3,'0');
  }
  function checksBase(){
    return {
      preparacion: (window.CHECKLISTS&&CHECKLISTS.preparacion||[]).map(function(){return false;}),
      instalacion: (window.CHECKLISTS&&CHECKLISTS.instalacion||[]).map(function(){return false;}),
      verificacion: (window.CHECKLISTS&&CHECKLISTS.verificacion||[]).map(function(){return false;})
    };
  }
  var pasos = [
    {id:'cliente', titulo:'Cliente y ubicación', ayuda:'Datos principales de la visita, dirección y notas administrativas.', sel:'#ot-det-venta,#ot-det-cliente,#ot-det-dir,#ot-det-tecnico'},
    {id:'materiales', titulo:'Materiales', ayuda:'Productos a instalar o materiales asociados a la venta.', sel:'#ot-materiales'},
    {id:'checklist', titulo:'Checklist', ayuda:'Control de preparación, instalación y verificación.', sel:'#checklist-preparacion,#ot-progress-fill'},
    {id:'fotos', titulo:'Fotos y notas', ayuda:'Notas técnicas y fotos del trabajo realizado.', sel:'#ot-notas-lista,#ot-fotos-preview,#ot-nota-nueva'},
    {id:'finalizar', titulo:'Finalizar', ayuda:'Acta de entrega, conformidad, firma y cierre de la OT.', sel:'#ot-acta-conf,#firma-canvas,#btn-completar-ot'},
    {id:'historial', titulo:'Historial', ayuda:'Auditoría interna de la orden.', sel:'#ot-audit', admin:true}
  ];
  function pasosVisibles(){ return pasos.filter(function(p){ return !p.admin || roleAdmin(); }); }
  function cards(){
    var view=q('ot-detalle-view');
    if(!view) return [];
    return Array.from(view.children).filter(function(el){ return el.classList && el.classList.contains('card') && !['ot-wizard-301','ot-wizard-294','ot-wizard-273','ot-pasos-rapidos'].includes(el.id); });
  }
  function clasificar(){
    cards().forEach(function(card){
      card.removeAttribute('data-ot-wstep');
      for(var i=0;i<pasos.length;i++){
        if(card.querySelector(pasos[i].sel)){ card.setAttribute('data-ot-wstep', pasos[i].id); break; }
      }
      if(!card.getAttribute('data-ot-wstep') && (card.querySelector('#ot-cred-lista') || card.querySelector('#ot-reclamo-hist'))) card.setAttribute('data-ot-wstep','cliente');
    });
  }
  function done(step){
    if(step==='cliente') return !!((q('ot-det-cliente')||{}).value) && !!((q('ot-det-dir')||{}).value);
    if(step==='materiales') return !!(q('ot-materiales') && q('ot-materiales').querySelector('tr'));
    if(step==='checklist'){
      var ch=Array.from(document.querySelectorAll('#checklist-preparacion input[type=checkbox],#checklist-instalacion input[type=checkbox],#checklist-verificacion input[type=checkbox]'));
      return ch.length && ch.every(function(x){return x.checked;});
    }
    if(step==='fotos') return !!(q('ot-notas-lista') && q('ot-notas-lista').children.length);
    if(step==='finalizar') return !!((q('ot-acta-conf')||{}).value);
    return false;
  }
  function ensureWizard(){
    var view=q('ot-detalle-view');
    if(!view || view.style.display==='none') return null;
    ['ot-pasos-rapidos','ot-wizard-294','ot-wizard-273'].forEach(function(id){ var e=q(id); if(e) e.remove(); });
    var wiz=q('ot-wizard-301');
    if(!wiz){
      wiz=document.createElement('div');
      wiz.id='ot-wizard-301';
      wiz.className='card';
      wiz.style.cssText='padding:12px 14px;margin-bottom:12px;position:sticky;top:0;z-index:8';
      wiz.innerHTML='<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px"><div><span class="card-title"><i class="ti ti-route"></i> OT por pasos</span><div id="ot-wiz301-title" style="font-size:13px;color:var(--text);margin-top:4px;font-weight:500"></div><div id="ot-wiz301-help" style="font-size:12px;color:var(--text3);margin-top:2px"></div></div><div id="ot-wiz301-nav" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"></div></div><div style="height:4px;background:var(--bg3);border-radius:4px;overflow:hidden;margin-bottom:10px"><div id="ot-wiz301-bar" style="height:100%;background:var(--blue);width:0%;transition:width .2s"></div></div><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;border-top:0.5px solid var(--border);padding-top:10px"><button type="button" class="btn btn-sm" id="ot-wiz301-ant" onclick="otWizardAnterior()"><i class="ti ti-arrow-left"></i> Anterior</button><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-sm" id="ot-wiz301-iniciar" onclick="otWizardIniciar()"><i class="ti ti-player-play"></i> Iniciar OT</button><button type="button" class="btn btn-sm btn-primary" id="ot-wiz301-sig" onclick="otWizardSiguiente()">Siguiente <i class="ti ti-arrow-right"></i></button></div></div>';
      var aviso=q('ot-aviso-cambio-externo');
      if(aviso && aviso.parentNode) aviso.parentNode.insertBefore(wiz,aviso.nextSibling); else view.insertBefore(wiz,view.firstChild);
    }
    return wiz;
  }
  function show(step){
    var vis=pasosVisibles();
    if(!vis.some(function(p){return p.id===step;})) step='cliente';
    window._otWizardStep=step;
    ensureWizard();
    clasificar();
    cards().forEach(function(card){
      var s=card.getAttribute('data-ot-wstep')||'cliente';
      card.style.display = (s===step) ? '' : 'none';
    });
    var idx=vis.findIndex(function(p){return p.id===step;});
    if(idx<0) idx=0;
    var p=vis[idx]||vis[0];
    if(q('ot-wiz301-title')) q('ot-wiz301-title').textContent=p.titulo;
    if(q('ot-wiz301-help')) q('ot-wiz301-help').textContent=p.ayuda||'';
    if(q('ot-wiz301-bar')) q('ot-wiz301-bar').style.width = vis.length>1 ? Math.round((idx/(vis.length-1))*100)+'%' : '100%';
    if(q('ot-wiz301-nav')) q('ot-wiz301-nav').innerHTML = vis.map(function(x,i){
      var activo=x.id===step, ok=done(x.id);
      return '<button type="button" class="btn btn-sm '+(activo?'btn-primary':'')+'" onclick="otWizardIr(\''+x.id+'\')" style="'+(ok&&!activo?'color:var(--green);border-color:var(--green)':'')+'">'+(ok?'<i class="ti ti-check"></i> ':'')+(i+1)+' '+esc(x.titulo.split(' ')[0])+'</button>';
    }).join('');
    if(q('ot-wiz301-ant')) q('ot-wiz301-ant').disabled = idx<=0;
    if(q('ot-wiz301-sig')) q('ot-wiz301-sig').style.display = idx>=vis.length-1 ? 'none' : '';
    var ot=findOT();
    var estado=String((ot&&ot.estado)||'').toLowerCase();
    if(q('ot-wiz301-iniciar')) q('ot-wiz301-iniciar').style.display = (step==='cliente' && estado!=='en_progreso' && estado!=='completada') ? '' : 'none';
    var wiz=q('ot-wizard-301'); if(wiz) wiz.scrollIntoView({behavior:'smooth',block:'start'});
  }
  window.otWizardIr=function(step){ show(step||'cliente'); };
  window.otWizardSiguiente=function(){ var vis=pasosVisibles(), idx=vis.findIndex(function(p){return p.id===(window._otWizardStep||'cliente');}); if(idx<vis.length-1) show(vis[idx+1].id); };
  window.otWizardAnterior=function(){ var vis=pasosVisibles(), idx=vis.findIndex(function(p){return p.id===(window._otWizardStep||'cliente');}); if(idx>0) show(vis[idx-1].id); };
  window.otPasoIr=window.otWizardIr;
  window.otPasoSiguiente=window.otWizardSiguiente;
  window.otPasoAnterior=window.otWizardAnterior;
  window.otWizardIniciar=function(){
    var ot=findOT();
    if(!ot){ if(typeof notify==='function') notify('La OT todavía no terminó de cargar. Esperá unos segundos.'); return; }
    if(!ot.checks) ot.checks=checksBase();
    ot.estado='en_progreso';
    ot.fechaInicio=ot.fechaInicio || new Date().toISOString();
    if(!ot.audit) ot.audit=[];
    ot.audit.push({fecha:new Date().toLocaleDateString('es-AR')+' '+new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}),usuario:window.currentUser||'Sistema',accion:'OT iniciada'});
    var b=q('ot-det-estado-badge'); if(b && typeof otBadge==='function') b.innerHTML=otBadge('en_progreso');
    window._otGuardandoLocalHasta=Date.now()+2500;
    var prom=(typeof fbGuardarOT==='function') ? fbGuardarOT(ot) : Promise.resolve();
    prom.then(function(){ if(typeof notify==='function') notify('✓ OT iniciada'); show('checklist'); }).catch(function(e){ if(typeof notify==='function') notify('Error al iniciar OT: '+e.message); });
  };
  document.addEventListener('sisventas:ot-opened',function(){
    window._otWizardStep='cliente';
    setTimeout(function(){ show('cliente'); },250);
    setTimeout(function(){ show(window._otWizardStep||'cliente'); },900);
  });
  window.instalarWizardOT=function(){ show(window._otWizardStep||'cliente'); };
  document.addEventListener('sisventas:ot-closed',function(){ var w=q('ot-wizard-301'); if(w) w.remove(); });
  var nuevaPrev=window.nuevaOT;
  window.nuevaOT=function(){
    if(!window.fbDB){ if(typeof nuevaPrev==='function') return nuevaPrev.apply(this,arguments); if(typeof notify==='function') notify('Sin conexión'); return; }
    var ot={
      id:nextOTId(), ventaId:'', cliente:'', clienteId:'', origen:'manual', estado:'pendiente', tecnico:'',
      fecha:new Date().toISOString().slice(0,10), hora:'', duracion:'2 horas', tipoVisita:'Instalación nueva',
      dir:'', obs:'', obsTecnico:'', prioridad:false, progreso:0, checks:checksBase(), materiales:[], notasTecnico:[], audit:[{fecha:new Date().toLocaleDateString('es-AR')+' '+new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}),usuario:window.currentUser||'Sistema',accion:'OT creada manualmente'}], ts:Date.now()
    };
    window.fbPush(window.fbRef(window.fbDB, FB_PATHS.ordenesTrabajo), ot).then(function(ref){
      ot.fbKey=ref.key;
      if(Array.isArray(window.otData)) window.otData.push(ot);
      if(typeof notify==='function') notify('✓ Orden de trabajo creada');
      if(typeof showPage==='function') showPage('ordentrabajo', null);
      setTimeout(function(){ window.verOT(ref.key); },250);
    }).catch(function(e){ if(typeof notify==='function') notify('Error: '+e.message); });
  };
  document.addEventListener('input',function(e){ if(e.target && e.target.closest && e.target.closest('#ot-detalle-view')) setTimeout(function(){ show(window._otWizardStep||'cliente'); },150); });
  document.addEventListener('change',function(e){ if(e.target && e.target.closest && e.target.closest('#ot-detalle-view')) setTimeout(function(){ show(window._otWizardStep||'cliente'); },150); });
})();
