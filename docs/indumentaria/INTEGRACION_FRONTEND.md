# Indumentaria y categorías de Gastos: integración preparada

Esta preparación conecta la interfaz con el servicio dedicado de recursos laborales. No se publica ni modifica datos reales al prepararla. La activación del servidor, las reglas y el corte técnico se verifican por separado.

## Circuito de uso

En Gastos, Indumentaria permite crear una prenda y registrar una recepción vinculada a un gasto ya existente; no crea otro gasto ni un pago. Al crear una prenda queda visible su búsqueda para registrar el primer ingreso, aunque todavía tenga cero unidades. En Empleados, la acción de Indumentaria permite entregar y devolver, conservando el movimiento de origen y su historial. No se descarga Gastos al abrir una ficha de empleado.

El listado inicial trae sólo existencias positivas, cincuenta por página. Buscar permite encontrar prendas sin existencias. El historial solicitado corresponde al empleado abierto, hasta cincuenta movimientos recientes. Cada guardado conserva su identificador de operación y revisión; el servidor determina autor e instante. Después de un ACK se actualiza una sola vez la consulta visible. Si la actualización falla, la interfaz ofrece actualizar la vista y no repetir la escritura.

## Categorías e históricos

Los cuatro selectores de Gastos comparten categorías. Agregar y gestionar se ofrecen según el permiso; el filtro incluye los nombres observados en el historial. Renombrar conserva alias, no reescribe gastos anteriores. Un gasto antiguo puede conservar su categoría retirada al editarlo; esa categoría no se ofrece para nuevos registros. La revisión del editor queda fijada al abrirlo para no adoptar silenciosamente una modificación concurrente.

Salarios y mano de obra muestra las categorías configuradas y sus importes. Las nuevas categorías quedan inicialmente fuera de la suma. Los alias permiten reunir los gastos de una misma categoría sin reclasificar registros ni alterar el tratamiento salarial de Personal, comisiones, horas extra y haberes.

Administrador y Administrativo reciben inicialmente las acciones `empleados.indumentaria` y `gastos.categorias`; Roles permite revocarlas o habilitarlas para otro rol con el módulo correspondiente. La interfaz y el servicio validan sesión y permisos independientemente. Ver como no habilita estas operaciones.

## Verificación

Pruebas con Auth y API ficticias, sin Firebase real: recepción desde Gastos, entrega y devolución desde Empleados, creación y búsqueda de prendas en cero, paginación de cincuenta, conservación de categorías históricas, alias con filtro activo, revisión concurrente, revocación y ACK seguido de fallo de lectura. Las métricas se prueban con categorías nuevas desactivadas por defecto y los históricos intactos. Las capturas y resultados detallados quedan fuera de Git. La puerta completa de la entrega compuesta se ejecuta después de integrar los contratos finales del servidor y de Cuenta Corriente; las pruebas de esta sección no la sustituyen.
