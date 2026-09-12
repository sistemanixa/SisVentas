# v3.5.21

Se retira el acceso Borradores del dashboard. El filtro de presupuestos mantiene la clase y selección de sus vecinos; su contador ya no usa una insignia azul.

En la cotización individual, la confirmación se persistía pero la copia del proveedor en el editor podía carecer de identidadConfirmadaUrl. Guardar posteriormente la ficha reemplazaba el proveedor con esa copia incompleta. Ahora se conserva la URL al procesar la respuesta y se sincroniza el editor y la copia local después de persistir la confirmación. La autorización sigue limitada a la misma URL; cambiar la publicación exige revisión.

Pruebas: ciclo de confirmación/guardado/recarga, cambio de URL, error de persistencia, borradores sincronizados y matriz de acceso de chat aprobados. No se modificaron precios ni se aprobaron identidades de productos reales durante las pruebas.
