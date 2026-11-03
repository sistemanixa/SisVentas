# Publicación inmediata v3.18.10

Pedido directo del titular: publicar el bloque listo para aliviar la lentitud. Fuente limpia basada en producción bfe0052f; incorpora sólo reutilización de páginas/preflight equivalentes entre Ventas/Dashboard, lecturas puntuales históricas de informes/OT, retiro de carga global de Pagos al entrar en Gastos y coherencia canónica de Cuenta corriente/estado de pago por centavos. Conserva diseño y operaciones actuales.

No incorpora Cobranzas nativa18.8, devolución a presupuesto18.7 que requiere servidor/reglas emparejados, ni la integración en curso por cliente. No activa índices/configuraciones nuevas ni altera originales, pagos, comisiones o stock. Sin compilación de servidor ni servicios adicionales.

La prueba de paridad300ventas usa la aplicación productiva18.6 como referencia conservada en este checkout, con los mismos importes esperados que la prueba previa18.8; la construcción de cuenta era idéntica entre ambas. Se conservan todas las pruebas de la base publicada y se agregan las pruebas focales aplicables. Validación final pendiente al preparar.

Validación del paquete limpio:96 focales PASS; puerta vigente7229total/7202PASS/27omitidas/0fallos(86,4s), incluidas pruebas nativas de Ventas/Dashboard y alta/edición de Gastos en390/1280 con datos ficticios. Sintaxis, diff y coherencia local18.10 aprobadas. Backend y reglas idénticos a la base productiva18.6.
