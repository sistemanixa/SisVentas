# Propuesta operativa de corte comercial

04/11/2026. **Preparación local; no es autorización ni constancia de ejecución.** Ningún paso de este documento fue ejecutado para redactarlo. Cada avance requiere evidencia del estado real y autorización del alcance exacto. Si una condición no puede demostrarse, mantener la pausa y no avanzar.

## Referencias y estado de partida

- Referencia Git respaldada: `9b5c95b314c3c1f7613eb6884f06f5b3bfe4998c`, rama `codex/ot-entrega-resumen`; main no integrado por este documento. Fuente de código probada: `fc4225700964349b4d73b7f845bb474a9be930e7`; diferencia hasta 9b5c95 sólo documental. Puerta 13: 8.383 casos, 8.355 PASS, cero FAIL, 28 opt-in. Resultados adicionales y límites en CONTEXTO_ACTUAL; no equivalen a corte aprobado.
- Cotizador principal contrastado: `cotizador-return910199-bbf61e86`, región `southamerica-east1`, 100% del tráfico general al observarlo. Las **14 etiquetas antiguas** siguen siendo accesos que deben actualizarse o cerrarse con evidencia. El 100% del principal no las neutraliza. Fuente/digest en [PROCEDENCIA_COTIZADOR_RETURN910199_FC422.md](PROCEDENCIA_COTIZADOR_RETURN910199_FC422.md).
- `emitirFactura` activo inventariado como `emitirfactura-00033-vib`, escritor fiscal sin las capacidades nuevas. Paquete fiscal local privado: 67 archivos, manifest `be2c919db1020ace957dbfa9824b32d7106efc078a883ad318af7a4a95f867aa`. Se debe contrastar el paquete final, su fuente y configuración; el manifest no acredita despliegue ni drenaje.
- Observación shallow informada por coordinación a las **10:26 UTC**: raíces técnicas nuevas ausentes. Es antecedente temporal, no ausencia permanente ni lectura repetida por este documento. Reobservar todas las raíces/configuraciones del manifiesto justo antes del corte; ausencia parcial o configuración instalada cambia el procedimiento. No inferir cantidades de datos de esta observación.
- Los dos rollouts del frontend están en false: `SV_CLIENT_ACCOUNTS_ROLLOUT` y `SV_CLIENT_HISTORY_ROLLOUT`, `index.html` líneas 5861/5862 en esta referencia. No se activaron aquí. No hubo despliegue general de esta integración.

Inventario, contrato de evidencias y límites: [INVENTARIO_ASISTENTE_Y_LIMITES_CORTE.md](INVENTARIO_ASISTENTE_Y_LIMITES_CORTE.md). Publicación: [PUBLICACION_HOSTING_SEGURO.md](PUBLICACION_HOSTING_SEGURO.md).

## Condiciones previas obligatorias

