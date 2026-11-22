# Frente D: OT y Tecnoprices, auditoría local del 22/11/2026

## Fuente y separación de estados

Worktree propio `C:/SisVentas/.local/audit-20261122-ot-tecnoprices`, rama `codex/audit-20261122-ot-tecnoprices`, desde `060c77f80a5538a4d16be510513b159a11abc2d5`. Se leyó AGENTS y el contexto de esa base. El contexto identifica v3.21.2 publicada desde `5e4bb83d`; la confirmación HTTP actual proviene del coordinador, no de nuevas consultas realizadas por este frente.

`origin/main` en `4639a87bf7e6edd9f2d62af70317fdc5f9ac71b5` es el ancestro común, con limpieza sobre una base histórica. No se integró sobre la fuente publicada. Las fuentes `ot-material-state.js` y `ot-material-rows-model.js` no difieren del arreglo OT-183 `f3e605234a169626c0931c9ea99304846d810da6`: no se rehízo esa corrección. Raíz y checkout compartido se conservaron.

El parche funcional HTTP se entregó antes y separado en `cafeb1d2e003c6905616920e110439a597c51310`; véase `AUDITORIA_D_OT_HTTP_20261122.md`. Este segundo bloque agrega únicamente pruebas y el helper de pruebas de Tecnoprices que faltaba. No cambia Stock UI/vínculos, código del lector proveedor, versiones, index, SW, CONTEXTO compartido, reglas ni permisos.

## Inventario histórico sin consultar registros reales

Estas referencias describen incidentes documentados, no el estado comercial vigente. No se abrió ningún respaldo privado ni se consultaron OT reales.

| Referencia | Evidencia histórica en Git | Equivalente ficticio verificado ahora |
| --- | --- | --- |
| OT-180 | `ecd52eed` / `35d6e756`: la firma documental y el workflow no prueban movimiento físico; el original completo debe conservarse. | Firma documental, adjuntos, fotos, checklist y auditoría previa se conservan con una entrega y replay; un ACK perdido no añade otra operación. Se rechazan firmas de tipo inválido y una historia física no acreditada. |
| OT-183 | `9e4919ea`: compatibilidad general de historial válido, heredando el arreglo canónico anterior. | Auditoría y checklist en arrays y mapas RTDB; seis casos documentales nuevos y la selección existente de compatibilidad/RTDB. No excepciones por número de OT, cliente o producto. |
| OT-186 | `01e1bf6e`: corrección de representación canónica; entrega e instalación físicas no equivalen a cierre administrativo. | Entrega parcial, instalación, un remito, replay y conservación de reservas ajenas; cantidades históricas, lectura completa y recibos con revisión. No se repitieron movimientos reales ni se corrigió inventario manualmente. |
| OT-187 | `OT187_MATERIALES_DIAGNOSTICO_LOCAL.md`, `OT187_ESTADO_MATERIALES_LOCAL_V31918.md`: estado de filas, acción de entrega y custodia deben ser coherentes; no inferir el estado de una captura antigua. | Casos existentes de incoherencia, filas recuperadas, origen desconocido, instalación y revisión; consultar no inventa entrega/instalación/remito. No se afirma cuál fue el estado histórico real. |

Cadena nueva: entregar dos unidades, instalar esas dos y repetir exactamente la instalación conserva un remito y dos commits correspondientes a las dos intenciones. Intentar después eliminar la OT con actividad se rechaza por el comando real y no agrega commits ni cambios de inventario. La eliminación de un borrador sin actividad se cubre aparte con ACK incierto por HTTP y un solo commit; no se interpreta la protección del historial como un fallo que haya que sortear.

## Tecnoprices

La regresión existente `cotizador/test/tecnoprices-stock-session-independent.test.js` fallaba antes de ejecutar casos por falta de `./tecnoprices-api-fixture`. Se restauró ese límite de pruebas, sin modificar el test existente ni sus expectativas: APIRequestContext normalmente elude las rutas de Playwright; el helper despacha el POST únicamente a handlers sintéticos explícitos, fuera de la página. No existe fallback de red, navegación con credenciales, ni reenvío automático de POST. Origen ajeno o redirecciones habilitadas se rechazan. La prueba nueva verifica también que el API real nunca sea llamado.

