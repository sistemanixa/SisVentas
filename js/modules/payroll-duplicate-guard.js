/* ══════════════════════════════════════════════════════════════════════════════
   v20.362 — Corrección definitiva SAC / Aguinaldo
   - La advertencia de duplicado ya no se basa solo en sisventas/aguinaldos,
     porque ese nodo puede conservar marcas antiguas o de pruebas.
   - Se valida contra gastos reales de Personal/Aguinaldo para el empleado,
     año y semestre seleccionados.
   - Mantiene la versión nueva con selección individual de empleados.
   ══════════════════════════════════════════════════════════════════════════════ */
(function(){
  function sv346Arr(obj){
    if (typeof arr322 === 'function') return arr322(obj);
    return Object.keys(obj || {}).map(function(k){ var v = obj[k] || {}; if (!v.fbKey) v.fbKey = k; return v; });
  }
  function sv346Norm(v){
    return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }
  function sv346Activos(){
    return sv346Arr(window.empData || {}).filter(function(e){ return e && e.activo !== false; });
  }
  function sv346EmpleadoSeleccionado(key){
    if (window.aguSelKeys322 && typeof window.aguSelKeys322.has === 'function') return window.aguSelKeys322.has(key);
    var chk = document.querySelector('.agu-check-322[data-key="' + String(key || '').replace(/"/g,'\\"') + '"]');
    return !chk || chk.checked;
  }
  function sv346EsGastoAguinaldo(g, empKey, semKey, semLbl){
    if (!g || g.anulado === true || sv346Norm(g.estado) === 'anulado') return false;
    var desc = sv346Norm(g.descripcion || g.concepto || '');
    var cat  = sv346Norm(g.categoria || '');
    var tipo = sv346Norm(g.tipo || g.tipoHaber || g.movTipo || '');
    var empOk = String(g.empleadoFbKey || g.empleadoId || g.empFbKey || '') === String(empKey || '');
    if (!empOk) return false;
    var esPersonal = cat === 'personal' || desc.indexOf('haber') >= 0 || desc.indexOf('aguinaldo') >= 0 || desc.indexOf('sac') >= 0;
    var esSac = tipo === 'aguinaldo' || desc.indexOf('aguinaldo') >= 0 || desc.indexOf('sac') >= 0;
    if (!esPersonal || !esSac) return false;
    if (String(g.semestre || '') === String(semKey)) return true;
    return desc.indexOf(sv346Norm(semLbl)) >= 0;
  }
  async function sv346HaySacRealRegistrado(empleados, semKey, semLbl){
    var snap = await window.fbGet(window.fbRef(window.fbDB, 'sisventas/gastos'));
    var gastos = sv346Arr(snap.val() || {});
    var keys = new Set((empleados || []).map(function(e){ return String(e.fbKey || ''); }));
    return gastos.some(function(g){
      var empKey = String(g.empleadoFbKey || g.empleadoId || g.empFbKey || '');
      return keys.has(empKey) && sv346EsGastoAguinaldo(g, empKey, semKey, semLbl);
    });
  }
  function sv346ActualizarMarcaAguinaldo(e, semKey, payload){
    return window.fbSet(window.fbRef(window.fbDB, 'sisventas/aguinaldos/' + e.fbKey + '/' + semKey), payload);
  }
})();
