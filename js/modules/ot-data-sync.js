
(function(){
  function svEsc(v){
    if (typeof escapeHTML === 'function') return escapeHTML(v);
    return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
  }
  function svNorm(v){
    return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  }
  function svMoney(v){
    return (typeof money === 'function') ? money(v) : '$' + Math.round(parseFloat(v)||0).toLocaleString('es-AR');
  }
  function svToday(){ return typeof window.svFechaLocalISO === 'function' ? window.svFechaLocalISO() : new Date().toLocaleDateString('en-CA'); }
  function svMes(offset){
    var d = new Date(); d.setMonth(d.getMonth() + (offset||0));
    return typeof window.svMesLocalISO === 'function' ? window.svMesLocalISO(d) : d.toLocaleDateString('en-CA').slice(0,7);
  }
  function svArray(x){
    if (Array.isArray(x)) return x;
    if (x && typeof x === 'object') return Object.values(x);
    return [];
  }
  function svCurrentUserName(){
    return String(window.currentUserName || window.currentUser || window.currentUserEmail || 'Sistema');
  }
  // OT: dirección robusta + no falso aviso + regreso al listado
  var DIR_FIELDS = [
    'dir','direccion','domicilio','domicilioCliente','direccionCliente','direccion_cliente',
    'direccionInstalacion','direccion_instalacion','direccionObra','direccion_obra','ubicacion',
    'address','calle','domicilioInstalacion','direccionServicio','direccion_servicio',
    'instalacionDireccion','instalacion_direccion','lugarInstalacion','lugar_instalacion'
  ];
  function pickDireccion(obj){
    if (!obj) return '';
    for (var i=0;i<DIR_FIELDS.length;i++) {
      var v = obj[DIR_FIELDS[i]];
      if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
    }
    // Algunas fichas guardan dirección dentro de subobjetos.
    var sub = ['cliente','clienteObj','clienteData','clienteInfo','datosCliente','instalacion','obra','direccionData'];
    for (var j=0;j<sub.length;j++) {
      if (obj[sub[j]] && typeof obj[sub[j]] === 'object') {
        var d = pickDireccion(obj[sub[j]]);
        if (d) return d;
      }
    }
    return '';
  }
  function ventaRelacionada(ot){
    var ventas = svArray(window.ventasList);
    if (!ot) return null;
    var ids = [ot.ventaId, ot.venta, ot.idVenta, ot.ventaFbKey, ot.ventaKey].filter(Boolean).map(String);
    var nums = ids.map(function(x){return x.replace(/\D/g,'');}).filter(Boolean);
    return ventas.find(function(v){
      var arr = [v.fbKey,v.id,v.numero,v.ventaId,v.nro,v.codigo].filter(Boolean).map(String);
      var arrNum = arr.map(function(x){return x.replace(/\D/g,'');});
      return arr.some(function(x){return ids.indexOf(x)>=0;}) || arrNum.some(function(x){return x && nums.indexOf(x)>=0;});
    }) || null;
  }
  function clienteRelacionado(ot, venta){
    var clientes = svArray(window.clientesData);
    var ids=[];
    [ot,venta].forEach(function(o){ if(!o) return; ids.push(o.clienteId,o.idCliente,o.id_cli,o.clienteKey,o.clienteFbKey,o.fbKeyCliente); });
    ids = ids.filter(Boolean).map(String);
    if (ids.length) {
      var c = clientes.find(function(cli){
        var arr=[cli.fbKey,cli.key,cli.id,cli.codigo,cli.nroCliente].filter(Boolean).map(String);
        return arr.some(function(x){return ids.indexOf(x)>=0;});
      });
      if (c) return c;
    }
    var names=[];
    [ot,venta].forEach(function(o){ if(!o) return; names.push(o.cliente,o.clienteNombre,o.nombreCliente,o.razonSocial,o.empresa); });
    var nn = names.map(svNorm).filter(Boolean);
    if (nn.length) {
      return clientes.find(function(cli){
        var arr=[cli.nombre,cli.apellido,cli.apellidos,((cli.nombre||'')+' '+(cli.apellido||cli.apellidos||'')).trim(),cli.razonSocial,cli.razon_social,cli.empresa].map(svNorm).filter(Boolean);
        return arr.some(function(n){ return nn.indexOf(n)>=0; });
      }) || null;
    }
    return null;
  }
  function guardarDireccionResuelta(ot, dir){
    if (!ot || !dir || !window.fbDB || !ot.fbKey) return;
    if (pickDireccion(ot)) return;
    window._otGuardandoLocalHasta = Date.now() + 4000;
    window.fbUpdate(window.fbRef(window.fbDB, (window.FB_PATHS&&FB_PATHS.ordenesTrabajo?FB_PATHS.ordenesTrabajo:'sisventas/ordenesTrabajo') + '/' + ot.fbKey), {
      dir: dir,
      direccion: dir,
      usuarioUltimaEdicion: svCurrentUserName(),
      tsUltimaEdicion: Date.now()
    }).catch(function(e){ console.warn('[OT] No se pudo guardar dirección resuelta', e); });
  }
  document.addEventListener('sisventas:ot-opened',function(event){
      var id=event.detail&&event.detail.id;
      setTimeout(function(){
        var ot = svArray(window.otData).find(function(o){ return o && (o.fbKey===window.otActualId || o.id===window.otActualId || o.fbKey===id || o.id===id); });
        var dir = window._otResolverDireccionCliente(ot);
        var inp = document.getElementById('ot-det-dir');
        if (inp) {
          var actual = String(inp.value||'').trim();
          if (dir && (!actual || actual==='—' || actual==='Sin dirección')) {
            inp.value = dir;
            window._otDireccionActual = dir;
            guardarDireccionResuelta(ot, dir);
          }
          inp.placeholder = dir ? '' : 'Sin dirección cargada en la ficha del cliente';
        }
        var maps = document.getElementById('ot-det-dir-maps-btn');
        if (maps) maps.style.display = (inp && inp.value) ? '' : 'none';
        if (typeof instalarPasosOT === 'function') instalarPasosOT();
      }, 250);
  });
  ['actualizarOT','actualizarOTFecha','otAgregarNota','otAgregarFoto','toggleCheckOT'].forEach(function(fn){
    var old = window[fn];
    if (typeof old === 'function') {
      window[fn] = function(){
        window._otGuardandoLocalHasta = Date.now() + 4000;
        return old.apply(this, arguments);
      };
    }
  });
  var _sv269_completarOT = window.completarOT;
  if (typeof _sv269_completarOT === 'function') {
    window.completarOT = function(){
      window._otGuardandoLocalHasta = Date.now() + 5000;
      var r = _sv269_completarOT.apply(this, arguments);
      setTimeout(function(){
        var det = document.getElementById('ot-detalle-view');
        var list = document.getElementById('ot-list-view');
        if (det && det.style.display !== 'none') {
          var ot = svArray(window.otData).find(function(o){return o && (o.fbKey===window.otActualId || o.id===window.otActualId);});
          if (ot && ot.estado === 'completada' && typeof volverListaOT === 'function') volverListaOT();
        }
        if (list && list.style.display !== 'none' && typeof renderOTTabla === 'function') renderOTTabla();
      }, 900);
      return r;
    };
  }
})();
