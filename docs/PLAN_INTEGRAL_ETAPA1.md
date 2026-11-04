# Plan integral de SisVentas — etapa 1

Fecha de decisión: 3 de noviembre de 2026. Estado original: planificación consolidada. Ejecución local reanudada por el titular; integración y pruebas en curso durante la ventana del04/11, sin activación general de producción. Este documento ordena la continuación y no acredita que la auditoría funcional esté cerrada.

Actualización posterior del titular: ejecución local del plan reanudada, con coordinación técnica delegada y sin pedir priorizaciones rutinarias. La pausa anterior describe el cierre de etapa1, no el estado de ejecución actual. Se conserva el control de alcance y evidencia antes de activar producción.

## Base y alcance

Se contrastaron cuatro revisiones locales independientes: núcleo comercial, vínculos operativos, consultas/métricas y transición. Fueron inspecciones estáticas focales; no ejecutaron sus matrices propuestas ni consultaron producción. El coordinador conserva el orden y la integración. No se reescribirá todo lo existente.

| Base | Estado conocido | Límite |
|---|---|---|
| Fuente publicada | v3.18.20, fuente `312705c2bd5c5e938aab729585506b2be87b0c5a`, HEAD documental `0c093b65` | Publicación de fotos separada verificada por activos/aviso; no incluye la integración |
| Integración | `300142f2fe7449d77e5d1749c653e7ca2b8df0b3`, candidata local v3.19.1 | Accounts y protección de referencias OT corregidos; pausas coordinadas agregadas. Puerta limpia 8.455 PASS / cero FAIL; respaldo remoto confirmado. No activada |
| Estado externo | Metadatos y fuentes remotas contrastados el 04/11; no modificados | Cotizador principal y 14 accesos antiguos inventariados; fuentes exactas fiscal/forwarders/Asistente identificadas. Revalidar antes del corte; no equivale a activación |

Las copias están en `C:/SisVentas/.local/dashboard-readiness-v31817` y `C:/SisVentas/.local/restaurar-grilla-original-v31714`. La raíz del proyecto y otras ramas históricas no sustituyen esas bases. Se preserva el WIP sin incorporarlo como terminado.

Se conservan: modelos compartidos de dinero/costos/identidad, lectores indexados, agregados históricos, preparación de Cuenta Corriente e Historial, controles de sesión y mejoras de retorno de Dashboard19. Las pruebas anteriores conservan valor para su alcance; no sustituyen aceptación cruzada del conjunto futuro.

## Contrato común

Un hecho tiene un original autoritativo; las vistas e índices son derivados reconstruibles, no segundos libros independientes. Cada mutación declara identidad autenticada, acción autorizada, revisión esperada, identificador estable de operación, efectos y resultado recuperable. Creador, responsable de acceso, cobrador y comisionado son conceptos separados.

Las páginas contienen hasta 50 filas; los totales y la deuda histórica provienen de cobertura completa validada. Buscar consulta el índice histórico y conserva continuación mientras haya resultados pendientes. Fuente ausente, error y cobertura desconocida nunca equivalen a cero ni a registro inexistente. Respuestas requieren identidad, ámbito, filtros, período, generación y revisión coherentes.

Se conserva precisión de costos unitarios y cantidades, con política monetaria explícita en el límite contable/fiscal correspondiente. No se normalizan históricos ni precedencias legacy durante una corrección de interfaz. Costo cero explícito no equivale a costo faltante. Las comisiones existentes no se borran ni recalculan incidentalmente.

## Matriz de circuitos y puertas de aceptación