1. Congelar un SHA revisado y limpio para código, reglas, frontend y paquete fiscal. Separar los WIP ajenos. Si se modifica código después de fc422, ejecutar las pruebas pertinentes y puerta vigente sobre la fuente final; no trasladar automáticamente el resultado anterior.
2. Inventariar todos los accesos observados: SDK de clientes abiertos/antiguos, Cotizador principal y etiquetas, URLs directas de revisiones si son accesibles, fiscal, workers/reintentos y los tres forwarders Gen1 de pagos/estados de comisión. Cruzar inventario observado con manifiesto y declaraciones, sin omisiones compartidas. Asistente/testTFApp sólo se excluyen por la fuente exacta revisada, no por el nombre del servicio.
3. Preparar y probar el mecanismo de cada acceso: propuesta local `scripts/lib/sdk-admission-pause-rules.cjs` para SDK y gates HTTP de Cotizador/fiscal por separado. El builder SDK agrega a cada `.write` de `sisventas` completo (descendientes y comodines incluidos), `sv_usuarios`, `sv_chat_roles`, `sv_permisos`, `sv_commission_generation` y `sv_commission_events` una condición de `sv_labor_config/sdkAdmissionPaused`: ausente/false conserva autorización original; true o inválido cierra SDK. No cambia `.read`, finanzas privadas externas ni crea grants. Sólo reglas que ya exigen `svLaborService` en todas sus ramas conservan bypass reservado, todavía sujeto a sus fences originales. El leaf admite exclusivamente booleano bajo la autoridad de configuración existente; un usuario SDK no puede operarlo. Una autoridad global/comodín no acotable hace rechazar composición. La UI, rollouts apagados o `ready=false` por sí solos no son pausa SDK. `LABOR_SCOPED_READ_ONLY` y `ready=false` también bloquearían el adjunto fiscal: no usarlos para el drenaje con recuperación pendiente. Estas propuestas no están aplicadas remotamente ni sustituyen evidencia por acceso.
4. Resolver en QA la transición fiscal old→new con servicio/guard/store reales y proveedor externo simulado: solicitud aceptada antes de reservar job, autorización externa incierta, resultado durable pendiente de adjuntar y recuperación tras cambiar runtime. Debe probarse que no reemite, conserva el resultado y mantiene proyecciones al adjuntarlo. La prueba debe distinguir historia terminal válida de casos pendientes. Si la validación nueva sigue pendiente, el corte queda pendiente.
5. Preparar respaldo privado y recuperación revisada, baseline fresca de reglas, snapshots de datos y configuraciones, manifest de hashes y pruebas de restauración acotada. No subir originales, payloads fiscales, CAE, credenciales ni respaldos a Git o Hosting. Fijar responsables y criterios de cancelación; el validador de archivos no sustituye observación remota ni autorización.
6. **Antes de iniciar la pausa**, preparar en checkout aislado limpio el paquete final preconstruido para el futuro corte, con ambos rollouts Accounts/H7 habilitados únicamente en ese artefacto. Calcular la siguiente versión conforme AGENTS y congelar un único commit inmutable revisado, manifiesto y hashes de activos. Mantener coherentes app activa, índice, marcadores versionados y canónico, Service Worker/SHELL y Novedades; no duplicar versiones activas. Ejecutar validación local de versión, suite/pruebas pertinentes y verificación escritorio/móvil, cliente frío/caliente y SW con datos ficticios. La preparación no publica ni activa nada, no usa índices reales, no modifica la ventana local actual ni los literales false de su índice. Si falla una prueba, resolver antes de programar la pausa. Ese mismo paquete, sin edición o compilación durante el corte, es el único candidato del paso 6.

## Secuencia con puertas de avance

### 1. Cerrar admisión antes de tomar el snapshot

Bloquear nuevas mutaciones de SDK y de todos los servidores/entradas del inventario. Para SDK, antes del snapshot, componer la propuesta SDK contra baseline fresca, verificar/aplicar sólo en un corte autorizado y confirmar reglas efectivas; después fijar `sdkAdmissionPaused=true` mediante autoridad operativa existente autorizada. Mantener `sv_labor_config.ready=true` durante el drenaje fiscal y permitir únicamente la recuperación autenticada de resultados ya autorizados a través del gate HTTP fiscal. No confundir admisión de nuevas emisiones con recuperación. El gate de Cotizador debe detener admisión nueva sin destruir eventos pendientes. No usar todavía el cierre global ready=false ni readOnly del guard fiscal. Mantener lecturas necesarias para observación y recuperación. Comprobar concesiones padre: un veto hijo no revoca una superior. En servidores, comprobar cada ruta y revisión accesible; no confiar únicamente en reglas de usuario ante Admin SDK.

Conservar los eventos ya aceptados y sus reintentos: pausar consumo/admisión con retención o respuesta reintentable según el contrato probado de cada forwarder. No responder éxito a un evento no aplicado, borrar colas, perder IDs ni deshabilitar reintentos para aparentar drenaje. Registrar el tratamiento de eventos entrantes durante la ventana. Cualquier reanudación anticipada invalida el snapshot posterior.

**Evidencia:** hora de bloqueo, inventario de accesos, mecanismo y pruebas de rechazo sin mutaciones por acceso, ausencia de rutas antiguas admitiendo trabajo. **Abortar:** entrada omitida, una mutación todavía aceptada, pérdida posible de eventos o mecanismo no demostrado. No capturar una base para instalar derivados mientras sigan escribiendo originales.

