# Coherencia, sincronización y costo

Prioridad solicitada por el titular el18/10/2026. Este registro complementa las auditorías de seguridad, reconexión, interacciones y formularios; no convierte un recorrido visual en prueba financiera ni garantiza ausencia total de fallas.

## Requisitos de salida

Cada lectura/escritura remota debe tener origen identificable: ingreso, navegación, acción, cambio real autorizado o reintento acotado de una operación concreta. Un reloj de dibujo local no debe reconectar, consultar ni reenviar sin límite. Los resultados tardíos deben descartarse al cambiar sesión, rol, vista o revisión. Las suscripciones deben cancelarse o reutilizarse, nunca acumularse al volver a una pantalla.

En operaciones financieras se comprueban identidad inicial, permisos del servidor, idempotencia, conflictos y recuperación parcial. No recalcular precios históricos, duplicar comisiones ni usar importes enviados por el navegador como autoridad. La comprobación de interfaz incluye recepción real del clic, teclado, cierre, foco, scroll y regreso, en escritorio/tablet/celular. Las pruebas de falla usan emuladores/fixtures aisladas.

## Hallazgos y estado real

| Área | Hallazgo/evidencia | Estado |
|---|---|---|
| Comercial y directorios | Consultas periódicas aun sin acciones; una respuesta304 no evita por sí sola la lectura del servidor | Retiradas en19;139s de reposo sin inicios de fetch. Lecturas por navegación comprobadas. No equivale a cero tráfico del SDK |
| Comisiones | Barrido completo de trabajos cada minuto; recuperación de un fallo previo a la reserva necesitaba conservar contador/plazo | Corrección por trabajo probado, límite5 y plazo; no sobrescribe existentes. Servidor final en verificación |
| Facturación | Alertar no corta recursos; escala0 no cierra revisiones etiquetadas | Alertas30 y controlador privado60 desde noviembre desplegados. Mensaje de octubre ignorado, sin suspensión real; demora de Google impide un tope exacto |
| Índices | Revisar si las consultas comerciales descargan colecciones completas por ausencia de índices | Configuración remota comprobada: ventas.estadoPago; pagos.ventaFbKey/ventaId/venta; gastos.empleadoId/empleadoFbKey/ventaFbKey/ventaId/venta. No se cambiaron reglas |
| Borradores | Intervalo1s mezcla tareas locales con conexión y reenvío; ante errores puede repetir sin límite | En revisión; falta fallo reproducible y corrección con pruebas de sesión, orden y reposo |
| Sesión y sincronización manual | Una operación iniciada antes de cambiar usuario no debe iniciar etapas posteriores en la nueva cuenta | Ampliar pruebas de barrera entre etapas; no basta con descartar el aviso final |
| Escuchas por módulo | Aperturas de proveedores/empleados/equipos/órdenes contienen escuchas sin cancelación local evidente | Revisar registro central y duplicados al entrar/salir. El registro global de sesión no acredita cancelación por formulario |
| Costo de servidor | Instancia mínima/CPU permanentes para observador de comisiones | Pendiente migración a disparos independientes por eventos antes de bajar instancia. No prometer costo mensual bajo30 todavía |
| Horas extra | Transacción de aprobación sobre sisventas completo | Validar costo y alternativa atómica acotada; no sustituir por escrituras parciales sin reservas/concurrencia |
| Offline opcional | Modo de vista previa está desactivado por defecto; revisar sesión entre pasos asíncronos y entrega de caché | Pendiente antes de habilitarlo; no confundir con reconexión publicada |
| Menú frecuente | Navegación por teclado funciona; clic en menú colapsado requiere reproducir si expansión/reemplazo pierde el destino | En investigación, no atribuir causa sólo al control del navegador |

## Cobertura por circuito

Aplicar el mismo recorrido a Dashboard, Clientes, Productos/Kits/catálogo, Presupuestos, Ventas/Cobranzas/Cuenta corriente, Proyectos, Distribuidora/comprobantes/garantías, Compras/proveedores/facturas, Gastos/personales/PDF/categorías, Comisiones/cuentas de empleados/horas/vacaciones, OT/Agenda/Soporte/Relevamientos/equipos/informes/remitos, Usuarios/Roles/Configuración, Chat/comunicados/notificaciones/PWA.

Para cada circuito registrar: disparadores de red, alcance de consulta, reposo, reapertura repetida, error y reconexión, cambio de usuario/rol, concurrencia, reintento/cancelación, efecto financiero e interacción adaptable. Marcar por separado revisión de código, pruebas automáticas, fixture visual, web de sólo lectura y prueba física. Los módulos pendientes no se consideran aprobados por pasar la suite general.

Evidencia privada de facturación, configuración completa, sesiones y datos reales permanece en tmp fuera de Git. Las fixtures no cargan SDK de Firebase y bloquean servicios externos. Cada corrección debe tener una prueba que falle antes del cambio y verificación posterior; las publicaciones requieren la puerta vigente y un commit revisado.
