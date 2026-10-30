## Activación bloqueada por revisión automática · v3.17.3

Código y pruebas terminados:6770total/6743PASS/27opt-in/0fallos;94backendPASS;15reglas combinadas PASS. Build6eaedbdc SUCCESS,81s, fuente backend7bd8fafc. Hosting/reglas/tráfico productivos siguen17.2/anteriores. La revisión automática rechazó volver a ejecutar el preparador de índices (sin --apply) porque lo consideró una activación con nuevas rutas/permisos no autorizados específicamente. No se elude el rechazo ni se aplicó la activación. Se requiere confirmación humana concreta para los índices/cfg/reglas de Chat y Compras y el corte coordinado. Mientras tanto se conserva el paquete privado y el ejemplo local.

Pedido confirmado: se reprodujo también el snapshot JSON sin result.margin; la vista para stock omite el cálculo de margen de venta y conserva las cifras guardadas. Guardado/confirmación no aparecen y el texto indica pedido confirmado. Dos anchos PASS, sin tasas nuevas, escrituras ni recepción. Sólo cambia frontend respecto del backend7bd8fafc: no requiere otra compilación.

# Cierre de auditoría · candidata v3.17.3 · 30/10/2026

Estado separado: este bloque está preparado y probado localmente; producción conserva v3.17.2 hasta registrar el despliegue y la comprobación web. Sin push público ni avance de main. No se guardaron operaciones comerciales, cobros, comisiones o movimientos de stock como prueba.

- Chat: cabeceras livianas para contactos, no leídos y búsqueda completa; cuerpos de75mensajes, anteriores por acción y mensaje puntual para un resultado. Edición/borrado emparejados con comparación de texto, edición y lectura; adjuntos por el uploader existente. Reglas candidatas niegan suscripciones ilimitadas de cuerpos, conservan la autoridad original y no habilitan conversaciones ajenas.
- Compras: resumen de órdenes, preparaciones e inventario sin comprobantes, auditorías o asignaciones privadas. Detalle puntual; emparejado transaccional por registro, revisiones y operación idempotente. No se reintenta a ciegas una respuesta de red ambigua. Cambios financieros derivan el resumen dentro del PATCH protegido; no se retira su fence compartido. Agrupar/separar usa sólo los IDs seleccionados.
- Recepciones: costos reales de tandas y stock previo se mantienen separados, gastos de compra se incluyen una sola vez, códigos repetidos usan renglón/cantidad/costo original y las ambigüedades antiguas se rechazan. Se conserva la base original de comisión y su costo cero válido. Pruebas de stock, devolución, OT cerrada, remito y recepción interrumpida se ejecutan con fixtures, no se modifica la OT histórica del titular.
- Venta a presupuesto: se retira la cascada de borrados y el guardado por pasos. Nuevo presupuesto y baja de venta son atómicos; preparaciones sin compras/stock se cancelan con historial. Cobros (índice completo, incluidas referencias numéricas antiguas), factura, OT, agenda, compras o comisiones impiden mover sin resolver su circuito. Se revalida antes de confirmar y no se eliminan derivados financieros.
- Agenda: medición única de la fuente vigente:10registros/3277bytes,10fechas ISO. Se conserva el contrato de cobertura histórica/fechas antiguas del origen compartido; salir/ocultar/sesión lo retiran, sin consultas por reloj. No se aplica una ventana arbitraria ni otro servidor para3,3KB.
- Protección de costos: configuración remota inspeccionada una vez (se corrigió la región del controlador en el lector): sisventascostguard,us-central1,Ready,min0; presupuesto60USD y notificationsRule.pubsubTopic presentes; alertas30USD con umbrales50/70/90/100% y previsión. Política conserva comienzo noviembre2026. No se simuló un aviso de corte en producción ni se afirma un límite exacto por alertas demoradas.
- Compras de exterior: se integran sólo los cambios UI acordados con el otro chat: gastos por lista, nombre/fecha, exportación y ahorro frente a compra local con base capturada. Referencia ausente queda Por completar; no se convierte el descuento del proveedor en ganancia ni se inventa un costo histórico. Lotes por costo es un pedido nuevo en otro bloque y NO se activa aquí.

