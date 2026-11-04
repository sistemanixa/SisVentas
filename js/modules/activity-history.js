(function(){
  // Stable OFF renderer from 9779d059, never an ON error fallback.
  var renderLegacy321=(function(){
  function esc321(s){ return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function fechaMs321(f,ts){ if(ts) return Number(ts)||0; var d=null; f=String(f||''); var m; if((m=f.match(/^(\d{4})-(\d{2})-(\d{2})/))) d=new Date(+m[1],+m[2]-1,+m[3]); else if((m=f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))){ var y=+m[3]; if(y<100)y+=2000; d=new Date(y,+m[2]-1,+m[1]); } return d?d.getTime():0; }
  function fechaLbl321(ms){ if(!ms) return '—'; var d=new Date(ms); return d.toLocaleDateString('es-AR')+' '+d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}); }
  return function(){
    var cont=document.getElementById('dash-actividad-lista'); if(!cont) return;
    if(!window.tienePermiso('dashboard.actividad')){ var card=document.getElementById('dash-actividad-card'); if(card) card.style.display='none'; return; }
    var items=[];
    (window.ventasList||[]).slice(0,60).forEach(function(v){ items.push({tipo:'Venta', icon:'ti-receipt', color:'var(--green)', txt:(v.id||'')+' · '+(v.cliente||''), sub:'Total '+('$'+Math.round(parseFloat(v.total)||0).toLocaleString('es-AR')), ms:fechaMs321(v.fecha,v.ts)}); });
    (window._pagosListaActual||window._historialPagosCompleto||[]).slice(0,60).forEach(function(p){ if(p.anulado) return; items.push({tipo:'Cobro', icon:'ti-cash', color:'var(--blue)', txt:(p.venta||'')+' · '+(p.cliente||''), sub:'Pago '+('$'+Math.round(parseFloat(p.monto)||0).toLocaleString('es-AR')), ms:fechaMs321(p.fecha,p.ts)}); });
    (window.otData||[]).slice(0,60).forEach(function(o){ items.push({tipo:'OT', icon:'ti-clipboard-list', color:o.estado==='completada'?'var(--green)':'var(--amber)', txt:(o.id||'OT')+' · '+(o.cliente||''), sub:o.estado||'pendiente', ms:fechaMs321(o.fechaCierre||o.fecha,o.ts)}); });
    (window.pptoData||[]).slice(0,60).forEach(function(p){ items.push({tipo:'Presupuesto', icon:'ti-file-description', color:'var(--purple)', txt:(p.id||p.numero||'')+' · '+(p.cliente||''), sub:p.estado||'', ms:fechaMs321(p.fecha,p.ts)}); });
    items=items.filter(function(x){return x.ms;}).sort(function(a,b){return b.ms-a.ms;}).slice(0,5);
    if(!items.length){ cont.innerHTML='<div style="text-align:center;color:var(--text3);padding:14px;font-size:13px">Sin movimientos recientes</div>'; return; }
    cont.innerHTML=items.map(function(x){ return '<div style="display:flex;align-items:center;gap:10px;padding:9px 10px;background:var(--bg3);border-radius:var(--radius)"><div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--bg2);color:'+x.color+'"><i class="ti '+x.icon+'"></i></div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc321(x.tipo)+' · '+esc321(x.txt)+'</div><div style="font-size:11px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc321(x.sub)+' · '+fechaLbl321(x.ms)+'</div></div></div>'; }).join('');
  };
})();
  function esc321(s){ return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function fechaLbl321(ms){ if(!ms) return '—'; var d=new Date(ms); return d.toLocaleDateString('es-AR')+' '+d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}); }
  var domains=['ventas','pagos','ordenes_trabajo','presupuestos'],hiddenCard=null,savedDisplay='';
  function message(text,error){return '<div role="status" aria-live="polite" style="text-align:center;color:var('+(error?'--red':'--text3')+');padding:14px;font-size:13px">'+esc321(text)+'</div>';}
  function verified(packet){
    var core=window.SVDashboardActivityModelV2,a=packet&&packet.activity;
    if(!core||!packet||packet.schema!==1||!a||a.schema!==2||a.complete!==true||a.order!==core.ORDER||a.precision!=='legacy-instant'||!Array.isArray(a.items)||a.items.length>5||a.status!==(a.items.length?'ready':'empty')||!a.sources||!domains.every(function(d){return a.sources[d]&&a.sources[d].complete===true;}))return false;
    var seen=new Set();
    try{return a.items.every(function(row){
      if(!row||domains.indexOf(row.domain)<0||typeof row.number!=='string'||row.number.length>128||typeof row.client!=='string'||row.client.length>200||typeof row.status!=='string'||row.status.length>80||row.sort!==core.eventSort(row.ms,row.key)||row.id!==row.domain+'/'+row.key||seen.has(row.id))return false;
      seen.add(row.id);return ['ventas','pagos'].indexOf(row.domain)>=0?Number.isSafeInteger(row.amountCents):row.amountCents===null;
    });}catch(_){return false;}
  }
  function item(row){
    var type,icon,color,sub;
    if(row.domain==='ventas'){type='Venta';icon='ti-receipt';color='var(--green)';sub='Total $'+Math.round(row.amountCents/100).toLocaleString('es-AR');}
    else if(row.domain==='pagos'){type='Cobro';icon='ti-cash';color='var(--blue)';sub='Pago $'+Math.round(row.amountCents/100).toLocaleString('es-AR');}
    else if(row.domain==='ordenes_trabajo'){type='OT';icon='ti-clipboard-list';color=row.status==='completada'?'var(--green)':'var(--amber)';sub=row.status||'pendiente';}
    else{type='Presupuesto';icon='ti-file-description';color='var(--purple)';sub=row.status||'';}
    return '<div style="display:flex;align-items:center;gap:10px;padding:9px 10px;background:var(--bg3);border-radius:var(--radius)"><div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--bg2);color:'+color+'"><i class="ti '+icon+'"></i></div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc321(type)+' · '+esc321(row.number+' · '+row.client)+'</div><div style="font-size:11px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc321(sub)+' · '+esc321(fechaLbl321(row.ms))+'</div></div></div>';
  }
  window.dashRenderActividadReciente=function(){
    if(window.SV_DASHBOARD_READS_LOCAL!==true){renderLegacy321();return;}
    var cont=document.getElementById('dash-actividad-lista');if(!cont)return;
    var card=document.getElementById('dash-actividad-card');
    if(!window.tienePermiso('dashboard.actividad')){if(card){if(hiddenCard!==card){hiddenCard=card;savedDisplay=card.style.display;}card.style.display='none';}cont.innerHTML='';cont.setAttribute('aria-busy','false');return;}
    if(card&&hiddenCard===card){card.style.display=savedDisplay;hiddenCard=null;}
    var state;try{state=window.SVDashboardActivityHost&&window.SVDashboardActivityHost.peek();}catch(_){state={status:'error'};}
    if(state&&state.authority==='retired'){cont.innerHTML=message('Actividad no disponible para esta sesión.',false);cont.setAttribute('aria-busy','false');return;}
    var loading=!state||state.status==='idle'||state.status==='loading',error=state&&state.status==='error';
    cont.setAttribute('aria-busy',loading||state&&state.revalidating===true&&!error?'true':'false');
    // Only the host owns retained verified data. No local cache survives an authority retirement.
    if(!state||state.authority!=='current'||!verified(state.data)){
      cont.innerHTML=message(error?'No se pudo cargar la actividad.':loading?'Actividad pendiente de carga.':'No se pudo verificar la actividad.',!!error||!loading);return;
    }
    var html=state.data.activity.items.length?state.data.activity.items.map(item).join(''):message('Sin movimientos recientes',false);
    if(error)html+=message('No se pudo actualizar la actividad.',true);
    else if(loading||state.revalidating===true)html+=message('Actualizando actividad…',false);
    cont.innerHTML=html;
  };
})();
