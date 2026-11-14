# Indumentaria desde Gastos — candidata local

14/11/2026. Rama `codex/gastos-indumentaria`, desde `dc5e009a` y la fuente publicada v3.20.12. La candidata v3.20.13 no está publicada. El `origin/main` consultado sigue en v3.12.5: no usarlo para sobrescribir la fuente publicada ni incorporar una versión anterior automáticamente.

## Uso

En Gastos → Nuevo gasto, elegir Indumentaria muestra Prenda, Talle, Color y Cantidad debajo de Categoría. Agregar prenda permite registrar varias filas en una misma compra. El importe total y los pagos se cargan en los campos habituales del gasto. El guardado usa el indicador central existente.

Guardar confirma en un único PATCH atómico el gasto, sus pagos iniciales y adjunto, el eventual movimiento vinculado y las existencias. Cada ingreso referencia su gasto. El total de la compra se conserva una sola vez en el comprobante interno de recepción: no se inventa un costo unitario ni se divide el importe entre prendas.

Un gasto anterior sin prendas vinculadas puede completarse desde Editar. Si ya tiene una recepción manual, se pide revisión en lugar de sumar stock otra vez. Una compra ya ingresada conserva sus prendas, categoría e importe; las correcciones de stock no se realizan editando cantidades en el gasto. Se permiten cambios descriptivos conservando pagos y recepción original.

La entrega al empleado se realiza desde Indumentaria y no genera otro gasto. También se impide volver a ingresar manualmente una compra que ya recibió las prendas al guardar. No se convierten automáticamente gastos históricos. Las compras de ropa no son reglas mensuales: se rechazan como gasto fijo.

## Servidor e integración

El circuito exige los permisos actuales de administrar/editar gastos y de Indumentaria de empleados, sesión propia, perfil activo y revisión de permisos estable. Conserva las claves de operación y la recuperación de recibos existentes. El servidor revalida el stock y los permisos antes de confirmar. Una capacidad interna liga el PATCH exacto al actor, operación y fence; no se aceptan claims del cliente.

Las reglas existentes admiten el PATCH coordinado. En un alta, la capacidad liga el nuevo gasto dentro del plan interno; no declara una referencia previa que todavía no existe. Al completar un gasto anterior, la regla comprueba además su referencia existente. No se ampliaron reglas ni permisos.

Para una publicación futura, comparar primero el servicio y la imagen vigentes. Los cuatro archivos modificados `admin-expense-create.js`, `admin-expense-edit.js`, `employee-resources.js` y `employee-resources-policy.js` se contrastaron con la fuente nativa exacta de c455: las bases coinciden antes de este cambio. Agregar `expense-clothing-model.js` y `expense-clothing-link.js`; conservar todos los demás archivos y ajustes de la imagen vigente, especialmente correcciones OT concurrentes. El Dockerfile de la rama incorpora las dependencias nuevas, pero el árbol general del repositorio no sustituye la composición nativa publicada. No construir ni desplegar todo ese árbol como atajo.

No se ejecutó otra compilación Cloud, Hosting, migración ni cambio de tráfico. El interruptor ya habilitado de Indumentaria se conserva. Las operaciones se disparan por Guardar o Entregar; no hay sondeos ni procesos periódicos nuevos.

## Evidencia y límites

- 104 pruebas focales aprobadas: gastos, pagos conservados, alta/edición, recepción, idempotencia, respuesta perdida y compras concurrentes.
- 15 recorridos Chrome aprobados, incluidos 390/768/1280 px, campos visibles, cargando habitual, creación y entrega ficticia, y regresiones de categorías/Indumentaria.
- 3 integraciones aprobadas con emulador demo, runtime nativo c455 y reglas revisadas: alta atómica y resumen, revocación justo antes del PATCH, completar gasto anterior y entregar sin generar otro gasto.
- Sintaxis de 12 archivos, `git diff --check` y validación local de marcadores v3.20.13 aprobadas.
- Puerta general ejecutada: 10.808 casos, 25 fallos iniciales. Trece pertenecían al adaptador DOM de pruebas antiguas, que necesitaba declarar el nuevo formulario; se conservó cada aserción financiera y se repitieron satisfactoriamente. También se agregaron los COPY de las dependencias nuevas. Los 12 fallos restantes se repitieron en una extracción intacta de `dc5e009a` y en la candidata, con exactamente los mismos nombres: protocolo de escritor, dependencias anteriores del contenedor, mensaje HTTP OT y fixtures de eliminación de ventas. La suite general no se presenta como verde ni como autorización de publicación.

La demo abierta usa únicamente registros ficticios en memoria y no conecta a Firebase real. Las capturas y registros están en `tmp/expense-clothing*` y no se agregan a Git. La pestaña web real y su sesión se conservan. Siguiente paso: revisión local y luego preparar la publicación conjunta de interfaz y servidor sobre la imagen vigente; no publicar sólo el formulario.
