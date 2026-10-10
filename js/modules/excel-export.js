(function(){
'use strict';
function generarExcel(titulo, boton) {
  boton = boton && boton.tagName === 'BUTTON' ? boton : null;
  var htmlAnterior = boton ? boton.innerHTML : '';
  if (boton) { boton.disabled = true; boton.innerHTML = '<i class="ti ti-loader-2"></i> Preparando Excel…'; }
  var restaurar = function(){ if (boton) { boton.disabled = false; boton.innerHTML = htmlAnterior; } };
  cargarSheetJS(function() {
    try {
    var wb = window.XLSX.utils.book_new();
    var rows = [];
    var nombre = (titulo || 'exportacion').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s_-]/g, '').trim();

    if (titulo === 'Listado de ventas' || titulo === 'Reporte de ventas') {
      rows = [['#','Cliente','Fecha','Total','Pago','Instalación']];
      (ventasList || []).forEach(function(v) {
        rows.push([v.id||'', v.cliente||'', v.fecha||'', parseFloat(v.total)||0, estadoPagoEfectivoVenta(v), v.estadoInst||'']);
      });

    } else if (titulo === 'Planilla de sueldos' || titulo === 'Reporte de empleados') {
      rows = [['Empleado','Cargo','Sueldo base','Comisiones','H. extra','Total']];
      Object.values(empData||{}).filter(function(e){ return e.activo !== false; }).forEach(function(e) {
        var base = parseFloat(e.sueldoBase)||0;
        var com  = parseFloat(e.comisiones)||0;
        var hex  = parseFloat(e.hextra)||0;
        rows.push([e.nombre||'', e.cargo||'', base, com, hex, base+com+hex]);
      });

    } else if (titulo === 'Gastos del período') {
      rows = [['Fecha','Descripción','Categoría','Tipo','Monto','Estado']];
      gastosFiltradosActuales().filter(gastoVisibleEnModuloGastos).forEach(function(g) {
        rows.push([fechaImputacionGasto(g).split('-').reverse().join('/'), g.descripcion || '', g.categoria || '', normalizarTipoGasto(g), parseFloat(g.monto) || 0, normalizarEstadoGasto(g)]);
      });

    } else {
      // Genérico: exportar la primera tabla visible de la página activa
      var activePage = document.querySelector('.page.active');
      if (!activePage) { notify('No hay datos para exportar'); return; }
      var tabla = activePage.querySelector('table');
      if (!tabla) { notify('No hay tabla para exportar'); return; }
      tabla.querySelectorAll('tr').forEach(function(tr) {
        rows.push(Array.from(tr.querySelectorAll('th,td')).map(function(c){ return c.textContent.trim(); }));
      });
    }

    if (rows.length <= 1) { notify('Sin datos para exportar'); return; }

    var ws = window.XLSX.utils.aoa_to_sheet(rows);
    // Ancho de columnas automático
    var cols = rows[0].map(function(_, i) {
      var max = rows.reduce(function(m,r){ return Math.max(m, String(r[i]||'').length); }, 10);
      return { wch: Math.min(max + 2, 40) };
    });
    ws['!cols'] = cols;
    window.XLSX.utils.book_append_sheet(wb, ws, nombre.slice(0,31));
    var archivo = nombre + '.xlsx';
    window.XLSX.writeFile(wb, archivo);
    notify('✓ ' + archivo + ' enviado a las descargas del navegador');
    } catch (e) {
      notify('No se pudo preparar el Excel: ' + (e.message || 'Error'));
    } finally {
      restaurar();
    }
  }, function(){ restaurar(); notify('No se pudo cargar el generador de Excel'); });
}
window.SVExcelExport = {exportar:generarExcel};
})();