### 2. Drenar trabajo admitido: dos controles independientes

Primero esperar y observar finalización de requests aceptados y operaciones coordinadas. Verificar lease/fence sin propietario activo; no borrar o expirar manualmente un lease para simular inactividad. Conservar recibos, resultados y errores. Una espera fija no es prueba de drenaje.

Separadamente inventariar y conciliar **todos los jobs fiscales** bajo admisión bloqueada. Una llamada externa puede seguir en vuelo o un resultado durable existir aunque `sv_labor_guard` esté vacío. No reemitir, cancelar como fallido ni marcar finalizado un job ambiguo para reducir contadores.

La evidencia fiscal minimizada debe cumplir el contrato schema2 del inventario: vínculos SHA-256 exactos a baseline/inventory/manifest/pause; `observedAt` fresco y posterior al drenaje; `admissionBlocked=true`; `admissionAccessIds` exactamente iguales al inventario completo; `activeRequests=0`, `ambiguousJobs=0`, `pendingAttachments=0`; `jobInventoryComplete=true`, `markersReconciled=true`, `resultsReconciled=true`, `guardEmpty=true`. Adjuntar huellas verificables de admisión, requests, inventario de jobs, conciliación y guard. Cero debe ser observación numérica, no ausencia del campo.

Conservar historia fiscal terminal válida, incluso marcadores históricos cuya factura actual fue sustituida. Un resultado durable sin marcador coincidente sigue pendiente; una autorización despachada sin resultado sigue ambigua. Resolver mediante conciliación/recuperación autorizada y volver a observar estable. No inventar una colección de requests ni inferir su cantidad por jobs.

**Abortar:** lease activo, HTTP admitido en curso, job ambiguo, resultado sin adjuntar, inventario incompleto, prueba vieja o contradicción entre marcador y resultado. Mantener pausa; drenar/conciliar no son equivalentes a desplegar.

Sólo después de observar cero requests activos, cero jobs ambiguos y cero resultados pendientes, con marcadores/resultados conciliados, pasar a `sv_labor_config.ready=false` para el freeze final. Conservar `sdkAdmissionPaused=true` y gates HTTP cerrados. Revalidar guard y ausencia de nuevas admisiones antes del snapshot. El cambio operativo de configuración requiere una autoridad administrativa ya autorizada y readback; el builder no concede al SDK capacidad para cambiar ready ni la pausa. Si aparece recuperación pendiente después del freeze, detener el corte y resolver bajo pausa SDK/admisión HTTP, restaurando ready=true sólo mediante operación autorizada para recuperar; después repetir drenaje y freeze, sin habilitar nuevas emisiones.

### 3. Actualizar todos los escritores con la pausa mantenida

Preparar y verificar Cotizador nuevo y `emitirFactura` compatible como conjunto. Antes de instalar índices, todas las entradas deberán apuntar exclusivamente a escritores que mantengan las proyecciones nuevas o quedar efectivamente cerradas. Cambiar principal y **las 14 etiquetas antiguas**, además de todo acceso directo inventariado; comprobar destinos y revisiones por metadatos. Si una revisión antigua sigue ejecutando requests, volver al drenaje aunque ya no reciba tráfico nuevo.

Mantener configuración coherente entre Cotizador y puente fiscal: coordinación habilitada, Pages, Accounts, H7 y mantenimiento de dependencias financieras en cada escritor que toca sus fuentes. Accounts requiere Pages; H7 requiere Accounts y Pages. Verificar claims reservados de capacidades en acquire **y** commit, versiones y rechazo de escritores incompatibles, incluida instalación entre adquisición y commit. No permitir una escritura que cambie originales omitiendo alguna proyección instalada.

Contrastar explícitamente `LABOR_SCOPED_ENABLED`, `LABOR_SCOPED_READ_ONLY`, `COMMERCIAL_PAGES_ENABLED`, `CLIENT_ACCOUNTS_ENABLED`, `CLIENT_HISTORY_ENABLED` y `CLIENT_HISTORY_READ_ENABLED` con la configuración admitida por cada paquete. La pausa debe mantenerse aunque cambien flags de mantenimiento. No habilitar aún lectura nueva, borrados ni frontend por el solo hecho de tener el contenedor desplegado. La capacidad financiera puede provenir del código/protocolo, no asumir un flag de entorno inexistente.

