
(function(){
  function _tesNorm(v){
    return String(v||'').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/\s+/g,' ').trim();
  }
  function _tesMedioConfig(medio){
    var n = _tesNorm(medio);
    var cfg = (window.MEDIOS_PAGO_CONFIG||[]).find(function(x){ return _tesNorm(x.nombre)===n; });
    return cfg || null;
  }
  window._tesTipoMedio = function(p){
    p = p || {};
    var medio = p.medio || p.medioPago || '';
    var cfg = _tesMedioConfig(medio);
    if (cfg && cfg.tipo) return _tesNorm(cfg.tipo);
    var n = _tesNorm(medio);
    if (/efect/.test(n)) return 'efectivo';
    if (/trans|transfer|alias|cbu|banco|bancaria|santander|galicia|bbva|macro|nacion|provincia|uala|mercado|mp|qr|billetera|nixa\.mp|nixa mp/.test(n)) return 'transferencia';
    if (/tarj|debito|credito|visa|master/.test(n)) return 'tarjeta';
    if (/cheq|echeq/.test(n)) return 'cheque';
    if (p.comprobante && (p.comprobante.data || p.comprobante.url || p.comprobante.nombre)) return 'transferencia';
    return 'otro';
  };
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
    if(!pagos.length){ el.innerHTML='<div style="text-align:center;color:var(--text3);padding:24px">Sin pagos para mostrar</div>'; return; }
    el.innerHTML=pagos.map(function(p){
      var tipo=window._tesTipoMedio(p);
      var compBtn=(p.comprobante&&(p.comprobante.data||p.comprobante.url||p.comprobante.nombre))?'<button class="btn btn-sm" onclick="tesVerComprobante(\''+(typeof esc==='function'?esc(p.gastoKey):p.gastoKey)+'\','+p._idx+')"><i class="ti ti-paperclip"></i> Comprobante</button>':'<span style="font-size:12px;color:var(--text3)">Sin comprobante</span>';
      var badge = tipo && tipo!=='otro' ? '<span class="badge b-blue">'+(tipo==='transferencia'?'Transferencia':tipo.charAt(0).toUpperCase()+tipo.slice(1))+'</span>' : '';
      var e=(typeof esc==='function'?esc:function(x){return String(x||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});});
      var m=(typeof money==='function'?money:function(n){return '$'+(parseFloat(n)||0).toLocaleString('es-AR');});
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--bg3);border-radius:var(--radius);padding:12px 14px;flex-wrap:wrap"><div><div style="font-size:13px;font-weight:600">'+m(p.monto)+' · '+e(formatoMedioPago(p.medio||p.medioPago||'—'))+' '+badge+' '+(p.loteId?'<span class="badge b-purple">'+e(p.loteId)+'</span>':'')+'</div><div style="font-size:12px;color:var(--text2);margin-top:3px">'+e(p.gastoDesc||'—')+'</div><div style="font-size:11px;color:var(--text3);margin-top:3px">'+e(String(p.fecha||'').split('-').reverse().join('/')||'')+' · '+e(p.usuario||'Sistema')+'</div></div><div>'+compBtn+'</div></div>';
    }).join('');
  };
})();
