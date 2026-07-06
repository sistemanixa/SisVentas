/* ══════════════════════════════════════════════════════════════════════════════
   v20.362 — SAC visible en Gastos + fecha editable
   - Los SAC que quedaron solo en sisventas/aguinaldos se muestran en Gastos
     como registros recuperados para poder detectarlos y eliminarlos.
   - El alta de SAC usa por defecto la fecha del día y permite modificarla.
   - La validación de duplicado contempla gastos reales y marcas SAC existentes.
   ══════════════════════════════════════════════════════════════════════════════ */
(function(){
  var sv347AguinaldosData = {};
  var sv347AguListenerStarted = false;

  function sv347Arr(obj){
    return Object.keys(obj || {}).map(function(k){ var v = obj[k] || {}; if (v && typeof v === 'object' && !v.fbKey) v.fbKey = k; return v; });
  }
  function sv347Norm(v){
    return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }
  function sv347Today(){
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function sv347EmpNombre(empKey){
    var e = (window.empData || {})[empKey] || sv347Arr(window.empData || {}).find(function(x){ return String(x.fbKey||'') === String(empKey||''); });
    return (e && e.nombre) || 'Empleado';
  }
  function sv347SemLbl(semKey){
    var m = String(semKey||'').match(/^(\d{4})_S([12])$/);
    if (!m) return String(semKey||'');
    return (m[2] === '1' ? '1er semestre' : '2do semestre') + ' ' + m[1];
  }
  function sv347EsGastoSac(g){
    if (!g) return false;
    var desc = sv347Norm(g.descripcion || g.concepto || '');
    var tipo = sv347Norm(g.tipo || g.tipoHaber || g.origen || '');
    return tipo === 'aguinaldo' || tipo === 'sac' || desc.indexOf('aguinaldo') >= 0 || desc.indexOf('sac') >= 0;
  }
  function sv347GastoSacKey(g){
    if (!sv347EsGastoSac(g)) return '';
    var emp = String(g.empleadoFbKey || g.empleadoId || g.empFbKey || '');
    var sem = String(g.semestre || '');
    if (!emp || !sem) return '';
    return emp + '|' + sem;
  }
  function sv347GastosExtendidos(){
    var base = (window.gastosData || []).slice();
    var existentes = new Set(base.map(sv347GastoSacKey).filter(Boolean));
    Object.keys(sv347AguinaldosData || {}).forEach(function(empKey){
      var regs = sv347AguinaldosData[empKey] || {};
      Object.keys(regs || {}).forEach(function(semKey){
        var r = regs[semKey] || {};
        if (existentes.has(empKey + '|' + semKey)) return;
        var monto = Number(r.aguinaldo || r.monto || 0);
        if (!monto) return;
        base.push({
          fbKey: 'aguinaldo_recuperado__' + empKey + '__' + semKey,
          _origenAguinaldo: true,
          _aguEmpKey: empKey,
          _aguSemKey: semKey,
          fecha: r.fecha || '',
          tipo: 'aguinaldo',
          descripcion: 'Aguinaldo ' + sv347EmpNombre(empKey) + ' — ' + sv347SemLbl(semKey) + ' (recuperado)',
          categoria: 'Personal',
          monto: monto,
          montoPagado: monto,
          medio: 'Transferencia',
          estado: 'Pagado',
          empleadoFbKey: empKey,
          empleadoNombre: sv347EmpNombre(empKey),
          semestre: semKey,
          mejorSueldo: r.mejorSueldo || 0,
          ts: r.ts || 0
        });
      });
    });
    return base.sort(function(a,b){
      var fa = _normFechaGasto(a.fecha||'') || '0000-00-00';
      var fb = _normFechaGasto(b.fecha||'') || '0000-00-00';
      if (fa !== fb) return fb.localeCompare(fa);
      return (Number(b.ts)||0) - (Number(a.ts)||0);
    });
  }
  function sv347StartAguListener(){
    if (sv347AguListenerStarted || !window.fbDB || !window.fbOnValue) return;
    sv347AguListenerStarted = true;
    window.fbOnValue(window.fbRef(window.fbDB, 'sisventas/aguinaldos'), function(snap){
      sv347AguinaldosData = snap.val() || {};
      try { if (typeof renderTablaGastos === 'function') renderTablaGastos(); } catch(e){}
    });
  }

  var oldFbCargarGastos = window.fbCargarGastos;
  window.fbCargarGastos = function(){
    var r = oldFbCargarGastos ? oldFbCargarGastos.apply(this, arguments) : undefined;
    sv347StartAguListener();
    return r;
  };
  if (window.fbDB) setTimeout(sv347StartAguListener, 500);

  var oldEliminar = window.eliminarRegistro;
  window.eliminarRegistro = function(coleccion, fbKey){
    if (coleccion === 'gastos' && String(fbKey||'').indexOf('aguinaldo_recuperado__') === 0) {
      var m = String(fbKey).match(/^aguinaldo_recuperado__(.+)__(\d{4}_S[12])$/);
      if (!m) { notify('No se pudo identificar el aguinaldo recuperado'); return; }
      if (!confirm('¿Eliminar esta marca de aguinaldo recuperada? Esto la quitará de sisventas/aguinaldos.')) return;
      if (!window.fbDB) { notify('Sin conexión'); return; }
      window.fbRemove(window.fbRef(window.fbDB, 'sisventas/aguinaldos/' + m[1] + '/' + m[2]))
        .then(function(){ notify('Aguinaldo recuperado eliminado'); })
        .catch(function(e){ notify('Error al eliminar: ' + e.message); });
      return;
    }
    return oldEliminar ? oldEliminar.apply(this, arguments) : undefined;
  };

  function sv347InjectFecha(){
    var modal = document.getElementById('modal-aguinaldo');
    if (!modal || document.getElementById('agu-fecha-registro')) return;
    var semSel = document.getElementById('agu-sem-sel');
    if (!semSel || !semSel.parentElement) return;
    var box = document.createElement('div');
    box.id = 'agu-fecha-box-347';
    box.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap';
    box.innerHTML = '<label style="font-size:13px;color:var(--text2);white-space:nowrap">Fecha de registro:</label>' +
      '<input type="date" id="agu-fecha-registro" value="' + sv347Today() + '" ' +
      'style="padding:6px 10px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg);color:var(--text);font-size:13px;font-family:inherit">';
    semSel.parentElement.insertBefore(box, semSel.nextSibling);
  }
  document.addEventListener('sisventas:payroll-modal-opened',function(){ setTimeout(sv347InjectFecha,0); });

  function sv347EmpleadoSeleccionado(key){
    var chk = document.querySelector('.agu-check-322[data-key="' + String(key || '').replace(/"/g,'\\"') + '"]');
    return !chk || chk.checked;
  }
  async function sv347HaySacRegistrado(empleados, semKey, semLbl){
    var empKeys = new Set((empleados||[]).map(function(e){ return String(e.fbKey||''); }));
    var gastos = sv347GastosExtendidos();
    var porGastos = gastos.some(function(g){
      if (!sv347EsGastoSac(g)) return false;
      var emp = String(g.empleadoFbKey || g.empleadoId || g.empFbKey || '');
      if (!empKeys.has(emp)) return false;
      if (String(g.semestre||'') === String(semKey)) return true;
      return sv347Norm(g.descripcion||'').indexOf(sv347Norm(semLbl)) >= 0;
    });
    if (porGastos) return true;
    var snap = await window.fbGet(window.fbRef(window.fbDB, 'sisventas/aguinaldos'));
    var data = snap.val() || {};
    return (empleados||[]).some(function(e){ return data[e.fbKey] && data[e.fbKey][semKey]; });
  }

})();
