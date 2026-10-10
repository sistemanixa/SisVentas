/* Gráfico del histórico existente: sin consultas ni temporizadores propios. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SisVentasDolarMensual=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var fields=['oficial','blue','mep'],labels=['Oficial','Blue','MEP'],colors=['#6ee7a0','#60a5fa','#c4a1ff'];
  function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function date(value){return new Date(Number(value.slice(0,4)),Number(value.slice(5,7))-1,Number(value.slice(8,10)),12);}
  function period(anchor,mode){
    var start=date(anchor),end=date(anchor),count;
    if(mode==='year'){start.setMonth(0,1);end.setMonth(11,31);count=12;}
    else if(mode==='month'){start.setDate(1);end=new Date(start.getFullYear(),start.getMonth()+1,0,12);count=end.getDate();}
    else if(mode==='week'){start.setDate(start.getDate()-(start.getDay()+6)%7);end=new Date(start);end.setDate(end.getDate()+6);count=7;}
    else count=24;
    return {start:iso(start),end:iso(end),count:count};
  }
  function shift(anchor,mode,delta){
    var d=date(anchor);
    if(mode==='year')d=new Date(d.getFullYear()+delta,0,1,12);
    else if(mode==='month')d=new Date(d.getFullYear(),d.getMonth()+delta,1,12);
    else d.setDate(d.getDate()+delta*(mode==='week'?7:1));
    return iso(d);
  }
  function series(rows,anchor,mode){
    var range=period(anchor,mode),buckets=new Map();
    (rows||[]).forEach(function(row){
      var key=String(row.fecha||'');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(key)||iso(date(key))!==key||key<range.start||key>range.end)return;
      var hour=Number(String(row.hora||'0').split(':')[0]);if(!Number.isInteger(hour)||hour<0||hour>23)return;
      var position=mode==='year'?Number(key.slice(5,7))-1:mode==='day'?hour:mode==='week'?Math.round((date(key)-date(range.start))/86400000):Number(key.slice(8))-1;
      var entry=buckets.get(position)||{position:position,date:key},order=key+'T'+String(hour).padStart(2,'0')+':'+String(row.hora||'').split(':').slice(1).join(':');
      fields.forEach(function(field){var value=Number(row[field]);if(Number.isFinite(value)&&value>0&&(!entry[field]||order>entry[field].order||(order===entry[field].order&&Number(row.ts||0)>=entry[field].ts)))entry[field]={value:value,order:order,ts:Number(row.ts)||0,date:key};});
      buckets.set(position,entry);
    });
    return Array.from(buckets.values()).sort(function(a,b){return a.position-b.position;});
  }
  var data=[],selected='',mode='month',enabled={oficial:true,blue:false,mep:false},revision=0,drawn='',pending=false;
  function format(n){return '$'+Number(n).toLocaleString('es-AR',{maximumFractionDigits:2});}
  function nearest(points,position){
    return points.reduce(function(best,p){return !best||Math.abs(p.position-position)<Math.abs(best.position-position)?p:best;},null);
  }
  function installCursor(plot,points,x,y,mode){
    var svg=plot.querySelector('svg'),ns='http://www.w3.org/2000/svg';
    var active=points.filter(function(p){return fields.some(function(k){return enabled[k]&&p[k];});});
    if(!svg||!active.length)return;
    plot.style.position='relative';
    svg.setAttribute('tabindex','0');
    svg.setAttribute('aria-label',svg.getAttribute('aria-label')+'. Usá las flechas izquierda y derecha para recorrer las cotizaciones.');
    svg.style.touchAction='pan-y';
    var group=document.createElementNS(ns,'g');group.style.display='none';group.setAttribute('pointer-events','none');svg.append(group);
    var tip=document.createElement('div');tip.setAttribute('data-chart-tooltip','');tip.setAttribute('role','status');
    tip.style.cssText='display:none;position:absolute;top:8px;max-width:240px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg2,#101b2e);color:var(--text);font-size:12px;pointer-events:none;z-index:2;white-space:pre-line';plot.append(tip);
    var current=-1;
    function show(p,pointer){
      current=active.indexOf(p);group.replaceChildren();group.style.display='';
      var line=document.createElementNS(ns,'line');line.setAttribute('x1',x(p.position));line.setAttribute('x2',x(p.position));line.setAttribute('y1','14');line.setAttribute('y2','134');line.setAttribute('stroke','var(--text3)');line.setAttribute('stroke-dasharray','4 3');group.append(line);
      var text=mode==='year'?new Date(2026,p.position,1).toLocaleDateString('es-AR',{month:'long'}):p.date.split('-').reverse().join('/');
      if(mode==='day')text+=' '+String(p.position).padStart(2,'0')+':00';
      fields.forEach(function(k,i){if(!enabled[k]||!p[k])return;var dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',x(p.position));dot.setAttribute('cy',y(p[k].value));dot.setAttribute('r','5');dot.setAttribute('fill',colors[i]);dot.setAttribute('stroke','var(--bg)');group.append(dot);text+='\n'+labels[i]+': '+format(p[k].value)+(mode==='year'?' · '+p[k].date.split('-').reverse().join('/'):'');});
      tip.textContent=text;tip.style.display='block';tip.style.right='auto';
      var bounds=plot.getBoundingClientRect(),px,py;
      if(pointer){px=pointer.clientX-bounds.left;py=pointer.clientY-bounds.top;}
      else {var point=svg.createSVGPoint();point.x=x(p.position);var key=fields.find(function(k){return enabled[k]&&p[k];});point.y=y(p[key].value);var screen=point.matrixTransform(svg.getScreenCTM());px=screen.x-bounds.left;py=screen.y-bounds.top;}
      var w=tip.offsetWidth,h=tip.offsetHeight,left=px+12,top=py+12;
      if(left+w>bounds.width-4)left=px-w-12;
      if(top+h>bounds.height-4)top=py-h-12;
      tip.style.left=Math.max(4,Math.min(left,bounds.width-w-4))+'px';
      tip.style.top=Math.max(4,Math.min(top,bounds.height-h-4))+'px';
    }
    function hide(){group.style.display='none';tip.style.display='none';}
    svg.onpointermove=function(e){var matrix=svg.getScreenCTM();if(!matrix)return;var cursor=svg.createSVGPoint();cursor.x=e.clientX;cursor.y=e.clientY;var local=cursor.matrixTransform(matrix.inverse());show(nearest(active,(local.x-x(0))/(x(1)-x(0))),e);};
    svg.onpointerleave=hide;svg.onblur=hide;
    svg.onfocus=function(){show(active[Math.max(0,current)]);};
    svg.onkeydown=function(e){if(e.key==='Escape'){hide();return;}if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();show(active[Math.max(0,Math.min(active.length-1,current+(e.key==='ArrowLeft'?-1:1)))]);};
  }
  function schedule(){if(pending)return;pending=true;requestAnimationFrame(function(){pending=false;render();});}
  function update(rows){data=rows||[];revision++;schedule();}
  function render(){
    var host=document.getElementById('cfg-dolar-historico-card');
    if(document.hidden||!host||!host.getClientRects().length)return;
    if(!selected)selected=iso(new Date());
    var box=document.getElementById('dh-month-chart');
    if(!box){
      drawn='';box=document.createElement('section');box.id='dh-month-chart';box.style.cssText='padding-bottom:18px;margin-bottom:18px;border-bottom:1px solid var(--border)';
      box.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><strong style="font-size:13px">Evolución del dólar</strong><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><select aria-label="Período del gráfico" class="search-input" style="width:auto;min-height:40px"><option value="day">Día</option><option value="week">Semana</option><option value="month" selected>Mes</option><option value="year">Año</option></select><button type="button" class="btn btn-sm" data-period-prev aria-label="Período anterior" style="min-width:40px;min-height:40px">←</button><strong data-period-label aria-live="polite" style="min-width:135px;text-align:center;font-size:13px"></strong><button type="button" class="btn btn-sm" data-period-next aria-label="Período siguiente" style="min-width:40px;min-height:40px">→</button></div></div><div data-period-plot></div><div data-period-legend style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px"></div><p data-period-note style="font-size:11px;color:var(--text3);margin:8px 0 0"></p>';
      host.prepend(box);
      box.querySelector('select').value=mode;
      box.querySelector('select').onchange=function(e){mode=e.target.value;render();};
      box.querySelector('[data-period-prev]').onclick=function(){selected=shift(selected,mode,-1);render();};
      box.querySelector('[data-period-next]').onclick=function(){if(period(selected,mode).start<period(iso(new Date()),mode).start){selected=shift(selected,mode,1);render();}};
      var legend=box.querySelector('[data-period-legend]');
      fields.forEach(function(key,index){
        var label=document.createElement('label');label.style.cssText='display:flex;align-items:center;gap:6px;min-height:36px;cursor:pointer;color:'+colors[index];
        var input=document.createElement('input');input.type='checkbox';input.checked=enabled[key];input.setAttribute('aria-label',labels[index]);input.style.cssText='width:16px;height:16px;accent-color:'+colors[index];input.onchange=function(){enabled[key]=input.checked;render();};
        var value=document.createElement('strong');value.dataset.rateValue=key;
        label.append(input,document.createTextNode(labels[index]+' '),value);legend.append(label);
      });
    }
    var signature=selected+'|'+mode+'|'+revision+'|'+fields.map(function(k){return enabled[k];}).join();if(drawn===signature)return;drawn=signature;
    var range=period(selected,mode),d=date(selected),label;
    if(mode==='year')label=String(d.getFullYear());
    else if(mode==='month')label=d.toLocaleDateString('es-AR',{month:'long',year:'numeric'});
    else if(mode==='week')label=date(range.start).toLocaleDateString('es-AR',{day:'numeric',month:'short'})+' – '+date(range.end).toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'});
    else label=d.toLocaleDateString('es-AR',{day:'numeric',month:'long',year:'numeric'});
    box.querySelector('[data-period-label]').textContent=label;
    box.querySelector('[data-period-next]').disabled=range.start>=period(iso(new Date()),mode).start;
    box.querySelector('[data-period-note]').textContent='ARS por USD · Última cotización registrada de cada '+(mode==='year'?'mes':mode==='day'?'hora':'día')+'. Sin registros no se agregan valores.';
    var points=series(data,selected,mode),values=[];
    fields.forEach(function(key){var available=points.filter(function(p){return p[key];});box.querySelector('[data-rate-value="'+key+'"]').textContent=available.length?format(available[available.length-1][key].value):'—';if(enabled[key])available.forEach(function(p){values.push(p[key].value);});});
    var plot=box.querySelector('[data-period-plot]');
    if(!values.length){plot.innerHTML='<p style="text-align:center;padding:38px 12px;color:var(--text3)">'+(fields.some(function(k){return enabled[k];})?'Sin cotizaciones registradas para la selección en este período.':'Activá al menos una cotización para ver el gráfico.')+'</p>';return;}
    var low=Math.min.apply(null,values),high=Math.max.apply(null,values),pad=Math.max((high-low)*0.15,1);low=Math.max(0,low-pad);high+=pad;
    function x(position){return 74+position/(range.count-1)*620;}
    function y(value){return 18+(high-value)/(high-low)*110;}
    var svg='<svg viewBox="0 0 720 160" role="img" aria-label="Evolución del dólar: '+label+'" style="display:block;width:100%;max-height:190px;margin:8px 0"><title>Cotizaciones seleccionadas. '+label+'</title>';
    [low,(low+high)/2,high].forEach(function(value){svg+='<line x1="74" x2="694" y1="'+y(value)+'" y2="'+y(value)+'" stroke="var(--border)"/><text x="67" y="'+(y(value)+4)+'" text-anchor="end" fill="var(--text3)" font-size="11">'+format(value)+'</text>';});
    var ticks=mode==='day'?[0,6,12,18,23]:mode==='week'?[0,1,2,3,4,5,6]:mode==='year'?[0,2,4,6,8,11]:[0,9,19,range.count-1];
    ticks.forEach(function(position){var text;if(mode==='day')text=String(position).padStart(2,'0')+':00';else if(mode==='year')text=new Date(2026,position,1).toLocaleDateString('es-AR',{month:'short'});else if(mode==='week'){var dt=date(range.start);dt.setDate(dt.getDate()+position);text=dt.toLocaleDateString('es-AR',{day:'numeric',month:'numeric'});}else text=position+1;svg+='<text x="'+x(position)+'" y="151" text-anchor="middle" fill="var(--text3)" font-size="11">'+text+'</text>';});
    fields.forEach(function(key,index){
      if(!enabled[key])return;var active=points.filter(function(p){return p[key];});if(!active.length)return;
      svg+='<polyline data-rate="'+key+'" fill="none" stroke="'+colors[index]+'" stroke-width="2" points="'+active.map(function(p){return x(p.position)+','+y(p[key].value);}).join(' ')+'"/>';
      active.forEach(function(p){svg+='<circle cx="'+x(p.position)+'" cy="'+y(p[key].value)+'" r="3" fill="'+colors[index]+'"><title>'+p[key].date+(mode==='day'?' '+String(p.position).padStart(2,'0')+':00':'')+' · '+labels[index]+': '+format(p[key].value)+'</title></circle>';});
    });
    plot.innerHTML=svg+'</svg>';
    installCursor(plot,points,x,y,mode);
  }
  if(typeof document!=='undefined'){
    document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('#cfg-tabs-main'))schedule();});
    document.addEventListener('sisventas:page-changed',schedule);
    document.addEventListener('visibilitychange',schedule);
  }
  return {series:series,period:period,shift:shift,nearest:nearest,update:update};
});
