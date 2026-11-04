# Evidencia mínima y adaptador de avisos — propuesta aislada

Estado: corregida la pérdida de identidad y fechas de envío que bloqueaba la entrega anterior. No está montada en app, endpoint ni producción. La integración de root se entrega como patch puntual, no como reemplazo de su índice completo.

## Formato concreto

`js/core/dashboard-budget-notice-legacy-proposal.js` comparte captura, validación y reconstrucción UMD/CommonJS. Cada record técnico admitido para avisos añade `noticeLegacy` **fuera de Source.row**, con estos campos:

- `schema: 1` e `idPresent: boolean`.
- `idValue: String(original.id)` exclusivamente si id es propiedad propia. Máximo 128 caracteres; un valor mayor se rechaza, no se trunca. Si id estaba ausente, se reconstruye un objeto sin esa propiedad: nunca se sustituye por numero.
- `sentTs`: número finito positivo o null. Conserva enviadoTs positivo, incluyendo instantes fuera del rango Date que el helper real debe seguir rechazando. sentTs corresponde exclusivamente a original.enviadoTs; no se promueve ninguna fecha directa.
- `sentRaw`: valor de `original.enviadoEn || original.fechaEnvio || ''`; conserva números finitos con su tipo y limita los textos al prefijo trim de 32 caracteres.
- `auditSentRaw`: únicamente la fecha del último evento cuya acción coincide con “Enviado al cliente”, conserva el número finito original o el texto trim acotado a 32 caracteres. No se guarda ni transporta su auditoría completa, notas ni datos adicionales del evento.

Los parsers reales sólo inspeccionan prefijos yyyy-mm-dd o dd/mm/yyyy; trim antes de limitar conserva los casos con espacios iniciales arbitrarios. No hay motor de parseo textual nuevo, cálculo por día ni conversión de zona en este codec. El helper del navegador sigue interpretando los originales mínimos y haciendo rollover cuando corresponde. La validación repone sentTs:null si RTDB lo omitió.

El esquema1 admite sentRaw y auditSentRaw como unión de texto acotado o número finito. La reconstrucción conserva ese tipo, incluidos negativos y cero del audit. El parser real decide validez y prioridad; un número fuera del rango Date sigue su retorno original al último audit cuando corresponde. Se retira el rechazo anterior de históricos numéricos, que era una restricción innecesaria del codec. No se modifican los registros originales.

Los records con row.admits=false guardan noticeLegacy:null (o su ausencia normalizada en RTDB). No se capturan identificadores ni fechas irrelevantes de cancelados/convertidos/no admitidos. Al volver a un estado admitido se captura el original nuevo.

## Transformación y contrato público

`dashboard-budget-notice-adapter-proposal.js` acepta el sobre servidor schema1 y el resultado directo schema2 con `result.notices={complete:true,rows}`. Ahora exige noticeLegacy tipado en cada candidato. Se retiró la opción legacyCodecCertified: una bandera del llamador ya no puede habilitar filas antiguas sin evidencia. Los dos bloqueos previos se comprueban como paridad positiva, no como diferencias esperadas.

Reconstruye id sólo si estaba presente, enviadoTs/enviadoEn y, cuando hace falta, un único evento audit `{accion:'Enviado al cliente',fecha:...}`. No usa sentDay para reproducir el parser. Conserva dueRaw para la comparación lexicográfica del badge y el parser independiente de vencimientos. Ordena usando el número de la fila mínima antes de reconstruir id, de modo que el orden del loader no se pierda cuando id era falso o estaba ausente. No convierte, calcula ni redondea total.

Snapshot completo sólo para candidatos de avisos, con UID, rol, revisión de permisos, generación/revisión, auth/User y db, sessionEpoch, connectionEpoch, zona/locale y grants fijados. `completeForBudgetList:false` impide presentarlo como lista general. `rowsFor` revalida el contexto y devuelve copias también del audit mínimo para que el marcado _alertado48h no mute el snapshot. No consulta ni asigna pptoData global.

## Merge puntual de root

`docs/patches/dashboard-budget-notice-legacy-integration.patch` se preparó contra el commit congelado bda4fa01 de integración, conservando PolicyRenewal, noticecounts y los cambios del writer. El patch sólo toca:

