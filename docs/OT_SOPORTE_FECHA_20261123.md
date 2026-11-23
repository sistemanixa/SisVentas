# OT de Soporte: fecha y guardados · v3.21.4

Al editar fecha/hora, el campo de venta es una referencia de lectura, no una nueva selección. La validación usa otBuscarVentaOrigen y su registro autorizado por clave, ya verificado al abrir la OT; no depende de las cincuenta ventas de la lista ni de una selección de otra pantalla. Si falta el origen o su permiso, permanece bloqueada. Una venta editable y un reclamo inexistente siguen sujetos a validación. No se reasigna origen al cambiar una fecha.

Creación nueva: los vínculos y cada transición de estado se guardan juntos. Las dos fases usan dos escrituras en lugar de cuatro. Se omiten sólo campos escalares idénticos de los originales recién confirmados cuando se pide expresamente; reparación y recuperación mantienen su comportamiento anterior. No se reenvían importes, pagos ni comisiones. La búsqueda completa autorizada para encontrar intentos anteriores se conserva: no se trata un error como ausencia para crear duplicados. Encontrar una OT ya vinculada evita esa búsqueda.

58 pruebas focales PASS, incluidas seis nuevas de agenda, permisos/origen, vínculo+estado atómico y fallo sin confirmación. Navegador con aplicación completa:390/768/1280 PASS, fecha desde UI, origen autorizado real del fixture fuera de ventasList, un guardado ficticio y cero escrituras SDK/red exterior. La disponibilidad de vacaciones es una fuente vacía ficticia explícita; no se prueba agenda de vacaciones real. No se guardó la OT real ni se recreó un reclamo para medir. La reducción es de operaciones verificadas, no una medición de segundos en producción.

Sin migración Stock/OT/Compras, cambios de servidor, reglas ni permisos. El resto de pendientes permanece detenido.
