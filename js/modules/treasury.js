
(function(){
  window.tesVerComprobante=function(gastoKey,idx){
    if(typeof abrirComprobantePago==='function') abrirComprobantePago(gastoKey,idx);
  };
  function tesArray(value){
    if(Array.isArray(value)) return value;
    return value&&typeof value==='object'?Object.values(value):[];
  }
  function tesPagosArray(obj){
    var pagos=obj&&obj.pagos?obj.pagos:{};
    if(Array.isArray(pagos)) return pagos.map(function(item,index){return Object.assign({_idx:index},item||{});});
    return Object.keys(pagos||{}).map(function(key){return Object.assign({_key:key},pagos[key]||{});});
  }
  window._tesoreriaPagos=function(){
    var out=[];
    var gastoKeys={};
    tesArray(window.gastosData).forEach(function(gasto){
      if(gasto&&gasto.fbKey) gastoKeys[gasto.fbKey]=true;
      tesPagosArray(gasto).forEach(function(pago,index){
        out.push(Object.assign({},pago,{origen:'gasto',gastoKey:gasto.fbKey,gastoDesc:gasto.descripcion||gasto.desc||'',categoria:gasto.categoria||'',montoGasto:gasto.monto||0,loteId:pago.loteId||pago.pagoId||pago.pgId||'',_idx:index,empleadoId:gasto.empleadoId||'',empleadoNombre:gasto.empleadoNombre||''}));
      });
    });
    tesArray(window.movsEmpData).forEach(function(movimiento){
      if(movimiento._fuente==='gastos') return;
      // Si el movimiento ya originó un gasto, Tesorería debe leer una sola fuente.
      if(movimiento.gastoFbKey&&gastoKeys[movimiento.gastoFbKey]) return;
      tesPagosArray(movimiento).forEach(function(pago,index){
        out.push(Object.assign({},pago,{origen:'ctaemp',gastoKey:movimiento.gastoFbKey||movimiento.fbKey,gastoDesc:movimiento.descripcion||movimiento.desc||movimiento.detalle||movimiento.tipo||'',categoria:movimiento.tipo||'',montoGasto:movimiento.monto||0,loteId:pago.loteId||pago.pagoId||pago.pgId||'',_idx:index,empleadoId:window.ctaEmpActual||'',empleadoNombre:''}));
      });
    });
    var seen={};
    return out.filter(function(pago){var key=[pago.origen,pago.gastoKey,pago._idx,pago._key,pago.fecha,pago.monto,pago.loteId].join('|');if(seen[key])return false;seen[key]=true;return true;}).sort(function(a,b){return String(b.fecha||'').localeCompare(String(a.fecha||''))||((b.ts||0)-(a.ts||0));});
  };
  function _tesNorm(v){
    return String(v||'').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/\s+/g,' ').trim();
  }
  function _tesSetMetric(id, value, sub){
    var el=document.getElementById(id); if(!el) return;
    el.textContent=value;
    var box=el.closest('.metric');
    var s=box ? box.querySelector('.m-sub') : null;
    if(s && sub!==undefined) s.textContent=sub;
  }
  function _tesPeriodoFecha(per){
    var now=new Date();
    var ym=now.toISOString().slice(0,7);
    var prev=new Date(now.getFullYear(),now.getMonth()-1,1).toISOString().slice(0,7);
    return { ym:ym, prev:prev };
  }
  function _tesDentroPeriodo(fecha, per){
    fecha=String(fecha||'');
    var p=_tesPeriodoFecha(per);
    if(per==='mes') return fecha.slice(0,7)===p.ym;
    if(per==='anterior') return fecha.slice(0,7)===p.prev;
    return true;
  }
  var _renderTesoreriaPrev = window.renderTesoreria;
  window.renderTesoreria = function(){
    var el=document.getElementById('tes-lista'); if(!el){ if(typeof _renderTesoreriaPrev==='function') return _renderTesoreriaPrev(); return; }
    var q=(typeof normTxt==='function'?normTxt((document.getElementById('tes-buscar')||{}).value||''):_tesNorm((document.getElementById('tes-buscar')||{}).value||''));
    var medio=(document.getElementById('tes-medio')||{}).value||'';
    var per=(document.getElementById('tes-periodo')||{}).value||'mes';
    var base=(typeof window._tesoreriaPagos==='function'?window._tesoreriaPagos():[]);
    var pagosPeriodo=base.filter(function(p){ return _tesDentroPeriodo(p.fecha, per); });
    var total=pagosPeriodo.reduce(function(s,p){return s+(parseFloat(p.monto)||0);},0);
    var transferArr=pagosPeriodo.filter(function(p){ var t=window._tesTipoMedio(p); return t==='transferencia' || t==='qr'; });
    var efectivoArr=pagosPeriodo.filter(function(p){ return window._tesTipoMedio(p)==='efectivo'; });
    var compArr=pagosPeriodo.filter(function(p){ return p.comprobante && (p.comprobante.data || p.comprobante.url || p.comprobante.nombre); });
    _tesSetMetric('tes-met-mes', (typeof money==='function'?money(total):('$'+total)), pagosPeriodo.length + (pagosPeriodo.length===1?' pago registrado':' pagos registrados'));
    _tesSetMetric('tes-met-transfer', (typeof money==='function'?money(transferArr.reduce(function(s,p){return s+(parseFloat(p.monto)||0);},0)):'$0'), transferArr.length + (transferArr.length===1?' pago':' pagos'));
    _tesSetMetric('tes-met-efectivo', (typeof money==='function'?money(efectivoArr.reduce(function(s,p){return s+(parseFloat(p.monto)||0);},0)):'$0'), efectivoArr.length + (efectivoArr.length===1?' pago':' pagos'));
    _tesSetMetric('tes-met-comp', compArr.length, 'adjuntos');

    var pagos=pagosPeriodo.filter(function(p){
      if(medio && String(p.medio||p.medioPago||'')!==medio) return false;
      var texto=[p.gastoDesc,p.medio,p.medioPago,formatoMedioPago(p.medio||p.medioPago||''),p.usuario,p.loteId,p.categoria].join(' ');
      var nt=(typeof normTxt==='function'?normTxt(texto):_tesNorm(texto));
      if(q && !nt.includes(q)) return false;
      return true;
    });
    if(!pagos.length){ el.innerHTML='<div style="text-align:center;color:var(--text3);padding:24px">Sin pagos para mostrar</div>'; document.dispatchEvent(new CustomEvent('sisventas:treasury-rendered')); return; }
    el.innerHTML=pagos.map(function(p){
      var tipo=window._tesTipoMedio(p);
      var compBtn=(p.comprobante&&(p.comprobante.data||p.comprobante.url||p.comprobante.nombre))?'<button class="btn btn-sm" onclick="tesVerComprobante(\''+(typeof esc==='function'?esc(p.gastoKey):p.gastoKey)+'\','+p._idx+')"><i class="ti ti-paperclip"></i> Comprobante</button>':'<span style="font-size:12px;color:var(--text3)">Sin comprobante</span>';
      var badge = tipo && tipo!=='otro' ? '<span class="badge b-blue">'+(tipo==='transferencia'?'Transferencia':tipo.charAt(0).toUpperCase()+tipo.slice(1))+'</span>' : '';
      var e=(typeof esc==='function'?esc:function(x){return String(x||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});});
      var m=(typeof money==='function'?money:function(n){return '$'+(parseFloat(n)||0).toLocaleString('es-AR');});
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--bg3);border-radius:var(--radius);padding:12px 14px;flex-wrap:wrap"><div><div style="font-size:13px;font-weight:600">'+m(p.monto)+' · '+e(formatoMedioPago(p.medio||p.medioPago||'—'))+' '+badge+' '+(p.loteId?'<span class="badge b-purple">'+e(p.loteId)+'</span>':'')+'</div><div style="font-size:12px;color:var(--text2);margin-top:3px">'+e(p.gastoDesc||'—')+'</div><div style="font-size:11px;color:var(--text3);margin-top:3px">'+e(String(p.fecha||'').split('-').reverse().join('/')||'')+' · '+e(p.usuario||'Sistema')+'</div></div><div>'+compBtn+'</div></div>';
    }).join('');
    document.dispatchEvent(new CustomEvent('sisventas:treasury-rendered'));
  };
  document.addEventListener('sisventas:page-changed',function(event){
    if(!event.detail||event.detail.page!=='tesoreria') return;
    setTimeout(function(){
      var title=document.getElementById('page-title');
      if(title) title.textContent='Tesorería';
    },100);
  });
})();
