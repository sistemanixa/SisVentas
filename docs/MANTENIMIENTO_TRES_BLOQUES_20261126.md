# Mantenimiento en tres bloques · v3.22.2

Se reemplazó el panel histórico por Estado del sistema, Revisiones puntuales de datos y Soporte avanzado. Abrirlo no consulta colecciones ni escribe datos. Clientes espera la carga normal antes de abrir la revisión manual; Gastos y Ventas navegan a sus módulos. El diagnóstico TXT es local, acotado a versión/conexión/sesión, sin identificadores ni datos comerciales.

Retirados del árbol público maintenance.js, ops-hardening.js, v2-readiness.js, v2-audit.js y sale-delete-maintenance.js, sus cargas y estilos exclusivos. Las fuentes necesarias para regresiones financieras se conservan como fixtures no públicos. Se mantienen payroll, comisiones, relaciones y modelos compartidos; no se modificaron datos ni políticas financieras, reglas o servidor. El generador masivo de estructura de clientes deja de ofrecerse en la revisión manual.

Validación: 51 focales de centro y regresiones históricas, 35 de carga/sesión y 3 escenarios nativos con índice completo a 390/1280. Dos aperturas con espera de los antiguos temporizadores: cero lecturas comerciales y cero escrituras. Diagnóstico/exportación sin datos personales; navegación y revocación conservadas. Capturas oscuras revisadas en ambos anchos. Sintaxis, diff y coherencia local de versión correctos.

Suite vigente host completa: 11.925 casos, 11.779 PASS, 2 FAIL, 144 condicionales, cero cancelados. Los dos fallos señalan referencias de pruebas al botón/archivo retirados; se adaptan al botón nuevo y módulo activo, sin quitar aserciones financieras. La primera corrida restringida se detuvo por impedimento de Chrome y no se acredita como validación. No repetir la suite completa por esas dos adaptaciones de inventario; ejecutar sus archivos focales.

Publicación todavía pendiente al crear esta evidencia. La inspección de la ventana real en Historial de cliente detectó superposición de acciones/contactos a ancho móvil; es un problema independiente de distribución y no se modificaron sus datos ni su pantalla en este bloque.

Cierre de referencias: los dos archivos adaptados pasaron 12/12 en Root. No cambia el resultado histórico de la suite; los dos fallos originales y su resolución focal quedan documentados por separado.

