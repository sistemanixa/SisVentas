// Panel debug — solo errores rojos
window.onerror = function(msg, src, line, col) {
  const log = document.getElementById('debug-log');
  if(log) {
    log.innerHTML += '<div style="color:red;border-bottom:1px solid #333;padding:2px 0">❌ '+msg+'<br><span style="color:#888">L'+line+':'+col+'</span></div>';
    // Panel oculto por defecto — activar manualmente si se necesita debug
  }
};
// (los que se crean dinámicamente con innerHTML, como filas de venta/presupuesto,
// se inicializan aparte con initMoneyInputsEn justo después de insertarse).
if (typeof initMoneyInputsEn === 'function') initMoneyInputsEn(document);
