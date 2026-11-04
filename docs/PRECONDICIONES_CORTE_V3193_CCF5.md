# Precondiciones pendientes de corte · integración ccf5

Revisión estática local del 04/11/2026 sobre
`ccf5dc3dba43917dfbb14ad31607f3138f4e4685`, sin modificar runtime, aplicación,
reglas ni configuración. No se consultaron remotos ni datos de negocio.
Este documento es un inventario de pendientes, no aprobación de publicación.

## Evidencia local y sus límites

| Evidencia disponible | Qué acredita | Qué no acredita |
| --- | --- | --- |
| Gate22 comunicado por el coordinador sobre ccf5: 8.794 PASS de 8.824, 0 FAIL, 30 SKIP | Puerta local de esa fuente; no se volvió a ejecutar en esta revisión | Despliegue, configuración remota, índices reales, rutas/tags ni las 30 pruebas omitidas |
| Cadenas operativas ficticias, precisión y State integrados; referencias en CONTEXTO_ACTUAL | Recepción/entrega/rendición/devolución y rechazos de invariantes bajo los arneses probados | Permisos de producción, completitud de originales reales o cierre de otros escritores |
| Atestación V2: 103 focales/regresiones; repetición root descrita en CONTEXTO_ACTUAL | Firma/bindings/revocación, sin TTL diario; callbacks falsos incompletos/deriva rechazados; store relee antes de commit | Callbacks operativos conectados, exclusividad real de publicación o detección de cambios privilegiados externos |
| Namespace privado de atestación: 85 comprobaciones en emulador sobre composición documentada | Usuarios de aplicación y claims forjados no acceden al marcador en esa composición | Reglas remotas actuales ni firma V2 por sí sola; el payload ficticio del ensayo de permisos no es una activación |
| HTML completo local: escenarios 60/1.095 y nativas 390/1280, evidencia previa en CONTEXTO_ACTUAL | Alcances y hashes de esas ejecuciones | No trasladar automáticamente sus resultados a un artefacto futuro con rollouts/configuración distintos |

No falta otra puerta global por esta documentación. Cualquier cambio posterior de
código/artefacto requiere la validación que corresponda a ese cambio.

## 1. Escritores y accesos: cerrar el inventario externo

| Entrada | Evidencia histórica disponible | Precondición todavía pendiente antes del snapshot/reapertura |
| --- | --- | --- |
| Cotizador principal y tag `return910199` | Procedencia documentada de `cotizador-return910199-bbf61e86`; fuente antigua sin todas las capacidades nuevas | Observar revisión/digest/configuración efectivos y demostrar la revisión nueva compatible, o cierre de admisión; 100% de tráfico general no neutraliza tags |
| Las 14 etiquetas antiguas listadas debajo | Snapshot local sanitizado las vinculaba a `cotizador-expenses3186a-bfe0052f` | Registrar por cada etiqueta destino/revisión/digest y si queda redirigida o cerrada; observar todos los accesos presentes, no asumir que siguen siendo exactamente 14 |
| URLs directas de revisiones y otros endpoints de Cotizador accesibles | El plan exige inventariarlas; no hay observación nueva en este bloque | Probar inaccesibilidad o compatibilidad/cierre efectivo de cada una, incluyendo solicitudes ya iniciadas en revisiones antiguas |
| SDK de pestañas actuales, antiguas, offline y otros clientes | Wrappers coordinados y fences preparados localmente | Pausa en reglas efectivas, revisión de concesiones padre/comodines y cierre permanente de writers legacy tras instalar Accounts/H7/OT; la UI o rollout false no son un fence |
| `emitirFactura` y revisión/URL efectivas | Histórico `emitirfactura-00033-vib`; paquete fiscal comparado en bloques anteriores | Paquete compatible reconstruido desde SHA final limpio, manifiesto fijado y despliegue/configuración contrastados; drenaje y conciliación old→new antes de instalar índices |
| `sisventasCommissionPayment`, `sisventasCommissionEnabled`, `sisventasCommissionPaid` | Tres forwarders Gen1 de eventos pequeños autenticados hacia Cotizador | Destino, audiencia, identidad, reintentos y revisión receptora observados; pausar admisión sin perder eventos, IDs ni reintentos; no ACK de éxito para eventos no aplicados |
| Workers, scripts/migraciones, tareas y procesos privilegiados | Deben cruzarse con manifiesto e inventario real; no queda cerrado por enumerar HTTP | Identificar cada escritor Admin/REST/SDK de servicio y demostrar cierre o participación en guard/proyecciones. Ningún escritor privilegiado queda cercado sólo por reglas de usuario |
| Asistente / `testTFApp`, correo y CostGuard | Exclusiones históricas por fuente revisada en INVENTARIO_ASISTENTE_Y_LIMITES_CORTE | Reconfirmar fuente/alcance si cambió su revisión. No excluir por nombre; correo cambia estados técnicos y CostGuard infraestructura según el inventario anterior |

