(function() {
  'use strict';

  var MAX_ADJUNTO_BYTES = 900000;
  var MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;

  function fallo(mensaje) {
    var error = new Error(mensaje);
    error.esAdjuntoImagen = true;
    return error;
  }

  function leerComoDataUrl(blob, nombre) {
    return new Promise(function(resolve, reject) {
      var lector = new FileReader();
      var timer = setTimeout(function() {
        reject(fallo('La imagen demoró demasiado en prepararse. Probá nuevamente.'));
      }, 20000);
      lector.onload = function(evento) {
        clearTimeout(timer);
        resolve({
          nombre: nombre || blob.name || 'imagen.jpg',
          tipo: blob.type || 'image/jpeg',
          tamano: blob.size || 0,
          data: evento.target.result,
          ts: Date.now(),
          metodo: 'adjunto_base64'
        });
      };
      lector.onerror = function() {
        clearTimeout(timer);
        reject(fallo('No se pudo leer la imagen seleccionada.'));
      };
      lector.readAsDataURL(blob);
    });
  }

  function cargarImagen(file) {
    return new Promise(function(resolve, reject) {
      var url = URL.createObjectURL(file);
      var imagen = new Image();
      var timer = setTimeout(function() {
        URL.revokeObjectURL(url);
        reject(fallo('El formato de la imagen no se pudo preparar.'));
      }, 20000);
      imagen.onload = function() {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        resolve(imagen);
      };
      imagen.onerror = function() {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        reject(fallo('La imagen no es compatible. Usá JPG, PNG o WEBP.'));
      };
      imagen.src = url;
    });
  }

  function canvasBlob(canvas, calidad) {
    return new Promise(function(resolve, reject) {
      canvas.toBlob(function(blob) {
        if (blob) resolve(blob);
        else reject(fallo('No se pudo comprimir la imagen.'));
      }, 'image/jpeg', calidad);
    });
  }

  async function comprimirImagen(file, maxBytes) {
    if (file.size <= maxBytes) return file;
    var imagen = await cargarImagen(file);
    var anchoOriginal = imagen.naturalWidth || imagen.width;
    var altoOriginal = imagen.naturalHeight || imagen.height;
    var escalaInicial = Math.min(1, 1600 / Math.max(anchoOriginal, altoOriginal));
    var ancho = Math.max(1, Math.round(anchoOriginal * escalaInicial));
    var alto = Math.max(1, Math.round(altoOriginal * escalaInicial));
    var calidades = [0.82, 0.68, 0.54, 0.42];
    var ultimoBlob = null;

    for (var ronda = 0; ronda < 4; ronda++) {
      var canvas = document.createElement('canvas');
      canvas.width = ancho;
      canvas.height = alto;
      var contexto = canvas.getContext('2d', { alpha:false });
      if (!contexto) throw fallo('El dispositivo no pudo preparar la imagen.');
      contexto.fillStyle = '#fff';
      contexto.fillRect(0, 0, ancho, alto);
      contexto.drawImage(imagen, 0, 0, ancho, alto);
      for (var i = 0; i < calidades.length; i++) {
        ultimoBlob = await canvasBlob(canvas, calidades[i]);
        if (ultimoBlob.size <= maxBytes) return ultimoBlob;
      }
      ancho = Math.max(480, Math.round(ancho * 0.78));
      alto = Math.max(360, Math.round(alto * 0.78));
    }
    if (ultimoBlob && ultimoBlob.size <= maxBytes) return ultimoBlob;
    throw fallo('La imagen no pudo reducirse a menos de 900 KB. Probá con otra foto.');
  }

  async function prepararAdjuntoImagen(file, opciones) {
    opciones = opciones || {};
    if (!file) throw fallo('No se seleccionó ninguna imagen.');
    if (!String(file.type || '').startsWith('image/')) throw fallo('Seleccioná un archivo de imagen.');
    if (file.size > (opciones.maxOriginalBytes || MAX_ORIGINAL_BYTES)) throw fallo('La imagen original no puede superar 25 MB.');
    var maxBytes = opciones.maxBytes || MAX_ADJUNTO_BYTES;
    var preparado = await comprimirImagen(file, maxBytes);
    var nombre = file.name || 'imagen.jpg';
    if (preparado !== file) nombre = nombre.replace(/\.[^.]+$/, '') + '.jpg';
    var adjunto = await leerComoDataUrl(preparado, nombre);
    adjunto.tamanoOriginal = file.size || 0;
    adjunto.optimizada = preparado !== file;
    return adjunto;
  }

  function informarError(input, error) {
    if (input) input.value = '';
    if (typeof window.notify === 'function') window.notify(error && error.message ? error.message : 'No se pudo preparar la imagen.');
  }

  window.svPrepararAdjuntoImagen = prepararAdjuntoImagen;
  window.SV_FORMATO_IMAGEN = Object.freeze({ maxBytes:MAX_ADJUNTO_BYTES, metodo:'adjunto_base64' });

  var resolverFotoOtAnterior = window.otFotoUrlDeNota;
  window.otFotoUrlDeNota = function(nota) {
    if (nota && typeof nota === 'object') {
      var candidatos = [nota.foto, nota.imagen, nota.archivo, nota.adjunto, nota.comprobante];
      for (var i = 0; i < candidatos.length; i++) {
        if (candidatos[i] && candidatos[i].data) return String(candidatos[i].data);
      }
    }
    return typeof resolverFotoOtAnterior === 'function' ? resolverFotoOtAnterior(nota) : '';
  };

  window.otAgregarFoto = async function(input) {
    var file = input && input.files && input.files[0];
    if (!file) return;
    if (input.dataset.subiendo === '1') { window.notify('Esperá a que termine la foto anterior'); return; }
    var ot = (window.otData || []).find(function(item) { return item && (item.id === window.otActualId || item.fbKey === window.otActualId); });
    if (!ot || !window.fbDB) { informarError(input, fallo('No se encontró la OT abierta.')); return; }
    input.dataset.subiendo = '1';
    var pendiente = typeof window.otMostrarFotoPendiente === 'function' ? window.otMostrarFotoPendiente(file) : null;
    try {
      if (pendiente && pendiente.progreso) pendiente.progreso(0, 'Preparando imagen como comprobante…');
      else window.notify('Preparando imagen…');
      var adjunto = await prepararAdjuntoImagen(file);
      var textoInput = document.getElementById('ot-nota-nueva');
      var nota = {
        texto: textoInput && textoInput.value.trim() ? textoInput.value.trim() : 'Foto adjunta',
        autor: window.currentUser || 'Técnico',
        rol: window.currentRole || 'tecnico',
        ts: Date.now(),
        foto: adjunto,
        fotoMetodo: 'adjunto_base64',
        fotoNombre: adjunto.nombre,
        fotoTipo: adjunto.tipo,
        fotoTamano: adjunto.tamano,
        fotoTamanoOriginal: adjunto.tamanoOriginal,
        fotoOptimizada: adjunto.optimizada
      };
      var baseOts = window.FB_PATHS && window.FB_PATHS.ordenesTrabajo ? window.FB_PATHS.ordenesTrabajo : 'sisventas/ordenesTrabajo';
      var keyOt = ot.fbKey || window.otActualId;
      var refNota = window.fbPush(window.fbRef(window.fbDB, baseOts + '/' + keyOt + '/notasTecnico'));
      if (pendiente && pendiente.progreso) pendiente.progreso(100, 'Guardando imagen en la OT…');
      await window.fbSet(refNota, nota);
      nota._firebaseKey = refNota.key || '';
      var notas = typeof window.otNotasNormalizadas === 'function' ? window.otNotasNormalizadas(ot).slice() : [];
      notas.push(nota);
      ot.notasTecnico = notas;
      window._otDetalleHuella = JSON.stringify(ot);
      if (textoInput) textoInput.value = '';
      if (pendiente && pendiente.cerrar) pendiente.cerrar();
      if (typeof window.otRenderNotas === 'function') window.otRenderNotas(ot);
      window.notify('Foto guardada en la OT');
    } catch (error) {
      if (pendiente && pendiente.error) pendiente.error(error.message || 'No se pudo guardar la foto');
      informarError(input, error);
    } finally {
      input.dataset.subiendo = '0';
      input.value = '';
    }
  };

  window.chatEnviarFoto = async function(input) {
    var file = input && input.files && input.files[0];
    if (!file) return;
    try {
      window.notify('Preparando imagen…');
      var adjunto = await prepararAdjuntoImagen(file);
      await window.fbPush(window.fbRef(window.fbDB, 'sisventas/chat/' + window._chatCanal), {
        texto:'', fotoUrl:adjunto.data, foto:adjunto, autor:window.currentUser || '',
        rol:window.currentRole || '', ts:Date.now(), canal:window._chatCanal
      });
      window.notify('Imagen enviada');
    } catch (error) { informarError(input, error); }
    input.value = '';
  };

  window.previewImagenProducto = async function(input) {
    var file = input && input.files && input.files[0];
    if (!file) return;
    try {
      var adjunto = await prepararAdjuntoImagen(file);
      window.prodImagenArchivoTemp = null;
      window.prodImagenBase64Temp = adjunto.data;
      window.prodImagenUrlActual = adjunto.data;
      var urlInput = document.getElementById('pf-imagen-url');
      if (urlInput) urlInput.value = '';
      if (typeof window._mostrarPreviewImagenProducto === 'function') window._mostrarPreviewImagenProducto(adjunto.data);
    } catch (error) { informarError(input, error); }
  };

  window.previewFotoGasto = async function(input) {
    var file = input && input.files && input.files[0];
    if (!file) return;
    try {
      var adjunto = await prepararAdjuntoImagen(file);
      window.gastoFotoBase64 = adjunto.data;
      window.gastoFotoAdjunto = adjunto;
      var preview = document.getElementById('g-foto-preview');
      if (preview) preview.innerHTML = '<img src="' + adjunto.data + '" style="max-width:100%;border-radius:var(--radius);margin-top:6px">';
    } catch (error) { informarError(input, error); }
  };

  window.previewFotoGastoRapido = async function(input) {
    var file = input && input.files && input.files[0];
    if (!file) return;
    try {
      var adjunto = await prepararAdjuntoImagen(file);
      window.gastoRapidoFotoBase64 = adjunto.data;
      window.gastoRapidoFotoAdjunto = adjunto;
      var preview = document.getElementById('gr-foto-preview');
      if (preview) preview.innerHTML = '<img src="' + adjunto.data + '" style="max-width:100%;border-radius:var(--radius);margin-top:6px">';
    } catch (error) { informarError(input, error); }
  };

  window.onFotoSeleccionada = async function(input) {
    var file = input && input.files && input.files[0];
    if (!file) return;
    var nombre = document.getElementById('movi-foto-nombre');
    window._movEmpFotoLeyendo = true;
    if (nombre) nombre.textContent = 'Preparando ' + file.name + '…';
    try {
      var adjunto = await prepararAdjuntoImagen(file);
      window.movEmpFotoBase64 = adjunto.data;
      window.movEmpFotoAdjunto = adjunto;
      var preview = document.getElementById('movi-foto-preview');
      if (preview) { preview.src = adjunto.data; preview.style.display = 'block'; }
      if (nombre) nombre.textContent = adjunto.nombre;
    } catch (error) {
      window.movEmpFotoBase64 = null;
      informarError(input, error);
      if (nombre) nombre.textContent = 'No se pudo preparar la foto';
    } finally { window._movEmpFotoLeyendo = false; }
  };

  window.spPrepararEvidenciaNueva = function(input) {
    var archivo = input && input.files && input.files[0];
    if (!archivo) { if (typeof window.spQuitarEvidenciaNueva === 'function') window.spQuitarEvidenciaNueva(); return; }
    if (!String(archivo.type || '').startsWith('image/') || archivo.size > MAX_ORIGINAL_BYTES) {
      informarError(input, fallo('La evidencia debe ser una imagen de hasta 25 MB.'));
      return;
    }
    var imagen = document.getElementById('sp-nuevo-evidencia-img');
    var preview = document.getElementById('sp-nuevo-evidencia-preview');
    if (!imagen || !preview) return;
    if (imagen.dataset.objectUrl) URL.revokeObjectURL(imagen.dataset.objectUrl);
    imagen.dataset.objectUrl = URL.createObjectURL(archivo);
    imagen.src = imagen.dataset.objectUrl;
    preview.style.display = '';
  };

  window.spSubirEvidenciaNueva = function(archivo) {
    return prepararAdjuntoImagen(archivo).then(function(adjunto) {
      return { url:adjunto.data, path:null, nombre:adjunto.nombre, tipo:adjunto.tipo, bytes:adjunto.tamano, adjunto:adjunto, metodo:'adjunto_base64' };
    });
  };

  window.agregarFotosEquipo = function(input) {
    var files = Array.from((input && input.files) || []);
    Promise.all(files.map(function(file) { return prepararAdjuntoImagen(file); })).then(function(adjuntos) {
      window.eqFotosTemp = (window.eqFotosTemp || []).concat(adjuntos);
      var grid = document.getElementById('eq-fotos-grid');
      if (!grid) return;
      grid.querySelectorAll('.foto-placeholder').forEach(function(el) { el.remove(); });
      adjuntos.forEach(function(adjunto) {
        var img = document.createElement('img');
        img.src = adjunto.data;
        img.className = 'rel-foto-thumb';
        img.title = 'Foto lista para guardar';
        img.style.opacity = '.75';
        grid.appendChild(img);
      });
    }).catch(function(error) { informarError(input, error); });
    if (input) input.value = '';
  };

  window.subirFotosEquipo = function() {
    if (!window.equipoActual || !window.eqFotosTemp || !window.eqFotosTemp.length || !window.fbDB) return;
    var adjuntos = window.eqFotosTemp.slice();
    var ruta = 'sisventas/equipos/' + window.equipoActual + '/fotos';
    Promise.all(adjuntos.map(function(adjunto) {
      return window.fbPush(window.fbRef(window.fbDB, ruta), {
        url:adjunto.data, adjunto:adjunto, metodo:'adjunto_base64', fecha:new Date().toLocaleDateString('es-AR'), tecnico:window.currentUser || ''
      });
    })).then(function() {
      window.eqFotosTemp = [];
      window.notify('Equipo y fotos guardados');
      if (typeof window.volverListaEquipos === 'function') window.volverListaEquipos();
    }).catch(function(error) { window.notify('El equipo se guardó, pero una foto falló: ' + error.message); });
  };

  window.agregarFotosRel = function(input) {
    var files = Array.from((input && input.files) || []);
    Promise.all(files.map(function(file) { return prepararAdjuntoImagen(file); })).then(function(adjuntos) {
      window.relFotosTemp = (window.relFotosTemp || []).concat(adjuntos);
      var grid = document.getElementById('rel-fotos-grid');
      if (!grid) return;
      adjuntos.forEach(function(adjunto) {
        var img = document.createElement('img');
        img.src = adjunto.data;
        img.className = 'rel-foto-thumb';
        img.style.opacity = '.75';
        grid.appendChild(img);
      });
    }).catch(function(error) { informarError(input, error); });
    if (input) input.value = '';
  };

  window.guardarRelevamiento = function() {
    if (!window.equipoActual || !window.fbDB) { window.notify('Sin conexión'); return; }
    if (!window.relTipoSel) { window.notify('Seleccioná el tipo de intervención'); return; }
    var trabajoInput = document.getElementById('rel-trabajo');
    var trabajo = trabajoInput ? trabajoInput.value.trim() : '';
    if (!trabajo) { window.notify('Describí el trabajo realizado'); return; }
    var checks = {};
    document.querySelectorAll('#rel-checklist .check-item').forEach(function(el, i) {
      checks[i] = { texto:el.querySelector('span').textContent, ok:el.querySelector('input').checked };
    });
    var fotos = {};
    (window.relFotosTemp || []).forEach(function(adjunto, i) {
      fotos['foto_' + Date.now() + '_' + i] = { url:adjunto.data, adjunto:adjunto, metodo:'adjunto_base64', ts:Date.now() };
    });
    var intervencion = {
      tipo:window.relTipoSel, fecha:new Date().toISOString(), tecnico:window.currentUser || '', trabajo:trabajo,
      estado:window.relEstadoSel, proxVisita:(document.getElementById('rel-prox-visita') || {}).value || '', checks:checks, fotos:fotos
    };
    var path = 'sisventas/equipos/' + window.equipoActual + '/intervenciones';
    Promise.all([
      window.fbUpdate(window.fbRef(window.fbDB, 'sisventas/equipos/' + window.equipoActual), { estado:window.relEstadoSel }),
      window.fbPush(window.fbRef(window.fbDB, path), intervencion)
    ]).then(function() {
      window.relFotosTemp = [];
      window.notify('Relevamiento guardado');
      if (typeof window.cerrarRelevamiento === 'function') window.cerrarRelevamiento();
      setTimeout(function() { if (typeof window.abrirFichaEquipo === 'function') window.abrirFichaEquipo(window.equipoActual); }, 300);
    }).catch(function(error) { window.notify('Error: ' + error.message); });
  };
})();
