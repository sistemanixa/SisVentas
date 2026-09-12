# Revisión de pedidos — 12/09/2026

## Completado en esta entrega

- Presupuestos: título opcional de la solución, guardado y recuperado al editar, visible en el comprobante. También se guardan las observaciones del formulario.
- Comprobante sin detalle: se eliminan las columnas P. unit. y Subtotal. El pie ajusta sus columnas a las opciones de imagen y detalle, eliminando la columna fantasma que limitaba la descripción.
- Ventas: la edición conserva autor y fecha originales. El editor carga los responsables guardados y registra los cambios de comisión en el historial. La actualización de empleados conserva la selección y la habilitación de comisión.
- Capa de persistencia: las actualizaciones de ventas omiten campos de creación; los campos de responsable comercial continúan siendo editables.
- Teléfonos: compatibilidad para leer telefono, tel o celular. Normalización aplicada y verificada en Firebase sobre 318 clientes / 320 campos, con copia previa y escritura condicional por ETag. Se conservan las otras características y se quita también el 9 internacional de móviles de longitud válida. Un campo que solo contenía 54 permanece pendiente porque no contiene número. No se han inventado dígitos ni modificado otros datos comerciales.

## Alcance y comprobaciones

Los pedidos históricos hasta 3.5.18 ya figuran en el historial del repositorio; no se republican las modificaciones locales de archivos históricos que no carga index.html. Esta revisión completa los pedidos posteriores pendientes identificados en la conversación. No reconstruye autores históricos ya sobrescritos sin evidencia, ni elige un nuevo comisionado para Sergio Ríos: no se indicó la persona destinataria.

La suite general ejecutó 742 pruebas: 726 aprobadas y 16 fallidas. Todos los nombres de pruebas fallidas también fallan en una copia del commit anterior cf0b6a8 (716 aprobadas / 26 fallidas, con diferencias de dependencias y artefactos históricos locales). No se presenta la suite como totalmente aprobada. Las pruebas específicas de generación de comprobantes en las cuatro combinaciones de imagen/detalle y preservación del creador pasan, al igual que las del adaptador Firebase. Los registros productivos de ventas y pagos no fueron alterados para realizar pruebas.

La publicación debe verificarse con scripts/actualizar-nodo-version.ps1 antes de anunciarla completa.
