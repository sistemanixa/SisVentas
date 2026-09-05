# Alta de productos desde URL — 5 septiembre 2026

Implementación local, todavía sin desplegar. El frontend publicado sigue siendo v3.3.14 anterior a este cambio. Desplegar primero el cotizador y después preparar la siguiente versión del frontend.

## Flujo

Nuevo producto comienza por URL exacta y proveedor. Completar desde URL hace un solo POST /cotizar con incluirFicha y altaProducto. El servidor usa la cuenta registrada, obtiene precio y ficha en la misma página autenticada y devuelve nombre, marca, detalle, imagen, origen y campos faltantes. La interfaz carga un borrador; no guarda automáticamente ni reserva un código. Categoría, margen y demás decisiones siguen a cargo del usuario. La URL de un producto comercial nuevo es obligatoria; los servicios de mano de obra conservan su flujo.

Las cotizaciones existentes siguen comparando identidad. La importación vacía identifica la ficha por su URL para revisión del usuario. No se infieren atributos ausentes ni se buscan URLs alternativas. La cuenta se elige por proveedor registrado, nunca por el dominio que mande el cliente. Navegaciones de importación fuera de ese proveedor se bloquean.

## Verificación

- 56 pruebas focalizadas aprobadas: cotizador, alta desde URL, identidad, imágenes, marcas, códigos, precios por presentación y coherencia de versión.
- Sintaxis de aplicación, módulo nuevo y servicio correcta; git diff --check correcto.
- Consulta real autenticada en Biosegur del P2822 proporcionado por el usuario: nombre de cerradura Trinktech F-102T, marca TRINKTECH, descripción, imagen y precio ARS 109395 sin IVA, alícuota 21%. Los campos descriptivos llegaron completos. No se guardó ningún producto ni se agregó nada al carrito.
- URL de imagen extraída: HTTP 200, image/jpeg.
- Interfaz comprobada con el HTML real del formulario y la respuesta autenticada guardada como fixture local: escritorio y 390px, sin desbordamiento global. En esa prueba de interfaz la red/cotización y las funciones de precios fueron simuladas; no equivale a una prueba integral del sitio publicado ni del guardado en Firebase.
- Cobertura de resultados tardíos, cierre/reapertura, modificación durante la consulta, URL discordante, precio inválido y respuesta sin ficha.

El soporte descriptivo se extendió a los conectores existentes. Biosegur es el único con prueba real de esta funcionalidad; los demás requieren sus muestras. Proveedores nuevos siguen necesitando conexión específica: no se implementó todavía el asistente universal de incorporación de proveedores.

## Archivos

Backend: cotizador/ficha-producto.js, cotizador/index.js y Dockerfile. Frontend: js/modules/product-url-import.js, aplicación activa, index y Service Worker. Pruebas: cotizador/test/ficha-producto.test.js y test/producto-alta-url.test.js.

Evidencia local no publicada en tmp/: biosegur-p2822-consulta.json, producto-url-escritorio.png y producto-url-movil.png. Las credenciales no se guardaron en esos archivos.
