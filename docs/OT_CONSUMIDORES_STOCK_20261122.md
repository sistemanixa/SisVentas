# Consumidores OT y conteo de oficina: composición ficticia local

Base de este bloque: `652f3c7ccbed2aec56b5ccb5929d387e3d8123b9`, descendiente de la fuente funcional publicada. Puerto Stock compuesto contra código comprometido `01347ba1c269fed21d015ca4253832fdf3708fd8`; no se copian sus políticas al consumidor. Los módulos exportados para las pruebas explícitas tienen SHA-256 fijados y se preparan con:

```powershell
node test/helpers/stock-reference-committed-core.cjs
node --test test/ot-stock-reference-core.integration.cjs
```

El primer comando exporta únicamente fuentes públicas del commit indicado a `tmp/audit-front-d/core01347`; no usa red ni datos comerciales. El segundo falla si falta esa preparación o cambia un hash. No hay omisión silenciosa. Las pruebas normales de consumidores y conteo no dependen de esa exportación.

## Comportamiento preparado, sin activar

Entrega, custodia, instalación, devolución y conteo admiten un callback interno opcional. Las tres identidades permanecen separadas: producto canónico para catálogo, inventario físico para el recurso y origen histórico para el recibo. No se reescriben remitos firmados, producto original ni recibos existentes. La asociación se representa como metadatos previos en la fixture y no modifica cantidades. Esta composición no pretende repetir la creación del vínculo con el comando tipado de E.

El callback de OT pasa por un contexto Symbol opaco, emitido tras autorizar e inseparable de usuario, rol, capacidad OT, operación y fence. JSON no transmite esa autoridad. Un contexto presente pero inválido se rechaza. La validación de commit vuelve a resolver desde los originales comprometidos. Se conservan las comprobaciones de existencias, reservas y otros custodios.

La cobertura real usa consultas dirigidas del núcleo 01347, no un índice ficticio ni un indicador de cobertura suministrado por la fixture. Puntos y consultas de igualdad conservan su CAS; los rangos se registran por invocación y se comparan con consultas frescas después de revalidar autorización. Se usa `queryPageFresh` del guard integrado `7f1c700c2b7d64b9f6fcd226e9b280a268ad8fef`; el acceso directo al mismo lector de Store sirve como compatibilidad con el guard previo y nunca reutiliza páginas planificadas. No hay caché global ni TTL. Callback ausente y OFF conservan resultados y secuencia de lecturas en los casos explícitos, incluido replay del conteo.

Conteo de oficina funciona sobre el inventario físico y confirma OT + inventario en un único PATCH. Preserva reservas ajenas, historial y precisión. Mantiene el recibo existente; cuando el conteo mapeado debe registrar su primer consumo, usa la identidad histórica del vínculo y deja auditoría verificable en `regularizacionesOT`. El permiso de conteo no se reemplaza por el de rendición.

Sólo ese comando puede acreditar ausencia de consumo previo para un adicional explícitamente pendiente, base instalada cero, sin recibo, revisión ni remito de esa fila y con los inventarios candidatos efectivamente leídos. Las cantidades pendientes son el objeto del conteo, no evidencia de un consumo anterior. Una base anterior positiva sin recibo se rechaza. El resto de los consumidores mantiene su clasificación estricta.

## Evidencia y límites

La matriz explícita cubre D→L→I, L→primera D, corrección/devolución a ambos lados de una revisión de L, devolución completa seguida de instalación sin nueva D rechazada, ACK perdido→L→replay único, origen histórico alterado rechazado, revocación de permisos/mapeo y aparición de un alias en el rango fresco. Conteo agrega tres identidades distintas, primer conteo después de L, replay/ACK perdido, ausencia de mapeo y rechazo de una base histórica no acreditada.

Las fixtures construyen sólo snapshots ficticios. El conteo de un adicional de oficina parte de un recibo sin reserva propia y conserva las reservas de otras operaciones; no se relajó el rechazo del modelo a contar un material con reserva propia.

Tanda de dominio final: 16 archivos, 246 pruebas, cero fallos, omisiones o cancelaciones. Log privado `tmp/audit-front-d/ot-consumer-final-domain.log`. Comprobación de sintaxis de todos los JS/CJS modificados y `git diff --check`. No se repitió la puerta global, que corresponde a la integración central.

Evidencia auxiliar solicitada en este chat: Servicios/autorización 10 archivos, 102 PASS; circuitos pendientes/ARCA/recuperación/auth 7 archivos, 55 PASS. Logs privados `services-node-resume.log` (SHA-256 `283b1dfbe9e045036c442ff7f675ce90aa9d1f4feeb26727f04048f71b200a2a`) y `pending-node-resume.log` (`3305d291876788da248506d4a69429d90f5653eacd462e95af2a22c17e806326`). Ambos se ejecutaron con bloqueo de red exterior. No demuestran funcionamiento con credenciales, proveedores o servicios reales.

No se abrió Chrome compartido ni se certificó un fix visual ON en 390/1280: no había una referencia concreta de ese fix en la coordinación vigente. No hubo escrituras externas, datos reales, publicación, push, builds, cambios de reglas ni activación. La composición de interfaz y el cierre SDK corresponden a los frentes coordinados; este commit no habilita consumidores aisladamente.

Para integrar, preservar los tres commits de latencia ya centrales: `652f3c7c`, `ceb58abd`, `30f1819e`. Este consumidor parte de 652; los conflictos en `ot-material-state`, `ot-lifecycle` y `ot-delivery-commit-protocol` deben conservar tanto la resolución de referencia como la cola acotada y las ventanas frescas de los dos últimos. La continuidad general y el estado externo se actualizan en el checkout central, no se sobrescribe su CONTEXTO desde este frente.
