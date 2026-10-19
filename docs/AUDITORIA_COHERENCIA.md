# Coherencia, sincronización y costo

## Alcance por operación · candidato v3.13.3

El inventario de [Cotizador](AUDITORIA_COTIZADOR.md) identifica 51 patrones de
ruta en 15 familias. Es un servidor compartido, aunque conserva el nombre del
cotizador original. El inventario de fuente no prueba su frecuencia ni permite
atribuir dólares a cada función. No se consultó producción en este bloque.

Correcciones locales reproducidas: verificar una venta lee el registro solicitado
y sólo su eventual presupuesto de origen; Proveedores respeta el índice moderno
de módulos; una carga anterior no modifica otra OT ni persiste cambios al abrirla;
Ofertas deja de iniciar consultas tras cerrar el panel; el histórico del dólar
comparte la carga y descarta otra sesión. La comprobación HTTP de versión agrupa
avisos simultáneos. El observador continuo requiere activación explícita; la
configuración productiva ya lo mantiene desactivado. Los wrappers de auditoría
retirados eran peligrosos al cargarse tarde, pero inertes en el orden publicado.

Puerta final 2.428/2.428 y Cotizador 94/94; la revisión independiente cerró
respuestas tardías de versión ocultas, plazos de20s/30s y suspensión del reloj.
La validación completa no inicia activos oculta y tiene como máximo tres
reintentos automáticos por señal visible. Autenticación exigida por defecto
en cotización, conservando las comprobaciones propias de los demás módulos.
Estado de publicación y verificación definitiva en CONTEXTO_ACTUAL.

Pendientes de fondo: listados comerciales, opciones de Proyectos/Distribuidora,
carga inicial compartida y transacción laboral de raíz. Los cuatro comandos
laborales todavía usan GET/PUT condicionado del ancestro completo. El
[plan de dominio laboral](PLAN_DOMINIO_LABORAL.md) demuestra por qué sustituirlo
por lecturas pequeñas y PATCH sin coordinar todos los escritores perdería
protección frente a cambios simultáneos. No se migraron datos ni se añadieron
servicios, reglas o permisos para ocultar ese problema.

## Reanudación y cierre de cobro · candidato v3.13.2

El reposo nocturno conservó al menos un cliente conectado. Las dos tandas de Android
permitieron reproducir un arranque oculto, sin probar retrospectivamente qué evento
del dispositivo lo causó. El candidato bloquea lecturas de pantalla oculta, pausa
RTDB, cancela preparación de acceso al ocultar y vuelve a verificar al regresar.
Conserva las escrituras ya iniciadas, la revocación y los snapshots. Los avisos
duplicados de reconexión se agrupan; cambios reales siguen actualizando datos.

En Cobranzas, Cuenta corriente y edición de venta pagada se encontró que la UI no
esperaba la función directa de comisión. El candidato espera su única respuesta y
confirma el pendiente de aprobación; un fallo no vuelve a registrar el cobro.
No agrega sondeos ni cambia los eventos, el cálculo, la aprobación o las comisiones
existentes. Ver pruebas, cobertura y estado de publicación en CONTEXTO_ACTUAL.

## Revisión13.1 · local, sin publicar

La publicación13.0 ya se completó y verificó; sus secciones anteriores de preparación conservan el registro histórico. El candidato13.1 centra cargas de pantalla y limpia sus presentadores por finalización/navegación/sesión/rol, incluyendo los espacios separados. Pruebas de promesas retenidas, errores, reintentos y cierre descartan respuestas anteriores y liberan nodos/observador sin consultas nuevas. Sólo DOM: no se modificaron operaciones financieras para probar.

Proyectos: medición manual2.225ms de apertura completa, respuestas de servidor1,25–1,82s y3.318bytes. La cantidad visible no determina la cadena de Auth/acceso/rol/permisos ni las dependencias comerciales. No hay un temporizador que consulte Proyectos en reposo. Preparado paralelismo de permisos/nombre, manteniendo controles frescos en cada solicitud; ahorro real aún no medido ni desplegado. No confundir paralelismo con reducción de cantidad de consultas. Pendientes: límite del token antes del fetch y resolución de vínculos sin historiales amplios, conservando permisos/ownership.

