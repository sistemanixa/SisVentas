(function () {
  'use strict';
  var consulta = null;
  var secuencia = 0;
  function el(id) { return document.getElementById(id); }
  function esComprasParaguay(url) {
    try { return /^(?:www\.|mobile\.)?(?:comprasparaguai\.com\.br|comprasparaguay\.com\.ar)$/.test(new URL(url).hostname); } catch (_) { return false; }
  }
  async function consultarComprasParaguayDirecto(url, proveedor, signal) {
    var origen = new URL(url);
    function identidad(u) { var m=u.pathname.match(/^\/[^/]+?(_{1,2})(\d+)\/$/); return m ? m[1]+m[2] : ''; }
    if (origen.protocol !== 'https:' || origen.username || origen.password || origen.port || origen.search || origen.hash || !identidad(origen) || !esComprasParaguay(url) || !esComprasParaguay(proveedor.web)) throw new Error('Compras Paraguay requiere una URL exacta y su proveedor registrado.');
    async function leer(api) {
      var respuesta;
      try { respuesta=await fetch(api.href,{signal:signal,credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',headers:{Accept:'application/json'}}); }
      catch(error){if(error.name==='AbortError')throw error;throw new Error('No se pudo consultar Compras Paraguay desde este equipo. Revisá la conexión y volvé a intentar.');}
      if(!respuesta.ok || !/application\/json/i.test(respuesta.headers.get('content-type')||''))throw new Error('Compras Paraguay no permitió leer la ficha desde este equipo (HTTP '+respuesta.status+').');
      var data=await respuesta.json(),devuelta=data&&typeof data.url==='string'?new URL(data.url,api):null;
      if(!devuelta || devuelta.origin!==api.origin || devuelta.username || devuelta.password || identidad(devuelta)!==identidad(api) || devuelta.search || devuelta.hash)throw new Error('Compras Paraguay devolvió otro producto. No se aplicaron los datos.');
      return data;
    }
    var api=new URL(origen.pathname,'https://api.comprasparaguai.com.br'),d=await leer(api),modelo=null,ofertaUrl='';
    if(!identidad(origen).startsWith('__')) {
      modelo=d;
      if(d.ocultar_preco!==false || !Array.isArray(d.produtos))throw new Error('Compras Paraguay no informó ofertas públicas para este producto.');
      var ofertas=d.produtos.filter(function(p){
        if(!p || p.ocultar_preco!==false || p.disponivel===false || typeof p.preco_dolar!=='number' || !Number.isFinite(p.preco_dolar) || p.preco_dolar<=0 || !p.loja || !p.loja.nome || typeof p.url!=='string')return false;
        try {var u=new URL(p.url,api);return u.origin===api.origin&&!u.username&&!u.password&&!u.search&&!u.hash&&identidad(u).startsWith('__');}catch(_){return false;}
      }).sort(function(a,b){return a.preco_dolar-b.preco_dolar;});
      if(!ofertas.length)throw new Error('No hay ofertas públicas con precio para este producto.');
      var ofertaApi=new URL(ofertas[0].url,api);
      d=await leer(ofertaApi);
      ofertaUrl=new URL(ofertaApi.pathname,origen.origin).href;
    }
    if (typeof d.nome !== 'string' || !d.nome.trim() || !d.loja || typeof d.loja.nome !== 'string' || !d.loja.nome.trim() || d.ocultar_preco !== false || typeof d.preco_dolar !== 'number' || !Number.isFinite(d.preco_dolar) || d.preco_dolar <= 0 || typeof d.disponivel !== 'boolean') throw new Error('Compras Paraguay no confirmó un precio público en dólares para este producto.');
    var dolar = obtenerDolarReferenciaProducto();
    var cambio = Number(dolar && dolar.valor);
    var precio = Math.round(d.preco_dolar * cambio * 100) / 100;
    if (!(cambio > 0) || !Number.isFinite(precio)) throw new Error('Configurá una cotización válida del dólar en SisVentas.');
    var texto = function(v) { return typeof v === 'string' ? v.replace(/<[^>]*>/g, ' ').trim() : ''; };
    return {ok:true, url:url, identidad:{ok:true}, moneda:'ARS', precioArs:precio, precioPublicadoArs:precio, precioOriginal:d.preco_dolar, monedaOriginal:'USD', sinIva:false,
      conversion:{arsPorUsd:cambio, factor:cambio, dolarTipo:dolar.tipo, calculadaEn:Date.now()}, fuente:'compras_paraguay_api_navegador', tiendaOrigen:d.loja.nome, urlOferta:ofertaUrl,
      disponibilidadProveedor:d.disponivel ? 'disponible' : 'sin_stock', disponibilidadProveedorTexto:d.disponivel ? 'Disponible' : 'Sin stock',
      ficha:{nombre:texto(modelo && modelo.nome || d.nome), marca:texto(modelo && modelo.marca || d.marca), imagenUrl:modelo && (modelo.imagens_url?.[0]?.large || modelo.imagem_principal_url) || d.imagem_url && d.imagem_url.large || '', detalle:[texto(modelo && modelo.descricao || d.descricao)].concat((Array.isArray(d.caracteristicas) ? d.caracteristicas : []).filter(function(c){return c && typeof c.nome === 'string' && typeof c.valor === 'string';}).map(function(c){return texto(c.nome)+': '+texto(c.valor);})).filter(Boolean).join('\n')}
    };
  }
  function prepararComprasParaguay(seleccionarCategoria) {
    var panel = el('pf-envio-paraguay-panel');
    if (!panel && el('pf-importar-panel')) {
      panel = document.createElement('div');
      panel.id = 'pf-envio-paraguay-panel';
      panel.style.marginTop = '12px';
      panel.innerHTML = '<label for="pf-envio-paraguay">Costo de envío ARS</label><input id="pf-envio-paraguay" type="number" min="0" step="0.01" value="0" style="max-width:260px" oninput="actualizarEnvioComprasParaguay()"><div style="font-size:12px;color:var(--text3);margin-top:5px">Envío por producto, en pesos. Se suma al precio de la página convertido a ARS.</div>';
      el('pf-importar-panel').appendChild(panel);
    }
    var url = urlExacta(el('pf-cod-web').value);
    var activa = esComprasParaguay(url);
    if (panel) panel.hidden = !activa;
    if (panel && panel.dataset.url !== url) {
      var fila = prodProveedoresActuales.find(function(p) { return urlExacta(p.url) === url; });
      el('pf-envio-paraguay').value = fila ? Number(fila.costoEnvioArs) || 0 : 0;
      el('pf-envio-paraguay').setCustomValidity('');
      panel.dataset.url = url;
    }
    if (activa && seleccionarCategoria) {
      var categoria = el('pf-categoria');
      var opcion = Array.from(categoria.options).find(function(o) { return o.value.trim().toUpperCase() === 'COMPRAS PARAGUAY'; });
      if (opcion) {
        categoria.value = opcion.value;
        initSearchableSelect('pf-categoria', 'Seleccionar categoría...');
      }
      var iva = el('pf-iva');
      if (iva && iva.value !== '0') {
        iva.value = '0';
        if (typeof calcMargen === 'function') calcMargen();
      }
    }
  }
  window.actualizarEnvioComprasParaguay = function () {
    var input = el('pf-envio-paraguay');
    var valor = Number(input.value);
    input.setCustomValidity(Number.isFinite(valor) && valor >= 0 ? '' : 'El envío debe ser un importe igual o mayor que cero');
    if (!Number.isFinite(valor) || valor < 0) return;
    var url = urlExacta(el('pf-cod-web').value);
    prodProveedoresActuales.forEach(function(p, i) {
      if (esComprasParaguay(url) && urlExacta(p.url) === url) actualizarProveedorProducto(i, 'costoEnvioArs', valor);
    });
    renderTablaProveedoresProducto();
  };
  function estado(texto) { if (el('pf-importar-estado')) el('pf-importar-estado').textContent = texto; }
  function mensajeProveedor(proveedor, mensaje) {
    var texto = String(mensaje || 'No se pudo consultar la ficha');
    if (/mercado\s*libre/i.test(String(proveedor && proveedor.nombre || '')) && /verificaci[oó]n de seguridad|ML_VERIFICACION_SEGURIDAD|access_denied|API Mercado Libre respondi[oó] 403/i.test(texto)) {
      return 'Mercado Libre bloqueó la consulta automática de esta publicación. No se modificaron los datos. Podés abrir la URL y cargar la ficha y el precio manualmente.';
    }
    if (/nissei/i.test(String(proveedor && proveedor.nombre || '')) && /(?:redirigi[oó].*p[aá]gina diferente|verificaci[oó]n.*seguridad|bloque[oó].*consulta autom[aá]tica)/i.test(texto)) {
      return 'Nissei está bloqueando la lectura automática con su verificación de seguridad. El enlace es válido, pero por ahora el precio debe cargarse manualmente.';
    }
    return texto;
  }
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
  function mismoProveedorFila(pv, proveedor) {
    if (!pv || !proveedor) return false;
    var keyFila = String(pv.proveedorKey || pv.proveedorFbKey || pv.fbKey || pv.key || '');
    var keyProveedor = clave(proveedor);
    if (keyFila && keyProveedor && keyFila === keyProveedor) return true;
    return String(pv.nombre || pv.proveedor || '').trim().toLowerCase() === String(proveedor.nombre || '').trim().toLowerCase();
  }
  function dominioProveedor(proveedor) {
    var candidatos = [proveedor && proveedor.web, proveedor && proveedor.url, proveedor && proveedor.portal, proveedor && proveedor.sitio].filter(Boolean);
    for (var i = 0; i < candidatos.length; i++) {
      try { return new URL(normalizarUrlProveedorProducto(candidatos[i], proveedor.nombre || '')).hostname.replace(/^www\./, '').toLowerCase(); } catch (_) {}
    }
    return '';
  }
  function proveedorDeUrl(url) {
    if (!url) return null;
    var host = '';
    try { host = new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch (_) { return null; }
    var candidatos = proveedores().filter(function(p) { return dominioProveedor(p) === host || (esComprasParaguay(url) && esComprasParaguay('https://'+dominioProveedor(p)));  });
    return candidatos.length === 1 ? candidatos[0] : null;
  }
  function proveedorSugerido(url) {
    var asociados = (typeof prodProveedoresActuales !== 'undefined' ? prodProveedoresActuales : []).filter(function(p) {
      return urlExacta(p.url) === url;
    });
    var registrados = proveedores();
    var vinculados = registrados.filter(function(p) {
      return asociados.some(function(a) { return mismoProveedorFila(a, p); });
    });
    if (vinculados.length === 1) return vinculados[0];
    return proveedorDeUrl(url);
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
    return consulta === c && secuencia === c.id &&  el('prod-form-view') && getComputedStyle(el('prod-form-view')).display !== 'none' && firma() === c.firma;
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
    el('pf-importar-panel').hidden = false;
    var select = el('pf-importar-proveedor');
    select.replaceChildren(new Option('Seleccioná el proveedor', ''));
    proveedores().forEach(function (p) { select.add(new Option(p.nombre || 'Proveedor', clave(p))); });
    el('pf-cod-web').oninput = window.sugerirProveedorFicha;
    window.sugerirProveedorFicha(false);
    prepararComprasParaguay(false);
    var fila = prodProveedoresActuales.find(function(p) { return urlExacta(p.url) === urlExacta(el('pf-cod-web').value); });
    if (el('pf-envio-paraguay')) {
      el('pf-envio-paraguay').value = fila ? Number(fila.costoEnvioArs) || 0 : 0;
      el('pf-envio-paraguay').setCustomValidity('');
    }
  };
  window.sugerirProveedorFicha = function (aplicarValores) {
    prepararComprasParaguay(aplicarValores !== false);
    var url = urlExacta(el('pf-cod-web').value);
    if (!url) return;
    var sugerido = proveedorSugerido(url);
    if (sugerido) el('pf-importar-proveedor').value = clave(sugerido);
  };
  window.completarProductoDesdeUrl = async function () {
    if (consulta) return;
    var url = urlExacta(el('pf-cod-web').value);
    prepararComprasParaguay(true);
    if (esComprasParaguay(url) && !el('pf-envio-paraguay').reportValidity()) return;
    var proveedor = proveedores().find(function (p) { return clave(p) === el('pf-importar-proveedor').value; });
    if (!url) { estado('Pegá la URL exacta del producto. La web inicial del proveedor no sirve para esta consulta.'); return; }
    if (!proveedor) { estado('Seleccioná un proveedor registrado. Sus credenciales se usan desde el servidor.'); return; }
    if (el('pf-es-mano-obra').checked) { estado('La importación desde proveedor corresponde a productos.'); return; }
    // El alta comienza con una ficha vacía: evita mezclar dos productos al
    // cambiar la URL después de haber completado nombre, imagen o precios.
    if (!editingProdId && (['pf-nombre', 'pf-descripcion', 'pf-marca', 'pf-imagen-url'].some(function (id) { return el(id).value.trim(); }) || prodProveedoresActuales.some(function (p) { return Number(p.precio) > 0; }))) {
      estado('Para importar otra ficha, iniciá un nuevo producto. Los datos que ya completaste se conservan.'); return;
    }
    var indices = [];
    prodProveedoresActuales.forEach(function (p, i) { if (mismoProveedorFila(p, proveedor)) indices.push(i); });
    var indice = indices.find(function (i) { return urlExacta(prodProveedoresActuales[i].url) === url; });
    if (indice === undefined && indices.length === 1) indice = indices[0];
    if (indice === undefined && indices.length > 1) { estado('Hay varias filas de este proveedor. Colocá esta URL en la fila que querés actualizar y volvé a consultar.'); return; }
    var c = { id: ++secuencia, controlador: new AbortController(), firma: firma() };
    consulta = c;
    mostrarCarga(true);
    estado('Obteniendo ficha y precio de ' + proveedor.nombre + '. Esperá un momento; la consulta puede tardar hasta un minuto.');
    var timer = setTimeout(function () {
      c.controlador.abort();
      // La autenticación también puede quedar pendiente: abortar fetch solo
      // no alcanza. Invalidar la consulta impide aplicar respuestas tardías.
      if (consulta === c) {
        consulta = null;
        mostrarCarga(false);
        estado('La consulta demoró demasiado. Podés reintentar; no se modificaron los datos.');
      }
    }, 60000);
    try {
      var headers = await headersCotizadorProtegido();
      if (!vigente(c)) return;
      var respuesta, datos;
      if (esComprasParaguay(url)) {
        datos = await consultarComprasParaguayDirecto(url, proveedor, c.controlador.signal);
        respuesta = {ok:true};
      } else {
      respuesta = await fetch(SISVENTAS_FUNCTIONS.cotizadorProveedor + '/cotizar', {
        method: 'POST', headers: headers, signal: c.controlador.signal,
        body: JSON.stringify({ proveedorKey: clave(proveedor), url: url, incluirFicha: true, altaProducto: true, producto: '', codigo: '' })
      });
      datos = await respuesta.json();
      }
      if (!vigente(c)) { if (consulta === c) estado('La ficha cambió durante la consulta. No se aplicó el resultado; podés volver a consultar.'); return; }
      if (!respuesta.ok || !datos || !datos.ok) throw new Error(mensajeProveedor(proveedor, datos && (datos.mensaje || datos.error)));
      var ficha = datos.ficha;
      if (!ficha || !String(ficha.nombre || '').trim()) throw new Error('El cotizador no devolvió la ficha del producto. No se modificaron los campos.');
      if (urlExacta(datos.url) !== url || !datos.identidad || datos.identidad.ok !== true) throw new Error('La respuesta no confirmó el producto de la URL consultada');
      if (!(Number(datos.precioArs) > 0) || !Number.isFinite(Number(datos.precioArs)) || datos.moneda !== 'ARS') throw new Error('El proveedor no informó un precio válido en ARS');
      var precioProveedor = completarReferenciaProveedorProducto({
        nombre: proveedor.nombre, proveedorKey: clave(proveedor), url: url,
        ...(datos.tiendaOrigen ? {tiendaOrigen:datos.tiendaOrigen,urlOferta:datos.urlOferta || url} : {}),
        precio: Number(datos.precioArs), sinIva: datos.sinIva === true,
        ...(esComprasParaguay(url) ? { costoEnvioArs: Number(el('pf-envio-paraguay').value) || 0 } : {}),
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
      if (imagen) { if (typeof window.normalizarURLImagenProducto === 'function') imagen = window.normalizarURLImagenProducto(imagen); el('pf-imagen-url').value = imagen; actualizarPreviewImagenURL(imagen); }
      if (indice !== undefined) prodProveedoresActuales[indice] = precioProveedor;
      else prodProveedoresActuales.push(precioProveedor);
      renderTablaProveedoresProducto();
      recalcularCompraDesdeProveedores();
      var faltantes = [];
      if (!ficha.marca) faltantes.push('marca');
      if (!ficha.detalle) faltantes.push('detalle');
      if (!imagen) faltantes.push('imagen');
      estado('Ficha y precio cargados.' + (datos.tiendaOrigen ? ' Oferta de '+datos.tiendaOrigen+'.' : '') + ' Revisá la categoría y los datos antes de guardar.' + (faltantes.length ? ' El proveedor no informó: ' + faltantes.join(', ') + '.' : ''));
      var envio = el('pf-envio-paraguay');
      if (esComprasParaguay(url) && envio && !el('pf-envio-paraguay-panel').hidden) {
        envio.focus();
        envio.select();
      }
    } catch (error) {
      if (consulta === c) estado(error.name === 'AbortError' ? 'La consulta demoró demasiado. Podés reintentar; no se guardó ningún producto.' : mensajeProveedor(proveedor, error.message));
    } finally {
      clearTimeout(timer);
      if (consulta === c) { consulta = null; mostrarCarga(false); }
    }
  };
  window.urlExactaFichaProducto = urlExacta;
})();
