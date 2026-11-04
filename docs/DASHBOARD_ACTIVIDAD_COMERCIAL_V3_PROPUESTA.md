# Proveedores de actividad comercial · propuesta aislada

Base: `249040dc6b967949d71fff60a0ebe632ef7f11be`. No hay montaje en aplicación, rutas HTTP, SDK, reglas remotas ni configuración productiva. No acredita aceptación global de Dashboard.

## Reutilización y orden

Pages ya define `ownerUid`, `totalCents` de ventas y `amountCents` de cobros. Se usan esas filas; no se recalculan importes ni propietarios con nombres. El listado Pages ordena por día comercial y clave UTF8, no por instante original. `record-list-model` mantiene resúmenes OT con otros campos, sin cobertura del orden de actividad. `operational-read-model` cubre compras/listas/inventario, no ese orden OT. Ninguno certifica el prefijo requerido.

Por eso se agrega solamente `sv_dashboard_commercial_activity_proposal/v1`: hashes de los originales/filas Pages, eventos mínimos, documentos ordenados por dominio/ámbito, conteos y pruebas. No contiene copias de originales ni históricos de ítems. Reutiliza sin modificar `dashboard-activity-model.v2` y el helper zonal: contrato `legacy-ms-desc/stable-key-utf16-v3`, instante descendente y clave original UTF16 para empates. El cambio de desempate deliberado ya pertenece a la base.

Las fuentes de instante son venta `fecha/ts`, cobro `fecha/ts` y OT `(fechaCierre || fecha)/ts`, con prioridad y coerción de `ts` exactamente como el helper legacy. Zona IANA y locale son entradas explícitas. No se cambia el TZ del proceso ni las fechas originales. Un instante falsy se cuenta como excluido; un infinito truthy no se certifica. Cobros anulados según la fila canónica Pages se excluyen. Venta anulada no se excluye por extensión. Las OT transportan `amountCents: null`, sin costos, importes ni asignados.

## Preparación y mantenimiento

`build` es una preparación offline pura que exige snapshot completo explícito de los tres dominios, Pages preparado, todas sus filas/conteos comerciales coincidentes y el recibo pagesEvidence retornado por la misma preparación canónica Pages. El llamador debe obtener ese snapshot bajo corte de escritores verificable. Nunca se ejecuta desde `read` o después de mutar para reparar un índice. La bandera `complete` es una declaración del preparador de confianza, no un mecanismo para descubrir que una memoria del navegador está completa.

Para probar el mantenimiento se inyecta el módulo como `createLaborGuard({store, commercialPages:true, dashboardActivity:Activity})`. Por defecto la opción está desactivada y ningún runtime la configura. El guard llama al augment después de Pages, incluyendo cobros asociados modificados por reasignaciones de ventas o de presupuestos vinculados. El PATCH del original, Pages, actividad, recibo y liberación del fence es único. No se admite escribir la raíz técnica desde un payload del usuario ni reemplazar dominios completos.

El augment compara el punto previo contra original y Pages puntuales; valida cobertura, generación, revisión y pruebas de conteos. Actualiza únicamente los eventos y ámbitos afectados, incluida la salida y entrada por reasignación. No reconstruye un ámbito conocido si perdió sus conteos. Revalida fuentes, puntos técnicos, estadísticas y pruebas antes del commit. Con la opción activa, el guard también revalida las lecturas raw/get usadas por Pages, incluidos sus puntos y totales. `ready:false`, puntos inconsistentes o metadata incompleta se rechazan sin resucitar cobertura. La recuperación de un recibo repetido pertenece al guard vigente y no vuelve a incrementar revisión.

## Lectura y autoridad

`createReader({auth,db,enabled:true,getLegacyContext}).read(req,domain)` es una fábrica sin ruta. Verifica token con revocación y puerta de restablecimiento existente, rol activo, ficha UID única mediante consulta de dos resultados, configuración V2 con revisión, Dashboard y `domain-read-policy` usando `commercial-ownership.moduleAllowed` y sus acciones existentes. Repite la autoridad al finalizar y compara identidad, claims y digest completo de permisos. No hay vista como otro usuario.