2.254 pruebas de la puerta actual y94 de Cotizador aprobadas;45 dirigidas de Proyectos/acceso/ownership. UI común comprobada en390/820/1280px con datos ficticios; no equivale a todas las operaciones ni a pruebas físicas. Detalles, limitaciones, estado externo y siguiente paso en CONTEXTO_ACTUAL. La medición de costo es manual y agregada; no existe garantía mensual≤30 ni auditoría de ausencia total de fallas.

## Continuación13.0 · sólo local

Reproducción20:600.000ms de uso se reducían a60.000ms y respuesta de ficha anterior podía reemplazar la última solicitud. Candidato13.0 conserva acumulación local sin sondeos de red y ordena persistencia; descarta fichas tardías tras solicitud/apertura/cierre/navegación/sesión/rol/revisión.2.123 pruebas aprobadas con16 nuevas funcionales. Nueve editores completos en escritorio/tablet/celular ficticios sin desbordes ni errores. No publicado. Permanecen presencia90s, arranque amplio, transacciones laborales amplias y medición de costos reales.

## Publicación del bloque20

Fuente addec6ebd6ada4b107e46c1a066c510badbf0627 publicada por autorización expresa del titular.2.107 pruebas desde paquete limpio,380 activos,15 hashes,5 cabeceras y4 rutas internas404 comprobados. Aviso20 actualizado después. Sesión web conservada: Dashboard cargado, Ventas50 filas y Presupuestos8 con Sincronizado, sin operaciones financieras de prueba. El resto del documento describe la preparación y los pendientes; no considerar cerrada la auditoría completa. Continuar en nueva versión3.13.0 sin editar20 publicada.

## Cierre parcial posterior · 2.107 pruebas

Servidor por eventos ya activo: cotizador-events-b56470ce al100% con14 etiquetas, mínimo0 y facturación por solicitud. Entrega nativa ficticia y autenticada comprobada; función/registro de probeta retirados. Ninguna comisión real alterada. Detalle vigente en COMISIONES_EVENTOS.md. Las filas antiguas que describen migración pendiente conservan el estado de preparación anterior.

Frontend20 pendiente de publicación: aislamiento de modo offline opcional, limpieza de lecturas únicas, recuperación parcial de Caja, notificaciones sin bucle de rollback ni sobrescritura de preferencias más nuevas. Leer Productos conserva proveedores de mano de obra.54 defaults de fecha/mes autorizados usan fecha local, además de movimientos/cierre de Caja; no se migraron registros.2.107 pruebas aprobadas, incluidos cambios nocturnos de mes/año y preservación de fecha/instante históricos. Los errores se presentan como alertas, sin tilde de éxito.

Cuatro pruebas REST en emulador laboral: aportes concurrentes, reintento idempotente, aprobaciones solapadas y cambios externos preservados. No reemplazan autorización de servidor ni resuelven el costo de transacciones sobre raíz completa. Esa arquitectura, carga inicial amplia y carreras de fichas permanecen pendientes. Medir consumo real después del corte; no inferir USD30 de la cantidad de pruebas.

Prioridad solicitada por el titular el18/10/2026. Este registro complementa las auditorías de seguridad, reconexión, interacciones y formularios; no convierte un recorrido visual en prueba financiera ni garantiza ausencia total de fallas.

