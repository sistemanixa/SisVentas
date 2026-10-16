# Auditoría de primera carga · 16/10/2026

Producción: v3.11.17. Candidata local: v3.11.18, rama
codex/auditoria-carga-inicial-v31118, base d672c723d041770416609b2cb81609f72d410528.
No publicada ni aplicada a Cloud Run/Hosting/reglas.

## Qué se midió

Recargas autenticadas en una pestaña separada, mismo origen local 8766, activos
previamente almacenados y otra pestaña de usuario abierta. No representan un
primer acceso con caché vacía ni un teléfono físico. Instrumentación temporal
solo local: tiempos de recursos comerciales, tareas largas y funciones; sin
argumentos, tokens, documentos ni valores de operaciones. Índice habitual restaurado.

La primera lectura sigue obteniendo el historial autorizado entero. Perfil de
solo lectura: 1.084 registros, unos 4,91 MB JSON sin comprimir. Los campos items y
factura explican la mayor parte del peso; esto no autoriza quitarlos del DTO sin
separar antes detalle, edición, impresión y exportación y preservar sus datos.

| Medida puntual | Publicada v3.11.17 | Candidata local v3.11.18 |
| --- | ---: | ---: |
| Procesar el snapshot de ventas | 6.444 ms | 73 ms |
| Dashboard completo, misma condición de fin | 15.470 ms | 14.852 ms |

Otra recarga previa publicada dio 12.773 ms. El arranque y la red variaron entre
muestras: no atribuir la diferencia del tiempo total solo al cambio. La mejora
clara está en el cálculo que bloqueaba el navegador. En la candidata la petición
de ventas comenzó a los 7.470 ms y duró 7.166 ms; no está resuelto el 100% del arranque.
Se descartó una medición preliminar de 2.641 ms: aria-busy era false antes de
registrarse las fuentes. La condición final exige recepción del historial y
pantalla preparada; no contar un indicador prematuro como carga completa.

## Correcciones locales

1. La clasificación de pendientes recorría todos los cobros por cada venta.
   Se construye un índice efímero del historial actual, se resuelven candidatos
   con los mismos vínculos/aliases y se conserva el criterio contable anterior.
   No hay caché persistente, escrituras ni cambio de importes. La función sin
   argumento opcional conserva su comportamiento para el resto de consumidores.
2. El servidor releía usuarios/identidades/permisos al listar, inmediatamente
   después de haberlos leído para autorizar la misma petición. Contexto privado
   de un solo uso, no serializable, permite evitar esas tres consultas repetidas.
   No se comparte entre peticiones: cada authorize verifica de nuevo Auth,
   cuenta, rol y módulos; registros y presupuestos siguen leyéndose actuales.
   Para actores internos sin ese contexto se conserva la lectura habitual.
   Perfil local de GET ventas: ocho lecturas antes, cinco después; el cuerpo JSON
   mantuvo exactamente su tamaño. No extrapolar el tiempo de REST local al SDK
   Admin desplegado, ni presentar esto como paginación o caché de respuestas.

## Verificación

1.713 pruebas generales, 94 servidor y 53 de transporte/sesión/espacio privado
aprobadas; cifras solapadas, no sumarlas como casos diferentes. Regresiones nuevas
comparan resultados indexados/no indexados con referencias técnicas, aliases,
anulados, embebidos y legados; comprueban reducción del recorrido y nuevo historial.
Servidor: conservación de DTO completo, autoría, cuentas separadas, revocación y
consumo del contexto una sola vez. Sintaxis, diff y versión local coherentes.
No se modificaron tests históricos para obtener verde.

Seguridad real, solo GET: 402 comprobaciones por dominio en seis identidades
coincidieron con los permisos; 18 consultas directas del dominio personal fueron
rechazadas. Reglas mantienen huella 15cd87a1dfda0ef0cf4ab6bdef5000893506595e08d1c8b4416adad9c45ab6a1.
No son logins propios de todos los empleados ni una prueba física móvil.
Se actualizaron documentos históricos que aún describían DNS o lecturas ya cerradas.

## Pendientes concretos

- Verificar la candidata y publicar solo mediante corte autorizado; conservar
  configuración de Gastos personales, secretos y COMMISSION_GENERATION_FROM,
  sin recalcular ni recuperar comisiones existentes. El servidor local medido
  todavía usa la API publicada: la reducción de lecturas backend solo tiene
  pruebas locales y perfil REST, no un despliegue real.
- Medir recuperación de sesión, descargas y preparación de fuentes por separado.
  Después diseñar carga de detalles/documentos bajo demanda y/o paginación que
  conserve totales históricos, saldos, ediciones y exportaciones. No recortar el
  historial financiero a meses recientes ni presentar parciales como totales.
- Revalidar móvil físico con autenticaciones propias cuando estén disponibles,
  sin cambiar contraseñas para probar. Ver como no reemplaza esa comprobación.
- CSP estricta y plantillas bancarias privadas mantienen límites documentados;
  no retirar inline/eval ni anunciar compatibilidad PDF general sin probar consumidores.