Ventas y cobros son `all` para administrador y `own` para otros roles autorizados, usando exclusivamente `Pages.row.ownerUid`. OT mantiene `all` para cualquier rol interno autorizado por el módulo/acción real, incluidos técnicos; no agrega un filtro de asignados por nombre. No se habilita Distribuidora. No se afirma compatibilidad con configuraciones legacy sin índice V2 verificable.

Cada lectura usa cinco cabeceras puntuales antes/después y una consulta `orderByKey().limitToFirst(5)`, nunca originales ni raíces históricas. Las pruebas de conteos, manifiesto de ámbitos y cantidad exacta esperada certifican el prefijo desde inicio y `exhausted`; un ámbito nuevo sin registros puede responder vacío por ausencia certificada en el manifiesto. Los ámbitos conocidos sin metadata fallan. Se valida el DTO mínimo con el modelo de merge compartido. `mixedActivityComplete:false` y `notificationCenterComplete:false` evitan presentar el proveedor como cierre de la actividad mixta o los avisos.

## Evidencia inicial de 0ca5 y límites

Focales: 64 PASS, cero FAIL/SKIP, sumando los 12 nuevos casos con guard real/persistencia ficticia, Pages, modelo estable y dependencia del contenedor. Cubren altas, edición de importe canónico, instante, baja, reasignación con cobros, reintento, roles, anulaciones, exclusiones, empates, carreras, corrupción y sentinels. La mutación de un objeto de contexto mientras el prefijo estaba pendiente se reprodujo roja antes de capturar una copia independiente y pasó después. La mutación OT usa 12 lecturas y 9 rutas de PATCH tanto con 9 como con 1.009 originales OT; el costo no depende de historia ajena.

RTDB loopback propio 9089: tres PASS, cero FAIL/SKIP. Se persistieron 127 ventas, 127 cobros y 1.009 OT, con una consulta de cinco por proveedor, 19 GET lógicos y dos verificaciones Auth, cero originales por petición. Prueba real `labor-rtdb-store` + guard: cambio de propietario con cobros compañeros, anulación, OT/reintento, sentinels intactos. Clave de 128 unidades UTF16 y sort de 529 bytes aceptada; pérdida de prueba y deriva de permiso rechazan. Namespace final `demo-commercial-activity-8016` vaciado y verificado; emulador propio detenido al cerrar. Reglas permisivas únicamente en el namespace ficticio; el verificador Auth es ficticio. Esto no prueba las reglas remotas ni permisos de escritura productivos.

Logs privados fuera de Git: `C:/SisVentas/tmp/activity-commercial-focal.private.log` y `activity-commercial-native.private.log`. El primer intento de puerta general se interrumpió tras constatar falta de dependencias/limitación de loopback y la dependencia directa de contenedor, corregida por inyección. La puerta final terminó con 8.857 PASS, 30 SKIP, cero FAIL (8.887 casos en cuatro lotes), registrada por separado en `activity-commercial-current-final.private.log`. Los SKIP no se presentan como ejecutados. `node --check` de los seis JS/CJS y `git diff --cached --check` también pasaron.

Antes de una activación hacen falta protocolo de preparación/publicación revisado, corte de todos los escritores previos (especialmente OT, cuyo escritor antiguo no avanza Pages), reglas y marcador de escritor que impidan bypass, integración de consumidores con una misma captura de contexto y comprobación de la aplicación/avisos completos. El índice por sí solo no detecta un escritor privilegiado externo que omita el protocolo. No se hicieron operaciones productivas, push ni despliegue, y no se recargó la ventana del titular.

SHA256 de evidencia privada final: focal F7BAB6DA7556362F1D3677460A8F740DB28DDAC44FAB97D474A8A2F937CC51E3; RTDB 764C089E13C95BD24E9A50343770DC6DF0F7BB6F2A4EDF75383F8B2CAD068FB1; puerta 44A41D8DB944211B038CE7D9B800056073DD0D3A93C82FCB58E21567FC55A62E.

## Revisión previa a importar · snapshot y concurrencia

Se confirmaron dos defectos reales de `0ca5cced375cbf271c668e88acb9353bf4578b7f`: misma cardinalidad no prueba que Pages corresponda a los originales; la revalidación antes del commit no incluía todos los puntos/conteos/pruebas usados. La corrección mantiene el diseño y no modifica el lector ni la autoridad.