Preservar exactamente `COMMISSION_EVENT_ENABLED=true`, `COMMISSION_GENERATION_ENABLED=true`, `COMMISSION_OBSERVER_ENABLED=false`, autenticación/audiencia del receptor, configuración de corte y enlaces de forwarders. No restaurar el watcher remoto: la candidata rechaza observer=true al arrancar. Mantener el bloqueo de admisión separado de esos indicadores y garantizar los reintentos pendientes.

**Evidencia:** fuente/digest/configuración sanitizada de cada revisión, mapa completo de entradas→destinos, capacidades verificadas y pruebas QA de compatibilidad. **Abortar:** etiqueta/revisión antigua accesible para mutar, escritor sin mantenimiento, flag incompatible, fuente no identificada o requests antiguos todavía activos. No instalar derivados para compensar un escritor pendiente.

### 4. Snapshot estable y preparación de derivados

Con pausa y drenajes aún válidos, tomar snapshot privado completo de las fuentes exactas de cada derivado. Reobservar reglas, configuraciones y raíces técnicas por presencia shallow; usar los nombres reales del manifiesto, incluyendo Pages, Accounts, H7 y dependencias financieras. Su ausencia a las 10:26 no autoriza reemplazar lo que aparezca después. Si hay instalación parcial, detener y diagnosticar; no borrar raíces para volver al caso vacío.

Calcular y reconciliar offline los derivados desde ese snapshot: identidad y membresías, cuentas, páginas/totales, historial, dependencias financieras, cobertura, generaciones y huellas. Identificar ambigüedades/faltantes; no inventar domicilio, responsable, cobro o costo para completar la cobertura. Un gasto fiscal canónico de categoría Impuestos no requiere `porcentaje`; conservar veto ante comisión verdaderamente ambigua o registros históricos sin contrato verificable.

Preparar un plan multipath acotado a derivados/configuraciones, con hashes previos y resultado esperado. **No reescribir originales ni recalcular comisiones/históricos** para hacer coincidir un índice. Releer huellas de fuentes antes de aplicar: cualquier deriva invalida snapshot y plan. No usar el aplicador histórico de ownership como instalador de esta integración.

**Evidencia:** snapshot identificado por hash y hora, raíces/configuraciones observadas, reconciliación sin omisiones y manifiesto de cambios exactos. **Abortar:** deriva, coberturas incompletas, identidad ambigua no resuelta o necesidad de modificar originales fuera del alcance autorizado.

### 5. Aplicar reglas y derivados sin abrir una ventana de escritor antiguo

Releer inmediatamente las reglas remotas completas y comparar la baseline exacta, que ahora ya debe incluir la pausa SDK instalada. `commercial-write-cut-rules.prepare()` acepta esa baseline mediante normalización exclusiva del envelope SDK exacto y su metadata booleana; compone el resto y reaplica la pausa a todas las escrituras finales. Una envoltura parcial/alterada, metadata distinta o autoridad global nueva rechaza la composición; no recomponer desde la base anterior al bloqueo ni perder el gate al reemplazar reglas. Revalidar si hay cualquier otra deriva. La huella anterior no acredita vigencia. Probar composición en emulador con datos ficticios: permisos, capacidades, acquire/commit, concurrencia, abort, cuentas sin H7, instalación parcial y mantenimiento fiscal/comercial.

Antes de instalar el primer derivado, deben estar efectivos tanto el bloqueo de admisión como los fences de compatibilidad necesarios. El orden puntual entre reglas/configuración/índices debe estar ensayado para las precondiciones reales: no publicar una ready/configuración parcial accesible ni conceder temporalmente una excepción a un escritor legacy. Preparar/cargar derivados y sellar cobertura/ready sólo según ese contrato probado, sin soltar la pausa. Las reglas deben conservar protecciones existentes y acceso privado a raíces técnicas; no ampliar un padre como arreglo rápido.