Actualización13.0: el titular autorizó publicar hasta el corte actual y seguir. Los estados «local20/sin publicar» de las tablas siguientes son antecedentes, sustituidos por CONTEXTO_ACTUAL. Presencia moderna `cx1_` exige primero checker compatible y regla exacta de retiro propio:67 pruebas relacionadas y10 de emulador aprobadas, sin revocar cuentas reales. Las claves antiguas mantienen TTL; no hay borrado/migración de historial. La revisión del checker prueba cada rama OR y acepta sólo la excepción exacta en su ruta. La transacción laboral amplia continúa pendiente como se explica al final.

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
| Borradores | Intervalo1s mezclaba captura con conexión/reenvío; error y rollback podían volver a escribir | Corregido local20, con pruebas de orden, eco, error, sesión e inactividad; no publicado |
| Sesión y sincronización manual | Operaciones previas podían iniciar etapas en otra cuenta o finalizar carga antigua | Barreras y petición compartida local20; token con plazo. Pruebas de cambio de sesión/rol/revisión; no publicado |
| Escuchas por módulo | Repetir tres cargas produjo4 escuchas en cada una de6 colecciones | Corregido local20; misma fixture conserva1. Prueba de veinte entradas para9 colecciones, cancelación y fallo parcial. No acredita cierre por formulario |
| Configuración Paraguay | Dashboard iniciaba cotización Guaraní y escuchas antes de entrar al panel | Lectura diferida por navegación, actualización de tipo de cambio por botón y limpieza de sesión, local20 |
| Migraciones implícitas | Leer empleados puede escribir legajo y migrar porcentajes de comisión | Corregido local20: leer conserva datos y no escribe ni restaura excepciones borradas; ingreso ficticio0 escrituras. La configuración central se administra mediante su acción explícita |
| Costo de servidor | Instancia mínima/CPU permanentes para observador de comisiones | Pendiente migración a disparos independientes por eventos antes de bajar instancia. No prometer costo mensual bajo30 todavía |
| Horas extra | Transacción de aprobación sobre sisventas completo | Validar costo y alternativa atómica acotada; no sustituir por escrituras parciales sin reservas/concurrencia |
| Offline opcional | Modo de vista previa está desactivado por defecto; revisar sesión entre pasos asíncronos y entrega de caché | Pendiente antes de habilitarlo; no confundir con reconexión publicada |
| Menú frecuente | Navegación por teclado funciona; clic en menú colapsado requiere reproducir si expansión/reemplazo pierde el destino | Reproducido: altura/espaciado cambian al expandirse y clic en Clientes abre Novedades. Geometría vertical estabilizada local20; clic real abre Clientes/Relevamientos, coordenadas Y conservadas |

## Cobertura por circuito

Aplicar el mismo recorrido a Dashboard, Clientes, Productos/Kits/catálogo, Presupuestos, Ventas/Cobranzas/Cuenta corriente, Proyectos, Distribuidora/comprobantes/garantías, Compras/proveedores/facturas, Gastos/personales/PDF/categorías, Comisiones/cuentas de empleados/horas/vacaciones, OT/Agenda/Soporte/Relevamientos/equipos/informes/remitos, Usuarios/Roles/Configuración, Chat/comunicados/notificaciones/PWA.

Para cada circuito registrar: disparadores de red, alcance de consulta, reposo, reapertura repetida, error y reconexión, cambio de usuario/rol, concurrencia, reintento/cancelación, efecto financiero e interacción adaptable. Marcar por separado revisión de código, pruebas automáticas, fixture visual, web de sólo lectura y prueba física. Los módulos pendientes no se consideran aprobados por pasar la suite general.

Evidencia privada de facturación, configuración completa, sesiones y datos reales permanece en tmp fuera de Git. Las fixtures no cargan SDK de Firebase y bloquean servicios externos. Cada corrección debe tener una prueba que falle antes del cambio y verificación posterior; las publicaciones requieren la puerta vigente y un commit revisado.

Puerta local20:2.081 pruebas aprobadas. Se reprodujeron y corrigieron fuentes canceladas que conservaban error de carga y escuchas muertas que impedían reintentar; nueva lectura y Sincronizar ahora recuperan sin borrar navegación. Recorridos de42 entradas en tres tamaños,16 solapas de configuración,55s de reposo y reaperturas repetidas registrados por separado. No se probaron operaciones financieras reales; apertura de pantalla no certifica sus formularios ni sus cálculos. Observador candidato ignora comisiones ya generadas/ventas anuladas desde su snapshot, sin lecturas adicionales; la recuperación de trabajos incompletos permanece independiente. Sin publicar.

