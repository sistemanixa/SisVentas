# Estado final · 03/11/2026

Publicado e integrado con Proyectos en v3.18.2. Retirados631duplicados raíz con respaldo privado fresco y ETag porproducto; cero restantes y todos los demás campos comprobados intactos. Se activó el validador específico que impide a clientes antiguos recrear el campo, sin modificar permisos ni costos de proveedores. Vista previa real local/web P-62928:20000+5%=21000, sin aplicar aumento. Evidencia y SHA en CONTEXTO_ACTUAL. El texto siguiente conserva el diseño y las precondiciones utilizadas; ya no representa una migración pendiente.

# Costo de producto unificado · candidata v3.18.1

El costo operativo del catálogo se resuelve con `precioGremioARSDesdeProducto`, conservando el proveedor favorito, la unidad/presentación y las conversiones existentes. El campo raíz `productos/<id>/costoRealArs` ya no es una fuente de costo: duplicaba la compra y podía quedar desactualizado. `proveedores[].costoRealArs` continúa vigente y no se retira.

La candidata parte de v3.17.20. Unifica los lectores de ficha, listado, aumento masivo y captura de costos de documentos nuevos. Los guardados de producto, actualizadores y revisiones dejan una eliminación explícita del duplicado raíz. Los costos capturados en ventas/presupuestos, lotes y respaldos históricos siguen intactos; leer un respaldo antiguo no convierte ese dato en el costo del catálogo actual.

## Comprobación local

El 03/11/2026 se recargó efectivamente la ventana local con v3.18.1. En Configuración → Valores masivos, la vista previa de 5% sin redondeo mostró P-62928: costo anterior $20.000, nuevo $21.000; valor agregado 140%, venta $48.000 → $50.400. No se pulsó Aplicar cambios. La evidencia privada queda en `tmp/costo-canonico-p62928.jpg`, fuera de Git. La prueba verifica el cálculo con el catálogo ya cargado; no acredita el arranque en frío de todos los módulos.

## Retiro de datos: preparado, todavía no ejecutado

`scripts/lib/product-cost-retirement.cjs` es un planificador puro: no obtiene credenciales ni realiza escrituras. El inventario privado previo encontró 631 duplicados raíz, nueve divergencias y ningún costo canónico faltante; no sirve como respaldo completo para ejecutar una migración.

Antes del corte:

1. Integrar la candidata con la versión actual, sin sobrescribir el bloque paralelo de Proyectos. Publicar y comprobar los lectores/escritores nuevos.
2. Acreditar que clientes antiguos no pueden volver a escribir el duplicado. Un aviso de actualización no demuestra ese bloqueo. No ampliar permisos ni introducir tareas periódicas.
3. Obtener un respaldo privado completo y reciente de los productos afectados. Generar el plan desde esos registros completos y comprobar concurrencia antes de escribir, con precondición remota o ventana de edición controlada; el hash local por sí solo no elimina la carrera entre lectura y escritura.
4. Retirar únicamente el campo raíz de cada producto. No modificar costos de proveedores, importes canónicos ni documentos históricos. Si falta un costo canónico válido, detener y revisar; no inferirlo del duplicado.
5. Verificar los registros completos contra los hashes de salida; conservar evidencia privada y recuperación exacta del campo retirado. No restaurar un producto completo sobre cambios concurrentes.

El planificador bloquea su parche ejecutable hasta declarar y verificar lectores, escritores, versión servida y bloqueo de clientes antiguos. Esas declaraciones requieren evidencia externa real. La candidata local no equivale a publicación ni a migración aplicada.
