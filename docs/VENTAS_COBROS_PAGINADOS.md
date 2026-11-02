# Ventas, Cobros y Dashboard: candidata local

Estado: v3.17.12 preparada sobre la publicación v3.17.11, en codex/paginacion-comercial-v31712. El titular autorizó terminar, activar y publicar. No habilitar sólo con Hosting: requiere escritores, índice y reglas emparejados.

## Lectura

- Los listados nuevos usan orderByKey/startAfter/limitToFirst y entregan como máximo 50 resúmenes por consulta; los filtros pueden explorar hasta cinco páginas acotadas para reunir coincidencias. Si quedan tramos sin explorar, se ofrece continuar y no se anuncia una búsqueda completa.
- Dashboard consume agregados diarios y cinco resúmenes recientes. Deuda histórica y clientes deudores proceden de todo el historial, independientemente de la página visible. Las gráficas mensual/semanal usan los agregados, nunca los cinco registros recientes.
- Los detalles completos se solicitan al abrir un registro concreto. Un resumen o selector de cobranza no se admite como venta editable.
- Exportar es una acción explícita: recorre páginas de 50 resúmenes bajo el mismo alcance y revisión; no descarga ítems, costos ni adjuntos de todo el historial. Una revisión concurrente interrumpe la exportación antes de generar un archivo parcial.
- No se agrega sondeo por reloj. Se consulta al entrar/regresar, actualizar, confirmar una operación o recibir un cambio real de revisión mientras la pantalla está visible. Se retira esa escucha al ocultar/salir.

## Consistencia

Los originales no cambian de formato. La proyección derivada sv_commercial_pages/v1 contiene páginas, metadatos, claves de búsqueda y contribuciones de deuda por cliente. Los cambios de venta/cobro actualizan originales y proyección dentro de la escritura financiera ya protegida. Una cobertura o generación incompleta provoca error, no un total cero ni una lectura automática del historial completo.

La prioridad contable conserva los pagos globales, incluso si todos están anulados; sólo sin relación global se usan pagos embebidos o resumen antiguo. Un centavo pendiente sigue siendo deuda. La reasignación cambia el alcance de lectura y mantiene el total global.

La generación y revisión se comprueban antes y después de leer. Cambiar cuenta, rol, permisos, ruta u ocultar la pantalla invalida respuestas tardías. Los resúmenes sólo contienen campos permitidos explícitamente; no incluyen ganancias, porcentajes de comisión, costos, PDF ni comprobantes.

## Prueba local

Ejecutar node scripts/dev-commercial-pages.cjs y abrir http://127.0.0.1:8909/. El servidor sólo expone archivos enumerados y datos ficticios en memoria; no inicializa Firebase, no escribe y rechaza operaciones distintas de GET. No servir el repositorio a Internet.

Las pruebas focales están en test/commercial-pages.test.cjs. test/commercial-pages-rules.integration.cjs usa únicamente el emulador loopback9046, SV_SECURITY_TOOLS y SV_COMMERCIAL_RULES_BASE; la base de reglas y evidencias quedan privadas fuera de Git. La demostración aislada no equivale a probar operaciones financieras en producción.

## Antes de activar

Este bloque local no ejecuta una migración ni publica reglas/configuración. La preparación productiva requiere un corte autorizado aparte: inventariar todos los escritores, preparar la proyección con la resolución canónica de clientes/responsables, comparar sus totales con los originales y verificar cobertura completa. Ambigüedades históricas impiden declararla preparada.

El servidor y la función fiscal deben incluir las dependencias y habilitar COMMERCIAL_PAGES_ENABLED=true antes de activar sv_commercial_pages_config.ready. Las catorce entradas deben apuntar al mismo escritor compatible. La candidata de reglas sólo deriva la autoridad de escritura financiera existente y restringe los nuevos lectores; no autoriza escrituras del cliente en los índices. Verificar emparejamiento de revisión, recuperación/idempotencia y reglas en emulador antes del corte. No activar la web aislada contra proyecciones inexistentes ni marcar listo por un push.

No se cargaron pagos, comisiones, ventas ni movimientos de stock reales para probar este trabajo. No se informa ahorro en dólares a partir de fixtures ni se promete latencia productiva sin medirla.

## Verificaciones de activación

Los importes guardados de ventas históricas son autoritativos; no recalcularlos desde ítems/IVA al preparar páginas. Ventas anuladas, incluso con nota de crédito, no generan deuda. La agrupación inicial usa el mismo resolvedor de clientes del sistema. Referencias ambiguas detienen la preparación. Cobranzas tiene agregados separados sin neto/IVA; el permiso de cobrar no abre la ficha comercial. Recibo/comprobante/anulación conservan controles existentes y la anulación usa el comando financiero protegido, nunca escribe resúmenes desde el cliente.

Ambos escritores deben usar COMMERCIAL_PAGES_ENABLED=true. El puente fiscal configura explícitamente el mismo guard y su paquete transitivo incluye el proyector. Cambios sólo en estadoInst/audit/observaciones/factura, con la imagen económica completa idéntica, no vuelven a leer ni reescribir cobros. Reasignar un presupuesto actualiza sólo el alcance de sus ventas históricas dependientes; responsables explícitos prevalecen.

Reglas derivadas de la base remota exacta agregan únicamente sv_commercial_pages y sv_commercial_pages_config. Escrituras reservadas al fence financiero existente; gateway rechaza escritura directa en esos espacios. Consultas nativas limitadas a50, sesiones/permisos inválidos se descartan. No agregar intervalos ni guardados por reloj.

Preparación productiva: pausar mediante CAS de sv_labor_config.ready preservando sus otros campos, comprobar guard libre, capturar originales y referencias, preparar/contrastar dentro de la pausa, escribir sólo proyección derivada y config con CAS, verificar cobertura, activar escritores emparejados y restaurar el mismo ready. Conservar respaldos y evidencia sólo en tmp. No reescribir ventas/cobros ni generar pruebas reales.