Ventanas27 y editores9 recorridos con datos ficticios a1440x1000,820x1180 y390x844. Se distinguen cierres propios (Chat/Actualizador/Asistente/Kit) de cruces genéricas. La limpieza ficticia de escritura de Chat es un evento de cierre; no una operación financiera. Ninguna escritura real. El reemplazo de observador por eventos tiene receptor/pruebas locales preparados; entrega nativa y corte siguen pendientes.

## Transacción laboral de raíz: alcance y límite técnico

El servidor REST mantiene una operación atómica bajo sisventas para solicitar horas, aprobar horas, solicitar gasto y redistribuir comisiones. Una operación nueva descarga el ancestro y realiza PUT condicionado por ETag; no se sustituyó por PATCH sin condición. Un conflicto puede traer otra copia completa. El volumen informado (~96MB) corresponde al tamaño agregado observado antes; no se descargó la base para esta auditoría.

Mejora candidata13.0: recibos idempotentes de solicitud de horas, aprobación ya confirmada y gasto ya registrado pueden devolver control.UNCHANGED tras validar actor/datos/estado. No serializan ni hacen PUT. La lectura inicial continúa. La versión anterior ya cancelaba el cuerpo de respuesta del éxito, por lo que no es correcto contar cada PUT omitido como96MB menos de descarga facturada. Redistribución nueva conserva la transacción completa.

Verificación aislada:32 casos específicos y4 integraciones REST con emulador;5 de8 casos nuevos fallan antes y8/8 pasan después. Incluye UID/payload diferente, empleado inactivo, aprobación por otro aprobador autorizado conservando autor inicial, gasto faltante, conflicto externo e idempotencia tras confirmación concurrente. No se tocaron comisiones reales.

### Por qué no se acota sólo la lectura

Horas requiere unicidad de aporte, empleado activo y grupo emp/mes; aprobación cruza solicitudes/cargo/gasto; redistribución cruza grupo completo de gastos, pagos y ctaemp. Hay otros escritores directos de rechazo, edición, pago y baja, además de cambios de empleado/cargo y generador automático. Un lock sólo de los cuatro endpoints no los coordina. RTDB no admite if-match con PATCH: lecturas pequeñas separadas más PATCH pierden el control de concurrencia.

### Corte de arquitectura aún no autorizado ni implementado

La opción conservadora de infraestructura es preparar dominio canónico laboral separado en la RTDB existente, con fuentes mínimas de empleados/cargos/tope, solicitudes, gastos laborales y movimientos vinculados. Excluir catálogo, ventas completas y adjuntos del ancestro transaccionado. Deben migrarse todos los escritores y lectores a una sola autoridad, conservar claves/autorías/importes/pagos/recibos originales y volver proyecciones legacy sólo lectura. El dominio seguirá creciendo: medir tamaño, no prometer lectura por documento ni costo mensual fijo. No se creó ese dominio ni se copiaron datos reales.

Si se exige transacción por documentos exactos, la alternativa es un almacén transaccional por documento: recibos de aporte, índice de grupo emp/mes, solicitud, alias de gasto histórico, empleado/config mínimos autoritativos, gastos/movimientos y membresía/revisión de grupos de comisión. Requiere evaluar ubicación, IAM, nuevo costo, respaldo, migración y bloqueo coordinado de escritores heredados; no crear servicios como efecto incidental de esta auditoría.

Antes del corte: inventario de todos los escritores y tamaño por rama sin valores en logs; simulacro ficticio de concurrencia, compatibilidad, detección de duplicados ambiguos (bloquear y conciliar), comparación por claves/revisiones/hashes, reversión sin doble escritura y sin restaurar la base completa. No se eliminó el GET/PUT de raíz de las operaciones nuevas. Este pendiente no está resuelto por reducir reenvíos.
