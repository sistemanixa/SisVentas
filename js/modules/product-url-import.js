(function () {
  'use strict';
  var consulta = null;
  var secuencia = 0;
  function el(id) { return document.getElementById(id); }
  function estado(texto) { if (el('pf-importar-estado')) el('pf-importar-estado').textContent = texto; }
  function mostrarCarga(activa) {
    var boton = el('pf-importar-boton');
    if (!boton) return;
    boton.disabled = activa;
    boton.textContent = activa ? 'Consultando al proveedor…' : 'Completar desde URL';
  }
  function clave(p) { return String(p.fbKey || p.key || p.id || ''); }
  function proveedores() { return (window.proveedoresData || (typeof proveedoresData !== 'undefined' ? proveedoresData : []) || []).filter(function (p) { return p && p.activo !== false && clave(p); }); }
  function urlExacta(valor) {
    try {
      var url = new URL(String(valor || '').trim());
      if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port || !url.hostname.includes('.') || /^\d|\[/.test(url.hostname)) return '';
      if ((url.pathname === '/' && !url.search) || /\.(jpg|jpeg|png|webp|pdf)$/i.test(url.pathname) || /^\/(ingresar|login|mi-cuenta|categorias?)\/?$/i.test(url.pathname)) return '';
      return url.href;
    } catch (_) { return ''; }
  }
  function firma() {
    var form = el('prod-form-view');
    return JSON.stringify({
      producto: String(editingProdId || ''),
      campos: Array.from(form.querySelectorAll('input,select,textarea')).map(function (n) { return [n.id, n.value, n.checked]; }),
      proveedores: prodProveedoresActuales
    });
  }
  function vigente(c) {
    return consulta === c && secuencia === c.id && !editingProdId && el('prod-form-view') && getComputedStyle(el('prod-form-view')).display !== 'none' && firma() === c.firma;
  }
  window.cancelarFichaProducto = function () {
    secuencia++;
    if (consulta) consulta.controlador.abort();
    consulta = null;
    mostrarCarga(false);
    estado('');
  };
  window.productoFichaConsultando = function () { return !!consulta; };
  window.inicializarFichaProducto = function () {
    window.cancelarFichaProducto();
    if (!el('pf-importar-panel')) return;
    el('pf-importar-panel').hidden = !!editingProdId;
    var select = el('pf-importar-proveedor');
    select.replaceChildren(new Option('Seleccioná el proveedor', ''));
    proveedores().forEach(function (p) { select.add(new Option(p.nombre || 'Proveedor', clave(p))); });
  };
  window.sugerirProveedorFicha = function () {
    var url = urlExacta(el('pf-cod-web').value);
    if (!url) return;
    var host = new URL(url).hostname.replace(/^www\./, '');
    var candidatos = proveedores().filter(function (p) {
      try {
        var web = new URL(normalizarUrlProveedorProducto(p.web || p.url || p.portal || p.sitio || ''));
        return web.hostname.replace(/^www\./, '') === host;
      } catch (_) { return false; }
    });
    if (candidatos.length === 1) el('pf-importar-proveedor').value = clave(candidatos[0]);
  };
  window.completarProductoDesdeUrl = async function () {
    if (consulta || editingProdId) return;
    var url = urlExacta(el('pf-cod-web').value);
    var proveedor = proveedores().find(function (p) { return clave(p) === el('pf-importar-proveedor').value; });
    if (!url) { estado('Pegá la URL exacta del producto. La web inicial del proveedor no sirve para esta consulta.'); return; }
    if (!proveedor) { estado('Seleccioná un proveedor registrado. Sus credenciales se usan desde el servidor.'); return; }
    if (el('pf-es-mano-obra').checked) { estado('La importación desde proveedor corresponde a productos.'); return; }
    // El alta comienza con una ficha vacía: evita mezclar dos productos al
    // cambiar la URL después de haber completado nombre, imagen o precios.
    if (['pf-nombre', 'pf-descripcion', 'pf-marca', 'pf-imagen-url'].some(function (id) { return el(id).value.trim(); }) || prodProveedoresActuales.some(function (p) { return Number(p.precio) > 0; })) {
      estado('Para importar otra ficha, iniciá un nuevo producto. Los datos que ya completaste se conservan.'); return;
    }
    var c = { id: ++secuencia, controlador: new AbortController(), firma: firma() };
    consulta = c;
    mostrarCarga(true);
    estado('Obteniendo ficha y precio de ' + proveedor.nombre + '. Esperá un momento; la consulta puede tardar hasta un minuto.');
    var timer = setTimeout(function () { c.controlador.abort(); }, 60000);
    try {
      var headers = await headersCotizadorProtegido();
      if (!vigente(c)) return;
      var respuesta = await fetch(SISVENTAS_FUNCTIONS.cotizadorProveedor + '/cotizar', {
        method: 'POST', headers: headers, signal: c.controlador.signal,
        body: JSON.stringify({ proveedorKey: clave(proveedor), url: url, incluirFicha: true, altaProducto: true, producto: '', codigo: '' })
      });
      var datos = await respuesta.json();
      if (!vigente(c)) { if (consulta === c) estado('La ficha cambió durante la consulta. No se aplicó el resultado; podés volver a consultar.'); return; }
      if (!respuesta.ok || !datos || !datos.ok) throw new Error(datos && (datos.mensaje || datos.error) || 'No se pudo consultar el producto');
      var ficha = datos.ficha;
      if (!ficha || !String(ficha.nombre || '').trim()) throw new Error('El cotizador no devolvió la ficha del producto. No se modificaron los campos.');
      if (urlExacta(datos.url) !== url || !datos.identidad || datos.identidad.ok !== true) throw new Error('La respuesta no confirmó el producto de la URL consultada');
      if (!(Number(datos.precioArs) > 0) || !Number.isFinite(Number(datos.precioArs)) || datos.moneda !== 'ARS') throw new Error('El proveedor no informó un precio válido en ARS');
      var precioProveedor = completarReferenciaProveedorProducto({
        nombre: proveedor.nombre, proveedorKey: clave(proveedor), url: url,
        precio: Number(datos.precioArs), sinIva: datos.sinIva === true,
        precioPublicadoOriginalArs: Number(datos.precioPublicadoArs || datos.precioArs),
        ...(datos.conversion ? {precioOriginal:datos.precioOriginal,monedaOriginal:datos.monedaOriginal,conversion:datos.conversion} : {}),
        descuentoProveedorPorcentaje: Number(datos.descuentoProveedorPorcentaje || 0),
        ivaAlicuota: datos.ivaAlicuota, actualizado: new Date().toISOString().slice(0, 10),
        actualizadoEn: Date.now(), actualizadoOrigen: datos.fuente || 'consulta-url-exacta',
        disponibilidadProveedor: datos.disponibilidadProveedor || 'no_verificado',
        disponibilidadProveedorTexto: datos.disponibilidadProveedorTexto || 'No verificado'
      }, url, datos.fuente || 'consulta-url-exacta');
      el('pf-nombre').value = String(ficha.nombre).toUpperCase();
      el('pf-marca').value = String(ficha.marca || '').toUpperCase();
      el('pf-descripcion').value = String(ficha.detalle || '');
      var imagen = '';
      try { var destino = new URL(ficha.imagenUrl); if (/^https?:$/.test(destino.protocol) && !destino.username && !destino.password) imagen = destino.href; } catch (_) {}
      if (imagen) { el('pf-imagen-url').value = imagen; actualizarPreviewImagenURL(imagen); }
      var indice = prodProveedoresActuales.findIndex(function (p) {
        return String(p.proveedorKey || p.proveedorFbKey || '') === clave(proveedor) && (!p.url || urlExacta(p.url) === url);
      });
      if (indice >= 0) prodProveedoresActuales[indice] = precioProveedor;
      else prodProveedoresActuales.push(precioProveedor);
      renderTablaProveedoresProducto();
      recalcularCompraDesdeProveedores();
      var faltantes = [];
      if (!ficha.marca) faltantes.push('marca');
      if (!ficha.detalle) faltantes.push('detalle');
      if (!imagen) faltantes.push('imagen');
      estado('Ficha y precio cargados. Revisá la categoría y los datos antes de guardar.' + (faltantes.length ? ' El proveedor no informó: ' + faltantes.join(', ') + '.' : ''));
    } catch (error) {
      if (consulta === c) estado(error.name === 'AbortError' ? 'La consulta demoró demasiado. Podés reintentar; no se guardó ningún producto.' : String(error.message || 'No se pudo consultar la ficha'));
    } finally {
      clearTimeout(timer);
      if (consulta === c) { consulta = null; mostrarCarga(false); }
    }
  };
  window.urlExactaFichaProducto = urlExacta;
})();
