SISVENTAS — GASTOS PERSONALES
Especificación para implementación por Codex
Fecha: 16/10/2026. Referencia pública de implementación; sin datos privados.

1. DECISIÓN APROBADA Y OBJETIVO

Implementar un módulo privado «Gastos personales» dentro de sistemanixa/SisVentas.
Agregar su acceso al menú principal junto a «Gastos», pero conservarlo como un
espacio de trabajo propio, comparable al acceso a Distribuidora. Mantener sesión,
dominio y estética de SisVentas. Incluir un retorno real «Volver a SisVentas» que
preserve la vista anterior cuando corresponda.

El módulo administra tarjetas, resúmenes, pagos, seguros, cuotas, gastos externos
y estrategias de cancelación. No incluye ingresos personales en esta versión.
No reutilizar ni alimentar automáticamente las colecciones y reportes de gastos
laborales, reintegros, Caja, Tesorería, comisiones o rentabilidad de la empresa.

El titular aprobó la dirección visual de prototipo-demo.html y el
acceso descrito. prototipo-demo.html es una copia del diseño aprobado con datos ficticios y sin
PDF reales. Es referencia de comportamiento, no código de producción. Los
archivos privados originales deben obtenerse separadamente por un canal privado.

2. ANTES DE EDITAR

- Leer AGENTS.md y docs/CONTEXTO_ACTUAL.md vigentes.
- Revisar rama, último commit, git status y origin/main. Crear una rama codex/...
  aislada. Conservar cambios ajenos; no reset/clean ni push forzado.
- Detectar la aplicación activa desde index.html; no editar una versión histórica.
- Actualizar versiones, Service Worker y Novedades según las reglas del repo.
- Revisar cómo se implementan Distribuidora, permisos, identidad, cierre de sesión,
  datos privados y adjuntos. Elegir una integración coherente con lo existente.
- Confirmar que tmp/gastos-personales-referencia/ está ignorada por Git ANTES de
  agregar archivos. No añadir el paquete, PDF, HTML privado, JSON real ni capturas
  con información financiera a commits, PR, pruebas públicas o logs.

Al preparar esta referencia, origin/main era e21c04e y la aplicación activa
v3.11.10; verificar nuevamente, sin retroceder la versión. También se identificó un
cotizador/personal-expenses.js destinado a gastos laborales de empleados: no es
este módulo y no debe confundirse con las finanzas privadas del titular.
No hay implementación de este módulo pendiente de integrar desde Work: solo se
revisó el repositorio. El prototipo sigue separado de SisVentas.

3. ACCESO Y PRIVACIDAD

Solo el usuario real del titular configurado, identificado por Firebase
UID verificado, puede consultar o modificar este módulo y descargar sus PDF.
No otorgar acceso a todos los administradores por defecto. No decidir por nombre
visible, rol enviado por el navegador o correo escrito en un formulario.
Resolver el UID desde una fuente protegida o configuración de servidor y
documentar el mecanismo. Si falta esa identidad, mantener cerrado el acceso.

Ocultar el menú a otros usuarios es necesario, pero no suficiente. Proteger
lecturas, escrituras, exportaciones y documentos en el servidor/reglas efectivas.
Auditar permisos heredados: un veto en un hijo de RTDB no revoca un permiso del
padre. No colocar datos privados en un nodo compartido que otros puedan leer.
No ampliar permisos generales de la base para implementar esta función.

Bloquear entrada mediante URL, consola o APIs para usuarios no autorizados.
Desactivar el módulo durante «Ver como» y eliminar su contenido de memoria al
cerrar sesión o cambiar de identidad. Descartar respuestas asíncronas de una
sesión anterior. No conservar respuestas autenticadas en caches compartidas del
Service Worker ni publicar enlaces permanentes de descarga sin control privado.
El código público y los tests deben usar datos ficticios.

4. PANTALLAS Y NAVEGACIÓN

Conservar el diseño oscuro v3 de SisVentas: azul profundo, acentos dorados,
paneles y controles compactos. Mantener el prototipo como referencia principal.