Aplicar únicamente el plan autorizado y verificar leyendo lo persistido: hashes de reglas, generaciones, fuentes, cobertura, contadores/totales reconciliados y capacidades de todos los escritores. Conservar recibos y prueba fiscal final. El validador de archivos contrasta estructura y hashes; sus resultados `remoteVerified=false` y `activationAuthorized=false` no certifican un bloqueo real ni aprueban activación.

**Abortar:** baseline cambió, pruebas fallan, un fence falta, readback difiere, instalación parcial o fuente deriva. Mantener congelado y reparar con el plan acotado; no borrar índices instalados ni volver a escritor antiguo.

### 6. Publicar frontend compatible; aviso al final

Sólo después de verificar backend, reglas y derivados, publicar **el paquete final preconstruido y probado antes de la pausa**, identificado por su commit inmutable y manifiesto. Revalidar hashes y limpieza del checkout de publicación contra esa evidencia. Verificar también capacidades de lectura del servidor; frontend=true no las sustituye. No editar, compilar, cambiar versión ni preparar otra candidata en esta ventana. Si cambia cualquier byte del paquete, detener la publicación y replanificar con preparación y pruebas fuera de la ventana; no hacer una reapertura parcial para continuar el corte.

Desde checkout público limpio y SHA completo revisado, publicar sólo activos públicos mediante el procedimiento de Hosting seguro. El destino `ventas` es Firebase Hosting: push/Pages no publica allí. No usar este árbol con cambios ajenos como fuente, subir documentación o tocar DNS/IAM. Mantener admisión bloqueada durante publicación y verificación.

Comprobar HTTP y hashes del dominio real para índice, app inmutable, módulos, versiones, SW, catálogo y cabeceras. Verificar cliente frío/caliente y actualización de SW; conservar contexto al recargar efectivamente la ventana humana si está disponible. Si no puede recargarse, declararlo. **Sólo después de que la web entregue los activos correctos**, ejecutar el procedimiento de aviso de versión; nunca adelantar `sisventas/config/version` ni forzarlo ante falla HTTP.

**Abortar:** assets/versiones mezclados, fallo de capacidad/permiso, interfaz antigua incompatible aún admitiendo escrituras o publicación no comprobable. Puede revertirse la presentación a un frontend compatible manteniendo los fences; eso no autoriza restaurar escritores antiguos.

### 7. Reabrir únicamente después de todas las validaciones

Revalidar pausa, drenaje HTTP/fiscal, conciliación de resultados, guard vacío y ausencia de deriva desde el snapshot. Confirmar principal, etiquetas, accesos directos, fiscal y forwarders compatibles; reglas/derivados/cliente con hashes y capacidades esperados. Resolver toda dependencia pendiente antes de declarar esta puerta superada.

Reabrir de forma controlada los accesos autorizados, retirando sólo bloqueos temporales y conservando fences permanentes. Restablecer ready=true con los escritores nuevos compatibles mientras SDK y admisión HTTP siguen cerrados; verificar salud/capacidades sin crear operaciones comerciales de prueba. Sólo con las puertas satisfechas, retirar gates HTTP según el plan de accesos y fijar `sdkAdmissionPaused=false` con readback. Reanudar eventos/reintentos retenidos con deduplicación y recibos, observando mantenimiento atómico de proyecciones; no provocar una venta, cobro, factura o comisión real sólo para probar. Verificar por evidencia técnica autorizada y operaciones humanas legítimas. Si reaparece backlog ambiguo o deriva, cerrar admisión y volver a conciliación; no cerrar ready mientras sea necesaria una recuperación fiscal autorizada.

Registrar estado final real por separado: Git, servicios/configuración, reglas/derivados, Hosting/aviso y validación humana. No dar por finalizado por un push, un deploy exitoso o una prueba aislada.

## Abortos y recuperación según el punto alcanzado

