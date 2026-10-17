# Limpieza de versiones sin referencias

Realizada el17/10/2026 en `codex/limpieza-versiones-historicas`, desde `69d1b6c149e3fef81d21a706e249bd5e182b7cd2`, que ya está integrado en main y corresponde a la publicación v3.12.5.

Se retiraron **516 archivos**:258 pares de aplicación/marcador históricos, **725.366.708 bytes** del árbol de trabajo (aproximadamente725MB decimales). Se conservan los commits anteriores; esto no reduce por sí solo el tamaño del historial descargado en `.git`. No hubo reescritura de historial, push forzado, eliminación de ramas ni borrado de carpetas locales privadas.

Se conservan:

- La aplicación activa v3.12.5 y las dos publicaciones anteriores v3.12.4/v3.12.3, con sus marcadores, para compatibilidad y reversión.
- Las178 versiones adicionales que todavía referencian pruebas o herramientas y sus marcadores. No son alternativas activas de la aplicación. `js/app.js` también sigue siendo dependencia de pruebas antiguas.
- Todas las pruebas, incluidas126 instantáneas históricas excluidas de la puerta de publicación. No se retiró cobertura para permitir la limpieza.
- Servicios, módulos actuales, reglas candidatas, documentación, dependencias vendorizadas y evidencias privadas fuera de Git. La modificación local ajena de `C:/SisVentas/js/app.v3.10.33.js` sigue intacta en el checkout original.

## Criterio y comprobación

`scripts/plan-source-cleanup.cjs` inventaría solo archivos versionados y no borra nada. Escanea referencias de todos los tests y scripts, además del código/HTML/configuración; conserva tanto aplicación como marcador si alguno tiene consumidor. Los documentos y las propias copias de aplicación no cuentan como consumidores de ejecución. Las menciones históricas de documentación se recuperan mediante Git.

La revisión automática rechazó inicialmente una propuesta que también retiraba pruebas históricas. Se reemplazó por esta alternativa acotada: solo pares de versión sin referencias y cero pruebas borradas. No se fragmentó ni ejecutó la propuesta rechazada.

Después de retirar los archivos: **1.851 pruebas aprobadas**, coherencia local v3.12.5, sintaxis del inventariador y diff correctos. El plan posterior no propone otra eliminación. El paquete de Hosting continúa reteniendo exactamente las tres aplicaciones recientes. Esta limpieza no publica Hosting, no cambia el código activo ni guarda datos reales.

Para recuperar un archivo retirado, consultar el commit base con `git show 69d1b6c149e3fef81d21a706e249bd5e182b7cd2:js/app.VERSION.js` (sustituir VERSION por una versión del inventario). No restaurarlo encima de cambios locales desconocidos.

Próxima reducción posible: modernizar, por separado, las pruebas que leen snapshots históricos. Hasta comprobar equivalencia de cobertura, conservar sus dependencias. Para reducir también `.git` haría falta una reescritura coordinada distinta, que no se realizó.

## Pares retirados

Cada versión indicada corresponde a dos archivos: `js/app.VERSION.js` y `js/core/version.VERSION.js`.

- v2.0.183, v2.0.184, v2.0.185, v2.0.186, v2.0.187, v2.0.188, v2.0.189, v2.0.190
- v2.0.191, v2.0.192, v2.0.193, v2.0.194, v2.0.217, v2.0.218, v2.0.228, v2.0.229
- v2.0.243, v2.0.244, v2.0.245, v2.0.293, v2.0.296, v2.0.297, v2.0.300, v2.0.301
- v2.0.302, v2.0.303, v2.0.306, v2.0.307, v2.0.308, v2.0.309, v2.0.320, v2.0.322
- v2.0.323, v2.0.324, v2.0.332, v2.0.333, v2.0.368, v2.0.369, v2.0.370, v2.0.371
- v2.0.372, v2.0.374, v2.0.375, v2.0.376, v2.0.377, v2.0.378, v2.0.383, v2.0.384
- v2.0.385, v2.0.386, v2.0.387, v2.0.388, v2.0.389, v2.0.390, v2.0.391, v2.0.392
- v2.0.393, v2.0.394, v2.0.395, v2.0.396, v2.0.397, v2.0.398, v2.0.399, v2.1.0
- v2.1.1, v2.1.2, v2.2.0, v2.2.1, v2.2.2, v2.2.3, v2.2.4, v2.2.5
- v2.2.7, v2.2.8, v2.3.0, v2.3.1, v3.0.2, v3.0.3, v3.0.4, v3.0.5
- v3.0.6, v3.0.7, v3.0.8, v3.0.9, v3.0.11, v3.0.13, v3.1.0, v3.2.0
- v3.2.2, v3.3.0, v3.3.1, v3.3.2, v3.3.3, v3.3.8, v3.3.14, v3.3.16
- v3.3.17, v3.3.18, v3.3.19, v3.3.20, v3.3.21, v3.3.22, v3.3.23, v3.4.0
- v3.4.1, v3.4.2, v3.4.3, v3.4.4, v3.4.5, v3.4.6, v3.4.7, v3.5.0
- v3.5.1, v3.5.2, v3.5.3, v3.5.4, v3.5.5, v3.5.6, v3.5.7, v3.5.8
- v3.5.9, v3.5.10, v3.5.11, v3.5.15, v3.5.17, v3.5.18, v3.5.19, v3.5.20
- v3.5.21, v3.6.0, v3.6.1, v3.6.2, v3.6.4, v3.6.6, v3.6.7, v3.6.8
- v3.6.10, v3.6.12, v3.6.13, v3.6.14, v3.6.15, v3.6.16, v3.6.17, v3.6.18
- v3.6.20, v3.7.0, v3.7.1, v3.7.2, v3.7.3, v3.7.5, v3.7.9, v3.7.10
- v3.7.11, v3.7.12, v3.7.13, v3.7.14, v3.7.15, v3.7.16, v3.7.17, v3.7.18
- v3.7.19, v3.7.20, v3.7.21, v3.7.22, v3.7.23, v3.8.0, v3.8.1, v3.8.2
- v3.8.3, v3.8.4, v3.8.5, v3.8.6, v3.8.7, v3.8.8, v3.8.9, v3.8.10
- v3.8.11, v3.8.12, v3.8.13, v3.8.14, v3.8.15, v3.8.16, v3.8.17, v3.8.18
- v3.8.19, v3.8.20, v3.9.0, v3.9.1, v3.9.2, v3.9.3, v3.9.4, v3.9.5
- v3.9.7, v3.9.8, v3.9.9, v3.9.10, v3.9.11, v3.9.12, v3.9.13, v3.9.15
- v3.9.16, v3.9.17, v3.9.18, v3.9.19, v3.9.20, v3.9.21, v3.9.22, v3.9.23
- v3.9.24, v3.9.25, v3.9.26, v3.9.27, v3.9.28, v3.9.29, v3.10.0, v3.10.1
- v3.10.2, v3.10.3, v3.10.4, v3.10.5, v3.10.6, v3.10.7, v3.10.8, v3.10.9
- v3.10.10, v3.10.11, v3.10.12, v3.10.13, v3.10.14, v3.10.16, v3.10.17, v3.10.18
- v3.10.20, v3.10.21, v3.10.22, v3.10.24, v3.10.25, v3.10.26, v3.10.29, v3.10.34
- v3.10.35, v3.11.0, v3.11.7, v3.11.8, v3.11.9, v3.11.10, v3.11.11, v3.11.12
- v3.11.13, v3.11.14, v3.11.15, v3.11.16, v3.11.17, v3.11.18, v3.11.19, v3.11.20
- v3.12.0, v3.12.1
