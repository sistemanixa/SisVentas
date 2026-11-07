# Eliminaciones y Tecnoprices: revalidación local

Fuente funcional: `8c43e7ecad46a4586ca9596d8ba1453571ba5914`. No se modificó código funcional en esta revalidación, ni se publicó o activó infraestructura.

Eliminaciones: 211 pruebas aprobadas, cero fallos y cero omisiones. Selección: archivos `sale-delete`, `ot-delete`, `purchase.*delete` y `commercial-delete` terminados en `.test.cjs`. Incluye comandos coordinados, dependencias financieras, permisos, concurrencia, reintentos y HTML completo móvil/escritorio con respuesta perdida y cancelación. Todos los registros y transportes fueron ficticios.

Tecnoprices: 12 pruebas aprobadas, cero fallos y cero omisiones, con las referencias locales explícitas de entrada, baseline y módulos de Presentación. Se comprobaron bytes fijados, aplicación/reversión, autorización, configuración y HTTP loopback con proveedor simulado. Los originales privados permanecen fuera de Git.

El primer intento restringido tuvo cinco fallos: cuatro recorridos de navegador con contexto destruido y un fetch loopback rechazado. Repetidos con acceso a navegador/loopback, los cinco aprobaron. Se conserva el registro rojo; no se cambió una expectativa para hacerlo pasar.

Límite pendiente: no hay motor Docker/Podman disponible. Por tanto no se acredita construcción ni ejecución de la imagen, login real, TLS o cookies reales del proveedor. El procedimiento offline sigue en `cotizador/tecnoprices-presentation-overlay/README.md`. No se sustituye esa evidencia por el contrato de filesystem.

Las capacidades de eliminación no se activaron remotamente. Esta verificación local no autoriza ni acredita un corte productivo ni cambios de reglas. Pagos, permisos, comisiones, stock y originales reales no se tocaron. La puerta global ejecutada para el bloque OT separado no se atribuye a este cierre: terminó con exit 1 y requiere su diagnóstico independiente.

Evidencia privada: `deletions-all-local-20261107.private.log`, `tecnoprices-all-local-20261107.private.log`, `deletions-tecnoprices-resume-20261107.private.log` y `deletions-tecnoprices-browser-20261107.private.log`, en el directorio temporal local. No se incluyen en el repositorio.
