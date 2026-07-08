(function(){
  window.SisVentas = window.SisVentas || {};
  var SV = window.SisVentas;
  SV.State = SV.State || {};
  SV.Cache = SV.Cache || {};
  SV.Security = SV.Security || {};
  SV.Audit = SV.Audit || {};
  SV.Utils = SV.Utils || {};

  function normRol(){ return String(window.currentRole || '').toLowerCase().trim(); }
  function arr(v){ return Array.isArray(v) ? v : Object.values(v || {}); }
  function isAdmin(){ return normRol() === 'admin'; }
  function isAdm(){ return normRol() === 'administrativo'; }
  function moduleAllowed(mod){
    if (!mod) return false;
    if (isAdmin()) return true;
    var role = normRol();
    if (!role) return false;
    var cfg = ((window.PERMISOS_ROLES || {})[role] || (window.PERMISOS_DEFAULT || {})[role]);
    if (!cfg) return false;
    return (cfg.bloqueados || []).indexOf(mod) === -1;
  }
  var PERMISOS_ACCION = {
    'ventas.verDashboard':       { modulo:'detalle', admin:true },
    'ventas.ver':                { modulo:'detalle' },
    'ventas.crear':              { modulo:'venta' },
    'ventas.editar':             { modulo:'detalle', roles:['admin','administrativo'] },
    'ventas.eliminar':           { modulo:'detalle', admin:true },
    'ventas.moverPresupuesto':   { modulo:'detalle', roles:['admin','administrativo'] },
    'ventas.contadoSinFactura':  { modulo:'detalle', admin:true },
    'cobranzas.verDashboard':    { modulo:'cobranzas', admin:true },
    'cobranzas.ver':             { modulo:'cobranzas' },
    'cobranzas.registrar':       { modulo:'cobranzas', roles:['admin','administrativo'] },
    'cobranzas.anular':          { modulo:'cobranzas', admin:true },
    'tesoreria.ver':             { modulo:'tesoreria' },
    'tesoreria.pagar':           { modulo:'tesoreria', roles:['admin','administrativo'] },
    'productos.editar':          { modulo:'productos', roles:['admin','administrativo'] },
    'productos.eliminar':        { modulo:'productos', admin:true },
    'clientes.editar':           { modulo:'clientes', roles:['admin','administrativo'] },
    'clientes.eliminar':         { modulo:'clientes', admin:true },
    'presupuestos.editar':       { modulo:'presupuesto', roles:['admin','administrativo'] },
    'presupuestos.eliminar':     { modulo:'presupuesto', admin:true },
    'presupuestos.anular':       { modulo:'presupuesto', admin:true },
    'ot.editar':                 { modulo:'ordentrabajo', roles:['admin','administrativo','tecnico'] },
    'ot.crear':                  { modulo:'ordentrabajo', roles:['admin','administrativo'] },
    'ot.eliminar':               { modulo:'ordentrabajo', admin:true },
    'empleados.eliminar':        { modulo:'empleados', admin:true },
    'empleados.aprobarMovimiento': { modulo:'ctaemp', admin:true },
    'empleados.eliminarMovimiento': { modulo:'ctaemp', admin:true },
    'mantenimiento.migrar':       { modulo:'configuracion', admin:true },
    'mantenimiento.limpiar':      { modulo:'configuracion', admin:true },
    'mantenimiento.duplicados':   { modulo:'configuracion', admin:true },
    'actividad.limpiar':          { modulo:'configuracion', admin:true },
    'datos.seedDemo':             { modulo:'configuracion', admin:true },
    'configuracion.editar':      { modulo:'configuracion', admin:true },
    'registros.eliminar':        { admin:true, validar:function(ctx){
      var permitidas=['gastos','proveedores','ordenes','informes','equipos','usuarios','tickets','remitos','servicios','garantias'];
      return permitidas.indexOf(String((ctx.args||[])[0]||''))!==-1;
    } },
    'usuarios.impersonar':       { modulo:'usuarios', admin:true },
    'auditoria.ver':             { modulo:'configuracion', admin:true }
  };
  window.tienePermiso = SV.Security.tienePermiso = function(permiso, contexto){
    var regla = PERMISOS_ACCION[permiso];
    if (!regla) return false;
    if (regla.admin && !isAdmin()) return false;
    if (regla.roles && regla.roles.indexOf(normRol()) === -1) return false;
    if (regla.modulo && !moduleAllowed(regla.modulo)) return false;
    if (typeof regla.validar === 'function') return !!regla.validar(contexto || {});
    return true;
  };
  window.esAdminSV = SV.Security.esAdmin = isAdmin;
  window.esAdminOAdministrativoSV = SV.Security.esAdminOAdministrativo = function(){ return isAdmin() || isAdm(); };
  window.permisoModuloSV = SV.Security.permisoModulo = moduleAllowed;

  function proteger(nombre, permiso){
    var original=window[nombre];
    if(typeof original!=='function'||original._svPermisoProtegido) return;
    var protegida=function(){
      if(!window.tienePermiso(permiso,{args:Array.prototype.slice.call(arguments)})){
        if(typeof window.notify==='function') window.notify('No tenés permiso para realizar esta acción');
        console.warn('[Seguridad] Acción bloqueada:',permiso,nombre);
        return false;
      }
      return original.apply(this,arguments);
    };
    protegida._svPermisoProtegido=true;
    protegida._svOriginal=original;
    window[nombre]=protegida;
  }

  [
    ['registrarPago','cobranzas.registrar'],
    ['anularPago','cobranzas.anular'],
    ['elimPago','cobranzas.anular'],
    ['eliminarVenta','ventas.eliminar'],
    ['moverVentaAPresupuesto','ventas.moverPresupuesto'],
    ['toggleCSF','ventas.contadoSinFactura'],
    ['eliminarPptoDesdeTabla','presupuestos.eliminar'],
    ['eliminarPpto','presupuestos.eliminar'],
    ['anularPptoDesdeTabla','presupuestos.anular'],
    ['crearOT','ot.crear'],
    ['eliminarOT','ot.eliminar'],
    ['eliminarCliente','clientes.eliminar'],
    ['eliminarProducto','productos.eliminar'],
    ['eliminarEmpleado','empleados.eliminar'],
    ['aprobarComision','empleados.aprobarMovimiento'],
    ['rechazarComision','empleados.aprobarMovimiento'],
    ['aprobarMovEmp','empleados.aprobarMovimiento'],
    ['eliminarMovEmp','empleados.eliminarMovimiento'],
    ['mntMigrarLegacy','mantenimiento.migrar'],
    ['mntLimpiarLegacy','mantenimiento.limpiar'],
    ['mntEliminarDuplicadosGastosFijos','mantenimiento.duplicados'],
    ['limpiarLogActividad','actividad.limpiar'],
    ['fbSeedDatos','datos.seedDemo'],
    ['eliminarRegistro','registros.eliminar'],
    ['guardarConfigTFApp','configuracion.editar'],
    ['guardarTipoCambio','configuracion.editar'],
    ['guardarPreferenciasSistema','configuracion.editar'],
    ['guardarAlicuotaIVA','configuracion.editar'],
    ['guardarImpuestosGenerales','configuracion.editar'],
    ['guardarLogoEmpresa','configuracion.editar'],
    ['eliminarLogoEmpresa','configuracion.editar'],
    ['guardarDatosEmpresa','configuracion.editar'],
    ['guardarPermisosRoles','configuracion.editar'],
    ['restaurarPermisosDefault','configuracion.editar']
  ].forEach(function(item){ proteger(item[0],item[1]); });

  function safeString(v){
    try { return JSON.stringify(v, function(k,val){ if (typeof val === 'function') return undefined; if (String(k).toLowerCase().indexOf('pass') >= 0) return '***'; return val; }).slice(0, 9000); }
    catch(e){ return String(v || ''); }
  }
  SV.Audit.registrar = function(accion, detalle, antes, despues){
    var payload = detalle || '';
    if (antes !== undefined || despues !== undefined) payload = String(payload || '') + '\nAntes: ' + safeString(antes || {}) + '\nDespués: ' + safeString(despues || {});
    if (typeof window.registrarActividad === 'function') window.registrarActividad(accion, payload);
  };

  function getVentaActualEditando(){
    var k = window._ventaEditandoFbKey;
    if (!k) return null;
    return arr(window.ventasList || window.ventasData).find(function(v){ return v && (String(v.fbKey||'') === String(k) || String(v.id||'') === String(k)); }) || window._ventaEditandoOriginal || null;
  }

  var confirmarPrev311 = window.confirmarVenta;
  if (typeof confirmarPrev311 === 'function' && !confirmarPrev311._sv311) {
    window.confirmarVenta = function(){
      var editandoKey = window._ventaEditandoFbKey || '';
      var antes = editandoKey ? (window._ventaEditandoOriginal || getVentaActualEditando()) : null;
      document.dispatchEvent(new CustomEvent('sisventas:sale-before-confirm'));
      var r = confirmarPrev311.apply(this, arguments);
      setTimeout(function(){
        if (editandoKey) {
          var despues = arr(window.ventasList || window.ventasData).find(function(v){ return v && (String(v.fbKey||'') === String(editandoKey) || String(v.id||'') === String(editandoKey)); }) || null;
          SV.Audit.registrar('Venta editada', 'Venta ' + editandoKey, antes, despues);
        } else {
          SV.Audit.registrar('Venta creada', 'Confirmación de venta');
        }
      }, 900);
      return r;
    };
    window.confirmarVenta._sv311 = true;
  }

  var eliminarPrev311 = window.eliminarVenta;
  if (typeof eliminarPrev311 === 'function' && !eliminarPrev311._sv311) {
    window.eliminarVenta = function(fbKey){
      var antes = arr(window.ventasList || window.ventasData).find(function(v){ return v && (String(v.fbKey||'') === String(fbKey) || String(v.id||'') === String(fbKey)); }) || null;
      var r = eliminarPrev311.apply(this, arguments);
      setTimeout(function(){ SV.Audit.registrar('Venta eliminada/anulada', 'Venta ' + (fbKey || ''), antes, null); }, 800);
      return r;
    };
    window.eliminarVenta._sv311 = true;
  }

  var registrarPagoPrev311 = window.registrarPago;
  if (typeof registrarPagoPrev311 === 'function' && !registrarPagoPrev311._sv311) {
    window.registrarPago = function(){
      var venta = (document.getElementById('cob-venta') || {}).value || '';
      var monto = (document.getElementById('cob-monto') || {}).value || '';
      var medio = (document.getElementById('cob-medio') || {}).value || '';
      var r = registrarPagoPrev311.apply(this, arguments);
      setTimeout(function(){ SV.Audit.registrar('Cobro registrado', 'Venta: ' + venta + ' · Monto: ' + monto + ' · Medio: ' + medio); }, 700);
      return r;
    };
    window.registrarPago._sv311 = true;
  }

  var guardarProductoPrev311 = window.guardarProducto;
  if (typeof guardarProductoPrev311 === 'function' && !guardarProductoPrev311._sv311) {
    window.guardarProducto = function(){ var r = guardarProductoPrev311.apply(this, arguments); setTimeout(function(){ SV.Audit.registrar('Producto guardado', 'Alta o edición de producto'); }, 700); return r; };
    window.guardarProducto._sv311 = true;
  }

  var guardarPresupuestoPrev311 = window.guardarPresupuesto;
  if (typeof guardarPresupuestoPrev311 === 'function' && !guardarPresupuestoPrev311._sv311) {
    window.guardarPresupuesto = function(modo){ var r = guardarPresupuestoPrev311.apply(this, arguments); setTimeout(function(){ SV.Audit.registrar('Presupuesto guardado', 'Modo: ' + (modo || '')); }, 700); return r; };
    window.guardarPresupuesto._sv311 = true;
  }

  SV.Cache.get = function(nombre){
    if (nombre === 'ventas') return arr(window.ventasList || window.ventasData);
    if (nombre === 'clientes') return arr(window.clientesList || window.cliData || window.clientesData);
    if (nombre === 'productos') return arr(window.prodData || window.productosData);
    if (nombre === 'pagos') return arr(window.pagosData || window.pagosList);
    if (nombre === 'gastos') return arr(window.gastosData || window.gastosList);
    if (nombre === 'ot') return arr(window.otData || window.ordenesTrabajoData);
    return arr(window[nombre] || []);
  };

  function aplicarDashSensibles311(){
    var det = document.getElementById('ventas-list-stats-global');
    if (det) det.style.display = window.tienePermiso('ventas.verDashboard') ? '' : 'none';
    var cob = document.querySelector('#page-cobranzas > .metrics');
    if (cob) cob.style.display = window.tienePermiso('cobranzas.verDashboard') ? '' : 'none';
  }
  document.addEventListener('sisventas:page-changed', function(){ setTimeout(aplicarDashSensibles311, 0); });
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(aplicarDashSensibles311, 300); });
})();