Secciones internas:
1) Resumen: deuda por moneda, mínimos, seguros, liberación de cuotas y acciones.
2) Tarjetas y deudas: último resumen, mínimo, pagos, tasas, saldo estimado y detalle.
3) Importar resúmenes: PDF, revisión editable, validación, confirmación y original.
4) Seguros: registro individual, decisiones, traslado e historial.
5) Compras en cuotas: cuotas, finalización y liberación mensual.
6) Gastos externos: registros manuales pendientes/pagados y conciliación.
7) Plan de cancelación: simulación y versiones de estrategia.
8) Historial: pagos, correcciones, anulaciones, decisiones e importaciones.

Responsive para escritorio y celular. Tablas con desplazamiento cuando sea
necesario; no truncar centavos para hacerlos entrar. Etiquetas, teclado, foco,
diálogos y scroll deben funcionar. Mostrar vacíos y fallos de carga explícitos;
un dato desconocido no es cero.

5. PROCEDENCIA Y MODELO DE DATOS

Diseñar entidades propias del dominio, con ownerUid, identificador estable,
createdAt/updatedAt del servidor, versión/revisión y relaciones verificables.
Los nombres siguientes son orientativos; adaptar la implementación al repositorio.

Card:
  id, ownerUid, bank, brand, identificador enmascarado opcional, estado,
  política (sin consumos nuevos, pagar total, reducir deuda), observaciones.

Statement:
  id, ownerUid, cardId, período, cierre, vencimiento, documentos originales,
  saldo anterior por moneda, saldo al cierre por moneda, mínimo y su moneda,
  tasas identificadas (TNA/TEM/CFT con unidad), revisión de extracción.
  Conservar valores originales extraídos y correcciones manuales por campo.

Movement:
  id, statementId o vínculo con cargo posterior, cardId, fecha,
  descripción original, importe con signo, moneda, tipo, referencia del PDF,
  comprobante si existe, cuota actual/total si existe, origen y página del PDF.

Payment:
  id, ownerUid, statementId, cardId, fecha real (nullable solo para los mínimos
  iniciales declarados), importe positivo, moneda, tipo (mínimo/total/parcial/
  extraordinario), estado, comprobante opcional, origen y clave de idempotencia.

Insurance:
  id, ownerUid, aseguradora o descriptor original, referencia/póliza nullable,
  cobertura nullable, clasificación (seguro/por confirmar/no es seguro), importe
  de referencia, moneda, tarjeta asociada, decisión, fechas de baja, notas.
  Historial de decisiones y asociaciones; cargos vinculados por identificador.

InstallmentPurchase:
  id, ownerUid, movimiento de origen si existe, concepto, tarjeta, moneda,
  importe de cada cuota, cuota actual, cuotas totales y período de esa cuota.
  Fin estimado y primer mes de liberación derivados, sin alterar el histórico.

ExternalExpense:
  id, ownerUid, concepto, categoría, importe, moneda, fecha/vencimiento,
  medio, frecuencia, estado, notas y vínculo opcional con movimiento de tarjeta.

StrategyScenario:
  id, ownerUid, nombre, fecha, saldo base por tarjeta, objetivo, extraordinario,
  aportes mensuales definidos, tasas y supuestos, criterio de prioridad,
  resultados y versión. Conservar cada versión y su base al momento de guardarla.

Document:
  id, ownerUid, nombre, MIME, tamaño, SHA-256, ubicación privada, fecha,
  vínculos con importación/resumen. Los bytes no van en JS público ni en Git.

AuditEvent:
  id, ownerUid, actorUid real, entidad, acción, fecha del servidor, origen,
  valores anteriores/nuevos relevantes y motivo para correcciones/anulaciones.

Origen y estado son dimensiones distintas:
- Extraído del PDF: dato del documento; no confirma el saldo bancario de hoy.
- Informado manualmente: declaración del usuario; no inventar comprobante/fecha.
- Corregido manualmente: conservar extracción y cambio, sin borrar la fuente.
- Simulado/derivado: cálculo con supuestos; nunca transformarlo en un hecho.

