# Auditoría de Volver y Escape — 2026-10-08

## Resultado
No cumple universalmente el criterio de retroceso al origen exacto. No se modificó código de navegación ni se publicó una versión durante esta auditoría. Se restauró la ventana a Compras de exterior.

## Cobertura
Se inventariaron las 41 secciones .page del documento y los 38 accesos showPage del menú. Se recorrieron los accesos principales con sesión de administrador local. Se probaron retornos de subventanas representativas y se inspeccionaron los manejadores de retorno en el código. Esta auditoría no certifica todas las combinaciones de entrada, todos los formularios dinámicos ni otros roles.

### Módulos: Escape regresa al módulo desde el que se abrió
Confirmados desde Compras de exterior: dashboard, asistente, catalogo, presupuesto, venta, detalle, cobranzas, cuentacorriente, reportes, estadisticas, clientes, productos, kits, actualizadorprecios, ordentrabajo, agenda, soporte, garantias, relevamientos, equipos, informes, remitos, ctaemp, empleados, vacaciones, gastos, comisiones, caja, tesoreria, proveedores, ordenes, creditofiscal, facturas, usuarios, notificaciones y configuracion.

Compras de exterior también probado desde Gastos: Escape retorna a Gastos.

Rentabilidad: la pestaña dejó de responder al abrir el módulo. No se pudo certificar el retorno; se recuperó navegando de nuevo a Compras de exterior. No está determinada la causa del bloqueo.

Servicios, historialcliente y tablero no tienen acceso directo en el menú revisado; la revisión de su cobertura fue estática.

## Fallas reproducidas en la sesión real

1. **Presupuesto: detalle → editar → Escape devuelve al listado.** Se abrió la ficha de un presupuesto, luego Editar. Escape ejecutó volverListaPpto(), mostrando el listado en lugar de la ficha previa. El botón Volver usa el mismo manejador. No se editaron ni guardaron campos; el sistema generó un borrador automático al abrir la edición.
2. **Rueda de configuración: Escape cambia el fondo y no cierra el panel.** Se abrió Mi cuenta en Presupuestos. Escape cambió el módulo activo a Gastos y dejó el panel visible. Se cerró el panel por su botón después de comprobarlo.
3. **Ofertas / Mis listas: Escape navega el fondo.** Desde Compras de exterior se abrió Ofertas · Mis listas. Escape cambió el módulo activo a Gastos y mantuvo el portal visible. El botón Volver a Compras de exterior cerró el portal, pero dejó visible Gastos, porque Escape ya había cambiado el fondo.
4. **No todas las pantallas principales ofrecen botón Volver.** Ejemplos observados: inicio, asistente, listado de presupuestos, ventas, cobranzas, cuentas corrientes, clientes y gastos. En esos recorridos Escape funcionó, pero no hay equivalencia visual con un botón.

## Subventanas que sí cerraron correctamente
- Gastos → nuevo gasto → Escape: regresa al listado de Gastos.
- Gastos → reglas automáticas → Escape dentro del diálogo: cierra la ventana y conserva Gastos. Un primer intento de automatización contra body agotó el tiempo; la prueba enfocada en el diálogo funcionó, por lo que no se clasifica como fallo funcional confirmado.

## Hallazgos de código / riesgos no reproducidos en todos sus contextos
- El historial general almacena únicamente IDs de páginas, no la ficha, pestaña, filtro o posición de desplazamiento. Hay retornos contextuales específicos (producto, preparación, ventas) pero no una garantía general.
- Al restaurar sessionStorage se eliminan repeticiones de módulos mediante lista.indexOf(id) === indice; un recorrido A → B → A → C no conserva su secuencia exacta después de recargar.
- El historial del navegador y el historial propio son independientes: el retorno general puede hacer pushState y popstate no consume la pila propia. Alternar Atrás del navegador y Escape requiere pruebas/corrección.
- El retorno interno se identifica en parte por el texto de los botones. La expresión no acepta prefijos como ←; un texto como Volver a v2 también puede parecer una acción de navegación sin serlo.
- Historial de cliente tiene retorno fijo a Clientes; debe contrastarse con accesos desde documentos.
- Los diálogos se cierran con varias estrategias (clase, IDs fijos, z-index). Algunos cierres ocultan el nodo sin ejecutar su manejador; hace falta verificar limpieza, confirmación de cambios y foco en cada caso.
- Kits, empleados, equipos, informes y gastos vuelven a sus listados por manejadores propios; correcto desde esos listados, pero no acredita otros orígenes.

## Pruebas existentes ejecutadas
16 comprobaciones aprobadas en estos archivos:
- test/escape-historial-persistente.test.js
- test/preparation-product-return.test.cjs
- test/chat-navegacion-auditoria.test.js
- test/document-client-navigation-v350.test.js
- test/comisiones-navegacion-gastos.test.js
- test/navegacion-rendimiento.test.js
- test/titulos-modulos-navegacion.test.js

Varias son comprobaciones estáticas o unitarias; que pasen no contradice las fallas encontradas en la interfaz real.

## Criterio recomendado para la corrección
Volver y Escape deben invocar la misma acción contextual. Primero cerrar la ventana o panel superior; después salir de edición hacia su ficha de origen; luego retroceder entre módulos. Conservar el estado de origen y no añadir al historial una navegación de regreso. Mantener los avisos existentes de cambios sin guardar. Mostrar un botón de retorno consistente cuando haya un origen válido.