| Circuito | Original y lectura | Escritor y permiso | Dependencias y recuperación | Prueba y puerta |
|---|---|---|---|---|
| Presupuestos y Ventas | `presupuestos`, `ventas`; índice para lista y original puntual para editar | Contrato compartido de venta; módulo/acción y propio/asignado, admin global | Costos capturados, identidad, revisión; conversión multifase con resultado único recuperable | Conversión concurrente y respuesta perdida: una venta, autoría/costos intactos |
| Cobros y Cuenta Corriente | `pagos`, originales comerciales/clientes; agregados y extracto completos | Comando autorizado de cobro separado de edición comercial; fuentes y proyecciones coordinadas | Caracterizar precedencias canónicas/embebidas/legacy; recibo de operación, conflicto y resultado incierto separados | Parcial/total/anulado/sobrepago/unificación; conciliación por contribución y cuenta |
| Comisiones | Venta y cobro confirmado; lectura personal mínima | Generación por evento autorizado de pago completo; gestión por permisos propios | Costos originales, destinatario/configuración, prueba de cobro e idempotencia | Exactamente una comisión pendiente; pago anulado/recibo ajeno rechazado, sin alterar existentes |
| OT, materiales y remitos | OT/venta, inventario y movimientos originales; relaciones completas | Entrega/instalación/adicional/devolución por acción y asignación, admin según acción | Identidad estable del material/operación; documento no equivale por sí solo a consumo | Original y adicional del mismo código, entregas parciales, dos sesiones y reintento: stock una vez |
| Compras | Órdenes/listas/inventario; resumen para listado, original para cambio | Recepción/desvinculación autorizada y revisión esperada | Conservar otras órdenes, costos capturados, base USD y gasto de importación una vez | Desvincular una entre varias fuera de memoria; recepción/reintento y conservación histórica |
| Gastos, Mi Cuenta y salarios | Gastos/pagos y movimientos laborales originales; vistas relacionadas | Acciones financieras por rol sin abrir cuentas privadas | Misma operación no se suma dos veces; fecha comercial/pago/cómputo diferenciadas | Nuevo/histórico, directo/vinculado, parcial/pagado/bonificación: mismos cálculos y clasificación |
| Historial de cliente | Siete fuentes del contrato H7; páginas por cliente/domicilio y original autorizado | Deltas en mutación fuente; lectores con audiencias por módulo/acción/asignación | Depende del núcleo y relaciones; ambiguos no se asignan por nombre | Embebido→global, vínculo tardío, domicilio ambiguo y técnico sin comercial; sin duplicación ni filtración |
| Dashboard e informes | Agregados completos o período agotado; nunca la página visible como universo | Lectura autorizada, sin mutaciones al consultar | Readiness por fuente, llegada en cualquier orden, invalidación y revalidación por contexto | 51/122 filas, búsqueda antigua, error y retorno: totales iguales y sin cero parcial |

Gastos personales continúa como dominio privado separado del titular; no entra en gastos laborales, Caja ni métricas empresariales. Acceder a una OT/proyecto o cobrar comisión no concede ventas, ganancias, porcentajes ni cuentas privadas.

## Transporte por operación

- Cálculo y presentación locales: sin llamada remota cuando los datos autorizados completos ya están disponibles.
- Lecturas directas acotadas: índices/resúmenes y originales puntuales con reglas, cobertura y cancelación; no descargar raíces para buscar.
- Escritura directa: sólo si las reglas pueden garantizar todas sus invariantes y no elude la coordinación instalada. No retirar fences como arreglo de velocidad.
- Servidor: secretos, autorización privilegiada acotada, efectos coordinados entre originales/índices, idempotencia y recuperación que requieran autoridad confiable. Documentar la razón de cada comando, sin convertir todo el módulo en una llamada genérica.

El nombre Cotizador no justifica ni invalida una operación. No se crea otro servicio sólo para renombrarlo. No se agregan sondeos por reloj; primero se caracteriza cada temporizador y se distingue UI local de red real.

## Hallazgos y grado de certeza

| Evidencia estática | Qué demuestra | Qué falta demostrar |
|---|---|---|
| Conversión con clave estable, lock y varias fases en app publicada | Hay protección reutilizable; lock no prueba atomicidad integral | Fallos entre fases, recuperación y escritores legacy completos |
| `payment-commands.js` con precedencias legacy distintas por operación | Unificar sin caracterización puede cambiar saldos | Matriz registro/anulación/embebidos contradictorios |
| `eliminarOT` revisa vínculos en `SP_DATA`/`otData` | El cliente usa memoria parcial | Si el servidor ya impide la eliminación inválida; no afirmar defecto productivo sin ese trazado |
| `guardarRemito` usa push y bloqueo de modal | Evita parte de dobles clics locales | Dedupe autoritativa tras recarga, ACK perdido y dos sesiones |
| Lector comercial limita páginas y conserva agregados | 50 filas no limita necesariamente el total | Continuación `hasMore` tras cinco lotes con filtros escasos y todos los consumidores |
| Informes acotan 5.000 ventas y 2.000 gastos; salarios filtra algunos gastos después de leer | Hay límites explícitos y candidatos de optimización | Medición de solicitudes/bytes y comportamiento de exceso; no ahorro remoto atribuido |
| Host Dashboard difiere entre integración14 y fuente19 | Copiar el árbol antiguo puede perder mejoras | Integración preservando cancelación, readiness y presentación warm/cold19 |
| Modo de escritura y pausa persistente preparados | Piezas para impedir fallback inseguro tras activación | Compatibilidad de pestañas previas, snapshot coherente y recuperación integral |

