# Auditoría posterior a v3.11.19 · 16/10/2026

Producción permanece en v3.11.19-firebase, fuente pública f7e78c7161f3f8d903298ae41c9d908d866e443f. Este bloque se continúa en codex/auditoria-pendientes-v31120 desde 061f00faba196fbb3d5973853175e2b952949cdc. El nombre de rama no indica que exista una versión v3.11.20 publicada ni preparada. No cambia aplicación, permisos, datos o configuración de producción.

## Gastos personales: navegación con sesión lista

Prueba local sobre índice canónico publicado19, sin servidor alternativo, sesión propia del titular y espacio vacío. Instrumentación temporal ignorada registra únicamente rutas, tiempos y estados HTTP; no cabeceras, tokens ni contenido privado.

| Recorrido | Clic hasta contenido disponible | Lectura de estado del servidor | Resultado |
| --- | ---: | ---: | --- |
| Primera apertura desde Dashboard listo | 1.237 ms | 1.095 ms | 200, ocho secciones disponibles |
| Retorno y segunda apertura | 1.128 ms | 984 ms | 200, ocho secciones disponibles |

La comprobación de acceso se hizo una sola vez durante el inicio (684 ms); no se repitió al abrir o reabrir. El retorno eliminó el marco privado en ambos recorridos; ninguna escritura financiera ni importación. Sin errores/warnings de consola observados. Son dos muestras de esta sesión/red, no un percentil ni evidencia de un celular físico. No deben compararse directamente con las mediciones que incluían el arranque completo de sesión.

En el intento preliminar la instrumentación había vencido antes de abrir y su registro quedó congelado; se descartó para medir rendimiento. La apertura posterior fue correcta. La prueba válida se repitió con instrumentación vigente. Evidencia privada: C:/SisVentas/tmp/gp-warm-v31119-metrics.json y gp-warm-v31119.png. Entradas temporales del espejo no se publican.

## Directorios y cambios de sesión

37 pruebas aprobadas de private-finance-session, employee-directory, user-directory, supplier-directory y version-listener-session. Incluyen identidad externa/revocada/inactiva, privilegios mínimos, logout, cambio de usuario, respuesta tardía, Ver como, revocación y reintento. No reemplazan autenticaciones físicas de Mauro/Osmar. En la sesión local medida no reapareció el error del directorio; no se ha reproducido el incidente exacto en la PC que lo informó ni se garantiza ausencia absoluta.

## Inventario inicial de CSP

La política de scripts de scripts/deploy-secure-hosting.cjs conserva unsafe-inline y unsafe-eval. No se ha endurecido en producción en este bloque.

- index.html actual: 768 atributos de eventos embebidos y cuatro scripts embebidos no vacíos. Recuento sintáctico inicial, no 772 vulnerabilidades ni inventario de todos los formularios generados dinámicamente.
- js/modules/notifications.js:302 y :324 ejecutan accion.fn mediante new Function. La aplicación activa genera acciones de presupuestos, cuenta corriente, OT, gastos y aprobación de horas extra como cadenas. Eliminar unsafe-eval antes de reemplazar y probar esos consumidores rompería sus botones.
- La búsqueda acotada de eval/new Function en aplicación activa, core y módulos propios encontró esos dos puntos; no certifica dependencias externas, vendor, workers, otras páginas ni cadenas construidas en ejecución.
- El enlace externo estático del índice usa cdn.jsdelivr.net. No es una lista completa de destinos: hay solicitudes dinámicas, Firebase, documentos, proveedores y ventanas incrustadas. No estrechar connect-src/frame-src a partir de este único dato.

Siguiente implementación concreta: sustituir las acciones de notificaciones por un despacho explícito de operaciones y argumentos, con compatibilidad controlada de las acciones generadas actualmente, sin ejecutar código arbitrario. Probar apertura de presupuesto/OT/gasto/cuenta/horas extra y avisos críticos, valores escapados y acciones desconocidas. Inventariar bibliotecas, PDF/workers y otras entradas antes de retirar unsafe-eval; después migrar eventos/scripts embebidos antes de retirar unsafe-inline. Validar primero con fixtures y política de reporte, no con un corte global sin evidencia.

## Pendientes en orden

1. Despacho de acciones e inventario completo de CSP; no activar todavía una política que rompa funciones.
2. Primera carga comercial: separar perfil, historia, render y transporte. El 304 evita cuerpo/repintado pero todavía lee, serializa y calcula la huella del historial autorizado. Antes de paginar, inventariar consumidores de saldos, exportaciones y edición; verificar equivalencia contable y concurrencia con datos ficticios. No sustituir historia ausente por cero ni ampliar permisos.
3. Reproducir el error exacto del directorio si vuelve a aparecer, guardando solo ruta/estado/fase y contexto de rol sin tokens ni datos personales.
4. Dispositivos físicos: Mauro/Osmar con sesiones reales, foco/teclado, cámara trasera, etiquetas de serie y bip; PDF bancarios privados con revisión del titular. No obtener evidencia cambiando contraseñas, importando documentos reales ni generando operaciones de prueba en producción.
5. Funciones futuras de comprobantes (stock, listas, parciales, borradores entre PC): necesitan definición funcional; no son fallos que autoricen modificar históricos.

No se declara resuelta al 100% la lentitud ni completada una auditoría absoluta por estas pruebas.
