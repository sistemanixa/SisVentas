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
  window.confirmarRegistroAguinaldo = async function(){
    if (!window.fbDB) { notify('Sin conexión'); return; }
    var sel = document.getElementById('agu-sem-sel');
    var actual = (typeof _semestreActual === 'function') ? _semestreActual() : { anio: new Date().getFullYear(), sem: (new Date().getMonth() < 6 ? 1 : 2) };
    var partes = sel ? String(sel.value || '').split('-') : [String(actual.anio), String(actual.sem)];
    var anio = parseInt(partes[0], 10);
    var sem  = parseInt(partes[1], 10);
    var semKey = anio + '_S' + sem;
    var semLbl = (sem === 1 ? '1er semestre' : '2do semestre') + ' ' + anio;
    var fechaGasto = sem === 1 ? anio + '-06-30' : anio + '-12-18';
    var empleados = sv346Activos().filter(function(e){ return e && e.fbKey && sv346EmpleadoSeleccionado(e.fbKey); });
    if (!empleados.length) { notify('Seleccioná al menos un empleado'); return; }

    try {
      var yaRegistradoReal = await sv346HaySacRealRegistrado(empleados, semKey, semLbl);
      if (yaRegistradoReal) {
        if (!confirm('Ya existe aguinaldo registrado en Gastos para uno o más empleados en ' + semLbl + '. ¿Registrar de nuevo de todas formas?')) return;
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
        promesas.push(sv346ActualizarMarcaAguinaldo(e, semKey, {
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
      notify('✓ Aguinaldo de ' + semLbl + ' registrado (' + contador + ' empleados)');
      if (typeof registrarActividad === 'function') registrarActividad('Aguinaldo registrado', semLbl + ' — ' + contador + ' empleados');
      if (typeof renderGastos === 'function') renderGastos();
    } catch(err) {
      notify('Error al registrar aguinaldo: ' + (err && err.message ? err.message : err));
    }
  };
})();
