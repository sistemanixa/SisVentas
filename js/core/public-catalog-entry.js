/* Contexto de navegación; no concede sesión ni permisos de acceso. */
(function (root) {
  'use strict';
  const prefix = 'sv-catalog-entry:', lifetime = 60000;
  function createHref() {
    const url = new URL('catalogo.html', root.location.href);
    try {
      const now = Date.now(), storage = root.localStorage;
      for (let i = storage.length - 1; i >= 0; i--) {
        const key = storage.key(i);
        if (key.startsWith(prefix) && !(Number(storage.getItem(key)) > now)) storage.removeItem(key);
      }
      const token = root.crypto.randomUUID();
      storage.setItem(prefix + token, String(now + lifetime));
      url.searchParams.set('entrada', token);
    } catch (_) { /* Sin almacenamiento, abrir el catálogo sin regreso interno. */ }
    return url.href;
  }
  function consume() {
    const url = new URL(root.location.href), token = url.searchParams.get('entrada');
    let fromOffers = !token && !url.searchParams.has('desde') && root.history.state?.svCatalogFromOffers === true;
    if (token) {
      fromOffers = false;
      try {
        const key = prefix + token, expires = Number(root.localStorage.getItem(key)), now = Date.now();
        root.localStorage.removeItem(key);
        fromOffers = expires > now && expires <= now + lifetime;
      } catch (_) { /* Fallar cerrado: una URL por sí sola no habilita el enlace. */ }
    }
    url.searchParams.delete('entrada');
    url.searchParams.delete('desde');
    root.history.replaceState({ ...root.history.state, svCatalogFromOffers: fromOffers }, '', url.href);
    return fromOffers;
  }
  root.SVPublicCatalogEntry = Object.freeze({ createHref, consume });
})(window);