6. DINERO, SALDOS Y PAGOS

Usar enteros en unidades mínimas por moneda o una librería decimal adecuada.
Evitar errores de coma flotante y conversiones ambiguas. ARS y USD conservan
centavos; la regla comercial de USD enteros de Distribuidora no se extiende a
estos saldos. Validar formato de ingreso y límites en cliente y servidor.
No mezclar monedas ni pesificar USD con una cotización inventada.

Saldo estimado de un resumen = saldo del PDF + cargos posteriores válidos
registrados fuera de ese PDF - pagos posteriores asignados a ese resumen,
calculado por moneda. Los movimientos que ya componen el PDF no se suman otra vez.
Los pagos históricos que aparecen en el PDF ya están dentro de su saldo al cierre:
no descontarlos de nuevo como pagos posteriores.

La deuda agregada utiliza el último resumen pertinente de cada tarjeta, no la
suma de cierres sucesivos. Un nuevo cierre sustituye la base de referencia de
esa tarjeta; no arrastrar y volver a descontar pagos ya incluidos en ese cierre.
Conservar estados históricos para auditoría y evolución, por fecha de corte.
No mostrar como saldo bancario confirmado un cálculo basado en documentos viejos.
Si faltan movimientos posteriores, informar que está pendiente de conciliación.

Permitir varios pagos a un resumen y distinguir tipo, fecha, moneda e importe.
Un registro de pago no transfiere dinero. Rechazar duplicados con idempotencia
también ante doble clic, reintento o concurrencia. Completar la fecha de un
mínimo ya informado no genera un segundo descuento. Una anulación deja rastro.
No registrar pagos realizados con fecha futura. Un importe que exceda el saldo
estimado requiere conciliación explícita; no ocultarlo con un máximo a cero.
Los mínimos en pesos no prueban que los dólares hayan sido cancelados.

Persistir con control de versión para que dos pestañas no se pisen silenciosamente.
No anunciar «guardado» si el servidor falló o el resultado es incierto. Mantener
el formulario y permitir resolver/reintentar sin duplicar el pago.

7. IMPORTACIÓN PDF

Interfaz de arrastrar/soltar inspirada en Comprobantes ARCA; admite selección.
Validar formato real del archivo, tamaño y permisos; calcular hash de contenido.
Detectar un mismo PDF aunque cambie de nombre y un mismo banco/tarjeta/período
aunque el documento tenga bytes distintos. Para revisiones del banco, vincular
versiones conservando ambos documentos y sin duplicar pagos, seguros o cuotas.

Extraer banco/tarjeta/período, cierre/vencimiento, saldos, mínimo, pagos,
consumos, seguros/débitos, cuotas, intereses, impuestos y percepciones. Conservar
el descriptor original, moneda, signo y referencias. Campos ausentes quedan
pendientes, con su procedencia; no rellenarlos con valores supuestos.

Mostrar vista previa editable y comparación con el original antes de confirmar.
Conciliar subtotales por moneda. Los cambios de usuario se registran como
correcciones, no como extracción bancaria. No crear entidades financieras
definitivas antes de confirmar la revisión.

El prototipo ya tiene datos preparados de los cinco archivos, pero NO tiene un
lector universal de PDF nuevos. Implementar extracción real, empezando por las
plantillas adjuntas; si un archivo no se soporta o necesita OCR no disponible,
mostrarlo y permitir completar manualmente. No simular extracción exitosa.
No agregar servicios pagos o enviar documentos a proveedores externos sin
explicar y resolver la configuración necesaria. Separar cualquier motor de IA
del cliente público y proteger sus credenciales.

8. SEGUROS

Decisiones: Mantener, Evaluar, Solicitar baja, Baja solicitada, Baja confirmada.
No es necesario identificar hoy la cobertura de cada seguro. No inventar pólizas
a partir de referencias de débito. Los débitos candidatos permanecen por confirmar como seguros.