Referencias: `js/core/commercial-pages-reader.v1.js`, `js/modules/sales-indexed-host.v1.js`, `js/core/commercial-report-read.v1.js`, `js/core/salary-coverage-read.v1.js`, `cotizador/payment-commands.js`, `cotizador/commercial-ownership.js`, `cotizador/client-account-projections.js`, `cotizador/labor-runtime.js`, `js/core/labor-writes.js` y `js/core/client-account-mode.v1.js`. Se consultan en la base indicada; una dependencia presente no acredita su activación.

## Orden de ejecución decidido

| Paso | Entrega concreta | Dependencia / salida |
|---|---|---|
| 0. Base coherente | Integrar sobre lo publicado conservando Dashboard19; inventario completo de escritores/lectores afectados | Fuente revisable única y WIP identificado; sin desplegar app14 sobre19 |
| 1. Núcleo comercial | Contratos de identidad, dinero, costos, conversión, cobro, anulación y comisiones | Matriz de precedencias legacy y pruebas de operación única/recuperación |
| 2. Cuenta Corriente | Escritores, pertenencias, extracto y cobertura emparejados | Todos los comandos que alteran contribuciones actualizan derivados en el mismo commit |
| 3. Relaciones operativas | OT–Compras–stock–remitos y Gastos/Mi Cuenta/salarios | Validación autoritativa de vínculos y compensaciones, sin depender de memoria parcial |
| 4. Historial | Transporte, pantalla, audiencias e índices H7 | Núcleo y relaciones anteriores cerrados; permisos y domicilios coherentes |
| 5. Consultas y métricas | Cada tarjeta/cifra trazada a fuente completa; búsqueda histórica y límites visibles | Sin totales sobre primeras50, sin regresión Dashboard19 ni descargas redundantes injustificadas |
| 6. Transición y publicación | Paquete compatible y ensayo de corte/recuperación | Puertas completas y autorización de activación correspondiente; no sólo cantidad de tests |

La transición se diseña desde el paso0 y se ensaya durante el núcleo; no se descubre al final. Frentes independientes pueden revisar contratos/pruebas en paralelo; una sola integración modifica fuentes compartidas y reúne resultados. No hay publicaciones independientes de cada chat.

## Matriz transversal obligatoria (propuesta, no ejecutada en etapa1)

1. 0 certificado, 51, 122 registros, búsqueda fuera de primeras50 y filtros escasos con continuación: sin pérdidas, duplicados ni falsos totales.
2. Ventas/Pagos/Clientes en ambos órdenes de llegada; cobertura ausente, error y revisión cambiante: no presentar cifra definitiva parcial.
3. Autor/responsable/conversor/comisionado distintos; homónimos, usuario nuevo/inactivo, revocación antes del commit y Ver como: autorización real y sin datos ajenos.
4. Costos cero/faltantes/históricos, descuento por ítem/general y catálogo actual distinto: importes capturados conservados, política de precisión verificada.
5. Concurrencia, doble clic, respuesta perdida después del commit, reintento y anulación repetida: un efecto, resultado consultable, sin repetición ciega.
6. Original/adicional del mismo producto, recepción y entrega parcial, instalación, devolución y corrección de OT cerrada: documento y stock trazables una vez.
7. Pago/gasto directo y vinculado, nuevo e histórico, adjunto del gasto vs comprobante de pago: estados coherentes sin copiar pruebas a operaciones reales.
8. Ventana antigua con borrador, pausa entre comprobación y escritura, configuración ausente, caída del proceso y vuelta del foco: formulario conservado o recuperación explícita, fence persistente.
9. Escritorio/móvil, foco, Enter/Cancelar, scroll, retorno, cambio de sesión y errores: sin acciones por abrir ni pérdida de contexto.
10. Regresión cruzada de creación→consulta→cobro→comisión→cuenta→informe y compra→entrega→instalación→historial; comparar originales y proyecciones antes/después.

Aplicar pruebas focales, emulador de permisos/concurrencia y puerta vigente sobre el paquete final; revisar saltos y límites. Ninguna prueba incidental registra pagos, comisiones o stock reales. Los conteos históricos son antecedentes, no resultados de esta matriz.

## Corte y recuperación futuros

1. Verificar estado externo actual y costos antes de cambiar infraestructura; preparar paquete limpio con hashes y matriz frontend/servidor/reglas/modelos/configuración.
2. Distribuir y comprobar puente compatible antes de activar coordinación. Para pestañas antiguas, preservar borrador dentro de la identidad y actualizar explícitamente; revocar retira datos sensibles.
3. Pausar y drenar todos los escritores relevantes, incluidos directorios/identidad/permisos que afecten el snapshot. El bloqueo financiero por sí solo no demuestra esa exclusión.
4. Obtener y contrastar siete fuentes completas bajo exclusión, huellas y generación; instalar sólo índices técnicos y reglas emparejadas. Intenciones de responsables ya confirmadas se aplicarán por circuito oficial, nunca como edición encubierta de una prueba.
5. Verificar capacidades efectivas, reglas frescas, cobertura y ausencia de escritores incompatibles antes de reanudar. Ante fallo mantener pausa, no abrir SDK legacy.
6. Resolver confirmación incierta consultando identidad/recibo de operación. No volver a enviar por una simple demora.
7. Reversión compatible o reconstrucción de índices desde originales actuales; nunca restaurar respaldo financiero viejo después de operaciones nuevas.
8. Verificar activos web, contexto autenticado permitido y aviso de versión al final. Git, Hosting y Cloud Run se verifican por separado.

