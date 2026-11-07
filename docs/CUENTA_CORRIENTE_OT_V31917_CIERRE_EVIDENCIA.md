# Cierre de evidencia CC y OT · 7 de noviembre de 2026

Esta revisión es posterior a la publicación. No aplica código, reglas, tráfico,
despliegues, rollback ni operaciones comerciales. La fuente funcional publicada
sigue siendo `72db94334701bad67525445a08ec94ba0476cd7f`; el commit `1760650e`
agregó únicamente documentación. La comparación de ambos confirmó que no hubo
cambios funcionales. Las comprobaciones posteriores de este documento no se
atribuyen a la puerta ejecutada anteriormente.

## Qué quedó comprobado de OT

El rechazo por falta del enlace inverso se reprodujo con el modelo anterior.
El parche admite sólo el vínculo unidireccional exacto entre OT, venta y resumen
vigente; no inventa ni reasigna el enlace primario. Se conserva el rechazo de
alias contradictorios, otras ventas y revisiones inconsistentes.

La matriz de emulador con el runtime retenido exacto pasó 25 escenarios sin
proyecciones comerciales y los mismos 25 con proyecciones. Cubre administrador,
administrativo y técnico asignado; cierre y repetición; respuesta perdida;
revocación; técnico ajeno; cambios tardíos del vínculo; rechazo atómico de
escrituras adicionales de importes, pagos o stock; y continuidad del vínculo
primario existente. Compara los totales comerciales antes/después, exceptuando
su revisión. No son cincuenta escenarios diferentes.

El caso de otra visita aún abierta se comprueba en la prueba del modelo
`ot-lifecycle-missing-primary.test.cjs`: el cierre de una visita no declara
instalada toda la venta. Los flujos de devolución/cierre en ambos órdenes y el
rechazo sin estados parciales pasan en los tres recorridos cliente-servidor
repetidos después de publicar, utilizando la fixture sin enlace primario.

El modelo corregido aceptó la copia exacta de OT-179 sólo en memoria, sin mutarla
ni usar transporte de escritura. En la web se comprobó versión17, apertura y
firma visible; se dejó Finalizar abierto. **No se ejecutó el cierre real** ni se
probó una nueva operación autorizada contra registros productivos. Los avisos
de datos de acta/fotos pendientes no se completaron automáticamente. Tampoco
se acredita que todas las variantes históricas posibles estén cubiertas.

## Defecto de interfaz aún abierto

El selector de técnico de la OT utiliza `empData` y sólo repuebla las opciones
si tiene como máximo una. Una apertura anterior a la carga de empleados agrega
la opción histórica «no disponible»; luego esa segunda opción impide repoblar
el selector cuando llegan los técnicos activos. Una reproducción en VM con el
bloque real de la aplicación y dos empleados ficticios confirmó ambos pasos,
sin consultas externas ni operaciones comerciales.

Esto **no demuestra que el empleado real esté inactivo** y no explica el rechazo
del vínculo OT/venta ya corregido. Sigue pendiente corregir la actualización del
selector al cambiar la disponibilidad de empleados y probar su llegada tardía,
cambio de sesión y conservación de la selección. No se modificó la interfaz ni
se volvió a publicar como parte de este cierre documental. Referencia de código:
`js/app.v3.19.17.js`, bloque «Técnico (select — poblar con empleados activos)»
de apertura de OT, alrededor de la línea50220.

## Las 46 omisiones de la puerta

La puerta de la fuente72db contiene 9.956 casos: 9.910 PASS, cero FAIL y
**46 SKIP**. Todos son opt-in cuyos requisitos no estaban habilitados en esa
ejecución. No hay SKIP por fallo convertido a aprobación. El inventario de los
46 nombres exactos, archivo, condición y estado está en
[CUENTA_CORRIENTE_OT_V31917_OMISIONES.json](CUENTA_CORRIENTE_OT_V31917_OMISIONES.json).

| Archivo de test/ | Casos SKIP | Requisito opt-in ausente |
|---|---:|---|
| commercial-draft-transport-restart-native.test.cjs | 2 | Emulador loopback configurado |
| commercial-full-app-metrics.test.cjs | 1 | SV_RUN_COMMERCIAL_METRICS=1 |
| dashboard-notice-rest-independent.test.cjs | 1 | SV_DASHBOARD_NOTICE_INDEPENDENT_NATIVE=1 |
| labor-expense-race-emulator.test.cjs | 7 | Emulador9017 y SV_LABOR_RULES_BASE |
| labor-runtime-emulator.test.cjs | 20 | Emulador9017 y SV_LABOR_RULES_BASE |
| page-demand-readiness.test.cjs | 6 | SV_GARANTIA_MANUAL_RUN y Chrome específico |
| tecnoprices-container-contract.test.cjs | 1 | Entrypoint y fuentes retenidas de Presentation |
| tecnoprices-overlay-http-loopback.test.cjs | 1 | Entrypoint y fuentes retenidas de Presentation |
| tecnoprices-presentation-overlay.test.cjs | 7 | Entrypoint, baseline y fuente de Presentation |
| **Total** | **46** | **Ninguno se cuenta como PASS** |

