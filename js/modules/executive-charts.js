/* ══════════════════════════════════════════════════════════════════════════════
   v20.339 — Gráficos ejecutivos en Estadísticas y Rentabilidad
   Inserción por ancla final: no pisa impresión ni lógica existente.
   ══════════════════════════════════════════════════════════════════════════════ */
(function(){
  function arr(x){ if(Array.isArray(x)) return x; if(x&&typeof x==='object') return Object.keys(x).map(function(k){return Object.assign({fbKey:k},x[k]||{});}); return []; }
  function num(v){
    if(typeof v === 'number') return Number.isFinite(v) ? v : 0;
    var s = String(v == null ? '' : v).trim();
    if(!s) return 0;
    s = s.replace(/[^\d,.-]/g,'');
    if(s.indexOf(',') >= 0) s = s.replace(/\./g,'').replace(',','.');
    return parseFloat(s) || 0;
  }
  function money(v){ return (typeof window.money==='function') ? window.money(v) : ('$'+Math.round(num(v)).toLocaleString('es-AR')); }
  function esc(v){ return (typeof window.escapeHTML==='function') ? window.escapeHTML(v) : String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function pad(n){ return String(n).padStart(2,'0'); }
  function iso(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
  function mes(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1); }
  function parseFecha(f){
    f=String(f||'').trim();
    if(/^\d{4}-\d{2}-\d{2}/.test(f)){ var a=f.slice(0,10).split('-').map(Number); return new Date(a[0],a[1]-1,a[2]); }
    if(/^\d{2}\/\d{2}\/\d{4}/.test(f)){ var b=f.slice(0,10).split('/').map(Number); return new Date(b[2],b[1]-1,b[0]); }
    return null;
  }
  function fechaKey(f){ var d=parseFecha(f); return d?iso(d):String(f||'').slice(0,10); }
  function mesKey(f){ var d=parseFecha(f); return d?mes(d):String(f||'').slice(0,7); }
  function ventas(){ return arr(window.ventasList||window.ventasData||window.ventas||[]).filter(function(v){return v&&v.anulada!==true&&v.estado!=='anulada';}); }
  function gastos(){ return arr(window.gastosList||window.gastosData||window.gastos||[]); }
  function totalVenta(v){ return num(v&&((v.total!=null?v.total:v.totalVenta)!=null?(v.total!=null?v.total:v.totalVenta):v.monto)); }
  function gastoMonto(g){ return num(g&&((g.monto!=null?g.monto:g.total)!=null?(g.monto!=null?g.monto:g.total):g.importe)); }
  function dias7(){ var out=[]; for(var i=6;i>=0;i--){ var d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i); out.push({date:d,key:iso(d),dow:d.getDay()}); } return out; }
  function meses12(){ var out=[]; var d=new Date(); d.setDate(1); for(var i=11;i>=0;i--){ var x=new Date(d.getFullYear(),d.getMonth()-i,1); out.push({date:x,key:mes(x)}); } return out; }
  var diasLbl=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'], mesesLbl=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  function fmtCompact(v){ v=Math.abs(num(v)); if(v>=1000000) return '$'+(v/1000000).toFixed(v>=10000000?0:1)+'M'; if(v>=1000) return '$'+Math.round(v/1000)+'k'; return '$'+Math.round(v); }
  function pct(a,b){ if(!b) return '—'; var p=Math.round(((a-b)/Math.abs(b))*100); return (p>=0?'↑ ':'↓ ')+Math.abs(p)+'%'; }
  function colorPct(a,b){ return !b || a>=b ? 'var(--green)' : 'var(--red)'; }
  function drawBars(containerId, serie, labels, clickPage){
    var el=document.getElementById(containerId); if(!el) return;
    var max=Math.max.apply(null,serie.map(function(x){return Math.abs(x);})); if(!max) max=1;
    var steps=[max, max*.5, 0];
    var html='<div class="sv334-chart-wrap"><div class="sv334-axis-y"><span>'+fmtCompact(steps[0])+'</span><span>'+fmtCompact(steps[1])+'</span><span>$0</span></div><div class="sv334-bars-area">';
    serie.forEach(function(v,i){ var h=Math.max(4,Math.round(Math.abs(v)/max*118)); var cls=(v<0?'neg':(i===serie.length-1?'today':'pos')); var left=((i+.5)/serie.length*100).toFixed(3)+'%'; html+='<div class="sv334-bc" title="'+esc(labels[i])+' · '+money(v)+'"><div class="sv334-bar '+cls+'" style="height:'+h+'px"></div><span class="sv334-lbl" style="left:'+left+'">'+esc(labels[i])+'</span></div>'; });
    html+='</div></div>'; el.innerHTML=html; if(clickPage) el.onclick=function(){ if(typeof showPage==='function') showPage(clickPage,document.querySelector('[onclick*='+clickPage+']')); };
  }
  function drawLine(containerId, serie, labels){
    var el=document.getElementById(containerId); if(!el) return;
    var max=Math.max.apply(null,serie.map(Math.abs)); if(!max) max=1;
    var min=Math.min.apply(null,serie.concat([0])); var top=max, bot=Math.min(0,min); var range=top-bot || 1;
    var pts=serie.map(function(v,i){ var x=12+(i*(336/(Math.max(serie.length-1,1)))); var y=108-((v-bot)/range*96); return {x:x,y:y,v:v}; });
    var d=pts.map(function(p,i){return (i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1);}).join(' ');
    var poly='12 108 '+pts.map(function(p){return p.x.toFixed(1)+' '+p.y.toFixed(1);}).join(' ')+' 348 108';
    var safeId=String(containerId||'line').replace(/[^a-z0-9_-]/gi,'');
    var grad='sv334-grad-'+safeId, stroke='sv334-stroke-'+safeId;
    var svg='<div class="sv334-line-wrap"><div class="sv334-axis-y"><span>'+fmtCompact(top)+'</span><span>'+fmtCompact((top+bot)/2)+'</span><span>'+fmtCompact(bot)+'</span></div><div class="sv334-svg-wrap"><svg class="sv334-svg" viewBox="0 0 360 122" preserveAspectRatio="none"><defs><linearGradient id="'+grad+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(96,165,250,.34)"></stop><stop offset="72%" stop-color="rgba(96,165,250,.08)"></stop><stop offset="100%" stop-color="rgba(96,165,250,0)"></stop></linearGradient><linearGradient id="'+stroke+'" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#93c5fd"></stop><stop offset="55%" stop-color="#60a5fa"></stop><stop offset="100%" stop-color="#34d399"></stop></linearGradient></defs><line class="sv334-line-grid" x1="12" y1="34" x2="348" y2="34"></line><line class="sv334-line-grid" x1="12" y1="70" x2="348" y2="70"></line><polygon class="sv334-line-area" points="'+poly+'" fill="url(#'+grad+')"></polygon><path class="sv334-line-glow" d="'+d+'"></path><path class="sv334-line-path" d="'+d+'" stroke="url(#'+stroke+')"></path>'+pts.map(function(p,i){return '<circle class="sv334-line-dot '+(i===pts.length-1?'today':'')+'" cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="'+(i===pts.length-1?'4.7':'4')+'" stroke="url(#'+stroke+')"><title>'+money(p.v)+'</title></circle>';}).join('')+'</svg><div class="sv334-xlabels">'+labels.map(function(l,i){return (i===0||i===2||i===4||i===6||i===8||i===11)?'<span>'+esc(l)+'</span>':'<span></span>';}).join('')+'</div></div></div>';
    el.innerHTML=svg;
  }
  function cardVentas(kind){
    var isRent=kind==='rent';
    var id=isRent?'rent':'est';
    var title=isRent?'Resultado operativo':'Ventas';
    var subtitle=isRent?'Ingresos menos egresos':'Análisis comercial';
    return '<div class="sv334-analytics-card" id="sv334-'+id+'-card">'+
      '<div class="sv334-analytics-head"><div><div class="sv334-title"><i class="ti '+(isRent?'ti-trending-up':'ti-chart-line')+'"></i> '+title+'</div><div style="font-size:12px;color:var(--text3);margin-top:3px">'+subtitle+'</div></div><div class="sv334-period" id="sv334-'+id+'-periodo">Últimos 12 meses</div></div>'+
      '<div class="sv334-graph-grid"><div class="sv334-graph"><div class="sv334-graph-head"><span class="sv334-graph-title">'+(isRent?'Resultado últimos 7 días':'Últimos 7 días')+'</span><span class="sv334-graph-total" id="sv334-'+id+'-daily-total">—</span></div><div id="sv334-'+id+'-bars"></div></div>'+
      '<div class="sv334-graph"><div class="sv334-graph-head"><span class="sv334-graph-title">'+(isRent?'Evolución mensual de utilidad':'Evolución mensual')+'</span><span class="sv334-graph-total" id="sv334-'+id+'-month-total">—</span></div><div id="sv334-'+id+'-line"></div><div style="text-align:right;font-size:11px;font-weight:700;margin-top:4px" id="sv334-'+id+'-month-var">—</div></div></div>'+
      '<div class="sv334-mini" id="sv334-'+id+'-mini"></div><div class="sv334-quick" id="sv334-'+id+'-quick"></div></div>';
  }
  function ensureStats(){ var page=document.getElementById('page-estadisticas'); if(!page||document.getElementById('sv334-est-card')) return; var metrics=page.querySelector('.metrics'); if(metrics) metrics.insertAdjacentHTML('afterend',cardVentas('est')); else page.insertAdjacentHTML('afterbegin',cardVentas('est')); }
  function ensureRent(){ var page=document.getElementById('page-rentabilidad'); if(!page||document.getElementById('sv334-rent-card')) return; var metrics=page.querySelector('.metrics'); if(metrics) metrics.insertAdjacentHTML('afterend',cardVentas('rent')); else page.insertAdjacentHTML('afterbegin',cardVentas('rent')); }
  function calcSales(){
    var vs=ventas(), d7=dias7(), m12=meses12();
    var porDia={}, porMes={};
    vs.forEach(function(v){
      var total=totalVenta(v), fk=fechaKey(v.fecha), mk=mesKey(v.fecha);
      porDia[fk]=(porDia[fk]||0)+total;
      porMes[mk]=(porMes[mk]||0)+total;
    });
    var daily=d7.map(function(d){return porDia[d.key]||0;});
    var monthly=m12.map(function(m){return porMes[m.key]||0;});
    var today=daily[daily.length-1]||0, week=daily.reduce(function(s,x){return s+x;},0), month=monthly[monthly.length-1]||0, prevMonth=monthly[monthly.length-2]||0;
    var mejorDia=d7.map(function(d,i){return {lbl:diasLbl[d.dow],v:daily[i]};}).sort(function(a,b){return b.v-a.v;})[0]||{lbl:'—',v:0};
    var prom=month/(new Date().getDate()||1);
    return {daily:daily,dailyLabels:d7.map(function(d,i){return i===6?'Hoy':diasLbl[d.dow];}),monthly:monthly,monthLabels:m12.map(function(m){return mesesLbl[m.date.getMonth()];}),today:today,week:week,month:month,prevMonth:prevMonth,best:mejorDia,avg:prom};
  }
  function calcRent(){
    var vs=ventas(), gs=gastos(), d7=dias7(), m12=meses12();
    var ingDia={}, egrDia={}, ingMes={}, egrMes={};
    vs.forEach(function(v){
      var total=totalVenta(v), fk=fechaKey(v.fecha), mk=mesKey(v.fecha);
      ingDia[fk]=(ingDia[fk]||0)+total;
      ingMes[mk]=(ingMes[mk]||0)+total;
    });
    gs.forEach(function(g){
      var total=gastoMonto(g), fk=fechaKey(g.fecha), mk=mesKey(g.fecha);
      egrDia[fk]=(egrDia[fk]||0)+total;
      egrMes[mk]=(egrMes[mk]||0)+total;
    });
    var daily=d7.map(function(d){return (ingDia[d.key]||0)-(egrDia[d.key]||0);});
    var monthly=m12.map(function(m){return (ingMes[m.key]||0)-(egrMes[m.key]||0);});
    var mesActual=m12[m12.length-1].key;
    var ingresos=ingMes[mesActual]||0, egresos=egrMes[mesActual]||0, utilidad=ingresos-egresos, prev=monthly[monthly.length-2]||0;
    var best=d7.map(function(d,i){return {lbl:diasLbl[d.dow],v:daily[i]};}).sort(function(a,b){return b.v-a.v;})[0]||{lbl:'—',v:0};
    return {daily:daily,dailyLabels:d7.map(function(d,i){return i===6?'Hoy':diasLbl[d.dow];}),monthly:monthly,monthLabels:m12.map(function(m){return mesesLbl[m.date.getMonth()];}),ingresos:ingresos,egresos:egresos,utilidad:utilidad,prevMonth:prev,best:best,avg:utilidad/(new Date().getDate()||1),margen:ingresos?Math.round(utilidad/ingresos*100):0};
  }
  function renderStats334(){
    ensureStats(); var x=calcSales();
    drawBars('sv334-est-bars',x.daily,x.dailyLabels,'detalle'); drawLine('sv334-est-line',x.monthly,x.monthLabels);
    var e=function(id){return document.getElementById(id)};
    if(e('sv334-est-daily-total')) e('sv334-est-daily-total').textContent='Semana: '+money(x.week);
    if(e('sv334-est-month-total')) e('sv334-est-month-total').textContent='Mes actual: '+money(x.month);
    if(e('sv334-est-month-var')) { e('sv334-est-month-var').textContent=pct(x.month,x.prevMonth)+' vs mes anterior'; e('sv334-est-month-var').style.color=colorPct(x.month,x.prevMonth); }
    if(e('sv334-est-mini')) e('sv334-est-mini').innerHTML='<div class="sv334-mini-card"><div class="sv334-ico green"><i class="ti ti-arrow-up"></i></div><div><div class="sv334-mini-l">vs mes anterior</div><div class="sv334-mini-v green">'+pct(x.month,x.prevMonth)+'</div></div></div><div class="sv334-mini-card"><div class="sv334-ico blue"><i class="ti ti-calendar-stats"></i></div><div><div class="sv334-mini-l">Promedio diario</div><div class="sv334-mini-v">'+money(x.avg)+'</div></div></div><div class="sv334-mini-card"><div class="sv334-ico purple"><i class="ti ti-chart-pie"></i></div><div><div class="sv334-mini-l">Mejor día</div><div class="sv334-mini-v">'+esc(x.best.lbl)+' '+money(x.best.v)+'</div></div></div>';
    if(e('sv334-est-quick')) e('sv334-est-quick').innerHTML='<div class="sv334-q" onclick="kpiNavegar&&kpiNavegar(\'ventasHoy\')"><div class="sv334-q-l"><i class="ti ti-calendar-check" style="color:var(--green)"></i>Hoy</div><div class="sv334-q-v green">'+money(x.today)+'</div><div class="sv334-q-sub">vs ayer: '+money(x.daily[x.daily.length-2]||0)+'</div></div><div class="sv334-q"><div class="sv334-q-l"><i class="ti ti-calendar-week" style="color:var(--blue)"></i>Semana</div><div class="sv334-q-v blue">'+money(x.week)+'</div><div class="sv334-q-sub">últimos 7 días</div></div><div class="sv334-q"><div class="sv334-q-l"><i class="ti ti-calendar-month" style="color:var(--purple)"></i>Mes</div><div class="sv334-q-v purple">'+money(x.month)+'</div><div class="sv334-q-sub">vs mes anterior: <span style="color:'+colorPct(x.month,x.prevMonth)+'">'+pct(x.month,x.prevMonth)+'</span></div></div>';
  }
  function renderRent334(){
    ensureRent(); var x=calcRent();
    drawBars('sv334-rent-bars',x.daily,x.dailyLabels,'rentabilidad'); drawLine('sv334-rent-line',x.monthly,x.monthLabels);
    var e=function(id){return document.getElementById(id)};
    if(e('sv334-rent-daily-total')) e('sv334-rent-daily-total').textContent='Semana: '+money(x.daily.reduce(function(s,v){return s+v;},0));
    if(e('sv334-rent-month-total')) e('sv334-rent-month-total').textContent='Utilidad: '+money(x.utilidad);
    if(e('sv334-rent-month-var')) { e('sv334-rent-month-var').textContent=pct(x.utilidad,x.prevMonth)+' vs mes anterior'; e('sv334-rent-month-var').style.color=colorPct(x.utilidad,x.prevMonth); }
    if(e('sv334-rent-mini')) e('sv334-rent-mini').innerHTML='<div class="sv334-mini-card"><div class="sv334-ico '+(x.utilidad>=x.prevMonth?'green':'red')+'"><i class="ti ti-arrow-up"></i></div><div><div class="sv334-mini-l">vs mes anterior</div><div class="sv334-mini-v '+(x.utilidad>=x.prevMonth?'green':'red')+'">'+pct(x.utilidad,x.prevMonth)+'</div></div></div><div class="sv334-mini-card"><div class="sv334-ico blue"><i class="ti ti-calendar-stats"></i></div><div><div class="sv334-mini-l">Promedio diario</div><div class="sv334-mini-v">'+money(x.avg)+'</div></div></div><div class="sv334-mini-card"><div class="sv334-ico purple"><i class="ti ti-chart-pie"></i></div><div><div class="sv334-mini-l">Mejor día</div><div class="sv334-mini-v">'+esc(x.best.lbl)+' '+money(x.best.v)+'</div></div></div>';
    if(e('sv334-rent-quick')) e('sv334-rent-quick').innerHTML='<div class="sv334-q"><div class="sv334-q-l"><i class="ti ti-arrow-up-right" style="color:var(--green)"></i>Ingresos</div><div class="sv334-q-v green">'+money(x.ingresos)+'</div><div class="sv334-q-sub">ventas del mes</div></div><div class="sv334-q"><div class="sv334-q-l"><i class="ti ti-arrow-down-right" style="color:var(--red)"></i>Egresos</div><div class="sv334-q-v red">'+money(x.egresos)+'</div><div class="sv334-q-sub">gastos del mes</div></div><div class="sv334-q"><div class="sv334-q-l"><i class="ti ti-trending-up" style="color:var(--purple)"></i>Utilidad</div><div class="sv334-q-v '+(x.utilidad>=0?'purple':'red')+'">'+money(x.utilidad)+'</div><div class="sv334-q-sub">margen: '+x.margen+'%</div></div>';
  }
  window.renderStatsGraficos334=renderStats334; window.renderRentGraficos334=renderRent334;
  if(typeof window.renderEstadisticas==='function'){
    var prevEst334=window.renderEstadisticas;
    window.renderEstadisticas=function(){ var r=prevEst334.apply(this,arguments); setTimeout(renderStats334,80); return r; };
  }
  if(typeof window.calcRentabilidad==='function'){
    var prevRent334=window.calcRentabilidad;
    window.calcRentabilidad=function(){ var r=prevRent334.apply(this,arguments); setTimeout(renderRent334,80); return r; };
  }
  document.addEventListener('sisventas:page-changed',function(event){ var page=event.detail&&event.detail.page; setTimeout(function(){ if(page==='estadisticas') renderStats334(); if(page==='rentabilidad') renderRent334(); },140); });
  document.addEventListener('DOMContentLoaded',function(){ setTimeout(function(){ if(document.getElementById('page-estadisticas')&&document.getElementById('page-estadisticas').classList.contains('active')) renderStats334(); if(document.getElementById('page-rentabilidad')&&document.getElementById('page-rentabilidad').classList.contains('active')) renderRent334(); },500); });
})();
