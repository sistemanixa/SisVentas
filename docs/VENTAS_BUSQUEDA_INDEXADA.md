# Ventas: búsqueda indexada y tabla original

Bloque v3.17.19. El listado inicial consulta hasta 50 resúmenes; la búsqueda por número, cliente u observación usa un índice de fragmentos normalizados (mínimo tres caracteres). Cada consulta devuelve como máximo 50 referencias y obtiene sólo esos resúmenes. Cinco tandas como máximo por acción; si quedan candidatos, Siguiente continúa. Abrir/imprimir/duplicar/editar carga un único original sujeto a los permisos existentes.

Los totales y la deuda provienen del resumen completo, no de las filas cargadas. Dashboard consulta sus totales y cinco recientes. Cambiar de dominio invalida la preparación financiera para no entregar un conjunto parcial como historial completo. Se detienen escuchas al ocultar/salir; no se agrega sondeo por reloj. Ordenar una columna ordena la página cargada y la interfaz lo informa; la exportación disponible es la página, con confirmación explícita. La búsqueda completa conserva acceso a ventas antiguas mediante Siguiente.

La actualización del índice se incluye en el mismo delta comercial; un cobro que no modifica número, cliente, observación ni ámbito no reescribe términos. No se cambia una venta, costo, cobro, comisión o stock para preparar el índice. La carga inicial enriquece sólo los resúmenes con metadatos de presentación de factura/autor/responsable, sin importes nuevos.

## Activación

Config `sv_commercial_pages_config.searchReady=true`, `searchSchema=1` sólo tras preparar/verificar cobertura completa. Se conserva la configuración adicional concurrente (por ejemplo salaryCoverage). Reglas de `sv_commercial_pages/v1/search/$scope/$term` reutilizan permisos, ámbito e identidad actuales; exigen orderByKey y límite 1–50. Ninguna escritura cliente nueva. Lectura raíz denegada.

Actualizar todos los escritores: Cotizador y paquete fiscal generado por `stage-guarded-invoice-function.cjs`. Preparar candidata sin tráfico, probar accesos sin autenticar, comprobar guardado financiero/emisión inactivos antes de pausar mediante sv_labor_config. Índice técnico con ETag y comprobación posterior; originales y agregados deben conservarse. Reglas se compilan contra base remota fresca; Google no proporciona ETag de reglas, por lo que exige comparación inmediata y verificación posterior, con riesgo residual de una publicación simultánea. Backups y evidencia sólo en tmp privado.

## Otros cambios del bloque

Historial de pagos resuelve UID al nombre conservado o al directorio público por UID; jamás consulta cuentas privadas ni muestra UID ante una denegación. Respeta sesión y cambio de rol. No modifica pagos guardados.

Las cuatro tarjetas de Gastos informan su filtro interno en el recuadro amarillo, con rango para vencimientos y conservación de categorías/empleados/búsqueda. Quitar filtros elimina el estado interno también.

## Validación

Suite vigente: 7.037 casos, 7.010 aprobados, 27 opt-in omitidos, cero fallos. Servidor: 94 aprobados. Emulador RTDB: tres pruebas de permisos/búsqueda acotada aprobadas. UI ficticia 390/1280: tabla nativa de diez columnas, búsqueda histórica, acciones puntuales, cinco recientes del Dashboard/deuda completa, filtros de cuatro tarjetas y limpieza. Sin operaciones financieras reales. Las pruebas aisladas no acreditan por sí solas activación remota ni revisión autenticada de la web: registrar ambas por separado en CONTEXTO_ACTUAL.
