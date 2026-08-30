// SisVentas PWA version publicada.
window.SISVENTAS_PWA_VERSION = 'v3.0.5';

// Única fuente de texto para todas las etiquetas visibles de versión.
// El comentario VERSION de index.html y los nombres inmutables continúan
// existiendo solo para despliegue/caché; la interfaz nunca los interpreta.
(function () {
  function aplicarVersionSisVentas(raiz) {
    raiz = raiz || document;
    var version = String(window.SISVENTAS_PWA_VERSION || '');
    var carga = raiz.getElementById ? raiz.getElementById('loading-version') : document.getElementById('loading-version');
    var login = raiz.getElementById ? raiz.getElementById('login-version-lbl') : document.getElementById('login-version-lbl');
    var menu = raiz.getElementById ? raiz.getElementById('up-version') : document.getElementById('up-version');
    var lateral = raiz.getElementById ? raiz.getElementById('s-version-el') : document.getElementById('s-version-el');
    if (carga) carga.textContent = version;
    if (login) login.textContent = version + ' · Firebase';
    if (menu) menu.textContent = version;
    if (lateral) lateral.textContent = version + ' · Firebase';
  }
  window.aplicarVersionSisVentas = aplicarVersionSisVentas;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { aplicarVersionSisVentas(document); });
  else aplicarVersionSisVentas(document);
})();
