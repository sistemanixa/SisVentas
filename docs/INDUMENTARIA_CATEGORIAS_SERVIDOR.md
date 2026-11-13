# Indumentaria y categorías laborales

Este paquete implementa el guardado laboral con el coordinador nativo existente. No es una habilitación remota. Requiere integrar los dos módulos de transporte en los bytes vigentes de Cotizador, aplicar los validadores emparejados y activar EMPLOYEE_RESOURCES_ENABLED después de las verificaciones del corte.

## Circuito

Las prendas, talles y movimientos pertenecen exclusivamente a sv_employee_clothing. Las categorías de Gastos pertenecen a sv_expense_categories; no son categorías del catálogo de productos. Una recepción referencia un gasto existente y nunca crea otro gasto. Entregar descuenta del saldo de indumentaria; devolver suma como máximo lo pendiente de la entrega original. No modifica productos comerciales, inventario de oficina, cuentas privadas, sueldos, comisiones o pagos.

Cada comando tiene una clave de operación y una revisión esperada. Estado, movimiento, auditoría y recibo del coordinador se confirman mediante un único PATCH cercado. La capacidad interna liga usuario, operación, fence y plan exacto; el adaptador no acepta una capacidad proveniente del cliente. Los reintentos recuperan el recibo sin duplicar una entrega. Los modelos conservan cálculo monetario decimal canónico y cantidades enteras.

El actor y el instante de auditoría los fija el servidor. Los permisos se comprueban al entrar, antes de confirmar y en las reglas del PATCH. Una revocación, reset, cambio de revisión, lease vencido o baja del empleado antes de confirmar rechazan la operación completa. Administrador y Administrativo tienen la acción por defecto; otro rol puede habilitarla explícitamente. Gestionar categorías exige acciones.gastos.categorias; Indumentaria exige acciones.empleados.indumentaria. El módulo correspondiente también debe estar habilitado. Leer el catálogo de categorías sólo requiere Gastos: no concede su gestión.

## Transporte

- GET/POST /recursos-empleados/indumentaria.
- GET/POST /recursos-empleados/categorias.
- POST: {id, expectedRevision, permissionRevision, command}. El dominio lo determina la ruta. No se aceptan actorId, at u operationId dentro del comando.
- ACK: {ok, committed, revision, operationId}. No transporta todo el historial ni lo duplica en el recibo. La interfaz confirma el resultado y vuelve a leer su proyección.
- GET de indumentaria: employeeId, query, cursor y revision. Devuelve hasta cincuenta variantes y cincuenta movimientos del empleado solicitado, con cantidades, metadatos necesarios y remanente devolvible. Las páginas siguientes exigen la revisión inicial. La búsqueda puede localizar prendas sin saldo; inicialmente sólo se muestran saldos positivos.
- GET de categorías conserva nombres y alias, sin auditorías ni identidades internas. Renombrar o retirar una categoría no reclasifica ni modifica gastos históricos.

El servidor mantiene un agregado por dominio con límite explícito de 2 MiB. La paginación acota el transporte y el historial visible; **no se presenta como paginación de lectura RTDB interna**. Superar el límite rechaza altas adicionales sin borrar movimientos. Una partición o archivo futuro requiere un diseño de migración independiente.

## Integración y verificación

scripts/lib/employee-resources-runtime-overlay.cjs transforma únicamente los anchors verificados del entrypoint y adaptador de commits nativos. No sustituir el servidor por el index.js histórico del checkout. El builder scripts/lib/employee-resources-rules.cjs agrega exclusivamente las dos raíces: no da lecturas SDK ni cambia concesiones padre, financieras o cuentas privadas.

Pruebas puras y de HTTP con datos ficticios: test/employee-resources-backend.test.cjs y test/employee-resources-http.test.cjs. La matriz test/employee-resources-native.integration.cjs requiere un emulador aislado, reglas explícitas y runtime nativo reconstruido verificado. Cubre nacimiento vacío de RTDB, recepción decimal exacta, entrega/devolución/reintentos, concurrencia, revocaciones al PATCH, aislamiento SDK, categorías históricas y páginas de cincuenta. No ejecutar contra producción.

La integración visual, la puerta conjunta y el corte coordinado deben completarse antes de declarar el módulo publicado. Este documento no afirma cambios remotos ni una validación de formularios reales.
