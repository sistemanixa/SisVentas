# Cuenta corriente: preparación local por cliente

Estado al 03/11/2026: **componentes aislados probados, sin activar ni conectar la pantalla actual**. No representa el cierre de la auditoría. La aplicación activa local sigue en v3.18.9; este bloque no cambia sus activos ni habilita accesos remotos.

## Implementado en este bloque

- Identidad compartida navegador/servidor: conserva las referencias explícitas y grupos unificados; no selecciona una ficha por coincidencia de nombre. Domicilio físico y cliente principal son referencias distintas. Conflictos y códigos desconocidos permanecen identificables, sin asociarlos a otro cliente. Los identificadores numéricos textuales no pasan por Number.
- Proyección propuesta `sv_client_accounts/v1`: cuentas y totales por ámbito, miembros mínimos de ventas/cobros, páginas de 50 y búsqueda por cliente. Las fuentes comerciales no se escriben. Los resúmenes excluyen productos, costos, facturas y adjuntos binarios.
- Actualización incremental pura: comprueba la imagen anterior, membresía, revisión y cobertura antes de producir un parche técnico. No revive pagos embebidos cuando existen globales anulados, conserva la prioridad de la referencia técnica y rechaza cobros relacionados con varias ventas. Totales y deuda utilizan el conjunto completo, no la página visible.
- Lector propuesto: sólo consulta el ámbito autorizado y el cliente seleccionado, comprueba cobertura antes y después y cancela ante cambio de sesión, permisos, pantalla o conectividad. No sondea por reloj ni descarga originales como alternativa a un error del índice.
- Extracto puro por cliente: exige todos los miembros de ese ámbito, comprueba que cargos, pagos y saldo coincidan exactamente con los totales y luego pagina de 50. Conserva saldo anterior por período, claves de cobros agrupados, centavos y fechas desconocidas. Distingue el importe original del aplicado cuando hay sobrepago/devolución; no altera ninguno. Un saldo legacy conocido se presenta sin inventar un cobro ni un comprobante. Falta resolver la representación/consulta de comprobantes embebidos antiguos y conectarlo al escritor y a la interfaz antes de activar.
- Propuesta offline de reglas: módulo Cuenta corriente, ámbito propio salvo administrador, consultas limitadas a 50, restablecimientos de acceso y escritura bajo el control existente del servicio. Fuentes internas, actividad y directorios técnicos no se entregan al cliente. No aplica reglas ni activa configuraciones.

## Evidencia

39 pruebas unitarias nuevas: identidad, proyección, lector y propuesta de reglas. Matriz de reglas adicional aprobada en el emulador `demo-expense-audit3186`, sin credenciales de producción. Comprueba ámbito propio/ajeno, administrador, técnico sin módulo, revocación, cobertura obsoleta, consultas sin límite o de 51 y escritura directa denegada.

Medición reproducida con datos ficticios: 1.000 ventas, 1.000 cobros y 100 clientes. Tres lecturas completas sumarían 1.354.223 bytes JSON. Lector propuesto: primera página y totales completos, 8 lecturas/31.704 bytes; ventas y cobros del cliente elegido, 10 lecturas/8.846 bytes. Se muestran 50 cuentas y se mantiene la deuda completa de 8.000.000 centavos. No es una medición de red, facturación ni latencia de producción; incluye imágenes ficticias en los originales para reproducir su exclusión de los listados. Evidencia y script privados en `tmp/post-index-audit3186`, fuera de Git.

## Trabajo ejecutable que sigue abierto

| Trabajo | Estado / siguiente acción |
| --- | --- |
| Guardados coordinados | Integrar la proyección con todos los escritores de ventas/cobros, fiscal incluido, y probar creación, modificación, anulación, reasignación y concurrencia. Reutilizar identidades verificadas cuando no cambien; resolver altas y cambios de identidad mediante lecturas puntuales. |
| Identidades y unificación | Vincular los cambios de cliente/principal/domicilio al mantenimiento de la proyección, sin inferir asociaciones por nombre ni recalcular históricos. La preparación de esta proyección sigue siendo trabajo técnico, no un bloqueo humano. |
| Extracto y saldo anterior | Modelo puro probado en `cotizador/client-account-ledger.js`. Integrar su actualización y lectura con cobertura/versiones, conservar documentos históricos embebidos y comprobar la pantalla original. No alimentar el conciliador antiguo con 50 filas. |
| Interfaz e Historial | Conectar al renderer existente conservando navegación, acciones y domicilios. Historial incluye otros dominios además de ventas/cobros: presupuestos, OT, soporte y equipos requieren sus fuentes completas autorizadas por cliente. |
| Arranque y sincronización | Integrar resultado/error/cancelación/sesión con SVDataReadiness real y probar ambos órdenes de llegada, retornos y cambios de rol. Las pruebas actuales usan una implementación controlada del contrato. |
| Validación visual y transferencia | Navegador aislado escritorio/móvil y medición de las peticiones de la pantalla conectada. No confundir los bytes del modelo con transferencia real. |
| Productos, Comisiones y Facturas | Continuar el inventario por dependencia después de la fuente por cliente; no declarar resueltos por esta preparación. |

## Activación externa separada

No hay publicación, push, configuración remota, nuevas tareas periódicas ni modificación de ventas, pagos, comisiones o stock. La futura activación exige una candidata integral, cobertura contrastada, prueba de todos los escritores y reglas verificadas contra el estado remoto. Hasta entonces, este bloque no reduce las lecturas de la pantalla real ni cambia sus permisos.
