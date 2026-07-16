/* ══════════════════════════════════════════════════════════════════════════════
   v20.362 — Fuente única definitiva para SAC y Horas Extra
   - Gastos queda como única fuente real de registros pagables.
   - Las ramas legacy se migran una sola vez a Gastos.
   - El alta nueva de SAC y aprobación de Hs Extra ya NO escribe en aguinaldos/ctaemp.
   ══════════════════════════════════════════════════════════════════════════════ */
(function(){
  function _sv348Today(){
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function _sv348Arr(obj){
    return Object.keys(obj || {}).map(function(k){ var v = obj[k] || {}; if (v && typeof v === 'object' && !v.fbKey) v.fbKey = k; return v; });
  }
  function _sv348Norm(v){ return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function _sv348EmpleadoSeleccionado(key){
    if (window.aguSelKeys322 && typeof window.aguSelKeys322.has === 'function') return window.aguSelKeys322.has(key);
    var chk = document.querySelector('.agu-check-322[data-key="' + String(key || '').replace(/"/g,'\\"') + '"]');
    return !chk || chk.checked;
  }
  function _sv348EsSacGasto(g, empKey, semKey, semLbl){
    if (!g || g.anulado === true || _sv348Norm(g.estado) === 'anulado') return false;
    var emp = String(g.empleadoFbKey || g.empleadoId || g.empFbKey || '');
    if (String(empKey || '') && emp && emp !== String(empKey || '')) return false;
    var tp = _sv348Norm(g.tipoPagable || '');
    var desc = _sv348Norm(g.descripcion || g.concepto || '');
    var cat = _sv348Norm(g.categoria || '');
    var esSac = tp === 'aguinaldo' || desc.indexOf('aguinaldo') >= 0 || desc.indexOf('sac') >= 0;
    if (!esSac || (cat && cat !== 'personal' && desc.indexOf('aguinaldo') < 0 && desc.indexOf('sac') < 0)) return false;
    if (String(g.semestre || '') === String(semKey || '')) return true;
    return semLbl && desc.indexOf(_sv348Norm(semLbl)) >= 0;
  }
  function _sv348ExisteSacEnGastos(empleados, semKey, semLbl){
    var keys = new Set((empleados || []).map(function(e){ return String(e.fbKey || ''); }));
    return (window.gastosData || gastosData || []).some(function(g){
      var emp = String(g.empleadoFbKey || g.empleadoId || g.empFbKey || '');
      return keys.has(emp) && _sv348EsSacGasto(g, emp, semKey, semLbl);
    });
  }

  // Gastos debe mostrar solamente gastos reales; los legacy se migran a registros reales.
  window.gastosFiltradosActuales = function() {
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
    return (window.gastosData || gastosData || []).filter(function(g){
      var tipoNorm   = normalizarTipoGasto(g);
      var estadoNorm = normalizarEstadoGasto(g);
      var matchTipo   = !fTipo   || tipoNorm === fTipo;
      var matchEstado = !fEstado || estadoNorm === fEstado;
      var txt = ((g.descripcion||'') + ' ' + (g.categoria||'') + ' ' + (g.semestre||'') + ' ' + (g.empleadoNombre||'')).toLowerCase();
      var matchBusq   = !fBusq || txt.includes(fBusq);
      var matchMes = true;
      var f = (typeof _normFechaGasto === 'function') ? _normFechaGasto(g.fecha) : (g.fecha || '');
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

  document.addEventListener('sisventas:payroll-modal-opened',function(){
    setTimeout(function(){
      var viejo = document.getElementById('agu-fecha-box-347');
      if (viejo) viejo.remove();
      var fecha = document.getElementById('agu-fecha');
      if (fecha && !fecha.value) fecha.value = _sv348Today();
    }, 20);
  });

  window.confirmarRegistroAguinaldo = async function(){
    if (!window.fbDB) { notify('Sin conexión'); return; }
    var sel = document.getElementById('agu-sem-sel');
    var actual = (typeof _semestreActual === 'function') ? _semestreActual() : { anio: new Date().getFullYear(), sem: (new Date().getMonth() < 6 ? 1 : 2) };
    var partes = sel ? String(sel.value || '').split('-') : [String(actual.anio), String(actual.sem)];
    var anio = parseInt(partes[0], 10);
    var sem  = parseInt(partes[1], 10);
    var semKey = anio + '_S' + sem;
    var semLbl = (sem === 1 ? '1er semestre' : '2do semestre') + ' ' + anio;
    var fechaInp = document.getElementById('agu-fecha');
    var fechaGasto = (fechaInp && fechaInp.value) ? fechaInp.value : _sv348Today();
    var empleados = _sv348Arr(window.empData || empData || {}).filter(function(e){ return e && e.activo !== false && e.fbKey && _sv348EmpleadoSeleccionado(e.fbKey); });
    if (!empleados.length) { notify('Seleccioná al menos un empleado'); return; }
    try {
      if (_sv348ExisteSacEnGastos(empleados, semKey, semLbl)) {
        if (!confirm('Ya existe aguinaldo registrado en Gastos para uno o más empleados en ' + semLbl + '. Si está mal, eliminá ese gasto. ¿Registrar de nuevo de todas formas?')) return;
      }
      var habSnap = await window.fbGet(window.fbRef(window.fbDB, 'sisventas/haberes'));
      var habData = habSnap.val() || {};
      var filas = (typeof _calcularFilasAguinaldo === 'function') ? _calcularFilasAguinaldo(empleados, habData, anio, sem) : [];
      var promesas = [];
      var contador = 0;
      var tsBase = Date.now();
      filas.forEach(function(f, idx){
        if (!f || !f.e || !f.e.fbKey || Number(f.aguinaldo || 0) <= 0) return;
        var e = f.e;
        var gasto = (typeof _pagableGastoBase === 'function') ? _pagableGastoBase({
          fecha: fechaGasto, tipo:'Fijo', tipoPagable:'aguinaldo',
          descripcion:'Aguinaldo ' + (e.nombre || '') + ' — ' + semLbl,
          monto:Number(f.aguinaldo || 0), empleadoFbKey:e.fbKey, empleadoNombre:e.nombre || '',
          semestre:semKey, mejorSueldo:Number(f.mejorSueldo || 0), legacyKey:'sac_nuevo/' + e.fbKey + '/' + semKey + '/' + tsBase, ts:tsBase + idx
        }) : {
          fecha: fechaGasto, tipo:'Fijo', tipoPagable:'aguinaldo', descripcion:'Aguinaldo ' + (e.nombre || '') + ' — ' + semLbl,
          categoria:'Personal', monto:Number(f.aguinaldo || 0), medio:'Transferencia', estado:'Pendiente', empleadoId:e.fbKey,
          empleadoFbKey:e.fbKey, empleadoNombre:e.nombre || '', semestre:semKey, mejorSueldo:Number(f.mejorSueldo || 0), ts:tsBase + idx
        };
        promesas.push(window.fbPush(window.fbRef(window.fbDB, 'sisventas/gastos'), gasto));
        contador++;
      });
      if (!contador) { notify('No hay importes de aguinaldo para registrar'); return; }
      await Promise.all(promesas);
      var modal = document.getElementById('modal-aguinaldo');
      if (modal) modal.remove();
      notify('✓ Aguinaldo de ' + semLbl + ' registrado en Gastos con fecha ' + fechaGasto + ' (' + contador + ' empleados)');
      if (typeof registrarActividad === 'function') registrarActividad('Aguinaldo registrado en Gastos', semLbl + ' — ' + contador + ' empleados');
    } catch(err) {
      notify('Error al registrar aguinaldo: ' + (err && err.message ? err.message : err));
    }
  };
})();
