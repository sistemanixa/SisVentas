# Pendientes actuales de SisVentas

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
