# QA Comisiones31913 · 06/11/2026

Fuente congelada: base65e5bcee más diez archivos WIP del checkout commission-detail-v31913, copiados a qa-commission-original-31913. Manifest SHA256 privado: C:/SisVentas/tmp/qa-commission-original-31913/frozen.private.json. Módulo probado js/modules/commissions.js SHA256 2d05c066df9fce4681ef696f9f0a86010b8f8795423493f2b09b450117158c81. No se incluye ese WIP en el commit QA.

Resultado final: 6 PASS / 0 FAIL / 0 SKIP, Chrome efímero 390 y1280, HTML y CSS completos, 18.714ms. Archivo nuevo propio test/commission-original-demand.browser.cjs. Se usa commercial-full-app sin modificar: directorio ficticio liberado, ventas/pagos retenidos y lista vacía. El original existe sólo en endpoint puntual ficticio /comerciales/ventas/registro/qa-sale; SVCommercialOwnership.request y abrirDetalleComision son reales.

Tres casos por ancho: carga fría/reapertura/revocación tras carga; fallo503 sin resumen financiero engañoso y recuperación; original retenido seguido de fin de sesión sin repintado tardío. Consulta puntual nueva en cada apertura, ventasList permanece vacía. Se verifican neto2217805.24,costo1284833.79,manoDeObra405000,ganancia932971.45,pct15,monto139945.72, snapshot schema1 vinculado aqa-sale. El registro aprobado se conserva exactamente durante consulta y reapertura. No se accionan Guardar/Rechazar/Abonar/Agregar.

Teardown: cero intentos SDK de escritura, cero POST comerciales, cero comandos/commits del backend ficticio, snapshot comercial idéntico y cero solicitudes externas. Capturas inspeccionadas escritorio/móvil muestran importes y participantes. El fixture conserva su máximo de reparto predeterminado10%; por eso muestra15%/10% en rojo, sin modificar el15% almacenado. No es una lectura de la configuración real ni certificación de límites comerciales de producción.

Evidencia privada fuera de Git: C:/SisVentas/tmp/qa-commission-original-31913/matrix-ready.private.log y snapshot-{0,1}-{390,1280}.png, error-{390,1280}.png. Corridas previas de preparación se conservan separadas: el fixture general cargaba una venta y retenía empleados; fueron corregidos sólo los datos/arranque QA, sin alterar funciones productivas ni expectativas financieras.

Validación: node --check del archivo nuevo y git diff --check. No puerta global, servidor remoto, reglas, datos reales ni publicación. Chrome liberado al terminar. Próximo paso corresponde a root: incorporar test propio y ejecutar su puerta sobre fuente final congelada; estos seis casos no certifican las operaciones de gestión financiera.
