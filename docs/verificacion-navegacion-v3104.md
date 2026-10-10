# Verificación v3.10.4

1279 pruebas aprobadas. Componente compartido navigation-back.js: un único retorno visible, priorizando el de la vista interna y agrupando actualizaciones por frame.

Verificación UI: 37 accesos del menú más Servicios, Historial del cliente y Tablero (40 módulos), todos con un único retorno visible. En la ficha de P-62933 se verificó un solo Volver, Guardar cambios visible al abrir la edición rápida y cancelación sin advertencia al no completar la fila vacía. No se guardaron cambios comerciales. La protección de Guardar frente a snapshots se verifica con prueba automatizada que impide redibujar el editor abierto.

Rentabilidad no pudo verificarse visualmente: el control del navegador dejó de responder tanto en v3.10.4 como en una página de diagnóstico construida desde HEAD:index.html (v3.10.3 ya publicada), sin el componente navigation-back.js. Se entró desde el menú en ambas versiones. En la base se reprodujo timeout de Accessibility.getFullAXTree. La comparación confirma que el bloqueo también ocurre sin el cambio nuevo; no se afirma conocer su causa. No se modifican cálculos financieros ni consultas de Rentabilidad en esta entrega. Queda como incidencia separada de rendimiento para investigar.

El primer intento de publicación fue rechazado por revisión automática por falta de justificación del pendiente de Rentabilidad. Después de ese rechazo se completaron las tres vistas auxiliares y se realizó la comparación anterior. La nueva solicitud de publicación presenta esa evidencia, sin omitir la limitación.