**Las 14 etiquetas antiguas no son 14 escritores independientes.** Son accesos
a revisiones, además del principal/tag nuevo. El snapshot histórico local es
`tmp/stage1-integral-plan/eight-hour-cotizador-safe-metadata.private.json`;
no se lo presenta como inventario vigente obtenido hoy de Cloud Run:

1. `acceso-v3119`
2. `auditoria-final`
3. `auditoria-v31111`
4. `comerciales-v31113`
5. `comisiones-final`
6. `comisiones-fix`
7. `comisiones-v31113`
8. `migracion-comisiones`
9. `migracion-laboral`
10. `optimizacion`
11. `proyectos-v31110`
12. `seguridad-directorio`
13. `seguridad-horas`
14. `seguridad-vacaciones`

Fuentes: [procedencia](PROCEDENCIA_COTIZADOR_RETURN910199_FC422.md),
[inventario y exclusiones](INVENTARIO_ASISTENTE_Y_LIMITES_CORTE.md),
[plan de corte](CORTE_INTEGRACION_COMERCIAL.md).

## 2. Pausa SDK y fences que deben instalarse como conjunto

La pausa `sv_labor_config/sdkAdmissionPaused` cubre los `.write` de `sisventas`
y de `sv_usuarios`, `sv_chat_roles`, `sv_permisos`, `sv_commission_generation`,
`sv_commission_events`, incluidos descendientes y comodines. Ausente/false deja
la autorización anterior; true/valor inválido cierra SDK. Un bypass reservado
requiere autoridad original de servicio y sus fences; no es un permiso nuevo.

Después del corte no basta `sdk-idle`: con guard libre podría admitir clientes
antiguos si no están instaladas las restricciones permanentes. Se debe verificar:

- Accounts instalado exige writer claim interno v1, incluso en instalaciones
  parciales o si luego se retira ready; guard/recibos/índices deben exigir el
  protocolo de writers vigente (`writerSchema:2`).
- H7 instalado exige writer claim interno v1 para sus siete fuentes: ventas,
  pagos, presupuestos, `ordenes_trabajo`, reclamos, tickets y equipos.
- OT canónica `sisventas/ordenes_trabajo` y su resumen necesitan el fence de
  entrega con `otDeliveryVersion:1`, también idle, y protocolo interno de commit.
  El alias histórico `sisventas/ordenesTrabajo` se inventaría separadamente;
  no se lo convierte en canónico ni se asume cerrado por el fence del otro path.
- Inventario operativo, fuentes operativas, resúmenes, dependencias financieras
  y el namespace privado de atestación deben quedar en la misma composición
  exacta revisada. Un permiso padre/comodín puede invalidar un veto hijo.

`scripts/lib/commercial-write-cut-rules.cjs` **no agrega por sí solo** el fence
OT de entrega ni el namespace privado. La composición local del ensayo de
namespace aplica, en orden, `commercial-write-cut-rules`, `ot-delivery-fence` y
`ot-delivery-attestation-rules` (véase su helper). Para el corte se requiere una
baseline remota fresca, comparación de bytes exactos, composición final probada
y observación posterior de las reglas efectivamente instaladas. No reutilizar
como baseline vigente el hash histórico del arnés por conveniencia.

## 3. Compatibilidad y activación Accounts/H7/OT

| Capa | Condición concreta a contrastar | Pendiente externo |
| --- | --- | --- |
| Cotizador | `LABOR_SCOPED_ENABLED`, `OPERATIONAL_SUMMARIES_ENABLED`, `COMMERCIAL_PAGES_ENABLED`, `CLIENT_ACCOUNTS_ENABLED`, `CLIENT_HISTORY_ENABLED` emparejados en la revisión; `CLIENT_HISTORY_READ_ENABLED` separado para habilitar lectura H7 | Revisión/image/env efectivos y capacidades autenticadas. Capabilities no prueban por sí solas admisión abierta, datos preparados ni cierre de otros accesos |
| Fiscal | `labor-bridge.cjs` rechaza Accounts sin Pages, e H7 sin Accounts/Pages; el paquete debe conservar guard/store/proyecciones y las capacidades emparejadas | Reconstruir y contrastar manifest/sourceCommit de la fuente final; los manifiestos de versiones antiguas no certifican el paquete actual |
| Comisión | Conservar `COMMISSION_EVENT_ENABLED=true`, `COMMISSION_GENERATION_ENABLED=true`, `COMMISSION_OBSERVER_ENABLED=false`, autenticación/audiencia/destino | Verificación efectiva por entrada; no reactivar el watcher retirado ni alterar comisiones históricas |
| Frontend | En ccf5 los literales `SV_CLIENT_ACCOUNTS_ROLLOUT` y `SV_CLIENT_HISTORY_ROLLOUT` siguen `enabled:false` | Preparar otro artefacto revisado de activación con ambos habilitados y hashes/versión coherentes. Gate22 no prueba automáticamente ese índice distinto. No editar/compilar durante el corte ni alterar la ventana del titular |
| Datos derivados | Un snapshot completo y estable de las 17 fuentes del preparador, con fingerprints y precondiciones de destinos; preparar Pages, pertenencia de pagos, Accounts/Directory, H7 y dependencias financieras como conjunto | Snapshot privado nuevo, conciliación y aplicación acotada autorizada; problemas de identidad/importe se resuelven o bloquean, no se inventan propietarios/ceros |
| Configuración | Cada root/coverage debe coincidir con **su propia** generación/configuración, schema/revisión y dependencias del manifiesto; no forzar una generación idéntica para todas las proyecciones | Leer estado exacto y verificar postinstalación. El preparador es derivado-only y deja `remoteVerified`, `activationAuthorized`, `cutEligible` en false |
| Activación OT | `OT_LIFECYCLE_ENABLED` y `OT_DELIVERY_ENABLED` efectivos; `sv_labor_config` schema1/ready, `writerSchema:2`, `otLifecycleVersion:1`, `otDeliveryVersion:1`; configuración operativa/listados schema1/ready; H7 ready/writerSchema1 y Accounts/H7 en el guard | El activation patch comercial no instala por sí solo todos estos marcadores, reglas ni flags. No completar metadata remota por deducción de un PASS local |