Cambiar la tarjeta conserva la identidad del seguro y el historial; los cargos
anteriores mantienen su tarjeta original. El registro no realiza el traslado
con la aseguradora. Lo mismo rige para las solicitudes de baja externas.
Registrar fechas reales de solicitud/confirmación y alertar cargos observados
posteriores. Al importar otro período, vincular por referencias verificables;
una coincidencia dudosa pide revisión y no fusiona pólizas automáticamente.
Separar gasto observado, importe recurrente estimado y ahorro potencial. Una
decisión de baja no genera ahorro realizado hasta que se verifica su efecto.

9. CUOTAS Y GASTOS EXTERNOS

Una compra en cuotas conserva importe de la cuota, actual/total y período base.
Validar 1 <= actual <= total. Mostrar fin estimado y liberación desde el mes
siguiente a la última cuota. No avanzar la cuota solo por el paso del tiempo;
conciliar con cada resumen nuevo. No confundir importe mensual con precio total.
Las cuotas futuras no incluidas en el saldo actual son obligaciones futuras:
no sumarlas de nuevo a la deuda del resumen sin explicitar esa otra magnitud.
La liberación proyectada no equivale a efectivo disponible.

Gastos externos: servicios, impuestos, expensas, efectivo, transferencias,
préstamos y otros; frecuencia recurrente u ocasional; pendiente o pagado.
Una recurrencia genera períodos distintos solo mediante reglas explícitas y
sin duplicación al reabrir la pantalla. No presentar una etiqueta mensual como
si ya hubiera un generador automático implementado.
Un gasto vinculado a un movimiento de tarjeta se excluye del total externo
duplicado. Mostrar el vínculo y no permitir asignarlo dos veces. Si se admiten
asignaciones parciales, validar sus importes y suma; si no, explicar la limitación.
Pagar un gasto externo no reduce una deuda de tarjeta por sí solo.

10. SIMULADOR Y ESTRATEGIA

Permitir una estrategia definida por el titular: mínimos, extraordinarios,
prioridad por saldo y tasa, tarjetas sin nuevos consumos y cuenta de pago total.
La configuración financiera concreta se obtiene del titular por un canal privado.
No inventar ingresos ni un aumento del presupuesto mensual destinado a deuda.

Permitir elegir objetivo, extraordinario, aporte mensual total si se conoce,
tasas y criterio de prioridad. Distinguir aporte que incluye mínimo de un extra.
Mostrar restante estimado, reducción del saldo, ahorro aproximado de intereses,
evolución de deuda, progreso y próxima candidata según regla transparente.
Tasas desconocidas deben quedar visibles y no reemplazarse por cero.

La reducción del saldo no prueba cuánto capital amortizó el banco: el saldo
incluye intereses e impuestos. Mostrar capital amortizado como no determinable
si falta la imputación, o calcularlo solo con datos suficientes y regla explícita.
Mostrar fórmula, horizonte y exclusiones del ahorro aproximado. Para un mes
completo, extra × TEM es solo una aproximación si todo reduce saldo financiable.
No extrapolar una tasa actual como promesa. Considerar fecha del pago o advertir
la simplificación de un período completo.

En una curva parcial de una tarjeta, aclarar si el resto permanece constante;
no llamarla proyección completa de todas las tarjetas. Avisar si el aporte no
cubre los intereses del escenario. Guardar una simulación no registra un pago
ni modifica los hechos. Permitir cambiar estrategia conservando sus versiones.

11. DATOS PRIVADOS INICIALES

Esta rama NO incluye datos iniciales reales ni documentos del titular. Todas las
cifras de prototipo-demo.html son ficticias y no deben importarse a producción.
Solicitar las fuentes privadas solo cuando sea necesario para conciliar o crear
la carga inicial; continuar mientras tanto con fixtures ficticios y validaciones.
No fabricar saldos, pagos, pólizas ni fechas. Separar mínimos declarados sin
comprobante de pagos verificados. Una cuenta sin resumen tiene saldo desconocido.
Conservar monedas e inferencias de extracción explícitas.

12. DIFERENCIAS DEL PROTOTIPO FRENTE A PRODUCCIÓN

