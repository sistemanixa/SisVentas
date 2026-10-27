# Cliente genérico e identidad de edición

## Consumidor final y modo edición corregidos en candidata · 27/10/2026

Reporte reenviado del titular investigado sin leer/editar su venta real. Se
reproduce incoherencia: conversión admite genérico sin ficha pero confirmarVenta
exige resolver cliente/domicilio. El cargador conserva _ventaEditandoFbKey y
original, pero no rellenaba título, número ni fecha; puede mostrar Nueva venta,
— y fecha nueva mientras sigue siendo edición. Esto no demuestra por sí solo
que la operación real denunciada fuera una duplicación; no se consultó su registro.

Corrección sólo en app candidata15.7: genérico por nombre exacto normalizado,
sin referencias ni documento identificador real, puede llegar al escritor normal
sin crear ficha/domicilio ficticio. Conserva dirección operativa si existía. No
confunde condición fiscal con cliente genérico, no borra referencias identificadas,
no sustituye una clave elegida por homónimo y no adivina entre nombres ambiguos.
Un registro explícito llamado Consumidor Final conserva su ficha y validaciones.
Edición muestra título/numero/fecha originales; volver a nueva venta reinicia
fecha/modo sin modificar la cabecera de Dashboard durante inicialización global.

54focalesPASS: conversión real en memoria y posterior edición, misma clave/número,
sin segunda reserva, fecha/pagos intactos y fuente original sin mutar; casos de
CUIT/DNI/referencias identificadas e identidades ambiguas siguen bloqueados cuando
no hay ficha válida. La persistencia de editor está interceptada por un escritor
ficticio; no es prueba de un guardado financiero real.2recorridos390/1280de funciones
reales en formulario aisladoPASS; no sesión completa auténtica. Imágenes inspeccionadas.
Puerta final8.110total/8.083PASS/27opt-in/0fallos,29,82s. Sintaxis y diff correctos.

AST:2.294funciones idénticas, tres cuerpos cambiados (cargarRegistroVentaEnEditor,
confirmarVenta, inicializarFilasVenta) y helper _ventaEsConsumidorFinalGenerico.
Transacción de conversión, escritores, servidor, permisos, reglas y validaciones
fiscales intactos. No interpretar como exención fiscal ni retiro de domicilio de
instalación cuando corresponda. No publicar por este reporte: producción sigue
15.8. Este parche debe portarse selectivamente; no reemplazar15.8/15.9 por la
candidata amplia15.7. Segmentación en otro checkout no se editó.
Evidencias privadas tmp/priority3157/consumer-final-*, fuera de Git.
