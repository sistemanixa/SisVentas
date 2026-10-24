# Mi cuenta y adelantos · v3.14.19

Publicación urgente autorizada expresamente por el titular como excepción a la tanda de veinte. Incluye sólo Mi cuenta, sus avisos y el mes de descuento de adelantos. Las mejoras de precios, Dólar, reintentos de versión, Asistente, Cobranzas CPU y sesiones externas permanecen separadas.

El Dashboard usa la misma proyección de Mi cuenta. Total pagado suma pagos confirmados según su fecha efectiva, con centavos y sin duplicar el espejo CTA/Gastos. Las comisiones pagadas no cuentan como pendientes. El total a cobrar respeta el mes de descuento del adelanto. La aprobación de los avisos se compara por día local, conservando controles de identidad, importe y estado.

El mes de descuento se elige al solicitar o entregar un adelanto; la entrega propone el mes siguiente. Un dato explícito válido prevalece. Los registros antiguos sin ese campo derivan el mes siguiente de una fecha de entrega/pago válida; sin fecha no se inventa un mes. No se migran ni recalculan pagos o compensaciones ya guardados.

La selección y el cálculo funcionan en el navegador. No hay una llamada adicional para consultar si corresponde descontar: se verifica dentro del guardado financiero existente. El validador de Cotizador rechaza nuevas compensaciones anteriores al período, aumentos sin detalle y cambios de mes sin acción de gestión/aprobación ya existente. Revalida perfil y permiso antes del commit cuando corresponde. Las reglas, permisos, actores, controles obligatorios anteriores y leases conservan su circuito. No agrega servicios, relojes ni escrituras propias.

Una fuente CTA propia vigente por Dashboard mantiene actualización por push. Los repintados no hacen otro GET. Se retiran datos/transportes al salir, ocultar o cambiar contexto; los errores tienen recuperación manual. Gastos sólo reproyecta datos vigentes. Horas extra se adquiere una vez por intento y sus repintados no repiten HTTP. Readv1 queda disponible para clientes anteriores; Sourcev1 nuevo sirve a19.

Las pruebas financieras, permisos, concurrencia y QA usan registros ficticios. Las comprobaciones de la cuenta visible son lecturas acotadas, sin operaciones de prueba ni datos reales en Git. Los conteos de SDK/JSON de los escenarios aislados no equivalen a transferencia física ni ahorro facturado.
