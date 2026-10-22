(function(root) {
  'use strict';
  var pending = new Map();
  function failure(message) { return Object.assign(new Error(message), { code: 'SV_LEGACY_SAC_UNAVAILABLE', svLaborAttempted: false }); }
  function capture() {
    var uid = root.currentUserUid, user = root.fbAuth?.currentUser, role = root.currentRole;
    var epoch = root._svOperacionesSesionEpoch || 0, revision = root.PERMISOS_ROLES?.[role]?.indiceRevision;
    var context = root.svCapturarContextoOperacion?.(), route = root.location?.hash;
    function check() {
      if (!uid || !user || user.uid !== uid || root.currentUserUid !== uid || root.fbAuth?.currentUser !== user ||
          role !== 'admin' || root.currentRole !== role || root._impersonacionOriginal ||
          (root._svOperacionesSesionEpoch || 0) !== epoch || root.PERMISOS_ROLES?.[role]?.indiceRevision !== revision ||
          typeof context !== 'function' || !context() || root.location?.hash !== route ||
          typeof root.tienePermiso !== 'function' || !root.tienePermiso('mantenimiento.migrar')) throw failure('La sesión o el permiso de mantenimiento cambió. Volvé a revisar la migración.');
    }
    check(); return check;
  }
  function localDate(now) { return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0'); }
  function migrateMany(sourcePaths) {
    if (!Array.isArray(sourcePaths) || !sourcePaths.length || sourcePaths.some(function(path) { return typeof path !== 'string'; })) return Promise.reject(failure('No se identificaron los SAC históricos seleccionados.'));
    var selectedPaths = Object.freeze(sourcePaths.slice());
    var identity = JSON.stringify(selectedPaths);
    if (pending.has(identity)) return pending.get(identity);
    var promise = Promise.resolve().then(async function() {
      var check = capture(), model = root.SVPayrollLegacySACModel;
      if (!model || typeof root.SVLaborWrites?.atomic !== 'function' || !root.fbDB) throw failure('Actualizá la aplicación para migrar SAC con su origen comprobado.');
      var paths = model.pathsFor(selectedPaths), descriptors = selectedPaths.map(model.describe), now = new (root.Date || Date)();
      var fallbackDate = typeof root.svFechaLocalISO === 'function' ? root.svFechaLocalISO(now) : localDate(now);
      var stamp = now.getTime(), latest;
      var employees = Object.values(root.empData || {});
      var names = descriptors.map(function(descriptor) {
        var employee = employees.find(function(row) { return row && String(row.fbKey || row.id || '') === descriptor.employeeId; });
        return employee?.nombre || '';
      });
      var result = await root.SVLaborWrites.atomic({ paths: paths, purpose: model.PURPOSE,
        build: function(values) {
          check();
          latest = model.planBatch({ entries: descriptors.map(function(descriptor, index) {
            return { sourcePath: descriptor.sourcePath, source: model.readSource(values, descriptor.sourcePath), employeeName: names[index] };
          }), gastos: values['sisventas/gastos'], fallbackDate: fallbackDate, stamp: stamp });
          return Object.keys(latest.patch).length ? latest.patch : undefined;
        }
      });
      var unchanged = !!latest && Object.keys(latest.patch).length === 0;
      return { createdCount: result?.committed ? latest?.createdCount || 0 : 0, committed: result?.committed === true || unchanged,
        unchanged: unchanged, expenseKeys: latest?.plans.map(function(plan) { return plan.expenseKey; }) || [] };
    }).finally(function() { if (pending.get(identity) === promise) pending.delete(identity); });
    pending.set(identity, promise);
    return promise;
  }
  function migrate(sourcePath) {
    return migrateMany([sourcePath]).then(function(result) { return Object.assign({}, result, { created: result.createdCount === 1, expenseKey: result.expenseKeys[0] }); });
  }
  root.SVPayrollLegacySAC = Object.freeze({ migrate: migrate, migrateMany: migrateMany });
})(window);
