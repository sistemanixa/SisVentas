> Integración final aplicada y publicada en v3.21.15: módulo en índice/SHELL y selector en impresión del monolito. Verificación HTTPS de bytes de producción completa; CORS funcional probado con recursos ficticios, no se modificaron archivos ni permisos Storage reales.

# Integración de medios en la aplicación nueva

Base inspeccionada: `9cbe59dd`, aplicación activa `v3.21.12`. El coordinador aplica el cambio a su nueva aplicación inmutable; no se edita ni publica la versión histórica.

1. Cargar `js/core/product-media-source.v1.js` antes de la aplicación activa, e incluir exactamente la misma URL en el `SHELL` del Service Worker.
2. En `urlImagenCapturablePresupuesto(src)`, inmediatamente después de `if (parsed.origin === location.origin) return parsed.href;`, insertar:

```js
      var imagenFirebase = window.SVProductMediaSource?.direct(parsed.href);
      if (imagenFirebase) return imagenFirebase;
```

La función exterior `imagenEmbebidaPresupuesto` conserva el `fetch` con modo CORS, comprobación de estado y MIME `image/*`, y conversión mediante FileReader. El único cambio es evitar `/imagen-producto` para una URL de descarga ya existente de un bucket del proyecto. Proveedores, URLs de otra cuenta, URL sin token, imágenes inline y fuentes del mismo origen mantienen su comportamiento anterior. No hay escritura ni cambio de un histórico.

No se modifica `urlImagenProductoParaArchivo`: su llamador sólo archiva proveedores remotos y ya excluye Firebase. Tampoco se mueve el proxy de terceros, que mantiene CORS, límites, validación del destino final y MIME.

## Evidencia

18 pruebas PASS: 17 del selector y una de Chromium con las funciones reales de impresión leídas desde la aplicación activa. La versión anterior hace un pedido al proxy que responde400; la integrada convierte la imagen PNG sintética a Data URL, con cero pedidos adicionales al proxy. Otra fuente HTTP de loopback entrega la imagen con CORS anónimo permitido; quitar esa cabecera hace que Chromium bloquee la lectura y la función conserva su salida de error anterior. La URL Firebase inicial se intercepta y redirige al archivo de prueba: no se contactó Storage real, ni se probó su configuración remota, ni se hizo una operación financiera.

El módulo sólo permite el bucket configurado en `js/core/firebase.js`: `nixa-sisventas.firebasestorage.app`. No se supone que exista un bucket histórico `appspot.com`. La conversión mantiene el estado/MIME comprobado por el llamador; un rechazo real de Storage no se transforma en acceso permitido.
