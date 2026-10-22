(function(root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SVPayrollPendingReview = api.create(root);
    root.revisarHaberesPendientes = function() { return root.SVPayrollPendingReview.review(); };
  }
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';
  var PERMISSION = 'empleados.avisarHaberes';
  var BUTTON_ID = 'btn-revisar-haberes';
  var MAX_CONCURRENT = 6;

  function previousMonth(date) {
    if (!date || !Number.isFinite(date.getTime())) throw new Error('Fecha local inválida');
    var month = date.getMonth(), year = date.getFullYear();
    if (month === 0) { month = 12; year -= 1; }
    return { key: String(year) + '_' + String(month).padStart(2, '0'),
      label: new Date(year, month - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) };
  }

  function employeeList(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Directorio no disponible');
    var rows = Object.values(data).filter(function(row) { return row && row.activo !== false && row.cargoId; });
    var keys = new Set();
    return rows.map(function(row) {
      var key = row.fbKey;
      if (typeof key !== 'string' || !key || key.trim() !== key || /[.#$\[\]\/\u0000-\u001f\u007f]/.test(key) || keys.has(key)) {
        throw new Error('Referencia de empleado inválida');
      }
      keys.add(key);
      return { key: key, name: String(row.nombre || 'Empleado'), cargoId: row.cargoId };
    });
  }

  function create(root) {
    var running = null;
    function allowed() { return typeof root.tienePermiso === 'function' && root.tienePermiso(PERMISSION); }
    function status(message) {
      var node = root.document && root.document.getElementById('emp-haberes-review-status');
      if (!node) return;
      node.textContent = message || '';
      node.hidden = !message;
    }
    function notice(message) { status(message); if (typeof root.notify === 'function') root.notify(message, 8000); }
    function visible() { return !root.document || root.document.hidden !== true; }
    function route() { return root.location ? String(root.location.hash || '') : ''; }
    function directorySignature() {
      return JSON.stringify(employeeList(root.empData).map(function(row) { return [row.key, row.name, row.cargoId]; }));
    }
    function cancel() { status(''); if (running) { running.cancelled = true; running.controller.abort(); } }

    // These listeners only cancel a user-requested review; they never start I/O.
    if (root.document && typeof root.document.addEventListener === 'function') {
      ['sisventas:session-ended', 'sisventas:role-changed', 'sisventas:page-changed', 'sisventas:foreground-paused'].forEach(function(event) {
        root.document.addEventListener(event, cancel);
      });
      root.document.addEventListener('visibilitychange', function() { if (!visible()) cancel(); });
    }
    if (typeof root.addEventListener === 'function') root.addEventListener('hashchange', cancel);

    function contextCurrent(operation) {
      var same = visible() && route() === operation.route &&
        root.currentUserUid === operation.uid && root.fbAuth && root.fbAuth.currentUser === operation.user &&
        root.currentRole === operation.role && (root._svOperacionesSesionEpoch || 0) === operation.epoch &&
        !root._impersonacionOriginal && allowed() && root._empleadosDatosListos === true && !root._empleadosCargaError;
      var revision = root.PERMISOS_ROLES && root.PERMISOS_ROLES[operation.role];
      same = same && (revision && revision.indiceRevision) === operation.revision;
      if (same) {
        try { same = directorySignature() === operation.directory; } catch (_) { same = false; }
      }
      return same;
    }

    function assertCurrent(operation) {
      if (!contextCurrent(operation)) {
        operation.cancelled = true;
        operation.controller.abort();
        throw new Error('Revisión cancelada por cambio de contexto');
      }
      if (operation.cancelled || operation.controller.signal.aborted) throw new Error('Revisión interrumpida');
    }

    function wait(promise, signal) {
      return new Promise(function(resolve, reject) {
        function abort() { cleanup(); reject(new Error('Revisión interrumpida')); }
        function cleanup() { signal.removeEventListener('abort', abort); }
        if (signal.aborted) { abort(); return; }
        signal.addEventListener('abort', abort, { once: true });
        Promise.resolve(promise).then(function(value) { cleanup(); resolve(value); }, function() {
          cleanup(); reject(new Error('No se pudo completar la revisión'));
        });
      });
    }

    async function readMonth(operation, employee, month, token) {
      assertCurrent(operation);
      var path = 'sisventas/haberes/' + employee.key + '/' + month.key;
      var reference = root.fbRef(root.fbDB, path);
      var url = new URL(String(reference).replace(/\/$/, '') + '.json');
      // A Firebase reference supplies the origin; only this exact leaf is read.
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
          decodeURIComponent(url.pathname) !== '/' + path + '.json') throw new Error('Referencia de lectura inválida');
      url.searchParams.set('auth', token);
      var response = await wait(root.fetch(url.href, { method: 'GET', cache: 'no-store', credentials: 'omit',
        redirect: 'error', signal: operation.controller.signal }), operation.controller.signal);
      assertCurrent(operation);
      if (!response || !response.ok) throw new Error('No se pudo verificar el mes con el servidor');
      var value = await wait(response.json(), operation.controller.signal);
      assertCurrent(operation);
      if (value !== null && (typeof value !== 'object' || Array.isArray(value))) throw new Error('Respuesta de haberes inválida');
      return value === null;
    }

    function buttonBusy() {
      var button = root.document && root.document.getElementById(BUTTON_ID);
      if (!button) return function() {};
      var html = button.innerHTML, disabled = button.disabled, busy = button.getAttribute('aria-busy');
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      var animation = typeof root.matchMedia === 'function' && root.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'none' : 'spin .8s linear infinite';
      button.innerHTML = '<span aria-hidden="true" style="display:inline-block;flex:0 0 12px;width:12px;height:12px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:' + animation + '"></span> Revisando haberes…';
      return function() {
        button.innerHTML = html;
        button.disabled = disabled;
        if (busy === null) button.removeAttribute('aria-busy'); else button.setAttribute('aria-busy', busy);
      };
    }

    async function review() {
      if (running) return running.promise;
      if (!allowed()) { notice('No tenés permiso para revisar los haberes pendientes.'); return { status: 'denied' }; }
      var today = new (root.Date || Date)();
      if (today.getDate() < 1 || today.getDate() > 5) {
        notice('La revisión de haberes del mes anterior está disponible del 1 al 5 de cada mes.');
        return { status: 'outside-window' };
      }
      if (!visible()) return { status: 'cancelled' };
      if (root._empleadosDatosListos !== true || root._empleadosCargaError) {
        notice('No se pudo revisar: esperá a que termine de cargar el listado de empleados o volvé a intentar si falló.');
        return { status: 'directory-unavailable' };
      }
      var user = root.fbAuth && root.fbAuth.currentUser, uid = root.currentUserUid;
      if (!user || !uid || user.uid !== uid || root._impersonacionOriginal || !root.fbDB || typeof root.fbRef !== 'function' ||
          typeof root.fetch !== 'function' || !root.AbortController || !root.AbortSignal || typeof root.AbortSignal.timeout !== 'function') {
        notice('No se pudo verificar la sesión para revisar haberes. Volvé a ingresar e intentá de nuevo.');
        return { status: 'unavailable' };
      }
      var employees, month;
      try { employees = employeeList(root.empData); month = previousMonth(today); }
      catch (_) { notice('No se pudo revisar: el listado de empleados tiene referencias incompletas.'); return { status: 'directory-unavailable' }; }
      if (!employees.length) {
        notice('No hay empleados activos con cargo para revisar los haberes de ' + month.label + '.');
        return { status: 'no-employees', month: month.key };
      }
      var role = root.currentRole, revision = root.PERMISOS_ROLES && root.PERMISOS_ROLES[role];
      var operation = { uid: uid, user: user, role: role, revision: revision && revision.indiceRevision,
        epoch: root._svOperacionesSesionEpoch || 0, route: route(), directory: directorySignature(),
        controller: new root.AbortController(), cancelled: false, failed: false };
      var restoreButton = buttonBusy();
      status('Revisando los haberes de ' + month.label + '…');
      var deadline = root.AbortSignal.timeout(20000);
      function timeout() { operation.failed = true; operation.controller.abort(); }
      deadline.addEventListener('abort', timeout, { once: true });
      running = operation;
      operation.promise = (async function() {
        try {
          assertCurrent(operation);
          var token = await wait(user.getIdToken(), operation.controller.signal);
          assertCurrent(operation);
          if (typeof token !== 'string' || !token) throw new Error('Sesión no disponible');
          var next = 0, pending = [];
          async function worker() {
            while (next < employees.length && !operation.failed) {
              assertCurrent(operation);
              var employee = employees[next++];
              try { if (await readMonth(operation, employee, month, token)) pending.push(employee); }
              catch (error) { operation.failed = true; operation.controller.abort(); throw error; }
            }
          }
          var results = await Promise.allSettled(Array.from({ length: Math.min(MAX_CONCURRENT, employees.length) }, worker));
          if (results.some(function(result) { return result.status === 'rejected'; })) throw new Error('Revisión incompleta');
          assertCurrent(operation);
          // Preserve employee ordering even when leaf responses arrive out of order.
          var pendingKeys = new Set(pending.map(function(employee) { return employee.key; }));
          pending = employees.filter(function(employee) { return pendingKeys.has(employee.key); });
          if (pending.length) {
            var names = pending.slice(0, 3).map(function(employee) { return employee.name; }).join(', ');
            if (pending.length > 3) names += ' y ' + (pending.length - 3) + ' más';
            notice('No se registraron los haberes de ' + month.label + ' para ' + pending.length + ' empleado' +
              (pending.length !== 1 ? 's' : '') + ' (' + names + '). Ir a Empleados → Haberes.');
          } else notice('Los haberes de ' + month.label + ' están registrados para los ' + employees.length + ' empleados revisados.');
          return { status: 'complete', month: month.key, checked: employees.length, pending: pending.map(function(employee) { return employee.key; }) };
        } catch (_) {
          if (operation.cancelled || !contextCurrent(operation)) { status(''); return { status: 'cancelled' }; }
          // Errors are never presented as an empty pending list or logged with authenticated URLs.
          notice('No se pudo completar la revisión de ' + month.label + '. No se confirmó cuántos haberes faltan. Volvé a intentar.');
          return { status: 'error', month: month.key };
        } finally {
          deadline.removeEventListener('abort', timeout);
          if (running === operation) running = null;
          restoreButton();
        }
      })();
      return operation.promise;
    }
    return Object.freeze({ review: review, cancel: cancel });
  }
  return Object.freeze({ create: create, previousMonth: previousMonth });
});
