# Revisión de integración y QA HTML preparada

## Actualización: QA ejecutada y correcciones acotadas · 06/11/2026

El principal cedió Chrome exclusivamente para diagnosticar el rojo original. **Resultado final: 10/10 casos HTML aprobados, 0 omitidos; 43/43 Node focales aprobados** (36 de app activa y 7 del arnés/regresión). Chrome fue cerrado y liberado al terminar. No se publicaron cambios ni se modificaron app/index, reglas, servidor, flags, datos, autores, comisiones o stock.

El texto posterior conserva la preparación inicial; su estado «pendiente» quedó reemplazado por esta evidencia para los diez recorridos automatizados. No equivale a aprobar todos los formularios ni las comprobaciones visuales/manuales listadas abajo.

Tres precondiciones incorrectas eran del arnés:

- El modelo construía cobertura, pero la configuración sólo tenía los flags de búsqueda: faltaban `ready:true`, `schema:1` y `generation` igual a la cobertura. El lector correcto rechazaba el detalle antes de consultar la venta. Se completó la configuración ficticia, sin cambiar validaciones de producto.
- La sonda real del monitor usa un manifest público incluso en localhost. El bloqueo externo de la fixture la convertía en offline. Se responde **sintéticamente**, exclusivamente al origen/path/parámetro de esa sonda, registrándola en `connectivityProbes`; nunca se continúa hacia el dominio real. Todas las demás salidas siguen bloqueadas. No se afirma conectividad real.
- El arranque llamaba directamente la carga de Soporte, sin ejecutar el arranque real `fbCargarTodo()`. Por eso `_fbCargaTodoActiva` no habilitaba las fuentes al navegar a Garantías. Ahora se llama al arranque real; no se marca readiness manualmente ni se fuerza la bandera.

Con esas correcciones pasaron 8/10 HTML y quedaron los dos casos de denegación. **Rojo de producto identificado:** un 401/403 vigente provoca el reset del helper y cambia su revisión de apertura; después `perform` interpreta ese reset propio como intento vencido y suprime el aviso. La corrección de tres líneas en `js/core/postventa-demand-proposal.js` conserva el retiro por revocación y comunica una vez el error que ya se confirmó vigente antes del reset. Un callback interno y un WeakSet evitan doble aviso. Los llamadores directos de `begin()` conservan su propio tratamiento de errores; una respuesta de otra sesión sigue descartándose sin avisar. No se redujeron las expectativas del test ni el bloqueo externo.

Se añadieron regresiones de 401 y 403 en apertura/acción directa, ausencia de aviso a otra sesión, conservación del manejo del llamador directo y sonda sintética sin ninguna salida de red. La propuesta congelada b36f65c7 en su worktree permanece intacta: la corrección está únicamente en la integración local autorizada.

Evidencia privada conservada en `C:/SisVentas/tmp/presentation-release-v31910/`:

| Archivo | Resultado | SHA-256 |
| --- | --- | --- |
| `combined-support-pager.private.log` | Rojo original: 10 fallos postventa; pager separado 2 aprobados | `6d8d3a1eeb60b0092dbee65c54ec30a57faeecfe58756cef6ea0b0be19eaf4c5` |
| `postventa-fixture-fixed.private.log` | Sólo fixture corregida: 8 aprobados, 2 denegaciones fallan | `19e7dc9b2a7cea52f796f592ae81f5c3f624239dc71d94c935204bbdaceb082e` |
| `postventa-denied-red.private.log` | Regresión Node: 401/403 fallan; sesión antigua descartada | `8b6ce489ba10336a4414f83fc69a41254bd12696fdc219ac24c82295376af779` |
| `postventa-full-app-green.private.log` | 10/10 HTML, 390/1280 px | `96bf765b8a7fd35b05220e17079e71bbd0a79c667791ad178a5474ed1b638ad7` |
| `postventa-node-final.private.log` | 43/43 Node focales | `e2fcf3ef73f043c3134098adb36247f61227bf0f89636812f6e885b614d7f873` |

Archivos estabilizados para freeze del principal: este documento, helper postventa, `test/fixtures/postventa-full-app.cjs`, `test/audits/postventa-full-app-fixture.cjs` y `test/audits/postventa-full-app.browser.cjs`. No se añadieron archivos a staging ni se hizo commit del árbol compartido. La puerta y el freeze final corresponden al principal. No se repitieron los casos de pager/presentación ajenos ni se ejecutaron operaciones comerciales.

Fuente: checkpoint limpio `6ac3c2239bc4c45efbf19a4b31f7d2b295c96990`, aplicación activa v3.19.12. Copia aislada `C:/SisVentas/.local/postventa-html-qa`, rama `codex/postventa-html-qa`. No se modificó `integracion-local-v31912`, la propuesta congelada b36f65c7, app, índice, readiness ni helpers de producción.

## Revisión realizada

Se contrastaron contra la propuesta aplicada una sola vez sobre la base anterior 65e5bcee: las **22 funciones preparadas coinciden**, igual que `data-readiness.js`, `garantia-circuito.js`, `sales-indexed-host.v1.js` y el helper. El contraste fue exclusivamente en memoria sobre la base anterior; no se aplicó `prepare()` a la app activa ni se escribió un segundo patch. Se preservan la integración CC31911 y los bloques de Presentación/Compartir, sin mezclarlos en los cambios de QA.

