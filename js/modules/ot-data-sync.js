
(function(){
  function svEsc(v){
    if (typeof escapeHTML === 'function') return escapeHTML(v);
    return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
  }


  function svToday(){ return typeof window.svFechaLocalISO === 'function' ? window.svFechaLocalISO() : new Date().toLocaleDateString('en-CA'); }

  function svArray(x){
    if (Array.isArray(x)) return x;
    if (x && typeof x === 'object') return Object.values(x);
    return [];
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


  var revisionVistaOT = 0;
  function capturarVistaOT(id) {
    var revision = revisionVistaOT, vista = window._impersonacionOriginal;
    var vigente = window.svCapturarContextoOperacion();
    var detalle = document.getElementById('ot-detalle-view');
    var campo = document.getElementById('ot-det-dir');
    var pagina = document.querySelector?.('.page.active');
    return function() {
      return vigente() && revision === revisionVistaOT && vista === window._impersonacionOriginal &&
        String(window.otActualId || '') === String(id || '') && !!id &&
        detalle === document.getElementById('ot-detalle-view') && detalle?.isConnected !== false && detalle?.style.display !== 'none' &&
        campo === document.getElementById('ot-det-dir') && campo?.isConnected !== false &&
        pagina === document.querySelector?.('.page.active');
    };
  }
  document.addEventListener('sisventas:session-ended',function(){ revisionVistaOT++; });
  document.addEventListener('sisventas:ot-opened',function(event){
      var id=event.detail&&event.detail.id;
      revisionVistaOT++;
      var vigente = capturarVistaOT(id);
      setTimeout(function(){
        if (!vigente()) return;
        var ot = svArray(window.otData).find(function(o){ return o && (o.fbKey===id || o.id===id); });
        if (!ot) return;
        var dir = window._otResolverDireccionCliente(ot);
        var inp = document.getElementById('ot-det-dir');
        if (inp) {
          var actual = String(inp.value||'').trim();
          if (dir && (!actual || actual==='—' || actual==='Sin dirección')) {
            inp.value = dir;
            window._otDireccionActual = dir;
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
      var vigente = capturarVistaOT(window.otActualId);
      window._otGuardandoLocalHasta = Date.now() + 5000;
      var r = _sv269_completarOT.apply(this, arguments);
      setTimeout(function(){
        if (!vigente()) return;
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
