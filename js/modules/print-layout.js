/* ══════════════════════════════════════════════════════════════════════════════
   v20.339 — Formato unificado de impresión NIXA
   Aplica encabezado/pie institucional a recibos, comprobantes, facturas,
   presupuestos, remitos, OT, informes e impresiones genéricas.
   ══════════════════════════════════════════════════════════════════════════════ */
(function(){
  function esc(v){
    if (typeof window.escapeHTML === 'function') return window.escapeHTML(v == null ? '' : String(v));
    return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
  }
  function money(v){ return '$' + Math.round(parseFloat(v)||0).toLocaleString('es-AR'); }
  function val(id){ var e=document.getElementById(id); return e ? (e.value||e.textContent||'') : ''; }
  function fecha(v){
    if(!v) return new Date().toLocaleDateString('es-AR');
    if(/^\d{4}-\d{2}-\d{2}/.test(v)){ var p=v.slice(0,10).split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }
    return String(v);
  }
  function empresa(){
    return {
      nombre: val('cfg-empresa-nombre') || 'Nixa',
      dir: val('cfg-empresa-dir') || 'Constitución 5030, Oficina 6',
      tel: val('cfg-empresa-tel') || '',
      cuit: val('cfg-empresa-cuit') || '20-34648416-1',
      email: val('cfg-empresa-email') || '',
      web: val('cfg-empresa-web') || 'ventas.sistemanixa.com',
      logo: window.logoEmpresaUrl ? '<img src="'+window.logoEmpresaUrl+'" class="nx-logo-img">' : '<div class="nx-logo-text">NIXA</div>'
    };
  }
  function cliente(nombre,id,registro){
    var reg = Object.assign({}, registro || {}, {
      cliente: nombre || (registro && registro.cliente) || '',
      clienteId: id || (registro && (registro.clienteId || registro.idCliente)) || '',
      idCliente: id || (registro && (registro.idCliente || registro.clienteId)) || ''
    });
    if (typeof window._svResolverClienteRegistro === 'function') {
      return window._svResolverClienteRegistro(reg, true) || {};
    }
    var n=(nombre||'').toString().trim().toLowerCase();
    var c=null;
    try{
      c=(window.clientesData||[]).find(function(x){ return String(x.id||'')===String(id||'') || String(x.fbKey||'')===String(id||''); });
      if(!c) c=(window.clientesData||[]).find(function(x){ return ((x.nombre||'')+' '+(x.apellidos||'')).trim().toLowerCase()===n || (x.nombre||'').trim().toLowerCase()===n; });
    }catch(e){}
    return c||{};
  }
  function medioDetalle(m){
    var s = (typeof window.formatoMedioPago === 'function') ? window.formatoMedioPago(m||'') : (m||'');
    var parts = String(s).split('/').map(function(x){return x.trim();}).filter(Boolean);
    if(parts.length>1) return '<strong>'+esc(parts[0])+'</strong><div class="muted">'+esc(parts.slice(1).join(' / '))+'</div>';
    return '<strong>'+esc(s||'—')+'</strong>';
  }
  function dirCliente(c, fallback){
    return c.dir || c.direccion || c.domicilio || c.direccionInstalacion || c.instalacion || fallback || '';
  }
  function box(label, main, sub){
    return '<div class="info-box"><div class="lbl">'+esc(label)+'</div><div class="val">'+(main||'—')+'</div>'+(sub?'<div class="sub">'+sub+'</div>':'')+'</div>';
  }
  function clienteBox(nombre, c, extraDir){
    var sub=[];
    var doc=c.cuit||c.dni||c.documento||''; if(doc) sub.push('CUIT/DNI: '+esc(doc));
    var tel=c.telefono||c.tel||c.celular||''; if(tel) sub.push('Tel: '+esc(tel));
    var d=dirCliente(c, extraDir); if(d) sub.push('Dirección: '+esc(d));
    return box('Cliente', '<strong>'+esc(nombre||c.nombre||'—')+'</strong>', sub.join('<br>'));
  }
  function shell(opts){
    opts=opts||{}; var e=empresa();
    var title=opts.title||'Comprobante'; var num=opts.num||'—'; var f=opts.fecha||fecha();
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+esc(title)+' '+esc(num)+'</title><style>'+css()+'</style></head><body>'+ 
      '<main class="doc">'+
      '<header class="head">'+
        '<div class="brand">'+e.logo+'<div class="brand-txt"><div class="brand-name">'+esc(e.nombre)+'</div><div>'+esc(e.dir)+'</div>'+(e.tel?'<div>Tel: '+esc(e.tel)+'</div>':'')+(e.cuit?'<div>CUIT: '+esc(e.cuit)+'</div>':'')+(e.web?'<div>'+esc(e.web)+'</div>':'')+'</div></div>'+
        '<div class="comp"><div class="tipo">'+esc(title)+'</div><div class="num">'+esc(num)+'</div><div class="date">'+esc(f)+'</div>'+(opts.estado?'<div class="state">'+esc(opts.estado)+'</div>':'')+'</div>'+
      '</header>'+
      (opts.body||'')+
      '<footer class="foot"><div>Documento generado electrónicamente por SisVentas — NIXA Sistemas de Seguridad.</div><div>'+esc(e.web||'')+'</div></footer>'+ 
      '</main></body></html>';
  }
  function css(){ return `
    *{box-sizing:border-box;margin:0;padding:0} body{background:#fff;color:#222;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;line-height:1.35;margin:0}.doc{width:680px;margin:18px auto;padding:18px 22px}.head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #222;padding-bottom:14px;margin-bottom:20px}.brand{display:flex;align-items:center;gap:16px;min-width:0}.nx-logo-img{width:92px;max-height:74px;object-fit:contain;display:block}.nx-logo-text{width:92px;height:62px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;letter-spacing:-1px;color:#173b2f}.brand-txt{font-size:11px;color:#555;line-height:1.45}.brand-name{font-size:15px;font-weight:800;color:#222;margin-bottom:2px}.comp{text-align:right;min-width:160px}.tipo{font-size:19px;font-weight:800;text-transform:uppercase;letter-spacing:-.2px}.num{font-size:15px;font-weight:700;margin-top:2px}.date{font-size:12px;color:#666}.state{display:inline-block;margin-top:7px;padding:4px 10px;border-radius:999px;border:1px solid #4caf50;color:#2e7d32;font-weight:700;font-size:11px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}.info-box{background:#fafafa;border:1px solid #e5e5e5;border-radius:7px;padding:10px 12px;min-height:58px}.lbl{font-size:9.5px;color:#777;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;font-weight:700}.val{font-size:13px;color:#222}.sub{font-size:11px;color:#555;margin-top:5px;line-height:1.45}.muted{font-size:11px;color:#666;margin-top:2px}.amount-box{border:2px solid #4caf50;border-radius:8px;text-align:center;padding:18px 16px;margin:18px 0 20px;background:#fbfffb}.amount-lbl{font-size:11px;color:#666;text-transform:uppercase}.amount{font-size:34px;font-weight:800;color:#43a047;margin:2px 0}.amount-sub{font-size:12px;color:#555}.status-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0 18px}.status{background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:8px 10px}.status .k{font-size:9px;color:#777;text-transform:uppercase;letter-spacing:.4px}.status .v{font-size:13px;font-weight:800;margin-top:3px}table{width:100%;border-collapse:collapse;margin:10px 0 8px}th{background:#1f2937;color:#fff;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;padding:7px 9px;text-align:left}td{border-bottom:1px solid #eee;padding:7px 9px;vertical-align:top}.tr{text-align:right}.totals{margin-left:auto;width:260px;margin-top:8px}.tot-row{display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:5px 0}.tot-row.total{border-top:2px solid #222;border-bottom:0;margin-top:5px;padding-top:8px;font-weight:800;font-size:15px}.note{border:1px solid #e5e5e5;background:#fafafa;border-radius:7px;padding:9px 12px;margin:12px 0;font-size:12px}.green{color:#43a047}.red{color:#d32f2f}.firma{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px}.firma-line{border-top:1px solid #222;padding-top:7px;text-align:center;font-size:11px;color:#666}.foot{border-top:1px solid #ddd;margin-top:24px;padding-top:8px;font-size:9.5px;color:#888;display:flex;justify-content:space-between;gap:20px}@media print{.doc{width:auto;margin:0;padding:10mm 12mm}body{margin:0}.no-print{display:none}tr{page-break-inside:avoid}.head{break-inside:avoid}.foot{position:fixed;bottom:8mm;left:12mm;right:12mm}}`; }
  function openPrint(html, name){ var w=window.open('','_blank','width=860,height=760'); if(!w){ notify('El navegador bloqueó la ventana de impresión'); return; } w.document.write(html); w.document.close(); setTimeout(function(){ w.print(); }, 500); }

  window.imprimirRecibo = function(){
    var pago=window._ultimoPago, v=window._ultimoPagoVenta; if(!pago){notify('Sin datos de pago para imprimir');return;}
    var c=cliente(pago.cliente, v && (v.idCliente||v.clienteId), v || pago);
    var monto=parseFloat(pago.monto)||0, total=v?parseFloat(v.total)||0:0, pagadoAnt=v?Math.max(0,(parseFloat(v.totalPagado)||0)-monto):0, saldo=Math.max(0,total-pagadoAnt-monto);
    var body='<section class="grid">'+
      clienteBox(pago.cliente,c,v&&(v.direccion||v.dir||v.direccionInstalacion))+
      box('Venta vinculada','<strong>'+esc(pago.venta||((v||{}).id)||'—')+'</strong>', (v&&v.tipoVisita?'Trabajo: '+esc(v.tipoVisita)+'<br>':'')+(v&&(v.direccion||v.dir)?'Dirección venta: '+esc(v.direccion||v.dir):''))+
      box('Medio de pago',medioDetalle(pago.medio),'Referencia: '+esc(pago.ref||pago.referencia||'—'))+
      box('Total de la venta','<strong>'+ (v?money(total):'—') +'</strong>', v&&v.estadoPago?'Estado: '+esc(v.estadoPago):'')+
    '</section><div class="amount-box"><div class="amount-lbl">Recibimos la suma de</div><div class="amount">'+money(monto)+'</div><div class="amount-sub">'+medioDetalle(pago.medio)+'</div></div>'+ 
    '<section class="status-grid"><div class="status"><div class="k">Total venta</div><div class="v">'+(v?money(total):'—')+'</div></div><div class="status"><div class="k">Cobrado ant.</div><div class="v">'+money(pagadoAnt)+'</div></div><div class="status"><div class="k">Pago actual</div><div class="v green">'+money(monto)+'</div></div><div class="status"><div class="k">Saldo</div><div class="v '+(saldo>0?'red':'green')+'">'+money(saldo)+'</div></div></section>'+ 
    (pago.obs?'<div class="note"><strong>Observaciones:</strong> '+esc(pago.obs)+'</div>':'')+
    '<div class="firma"><div><div class="firma-line">Firma del cliente</div></div><div><div class="firma-line">Firma Nixa</div></div></div>';
    openPrint(shell({title:'RECIBO',num:'R-'+String(Date.now()).slice(-6),fecha:fecha(pago.fecha),estado:saldo>0?'Pago parcial':'Cancelado',body:body}));
  };

  window.imprimirRemito = function(fbKey){
    if(!window.fbDB) return;
    window.fbOnValue(window.fbRef(window.fbDB,'sisventas/remitos/'+fbKey),function(snap){
      var r=snap.val(); if(!r){notify('Remito no encontrado');return;}
      var v=(typeof window._svResolverVentaRegistro === 'function' ? window._svResolverVentaRegistro({venta:r.venta,ventaId:r.venta,ventaFbKey:r.ventaFbKey}) : null) || {};
      var c=cliente(r.cliente||v.cliente,v.idCliente||v.clienteId,v);
      var body='<section class="grid">'+clienteBox(r.cliente||v.cliente,c,v.direccion||v.dir)+box('Venta vinculada','<strong>'+esc(r.venta||v.id||'—')+'</strong>', v.direccion||v.dir?'Dirección: '+esc(v.direccion||v.dir):'')+'</section>'+ '<div class="note"><div class="lbl">Descripción / detalle</div>'+esc(r.descripcion||'—')+'</div>'+ '<div class="firma"><div><div class="firma-line">Firma receptor</div></div><div><div class="firma-line">Firma Nixa</div></div></div>';
      openPrint(shell({title:'REMITO',num:r.numero||'—',fecha:fecha(r.fecha),body:body}));
    },{onlyOnce:true});
  };

  window._imprimirOTReal = function(){
    var ot=(window.otData||[]).find(function(o){return o.id===window.otActualId||o.fbKey===window.otActualId;}); if(!ot){notify('OT no encontrada');return;}
    var c=cliente(ot.cliente, ot.clienteId||ot.idCliente, ot); var mats=ot.materiales||ot.items||[];
    var rows=mats.length?mats.map(function(m){return '<tr><td>'+esc(m.cod||'')+'</td><td>'+esc(m.desc||m.nombre||'')+'</td><td class="tr">'+esc(m.vendida||m.qty||'')+'</td><td class="tr">'+esc(m.instalada||'')+'</td></tr>';}).join(''):'<tr><td colspan="4" style="text-align:center;color:#888">Sin materiales cargados</td></tr>';
    var body='<section class="grid">'+clienteBox(ot.cliente,c,ot.dir||ot.direccion)+box('Técnico','<strong>'+esc(ot.tecnico||'Sin asignar')+'</strong>','Tipo: '+esc(ot.tipoVisita||ot.tipo||'—'))+box('Venta vinculada','<strong>'+esc(ot.ventaId||'—')+'</strong>','Fecha programada: '+esc(fecha(ot.fecha)))+box('Dirección',esc(ot.dir||ot.direccion||dirCliente(c)||'Sin dirección'), '')+'</section>'+(ot.obs?'<div class="note"><strong>Notas:</strong> '+esc(ot.obs)+'</div>':'')+'<table><thead><tr><th>Código</th><th>Material</th><th class="tr">Presup.</th><th class="tr">Instalado</th></tr></thead><tbody>'+rows+'</tbody></table><div class="firma"><div><div class="firma-line">Firma del cliente</div></div><div><div class="firma-line">Firma del técnico</div></div></div>';
    openPrint(shell({title:'ORDEN DE TRABAJO',num:ot.id||'—',fecha:fecha(ot.fecha),estado:ot.estado||'',body:body}));
  };

  window.imprimirSeccion = function(pageId,titulo){
    var page=document.getElementById(pageId); if(!page){notify('Sección no disponible');return;}
    var clone=page.cloneNode(true); clone.querySelectorAll('button,input,select,textarea,.no-print,.modal-overlay').forEach(function(n){
      if(n.tagName==='INPUT'||n.tagName==='SELECT'||n.tagName==='TEXTAREA'){ var span=document.createElement('span'); span.textContent=n.value||n.textContent||''; n.replaceWith(span); } else n.remove();
    });
    var body='<div class="note">Impresión de módulo: <strong>'+esc(titulo||pageId)+'</strong></div><div class="print-section">'+clone.innerHTML+'</div><style>.print-section .card{border:1px solid #e5e5e5;border-radius:8px;padding:10px;margin:8px 0}.print-section .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.print-section .metric{border:1px solid #eee;border-radius:7px;padding:8px}.print-section table{font-size:11px}</style>';
    openPrint(shell({title:(titulo||'REPORTE').toUpperCase(),num:'',fecha:fecha(),body:body}));
  };

  window.imprimirVentaActual = function(){
    var v=window._ventaDetalleActual; if(!v){notify('Sin venta activa');return;} var conDetalle=(typeof window._ventaImpConDetalle==='undefined')?true:window._ventaImpConDetalle;
    var c=cliente(v.cliente,v.idCliente||v.clienteId,v); var tipo=(v.factura&&v.factura.tipo)||(v.notaCredito&&v.notaCredito.tipo)||'COMPROBANTE';
    var estado={pendiente_pago:'Pendiente de pago',seniado:'Señado',pago_total:'Pago total'}[v.estadoPago]||v.estadoPago||'';
    var rows=(v.items||[]).filter(function(it){return (it.desc||it.nombre||'').trim()||parseFloat(it.punit)>0;}).map(function(it){return '<tr><td>'+esc(it.cod||'')+'</td><td>'+esc(it.desc||it.nombre||'')+'</td><td class="tr">'+esc(it.qty||it.cantidad||'')+'</td><td class="tr">'+(conDetalle?money(it.punit):'—')+'</td><td class="tr"><strong>'+(conDetalle?money(it.sub):'—')+'</strong></td></tr>';}).join('')||'<tr><td colspan="5" style="text-align:center;color:#888">Sin ítems</td></tr>';
    var body='<section class="grid">'+clienteBox(v.cliente,c,v.direccion||v.dir)+box('Datos de operación','<strong>'+esc(v.id||'—')+'</strong>','Estado pago: '+esc(estado)+(v.ot?'<br>OT asociada: '+esc(v.ot):'')+(v.empleado?'<br>Vendedor: '+esc(v.empleado):''))+ '</section><table><thead><tr><th>Código</th><th>Descripción</th><th class="tr">Cant.</th><th class="tr">P. unit.</th><th class="tr">Subtotal</th></tr></thead><tbody>'+rows+'</tbody></table><div class="totals">'+(conDetalle?'<div class="tot-row"><span>Subtotal</span><span>'+money(v.subtotal)+'</span></div>'+(parseFloat(v.descuento)>0?'<div class="tot-row"><span>Descuento</span><span class="red">-'+money(v.descuento)+'</span></div>':'')+'<div class="tot-row"><span>IVA</span><span>'+money(v.iva)+'</span></div>':'')+'<div class="tot-row total"><span>Total</span><span>'+money(v.total)+'</span></div></div>'+((v.factura&&v.factura.cae)?'<div class="note"><strong>CAE:</strong> '+esc(v.factura.cae)+' · Vto: '+esc(v.factura.cae_vencimiento||'')+'</div>':'')+'<div class="firma"><div><div class="firma-line">Conformidad del cliente</div></div><div><div class="firma-line">Firma Nixa</div></div></div>';
    openPrint(shell({title:tipo.toUpperCase(),num:v.factura&&v.factura.numero_comprobante?String(v.factura.numero_comprobante):('#'+(v.id||'')),fecha:fecha(v.fecha),estado:estado,body:body}));
  };

  window.imprimirPresupuesto = function(){
    var g=function(id){var e=document.getElementById(id); return e?(e.value||e.textContent||''):'';};
    var num=g('pp-numero')||g('ppto-det-numero')||'—', cli=g('pp-cli')||g('ppto-det-cliente')||'—', f=g('pp-fecha')||g('ppto-det-fecha')||fecha(), venc=g('pp-venc')||g('ppto-det-venc')||'—';
    var c=cliente(cli); var rows='';
    document.querySelectorAll('#pp-body tr, #ppto-det-items tr').forEach(function(tr){var t=tr.querySelectorAll('td'); if(t.length>=3){var cod=t[0].textContent.trim(), desc=t[1].textContent.trim(); if(desc&&desc!=='Seleccioná un producto'){var qty=(t[2].querySelector('input')||t[2]).value||t[2].textContent.trim(); var precio=(t[3]&&(t[3].querySelector('input')||t[3]).value)||t[3].textContent.trim(); var sub=t[4]?t[4].textContent.trim():''; rows+='<tr><td>'+esc(cod)+'</td><td>'+esc(desc)+'</td><td class="tr">'+esc(qty)+'</td><td class="tr">'+(window._pptoConDetalle!==false?esc(precio):'—')+'</td><td class="tr"><strong>'+(window._pptoConDetalle!==false?esc(sub):'—')+'</strong></td></tr>';}}});
    rows=rows||'<tr><td colspan="5" style="text-align:center;color:#888">Sin ítems</td></tr>';
    var body='<section class="grid">'+clienteBox(cli,c)+box('Condiciones','<strong>Validez hasta '+esc(venc)+'</strong>', g('pp-obs')||g('ppto-det-obs')||'Condición de pago: a convenir')+'</section><table><thead><tr><th>Código</th><th>Descripción</th><th class="tr">Cant.</th><th class="tr">P. unit.</th><th class="tr">Subtotal</th></tr></thead><tbody>'+rows+'</tbody></table><div class="totals"><div class="tot-row"><span>Subtotal</span><span>'+esc(g('pp-sub')||g('ppto-det-sub')||'$0')+'</span></div><div class="tot-row"><span>IVA</span><span>'+esc(g('pp-iva')||g('ppto-det-iva')||'$0')+'</span></div><div class="tot-row total"><span>Total</span><span>'+esc(g('pp-total')||g('ppto-det-total2')||'$0')+'</span></div></div><div class="note">Presupuesto sujeto a disponibilidad de stock y vigencia indicada.</div>';
    openPrint(shell({title:'PRESUPUESTO',num:num,fecha:fecha(f),body:body}));
  };

  window.imprimirInforme = function(){
    var g=function(id){var e=document.getElementById(id);return e?(e.value||e.textContent||''):'';};
    var cli=g('inf-cliente')||'—'; var c=cliente(cli);
    function section(t,x){return x?'<div class="note"><div class="lbl">'+esc(t)+'</div>'+esc(x).replace(/\n/g,'<br>')+'</div>':'';}
    var body='<section class="grid">'+clienteBox(cli,c,g('inf-dir'))+box('Equipo / servicio','<strong>'+esc(g('inf-equipo')||'Informe técnico')+'</strong>','Técnico: '+esc(g('inf-tecnico')||'—'))+'</section>'+section('Diagnóstico',g('inf-diagnostico'))+section('Acciones correctivas realizadas',g('inf-acciones'))+section('Materiales utilizados',g('inf-materiales'))+section('Medidas preventivas recomendadas',g('inf-preventivas'))+section('Observaciones',g('inf-obs'))+'<div class="firma"><div><div class="firma-line">Firma del técnico</div></div><div><div class="firma-line">Firma del cliente</div></div></div>';
    openPrint(shell({title:'INFORME TÉCNICO',num:g('inf-num')||'',fecha:fecha(g('inf-fecha')),body:body}));
  };
})();