**Ninguno de esos 46 casos exactos queda acreditado por una ejecución separada
de esta entrega.** Resultados históricos de otras ramas no se trasladan a72db.
Las validaciones separadas que sí existen son las siguientes; aportan cobertura
del alcance publicado, pero no sustituyen ni renombran los casos omitidos:

| Evidencia separada | Resultado | Alcance y límite |
|---|---:|---|
| Focal conjunto | 47 PASS / 0 SKIP | Modelo, command, policy, overlay exacto, transformación de reglas y concurrencia CC; solapa casos de la puerta |
| Servidor | 94 PASS / 0 SKIP | Regresión de cotizador/test; no certifica todos los servicios ni todos los opt-in de test/ |
| Emulador OT sin Pages | 25 PASS / 0 SKIP | Runtime retenido y reglas emparejadas, sólo datos ficticios |
| Emulador OT con Pages | 25 PASS / 0 SKIP | Mismos escenarios, con verificación adicional de proyecciones |
| Cliente-servidor sin enlace primario, repetición posterior | 3 PASS / 0 SKIP | Fixture en memoria; no prueba un guardado financiero productivo |

Los siete casos de Gastos, veinte del runtime general, seis de Garantías y nueve
de Tecnoprices permanecen sin comprobar bajo esas condiciones opt-in para esta
fuente; no se reabrieron esos frentes durante esta revisión. También quedan sin
ejecutar los cuatro opt-in de admisión, métricas y dataEpoch indicados arriba.

Hashes de logs privados para cotejo:

- Puerta conjunta: `4254cd1fb019cfe29f82327b1789f71ccbbd41f771577e530a34b84b436cdc3e`.
- Focal47: `57b5093946ff0b024b43aa4238f298b36f35b5611f2258e52021a3cd71e5060b`.
- Emulador25 sin Pages: `f9ec2909173dc7c651fbf0f1b3fb597980e1906ca058698a2a472b88fb927c0a`.
- Emulador25 con Pages: `626c64015d817913666bfe47a905a98080fc3b71dfbffb25ad81cffde2d58a1d`.
- Repetición cliente-servidor3: `8479d8f765100a739124a9804bedc931cb43e3e80a06968269fa6d36a3a16165`.

## Referencias concretas de rollback verificadas sin ejecutarlo

Una lectura posterior confirmó los siguientes recursos. No se hizo un ensayo
de reversión sobre producción ni se generó otra publicación.

| Componente | Referencia de retorno | Verificación |
|---|---|---|
| Hosting | sites/nixa-sisventas-seguro/versions/ae098a6081d3db8d | Recurso anterior existente, FINALIZED; corresponde al release respaldado antes de17 |
| Cotizador | cotizador-commission31916-db724dee | Revisión existente, Ready=True |
| Imagen anterior | sha256:91381cc6432750386e75b1dd006b80f96bd5c6efa1cfdb5403a789aa50cc8702 | Digest de la revisión anterior comprobado |
| Accesos | Quince etiquetas previas, mapeadas a la revisión anterior en el respaldo | Identificadas y comparadas con los quince accesos ahora dirigidos a ccot31917-dd416173 |
| Reglas anteriores | rules-fresh-before.private.json | SHA256 dee40945c7224f449a1f460193c268796341bd97e3c82c8e00ea236385be1fb7 |
| Reglas actuales esperadas | rules-fresh-candidate.private.json | SHA256 b3ff492f0808cfed67d855b67e378a5b32dba2da7dc774e6fd8baa854f515ba7; lectura remota actual coincidente |

Los artefactos de retorno están sólo en la carpeta privada local
`C:/SisVentas/tmp/ot179-diagnostic-20261107/`: `hosting-before.private.json`,
`service-before.private.json`, `rollback-server.private.cjs`, ambos respaldos de
reglas y `rollback-reference-verified.private.json`. No se agregan sus contenidos
a Git. Hash del informe de lectura:
`c833cb890cac0a086184386bb876453003cc74aa9dfbc1034e94d6f98a732111`.

El script de retorno del servidor restaura revisión y quince etiquetas;
no revierte Hosting, reglas o aviso por sí solo. Una reversión integral exige
coordinar esas piezas, verificar que no haya operación activa y volver a leer
las reglas antes de restaurarlas. Google no ofrece ETag de reglas: no se debe
sobrescribir una publicación concurrente. El aviso oficial sólo se ajusta
después de comprobar los activos efectivamente servidos desde la fuente
compatible. Estos son límites del procedimiento, no una reversión ejecutada.
