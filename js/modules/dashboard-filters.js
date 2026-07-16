(function(){
  function parseVentaDate320(f){
    f=String(f||'').trim();
    var m;
    if((m=f.match(/^(\d{4})-(\d{2})-(\d{2})/))) return new Date(+m[1],+m[2]-1,+m[3]);
    if((m=f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))){ var y=+m[3]; if(y<100)y+=2000; return new Date(y,+m[2]-1,+m[1]); }
    return null;
  }
  function money320(n){ return '$' + Math.round(Number(n)||0).toLocaleString('es-AR'); }
  window.dashFiltrarVentasPorDia = function(iso){
    try{
      showPage('detalle', document.querySelector('[onclick*=detalle]'));
      setTimeout(function(){
        var d=parseVentaDate320(iso); if(!d) return;
        var ym=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
        var mes=document.getElementById('ventas-mes'); if(mes){ mes.value=ym; if(typeof filtrarVentasMes==='function') filtrarVentasMes(ym); }
        var busc=document.getElementById('ventas-search'); if(busc){ busc.value=''; }
      },80);
    }catch(e){}
  };
  window.dashFiltrarVentasPorMes = function(ym){
    try{
      showPage('detalle', document.querySelector('[onclick*=detalle]'));
      setTimeout(function(){ var mes=document.getElementById('ventas-mes'); if(mes){ mes.value=ym; if(typeof filtrarVentasMes==='function') filtrarVentasMes(ym); } },80);
    }catch(e){}
  };
  window.dashRenderEvolucionMensual = function(ventas){
    var svg=document.getElementById('dash-month-svg'); if(!svg) return;
    var now=new Date(), meses=[], labels=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    for(var i=11;i>=0;i--){ var d=new Date(now.getFullYear(), now.getMonth()-i, 1); meses.push({y:d.getFullYear(),m:d.getMonth(),ym:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),label:labels[d.getMonth()]}); }
    meses.forEach(function(x){ x.total=0; x.cant=0; });
    (ventas||[]).forEach(function(v){ var d=parseVentaDate320(v.fecha); if(!d) return; var it=meses.find(function(x){return x.y===d.getFullYear()&&x.m===d.getMonth();}); if(it){ it.total += parseFloat(v.total)||0; it.cant++; } });
    var max=Math.max.apply(null, meses.map(function(x){return x.total;})); if(!isFinite(max)||max<=0) max=1;
    var w=360,h=120,pad=12,step=(w-pad*2)/(meses.length-1);
    var pts=meses.map(function(x,i){ var px=pad+i*step; var py=h-pad-(x.total/max)*(h-pad*2); return {x:px,y:py,item:x}; });
    var path=pts.map(function(p,i){return (i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1);}).join(' ');
    var area=path+' L '+(w-pad)+' '+(h-pad)+' L '+pad+' '+(h-pad)+' Z';
    svg.innerHTML='<path d="'+area+'" fill="rgba(96,165,250,.10)"></path><path d="'+path+'" fill="none" stroke="var(--blue)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>'+pts.map(function(p){return '<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="4" fill="var(--bg2)" stroke="var(--blue)" stroke-width="2"><title>'+p.item.label+' '+p.item.y+': '+money320(p.item.total)+' · '+p.item.cant+' ventas</title></circle>';}).join('');
    var actual=meses[meses.length-1], ant=meses[meses.length-2];
    var totalEl=document.getElementById('dash-month-total'); if(totalEl) totalEl.textContent='Mes actual: '+money320(actual.total);
    var varEl=document.getElementById('dash-month-var');
    if(varEl){ var pct=ant&&ant.total>0?((actual.total-ant.total)/ant.total*100):0; varEl.textContent=(pct>=0?'↑ ':'↓ ')+Math.abs(pct).toFixed(0)+'% vs '+(ant?ant.label:'mes ant.'); varEl.style.color=pct>=0?'var(--green)':'var(--red)'; }
    var lab=document.getElementById('dash-month-labels');
    if(lab){
      var visibles = meses.filter(function(_,i){ return i%2===0 || i===meses.length-1; }).slice(-6);
      lab.style.display='grid';
      lab.style.gridTemplateColumns='repeat('+visibles.length+', minmax(0,1fr))';
      lab.style.width='100%';
      lab.innerHTML=visibles.map(function(x){ return '<span>'+x.label+'</span>'; }).join('');
    }
    try{
      var startDay=new Date(now.getFullYear(),now.getMonth(),now.getDate());
      var startWeek=new Date(startDay); startWeek.setDate(startWeek.getDate()-((startWeek.getDay()+6)%7));
      var hoyTot=0, semTot=0;
      (ventas||[]).forEach(function(v){ var d=parseVentaDate320(v.fecha); if(!d) return; var t=parseFloat(v.total)||0; if(d>=startDay) hoyTot+=t; if(d>=startWeek) semTot+=t; });
      var qh=document.getElementById('dash-q-hoy-326'); if(qh) qh.textContent=money320(hoyTot);
      var qs=document.getElementById('dash-q-semana-326'); if(qs) qs.textContent=money320(semTot);
      var qm=document.getElementById('dash-q-mes-326'); if(qm) qm.textContent=money320(actual.total);
    }catch(e){}
    svg.onclick=function(){ dashFiltrarVentasPorMes(actual.ym); };
    document.dispatchEvent(new CustomEvent('sisventas:dashboard-evolution-rendered',{detail:{ventas:ventas||[]}}));
  };
})();
