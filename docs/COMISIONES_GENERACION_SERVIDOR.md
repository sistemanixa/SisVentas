# Generación automática de comisiones · servidor publicado

**Estado vigente (16/10/2026):** activada en `cotizador-00109-dac`, 100% y sus
14 etiquetas, mínimo de servicio 1 y CPU permanente. Corte nuevo
`2026-10-16T14:52:27.715Z`; configuración anterior preservada. Reglas reales
`15cd87a1dfda0ef0cf4ab6bdef5000893506595e08d1c8b4416adad9c45ab6a1`.
Salud periódica confirmó conexión/suscripción fuera de solicitudes, sin generación
histórica. Huellas de 224 gastos, 122 movimientos y 47 controles conservadas,
incluida la comisión que el titular resolvió manualmente y confirmó aprobada.
Cliente v3.11.16 publicado después de corregir las regresiones de carga detectadas
con la sesión real. Los párrafos de preparación siguientes son antecedentes;
estado, evidencia, fallas detectadas y límites en CONTEXTO_ACTUAL.

Preparada en `codex/comerciales-por-responsable-v31113`, desde
`8f1a53a1ab8bb72bd7d1a044c356419b02a246ba`. No publicada ni habilitada.
No se consultó ni modificó producción durante este bloque; para el incidente
anterior solo se volvió a leer el informe privado local. El titular decidió
resolver esa comisión manualmente desde el módulo existente. No generar ni
recuperar esa operación como parte de una prueba o un despliegue.

## Regla y acceso

El módulo Comisiones conserva sus permisos: solo ingresan los roles habilitados;
crear manualmente, redistribuir, aprobar y pagar mantienen sus controles actuales.
Esto es independiente de que una venta genere automáticamente una comisión.

El operador autorizado de una venta puede solicitar la generación sin acceso al
módulo Comisiones. El comisionado proviene de los campos comerciales de la venta,
no del usuario que cobra, convierte, crea o fue asignado como responsable. El
servidor verifica sesión real/revocación/clave temporal, cuenta activa, módulo y
propiedad de la venta mediante el servicio de responsabilidad comercial. Ver como
no realiza esta operación. El observador interno no necesita una sesión de usuario.

POST `/comisiones/generacion/revisar` consulta, sin escribir; POST
`/comisiones/generacion/generar` solicita generación. Ambos reciben únicamente
`ventaFbKey`; generar admite además el digest de una vista previa para detectar
cambios. No se aceptan importes, porcentajes, identidad del operador o empleados
enviados por el cliente. Respuestas privadas/no-store y cuerpo limitado a 4 KiB.
No son rutas para acceder a la administración de comisiones.

## Cálculo

El servidor relee cobros canónicos de `sisventas/pagos`, excluye anulados y no
confía en `totalPagado` ni en el importe enviado por el navegador. Cobro completo,
comisión explícitamente habilitada y ganancia original positiva son necesarios.
No hay generación en ventas anuladas o sin cargo. Se exige coherencia de ítems,
descuentos, IVA y total con el modelo económico compartido del cliente. La base
es venta neta de descuentos y sin IVA, menos costo original por cantidad.

Prioridad de costos: anterior a preparación, presupuestado y costos guardados del
ítem, incluyendo USD solo con su cotización histórica guardada. No hay consulta
del catálogo para completar históricos. Los faltantes producen revisión con los
ítems identificados. Las altas nuevas capturan costo unitario presupuestado; las
ediciones conservan la referencia anterior. Un legado sin costo queda marcado
como pendiente aunque el editor haya cargado un costo actual: no se disfraza ese
importe como histórico.

Porcentaje desde excepción individual (cero es una exclusión válida), o cargo
con los mismos alias/defaults del cliente. Un participante se limita al tope;
dos participantes cuya suma lo supera reparten el tope en partes iguales. Los
montos se redondean a centavos. Los modelos de venta/identidad/presupuesto son
copias verificadas de `js/v3`, incluidas en Docker; sincronizar mediante
`node scripts/sync-commission-models.cjs` si cambia la fuente compartida.

## Concurrencia y recuperación

`sv_commission_generation/<ventaFbKey>` contiene un plan congelado, digest,
identificador de generación, actor, lease, intentos y estado. Solo servidor;
lecturas/escrituras directas de todos los clientes, incluso admin, denegadas en la
candidata. No se guardan contraseñas ni tokens en este nodo.

Se buscan comisiones vinculadas por clave técnica y alias comerciales en gastos,
cuentas de los participantes y controles anteriores. Se conservan las manuales,
pagadas, rechazadas y pendientes. Ante registros parciales antiguos se exige
conciliación; no se completan a ciegas ni se recalculan.