| Estado alcanzado | Acción segura |
| --- | --- |
| Sólo preparación; ninguna aplicación | Cancelar el plan sin cambios remotos. Conservar evidencia y pendientes. |
| Pausa aplicada, sin índices nuevos | Mantener pausa hasta confirmar que no hubo cambios parciales. Sólo considerar configuración anterior tras verificar fuentes, reglas y compatibilidad y obtener autorización de reapertura. |
| Escritores nuevos desplegados, instalación todavía ausente | No reabrir por disponibilidad del servicio. Comprobar ausencia exacta de configuración/derivados y jobs; evaluar recuperación del conjunto completo. |
| Cualquier índice/configuración nueva instalada, incluso parcial | **No borrar índices ni restaurar escritor viejo.** Congelar, conservar originales/recibos/resultados, diagnosticar y reparar/reconstruir derivados con escritores compatibles y plan autorizado. |
| Resultado fiscal externo durable o incierto | Mantener bloqueo; conciliar autorización y marcador. Adjuntar resultado existente mediante recuperación probada; nunca reemitir automáticamente ni borrar el job/resultado para reiniciar. |
| Frontend/Hosting defectuoso con backend nuevo coherente | Mantener/reponer pausa si afecta seguridad o consistencia; restaurar únicamente cliente compatible o corregir assets. Conservar protocolos y derivados. |
| Deriva tras reapertura | Cerrar nuevamente admisión de todos los escritores afectados, preservar recibos y evidencias, drenar y reconciliar. No restaurar un snapshot completo sobre operaciones ya confirmadas. |

La recuperación preferida tras instalar derivados es congelar y reparar hacia adelante. Cualquier otra reversión necesita demostrar compatibilidad de todos los escritores con índices activos, jobs y reglas; disponer de la imagen vieja no lo demuestra. Los recibos confirmados y los resultados externos son evidencia que debe conservarse durante todo el proceso.

## Pendientes que impiden ejecutar este documento como receta automática

- Autorización explícita del conjunto final, SHA/paquetes/reglas/configuración y ventana de corte.
- Despliegue autorizado y observación remota del mecanismo de pausa por acceso; la propuesta SDK y su composición están probadas localmente, no aplicadas. Inventario fresco completo de entradas y rutas antiguas; gates HTTP sujetos a su evidencia propia.
- Cierre QA de transición fiscal externa durable y evidencia final de drenaje/reconciliación según contrato vigente.
- Baseline remota fresca, snapshot estable privado y plan derivado exacto revisado; cantidades y conflictos reales todavía no se presuponen.
- Paquete frontend final preconstruido, commit inmutable y hashes probados antes de la pausa, sin alterar el frontend local actual; evidencia de despliegue compatible de todos los escritores, cierre o redirección de las 14 etiquetas y entrega efectiva de ese mismo paquete antes del aviso/reapertura.

No hay ejecución implícita ni corte aprobado por la existencia de este documento.

## Evidencia local del control SDK

`test/sdk-admission-pause-rules.test.cjs`: 10 casos aprobados; junto con los 97 de evidencia de corte, 107/107 PASS. Se conserva la autorización original, lecturas y validadores; se rechazan grants globales/comodines no acotables, envolturas parciales/alteradas y metadata desconocida. No hay bypass por encontrar una palabra en una expresión: la condición reservada debe ser necesaria en todas las ramas OR originales.

`test/sdk-admission-pause-rules.integration.cjs`: 1/1 PASS, sin omitir, en emulador loopback 9046, namespace aislado `demo-sdk-admission-pause`. Baseline privada observada `dee40945c7224f449a1f460193c268796341bd97e3c82c8e00ea236385be1fb7`; 103 escrituras envueltas tanto en propuesta SDK aislada como en composición completa desde esa baseline ya pausada. Compilación real de ambas propuestas; 216 comprobaciones de alta/edición canónica, más campos propios de último acceso, multipath, permiso inactivo, control de metadata y claim reservado sin fence. SDK ausente/false conserva permisos previos, true/valor inválido bloquea, volver a false recupera sólo permisos previos. Bootstrap real con privilegio ya existente admite booleanos y rechaza metadata de otro tipo.

La misma integración ejecutó `bridge.resume()` con guard/store reales y resultado fiscal ficticio durable: con pausa SDK y ready=true adjunta sin reemisión; con ready=false conserva el resultado y deja adjunto pendiente. El SDK permanece cerrado en ambos casos. Esta matriz no aplica reglas remotas ni certifica gates HTTP, jobs o datos reales. Los hashes/archivos de evidencia y snapshots de las propuestas se conservan privados fuera de Git; un nuevo cambio de fuente o baseline requiere revalidarlos.