`commercial-pages-projections.prepare` captura sus entradas antes de su primer await y entrega `activitySnapshot`, un recibo de integridad con hashes normalizados de ventas, pagos, filas canónicas y cobertura producidos por ESA misma ejecución. No se escribe en RTDB. El build de actividad exige ese recibo como `pagesEvidence` y compara ambos lados exactos; rechaza filas con total/propietario/cancelled desfasados aunque key/count/generation/revision sean iguales, y también originales distintos con las mismas claves. No vuelve a llamar al builder Pages, recalcular importes ni resolver propietarios. Una preparación nueva de actividad sobre un Pages existente sin ese recibo ahora se rechaza.

El recibo no es una firma ni una autorización de servidor: pertenece al preparador offline de confianza. No debe fabricarse a partir de dos snapshots arbitrarios ni recibirse de un cliente no confiable. La publicación sigue necesitando obtener y conservar el bundle original/Pages/recibo del mismo corte; el recibo no demuestra por sí solo que ese snapshot todavía sea el remoto vigente.

Con actividad inyectada, el guard conserva y revalida el conjunto de lecturas raw/get de la proyección Pages. El augment conserva y revalida todas sus lecturas raw, incluidos punto anterior, estadísticas, prueba y ámbitos nuevos ausentes. Si cambia cualquiera de esos valores antes de su comprobación final, aborta sin original, proyecciones ni recibo de commit, y no pisa el valor concurrente.

Reproducciones y repetición focal (sin repetir la puerta general):

- Once reproducciones iniciales: 11 FAIL en 0ca5, por falta del rechazo esperado; corresponden a seis desfases de filas y cinco carreras.
- Mismos diez casos RTDB contra 0ca5, cargando sus tres módulos originales mediante un preload privado sin alterar el checkout: cinco carreras FAIL y cinco controles/límites PASS.
- Delta: 77 focales PASS, cero FAIL/SKIP. Incluyen las trece pruebas de esta revisión, Pages/guard/modelo y dependencia de contenedor. Positivo con Pages.build deshabilitado después de obtener el recibo: actividad valida sin reconstruir Pages. Otro caso prueba captura de entradas antes del await.
- RTDB real: diez PASS, cero FAIL/SKIP: nueve verificaciones positivas y una demostración del límite privilegiado. Reglas locales explícitas acquire/commit/abort con fence, expiración y recibo; un servicio con fence ajeno recibe HTTP401 Permission denied y el guard correcto sí confirma. No se usa permiso global write=true. Las cinco modificaciones adversarias privilegiadas se aceptaron realmente en RTDB antes de la comprobación final y luego el guard rechazó sin enviar PATCH raíz; esto no depende del store en memoria.
- Los namespaces finales `demo-commercial-activity-35560` (delta) y `demo-commercial-activity-55372` (base) quedaron vacíos y verificados; emulador propio detenido. La mutación puntual OT ahora requiere 15 lecturas y nueve rutas PATCH tanto para 9 como para 1.009 OT. El lector continúa con 19 GET lógicos, consulta de cinco y cero originales por petición.

**Límite comprobado:** un propietario privilegiado puede ignorar las reglas y escribir DESPUÉS de la última lectura, antes de enviar el PATCH. La prueba real demuestra que el guard confirma y sobrescribe ese valor: estas verificaciones no son un CAS atómico de la raíz. No se intentó taparlo con una lectura completa ni ampliar reglas. Es imprescindible cortar/revocar los escritores privilegiados externos y cercar todos los escritores admitidos antes de activar la propuesta. Ninguna regla remota o corte real se comprobó/aplicó aquí. Los diez PASS no son una certificación de seguridad frente a ese bypass.

Logs privados SHA256:

- `activity-commercial-review-red.private.log`: `1AA44C1638CFFA1B2539AEA51A5F0F51D47F861F4B9C491F7B5FC423150D3750`.
- `activity-commercial-review-native-red.private.log`: `169A9F72B6075694B8ADB16C8DCE153FC83C81AE96CA3AA335D022F3D72BE280`.
- `activity-commercial-review-focal.private.log`: `3C59418057EC693E9B5982A5679ED43E09565F9796B44381D26146E4F13C509A`.
- `activity-commercial-review-native.private.log`: `0B3CA6FEA0E6142CE7EBA802F721D142299075C623B6B309F7C55682CCA75A84`.
