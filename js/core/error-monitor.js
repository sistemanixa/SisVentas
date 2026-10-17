// Panel debug — solo errores rojos
window.addEventListener('error', function(event) {
  const log = document.getElementById('debug-log');
  if(log) {
    const row = document.createElement('div');
    row.style.cssText = 'color:red;border-bottom:1px solid #333;padding:2px 0';
    row.appendChild(document.createTextNode('❌ '+String(event.message||'')));
    row.appendChild(document.createElement('br'));
    const location = document.createElement('span');
    location.style.color = '#888';
    location.textContent = 'L'+event.lineno+':'+event.colno;
    row.appendChild(location);
    log.appendChild(row);
    // Panel oculto por defecto — activar manualmente si se necesita debug
  }
});
// (los que se crean dinámicamente con innerHTML, como filas de venta/presupuesto,
// se inicializan aparte con initMoneyInputsEn justo después de insertarse).
if (typeof initMoneyInputsEn === 'function') initMoneyInputsEn(document);