Preparación privada de índices:68mensajes,38órdenes,27listas,104SKU;248lecturas/1321211bytes incluida configuración. Fuente operativa576251bytes→265193 de resúmenes; Chat20162→15879 de cabeceras (además de la ventana de cuerpos). No son cifras de factura ni prueba de ahorro mensual. Preparación sólo escribe en índices técnicos/configuración y reglas, nunca originales; prueba de reversión restaura la regla exacta si no cambió concurrentemente y rechaza un guardado financiero activo.

Evidencia privada fueraGit/Hosting: tmp/operational-summary-audit y tmp/chat-header-audit. Reglas combinadas:8Chat+7Compras/financiero PASS;5activación/reversión,6retorno a presupuesto y94backend PASS. UI real aislada390/768/1280, búsqueda histórica y paginación, sin red exterior; PDF4variantes y75renglones PASS. Puerta final:6770total/6743PASS/27opt-in/0fallos;94backendPASS. Pedido congelado sin pending:390/1280PASS, sin tasas actuales, reconfirmación ni escrituras. SHA y estado externo se registran tras el despliegue. Ejemplo local real abierto en62321 con datos ficticios; no es una prueba de operaciones reales.

Decisiones explícitas: conservar el fence por cobertura financiera compartida; mantener la pequeña fuente Agenda con sus garantías; una prueba de7horas sin clientes no se inventa a partir de45segundos ni se programa de nuevo sin un intervalo acordado. Estos límites de observación no justifican dejar consultas por reloj. Antes de declarar Publicado: activar servidor/índices/reglas coordinados, Hosting limpio, activos byteexactos y comprobación de sesión web de sólo lectura.

# Pendientes vigentes · revisión posterior a v3.17.2 · 30/10/2026

Este encabezado reemplaza el estado vigente de las listas de octubre anteriores. El archivo conserva su inventario histórico debajo; no se debe interpretar una candidata antigua como un faltante actual ni una suite aprobada como una publicación.

## Entrega comprobada

- Hosting v3.17.1: fuente 69f5caa12ad29bced5b49c3413ce6052a3d9b4dd; archivos del dominio, cabeceras, rutas privadas y aviso oficial verificados. Progreso al agregar participantes y conservación del detalle probados sólo con datos ficticios.
- v3.16.20 y v3.17.0: preparación comercial directa cuando corresponde, listados propios indexados, disponibilidad OT por fecha, recuperación de confirmaciones y recepciones, caché comprimida acotada, suspensión de recargas sin dependencia comercial y sonda estática. Evidencia y límites en CONTEXTO_ACTUAL.
- Salarios/mano de obra, costos capturados por guardado unificado, edición de costos por permiso, privacidad comercial de Proyectos, pago administrativo de bonificaciones y materiales/remito OT tienen entregas posteriores al índice histórico. Su presencia en una lista antigua no los vuelve a convertir en desarrollos nuevos.

## Cerrado y publicado en v3.17.2

Proveedores: no escribe al consultar; cambios privados/públicos emparejados por SDK con reglas probadas. Relevamientos: lista compacta, detalle a demanda, originales preservados e índice completo verificado. Compras: órdenes anteriores sólo por acción y páginas visuales de50filas, sin truncar búsqueda o totales. Fuente ff67a843; pruebas y comprobación de producción en CONTEXTO_ACTUAL.

## Trabajo que continúa abierto

| Bloque | Evidencia actual | Condición de cierre |
| --- | --- | --- |
| Primeras descargas amplias | Chat conserva suscripción del canal completo; Compras conserva las tres fuentes operativas modernas; Agenda conserva su cobertura histórica. Relevamientos ya usa índice compacto17.2 y Compras retiró la lectura legacy automática. | Revisar cada consumidor y sus contadores/no leídos/deuda/fechas antiguas. No aplicar limitToLast o ventanas arbitrarias que oculten operaciones. Reducir transferencia desde la fuente con cobertura verificable y pruebas. |
| Venta que vuelve a presupuesto y sus derivados | El índice histórico pedía revisar preparación huérfana y efectos separados. Esta revisión no encontró todavía evidencia suficiente para certificar todo ese circuito actual. | Reproducir con datos ficticios y confirmar qué se conserva, anula o retira; pagos, factura, OT ejecutada y comisiones no se borran en cascada. |
| Cobertura del inventario histórico | OT tuvo varias correcciones publicadas; el estado de una operación real concreta no demuestra todas las variantes de entrega/devolución/serie/garantía. | Mapear pruebas por variante y cerrar sólo las verificadas, sin usar OT ni stock real como prueba. |
| Consumo de reposo y protección de costos | Existe perfil acotado de 45 segundos, no ensayo controlado de siete horas sin clientes. Las alertas no acreditan un límite exacto de facturación. | Verificar configuración remota vigente y comparar un intervalo acordado. No inventar cero a partir de huecos ni instalar consultas periódicas. |

