(function(){
  function esc322(s){ return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function arr322(v){ return Array.isArray(v) ? v : Object.values(v||{}); }
  function norm322(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(); }
  function findClienteVenta322(v){
    var clientes = arr322(window.cliData || window.clientesData || window.clientesList || window.clientes || []);
    var ids = [v&&v.clienteId, v&&v.idCliente, v&&v.id_cli, v&&v.clienteFbKey].map(function(x){return String(x||'').trim();}).filter(Boolean);
    if(ids.length){
      var byId = clientes.find(function(c){ return ids.indexOf(String(c.fbKey||c.id||c.codigo||c.legajo||'').trim())>=0; });
      if(byId) return byId;
    }
    var n = norm322(v&&v.cliente);
    if(n) return clientes.find(function(c){ return [c.nombre, c.razonSocial, c.empresa, c.cliente, ((c.nombre||'')+' '+(c.apellido||c.apellidos||'')).trim()].map(norm322).indexOf(n)>=0; }) || null;
    return null;
  }
  function clienteInfoHtml322(c){
    if(!c) return '<div style="font-size:12px;color:var(--text3);margin-top:6px">Sin datos adicionales cargados para este cliente.</div>';
    var tel = c.telefono || c.tel || c.celular || c.whatsapp || '';
    var mail = c.email || c.mail || c.correo || '';
    var dir = c.direccion || c.dir || c.domicilio || c.direccionInstalacion || c.instalacionDireccion || c.direccion_instalacion || '';
    var cuit = c.cuit || c.documento || c.dni || '';
    var partes=[];
    if(tel) partes.push('<span><i class="ti ti-phone"></i> '+esc322(tel)+'</span>');
    if(mail) partes.push('<span><i class="ti ti-mail"></i> '+esc322(mail)+'</span>');
    if(cuit) partes.push('<span><i class="ti ti-id"></i> '+esc322(cuit)+'</span>');
    if(dir) partes.push('<span><i class="ti ti-map-pin"></i> '+esc322(dir)+'</span>');
    if(!partes.length) return '<div style="font-size:12px;color:var(--text3);margin-top:6px">Sin teléfono, email o dirección cargada.</div>';
    return '<div id="venta-cliente-info-322" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;font-size:12px;color:var(--text3)">'+partes.join('')+'</div>';
  }
  function postDetalleVenta322(v){
    var dv=document.getElementById('venta-detalle-view'); if(!dv) return;
    // Reordenar acciones: operativas a la izquierda, editar/eliminar a la derecha.
    var rows = Array.from(dv.children).filter(function(el){ return el && el.tagName==='DIV'; });
    var actionRow = rows.find(function(el){ return el.querySelector && el.querySelector('button[onclick*="eliminarVenta"],button[onclick*="abrirEditorVenta"]'); });
    if(actionRow && !actionRow.id){
      var btns = Array.from(actionRow.querySelectorAll(':scope > button'));
      var left=[], right=[];
      btns.forEach(function(b){
        var oc = b.getAttribute('onclick')||'';
        if(oc.indexOf('abrirEditorVenta')>=0 || oc.indexOf('eliminarVenta')>=0) right.push(b); else left.push(b);
      });
      if(right.length){
        actionRow.innerHTML='';
        actionRow.style.justifyContent='space-between';
        actionRow.style.alignItems='center';
        var l=document.createElement('div'); l.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap';
        var r=document.createElement('div'); r.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-left:auto';
        left.forEach(function(b){l.appendChild(b);}); right.forEach(function(b){r.appendChild(b);});
        actionRow.appendChild(l); actionRow.appendChild(r);
      }
    }
    // Completar datos del cliente en la tarjeta cliente.
    var c=findClienteVenta322(v||window._ventaDetalleActual||{});
    var cardCliente = Array.from(dv.querySelectorAll('.card')).find(function(card){ return /Cliente/i.test((card.textContent||'').slice(0,80)); });
    if(cardCliente && !cardCliente.querySelector('#venta-cliente-info-322')){
      var nameEl = Array.from(cardCliente.querySelectorAll('div')).find(function(x){ return (x.textContent||'').trim() === ((v&&v.cliente)||'').trim(); });
      if(nameEl) nameEl.insertAdjacentHTML('afterend', clienteInfoHtml322(c));
    }
    // Mover rentabilidad interna al final del detalle.
    var rent = Array.from(dv.querySelectorAll('.card')).find(function(card){ return (card.textContent||'').indexOf('Rentabilidad interna')>=0; });
    if(rent) dv.appendChild(rent);
  }
  if(typeof window.renderDetalleVenta==='function'){
    var originalRenderDetalleVenta322 = window.renderDetalleVenta;
    window.renderDetalleVenta = function(v){
      var r = originalRenderDetalleVenta322.apply(this, arguments);
      setTimeout(function(){ postDetalleVenta322(v); }, 0);
      return r;
    };
  }

  // Aguinaldo: selección individual / todos / ninguno sin cambiar el cálculo original.
  var aguSelKeys322 = null;
  function activos322(){ return arr322(window.empData||{}).filter(function(e){return e && e.activo!==false;}); }
  function aplicarSelectorAguinaldo322(){
    var modal=document.getElementById('modal-aguinaldo'); if(!modal) return;
    var body=document.getElementById('agu-tabla-body'); if(!body) return;
    var empleados=activos322();
    if(!aguSelKeys322) aguSelKeys322 = new Set(empleados.map(function(e){return e.fbKey;}));
    if(!document.getElementById('agu-select-tools-322')){
      var tools=document.createElement('div');
      tools.id='agu-select-tools-322';
      tools.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;padding:8px 10px;background:var(--bg3);border-radius:var(--radius);font-size:12px;color:var(--text2)';
      tools.innerHTML='<span style="font-weight:600;color:var(--text)">Empleados a registrar:</span>'+
        '<button class="btn btn-sm" type="button" onclick="window.aguSeleccionarTodos322()">Todos</button>'+
        '<button class="btn btn-sm" type="button" onclick="window.aguSeleccionarNinguno322()">Ninguno</button>'+
        '<span id="agu-select-count-322" style="margin-left:auto;color:var(--text3)"></span>';
      body.insertBefore(tools, body.firstChild);
    }
    var rows=Array.from(body.querySelectorAll('tbody tr'));
    rows.forEach(function(tr,i){
      var e=empleados[i]; if(!e) return;
      tr.setAttribute('data-emp-key', e.fbKey||'');
      var td=tr.querySelector('td');
      if(td && !td.querySelector('.agu-check-322')){
        td.insertAdjacentHTML('afterbegin','<input class="agu-check-322" type="checkbox" style="width:16px;height:16px;accent-color:var(--green);margin-right:8px;vertical-align:middle" data-key="'+esc322(e.fbKey||'')+'">');
      }
      var chk=td && td.querySelector('.agu-check-322');
      if(chk){
        chk.checked=aguSelKeys322.has(e.fbKey);
        chk.onchange=function(ev){ ev.stopPropagation(); if(chk.checked) aguSelKeys322.add(e.fbKey); else aguSelKeys322.delete(e.fbKey); actualizarTotalAguinaldo322(); };
      }
    });
    actualizarTotalAguinaldo322();
  }
  function actualizarTotalAguinaldo322(){
    var total=0, count=0;
    var empleados=activos322();
    Array.from(document.querySelectorAll('#agu-tabla-body tbody tr')).forEach(function(tr,i){
      var e=empleados[i]; if(!e) return;
      var checked = aguSelKeys322 && aguSelKeys322.has(e.fbKey);
      tr.style.opacity = checked ? '1' : '.45';
      if(checked){
        count++;
        var cells=tr.querySelectorAll('td');
        var valCell=cells[cells.length-1];
        // v20.362: el total debe tomar solo el importe principal de la celda.
        // Antes se leía todo el textContent, incluyendo la fórmula interna
        // ($920.000 ÷ 12 × 6), y eso concatenaba números generando importes enormes.
        var montoTxt = '';
        if (valCell) {
          var nodoMonto = Array.from(valCell.childNodes || []).find(function(n){
            return n.nodeType === 3 && String(n.textContent||'').trim();
          });
          montoTxt = nodoMonto ? nodoMonto.textContent : (valCell.firstChild ? valCell.firstChild.textContent : valCell.textContent);
        }
        var raw=(montoTxt||'').replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',','.');
        total += parseFloat(raw)||0;
      }
    });
    var lbl=document.getElementById('agu-total-lbl'); if(lbl) lbl.textContent='$'+Math.round(total).toLocaleString('es-AR');
    var cnt=document.getElementById('agu-select-count-322'); if(cnt) cnt.textContent=count+' seleccionado'+(count!==1?'s':'');
  }
  window.aguSeleccionarTodos322=function(){ aguSelKeys322=new Set(activos322().map(function(e){return e.fbKey;})); aplicarSelectorAguinaldo322(); };
  window.aguSeleccionarNinguno322=function(){ aguSelKeys322=new Set(); aplicarSelectorAguinaldo322(); };
  document.addEventListener('sisventas:payroll-modal-opened',function(){ aguSelKeys322=null; setTimeout(aplicarSelectorAguinaldo322,0); });
  if(typeof window.recalcularAguinaldo==='function'){
    var originalRecalcularAguinaldo322=window.recalcularAguinaldo;
    window.recalcularAguinaldo=async function(){
      var r = await originalRecalcularAguinaldo322.apply(this, arguments);
      aplicarSelectorAguinaldo322();
      return r;
    };
  }
})();