El HTML usa almacenamiento de navegador y guarda PDF nuevos en IndexedDB cuando
está disponible. No tiene autenticación propia, sincronización multiusuario ni
conexión con SisVentas. Su privacidad depende de quién accede al archivo/equipo.
Eso NO alcanza para el requisito de acceso privado del módulo integrado.

El HTML privado original contenía PDF embebidos. Esta copia pública no los
incluye. Reutilizar diseño y reglas útiles sin convertir datos privados en código.
La exportación/restauración del prototipo puede servir de ruta de importación
privada, con validación de formato, relaciones, importes, límites y versión.
No afirmar que se probaron visualmente sus pantallas: Work hizo 28 comprobaciones
de lógica/serialización, pero no revisión visual en un navegador real.

13. CRITERIOS DE ACEPTACIÓN Y VALIDACIÓN

A. Acceso: el titular entra desde el menú; otro usuario/administrador, un anónimo
   y una identidad inactiva no acceden por UI, URL, API o descarga directa.
B. Sesión: cerrar sesión, cambiar usuario o Ver como limpia pantallas y descarta
   respuestas tardías; no deja datos o PDF en cache compartida.
C. Separación: no cambian los gastos laborales, caja, tesorería, reportes de la
   empresa ni comisiones al operar este módulo.
D. Importación: mismos bytes renombrados y mismo período no generan duplicados;
   revisiones conservan los originales y su trazabilidad.
E. Dinero: operaciones conservan centavos; ARS/USD separados; faltantes no son 0.
F. Pagos: varios pagos válidos funcionan; doble envío/reintento concurrente no
   duplica; completar mínimo declarado no descuenta otra vez; anular deja rastro.
G. Cierres: un resumen nuevo no suma otra deuda independiente de la misma tarjeta
   ni vuelve a descontar pagos ya incorporados. Los anteriores siguen disponibles.
H. Seguros: un traslado conserva cargos e historial; un débito no confirmado sigue como candidato;
   un cargo posterior a baja alerta sin inventar que la baja se concretó.
I. Cuotas: fin/liberación se calcula desde período y número; no se generan
   consumos ni efectivo disponible ficticios.
J. Externos: vincular un gasto no duplica el total y no paga una tarjeta.
K. Simulación: guardar/cambiar un escenario no altera saldos ni pagos; se
   conservan versiones, bases y supuestos; no se inventa capital amortizado.
L. Persistencia: probar dos pestañas, conflicto de revisión, caída de red y
   respuesta incierta; no mostrar éxito falso ni perder formulario.
M. UI: verificar escritorio y móvil, todas las secciones principales, formularios,
   filtros, foco/teclado, scroll, cierre de diálogos y retorno a SisVentas.

Ejecutar las pruebas específicas y la suite vigente indicada por AGENTS.md,
comprobación de sintaxis y git diff --check. Usar fixtures ficticios para tests
versionados, emuladores para permisos/concurrencia y no escrituras incidentales
en producción. Los valores reales solo se concilian en un entorno privado.

14. ENTREGA DE CODEX

Implementar en una rama aislada; no limitarse a devolver un plan o un prompt.
Si hay bloqueos de identidad, credenciales o servicios, completar lo independiente
y detallar el bloqueo preciso sin abrir permisos ni fingir funcionamiento.
Documentar decisiones de arquitectura, esquema definitivo, validaciones y APIs,
pruebas realizadas y límites, migración privada e instrucciones de despliegue.
Separar con claridad: código local, commit/push, PR, servicios desplegados,
reglas aplicadas y datos iniciales efectivamente importados. Un commit no
demuestra un despliegue y una candidata de reglas no está aplicada.
Conservar la estética aprobada; no sustituir el resultado por otra interfaz
genérica ni integrar el HTML privado tal cual en la web pública.

Trabajar según las instrucciones vigentes del repositorio para commit/push y
publicación. Entregar cambios y evidencia listos para revisión, con sus SHA/PR
cuando corresponda. No exponer información financiera en títulos o descripciones
públicas. Actualizar la continuidad del proyecto con hechos y pendientes reales.
