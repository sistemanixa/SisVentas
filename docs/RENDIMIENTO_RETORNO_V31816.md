# Apertura de ventas y retorno al resumen

Candidata web v3.18.16 desde la publicación v3.18.15. No incorpora Cuenta
corriente, Historial ni sus configuraciones/reglas pendientes. No cambia el
servidor, permisos, comisiones, stock ni originales financieros.

El host realmente cargado por el índice es `sales-indexed-host.v1.js`.
`commercial-pages-host.v1.js` existe en el árbol, pero no es el conductor de esta
publicación. No atribuir el comportamiento observado a ese archivo inactivo.

## Cambio

- El detalle del administrador consulta el original puntual por SDK, sujeto a las
  reglas de Firebase. No solicita el documento a Cotizador y no tiene un fallback
  a un acceso más amplio tras un rechazo. Otros roles conservan el transporte
  comercial anterior.
- Original y resumen se consultan en paralelo; la respuesta sólo se presenta
  después de verificar identidad, permisos, generación y revisión final.
- Los agregados completos se reutilizan entre rutas únicamente tras comprobar
  configuración/cobertura antes y cobertura vigente después. Una lectura cálida
  evita descargar el agregado otra vez; no omite esas tres verificaciones.
  Los resúmenes sin movimientos se vuelven a consultar y no se conservan como
  un cero reutilizable.
- Ocultar la pestaña cancela trabajo y escuchas, conservando sólo resúmenes
  reutilizables. Al volver verifica su vigencia sin descargar otra vez las mismas
  50 filas si la generación, revisión e identidad siguen coincidiendo. Los
  detalles originales siempre vuelven a autorizarse.

## Evidencia y límites

36 casos focales de lector/transporte aprobados, 12 recorridos de navegador local
aprobados (incluidos búsqueda histórica y anchos 390/1280). QA independiente:
43 casos de lector/búsqueda aprobados. Ninguna de esas duraciones es una medición
de producción.

La copia de reglas reales leída para la auditoría pasó una prueba RTDB emulada:
administrador autorizado, usuario propio permitido, usuario ajeno rechazado aun
con contexto de cliente que diga administrador, perfil inactivo, cambio efectivo
de rol, exigencia de contraseña y restablecimiento pendiente rechazados. Se probó
la regla padre además de la puntual, sin modificar esas reglas en producción.

Observación previa en la web real: abrir V-108487 desde su búsqueda histórica se
observó en 5.263 ms hasta el encabezado; la medición incluye el control de UI,
no es TTFB ni tiempo exclusivo de red. Los retornos cálidos a Dashboard observados
fueron 1.357 y 1.374 ms; no se capturó en el último caso el aviso de ventas que
motivó la consulta. No inferir descargas duplicadas o una reducción porcentual
a partir de esas muestras. La comparación posterior autenticada sigue pendiente.

Cobranzas publicado conserva otro circuito; esta tanda no afirma resolver su
carga completa. El arranque de un resumen que todavía no se consultó requiere
lectura. La auditoría comercial integral continúa abierta.

La primera puerta completa detectó una regresión al retener un resumen vacío
frente a metadata posterior incompleta. No se cambió la expectativa: se excluyó
el vacío de la caché y las 46 pruebas focales de lector/modelo volvieron a pasar.
La corrida fallida se conserva como antecedente, no como puerta aprobada.

La puerta final del paquete completo aprobó 7.226 pruebas, con 27 omitidas y
0 fallos (7.253 casos, 844 archivos). QA independiente repitió sus 43 casos
tras el ajuste de caché vacía: todos aprobados.
