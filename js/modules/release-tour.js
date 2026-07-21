(function () {
  'use strict';

  var tours = {
    compras: [
      { selector: '#page-ordenes .metrics', titulo: 'Panorama de compras', texto: 'Acá ves cuánto se compró, qué materiales siguen en camino, qué quedó reservado para obras y qué ingresó al stock general.' },
      { selector: '#page-ordenes .oc2-tab[data-tab="lists"]', titulo: 'Listas de materiales', texto: 'Cada venta puede generar una lista de materiales. Desde ahí decidís qué ya tenés, qué comprar y cuál proveedor conviene.', antes: function () { if (typeof window.ocShowTab === 'function') window.ocShowTab('lists'); } },
      { selector: '#page-ordenes #oc2-lists', titulo: 'Compras nacidas de una venta', texto: 'Las listas conservan la venta y el cliente de destino. Al abrir una, podés revisar cantidades y agrupar automáticamente las órdenes por proveedor.' },
      { selector: '#page-ordenes .oc2-tab[data-tab="orders"]', titulo: 'Órdenes por proveedor', texto: 'Este acceso reúne las órdenes creadas para cada proveedor y permite seguir su estado hasta la recepción.', antes: function () { if (typeof window.ocShowTab === 'function') window.ocShowTab('orders'); } },
      { selector: '#page-ordenes #oc2-orders', titulo: 'Seguimiento y recepción', texto: 'Al abrir una orden podés marcarla como enviada y registrar entregas totales o parciales. El material recibido queda reservado para la obra correspondiente.' },
      { selector: '#page-ordenes [data-tour="orden-manual"]', titulo: 'También podés comprar manualmente', texto: 'Si la compra no nace de una venta, creala desde acá. Elegís un proveedor cargado, agregás materiales y la guardás como borrador.' }
    ]
  };

  var estado = { id: '', pasos: [], indice: 0, objetivo: null };

  function asegurarElementos() {
    if (!document.getElementById('sv-tour-style')) {
      var style = document.createElement('style');
      style.id = 'sv-tour-style';
      style.textContent =
        '#sv-tour-spot{position:fixed;z-index:100020;border:2px solid var(--green);border-radius:12px;box-shadow:0 0 0 9999px rgba(4,8,16,.72),0 0 0 5px rgba(61,220,132,.18);pointer-events:none;transition:all .22s ease}' +
        '#sv-tour-card{position:fixed;z-index:100021;width:min(370px,calc(100vw - 24px));background:var(--bg2);border:1px solid var(--border2);border-radius:14px;box-shadow:0 18px 55px rgba(0,0,0,.55);padding:16px;color:var(--text)}' +
        '#sv-tour-card .sv-tour-kicker{font-size:10px;color:var(--green);font-weight:800;letter-spacing:.7px;text-transform:uppercase;margin-bottom:6px}' +
        '#sv-tour-card .sv-tour-title{font-size:16px;font-weight:750;margin-bottom:7px;padding-right:25px}' +
        '#sv-tour-card .sv-tour-text{font-size:13px;line-height:1.5;color:var(--text2)}' +
        '#sv-tour-card .sv-tour-actions{display:flex;align-items:center;gap:7px;margin-top:15px}' +
        '#sv-tour-card button{font-family:inherit}' +
        '#sv-tour-close{position:absolute;right:10px;top:9px;border:0;background:transparent;color:var(--text3);cursor:pointer;font-size:18px}' +
        '@media(max-width:600px){#sv-tour-card{left:12px!important;right:12px!important;bottom:12px!important;top:auto!important;width:auto!important}#sv-tour-spot{transition:none}}';
      document.head.appendChild(style);
    }
    if (!document.getElementById('sv-tour-spot')) {
      var spot = document.createElement('div'); spot.id = 'sv-tour-spot'; document.body.appendChild(spot);
    }
    if (!document.getElementById('sv-tour-card')) {
      var card = document.createElement('div'); card.id = 'sv-tour-card'; document.body.appendChild(card);
    }
  }

  function cerrar(completado) {
    ['sv-tour-spot','sv-tour-card'].forEach(function (id) { var el = document.getElementById(id); if (el) el.remove(); });
    if (completado && estado.id) {
      try { localStorage.setItem('sisventas_tour_' + estado.id, '1'); } catch (e) {}
    }
    estado = { id: '', pasos: [], indice: 0, objetivo: null };
    window.removeEventListener('resize', reposicionar);
    window.removeEventListener('scroll', reposicionar, true);
  }

  function ubicarTarjeta(rect) {
    var card = document.getElementById('sv-tour-card');
    if (!card) return;
    var margen = 12;
    var ancho = Math.min(370, window.innerWidth - margen * 2);
    card.style.width = ancho + 'px';
    card.style.left = Math.max(margen, Math.min(rect.left, window.innerWidth - ancho - margen)) + 'px';
    card.style.right = 'auto'; card.style.bottom = 'auto';
    var alto = card.offsetHeight || 220;
    var debajo = rect.bottom + margen;
    card.style.top = (debajo + alto <= window.innerHeight - margen ? debajo : Math.max(margen, rect.top - alto - margen)) + 'px';
  }

  function reposicionar() {
    if (!estado.objetivo || !document.body.contains(estado.objetivo)) return;
    var rect = estado.objetivo.getBoundingClientRect();
    var pad = 6;
    var spot = document.getElementById('sv-tour-spot');
    if (!spot) return;
    spot.style.left = Math.max(4, rect.left - pad) + 'px';
    spot.style.top = Math.max(4, rect.top - pad) + 'px';
    spot.style.width = Math.max(24, Math.min(window.innerWidth - 8, rect.width + pad * 2)) + 'px';
    spot.style.height = Math.max(24, Math.min(window.innerHeight - 8, rect.height + pad * 2)) + 'px';
    ubicarTarjeta(rect);
  }

  function renderPaso() {
    var paso = estado.pasos[estado.indice];
    if (!paso) { cerrar(true); return; }
    if (typeof paso.antes === 'function') paso.antes();
    setTimeout(function () {
      var objetivo = document.querySelector(paso.selector);
      if (!objetivo) {
        if (estado.indice < estado.pasos.length - 1) { estado.indice += 1; renderPaso(); } else cerrar(true);
        return;
      }
      estado.objetivo = objetivo;
      objetivo.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      asegurarElementos();
      var card = document.getElementById('sv-tour-card');
      var ultimo = estado.indice === estado.pasos.length - 1;
      card.innerHTML =
        '<button id="sv-tour-close" onclick="cerrarRecorridoNovedad()" aria-label="Cerrar recorrido"><i class="ti ti-x"></i></button>' +
        '<div class="sv-tour-kicker">Recorrido · Paso ' + (estado.indice + 1) + ' de ' + estado.pasos.length + '</div>' +
        '<div class="sv-tour-title">' + paso.titulo + '</div>' +
        '<div class="sv-tour-text">' + paso.texto + '</div>' +
        '<div class="sv-tour-actions"><button class="btn btn-sm" onclick="recorridoNovedadAnterior()" ' + (estado.indice === 0 ? 'disabled' : '') + '><i class="ti ti-arrow-left"></i> Anterior</button><span style="flex:1"></span><button class="btn btn-sm btn-primary" onclick="recorridoNovedadSiguiente()">' + (ultimo ? 'Finalizar <i class="ti ti-check"></i>' : 'Siguiente <i class="ti ti-arrow-right"></i>') + '</button></div>';
      setTimeout(reposicionar, 80);
    }, 120);
  }

  function iniciar(id) {
    var pasos = tours[id];
    if (!pasos || !pasos.length) return;
    cerrar(false);
    estado = { id: id, pasos: pasos, indice: 0, objetivo: null };
    window.addEventListener('resize', reposicionar);
    window.addEventListener('scroll', reposicionar, true);
    renderPaso();
  }

  window.iniciarRecorridoNovedad = iniciar;
  window.cerrarRecorridoNovedad = function () { cerrar(false); };
  window.recorridoNovedadSiguiente = function () { estado.indice += 1; renderPaso(); };
  window.recorridoNovedadAnterior = function () { if (estado.indice > 0) estado.indice -= 1; renderPaso(); };
  window.addEventListener('keydown', function (event) {
    if (!estado.id) return;
    if (event.key === 'Escape') cerrar(false);
    if (event.key === 'ArrowRight') window.recorridoNovedadSiguiente();
    if (event.key === 'ArrowLeft') window.recorridoNovedadAnterior();
  });
})();
