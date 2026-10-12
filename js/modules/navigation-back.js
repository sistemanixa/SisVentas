/* Un solo retorno visible por módulo; respeta los retornos de sus vistas internas. */
(function(){
'use strict';
function svSincronizarVolverGlobal() {
  var barra = document.querySelector('.sv-retorno-modulo');
  if (!barra) return;
  var pagina = document.querySelector('.page.active');
  var propio = pagina && Array.from(pagina.querySelectorAll('button,a')).some(function(b) {
    return /^(?:[\s\uE000-\uF8FF←↩]*)(?:Volver|Atrás)(?:\s|$)/i.test(b.textContent.trim()) && _svElementoVisible(b);
  });
  var actual = pagina ? String(pagina.id || '').replace(/^page-/, '') : '';
  var anterior = (window._svHistorialPaginas || []).some(function(id) {
    return id && id !== actual && document.getElementById('page-' + id) && typeof window.permisoModulo === 'function' && window.permisoModulo(id);
  });
  var ocultar = actual === 'dashboard' || !!propio || !anterior;
  if (barra.hidden !== ocultar) barra.hidden = ocultar;
}
var _svVolverPendiente = false;
function svProgramarVolverGlobal() {
  if (_svVolverPendiente) return;
  _svVolverPendiente = true;
  requestAnimationFrame(function(){_svVolverPendiente=false;svSincronizarVolverGlobal();});
}
function start(){
  svSincronizarVolverGlobal();
  var contenido = document.querySelector('.content');
  if(contenido && window.MutationObserver) new MutationObserver(svProgramarVolverGlobal).observe(contenido,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','hidden']});
}

window.SVBackNavigation = Object.freeze({schedule:svProgramarVolverGlobal, sync:svSincronizarVolverGlobal});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
