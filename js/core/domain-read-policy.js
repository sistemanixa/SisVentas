(function(root) {
  'use strict';
  // Compartida por el cliente y el generador de reglas. Los dominios restantes
  // conservan compatibilidad hasta migrar sus consultas y proyecciones.
  var domains = {
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
    ordenes:['admin','administrativo'],balancecompra:['admin'],
    presupuesto:['admin','administrativo','vendedor','tecnico_vendedor'],
    venta:['admin','administrativo','vendedor','tecnico_vendedor']
  };
  function allows(domain,role,moduleAllowed,actionAllowed) {
    if(internalRoles.indexOf(role)===-1 || !domains[domain]) return false;
    var policy=domains[domain];
    return policy.modules.some(moduleAllowed) || (policy.actions||[]).some(actionAllowed||function(){return false;});
  }
  var api={domains:domains,internalRoles:internalRoles,restrictedDefaults:restrictedDefaults,allows:allows};
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.SVDomainReads=api;
})(typeof window==='object'?window:globalThis);