## Rendimiento y costos

Medir por recorrido solicitudes, bytes de respuesta, originales consultados, concurrencia, tiempo de red y render, separando apertura fría y retorno. Primero fuentes ficticias instrumentadas; medición real posterior acotada y sin operaciones de negocio. Evitar volver a descargar raíces para fabricar una comparación. No atribuir factura o ahorro a conteo estático, caché de navegador ni HTTP304. Comprobar también reposo; revisar temporizadores pendientes sin añadir uno nuevo. La política existente de alertas/corte requiere verificación remota antes de afirmar que sigue activa.

## Estimación y decisiones

Se mantiene el rango inicial de 18–30 horas efectivas para el conjunto: planificación1–2, núcleo5–8, vínculos6–10, consultas3–5 y transición3–5. Son rangos de trabajo, no promesa de plazo ni ahorro lineal por cuatro chats; se ajustarán con evidencia de implementación. Esperas humanas/de despliegue se informan por separado.

La etapa1 se entregó con este plan; posteriormente el titular reanudó expresamente la ejecución local y la ventana de ocho horas. No hace falta que priorice cada defecto: el orden anterior es responsabilidad del coordinador. Se pedirán decisiones sólo por ambigüedad de negocio no resuelta, ventana de corte/costo o alcance real que carezca de autorización; los responsables ambiguos ya decididos no se vuelven a preguntar.

## Avance comprobado de ejecución local · 04/11/2026

Esta sección reemplaza el estado pendiente original cuando aporta una prueba concreta. No convierte las observaciones estáticas anteriores en defectos demostrados ni acredita un corte productivo.

| Etapa | Evidencia local disponible | Límite actual |
|---|---|---|
| Base y núcleo | Dashboard publicado previamente conservado; apertura tardía retira acciones de la venta anterior; costos, dinero, duplicación y contratos compartidos cubiertos por la suite vigente | No modificar históricos para aprobar una prueba. Frontend nativo de Accounts/H7 permanece deshabilitado contra producción no preparada |
| Cuenta Corriente | Pertenencias y totales coordinados; claim reservado independiente de H7 verificado en acquire/commit; 30 contrastes old/new de agregados monetarios sin diferencias | Pruebas ficticias, no conciliación de todas las cuentas reales |
| Relaciones | Borrados conjuntos y compensaciones probados con reglas; alias técnicos/visibles de OT protegidos; remito manual conserva identidad en reintento; originales y stock ficticios controlados | No se eliminaron ventas/OT ni movió stock real para comprobarlo |
| Historial | Lectores completos por cliente/domicilio y originales autorizados; cambios de sesión/rol/revisión cancelan respuestas; proyecciones emparejadas | Índices/configuración nuevos ausentes en observación remota; requieren instalación controlada |
| Consultas | Arranque HTML real ficticio, 1.095 ventas/cobros: primeras 50 filas, búsqueda antigua, cinco recientes en Dashboard y deuda completa; sin escrituras ni lecturas SDK de raíces ventas/pagos | Bytes de fixture separados del bootstrap; no equivalen a transferencia productiva ni ahorro facturado. Otros dominios mantienen sus lecturas declaradas |
| Transición | Fuente fiscal exacta contrastada; 47 pruebas fiscales, 10 mixtas de jobs y 36 contrastes. Pausas SDK, Cotizador y nueva emisión fiscal preparadas; siete matrices de reglas/recuperación aprobadas sobre 1c12e793 | Pausas no activadas. Guard vacío solo no prueba drenaje; consultar jobs/reconciliar y verificar todos los accesos en el corte real |
| Revisión humana local | Dashboard, lista de 50 filas y detalle de una venta existente con imágenes visibles en el navegador integrado; sin guardar operaciones | Revisión visual focal, no prueba manual de todos los formularios ni de futuras capacidades remotas |

El procedimiento operativo vigente está en `CORTE_INTEGRACION_COMERCIAL.md`. La puerta limpia y los SHA de respaldo se registran en `CONTEXTO_ACTUAL.md`; resultados de una fuente anterior no certifican cambios posteriores. La publicación general sigue separada de esta integración local.
