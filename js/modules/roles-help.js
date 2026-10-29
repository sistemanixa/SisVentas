(function (root) {
  'use strict';
  const modules = {
    dashboard:'Inicio con indicadores, accesos rápidos y actividad. Siempre está visible; cada indicador y botón tiene su propio permiso.',
    asistente:'Consultas al asistente de ventas. Las acciones determinan si puede consultar información global, comercial propia o técnica propia.',
    presupuesto:'Preparación y seguimiento de presupuestos. Crear, editar, aprobar, anular y consultar márgenes se autorizan por separado.',
    venta:'Carga de nuevas ventas. Las acciones controlan su creación, las excepciones comerciales y la configuración de comisiones.',
    detalle:'Consulta y seguimiento de ventas existentes. Las acciones controlan qué ventas puede ver y si puede editar, anular o eliminar.',
    cobranzas:'Consulta de saldos y registro de cobros de clientes. Ver indicadores, registrar cobros y anularlos son permisos separados.',
    cuentacorriente:'Consulta de movimientos y saldos de la cuenta corriente de los clientes.',
    ordentrabajo:'Consulta y seguimiento de órdenes de trabajo e instalaciones. Las acciones autorizan edición, materiales y acceso a órdenes de otros técnicos.',
    clientes:'Consulta de fichas de clientes. Editar, eliminar y consultar o modificar credenciales requieren sus permisos específicos.',
    productos:'Consulta del catálogo interno de productos. Las acciones autorizan cambios de datos, proveedores, categorías y precios.',
    catalogo:'Exploración del catálogo para seleccionar productos. Enviar esa selección a revisión comercial requiere su permiso específico.',
    kits:'Consulta de conjuntos de productos. Editar su composición y eliminar kits se autorizan por separado.',
    actualizadorprecios:'Herramienta de revisión y actualización de precios de proveedores. Consultar una actualización y aprobar variaciones tienen controles propios.',
    empleados:'Consulta de fichas del personal. Las acciones controlan su edición, haberes, bonificaciones y avisos.',
    vacaciones:'Consulta de vacaciones del personal. Modificar y eliminar registros requieren sus permisos correspondientes.',
    usuarios:'Administración de cuentas de acceso. Cambiar fichas, credenciales, eliminar cuentas o ingresar como otro usuario se autorizan por separado.',
    reportes:'Consulta de reportes de ventas con filtros y detalle comercial.',
    estadisticas:'Consulta de estadísticas y resúmenes del negocio.',
    gastos:'Consulta y seguimiento de gastos. Crear, editar, aprobar, pagar y corregir pagos se habilitan por separado.',
    comisiones:'Consulta de comisiones. Registrar, distribuir y aprobar comisiones tienen permisos propios.',
    caja:'Consulta del registro diario de entradas, salidas y saldo de caja.',
    ctaemp:'Consulta de cuentas y movimientos del personal. Adelantos, horas extra, pagos y aprobaciones se autorizan por separado.',
    rentabilidad:'Consulta de resultados, costos y rentabilidad del negocio.',
    tablero:'Consulta del tablero gerencial con indicadores y seguimiento del negocio.',
    tesoreria:'Consulta de movimientos de tesorería. Realizar pagos requiere su autorización específica.',
    proveedores:'Consulta de proveedores. Editar sus fichas y eliminar registros se autorizan por separado.',
    balancecompra:'Consulta y planificación de compras de exterior, con costos y comparación comercial.',
    ordenes:'Consulta de órdenes de compra a proveedores. Editarlas y eliminarlas tienen permisos separados.',
    creditofiscal:'Consulta de comprobantes fiscales de ARCA recibidos y emitidos. Eliminar períodos tiene un permiso específico.',
    facturas:'Consulta y conciliación de facturas emitidas. Las acciones habilitan carga externa, recuperación fiscal y notas de crédito.',
    garantias:'Consulta y seguimiento de garantías de productos y equipos.',
    soporte:'Consulta de reclamos y solicitudes de soporte. Resolver o eliminar registros se autoriza por separado.',
    remitos:'Consulta de remitos y entregas. Eliminar registros requiere su permiso específico.',
    agenda:'Consulta de eventos y visitas. Crear eventos y reprogramarlos son acciones independientes.',
    servicios:'Consulta de servicios registrados. Eliminar registros requiere su permiso específico.',
    informes:'Consulta de informes técnicos. Editar y eliminar informes se autoriza por separado.',
    equipos:'Consulta de equipos instalados y su cobertura. Confirmar instalaciones y eliminar registros tienen permisos propios.',
    relevamientos:'Consulta de relevamientos y datos relevados para trabajos o instalaciones.',
    notificaciones:'Consulta de avisos, comunicados y chat. Gestionar comunicados o limpiar conversaciones requiere su permiso específico.',
    distribuidora:'Acceso al catálogo COMPRAS PARAGUAY y listas propias. Las opciones del bloque Distribuidora controlan sus funciones internas.',
    configuracion:'Acceso a ajustes del sistema. Editar configuración, usar mantenimiento y consultar auditorías tienen permisos específicos.',
    compras_paraguay:'Rol de acceso limitado al catálogo COMPRAS PARAGUAY y sus listas propias. Se asigna a la persona desde Usuarios.'
  };
  const actions = {
    'productos.configurarGarantia':'Permite definir los datos de garantía y seguimiento del producto.',
    'equipos.confirmarInstalacion':'Permite confirmar la instalación de equipos y su cobertura desde una venta u orden de trabajo.',
    'agenda.reprogramar':'Permite cambiar la fecha o programación de visitas registradas.',
    'productos.agregarProveedor':'Permite vincular nuevos proveedores a un producto.',
    'productos.verProveedoresExterior':'Permite consultar y gestionar proveedores de otros países dentro de la ficha del producto.',
    'presupuestos.compararExterior':'Permite comparar costos de compra exterior y el margen del presupuesto.',
    'presupuestos.actualizarExterior':'Permite aplicar valores de compra de Paraguay al presupuesto exterior.',
    'documentos.modificarDescripcionProductos':'Permite cambiar la descripción del producto en una venta o presupuesto, manteniendo su identificación.',
    'presupuestos.revisarVencidos':'Permite revisar los precios de presupuestos vencidos antes de continuar la operación.',
    'ventas.repararAdicionales':'Permite reparar la vinculación de adicionales de una orden de trabajo con su venta.',
    'empleados.avisarHaberes':'Permite ver los avisos de haberes pendientes del personal.',
    'productos.limpiarVariaciones':'Permite limpiar variaciones de precio obsoletas del catálogo.',
    'productos.limpiarManoObra':'Permite normalizar los proveedores de productos de mano de obra.',
    'productos.revisarPrecios':'Permite abrir la revisión de precios del catálogo.',
    'actualizador.consultar':'Permite consultar resultados de una actualización masiva de precios.',
    'facturas.verEmitidas':'Permite consultar el listado de facturas emitidas.',
    'facturas.conciliar':'Permite conciliar notas de crédito con sus comprobantes.',
    'facturas.repararConciliacion':'Permite reparar estados de conciliación de comprobantes.',
    'catalogo.solicitarPresupuesto':'Permite enviar los productos seleccionados del catálogo a revisión comercial.',
    'gastos.cargarPropio':'Permite cargar un gasto propio desde el acceso rápido del inicio.',
    'empleados.horasConOTPendiente':'Permite presentar horas extra aunque existan órdenes de trabajo vencidas pendientes.',
    'sesion.sinCierreInactividad':'Permite mantener la sesión abierta cuando se desactiva el cierre automático por inactividad.',
    'ot.verTodas':'Permite consultar órdenes de trabajo de todos los técnicos, además de las propias.',
    'asistente.datosGlobales':'Permite que el asistente consulte información global del negocio.',
    'asistente.datosComerciales':'Permite que el asistente consulte información comercial propia del usuario.',
    'asistente.datosTecnicos':'Permite que el asistente consulte información técnica propia del usuario.',
    'ventas.autorizarDescuento':'Permite autorizar una venta cuyo descuento supera el límite configurado.',
    'ventas.autorizarMargen':'Permite autorizar una venta con margen inferior al mínimo configurado.',
    'dashboard.metricasGlobales':'Muestra indicadores globales del negocio en el inicio.',
    'dashboard.actividad':'Muestra la actividad de todos los usuarios en el inicio.',
    'dashboard.miActividad':'Muestra las ventas y presupuestos propios en el inicio.',
    'dashboard.misOT':'Muestra las órdenes de trabajo asignadas al usuario en el inicio.',
    'dashboard.miCuenta':'Muestra el acceso a la cuenta personal del usuario en el inicio.',
    'dashboard.indicadoresPrecios':'Muestra la cotización del dólar y la vigencia de precios en el inicio.',
    'configuracion.columnas':'Permite modificar las columnas compartidas de las grillas.',
    'configuracion.monitor':'Permite consultar el monitor de recursos y diagnóstico del sistema.',
    'configuracion.asistente':'Permite modificar los ajustes del asistente de ventas.',
    'ot.editarDatosAdministrativos':'Permite modificar el origen y las notas administrativas de una orden de trabajo.',
    'ot.editarCredenciales':'Permite modificar credenciales del cliente desde su orden de trabajo.',
    'presupuestos.aprobar':'Permite aprobar presupuestos que superan los límites comerciales configurados.',
    'presupuestos.aprobarDentroLimite':'Permite aprobar presupuestos que cumplen los límites comerciales configurados.',
    'facturas.cargarExterna':'Permite incorporar una factura emitida fuera del sistema.',
    'facturas.recuperarDatos':'Permite recuperar los datos fiscales de comprobantes.',
    'comisiones.distribuir':'Permite cambiar el reparto de comisiones entre participantes.',
    'gastos.administrar':'Permite usar los controles de administración de gastos. Aprobar, pagar y corregir pagos tienen permisos específicos.',
    'empleados.gestionarAdelantos':'Permite registrar adelantos en la cuenta de un empleado.',
    'mantenimiento.estructuraClientes':'Permite ejecutar la migración de la estructura de clientes.',
    'chat.limpiar':'Permite limpiar conversaciones del chat interno.',
    'empleados.registrarHaberes':'Permite registrar haberes y aguinaldos del personal.',
    'empleados.autorizarHoras':'Permite revisar y autorizar solicitudes de horas extra.',
    'ventas.corregirCosto':'Permite corregir el costo de compra guardado, incluido cero, con motivo y auditoría. No modifica precios, cobros, stock ni comisiones existentes.',
    'ventas.configurarComision':'Permite configurar la comisión de una venta.',
    'facturas.notaCredito':'Permite emitir notas de crédito vinculadas a comprobantes fiscales.',
    'mantenimiento.repararVentas':'Permite ejecutar herramientas de reparación de importes históricos de ventas.',
    'productos.aprobarVariacion':'Permite revisar y aprobar variaciones de precios pendientes.',
    'productos.auditar':'Permite revisar inconsistencias e integridad de datos del catálogo.',
    'productos.normalizar':'Permite ejecutar la normalización de productos expresados en pesos.',
    'configuracion.valoresMasivos':'Permite aplicar cambios de valores a múltiples registros desde Configuración.',
    'empleados.verCuentas':'Permite consultar las cuentas y movimientos del personal.',
    'empleados.aplicarAdelantos':'Permite descontar adelantos al registrar un haber.',
    'empleados.pagarMovimiento':'Permite registrar el pago de un movimiento de la cuenta del empleado.',
    'empleados.crearMovimientoAprobado':'Permite crear movimientos del personal con estado aprobado.',
    'creditofiscal.eliminarPeriodo':'Permite eliminar un período de comprobantes ARCA del sistema.',
    'facturas.eliminarPeriodo':'Permite eliminar un período del registro de facturas del sistema.',
    'usuarios.gestionarClave':'Permite gestionar las credenciales de acceso de usuarios.',
    'gastos.aprobar':'Permite aprobar o rechazar solicitudes de gastos.',
    'gastos.recurrencias':'Permite configurar y gestionar gastos que se repiten periódicamente.',
    'comisiones.aprobar':'Permite aprobar o rechazar comisiones pendientes.',
    'empleados.bonificar':'Permite registrar bonificaciones para el personal.',
    'comisiones.crear':'Permite registrar una comisión manual.',
    'gastos.corregirPago':'Permite corregir un pago registrado o anularlo. Es una autorización distinta de registrar un nuevo pago.',
    'notificaciones.comunicados':'Permite gestionar los comunicados internos.',
    'dashboard.rentabilidad':'Muestra el resumen de rentabilidad en el inicio.',
    'ventas.verTodas':'Permite consultar ventas de todos los usuarios, además de las propias.',
    'ventas.moverPresupuesto':'Permite mover una venta a presupuesto.',
    'ventas.contadoSinFactura':'Permite marcar una venta como contado sin factura.',
    'productos.gestionarCategorias':'Permite administrar las categorías utilizadas para organizar los productos.',
    'credenciales.ver':'Permite consultar las credenciales guardadas del cliente. Puede incluir información confidencial de acceso.',
    'credenciales.editar':'Permite agregar o modificar las credenciales guardadas del cliente.',
    'credenciales.eliminar':'Permite eliminar credenciales guardadas del cliente.',
    'ot.corregirMateriales':'Permite corregir productos de la orden de trabajo y sincronizarlos con su venta.',
    'ot.entregarMateriales':'Permite registrar entregas y devoluciones de materiales de la orden de trabajo.',
    'ot.rendirMateriales':'Permite rendir el uso de materiales de la orden de trabajo.',
    'soporte.resolver':'Permite registrar la resolución de un reclamo de soporte.',
    'empleados.aprobarMovimiento':'Permite aprobar o rechazar movimientos de cuentas del personal.',
    'empleados.eliminarMovimiento':'Permite eliminar movimientos de cuentas del personal.',
    'gastos.fijo':'Permite configurar los gastos fijos del sistema.',
    'mantenimiento.migrar':'Permite ejecutar herramientas de migración de datos.',
    'mantenimiento.limpiar':'Permite ejecutar herramientas de limpieza de datos antiguos.',
    'mantenimiento.duplicados':'Permite revisar y resolver registros duplicados desde mantenimiento.',
    'mantenimiento.normalizar':'Permite ejecutar herramientas de normalización de datos.',
    'actividad.limpiar':'Permite limpiar el registro de actividad del sistema.',
    'datos.seedDemo':'Permite crear datos de demostración desde las herramientas de mantenimiento.',
    'configuracion.editar':'Permite guardar ajustes generales del sistema. La edición de Roles continúa reservada a administradores activos.',
    'usuarios.impersonar':'Permite ingresar temporalmente como otro usuario para revisar su experiencia y permisos.',
    'auditoria.ver':'Permite consultar herramientas e informes de auditoría del sistema.',
    'dashboard.grafico':'Muestra el gráfico de ventas en el inicio.',
    'dashboard.otsPendientes':'Muestra las órdenes de trabajo pendientes en el inicio.',
    'dashboard.chat':'Muestra el botón de acceso al chat interno.',
    'dashboard.asistente':'Muestra el botón de acceso al asistente de ventas.',
    'dashboard.novedades':'Permite consultar las novedades y el historial de versiones.',
    'empleados.verComisionesPendientes':'Permite consultar las comisiones pendientes del personal.'
  };
  const templates = {
    ver:'Permite consultar los registros de {module}.',
    verDashboard:'Permite consultar los indicadores y resúmenes de {module}.',
    crear:'Permite crear nuevos registros en {module}.',
    editar:'Permite modificar los datos de registros existentes en {module}.',
    eliminar:'Permite eliminar registros de {module}. Revisá el registro antes de confirmar la eliminación.',
    anular:'Permite anular registros de {module} mediante su operación de anulación.',
    pagar:'Permite registrar pagos desde {module}.',
    registrar:'Permite registrar nuevos cobros en {module}.',
    verMargen:'Permite consultar el costo y margen comercial en {module}.'
  };
  const distributor = {
    chat:'Permite al rol Distribuidora utilizar el chat general y los mensajes directos.',
    detalle:'Permite abrir la ficha interna de productos del catálogo COMPRAS PARAGUAY.',
    editar:'Permite modificar los datos de productos de su catálogo COMPRAS PARAGUAY.',
    crear:'Permite crear productos en su catálogo COMPRAS PARAGUAY.',
    solicitudes:'Permite consultar solicitudes del catálogo y marcar su atención.'
  };
  function actionHelp(key, label, moduleLabel) {
    const entry = root.SISVENTAS_PERMISOS_ACCION?.[key];
    const template = templates[key.split('.').pop()];
    if(key.startsWith('interfaz.')) {
      const kind=key.includes('admin_only')?'de administración':key.includes('tecnico_only')?'técnicos':'operativos';
      return 'Muestra los controles '+kind+' de '+moduleLabel+' que normalmente se ocultan según el rol. Cada operación mantiene su autorización específica.';
    }
    return entry?.ayuda || actions[key] || (template && template.replace('{module}',moduleLabel)) || 'Habilita la acción «'+label+'» dentro de '+moduleLabel+'. Requiere que el módulo esté habilitado para ese rol.';
  }
  const api = {modules,actions,templates,distributor,actionHelp};
  if (typeof module !== 'undefined') module.exports = api;
  if (!root.document) return;
  const doc = root.document;
  let tooltip, active, hideTimer;
  function hide() {
    clearTimeout(hideTimer);
    if (active) active.removeAttribute('aria-describedby');
    active = null;
    if (tooltip) tooltip.hidden = true;
  }
  function show(button) {
    hide();
    if (!tooltip) {
      tooltip = doc.createElement('div');
      tooltip.id = 'sv-role-help-tooltip'; tooltip.className = 'sv-role-help-tooltip';
      tooltip.setAttribute('data-sv-escape-owner','true');
      tooltip.setAttribute('role','tooltip'); doc.body.appendChild(tooltip);
      tooltip.addEventListener('pointerenter',()=>clearTimeout(hideTimer));
      tooltip.addEventListener('pointerleave',()=>{hideTimer=setTimeout(hide,150);});
    }
    active = button; tooltip.textContent = button.dataset.roleHelp; tooltip.hidden = false;
    button.setAttribute('aria-describedby',tooltip.id);
    const rect = button.getBoundingClientRect(), box = tooltip.getBoundingClientRect();
    const left = Math.max(12,Math.min(rect.left,root.innerWidth-box.width-12));
    const top = rect.bottom+10+box.height <= root.innerHeight-12 ? rect.bottom+10 : Math.max(12,rect.top-box.height-10);
    tooltip.style.left=left+'px'; tooltip.style.top=top+'px';
  }
  function addHelp(target,label,text,moduleRow) {
    if (target.querySelector(':scope > .sv-role-help')) return;
    const button=doc.createElement('button'); button.type='button'; button.className='sv-role-help';
    button.textContent='i'; button.dataset.roleHelp=text;
    button.setAttribute('aria-label','Ayuda: '+label);
    if(moduleRow)target.classList.add('sv-role-help-module');
    target.appendChild(button);
  }
  function enhance(container) {
    container.querySelectorAll('tr[data-role-module]').forEach(row=>{
      const cell=row.cells[0],label=cell.querySelector('button > span > span')?.textContent.trim() || row.dataset.roleModule;
      addHelp(cell,label,modules[row.dataset.roleModule] || 'Permite abrir '+label+'. Las acciones de este módulo se habilitan por separado.',true);
    });
    container.querySelectorAll('tr[data-role-action-mod]').forEach(row=>{
      const cell=row.cells[0],key=row.querySelector('[data-perm]')?.dataset.perm;
      if(!key)return;
      const label=cell.textContent.trim(),moduleRow=container.querySelector('tr[data-role-module="'+row.dataset.roleActionMod+'"]');
      const moduleLabel=moduleRow?.querySelector('button > span > span')?.textContent.trim() || row.dataset.roleActionMod;
      addHelp(cell,label,actionHelp(key,label,moduleLabel));
    });
    container.querySelectorAll('input[data-permission]').forEach(input=>{
      const label=input.closest('label');if(label){
        const text=[...label.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
        input.setAttribute('aria-label',text);
        addHelp(label,text,distributor[input.dataset.permission] || 'Permiso del catálogo COMPRAS PARAGUAY.');
      }
    });
    const special=container.querySelector('[aria-label="Rol Compras Paraguay"] .card-title');
    if(special)addHelp(special,'Compras Paraguay',modules.compras_paraguay);
    const title=container.querySelector('[aria-label="Permisos de Distribuidora"] h3');
    if(title)addHelp(title,'Distribuidora',modules.distribuidora);
  }
  function start() {
    const container=doc.getElementById('cfg-roles-tabla');if(!container)return;
    const observer=new MutationObserver(()=>{observer.disconnect();if(active&&!active.isConnected)hide();enhance(container);observer.observe(container,{childList:true,subtree:true});});
    enhance(container);observer.observe(container,{childList:true,subtree:true});
    container.addEventListener('pointerover',event=>{const b=event.target.closest('.sv-role-help');if(b&&b!==active)show(b);else if(b)clearTimeout(hideTimer);});
    container.addEventListener('pointerout',event=>{if(event.target.closest('.sv-role-help')&&!event.relatedTarget?.closest('.sv-role-help,.sv-role-help-tooltip'))hideTimer=setTimeout(hide,150);});
    container.addEventListener('focusin',event=>{const b=event.target.closest('.sv-role-help');if(b)show(b);});
    container.addEventListener('focusout',event=>{if(event.target.closest('.sv-role-help'))hide();});
    container.addEventListener('click',event=>{const b=event.target.closest('.sv-role-help');if(b){event.preventDefault();event.stopPropagation();show(b);}});
    doc.addEventListener('keydown',event=>{if(event.key==='Escape'&&active){event.preventDefault();event.stopImmediatePropagation();hide();}},true);
    doc.addEventListener('sisventas:page-changed',hide);doc.addEventListener('sisventas:session-ended',hide);
    root.addEventListener('resize',hide);root.addEventListener('scroll',hide,true);
  }
  root.SVRolesHelp=api;
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window==='undefined'?{}:window);
