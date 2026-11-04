# Últimas cinco ventas personales · Pages, sin activación

Base del contador: d5afe8ce. Modelo y helper aislados; no hay cambios en lector HTTP, agregado, host, app, endpoints, reglas ni datos reales.

## Contrato para Hist

`require('./commercial-creator-latest').readLatest({read,scope,creator,month,locale,expectedLocale})` recibe una lectura fresca de servidor y un scope previamente autorizado por el lector existente. Este helper NO autoriza al usuario. `creator` es currentUser exacto, no owner/author; `month` es mes local del renderer. `locale` y `expectedLocale` deben proceder de un contexto comprobado del renderer (Intl.Collator().resolvedOptions().locale), no de un default inventado por servidor. Sin esa evidencia no llamar/mostrar capacidad disponible. El lector debe capturar y revalidar también sesión/permisos/calendario según su contrato existente.

Devuelve schema, generation/revision, scope, creatorHash, month, locale, orderContract, count, scanned, refs y rows (máximo cinco). `creatorRawDate` conserva el texto que se debe presentar; `row.date` sigue siendo la fecha normalizada de Pages y NO la reemplaza. La fila contiene la referencia del cliente existente; la presentación de nombre vigente debe mantener el resolvedor que ya usa el renderer. No declarar una colección original completa por este resultado.

Lee coverage, totals/scope, TODO el grupo exacto `sv_commercial_pages/v1/creatorMonths/{scope}/{creatorHash}/{month}`, hasta cinco `records/sales/{key}`, y coverage otra vez. Costo O(n) metadata del grupo en red/memoria y O(n log n) orden servidor; ninguna lectura de originales, ítems ni historia completa de otros meses/creadores. No hay límite arbitrario que devuelva un top5 parcial. La cardinalidad se compara con creatorMonthCount; generación, alcance y revisión se comprueban. Un total de scope puede tener revisión anterior a coverage si ese scope no recibió cambios; nunca futura. Coverage debe permanecer igual antes/después. Necesita la misma atomicidad/fence existente de Pages.

## Mantenimiento

`displayFields` incorpora creatorOrder (fecha cruda sin recorte, loaderTime y loaderTs). El mismo delta escribe/elimina membresía para all y u_owner, también con anuladas. Editar fecha, creador o owner mueve referencias; auditoría de creación cambia membresía por el fast path real sin leer pagos. Todos los miembros se conservan: eliminar quinta/sexta repetidamente repone la siguiente. No se guardan sólo cinco/seis. creatorLatestSchema sólo se inicia en preparación nueva; metadata vieja no se certifica por una actualización parcial. Una fila sin evidencia retira esta capacidad del scope, sin bloquear actividad ni contador. La capacidad no se auto-repara ni prepara datos reales.

## Orden y límite deliberado

Comparador primario: Intl.Collator(locale).compare(b.rawDate,a.rawDate), como localeCompare con locale explícito; no hay clave UTF8 supuestamente equivalente. Desempate: fechaVentaTimestamp sobre ventaFechaOrden real, luego ts descendente. Paridad probada ejecutando los helpers del app real. En empate completo se adopta deliberadamente un orden de presentación estable: primero claves que son índices JS (0..4294967294, forma decimal canónica), ascendentes numéricamente; después las demás claves, ascendentes por puntos de código Unicode, sin normalización ni locale. Separar ambos grupos evita ciclos al mezclar comparación numérica/textual. Esto conserva todos los comparadores anteriores; NO afirma paridad con el último empate de entrada legacy no certificado. No cambia originales, históricos ni importes. El DTO declara orderContract=raw-locale-desc_loader-time-desc_ts-desc_js-index-first-asc_other-codepoint-asc_v1. Tampoco se acepta locale ausente, discordante o no soportado. No se afirma equivalencia entre versiones ICU de distintos runtimes: el montaje debe certificar el contexto locale/entorno; si no puede, dejar esta capacidad no disponible.

Datos faltantes, referencia discordante o revisión concurrente no producen un vacío certificado. El consumidor debe aislar el error de esta capacidad (también SV_COMMERCIAL_PAGES_NOT_READY del contador), no rechazar toda actividad ni volver a originales.

## Validación y merge

56 focales PASS, cero FAIL/SKIP: once del helper, trece del contador d5 y treinta y dos de Pages. Altas, edición, auditoría fast path real, reasignación, anulación, eliminación quinta repetida, empates por ts/índices, caracterización legacy de entrada desconocida y nuevo desempate estable, altas y quinta/sexta eliminadas en empate, transitividad mixta y puntos de código Unicode, strings con acentos/caso/puntuación, día99/horas, locale ausente/no soportado, cardinalidad, referencias, cambio de revisión, metadata vieja y vacío preparado. Sin puerta general/UI/emulador/producción. Log privado tmp/creator-latest-stable-tie.private.log.

El modelo incluye baseline d5 para ejecución aislada. Para root ya integrado d5 usar sólo docs/patches/commercial-creator-latest-over-d5.patch, añadir helper y prueba nueva. El test de contador sólo adapta la exclusión de campos derivados para excluir las nuevas rutas creatorMonths; se mantienen todas las expectativas financieras. No copiar otros módulos del checkout ni modificar el lector de Hist.
