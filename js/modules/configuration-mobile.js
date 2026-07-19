/* ══════════════════════════════════════════════════════════════════════════════
   v20.339 — SisVentas Mobile UX: Configuración en tarjetas
   - Móvil: Cargos, Comisiones y Actividad dejan de depender de tablas anchas.
   - Escritorio/tablet: no altera la lógica ni la vista de PC.
   ══════════════════════════════════════════════════════════════════════════════ */
(function(){
  function esc331(v){
    if (typeof escapeHTML === 'function') return escapeHTML(v);
    return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
  }
  function money331(v){ return '$' + Math.round(parseFloat(v)||0).toLocaleString('es-AR'); }
  function isMob331(){ return window.matchMedia && window.matchMedia('(max-width: 760px)').matches; }
  function addCss331(){
    if (document.getElementById('sv-mobile-ux-331-css')) return;
    var css = document.createElement('style');
    css.id = 'sv-mobile-ux-331-css';
    css.textContent = `
@media (max-width:760px){
  body{font-size:14px!important}
  .content{padding:12px 10px 86px!important;overflow-x:hidden!important}
  .page{max-width:100vw!important;overflow-x:hidden!important}
  .card{border-radius:16px!important;padding:16px!important;overflow-x:hidden!important}
  .card-title{font-size:12px!important;letter-spacing:1.2px!important}
  .topbar{height:58px!important;padding:0 12px!important}
  .page-title{font-size:18px!important;font-weight:700!important;max-width:158px!important}
  .topbar-right{gap:6px!important}
  .role-badge{font-size:13px!important;padding:6px 12px!important}
  #fb-status{font-size:13px!important}
  .icon-btn{width:42px!important;height:42px!important;border-radius:14px!important}
  .hamburger.icon-btn{width:42px!important;height:42px!important}
  .cfg-panel > .card{margin-top:8px!important}
  #page-configuracion > div:first-child:not(#cfg-tabs-main){position:sticky!important;top:-1px!important;z-index:20!important;overflow-x:auto!important;white-space:nowrap!important;padding:6px!important;margin:0 -2px 8px!important;scrollbar-width:none!important}
  #cfg-tabs-main{position:static!important;overflow:visible!important;white-space:normal!important;scrollbar-width:none!important}
  #page-configuracion > div:first-child::-webkit-scrollbar{display:none!important}
  .cfg-tab{font-size:14px!important;padding:10px 16px!important;flex:0 0 auto!important;border-radius:12px!important}
  #page-configuracion select,.cfg-panel select{width:100%!important;max-width:100%!important;height:42px!important;border-radius:10px!important;background:var(--bg3)!important;color:var(--text)!important;border:0.5px solid var(--border2)!important;padding:8px 12px!important}
  #cfg-cargos .card-head{display:block!important}
  #cfg-cargos .card-head .card-title{display:block!important;margin-bottom:14px!important}
  #cfg-cargos .card-head .btn{width:100%!important;justify-content:center!important;height:48px!important;font-size:15px!important;border-radius:14px!important;background:var(--text)!important;color:var(--bg2)!important}
  #cfg-cargos table#cargos-tbl,#cfg-comisiones table#cfg-comisiones-tbl,#cfg-actividad table{display:none!important}
  .sv331-mobile-list{display:flex!important;flex-direction:column!important;gap:10px!important;margin-top:14px!important}
  .sv331-card{background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.015));border:0.5px solid var(--border);border-radius:14px;padding:14px 12px;box-shadow:0 8px 22px rgba(0,0,0,.12)}
  .sv331-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
  .sv331-title{font-size:15px;font-weight:700;color:var(--text);line-height:1.2}
  .sv331-sub{font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.45px;margin-top:2px}
  .sv331-values{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}
  .sv331-mini{background:rgba(0,0,0,.12);border:0.5px solid var(--border);border-radius:10px;padding:8px 8px;min-width:0}
  .sv331-mini label{display:block;font-size:10px;color:var(--text3);margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sv331-mini input{width:100%!important;background:transparent!important;border:none!important;color:var(--text)!important;font-size:15px!important;font-weight:600!important;text-align:center!important;outline:none!important;padding:0!important}
  .sv331-chevron{width:30px;height:30px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--text2);border:0.5px solid var(--border)}
  .sv331-info-card{background:var(--blue-bg)!important;color:var(--blue)!important;border:0.5px solid rgba(96,165,250,.22)!important;border-radius:14px!important;padding:12px 14px!important;font-size:13px!important;line-height:1.45!important}
  #cfg-comisiones .sv331-top-card{display:grid!important;grid-template-columns:44px 1fr 112px!important;align-items:center!important;gap:12px!important;background:var(--bg3)!important;border-radius:14px!important;padding:14px!important;margin-bottom:14px!important}
  #cfg-comisiones .sv331-top-card input{width:74px!important;height:46px!important;border-radius:12px!important;background:var(--bg)!important;color:var(--text)!important;font-size:20px!important;font-weight:800!important;text-align:center!important;border:0.5px solid var(--border2)!important}
  #cfg-comisiones .sv331-top-card button{width:42px!important;height:42px!important;border-radius:14px!important;justify-content:center!important;background:var(--text)!important;color:var(--bg2)!important}
  #cfg-comisiones .sv331-com-head{display:grid;grid-template-columns:1fr 76px 76px 84px 28px;gap:6px;align-items:center;color:var(--text3);font-size:10px;margin:8px 2px 6px;text-transform:uppercase;letter-spacing:.4px}
  #cfg-comisiones .sv331-com-row{display:grid;grid-template-columns:1fr 76px 76px 84px 28px;gap:6px;align-items:center;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.015));border:0.5px solid var(--border);border-radius:12px;padding:12px 10px;margin-bottom:8px}
  #cfg-comisiones .sv331-com-row input{width:100%!important;text-align:center!important;border:0.5px solid var(--border)!important;background:var(--bg3)!important;border-radius:8px!important;color:var(--text)!important;font-size:15px!important;padding:8px 4px!important}
  #cfg-comisiones .sv331-com-row .btn{padding:5px!important;min-width:28px!important;height:32px!important;justify-content:center!important}
  #cfg-actividad .card > div:nth-child(2){font-size:14px!important;line-height:1.35!important;margin-bottom:14px!important}
  #cfg-actividad .card > div[style*="display:flex"]{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;margin-bottom:14px!important}
  #cfg-actividad .card > div[style*="display:flex"] .btn{height:42px!important;justify-content:center!important}
  .sv331-activity{display:flex!important;flex-direction:column!important;gap:8px!important;margin-top:12px!important}
  .sv331-act-card{display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.012));border:0.5px solid var(--border);border-radius:12px;padding:10px 10px}
  .sv331-act-ico{width:36px;height:36px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:var(--green-bg);color:var(--green);font-size:19px}
  .sv331-act-ico.out{background:var(--red-bg);color:var(--red)}
  .sv331-act-date{font-size:11px;color:var(--text3);margin-bottom:3px}
  .sv331-act-user{font-size:12px;font-weight:700;color:var(--text);line-height:1.2}
  .sv331-act-action{font-size:12px;color:var(--text2);text-align:right;max-width:90px;line-height:1.2}
  .sv331-pager{display:flex;gap:6px;justify-content:center;margin-top:12px;flex-wrap:wrap}
  .sv331-pager button{min-width:34px;height:34px;border-radius:9px;border:0.5px solid var(--border);background:var(--bg3);color:var(--text2)}
  .sv331-pager button.active{background:var(--blue-bg);color:var(--blue);font-weight:700}
}
@media (min-width:761px){.sv331-mobile-list,.sv331-activity{display:none!important}}
`;
    document.head.appendChild(css);
  }
  function makeCargos331(){
    var panel=document.getElementById('cfg-cargos'); if(!panel) return;
    var old=document.getElementById('sv331-cargos-list'); if(old) old.remove();
    if(!isMob331()) return;
    var card=panel.querySelector('.card'); if(!card) return;
    var ids=Object.keys(window.CARGOS_DATA||{}).sort(function(a,b){return ((CARGOS_DATA[a]||{}).nombre||a).localeCompare(((CARGOS_DATA[b]||{}).nombre||b));});
    var list=document.createElement('div'); list.id='sv331-cargos-list'; list.className='sv331-mobile-list';
    list.innerHTML=ids.map(function(id){
      var c=CARGOS_DATA[id]||{};
      return '<div class="sv331-card" data-cargo-id="'+esc331(id)+'"><div class="sv331-row"><div><div class="sv331-title">'+esc331(c.nombre||id)+'</div><div class="sv331-sub">'+esc331(c.categoriaBase||'')+'</div></div><button class="sv331-chevron" onclick="cargosAbrirNuevo(\''+esc331(id)+'\')"><i class="ti ti-chevron-right"></i></button></div>'+ 
        '<div class="sv331-values">'+
        '<div class="sv331-mini"><label>Valor hora</label><input type="number" value="'+(parseFloat(c.valorHora)||0)+'" onchange="cargosEditarRapido(\''+esc331(id)+'\',\'valorHora\',this.value)"></div>'+ 
        '<div class="sv331-mini"><label>Hs extra</label><input type="number" value="'+(parseFloat(c.valorHoraExtra)||0)+'" onchange="cargosEditarRapido(\''+esc331(id)+'\',\'valorHoraExtra\',this.value)"></div>'+ 
        '<div class="sv331-mini"><label>Días/mes</label><input type="number" value="'+(parseFloat(c.diasMes)||0)+'" onchange="cargosEditarRapido(\''+esc331(id)+'\',\'diasMes\',this.value)"></div>'+ 
        '</div></div>';
    }).join('');
    card.appendChild(list);
    var info = Array.from(card.children).find(function(x){return /Cada cargo define/.test(x.textContent||'');});
    if(info) info.classList.add('sv331-info-card');
  }
  function guardarComisionMobile331(id, btn){
    var row = btn && btn.closest ? btn.closest('.sv331-com-row') : null; if(!row) return;
    var inputs = row.querySelectorAll('input');
    var cfg = { pct: parseFloat(inputs[0].value)||0, min: parseFloat(inputs[1].value)||0, max: parseFloat(inputs[2].value)||0 };
    if (typeof guardarConfigComisionCargo === 'function') guardarConfigComisionCargo(id, cfg);
    if(window.fbDB){
      window.fbSet(window.fbRef(window.fbDB,'sisventas/config/comisiones'), (typeof _comisionesParaFirebase==='function'?_comisionesParaFirebase():(window.CONFIG_COMISIONES||CONFIG_COMISIONES))).then(function(){ if(typeof notify==='function') notify('✓ Comisión guardada'); }).catch(function(e){ if(typeof notify==='function') notify('Error: '+e.message); });
    }
  }
  window.guardarComisionMobile331 = guardarComisionMobile331;
  function makeComisiones331(){
    var panel=document.getElementById('cfg-comisiones'); if(!panel) return;
    var old=document.getElementById('sv331-comisiones-list'); if(old) old.remove();
    var oldTop=document.getElementById('sv331-comisiones-top'); if(oldTop) oldTop.remove();
    if(!isMob331()) return;
    var card=panel.querySelector('.card'); if(!card) return;
    var top=document.createElement('div'); top.id='sv331-comisiones-top'; top.className='sv331-top-card';
    var max = (window.APROBACION_CONFIG && APROBACION_CONFIG.maxComisionPct) || ((document.getElementById('cfg-max-comision-pct')||{}).value) || 10;
    top.innerHTML='<i class="ti ti-shield-check" style="font-size:24px;color:var(--blue)"></i><div><div style="font-size:14px;font-weight:800;color:var(--text);line-height:1.15">Tope máximo de comisión global</div><div style="font-size:12px;color:var(--text3);line-height:1.25;margin-top:4px">Límite global sobre ganancia.</div></div><div style="display:flex;align-items:center;gap:6px"><input type="number" id="cfg-max-comision-pct-mob331" value="'+esc331(max)+'"><span style="color:var(--text3)">%</span><button class="btn btn-sm" onclick="var o=document.getElementById(\'cfg-max-comision-pct\');var m=document.getElementById(\'cfg-max-comision-pct-mob331\');if(o&&m)o.value=m.value;guardarMaxComisionPct()"><i class="ti ti-check"></i></button></div>';
    card.querySelectorAll('i.ti-shield-check').forEach(function(ic){var padre=ic.parentElement;if(padre&&padre.id!=='sv331-comisiones-top'&&!padre.closest('#sv331-comisiones-top'))padre.style.display='none';});
    var warn=card.querySelector('div[style*="amber-bg"]'); if(warn) warn.insertAdjacentElement('afterend', top); else card.insertBefore(top, card.firstChild.nextSibling);
    var ids=Object.keys(window.CARGOS_DATA||{}).sort(function(a,b){return ((CARGOS_DATA[a]||{}).nombre||a).localeCompare(((CARGOS_DATA[b]||{}).nombre||b));});
    var list=document.createElement('div'); list.id='sv331-comisiones-list'; list.className='sv331-mobile-list';
    list.innerHTML='<div class="sv331-com-head"><span>Cargo</span><span>% venta</span><span>Mín.</span><span>Tope</span><span></span></div>'+ids.map(function(id){
      var c=CARGOS_DATA[id]||{}, com=(typeof obtenerConfigComisionCargo==='function'?obtenerConfigComisionCargo(id):((window.CONFIG_COMISIONES||{})[id]))||{};
      var maxv=parseFloat(com.max||0)||0;
      if(maxv>=999999) maxv=0;
      return '<div class="sv331-com-row" data-cargo-id="'+esc331(id)+'"><div><div class="sv331-title" style="font-size:13px">'+esc331(c.nombre||id)+'</div></div>'+
        '<input type="number" value="'+(parseFloat(com.pct)||0)+'"><input type="number" value="'+(parseFloat(com.min)||0)+'"><input type="number" value="'+(maxv||'')+'" placeholder="Sin tope" title="Dejá vacío para no aplicar un tope"><button class="btn btn-sm btn-icon" onclick="guardarComisionMobile331(\''+esc331(id)+'\',this)"><i class="ti ti-check" style="color:var(--green)"></i></button></div>';
    }).join('')+'<div class="sv331-info-card">El mínimo y el tope son montos en pesos. Dejá el tope vacío para indicar <b>Sin tope</b>.</div>';
    card.appendChild(list);
  }
  var actPage331=1, actPageSize331=8;
  window.sv331ActPage=function(p){ actPage331=Math.max(1,p); makeActividad331(); };
  function makeActividad331(){
    var panel=document.getElementById('cfg-actividad'); if(!panel) return;
    var old=document.getElementById('sv331-actividad-list'); if(old) old.remove();
    if(!isMob331()) return;
    var card=panel.querySelector('.card'); if(!card) return;
    var filtroUsu=(document.getElementById('act-filtro-usuario')||{}).value||'';
    var filtroAcc=(document.getElementById('act-filtro-accion')||{}).value||'';
    var data=(window.LOG_ACTIVIDAD_DATA||[]).filter(function(l){return (!filtroUsu||l.usuario===filtroUsu)&&(!filtroAcc||l.accion===filtroAcc);});
    var pages=Math.max(1,Math.ceil(data.length/actPageSize331)); if(actPage331>pages) actPage331=pages;
    var slice=data.slice((actPage331-1)*actPageSize331, actPage331*actPageSize331);
    var list=document.createElement('div'); list.id='sv331-actividad-list'; list.className='sv331-activity';
    if(!slice.length){ list.innerHTML='<div class="sv331-card" style="text-align:center;color:var(--text3)">Sin actividad registrada todavía</div>'; }
    else{
      list.innerHTML=slice.map(function(l){
        var fecha=l.fecha?new Date(l.fecha).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
        var act=String(l.accion||'—'); var out=/cierre|salida|logout/i.test(act);
        return '<div class="sv331-act-card"><div class="sv331-act-ico '+(out?'out':'')+'"><i class="ti '+(out?'ti-logout':'ti-login')+'"></i></div><div><div class="sv331-act-date">'+esc331(fecha)+'</div><div class="sv331-act-user">'+esc331(l.usuario||'—')+'</div></div><div class="sv331-act-action">'+esc331(act)+'</div></div>';
      }).join('');
      var phtml='<div class="sv331-pager"><button onclick="sv331ActPage(1)">«</button><button onclick="sv331ActPage('+(actPage331-1)+')">‹</button>';
      for(var i=1;i<=pages&&i<=5;i++){ phtml+='<button class="'+(i===actPage331?'active':'')+'" onclick="sv331ActPage('+i+')">'+i+'</button>'; }
      phtml+='<button onclick="sv331ActPage('+(actPage331+1)+')">›</button><button onclick="sv331ActPage('+pages+')">»</button></div>';
      list.innerHTML += phtml;
    }
    card.appendChild(list);
  }
  function refresh331(){ addCss331(); makeCargos331(); makeComisiones331(); makeActividad331(); }
  var _showCfg331 = window.showCfgTab;
  if(typeof _showCfg331==='function'){
    window.showCfgTab=function(id,el){ var r=_showCfg331.apply(this,arguments); setTimeout(refresh331,80); return r; };
  }
  var _renderCargos331=window.renderCargosConfig;
  if(typeof _renderCargos331==='function') window.renderCargosConfig=function(){ var r=_renderCargos331.apply(this,arguments); setTimeout(makeCargos331,60); return r; };
  var _renderCom331=window.renderComisionesConfig;
  if(typeof _renderCom331==='function') window.renderComisionesConfig=function(){ var r=_renderCom331.apply(this,arguments); setTimeout(makeComisiones331,60); return r; };
  var _renderAct331=window.renderLogActividad;
  if(typeof _renderAct331==='function') window.renderLogActividad=function(){ var r=_renderAct331.apply(this,arguments); setTimeout(makeActividad331,60); return r; };
  window.addEventListener('resize', function(){ clearTimeout(window._sv331Resize); window._sv331Resize=setTimeout(refresh331,150); });
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(refresh331,350); });
  setTimeout(refresh331,700);
})();
