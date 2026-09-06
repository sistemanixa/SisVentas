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

    var role = normRol();
    if (!role) return false;
    var cfg = ((window.PERMISOS_ROLES || {})[role] || (window.PERMISOS_DEFAULT || {})[role]);
    if (!cfg) return false;
    return (cfg.bloqueados || []).indexOf(mod) === -1;
  }
  var PERMISOS_ACCION = {
    'productos.agregarProveedor': {modulo:'productos',label:'Agregar proveedores a un producto',roles:['admin','administrativo']},
    'productos.verProveedoresExterior': {modulo:'productos',label:'Ver proveedores de otros países',roles:['admin','administrativo','vendedor','tecnico_vendedor','tecnico']},
    'presupuestos.revisarVencidos':{"modulo":"presupuesto","label":"Revisar precios de presupuestos vencidos","roles":["admin","administrativo"]},
    'ventas.repararAdicionales':{"modulo":"detalle","label":"Reparar vínculos de adicionales de OT","roles":["admin","administrativo"]},
    'empleados.avisarHaberes':{"modulo":"empleados","label":"Ver avisos de haberes pendientes","roles":["admin","administrativo"]},
    'productos.limpiarVariaciones':{"modulo":"productos","label":"Limpiar variaciones obsoletas","roles":["admin","administrativo"]},
    'productos.limpiarManoObra':{"modulo":"productos","label":"Normalizar proveedores de mano de obra","roles":["admin","administrativo"]},
    'productos.revisarPrecios':{"modulo":"productos","label":"Revisar precios del catálogo","roles":["admin","administrativo"]},
    'actualizador.consultar':{"modulo":"actualizadorprecios","label":"Consultar actualización masiva","roles":["admin","administrativo"]},
    'ventas.anular':{"modulo":"detalle","label":"Anular venta","roles":["admin","administrativo"]},
    'facturas.verEmitidas':{"modulo":"facturas","label":"Ver facturación emitida","roles":["admin","administrativo"]},
    'facturas.conciliar':{"modulo":"facturas","label":"Conciliar notas de crédito","roles":["admin","administrativo"]},
    'facturas.repararConciliacion':{"modulo":"facturas","label":"Reparar estados de conciliación","roles":["admin","administrativo"]},

    'presupuestos.crear':{modulo:'presupuesto',label:'Crear presupuesto',roles:['admin','administrativo','vendedor','tecnico_vendedor']},
    'agenda.crear':{modulo:'agenda',label:'Crear evento'},
    'gastos.cargarPropio':{modulo:'dashboard',label:'Cargar gasto propio desde acceso rápido',roles:['tecnico']},
    'empleados.horasConOTPendiente':{modulo:'ctaemp',label:'Presentar horas extra con OT vencidas',roles:['admin','administrativo','vendedor']},
    'sesion.sinCierreInactividad':{modulo:'dashboard',label:'Mantener sesión cuando se desactiva el cierre automático',roles:['admin']},
    'ot.verTodas': {modulo:'ordentrabajo',label:'Ver órdenes de todos los técnicos',roles:['admin','administrativo','vendedor','tecnico_vendedor']},
    'asistente.datosGlobales': {modulo:'asistente',label:'Consultar datos globales con el asistente',roles:['admin']},
    'asistente.datosComerciales': {modulo:'asistente',label:'Consultar datos comerciales propios',roles:['administrativo','vendedor']},
    'asistente.datosTecnicos': {modulo:'asistente',label:'Consultar datos técnicos propios',roles:['tecnico']},

    'ventas.autorizarDescuento': {modulo:'venta',label:'Autorizar descuentos sobre el límite',roles:['admin']},
    'ventas.autorizarMargen': {modulo:'venta',label:'Autorizar venta con margen bajo',roles:['admin']},
    'dashboard.metricasGlobales': {modulo:'dashboard',label:'Ver métricas globales',roles:['admin']},
    'dashboard.actividad': {modulo:'dashboard',label:'Ver actividad de todos',roles:['admin']},
    'dashboard.miActividad': {modulo:'dashboard',label:'Ver mi actividad comercial',roles:['administrativo','vendedor','tecnico_vendedor']},
    'dashboard.misOT': {modulo:'dashboard',label:'Ver mis órdenes de trabajo',roles:['tecnico','tecnico_vendedor']},
    'dashboard.miCuenta': {modulo:'dashboard',label:'Ver mi cuenta personal',roles:['administrativo','vendedor','tecnico_vendedor','tecnico']},
    'dashboard.indicadoresPrecios': {modulo:'dashboard',label:'Ver cotización y vigencia de precios',roles:['admin','administrativo']},
    'configuracion.columnas': {modulo:'configuracion',label:'Configurar columnas compartidas',roles:['admin']},
    'configuracion.monitor': {modulo:'configuracion',label:'Ver monitor de recursos',roles:['admin']},
    'configuracion.asistente': {modulo:'configuracion',label:'Configurar asistente de ventas',roles:['admin','administrativo']},
    'ot.editarDatosAdministrativos': {modulo:'ordentrabajo',label:'Editar origen y notas administrativas',roles:['admin','administrativo','vendedor','tecnico_vendedor']},
    'ot.editarCredenciales': {modulo:'ordentrabajo',label:'Editar credenciales desde la OT',roles:['admin','administrativo','tecnico']},
    'presupuestos.aprobar': {modulo:'presupuesto',label:'Aprobar presupuestos sobre los límites',roles:['admin']},
    'presupuestos.aprobarDentroLimite': {modulo:'presupuesto',label:'Aprobar dentro de los límites',roles:['admin','administrativo']},
    'facturas.cargarExterna': {modulo:'facturas',label:'Cargar factura externa',roles:['admin','administrativo']},
    'facturas.recuperarDatos': {modulo:'facturas',label:'Recuperar datos fiscales',roles:['admin']},
    'comisiones.distribuir': {modulo:'comisiones',label:'Cambiar distribución de comisiones',roles:['admin']},
    'gastos.administrar': {modulo:'gastos',label:'Administrar gastos',roles:['admin','administrativo']},
    'empleados.gestionarAdelantos': {modulo:'ctaemp',label:'Gestionar adelantos',roles:['admin','administrativo']},

    "mantenimiento.estructuraClientes": {"modulo":"configuracion","label":"Migrar estructura de clientes","roles":["admin"]},
    "chat.limpiar": {"modulo":"notificaciones","label":"Limpiar conversaciones del chat","roles":["admin"]},
    "empleados.registrarHaberes": {"modulo":"empleados","label":"Registrar haberes y aguinaldos","roles":["admin"]},
    "empleados.autorizarHoras": {"modulo":"ctaemp","label":"Autorizar horas extra","roles":["admin"]},
    "ventas.configurarComision": {"modulo":"venta","label":"Configurar comisión de la venta","roles":["admin"]},
    "facturas.notaCredito": {"modulo":"facturas","label":"Emitir notas de crédito","roles":["admin"]},
    "mantenimiento.repararVentas": {"modulo":"configuracion","label":"Reparar importes históricos","roles":["admin"]},
    "productos.aprobarVariacion": {"modulo":"productos","label":"Aprobar variaciones de precio","roles":["admin"]},
    "productos.auditar": {"modulo":"productos","label":"Auditar integridad del catálogo","roles":["admin"]},
    "productos.normalizar": {"modulo":"productos","label":"Normalizar productos en pesos","roles":["admin"]},
    "configuracion.valoresMasivos": {"modulo":"configuracion","label":"Cambiar valores masivamente","roles":["admin"]},
    "empleados.verCuentas": {"modulo":"ctaemp","label":"Ver cuentas del personal","roles":["admin"]},
    "empleados.aplicarAdelantos": {"modulo":"ctaemp","label":"Aplicar adelantos al haber","roles":["admin"]},
    "empleados.pagarMovimiento": {"modulo":"ctaemp","label":"Abonar movimientos del personal","roles":["admin"]},
    "empleados.crearMovimientoAprobado": {"modulo":"ctaemp","label":"Crear movimientos aprobados","roles":["admin"]},
    "creditofiscal.eliminarPeriodo": {"modulo":"creditofiscal","label":"Eliminar períodos","roles":["admin"]},
    "facturas.eliminarPeriodo": {"modulo":"facturas","label":"Eliminar períodos","roles":["admin"]},
    "vacaciones.editar": {"modulo":"vacaciones","label":"Editar vacaciones","roles":["admin"]},
    "usuarios.gestionarClave": {"modulo":"usuarios","label":"Gestionar credenciales de usuarios","roles":["admin"]},
    "gastos.aprobar": {"modulo":"gastos","label":"Aprobar solicitudes de gastos","roles":["admin"]},
    "gastos.recurrencias": {"modulo":"gastos","label":"Gestionar gastos recurrentes","roles":["admin"]},
    "comisiones.aprobar": {"modulo":"comisiones","label":"Aprobar o rechazar comisiones","roles":["admin"]},
    "empleados.bonificar": {"modulo":"empleados","label":"Registrar bonificaciones","roles":["admin"]},
    "comisiones.crear": {"modulo":"comisiones","label":"Registrar comisiones manuales","roles":["admin"]},
    "gastos.corregirPago": {"modulo":"gastos","label":"Corregir o anular pagos","roles":["admin"]},
    "notificaciones.comunicados": {"modulo":"notificaciones","label":"Gestionar comunicados","roles":["admin"]},
    "dashboard.rentabilidad": {"modulo":"dashboard","label":"Ver rentabilidad en Dashboard","roles":["admin"]},

    'ventas.verDashboard':       { modulo:'detalle', admin:true },
    'ventas.ver':                { modulo:'detalle' },
    'ventas.verTodas':           { modulo:'detalle', roles:['admin','administrativo'] },
    'ventas.verMargen':          { modulo:'detalle', roles:['admin'] },
    'ventas.crear':              { modulo:'venta' },
    'ventas.editar':             { modulo:'detalle', roles:['admin','administrativo'] },
    'ventas.eliminar':           { modulo:'detalle', admin:true },
    'ventas.moverPresupuesto':   { modulo:'detalle', roles:['admin','administrativo'] },
    'ventas.contadoSinFactura':  { modulo:'detalle', admin:true },
    'cobranzas.verDashboard':    { modulo:'cobranzas', admin:true },
    'cobranzas.ver':             { modulo:'cobranzas' },
    'cobranzas.registrar':       { modulo:'cobranzas', roles:['admin','administrativo'] },
    'cobranzas.anular':          { modulo:'cobranzas', admin:true },
    'tesoreria.ver':             { modulo:'tesoreria', admin:true },
    'tesoreria.pagar':           { modulo:'tesoreria', admin:true },
    'productos.editar':          { modulo:'productos', roles:['admin','administrativo'] },
    'productos.eliminar':        { modulo:'productos', admin:true },
    'kits.editar':               { modulo:'kits', roles:['admin','administrativo'] },
    'kits.eliminar':             { modulo:'kits', admin:true },
    'clientes.editar':           { modulo:'clientes', roles:['admin','administrativo'] },
    'clientes.eliminar':         { modulo:'clientes', admin:true },
    'credenciales.ver':          { modulo:'clientes', roles:['admin','administrativo','tecnico_vendedor','tecnico'] },
    'credenciales.editar':       { modulo:'clientes', roles:['admin','administrativo'] },
    'credenciales.eliminar':     { modulo:'clientes', admin:true },
    'presupuestos.editar':       { modulo:'presupuesto', roles:['admin','administrativo'] },
    'presupuestos.verMargen':    { modulo:'presupuesto', roles:['admin'] },
    'presupuestos.eliminar':     { modulo:'presupuesto', admin:true },
    'presupuestos.anular':       { modulo:'presupuesto', admin:true },
    'ot.editar':                 { modulo:'ordentrabajo', roles:['admin','administrativo','tecnico_vendedor','tecnico'] },
    'ot.corregirMateriales':     { modulo:'ordentrabajo', roles:['admin','administrativo','vendedor'] },
    'ot.entregarMateriales':     { modulo:'ordentrabajo', roles:['admin','administrativo','vendedor'] },
    'ot.rendirMateriales':       { modulo:'ordentrabajo', roles:['admin','administrativo','vendedor','tecnico_vendedor','tecnico'] },
    'soporte.resolver':          { modulo:'soporte', roles:['admin','administrativo','vendedor','tecnico_vendedor'] },
    'ot.crear':                  { modulo:'ordentrabajo', roles:['admin','administrativo'] },
    'ot.eliminar':               { modulo:'ordentrabajo', admin:true },
    'empleados.eliminar':        { modulo:'empleados', admin:true },
    'empleados.editar':          { modulo:'empleados', roles:['admin','administrativo'] },
    'empleados.aprobarMovimiento': { modulo:'ctaemp', admin:true },
    'empleados.eliminarMovimiento': { modulo:'ctaemp', admin:true },
    'gastos.crear':               { modulo:'gastos' },
    'gastos.editar':              { modulo:'gastos', roles:['admin','administrativo'] },
    'gastos.pagar':               { modulo:'gastos', roles:['admin','administrativo'] },
    'gastos.fijo':                { modulo:'gastos', roles:['admin','administrativo'] },
    'gastos.eliminar':            { modulo:'gastos', admin:true },
    'usuarios.editar':            { modulo:'usuarios', admin:true },
    'usuarios.eliminar':          { modulo:'usuarios', admin:true },
    'proveedores.editar':         { modulo:'proveedores', roles:['admin','administrativo'] },
    'proveedores.eliminar':       { modulo:'proveedores', admin:true },
    'ordenes.editar':             { modulo:'ordenes', roles:['admin','administrativo'] },
    'ordenes.eliminar':           { modulo:'ordenes', admin:true },
    'informes.editar':            { modulo:'informes', roles:['admin','administrativo','tecnico_vendedor','tecnico'] },
    'informes.eliminar':          { modulo:'informes', admin:true },
    'equipos.eliminar':           { modulo:'equipos', admin:true },
    'soporte.eliminar':           { modulo:'soporte', admin:true },
    'remitos.eliminar':           { modulo:'remitos', admin:true },
    'servicios.eliminar':         { modulo:'servicios', admin:true },
    'vacaciones.eliminar':        { modulo:'vacaciones', admin:true },
    'mantenimiento.migrar':       { modulo:'configuracion', admin:true },
    'mantenimiento.limpiar':      { modulo:'configuracion', admin:true },
    'mantenimiento.duplicados':   { modulo:'configuracion', admin:true },
    'mantenimiento.normalizar':   { modulo:'configuracion', admin:true },
    'actividad.limpiar':          { modulo:'configuracion', admin:true },
    'datos.seedDemo':             { modulo:'configuracion', admin:true },
    'configuracion.editar':      { modulo:'configuracion', admin:true },
    'registros.eliminar':        { validar:function(ctx){
      var coleccion = String((ctx.args||[])[0]||'');
      var porColeccion = {
        gastos:'gastos.eliminar', proveedores:'proveedores.eliminar', ordenes:'ordenes.eliminar',
        informes:'informes.eliminar', equipos:'equipos.eliminar', usuarios:'usuarios.eliminar',
        tickets:'soporte.eliminar', remitos:'remitos.eliminar', servicios:'servicios.eliminar',
        vacaciones:'vacaciones.eliminar'
      };
      return porColeccion[coleccion] ? window.tienePermiso(porColeccion[coleccion], ctx) : false;
    } },
    'usuarios.impersonar':       { modulo:'usuarios', admin:true },
    'auditoria.ver':             { modulo:'configuracion', admin:true }
  };
  PERMISOS_ACCION['dashboard.grafico']={modulo:'dashboard',label:'Ver gráfico de ventas',roles:['admin']};
  PERMISOS_ACCION['dashboard.otsPendientes']={modulo:'dashboard',label:'Ver órdenes pendientes en inicio',roles:['admin']};
  PERMISOS_ACCION['dashboard.chat']={modulo:'dashboard',label:'Mostrar botón del chat',roles:['admin','administrativo','vendedor','tecnico_vendedor','tecnico']};
  PERMISOS_ACCION['dashboard.asistente']={modulo:'dashboard',label:'Mostrar botón del asistente',roles:['admin','administrativo','vendedor','tecnico_vendedor','tecnico']};
  PERMISOS_ACCION['empleados.verComisionesPendientes']={modulo:'ctaemp',label:'Ver comisiones pendientes',roles:['admin']};
  var widgetsLegacy={"metricasGlobales":"metricas_globales","rentabilidad":"rentabilidad","miActividad":"mi_actividad","misOT":"mis_ots","grafico":"grafico_barras","otsPendientes":"ots_pendientes","chat":"btn_chat","asistente":"btn_ia"};
  window.SISVENTAS_PERMISOS_ACCION = PERMISOS_ACCION;
  function overrideAccion(role, permiso){
    var cfg = ((window.PERMISOS_ROLES || {})[role] || (window.PERMISOS_DEFAULT || {})[role] || {});
    var partes = String(permiso || '').split('.');
    if(partes.length < 2 || !cfg.acciones || !cfg.acciones[partes[0]]) return undefined;
    var grupo = cfg.acciones[partes[0]];
    return Object.prototype.hasOwnProperty.call(grupo, partes.slice(1).join('_'))
      ? !!grupo[partes.slice(1).join('_')]
      : undefined;
  }
  window.svValorPermisoRol = function(permiso, role) {
    var regla=PERMISOS_ACCION[permiso];if(!regla)return false;
    var override=overrideAccion(role,permiso);if(override!==undefined)return override;
    var widget=widgetsLegacy[String(permiso).replace(/^dashboard\./,'')];
    var legacy=widget && (window.DASH_WIDGETS_CONFIG||{})[widget];
    if(legacy && Object.prototype.hasOwnProperty.call(legacy,role))return !!legacy[role];
    if(regla.admin)return role==='admin';
    return !regla.roles || regla.roles.indexOf(role)!==-1;
  };
  window.tienePermiso = SV.Security.tienePermiso = function(permiso, contexto){
    var regla = PERMISOS_ACCION[permiso];
    if (!regla) return false;
    var role = normRol();
    if (!window.svValorPermisoRol(permiso,role)) return false;
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

  var PROTECCIONES_ACCION = [
    ['spAbrirResolucionVisita','soporte.resolver'],
    ['spConfirmarResolucionVisita','soporte.resolver'],
    ['spResolverRemoto','soporte.resolver'],
    ['registrarPago','cobranzas.registrar'],
    ['anularPago','cobranzas.anular'],
    ['elimPago','cobranzas.anular'],
    ['eliminarVenta','ventas.eliminar'],
    ['abrirEditorVenta','ventas.editar'],
    ['moverVentaAPresupuesto','ventas.moverPresupuesto'],
    ['toggleCSF','ventas.contadoSinFactura'],
    ['eliminarPptoDesdeTabla','presupuestos.eliminar'],
    ['eliminarPpto','presupuestos.eliminar'],
    ['anularPptoDesdeTabla','presupuestos.anular'],
    ['abrirEditorPpto','presupuestos.editar'],
    ['crearOT','ot.crear'],
    ['actualizarOT','ot.editar'],
    ['actualizarOTFecha','ot.editar'],
    ['eliminarOT','ot.eliminar'],
    ['editarCliente','clientes.editar'],
    ['editarClienteById','clientes.editar'],
    ['eliminarCliente','clientes.eliminar'],
    ['credMostrarPass','credenciales.ver'],
    ['credGuardar','credenciales.editar'],
    ['credEliminar','credenciales.eliminar'],
    ['eliminarProducto','productos.eliminar'],
    ['eliminarProductoPorId','productos.eliminar'],
    ['editarProducto','productos.editar'],
    ['editarProductoById','productos.editar'],
    ['editarDesdeDetalle','productos.editar'],
    ['editarProductoDesdeRevisionPrecios','productos.editar'],
    ['editarKit','kits.editar'],
    ['eliminarKit','kits.eliminar'],
    ['eliminarEmpleado','empleados.eliminar'],
    ['editarEmpleado','empleados.editar'],
    ['aprobarComision','empleados.aprobarMovimiento'],
    ['rechazarComision','empleados.aprobarMovimiento'],
    ['aprobarMovEmp','empleados.aprobarMovimiento'],
    ['eliminarMovEmp','empleados.eliminarMovimiento'],
    ['abrirPagoGasto','gastos.pagar'],
    ['abrirPagoMultipleGastos','gastos.pagar'],
    ['confirmarPagoGasto','gastos.pagar'],
    ['mntMigrarLegacy','mantenimiento.migrar'],
    ['mntLimpiarLegacy','mantenimiento.limpiar'],
    ['mntEliminarDuplicadosGastosFijos','mantenimiento.duplicados'],
    ['svAplicarPlanNormalizacionRelaciones','mantenimiento.normalizar'],
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
    ['restaurarPermisosDefault','configuracion.editar'],
    ['editarUsuario','usuarios.editar'],
    ['editarProveedor','proveedores.editar'],
    ['editarOrden','ordenes.editar'],
    ['editarInforme','informes.editar']
  ];


  var permisosFunciones = {"generarEstructuraClientesAprobada":"mantenimiento.estructuraClientes","chatAdminLimpiar":"chat.limpiar","chatAbrir":"chat.limpiar","chatCargarCanal":"chat.limpiar","chatEnviar":"chat.limpiar","abrirModalHaberesMes":"empleados.registrarHaberes","confirmarRegistroHaberes":"empleados.registrarHaberes","abrirModalAguinaldo":"empleados.registrarHaberes","confirmarRegistroAguinaldo":"empleados.registrarHaberes","abrirModalHsExtra":"empleados.autorizarHoras","_abrirPanelAprobacionHsExtraLegacy":"empleados.autorizarHoras","abrirPanelAprobacionHsExtra":"empleados.autorizarHoras","aprobarHsExtra":"empleados.autorizarHoras","rechazarHsExtra":"empleados.autorizarHoras","actualizarBadgeHsExtraPendientes":"empleados.autorizarHoras","actualizarControlComisionVenta":"ventas.configurarComision","confirmarVenta":"ventas.configurarComision","abrirModalNotaCredito":"facturas.notaCredito","repararVentasArsDuplicadasPorDolar":"mantenimiento.repararVentas","mostrarVariacionPrecioPendienteEnEditor":"productos.aprobarVariacion","revisarYAprobarVariacionPrecio":"productos.aprobarVariacion","aprobarVariacionPrecioActualizador":"productos.aprobarVariacion","aprobarVariacionPrecioProveedor":"productos.aprobarVariacion","procesarResultadoCotizacionProveedores":"productos.aprobarVariacion","actualizadorHtmlFallos":"productos.aprobarVariacion","renderModuloActualizadorPreciosAhora":"productos.aprobarVariacion","abrirAuditoriaIntegridadPrecios":"productos.auditar","normalizarTodosProductosARS":"productos.normalizar","abrirGestionRevisionPrecios":"productos.eliminar","renderCfgValoresMasivos":"configuracion.valoresMasivos","cfgValoresMasivosPrevisualizar":"configuracion.valoresMasivos","cfgValoresMasivosAplicar":"configuracion.valoresMasivos","limpiarLogActividad":"actividad.limpiar","abrirCuentaEmpleadoDesdeEmpleados":"empleados.verCuentas","actualizarBotonVolverCtaEmp":"empleados.verCuentas","iniciarCtaEmp":"empleados.verCuentas","_ctaEmpMovVisibleParaRol":"empleados.verCuentas","aplicarAdelantosAlHaberActual":"empleados.aplicarAdelantos","_puedeAprobarMovEmp":"empleados.aprobarMovimiento","aprobarComision":"empleados.aprobarMovimiento","rechazarComision":"empleados.aprobarMovimiento","aprobarMovEmp":"empleados.aprobarMovimiento","abonarMovEmp":"empleados.pagarMovimiento","corregirMedioPagoMovEmp":"empleados.pagarMovimiento","abrirNuevoMovEmp":"empleados.crearMovimientoAprobado","guardarMovEmp":"empleados.crearMovimientoAprobado","eliminarMovEmp":"empleados.eliminarMovimiento","eliminarVenta":"ventas.eliminar","cfActualizarPeriodosUI":"creditofiscal.eliminarPeriodo","cfEliminarPeriodo":"creditofiscal.eliminarPeriodo","fvActualizarPeriodosUI":"facturas.eliminarPeriodo","fvEliminarPeriodo":"facturas.eliminarPeriodo","spEliminarReclamo":"soporte.eliminar","spRenderAcciones":"soporte.eliminar","renderPeriodosVacaciones":"vacaciones.editar","abrirModalEditarVacaciones":"vacaciones.editar","iniciarImpersonacionUsuario":"usuarios.impersonar","obtenerClaveUsuarioAdmin":"usuarios.gestionarClave","toggleVerClaveUsuario":"usuarios.gestionarClave","gestionarClaveUsuario":"usuarios.gestionarClave","eliminarCliente":"clientes.eliminar","eliminarEmpleado":"empleados.eliminar","_actualizarBadgeSolicitudesGastos":"gastos.aprobar","actualizarMetricasGastos":"gastos.aprobar","aprobarGastoSolicitado":"gastos.aprobar","generarGastosFijosMesSeguro":"gastos.recurrencias","abrirGestorGastosRecurrentes":"gastos.recurrencias","aprobarComisionDesdeGasto":"comisiones.aprobar","rechazarComisionDesdeGasto":"comisiones.aprobar","abrirModalBonificacionEmpleado":"empleados.bonificar","guardarBonificacionEmpleado":"empleados.bonificar","abrirModalComisionVenta":"comisiones.crear","guardarComisionManualVenta":"comisiones.crear","abrirEditarPagoGasto":"gastos.corregirPago","anularPagoGasto":"gastos.corregirPago","verPagosGasto":"gastos.corregirPago","abrirModalComunicado":"notificaciones.comunicados","enviarComunicadoGlobal":"notificaciones.comunicados","renderHistorialComunicados":"notificaciones.comunicados","finalizarComunicado":"notificaciones.comunicados","eliminarComunicado":"notificaciones.comunicados","renderRentabilidadDashboard":"dashboard.rentabilidad","otEliminarProductoMaterial":"ot.corregirMateriales","otAbrirSelectorProductos":"ot.corregirMateriales","otCustodiaEntregar":"ot.entregarMateriales","otCustodiaConfirmarRecepcion":"ot.entregarMateriales","otCustodiaTodoInstalado":"ot.rendirMateriales","otCustodiaAbrirExcepciones":"ot.rendirMateriales","spAbrirResolucionVisita":"soporte.resolver"};
  var clasesPermiso = {
    'admin-only':['admin'], 'admin-o-administrativo':['admin','administrativo'],
    'no-tecnico':['admin','administrativo','vendedor','tecnico_vendedor'],
    'no-administrativo':['admin','vendedor','tecnico_vendedor','tecnico'],
    'no-vendedor':['admin','administrativo','tecnico_vendedor','tecnico'], 'tecnico-only':['tecnico']
  };
  window.svAplicarVisibilidadPermisos = function(){
    document.querySelectorAll('[data-permiso]').forEach(function(el){el.style.display=window.tienePermiso(el.getAttribute('data-permiso'))?'':'none';});
    PROTECCIONES_ACCION.forEach(function(p){permisosFunciones[p[0]]=p[1];});
    document.querySelectorAll(Object.keys(clasesPermiso).map(function(k){return '.'+k;}).join(',')).forEach(function(el){
      var funcion = String(el.getAttribute('onclick') || '').match(/(?:^|;)\s*(?:window\.)?(\w+)\(/);
      var permiso = funcion && permisosFunciones[funcion[1]];
      if (!permiso) {
        var clases = Object.keys(clasesPermiso).filter(function(k){return el.classList.contains(k);});
        var pagina = el.closest('[id^="page-"]');
        var modulo = pagina ? pagina.id.slice(5) : 'configuracion';
        permiso = 'interfaz.'+modulo+'_'+clases.join('_').replace(/-/g,'_');
        if (!PERMISOS_ACCION[permiso]) {
          var roles = ['admin','administrativo','vendedor','tecnico_vendedor','tecnico'].filter(function(r){return clases.every(function(c){return clasesPermiso[c].includes(r);});});
          PERMISOS_ACCION[permiso] = {modulo:modulo,roles:roles,label:'Ver controles '+(clases.includes('admin-only')?'de administración':clases.includes('tecnico-only')?'técnicos':'operativos')};
        }
      }
      el.dataset.svPermission = permiso;
      el.style.display = window.tienePermiso(permiso) ? '' : 'none';
    });
  };

  function aplicarProtecciones(){
    PROTECCIONES_ACCION.forEach(function(item){ proteger(item[0],item[1]); });
  }
  SV.Security.aplicarProtecciones = aplicarProtecciones;
  window.svAplicarProteccionesAccion = aplicarProtecciones;
  aplicarProtecciones();
  setTimeout(aplicarProtecciones, 300);
  setTimeout(aplicarProtecciones, 1200);
  document.addEventListener('sisventas:page-changed', aplicarProtecciones);

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

  aplicarProtecciones();
  setTimeout(aplicarProtecciones, 1800);

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
