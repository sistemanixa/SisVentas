# Directorio: lecturas simultáneas medidas

Base: 37e1cbab93eb73b429f1997a28544a22436e4a95, v3.21.15. Trabajo aislado; sin publicación ni acceso remoto.

## Hallazgo y contrato

El refresco de `SVUserDirectory` ya compartía suscriptores, pero `read()` y `adminProfile()` hacían consultas independientes. En la aplicación activa los llamadores son `fbCargarUsuarios` → `start`, `editarUsuario` → `adminProfile`, y el selector de participantes → `read`. El inventario de rutas anterior corresponde a v3.21.12: sus cifras no son una medición del recorrido actual.

Ahora las consultas **en curso** a la misma proyección comparten transporte si coinciden objeto de usuario autenticado, usuario visualizado, rol y generación. No se conserva caché de respuestas completadas. Cada consumidor comprueba su contexto y recibe objetos separados. Directorio mínimo y administración nunca se mezclan. `stop`/fin de sesión invalidan los pendientes. Perfil con cancelación conserva su implementación. Una señal de cambios sigue pudiendo pedir un refresco posterior: no se eliminó su invalidación.

No cambia autorización servidor, readiness, suscripciones, CAS, escrituras ni reglas. No agrega intervalos. No mueve datos privados a Firebase directo.

## Medición reproducible

`node scripts/measure-user-directory-reads.cjs` compara el archivo original obtenido de Git con el archivo actual, ambos contra un servidor HTTP propio ligado a 127.0.0.1, con 60 usuarios ficticios y demora fija de 15ms. Ejecuta suscripción + dos lecturas mínimas + dos fichas administrativas simultáneas y comprueba las proyecciones recibidas.

| Métrica | Base | Modificado |
|---|---:|---:|
| Solicitudes HTTP | 5 | 2 |
| Bytes de cuerpo JSON recibidos | 30.595 | 12.632 |
| Duración observada en una ejecución | 90,29ms | 29,71ms |
| Solicitudes adicionales en ventana de reposo 40ms | 0 | 0 |

La reducción de solicitudes es 60%; la de bytes 58,7%. El tiempo depende de Node, conexión inicial y planificación local: **no acredita mejora de latencia en producción**. Los bytes excluyen cabeceras/TLS y no representan lecturas facturadas RTDB. La ventana de reposo acotada no equivale a una sesión larga. El servidor real continúa validando identidad y permisos por cada transporte.

Pruebas focales cubren objetos independientes, ausencia de caché posterior, separación administrativa, logout tardío, cambio de rol y reintento tras error. Comprobar composición y UI integrada corresponde al coordinador; no se recorrieron formularios reales ni se publicó el cambio.

## Siguientes candidatos y límites

| Candidato | Estado comprobado | Siguiente paso |
|---|---|---|
| Capacidades financieras | `financial-commands.js` ya comparte promesa por sesión | No duplicar mejora; medir ramas especiales con sus dueños antes de cambiar invalidación |
| Perfil de ingreso | `security-storage.js` ya comparte preparación en curso | Mantener cancelación; falta medición integral de ingreso |
| Notas de cliente | Coordinador confirma mejora liviana publicada en v3.21.7 | No contar como ahorro nuevo; falta medir recorrido vigente |
| Directorio laboral/proveedores reducidos | Refrescos viven en app inmutable, propiedad del coordinador | Entregar hallazgo si se acredita duplicación; no editar aplicación ajena |
| Compras/OT/Stock | Propiedad de otros frentes | Dependencia histórica frontend Compras: 59781fce85db95f80688b73100b4cd36061196c3; no copiar rama completa |

El inventario completo de 90 rutas/91 métodos más entradas adicionales continúa siendo inventario de fuente. Este bloque mide exclusivamente las proyecciones de usuarios descritas; no declara auditados operativamente todos sus llamadores ni todas las rutas.