La generación reserva primero los controles deterministas compatibles con el
flujo manual. El cliente nuevo nunca toma una reserva marcada por el servidor,
aunque sea antigua. Gasto y movimiento se crean con transacciones individuales
create-only; se retoma únicamente un registro identificado con el mismo plan e
importe, sin reemplazarlo. Una colisión ajena detiene la operación. No se usa el
reemplazo de la base comercial ni la transacción raíz del circuito laboral.

No es una transacción global entre colecciones: un corte puede dejar una proyección
parcial pendiente, recuperable desde el plan. La vista previa la identifica como
incompleta. Los registros nuevos quedan pendientes de aprobación; nunca pagados
automáticamente. Reintentar conserva estados de aprobación/pago ya presentes.
Al completar se marca la venta y se agrega una sola entrada de auditoría con el
actor real. Si cambia la base durante una generación incompleta se detiene para
revisión; no se reajustan los importes ya creados.

El observador del servidor escucha ventas en `pago_total`; procesa cobros posteriores
al corte configurado, sin depender de que el navegador siga abierto. Reintenta
interrupciones desde los planes persistidos, con espera y máximo cinco intentos.
Errores de lectura previos al plan se reintentan en memoria; al reiniciar, la
suscripción vuelve a descubrir las ventas totalmente cobradas. Casos de revisión
no se reparan automáticamente. No ejecuta backfill financiero del historial.

## Antes de activar

Preparación del corte del 16/10/2026: Cloud Run efectivo aún tenía mínimo cero
y CPU durante solicitudes. Para el observador se requiere mínimo de servicio 1
y `run.googleapis.com/cpu-throttling=false` en la revisión activa. Mantener el
máximo existente y no aplicar mínimos por cada revisión etiquetada. Esto cambia
la facturación a instancia activa, también fuera de solicitudes. Referencia:
[configuración oficial de CPU y facturación](https://docs.cloud.google.com/run/docs/configuring/billing-settings).
El servidor registra `commission_observer_status` al conectar, al recibir la
suscripción inicial y cada minuto. Solo contiene estado y contadores, sin ventas,
personas ni importes; permite verificar actividad sin generar operaciones reales.

1. Revisar SHA y coordinar cliente, servidor y candidata de propiedad. La candidata
   agrega solamente el nodo privado cerrado e índices de venta para pagos/gastos
   y `estadoPago` de ventas, además de los cambios de propiedad ya preparados.
   No aplicar reglas ni variables automáticamente al leer este documento.
2. Configurar `COMMERCIAL_OWNERSHIP_ENABLED=true`,
   `COMMISSION_GENERATION_ENABLED=true` y `COMMISSION_GENERATION_FROM` con el
   instante ISO exacto del corte aprobado. Ausente/inválido no inicia el observador.
   No elegir un corte histórico para recuperar operaciones antiguas.
3. Verificar índices efectivos y credencial de servicio con acceso Admin SDK a
   estos nodos. No ampliar permisos de los roles comerciales al módulo Comisiones.
4. Para el observador continuo, verificar que el alojamiento mantenga una instancia
   activa y CPU disponible fuera de solicitudes. **La configuración real de Cloud
   Run no se cambió ni se verificó en este bloque.** Sin esa condición, las llamadas
   autenticadas del cliente siguen funcionando pero no se debe prometer ejecución
   continua con todos los navegadores cerrados. Preparar y revisar ese cambio en
   el corte de producción; puede afectar el costo del servicio.
5. Exigir actualización de clientes antiguos: el manual anterior no conocía la
   reserva de servidor, y el automático anterior aún intentaba escribir desde el
   navegador. Verificar un caso sintético en entorno de pruebas, luego lecturas de
   producción sin crear comisiones reales como prueba incidental.
6. Conservar la bandera deshabilitada para revertir activación; no borrar planes,
   movimientos, gastos, controles o comisiones existentes como reversión.

## Verificación local

Suite vigente y pruebas del servidor según AGENTS. Pruebas funcionales específicas:
`node --test test/commission-generation.test.cjs`. Incluyen acceso sin módulo
Comisiones, ausencia de escalada al técnico/usuario ajeno, importes manipulados,
costos faltantes, IVA/descuentos, dos participantes, concurrencia, reinicios,
colisiones, manual existente y captura/preservación de costos.

`scripts/test-commercial-ownership-emulator.cjs` usa RTDB demo en loopback 9008:
prueba generación por usuario sin módulo, privacidad del plan, conservación de
registros existentes, corte histórico y generación desde el observador sin petición
del navegador. No utiliza contraseñas ni datos reales. Resultados finales y límites
del recorrido en CONTEXTO_ACTUAL. Falta el corte coordinado, configuración del
alojamiento y prueba integral autenticada de producción; el push no los sustituye.
