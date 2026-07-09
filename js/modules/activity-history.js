(function(){
  function esc321(s){ return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function fechaMs321(f,ts){ if(ts) return Number(ts)||0; var d=null; f=String(f||''); var m; if((m=f.match(/^(\d{4})-(\d{2})-(\d{2})/))) d=new Date(+m[1],+m[2]-1,+m[3]); else if((m=f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))){ var y=+m[3]; if(y<100)y+=2000; d=new Date(y,+m[2]-1,+m[1]); } return d?d.getTime():0; }
  function fechaLbl321(ms){ if(!ms) return '—'; var d=new Date(ms); return d.toLocaleDateString('es-AR')+' '+d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}); }
  window.dashRenderActividadReciente=function(){
    var cont=document.getElementById('dash-actividad-lista'); if(!cont) return;
    if(String(window.currentRole||'').toLowerCase()!=='admin'){ var card=document.getElementById('dash-actividad-card'); if(card) card.style.display='none'; return; }
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