## Decisiones conservadas

El fence de nuevas escrituras financieras no se elimina: payment-membership-index conserva cobertura global. La prueba privada payment-coverage-concurrency.saved.test.cjs reproduce pérdida de cobertura con dos deltas calculados desde la misma versión; con cobertura fresca secuencial conserva ambos. Un lock local o por venta no reemplaza ese contrato. Rediseñar ese índice es una migración distinta, no una corrección inocua pendiente de retirar una línea.

No se promete ausencia universal de fallos. Cierre de cada bloque exige código actual, pruebas pertinentes y estado externo cuando corresponda. La revisión de este encabezado no desplegó nada ni tocó datos comerciales.

---

# Inventario histórico conservado (27/10/2026)

# Pendientes actuales de SisVentas

**Publicado v3.15.16:** búsqueda por producto comprado, carga continua para stock y retorno contextual de detalle. Fuente788296ad, Hosting2994b8dea39a6001.6236PASS/27opt-in; sin cambios de servidor ni stock real de prueba. Mantener abierta incidencia de materiales históricos.

**Instalación histórica sigue abierta:** la revisión real posterior a15.15 no acredita el resultado de los fixtures. Conciliar identidad/origen/disponibilidad sin inventar materiales ni stock. Buscador de productos comprados16 publicado y verificado. Diagnóstico operativo sólo privado.

Incidencia OT anterior/instalación individual: v3.15.15 publicada y verificada. Fuente e673302a, Hosting5b7e5079f7c02bd6. Ver OT_INSTALACION_INDIVIDUAL_V31515.md. No modifica OT-173 como prueba.

Bloque OT/stock v3.15.14 publicado y verificado: adicionales instalados, consumo por revisión sin duplicados y corrección admin de OT cerrada. Fuente 9a6251e5, Hosting25967b002932ac96; no incluye custodia por serie ni garantías. Ver [alcance](OT_MATERIALES_STOCK_V31514.md).

Actualizado el 27/10/2026. Este es el índice vigente para ordenar el trabajo entre chats. Las listas fechadas por versión se conservan como antecedentes, no como tareas nuevas. Última publicación documentada: v3.15.15, instalación individual y referencias históricas verificadas con datos ficticios.

## Orden de trabajo

| Prioridad | Tema | Estado | Qué falta para cerrarlo |
| --- | --- | --- | --- |
| 1 | Carga segmentada y consumo | Primer detalle puntual implementado y probado en una rama propia, sin activar. Dashboard y listado general todavía pendientes. | Dashboard por mes actual/anterior; listado inicial de seis meses con páginas y Mostrar anteriores; historial puntual del cliente. Mantener deuda antigua, pagos, comisiones y vínculos fuera del período. Medir descarga DB y navegador, arranque y reposo. Integrar con la última web publicada antes de cualquier corte. |
| 2 | Pasar una venta a presupuesto | Auditoría con datos ficticios detectó pasos separados y preparación huérfana. Sin corrección publicada confirmada. | Definir y probar una operación coherente, recuperable y sin duplicados; conservar cobros, trabajo ejecutado, comisiones, reservas e historia. No resolver borrando registros reales ni ejecutar una cascada incidental. |
| 3 | Mano de obra y salarios técnicos, pedido de Harvy | Diagnóstico terminado; propuesta pendiente de conversación. No implementación autorizada por ese pedido. | Acordar plantel técnico, conceptos salariales, período y si se compara lo vendido, ejecutado o cobrado. Separar costo presupuestado de salario real, descuentos, impuestos y adelantos. No sumar dos veces la misma mano de obra. No incluir aún gastos generales de Nixa ni ejemplos hipotéticos como datos reales. |

El orden anterior prioriza trabajo operativo ya autorizado. Las propuestas no se convierten automáticamente en desarrollos ni publicaciones.

## Bloques técnicos abiertos

Estos bloques acompañan las prioridades anteriores y no se cuentan otra vez como tareas independientes para inflar la lista.

