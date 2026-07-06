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

  window.gastosFiltradosActuales = function(){
    var fTipo   = (document.getElementById('gas-f-tipo')||{}).value   || '';
    var fEstado = (document.getElementById('gas-f-estado')||{}).value || '';
    var fMes    = (document.getElementById('gas-f-mes')||{}).value;
    if (fMes === undefined) fMes = 'mes';
    var inp = document.querySelector('#gasto-list input.search-input');
    var fBusq = inp ? String(inp.value||'').toLowerCase() : '';
    var hoyD = new Date();
    var mesActual = hoyD.toISOString().slice(0,7);
    var mes3m = (function(){ var d=new Date(hoyD); d.setMonth(d.getMonth()-2); return d.toISOString().slice(0,7); })();
    var anioActual = String(hoyD.getFullYear());

    return sv347GastosExtendidos().filter(function(g){
      var tipoNorm   = normalizarTipoGasto(g);
      var estadoNorm = normalizarEstadoGasto(g);
      var matchTipo   = !fTipo   || tipoNorm === fTipo || (fTipo === 'Fijo' && tipoNorm === 'aguinaldo');
      var matchEstado = !fEstado || estadoNorm === fEstado;
      var txt = ((g.descripcion||'') + ' ' + (g.categoria||'') + ' ' + (g.semestre||'')).toLowerCase();
      var matchBusq   = !fBusq || txt.includes(fBusq);
      var matchMes = true;
      var f = _normFechaGasto(g.fecha);
      if (fMes === 'mes') matchMes = f.slice(0,7) === mesActual;
      else if (fMes === '3m') matchMes = f.slice(0,7) >= mes3m;
      else if (fMes === 'anio') matchMes = f.slice(0,4) === anioActual;
      var matchKpiVence = true;
      if (window._filtroGastosKpiVence) {
        var venc = g.vencimiento || '';
        matchKpiVence = venc >= window._filtroGastosKpiVence.desde && venc <= window._filtroGastosKpiVence.hasta;
      }
      var matchKpiReembolso = true;
      if (window._filtroGastosKpiReembolso) {
        matchKpiReembolso = !!(g.empleadoId && normalizarEstadoGasto(g) !== 'pagado' && !g.reembolsado);
      }
      return matchTipo && matchEstado && matchBusq && matchMes && matchKpiVence && matchKpiReembolso;
    });
  };

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
  var oldAbrirAgu = window.abrirModalAguinaldo;
  window.abrirModalAguinaldo = async function(){
    var r = oldAbrirAgu ? await oldAbrirAgu.apply(this, arguments) : undefined;
    setTimeout(sv347InjectFecha, 0);
    return r;
  };

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

  window.confirmarRegistroAguinaldo = async function(){
    if (!window.fbDB) { notify('Sin conexión'); return; }
    var sel = document.getElementById('agu-sem-sel');
    var actual = (typeof _semestreActual === 'function') ? _semestreActual() : { anio: new Date().getFullYear(), sem: (new Date().getMonth() < 6 ? 1 : 2) };
    var partes = sel ? String(sel.value || '').split('-') : [String(actual.anio), String(actual.sem)];
    var anio = parseInt(partes[0], 10);
    var sem  = parseInt(partes[1], 10);
    var semKey = anio + '_S' + sem;
    var semLbl = (sem === 1 ? '1er semestre' : '2do semestre') + ' ' + anio;
    var fechaInp = document.getElementById('agu-fecha-registro');
    var fechaGasto = (fechaInp && fechaInp.value) ? fechaInp.value : sv347Today();
    var empleados = sv347Arr(window.empData || {}).filter(function(e){ return e && e.activo !== false && e.fbKey && sv347EmpleadoSeleccionado(e.fbKey); });
    if (!empleados.length) { notify('Seleccioná al menos un empleado'); return; }

    try {
      var ya = await sv347HaySacRegistrado(empleados, semKey, semLbl);
      if (ya) {
        if (!confirm('Ya existe aguinaldo registrado para uno o más empleados en ' + semLbl + '. Si está mal, podés verlo en Gastos > Este año/Todo y eliminarlo. ¿Registrar de nuevo de todas formas?')) return;
      }
      var habSnap = await window.fbGet(window.fbRef(window.fbDB, 'sisventas/haberes'));
      var habData = habSnap.val() || {};
      var filas = (typeof _calcularFilasAguinaldo === 'function') ? _calcularFilasAguinaldo(empleados, habData, anio, sem) : [];
      var promesas = [];
      var contador = 0;
      filas.forEach(function(f){
        if (!f || !f.e || !f.e.fbKey || Number(f.aguinaldo || 0) <= 0) return;
        var e = f.e;
        var desc = 'Aguinaldo ' + (e.nombre || '') + ' — ' + semLbl;
        var gasto = {
          fecha: fechaGasto,
          tipo: 'aguinaldo',
          descripcion: desc,
          categoria: 'Personal',
          monto: Number(f.aguinaldo || 0),
          montoPagado: Number(f.aguinaldo || 0),
          medio: 'Transferencia',
          estado: 'Pagado',
          empleadoFbKey: e.fbKey,
          empleadoNombre: e.nombre || '',
          semestre: semKey,
          mejorSueldo: Number(f.mejorSueldo || 0),
          origen: 'SAC',
          ts: Date.now()
        };
        promesas.push(window.fbPush(window.fbRef(window.fbDB, 'sisventas/gastos'), gasto));
        promesas.push(window.fbSet(window.fbRef(window.fbDB, 'sisventas/aguinaldos/' + e.fbKey + '/' + semKey), {
          semestre: semKey,
          mejorSueldo: Number(f.mejorSueldo || 0),
          aguinaldo: Number(f.aguinaldo || 0),
          fecha: fechaGasto,
          registradoPor: window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : 'Admin'),
          fuenteValidacion: 'gastos',
          ts: Date.now()
        }));
        promesas.push(window.fbPush(window.fbRef(window.fbDB, 'sisventas/ctaemp/' + e.fbKey), {
          tipo: 'aguinaldo',
          descripcion: 'Aguinaldo ' + semLbl,
          monto: Number(f.aguinaldo || 0),
          fecha: fechaGasto,
          estado: 'pendiente',
          semestre: semKey,
          mejorSueldo: Number(f.mejorSueldo || 0),
          empleadoId: e.fbKey,
          ts: Date.now()
        }));
        contador++;
      });
      if (!contador) { notify('No hay importes de aguinaldo para registrar'); return; }
      await Promise.all(promesas);
      var modal = document.getElementById('modal-aguinaldo');
      if (modal) modal.remove();
      notify('✓ Aguinaldo de ' + semLbl + ' registrado con fecha ' + fechaGasto + ' (' + contador + ' empleados)');
      if (typeof registrarActividad === 'function') registrarActividad('Aguinaldo registrado', semLbl + ' — ' + contador + ' empleados');
    } catch(err) {
      notify('Error al registrar aguinaldo: ' + (err && err.message ? err.message : err));
    }
  };
})();
