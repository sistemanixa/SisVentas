# Avisos y errores de texto · candidata v3.12.0

Rama codex/avisos-texto-v3120 desde e0b71d35ca523393af062b85feec5bc4fc19cf37. El siguiente número se obtuvo con siguiente-version.ps1: después de v3.11.20 corresponde v3.12.0. No se modifica la aplicación inmutable20. Servidor continúa cotizador-load-d849afb4 con Brotli y filtro del observador; no requiere despliegue de servidor, reglas, IAM o DNS.

## Corrección

notify() insertaba el mensaje como HTML. Ahora crea el icono y un nodo de texto; conserva estilo, icono de 15 px, duración de ocho segundos, duración explícita, sustitución y cierre del aviso anterior. Las etiquetas de un nombre/error se muestran literalmente y no crean elementos. La búsqueda acotada de llamadas explícitas en aplicación activa/core/módulos no encontró consumidores que requieran etiquetas; no equivale a certificar todas las cadenas construidas en ejecución.

El panel de diagnóstico anexaba event.message con innerHTML y reinterpretaba además todas las filas anteriores. Ahora anexa nodos, manteniendo colores y línea/columna como texto. El diseño de error de generarNotificaciones conserva su HTML estático y escapa el mensaje mediante la función existente. No cambia estados de lectura, presupuestos, comisiones ni el resultado de una operación.

## Verificación

- 1.778 pruebas generales aprobadas. Cinco pruebas nuevas con variantes de mensajes maliciosos, texto con ampersand/comparadores/comillas, duración y sustitución, contenedor ausente, dos errores de diagnóstico y error real del generador con mensaje no confiable. Los setters innerHTML de los dobles fallan si el aviso o panel intentan interpretar datos como marcado.
- scripts/dev-toast-safety.cjs sirve únicamente la función real de la aplicación activa, CSS y HTML ficticio en loopback con puerto libre, sin Firebase ni acceso al repositorio completo. CSP bloquea scripts embebidos y eval. Se comprobaron mensaje normal y etiquetas como texto: cero imágenes/scripts creados y el icono conservado. A ancho de iframe de 390 px: aviso de 287 px dentro del viewport de 390 px, borde derecho 374 px, sin salir de la pantalla. No es teclado/cámara físicos.
- La consola del contenedor de esa prueba móvil registró una excepción de MutationObserver. El JS servido de avisos y su contenedor no contienen MutationObserver; la fuente exacta no se atribuye sin stack. La operación y geometría se comprobaron, pero no se presenta ese contenedor como una prueba móvil libre de errores. La aplicación completa candidata no reprodujo la excepción y su consola no registró errores/warnings observados.
- Candidata completa con sesión propia, índice separado y servidor productivo actual: versión12, Notificaciones cargada, aviso formado por icono y nodo de texto, monitor de errores actualizado presente. No se dispararon errores ficticios ni se guardaron operaciones reales en esa sesión. Se conservaron las ventanas del titular; las pruebas de marcado fueron solo en fixture aislado.
- Sintaxis, diff y coherencia de índice/app/versiones/SW verificados. Novedades incluye la corrección. Evidencias privadas en tmp/avisos-v3120-*.png y avisos-v3120-tests.log, no publicarlas ni subirlas a Git.

## Límites de cierre

Esta corrección y la retirada de unsafe-eval no convierten toda la aplicación en una CSP estricta sin scripts/eventos embebidos: unsafe-inline sigue siendo una compatibilidad declarada. La separación de adjuntos/detalle comercial tampoco se activó: no eliminar documentos del DTO ni perderlos al editar/exportar. Las pruebas físicas de sesiones de empleados, teclado/cámara/sonido y plantillas bancarias privadas siguen necesitando participación del titular; no cambiar contraseñas ni cargar datos reales para reemplazar esa evidencia. No declarar una auditoría absoluta al 100% por una suite verde.