Durante drenaje mantener `sv_labor_config.ready=true` y la recuperación fiscal
autenticada necesaria; `ready=false` o `LABOR_SCOPED_READ_ONLY` impedirían el
adjunto fiscal. Pausar SDK y nuevas admisiones HTTP con sus controles separados.
Los POST de lectura permitidos durante pausa son `/laboral/capacidades`,
`/clientes/historial`, `/clientes/historial/cliente`. `/cuentas/preparar` sigue
cerrado porque puede escribir bootstrap; no sirve como prueba incidental de lectura.

## 4. Atestación V2: callbacks y autoridad pendientes

El contrato implementado está en [OT_ATESTACION_V2_CONTRATO.md](OT_ATESTACION_V2_CONTRATO.md).
Runtime requiere firma Ed25519 v2 y valores revisados para
`OT_DELIVERY_EXPECTED_RULES_SHA256`, `OT_DELIVERY_EXPECTED_GENERATION`,
`OT_DELIVERY_EXPECTED_ARTIFACT_SHA256`, `OT_DELIVERY_ACTIVATION_ID`, clave pública
y `OT_DELIVERY_ENABLED=true`. Son nombres/condiciones, no valores para copiar.
V1, mezclas con expiresAt, marcador ausente/revocado y bindings incompatibles se
rechazan; la firma no requiere renovación diaria.

Pendiente: conectar **al publicador operativo existente** `readInstalledRules`,
`readOperationalConfig`, `publisher.readMarker` y `publisher.readCutProof`.
Sus hechos deben provenir de observaciones verificables: SDK/comercial/fiscal
pausados, guard vacío, HTTP drenado, fiscal conciliado, todos los writers cerrados,
exclusividad y mismos artifact/rules/generation/activation. El proof es efímero;
no autoriza inventar otro nodo de metadata ni otro lock.

Secuencia a ejecutar sólo bajo corte autorizado: revocar marcador → pausar y
drenar → instalar/verificar bytes y generación → preparar/publicar marcador
exacto → `verifyPublished` todavía pausado → aceptación → autorización de
reapertura. Ante fallos, mantener cierre; nunca restaurar automáticamente un
marcador viejo. Preparador y verificación **no publican, reabren ni autorizan**.

Exclusividad y drenaje siguen siendo precondiciones operativas. La atestación
no observa cambios privilegiados externos que dejen marcador/generación intactos;
revocar tampoco cancela solicitudes que ya superaron su última lectura. No hay
garantía implementada sobre un escritor fuera del publicador: debe cerrarse o
incorporarse con evidencia antes de aceptar el corte.

## Criterio de cierre externo y entrega

Exigir un manifiesto que vincule SHA limpio final, artefactos frontend/fiscal,
fuente/digest/configuración de cada acceso, baseline/reglas instaladas,
generaciones/fingerprints, estado de pausa/drenaje y comprobaciones posteriores.
El validador offline comprueba consistencia, no autenticidad ni completitud de
observación. Un guard vacío, un push o un despliegue HTTP exitoso aislados no bastan.

Frontend se publica por Firebase Hosting conforme a
[PUBLICACION_HOSTING_SEGURO.md](PUBLICACION_HOSTING_SEGURO.md), desde checkout
limpio y SHA revisado. Verificar activos efectivos, SW, cliente frío/caliente y
capacidad/datos autorizados antes del aviso Firebase y reapertura. Ninguna venta,
cobro, comisión, emisión ni eliminación real se usa como prueba incidental.
Si falta una evidencia anterior, el corte permanece pendiente sin abrir permisos.
