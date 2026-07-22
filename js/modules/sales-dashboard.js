/* ══════════════════════════════════════════════════════════════════════════════
   v20.339 — Dashboard ventas: KPIs internos del contenedor
   - Agrega tarjeta compacta: vs mes anterior, promedio diario, mejor día.
   - Agrega tarjetas grandes: Hoy, Semana, Mes.
   - No modifica lógica de ventas ni cobranzas; solo lectura y presentación.
   ══════════════════════════════════════════════════════════════════════════════ */
(function(){
  function css332(){
    if(document.getElementById('sv332-dashboard-css')) return;
    var st=document.createElement('style');
    st.id='sv332-dashboard-css';
    st.textContent = `
      #dash-row2-admin > .card:first-child{position:relative;overflow:hidden!important;background:linear-gradient(145deg,var(--bg2),rgba(96,165,250,.035))!important}
      #dash-row2-admin > .card:first-child .card-head{margin-bottom:16px!important}
      .sv332-mini-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px;padding:10px 12px;border:0.5px solid var(--border);border-radius:var(--radius-lg);background:rgba(255,255,255,.025)}
      .sv332-mini{display:flex;align-items:center;gap:9px;min-width:0;padding:2px 0;border-right:0.5px solid var(--border)}
      .sv332-mini:last-child{border-right:none}
      .sv332-ico{width:32px;height:32px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;background:var(--bg3)}
      .sv332-ico.green{color:var(--green);background:var(--green-bg)}
      .sv332-ico.blue{color:var(--blue);background:var(--blue-bg)}
      .sv332-ico.purple{color:var(--purple);background:var(--purple-bg)}
      .sv332-mini-l{font-size:11px;color:var(--text2);line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .sv332-mini-v{font-size:15px;font-weight:700;color:var(--text);line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .sv332-mini-v.green{color:var(--green)}
      .sv332-mini-v.red{color:var(--red)}
      .sv332-quick{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}
      .sv332-q{border:0.5px solid var(--border);border-radius:var(--radius-lg);padding:13px 14px;min-width:0;cursor:pointer;transition:transform .12s,background .12s,border-color .12s;background:linear-gradient(145deg,var(--bg3),rgba(96,165,250,.035))}
      .sv332-q:hover{transform:translateY(-1px);border-color:var(--border2);background:var(--bg3)}
      .sv332-q.green{background:linear-gradient(145deg,rgba(74,222,128,.10),var(--bg3))}
      .sv332-q.blue{background:linear-gradient(145deg,rgba(96,165,250,.11),var(--bg3))}
      .sv332-q.purple{background:linear-gradient(145deg,rgba(167,139,250,.12),var(--bg3))}
      .sv332-q-head{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--text2)}
      .sv332-q-head .sv332-ico{width:28px;height:28px;border-radius:10px;font-size:15px}
      .sv332-q-v{font-size:22px;font-weight:800;letter-spacing:-.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.1}
      .sv332-q.green .sv332-q-v{color:var(--green)}
      .sv332-q.blue .sv332-q-v{color:var(--blue)}
      .sv332-q.purple .sv332-q-v{color:var(--purple)}
      .sv332-q-sub{font-size:11px;color:var(--text2);margin-top:7px;line-height:1.25;min-height:15px}
      .sv332-q-sub .up{color:var(--green);font-weight:700}.sv332-q-sub .down{color:var(--red);font-weight:700}
      @media (min-width:1200px){
        #dash-row2-admin .dash-ventas-split{gap:24px!important}
        .sv332-mini-kpis{margin-top:14px!important}
        .sv332-q-v{font-size:20px}
      }
      @media (min-width:701px) and (max-width:1199px){
        .sv332-mini-kpis{grid-template-columns:repeat(3,1fr)}
        .sv332-quick{grid-template-columns:repeat(3,1fr)}
      }
      @media (max-width:700px){
        .sv332-mini-kpis{grid-template-columns:1fr;gap:8px;padding:10px;margin-top:12px}
        .sv332-mini{border-right:none;border-bottom:0.5px solid var(--border);padding:6px 0}.sv332-mini:last-child{border-bottom:none}
        .sv332-quick{grid-template-columns:1fr;gap:8px}
        .sv332-q{padding:12px}.sv332-q-v{font-size:22px}
      }
    `;
    document.head.appendChild(st);
  }
  function parseDate332(f){
    f=String(f||'').trim(); var m;
    if((m=f.match(/^(\d{4})-(\d{2})-(\d{2})/))) return new Date(+m[1],+m[2]-1,+m[3]);
    if((m=f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))){ var y=+m[3]; if(y<100)y+=2000; return new Date(y,+m[2]-1,+m[1]); }
    return null;
  }
  function money332(n){
    n=Number(n)||0;
    if(typeof window.money==='function') return window.money(n);
    return '$'+Math.round(n).toLocaleString('es-AR');
  }
  function compact332(n){
    n=Number(n)||0;
    if(Math.abs(n)>=1000000) return '$'+(n/1000000).toFixed(n>=10000000?0:2).replace('.',',')+'M';
    if(Math.abs(n)>=1000) return '$'+Math.round(n/1000).toLocaleString('es-AR')+'k';
    return money332(n);
  }
  function pct332(a,b){ return b>0 ? ((a-b)/b*100) : (a>0?100:0); }
  function pctHtml332(p){ var cls=p>=0?'up':'down'; return '<span class="'+cls+'">'+(p>=0?'↑ ':'↓ ')+Math.abs(p).toFixed(0)+'%</span>'; }
  function startOfDay332(d){ return new Date(d.getFullYear(),d.getMonth(),d.getDate()); }
  function sameDay332(a,b){ return a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }
  function sameMonth332(a,y,m){ return a&&a.getFullYear()===y&&a.getMonth()===m; }
  function ensure332(){
    css332();
    var card=document.querySelector('#dash-row2-admin > .card:first-child'); if(!card) return null;
    var split=card.querySelector('.dash-ventas-split'); if(!split) return null;
    if(!document.getElementById('dash-ventas-mini-332')){
      split.insertAdjacentHTML('afterend',
        '<div id="dash-ventas-mini-332" class="sv332-mini-kpis">'+
          '<div class="sv332-mini"><div class="sv332-ico green"><i class="ti ti-arrow-up"></i></div><div><div class="sv332-mini-l">vs mes anterior</div><div class="sv332-mini-v green" id="dash-mini-vs-332">—</div></div></div>'+
          '<div class="sv332-mini"><div class="sv332-ico blue"><i class="ti ti-calendar-stats"></i></div><div><div class="sv332-mini-l">Promedio diario</div><div class="sv332-mini-v" id="dash-mini-prom-332">—</div></div></div>'+
          '<div class="sv332-mini"><div class="sv332-ico purple"><i class="ti ti-chart-pie-filled"></i></div><div><div class="sv332-mini-l">Mejor día</div><div class="sv332-mini-v" id="dash-mini-best-332">—</div></div></div>'+
        '</div>'+
        '<div id="dash-ventas-quick-332" class="sv332-quick">'+
          '<div class="sv332-q green" onclick="window.dashFiltrarVentasPorDia&&dashFiltrarVentasPorDia(new Date().toISOString().slice(0,10))"><div class="sv332-q-head"><span class="sv332-ico green"><i class="ti ti-calendar-event"></i></span><span>Hoy</span></div><div class="sv332-q-v" id="dash-q-hoy-332">—</div><div class="sv332-q-sub" id="dash-q-hoy-sub-332">—</div></div>'+
          '<div class="sv332-q blue" onclick="showPage&&showPage(\'detalle\',document.querySelector(\'[onclick*=detalle]\'))"><div class="sv332-q-head"><span class="sv332-ico blue"><i class="ti ti-calendar-week"></i></span><span>Semana</span></div><div class="sv332-q-v" id="dash-q-semana-332">—</div><div class="sv332-q-sub" id="dash-q-semana-sub-332">—</div></div>'+
          '<div class="sv332-q purple" onclick="window.dashFiltrarVentasPorMes&&dashFiltrarVentasPorMes(new Date().toISOString().slice(0,7))"><div class="sv332-q-head"><span class="sv332-ico purple"><i class="ti ti-calendar-month"></i></span><span>Mes</span></div><div class="sv332-q-v" id="dash-q-mes-332">—</div><div class="sv332-q-sub" id="dash-q-mes-sub-332">—</div></div>'+
        '</div>');
    }
    return true;
  }
  function set332(id,html){ var el=document.getElementById(id); if(el) el.innerHTML=html; }
  window.sv332UpdateDashSalesKpis=function(ventas){
    if(!ensure332()) return;
    ventas = Array.isArray(ventas) ? ventas : (typeof window.obtenerVentasActivasSisVentas === 'function' ? window.obtenerVentasActivasSisVentas() : (window.ventasList || window.ventasData || []));
    ventas = ventas.filter(function(v){ return typeof window.ventaValidaParaMetricas !== 'function' || window.ventaValidaParaMetricas(v); });
    var now=new Date(), today=startOfDay332(now), yesterday=new Date(today); yesterday.setDate(yesterday.getDate()-1);
    var weekStart=new Date(today); weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));
    var prevWeekStart=new Date(weekStart); prevWeekStart.setDate(prevWeekStart.getDate()-7);
    var prevWeekEnd=new Date(weekStart); prevWeekEnd.setDate(prevWeekEnd.getDate()-1);
    var y=now.getFullYear(), m=now.getMonth(), py=m===0?y-1:y, pm=m===0?11:m-1;
    var dias=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    var todayTot=0,yestTot=0,weekTot=0,prevWeekTot=0,monthTot=0,prevMonthTot=0;
    var byDay={};
    (ventas||[]).forEach(function(v){
      var d=parseDate332(v&&v.fecha); if(!d) return; var t=parseFloat(v.total)||0; var sd=startOfDay332(d);
      if(sameDay332(sd,today)) todayTot+=t;
      if(sameDay332(sd,yesterday)) yestTot+=t;
      if(sd>=weekStart && sd<=today) weekTot+=t;
      if(sd>=prevWeekStart && sd<=prevWeekEnd) prevWeekTot+=t;
      if(sameMonth332(sd,y,m)) monthTot+=t;
      if(sameMonth332(sd,py,pm)) prevMonthTot+=t;
      if(sd>=weekStart && sd<=today){ var k=sd.toISOString().slice(0,10); byDay[k]=(byDay[k]||0)+t; }
    });
    var bestDate=null,bestVal=-1; Object.keys(byDay).forEach(function(k){ if(byDay[k]>bestVal){bestVal=byDay[k]; bestDate=k;} });
    var bestLbl='—'; if(bestDate){ var bd=parseDate332(bestDate); bestLbl=dias[bd.getDay()]+' '+compact332(bestVal); }
    var elapsed=Math.max(1, today.getDate());
    var prom=monthTot/elapsed;
    var mpct=pct332(monthTot,prevMonthTot), wpct=pct332(weekTot,prevWeekTot), hpct=pct332(todayTot,yestTot);
    set332('dash-mini-vs-332', pctHtml332(mpct));
    set332('dash-mini-prom-332', money332(prom));
    set332('dash-mini-best-332', bestLbl);
    set332('dash-q-hoy-332', money332(todayTot));
    set332('dash-q-semana-332', money332(weekTot));
    set332('dash-q-mes-332', money332(monthTot));
    set332('dash-q-hoy-sub-332', 'vs ayer: '+money332(yestTot)+' '+(yestTot>0?pctHtml332(hpct):'(—)'));
    set332('dash-q-semana-sub-332', 'vs semana anterior '+pctHtml332(wpct));
    set332('dash-q-mes-sub-332', 'vs mes anterior '+pctHtml332(mpct));
    // Compatibilidad con IDs de versiones anteriores, por si algún bloque viejo quedó activo.
    set332('dash-q-hoy-326', money332(todayTot));
    set332('dash-q-semana-326', money332(weekTot));
    set332('dash-q-mes-326', money332(monthTot));
  };
  document.addEventListener('sisventas:dashboard-evolution-rendered',function(event){
    var ventas=event.detail&&event.detail.ventas||[];
    setTimeout(function(){ window.sv332UpdateDashSalesKpis(ventas); },20);
  });
  var _renderDash332=window.renderDashboard;
  if(typeof _renderDash332==='function'){
    window.renderDashboard=function(){ var r=_renderDash332.apply(this,arguments); setTimeout(function(){ window.sv332UpdateDashSalesKpis(typeof window.obtenerVentasActivasSisVentas === 'function' ? window.obtenerVentasActivasSisVentas() : (window.ventasList||window.ventasData||[])); },90); return r; };
  }
  document.addEventListener('DOMContentLoaded',function(){ setTimeout(function(){ window.sv332UpdateDashSalesKpis(); },800); });
  setTimeout(function(){ window.sv332UpdateDashSalesKpis(); },1200);
})();
