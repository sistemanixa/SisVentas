# Copias de trabajo recuperadas de archivos ignorados

Solo comparación histórica. No están conectadas a index.html, al Service Worker ni a ningún despliegue. No sustituir los módulos activos por estas copias.

| Destino | Origen local | Motivo |
| --- | --- | --- |
| `purchase-orders-unificacion-en-progreso.js` | `.local/purchase-orders-unificacion-en-progreso.js` | Borrador anterior de unificación de compras; no se encontró este contenido exacto en la historia local. El módulo vigente es `js/modules/purchase-orders.js`, más extenso y posterior. Falta determinar si queda alguna idea sin incorporar. |
| `asistente-inicial/index.js` | `tmp/asistente-source/index.js` | Copia inicial de trabajo no encontrada exactamente en la historia consultada. Puede carecer de protecciones actuales; comparar, no ejecutar ni desplegar. |
| `asistente-baseline/index.js`, `asistente-baseline/audio.cjs` | `tmp/security-assistant-source/` | Copias anteriores de la revisión de seguridad. No encontradas exactamente en la historia consultada; preservar para comparación, no son la implementación vigente. |
| `b2616cf9-functional.patch` | Commit local de respaldo `b2616cf9f4179eb003fce15559acea1cb8162feb`, ausente de los remotos consultados | Delta respecto de su padre para módulos, CSS, documentación y pruebas. Se omiten marcadores/versionado/publicación y un script de despliegue con ruta personal; su versión activa ya está en Git. No aplicar sobre main automáticamente. |
| `b2616cf9-app-delta.patch` | Mismo commit local; comparación entre el app v3.6.1 de su padre y el app v3.6.2 de esa copia | Conserva solo el delta funcional del monolito, en vez de subir otra instantánea completa. Los nombres de archivo del diff son auxiliares; no es un parche preparado para la versión actual. |

Se revisaron como fuentes sin claves o datos reales; los valores sensibles se obtenían de variables de entorno. No se trasladan paquetes, dependencias, archivos de entorno ni credenciales de esas carpetas. Las copias son deliberadamente un archivo histórico parcial, no servicios ejecutables.

Las carpetas antiguas de despliegue del cotizador y otras copias fiscales/IA sí se localizaron en la historia Git; no se duplican aquí. Véase el inventario de traslado.