Regresión existente: 5 PASS, incluida URL exacta con query, recuperación única de sesión expirada, rechazo de formulario señuelo con precio y estructura de tres formularios. Un solo navegador headless propio, con tráfico respondido por fixtures, cerrado en `finally`; no navegador ni sesión humana.

Pruebas nuevas ejecutan el helper de login actual con formularios/DOM sintéticos y verifican CSRF, action relativa/absoluta normalizada, duplicados, campos reservados, redirecciones 307/308/ajenas, HTTP401, falta de evidencia de sesión, diagnóstico privado y guard GET/HEAD del navegador. No se rellenan credenciales en DOM ni se exponen errores privados. El servidor de lectura local prueba autorización y allowlist de respuesta con proveedor, actor y contraseña ficticios. No credenciales ni consultas reales al proveedor.

## Resultado final del dominio

Selección serializada de **43 archivos, 458 casos: 445 PASS, 0 FAIL, 13 SKIP**, Node v22.23.4, exit0. Son pruebas del dominio, no la suite general. La selección y las 92 huellas revisadas constan en `tmp/audit-front-d/final-domain.json`; antes y después fueron idénticas. Incluye el parche `cafeb1d2` y los nuevos archivos de este bloque. No sumar las repeticiones focales como cobertura adicional.

Las 13 omisiones ya estaban declaradas por sus pruebas: dos requieren baseline de reglas/modelo desplegado fijado; once requieren fuentes retenidas de imágenes, referencias privadas y overlays antiguos de Tecnoprices/Presentation. Se mantuvieron sin cambiar expectativas ni activar flags. No acreditan contenedor, imagen o reglas remotas. No se usó una fixture del lector actual para convertir esos artefactos históricos en aprobados.

Latencia: el runtime real sobre IO ficticio con demora configurada de 3 ms empleó 83 solicitudes y concurrencia máxima seis, con un commit; el replay dejó un commit y 93 solicitudes acumuladas. Tiempo observado 498 ms en ese doble: **no es latencia productiva ni demuestra resuelto el incidente histórico**. Las pruebas mantienen relectura fresca de inventario y rechazan catálogo/permisos cambiados; no se retiraron validaciones para acelerar.

Logs privados locales, no agregados a Git:

| Archivo en `tmp/audit-front-d/` | SHA-256 |
| --- | --- |
| final-domain.log | c670a6f5fb950552d5e652ad9616838c8316b98749fc4c78e161581f396265fb |
| final-domain.json | a17d29b04013f2116ec45c49ec8945549e49d00f862e420671a6bdae59f6bd1e |
| ot-documentary-chain.log | e6fecd14fe1b45ef6217bad7a925c38159a93256aef28dac93c63e992ffe1a71 |
| tecnoprices-stock-missing-fixture.log | b645f9166d8bdf303fe688c523b714ab1eca2cd97f49869d19671423a5bf3164 |
| tecnoprices-stock-session-green.log | a31a36c7e835cca973eacf85ad26b8188c926a3acb2278bfb960a0ed1905ccc4 |
| latency-fiction.json | 3bdf3a795cdddcc1a5c53ae48b9d301d9d19199bf72a1ff5e6708221194213de |

Un primer runner se interrumpió durante el inventario amplio antes de generar resultado. Se acotaron las huellas al dominio, sin cambiar la selección de pruebas; dos ejecuciones completas dieron los mismos contadores. Se conserva como evidencia final la última, identificada arriba. CIM para inventario independiente de procesos fue denegado; los comandos acabaron y los fixtures cierran sus recursos, pero no se presenta una enumeración de todos los procesos del sistema.

Sintaxis de todos los JS modificados/nuevos y `git diff --check`: PASS. La puerta general la ejecutará el coordinador una vez por integración. No emulador de reglas en este bloque, teléfono físico, UI total de OT, imagen exacta desplegada o verificación de latencia real. No llamadas comerciales, datos reales, builds, instalaciones, despliegues, permisos, cambios remotos, push ni publicación. El siguiente paso es recoger los dos commits locales y ejecutar la puerta integrada central; las comprobaciones de artefactos ausentes siguen pendientes de sus fuentes revisadas.