1. Índice incremental: importa el codec; añade noticeLegacy sólo al record admitido en source(), y null en los demás; lo copia al candidato plano existente; valida contra el original anterior antes de un delta guardado. No crea índice nuevo ni cambia Source.row17, contadores o campos monetarios.
2. Validador compartido de candidatos: admite una única propiedad anidada noticeLegacy y la valida con el mismo codec. Source.row sigue con 17 campos; candidato privado tiene esos 17 más noticeLegacy; el público elimina sourceHash como antes. El header sigue con 23 campos.

No se modificó ningún archivo en el checkout root. Se verificó `git apply --check --directory=tmp/sdk-proof/notice-legacy-before` del patch contra la copia congelada. Root debe aplicar estos hunks sobre su estado vigente, no copiar el archivo de índice de este checkout antiguo. Los registros admitidos y candidatos antiguos sin noticeLegacy se rechazan: requieren preparación explícita con generación revisada. No hay migración ni corte automático.

Carga futura en navegador: codec legacy antes del modelo compartido y del adaptador. Mantener la selección de transporte antes de leer: camino directo canónico con read({activity:false,badge:false,notices:true}), legado por servidor autorizado; sin fallback ante error. Default read/metrics no descargan candidatos. Abrir el centro puede pedirlos. Este trabajo no monta ese flujo.

## Puntos de montaje futuro, aún sin aplicar

Referencia de app v3.19.3, funciones completas extraídas de la fuente congelada:

- generarNotificaciones, línea 55821: reemplazar sólo el guard/forEach del bloque de presupuestos por una variable local de rowsFor; conservar los demás dominios y sus permisos. Nunca asignar a pptoData ni cachedRecords.
- verificarVencimientosPptos, línea 2331: alimentar sus dos filtros con el mismo snapshot vigente y completo. Mantener guard de sesión, marcado por UID/key/día, cinco estados, comparación textual de vence y llamada al generador. Carga/error pendiente no se presenta como cero.
- _pptoFechaEnvioNotificacion, línea 55789, y _pptoPerteneceAlUsuarioActual, línea 55773: conservar los helpers reales; reciben la reconstrucción mínima.
- fbCargarPresupuestos, línea 8239: su lista/detalle general sigue independiente. Los candidatos no contienen el formulario completo. Validar expectedGeneration/expectedRevision al aceptar y retirar el snapshot ante cambios del índice o contexto.

## Evidencia y límites

20 pruebas del adaptador contra las funciones reales de v3.19.3: rollover, año corto, id ausente/falso/numérico, timestamps directos y de prioridad, audit mínimo, prefijos largos, aprobado propio/ajeno, revisión, vencimientos, badge, marcado repetido y 101 candidatos. No se sustituye el generador por lógica del modelo; DOM, reloj, almacenamiento y permisos son puertos ficticios. No equivale a prueba visual o autorización de servidor.

Además, seis pruebas de integración ejecutan bootstrap, planner con guard real y validador compartido sobre una copia congelada de bda4fa01 más el patch. Comprueban Source.row17/header23, actualización del mismo commit, rollback ante evidencia ausente/manipulada y normalización RTDB, exclusión de convertido con id largo y fechas numéricas, y transiciones convertido→admitido→convertido. Con las pruebas existentes de lector/ausencia/SDK: **53 PASS, 0 FAIL, 0 SKIP**. Log privado `tmp/sdk-proof/notice-legacy-numeric-union-focused.log`. Tests nuevos: `test/dashboard-budget-notice-adapter.test.cjs` y `test/dashboard-budget-notice-legacy-source.integration.cjs` (opt-in SV_BUDGET_NOTICE_LEGACY_SOURCE=1 con contrato indicado por SV_BUDGET_CONTRACT_ROOT). SV_BUDGET_NOTICE_APP_SOURCE permite fijar el app real; sin variables el test del adaptador toma la app activa del checkout.

La puerta general anterior conserva su evidencia: **8.411 PASS, 76 FAIL, 28 SKIP; NO aprobada**. Se observaron errores de resolución de Playwright, Git temporal denegado y un umbral de rendimiento, pero no se atribuyen todos los fallos al entorno ni se declara una línea base aprobada. El umbral pasó en una repetición específica anterior. No se repitió otra puerta general antes de unificar. Log previo intacto: `tmp/sdk-proof/notice-adapter-current-suite.log`.

No se modificaron runtime activo, importes, originales reales, reglas remotas ni Firebase de producción. No se publicaron commits ni se enviaron mensajes.