- **OT por unidad y garantías:** completar/verificar el circuito de entrega, cinco equipos y cinco series, lector de códigos, instalación y devolución. La propuesta de custodia y sus pruebas no equivalen a un circuito completo publicado. Conservar garantías existentes. Se coordina con la prioridad 1 sin atribuirle alcance que todavía no tenga.
- **Privacidad y operaciones financieras:** hay transportes, vistas y comandos preparados en la candidata amplia, sin activación general. Quedan cobertura, preparación, permisos fiscales, recuperación y corte coordinado de escritores antiguos. El pago específico de bonificaciones ya publicado no activa todo este rediseño.
- **Otras lecturas amplias:** Relevamientos con fotos, bandejas de Chat/Comunicados, Agenda, Compras/Inventario y cuentas necesitan contratos propios. Proveedores aún publica desde una lectura: requiere moverlo a escritores coordinados sin ampliar permisos. Se resuelven por módulo dentro del trabajo de consumo, preservando históricos.
- **Costos de Google Cloud:** comparar consumo real después de cada bloque. Los objetivos documentados de aviso/corte requieren verificar configuración remota antes de darlos por activos; no se crean sondeos ni costos fijos por organizar estos pendientes.

## Ya publicado y fuera de la cola de desarrollo

- Instalación individual e históricos OT: Marcar instalado por fila, originales/adicionales separados y referencias sin duplicar, v3.15.15.65focales y suite6.225PASS/27opt-in; no se guardó OT-173 ni stock real como prueba.

- OT/materiales y stock: adicionales instalados, consumo por recibo/revisión y corrección admin en OT cerrada, v3.15.14. 38 focales y suite6.198PASS/27opt-in; sin corrección automática de históricos. Custodia por unidad y garantías quedan separadas.

- Herramientas de pedidos en Mi lista y Preparar compra: PDF neutro, CSV y Compartir, v3.15.5.
- Optimización del cálculo de Cobranzas, v3.15.6. Reduce CPU; no equivale a segmentación del historial desde la base.
- Formato de WhatsApp con cantidad, código, nombre y enlace; scroll del buscador de clientes, v3.15.8.
- Consumidor Final y edición conservando identidad/fecha de la venta, v3.15.10.
- Correcciones de Directos, contactos por UID, destinatario/retorno y presencia; ancho del buscador de OT, v3.15.11 y v3.15.13.
- Pago administrativo de bonificaciones sin abrir cuentas privadas, servidor y web v3.15.12.

Publicado describe la entrega documentada y su alcance. Un problema nuevo en esos circuitos se registra como incidencia concreta, sin reabrir toda la tarea anterior.

## Asuntos personales para retomar aparte

Seguros, comprobantes pendientes de tarjetas y revisión mensual de liquidaciones se mantienen separados del desarrollo de SisVentas. Antes de volver a listar pedidos antiguos de tasas, cierres u observaciones como cambios pendientes, contrastarlos con la versión actual: la conversación histórica no prueba que sigan faltando. La comparación de cámaras Flytec, Biosegur y Mercado Libre es una consulta de compra, no un cambio de software pendiente.

## Evidencia y coordinación

- Publicación v3.15.13: fuente 332b3ac89350d58eb0b9af4d6d3d777d02e668f1 y continuidad del checkout responsable de publicación. No se hizo una nueva inspección remota por este ordenamiento.
- Detalle segmentado: daf9fc13456fb2426d2aa5196dd904c3743f866f; ver [primer bloque](CARGA_SEGMENTADA_PRIMER_BLOQUE_20261027.md). Candidata histórica v3.15.9, no versión productiva posterior a v3.15.13.
- Harvy: pedido de Calcular facturación necesaria y diagnóstico de Auditar cobertura salarial técnica. Alcance: diagnóstico, sin modificar código ni finanzas; importes ilustrativos excluidos.
- Publicación y OT/stock: chat Revisar gastos duplicados históricos. Segmentación: chat Abrir SisVentas en ventana nueva. No ejecutar despliegues simultáneos ni sobreescribir las correcciones publicadas con una aplicación anterior.

Para actualizar: conservar estos temas, cambiar su estado con evidencia y retirar de la cola lo que efectivamente se publique. Usar Pendiente, En curso, Probado local o Publicado; una prueba local no acredita producción.
