# Cierre acotado: localizador canónico OT y comparación de doce materiales

Se adapta únicamente el puerto `io.locateCanonical()` del núcleo comprometido `fbc9abeb88ebd86321748ca44c98498cb4841be3`. La aplicación y las rutas continúan OFF; no hay nuevas arquitecturas, activaciones, publicación ni datos reales. La propiedad del núcleo y el empaquetado Docker quedan en integración central.

## Cambio del consumidor

`ot-material-state` consulta el localizador sólo cuando el núcleo de servidor lo ofrece. Antes de usarlo comprueba hash del original, selector, tres identidades y path del ledger. Inspecciona ese ledger ya acreditado y reconstruye la identidad del recibo con los candidatos verificados P/J/R. Mantiene íntegros los controles de historia por fila, OT/venta/recibo, cantidades, revisión, custodia y remitos del resto del comando.

No da por confirmada ni ausente la historia porque exista un mapping. Un recibo o revisión de fila incorrectos se siguen rechazando. Para un resultado sin mapping usa únicamente la referencia acreditada de esa misma fila e invocación al comprobar las tres claves; no ejecuta después una búsqueda por código que pueda reinterpretar el original. No hay caché nueva entre fases.

Cuando el localizador no existe o devuelve null se conserva el recorrido anterior completo: filas sólo con código y catálogos históricos ausentes mantienen su clasificación/fallback y sus rechazos. No se amplía el parser de código ni se inventa una clave canónica. OFF conserva el callback legado y sus lecturas exactas.

La exportación del laboratorio incorpora `office-stock-canonical-locator.js` con hash fijado. Su directorio pasa a `tmp/audit-front-d/corefbc9`; la prueba de expiración actualiza únicamente ese path de preparación, sin modificar el predicado de reglas ni repetir sus cinco casos largos. Los históricos de medición contra 02ee no se reescriben.

## Experimento único solicitado

Comando OT completo, 641 productos con ID numérico, 12 materiales, 138 resúmenes de otras OT, IO ficticio de 150 ms por solicitud, reloj real y lease original de 30 segundos. Una muestra, mismo escenario y autoridad ficticia que `4416e5c996f198cc6eeeeba9f4929b901c64dc3e`. En esta comparación P=J para que OFF y ON anteriores fueran comparables; la prueba funcional separada sí usa tres identidades distintas.

| Resultado | 4416 / núcleo 02ee | Localizador fbc9 |
|---|---:|---:|
| Tiempo completo | 12617 ms | 9584 ms |
| Solicitudes | 367 | 259 |
| Planificación | 120 | 84 |
| Revalidación fresca | 122 | 86 |
| Commit independiente | 113 | 77 |
| Máximo IO simultáneo | 6 | 6 |
| Commit ficticio | 1 | 1 |
| Plazo vencido | No | No |

Reducción observada: 3033 ms (24%) y 108 solicitudes (29,4%). Planificación 2840 ms, fresco 2674 ms y commit 2707 ms en la nueva muestra. Cada fase elimina 24 puntos de mapping por código y 12 ledgers por código: vínculos/recibos de dominio 60→36, inventarios 24→12. Conserva catálogo 12, activación 1 y recibos genéricos 12 en cada fase, además de la autorización y originales correspondientes. No reutiliza planificación en fresco ni en Store.

No se repitieron las otras ocho celdas. El benchmark admite `SV_OT_PROFILE_ROWS=12` y `SV_OT_PROFILE_MODES=ON-mapped` para ejecutar únicamente el caso seleccionado, manteniendo los defaults previos si no se especifican.

JSON privado `tmp/audit-front-d/ot-reference-locator-fbc9-12-150.json`, SHA-256 `24b127f9366c9f46dce8c0cd7eb794f71ed830126b09c4a2687ac1060546887d`. Conserva trazas por path/fase y huellas de código. Esto cierra el experimento conocido, **no demuestra una latencia productiva ni declara alcanzado un objetivo de velocidad**. La muestra anterior OFF de doce materiales fue 5404 ms; no se volvió a ejecutar ni se oculta esa diferencia.

## Validación y entrega

18 archivos de dominio: **269 PASS, cero fallos/omisiones/cancelaciones**, log privado `ot-locator-fbc-domain.log`. Incluye comparación de alias ausentes, fases separadas, límite seis, drenaje, OFF exacto, fallback histórico, tres identidades, recibo/remito preservados, rechazo de recibo y revisión incorrectos, conteo, replay, revocaciones y huérfanos. La sintaxis de los JS/CJS cambiados y diff se comprueban antes del commit; no se repite la puerta global del integrador.

El único cambio de producción de este bloque es el adaptador de identidad OT. No se edita el núcleo E, Store/guard, Docker compartido, SDK, permisos, versión, índice o SW. La prueba de expiración bajo reglas compuestas sigue documentada en `0e45dcfc`; no se altera su política para esta medición.

Permanecen explícitamente pendientes el cierre de todos los escritores de la cohorte, su correspondencia con reglas/manifiesto/pins, el empaquetado del módulo nuevo y la validación integrada del conjunto. **ON permanece OFF.** No inferir del commit local cambios de producción, permisos efectivos ni reparación de registros existentes.
