(function(root) {
  'use strict';
  // Compartida por el cliente y el generador de reglas. Los dominios restantes
  // conservan compatibilidad hasta migrar sus consultas y proyecciones.
  var domains = {
    presencia:{modules:['notificaciones'],actions:['dashboard.chat']},notif_leidas:{modules:['notificaciones']},notificaciones_estado:{modules:['notificaciones']},notificaciones_admin:{modules:['usuarios']},
    categorias:{modules:['productos','venta','presupuesto','ordentrabajo','gastos']},dolarHistorico:{modules:['productos','venta','presupuesto','ordentrabajo','reportes']},
    clientes:{modules:['clientes','venta','detalle','presupuesto','ordentrabajo','soporte','equipos','informes','remitos','servicios','cobranzas']},
    clientes_unificados:{modules:['clientes','venta','detalle','presupuesto','ordentrabajo','soporte','cobranzas']},
    clientes_unificados_indice:{modules:['clientes','venta','detalle','presupuesto','ordentrabajo','soporte','cobranzas']},
    productos:{modules:['productos','venta','presupuesto','ordentrabajo','kits','ordenes','balancecompra','actualizadorprecios']},
    ventas:{modules:['detalle','venta','cobranzas','comisiones','reportes','estadisticas','rentabilidad','facturas','creditofiscal','cuentacorriente'],actions:['dashboard.metricasGlobales']},
    presupuestos:{modules:['presupuesto','venta','detalle','balancecompra']},
    pagos:{modules:['cobranzas','detalle','venta','gastos','tesoreria','reportes','rentabilidad','cuentacorriente'],actions:['dashboard.metricasGlobales']},
    pagos_realizados:{modules:['cobranzas','gastos','tesoreria']},
    proveedores:{modules:['proveedores']},
    ordenesTrabajo:{modules:['ordentrabajo','agenda'],actions:['dashboard.otsPendientes']},
    ordenes_trabajo:{modules:['ordentrabajo','agenda'],actions:['dashboard.otsPendientes']},
    kits:{modules:['kits','productos','venta','presupuesto','ordentrabajo']},
    haberes:{modules:['empleados']},
    hsextra_solicitudes:{modules:[],actions:['empleados.autorizarHoras']},
    gastos_adjuntos:{modules:['gastos','tesoreria'],actions:['empleados.verCuentas']},
    cobros_grupos:{modules:['cobranzas']},cobros_adjuntos:{modules:['cobranzas']},control_cobros:{modules:['cobranzas']},
    cobros_cuenta:{modules:['cobranzas','cuentacorriente']},cobros_cuenta_adjuntos:{modules:['cobranzas','cuentacorriente']},control_cobro_cuenta:{modules:['cobranzas','cuentacorriente']},
    auditoria_pagos:{modules:['cobranzas','gastos','tesoreria']},
    credenciales:{modules:[],actions:['credenciales.ver','ot.editarCredenciales']},credencialesPorCliente:{modules:[],actions:['credenciales.ver','ot.editarCredenciales']},
    comisiones_generacion:{modules:['comisiones'],actions:['empleados.verCuentas']},
    inventario_operativo:{modules:['productos','ordentrabajo']},listas_materiales:{modules:['productos','ordentrabajo','ordenes']},
    tareas:{modules:['tareas','ordentrabajo']},procesos:{modules:['procesos','ordentrabajo']},
    comunicados:{modules:['notificaciones']},comunicados_lecturas:{modules:['notificaciones']},
    log_actividad:{modules:['usuarios'],actions:['dashboard.miActividad']},uso_usuarios:{modules:['usuarios']},
    empleados: {modules:[],actions:['empleados.verCuentas','empleados.editar']},
    'config/cargos': {modules:['configuracion'],actions:['empleados.verCuentas','empleados.editar']},
    vacaciones: {modules:['vacaciones']},
    gastos: {modules:['gastos','comisiones','tesoreria','reportes','rentabilidad'],actions:['empleados.verCuentas','dashboard.metricasGlobales']},
    comprobantesCompra: {modules:['creditofiscal','facturas'],actions:['dashboard.metricasGlobales']},
    comprobantesVenta: {modules:['creditofiscal','facturas'],actions:['dashboard.metricasGlobales']},
    'config/tfapp': {modules:['configuracion','facturas']},
    caja: {modules:['caja','tesoreria','gastos']},
    ordenes: {modules:['ordenes','balancecompra']},
    ordenes_compra: {modules:['ordenes','balancecompra']},
    informes: {modules:['informes']},
    reclamos: {modules:['soporte']},
    tickets: {modules:['soporte']},
    garantias: {modules:['garantias']},
    equipos: {modules:['equipos','garantias']},
    remitos: {modules:['remitos']},
    agenda: {modules:['agenda']},
    servicios: {modules:['servicios','presupuesto','venta','ordentrabajo']}
  };
  var internalRoles = ['admin','administrativo','vendedor','tecnico_vendedor','tecnico'];
  var restrictedDefaults = {
    creditofiscal:['admin','administrativo'],facturas:['admin','administrativo'],
    configuracion:['admin'],caja:['admin','administrativo','vendedor','tecnico_vendedor'],
    tesoreria:['admin','administrativo'],gastos:['admin','administrativo'],
    comisiones:['admin','administrativo'],reportes:['admin','administrativo'],rentabilidad:['admin'],empleados:['admin','administrativo'],
    vacaciones:['admin','administrativo'],
    clientes:['admin','administrativo','vendedor','tecnico_vendedor'],detalle:['admin','administrativo','vendedor','tecnico_vendedor'],
    productos:['admin','administrativo','vendedor','tecnico_vendedor'],kits:['admin','administrativo','vendedor','tecnico_vendedor'],
    cobranzas:['admin','administrativo','vendedor','tecnico_vendedor'],cuentacorriente:['admin','administrativo'],estadisticas:['admin','administrativo'],proveedores:['admin','administrativo'],usuarios:['admin'],actualizadorprecios:['admin','administrativo'],
    ordenes:['admin','administrativo'],balancecompra:['admin'],
    presupuesto:['admin','administrativo','vendedor','tecnico_vendedor'],
    venta:['admin','administrativo','vendedor','tecnico_vendedor']
  };
  function allows(domain,role,moduleAllowed,actionAllowed) {
    if(internalRoles.indexOf(role)===-1 || !domains[domain]) return false;
    var policy=domains[domain];
    return policy.modules.some(moduleAllowed) || (policy.actions||[]).some(actionAllowed||function(){return false;});
  }
  var actionDefaults={'empleados.verCuentas':['admin'],'empleados.editar':['admin','administrativo']};
  var api={domains:domains,internalRoles:internalRoles,restrictedDefaults:restrictedDefaults,actionDefaults:actionDefaults,allows:allows};
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.SVDomainReads=api;
})(typeof window==='object'?window:globalThis);