No se encontró una divergencia concreta de integración en esas funciones. Esto no acredita ejecución visual ni prueba todos los formularios/operaciones de la ficha de venta. El principal ya ejecutó 36 casos activos y los otros grupos indicados; aquí no se repitieron sus suites ni su puerta.

Funciones contrastadas: volverListaVentas, svCargarDatosDePaginaActual, svReintentarDatosDePagina, fbCargarTodo, fbCargarVentas, _svTotalVentaCanonico, _svMontoPagadoVenta, _svResolverVentaRegistro, spRenderLista, _garantiasDesdeEquipos, spAbrirModal, spVerVenta, _buscarVentaCanonicaReclamo, _candidatasVentaReclamo, spRepararVinculoOT, spRepararVinculoVenta, spGenerarOT, spAbrirResolucionVisita, spConfirmarResolucionVisita, renderGarantiasUnificadas, verDetalleVenta y renderDetalleVenta.

## Arnés listo para que QA lo ejecute

- `test/fixtures/postventa-full-app.cjs`: sirve el **índice y aplicación activos completos**, con estilos/módulos originales; reutiliza el SDK ficticio y la transformación segura existentes de `dev-module-audit`. No extrae funciones para sustituir la UI ni marca manualmente Ventas/Pagos como listos.
- Las suscripciones ficticias conservan la frontera callback→ready. El resumen financiero se genera con `commercial-pages-model` real y sólo datos ficticios. Las lecturas comerciales usan HTTP loopback; controles de denegación/ausencia/respuesta retenida son exclusivos del arnés, no endpoints o contratos del producto.
- CSP sólo permite conexiones al mismo origen. Se retiran scripts remotos y Firebase, se rechazan mutaciones HTTP comerciales y no se sirven docs, `.git` o archivos fuera de la lista pública. El servidor escucha únicamente `127.0.0.1` y no se inicia al importar el archivo.
- `test/audits/postventa-full-app-fixture.cjs`: dos pruebas de preparación/transporte pasaron sin navegador. Verifican HTML/módulos reales, sintaxis de los scripts ficticios, metadatos completos, activos, errores 403/404, rechazo de POST comercial y bloqueo de rutas privadas. La prueba HTTP necesitó permiso de loopback fuera del sandbox restrictivo; no usó servicios externos.
- `test/audits/postventa-full-app.browser.cjs`: **diez casos preparados, aún no ejecutados**, para 390 y 1280 px. Requiere dos variables explícitas para evitar lanzar Chrome incidentalmente. La enumeración sin variables dio 10 omitidos, 0 ejecutados: **no son diez aprobados**.

Recorridos preparados por tamaño:

1. Lista fría y modal sin Ventas; nombre vigente por referencia; Ver venta consulta sólo el original puntual, usa resumen financiero y vuelve al mismo reclamo.
2. Garantías manuales/equipos sin Ventas; ficha de equipo; unidades sólo después de una acción explícita desde la venta.
3. Original denegado: reclamo permanece abierto y no se inventa vínculo roto.
4. Original retenido y cierre del reclamo: el acuse tardío no abre la venta.
5. Referencia legacy ambigua: consulta autorizada completa sólo en esa acción, sin seleccionar la primera venta.

Los casos comprueban que no haya escrituras ficticias, errores JS ni desbordamiento horizontal. No confirman unidades, no crean OT, no guardan resoluciones, no alteran precios/comisiones/stock. Esos recorridos transaccionales ya tienen pruebas sintéticas y no se ejecutan incidentalmente para QA visual. Aún quedan por inspeccionar visualmente opacidad de cabeceras, scroll de fondo, teclado/foco, cierre/minimización y retornos completos; preparar el código no sustituye esa comprobación.

## Uso después de coordinar Chrome

No ejecutar Chrome mientras QA use presentación. El principal debe acordar la ventana antes de activar:

```powershell
$env:POSTVENTA_QA_RUN='1'
$env:POSTVENTA_QA_CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe'
node --test test/audits/postventa-full-app.browser.cjs
```

Para servir manualmente, sin abrir navegador: `node test/fixtures/postventa-full-app.cjs`. Imprime un puerto aleatorio loopback. Cerrar con Ctrl+C. Usar únicamente el origen ficticio impreso, nunca una ventana con sesión productiva. Para las pruebas de servidor: `node --test test/audits/postventa-full-app-fixture.cjs`.

El arnés conserva métricas HTTP de sus respuestas comerciales y lecturas SDK simuladas por separado. **Todavía no hay medición de tráfico de los recorridos HTML**, porque no se abrió Chrome. El cuerpo JSON de una fixture no representa bytes de RTDB ni facturación. Las pruebas son opt-in fuera de la puerta global para no interferir con la corrida del principal.

Huellas SHA-256 de esta copia QA (bytes del checkout, no validación web): app v3.19.12 `ed504fc8193d0b5248b1e6b8e5734b586ecdcca0b4862e1fccb922aaf793759a`; helper `cae07c2a497fa9a5108b22ef54a091b6227ceee9f6f5bd2a0b05e0c8b06320c2`. El arnés expone además hashes de los activos que sirve para identificar la fuente de cada ejecución.

Estado: preparación y revisión de código terminadas; **QA HTML/visual pendiente**. Sin cambios remotos, datos reales, Chrome, publicación, Hosting o migraciones.
