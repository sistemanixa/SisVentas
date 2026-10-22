# Preparación del corte de Cobros y Gastos

Estado: candidata local, sin autorización de activación en este bloque. Este
documento no ejecuta ni acredita una migración, una publicación o un ahorro.
El código de planificación y reglas es offline; no debe apuntarse a producción
como prueba. Mantener la pausa de guardados hasta completar el conjunto.

1. Fijar un SHA completo revisado y checkout limpio. Ejecutar la puerta vigente,
   pruebas focales, integración RTDB ficticia y comprobación de activos. Revisar
   explícitamente el alcance, sin incluir `tmp/`, sesiones o credenciales.
2. Inventariar revisiones, tráfico y accesos realmente activos de Cotizador y
   emitirFactura, incluidos accesos de prueba y otros escritores con Admin SDK.
   Preparar paquete fiscal con `scripts/stage-guarded-invoice-function.cjs`
   desde ese SHA y revisar su manifest: guard/store y dependencias transitivas
   `payment-membership-index.js` y `payment-membership-matcher.js` incluidas.
   Una operación fiscal que no escriba el índice puede no evaluar la nueva
   restricción; la versión del claim no sustituye comprobar el paquete.
3. Leer y respaldar privadamente las reglas remotas exactas. Compararlas con
   la base coordinada revisada; `scripts/prepare-payment-index-rules.cjs`
   exige hash y produce sólo `.candidate.json`. Diferencias remotas requieren
   revisión, no reemplazo ciego. La restricción nueva alcanza el padre común
   `sv_labor_indexes`, por lo que afecta también Gastos/Horas Extra.
4. Informar costo de compilación, preparación, índice y funcionamiento según
   recursos y precios vigentes. Las mediciones de bytes/CPU ficticios no son
   estimación de factura ni garantía de no aumento. No añadir servicios,
   reservas mínimas ni sondeos para esta preparación.
5. Obtener una ventana confirmada sin pagos, emisiones ni otros guardados
   afectados; bloquear nuevas operaciones y esperar los vuelos existentes.
   Un timeout del cliente no demuestra que una emisión o escritura no ocurrió.
   Preservar y resolver los intentos inciertos mediante sus recibos.
6. Actualizar todos los escritores coordinados, conservando las capacidades
   desactivadas durante la preparación. Verificar reglas y versiones reales,
   no sólo Git. Preservar el índice laboral existente y sus proyecciones.
7. Bajo estado estable, leer Pagos una vez, planificar índice con cobertura
   `ready:false`, escribirlo y **releer fuente e índice completos actuales**.
   El helper `payment-index-preparation` sólo verifica las imágenes suministradas;
   no obtiene esa relectura ni crea por sí mismo un corte estable. Superar
   8 MiB/18.000 hojas requiere procedimiento por etapas revisado aparte.
8. Sólo tras comprobar igualdad completa, coordinar cobertura `ready:true`,
   reglas de escritores nuevos y `PAYMENT_SCOPED_ENABLED`/
   `ADMIN_EXPENSE_SCOPED_ENABLED` con `LABOR_SCOPED_ENABLED` y web compatible.
   `ready:false` ya bloquea pagos en el guard nuevo; `ready:true` con clientes
   viejos/capacidad apagada puede rechazar sus guardados. No abrir la operación
   normal con una combinación intermedia.
9. Publicar sólo activos públicos conforme a `PUBLICACION_HOSTING_SEGURO.md`,
   validar la versión local antes y la web efectiva después; actualizar aviso
   sólo después de recibir activos nuevos. Fechas de tarjetas requieren además
   los modelos Cotizador y el esquema Asistente correspondientes, sin reescribir
   resúmenes existentes. Verificar CSS e importaciones de private-finance.
10. Comprobar salud, banderas, reglas y lectura autorizada sin crear operaciones
    reales de prueba. Pagos/permisos/comisiones se validan en emulador y fixtures.
    Tomar métricas de transporte/cómputo del funcionamiento autorizado para
    contrastar costos; no descargar historias completas como diagnóstico.

La reversión debe coordinar web, escritores, banderas, reglas y cobertura.
No enviar tráfico a un escritor viejo mientras siga la cobertura restringida;
no borrar el índice con clientes activos ni sobrescribir pagos o recibos.
Si una operación queda incierta, consultarla por su ID antes de reintentar.

Límites candidatos: 100 ventas por comando, 10.000 pagos candidatos y hasta
seis lecturas simultáneas. Los comandos no auditan toda la base. Las fuentes
autorizadas deciden importes; los índices no sustituyen pagos ni permisos.
