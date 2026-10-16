# Ventas y presupuestos por responsable · v3.11.13

**Estado vigente (16/10/2026):** integrado en main y publicado con servidor
`cotizador-00109-dac`, bandera de propiedad activa y reglas efectivas
`15cd87a1dfda0ef0cf4ab6bdef5000893506595e08d1c8b4416adad9c45ab6a1`.
Cliente actual v3.11.16 tras corregir carga y conciliación dependiente. Se conserva
la autoría original y se filtra el acceso desde servidor; no se reescribieron
operaciones históricas. La generación automática de comisiones ya fue migrada y
activada conservando las existentes; ver COMISIONES_GENERACION_SERVIDOR.md.
La comisión del incidente anterior fue resuelta manualmente por el titular y
quedó excluida de recuperación. Los estados de preparación siguientes son
antecedentes; evidencia real, regresiones encontradas y límites en CONTEXTO_ACTUAL.

Preparado en `codex/comerciales-por-responsable-v31113`, sobre Gastos personales
`be07387ed30beb7ca3533ec6c6c6b040f143d313`. Sin merge a main ni despliegues. La copia
original y su histórico local permanecen intactos.

## Regla acordada

Todos los usuarios excepto Administrador ven sus propios presupuestos y ventas.
Administrativo ya no tiene excepción para ventas ajenas, aunque una casilla antigua
de verTodas siga en true. Los permisos del módulo siguen aplicando.

El administrador toca el nombre bajo Creado por y abre Asignar. La lista proviene
del servidor: cuentas activas con UID único y perfil/identidad protegida coherentes.
Ventas requiere Venta o Detalle habilitado; Presupuestos requiere Presupuesto.
El técnico sin esas casillas no aparece. Si su rol las habilita, sí es elegible.
El servidor revalida al guardar y rechaza una opción que perdió su habilitación.

**Creador original, responsable de acceso y comisionados son conceptos separados.**
La reasignación solo modifica responsableUid/Nombre/Rol, su revisión y auditoría.
No cambia vendedor, participantes de comisión, pagos ni importes. El nombre del
creador sigue visible; debajo aparece Asignado a cuando hay responsable explícito.

Las conversiones conservan al autor del presupuesto y registran convertidaPor,
convertidaPorUid y convertidaEn. Su instante de creación como venta es el de la
conversión, distinto del alta del presupuesto. No se reescriben conversiones reales.
El DTO reconoce el origen al presentar conversiones antiguas sin creador explícito.

La escritura multipath de una conversión nueva guarda el mismo evento explícito
`conversion_presupuesto_venta` en ambas auditorías: actor real/UID, instante ISO,
presupuesto/venta y creador original. La identidad se toma del presupuesto definitivo
después de preparar/volver a leer, no del formulario anterior ni del responsable
reasignado. Aceptación y conversión son eventos distintos; los reintentos que abren
una venta existente no agregan eventos ni alteran su autoría.

Para el legado, el servidor adjunta `_svConversionAudit` de presentación únicamente
si existe una conversión inequívoca en la auditoría del presupuesto enlazado. La
venta la muestra como «Según auditoría del presupuesto», sin escritura histórica,
sin inferir actor por el campo usuario de la venta y sin duplicar un evento propio.
Si el origen falta o es ambiguo, no se inventa una entrada. Estos metadatos `_sv`
se descartan al guardar; nunca se presentan como una reparación persistida.

## Seguridad y datos históricos

`cotizador/commercial-ownership.js` usa el guard comercial de Auth real, revocación,
cuenta activa e índice de módulos v2. `COMMERCIAL_OWNERSHIP_ENABLED=true` habilita
las rutas; ausente devuelve 503 y el cliente no vuelve a una lectura global.
La política compartida se copia al contexto Docker con
`node scripts/sync-commercial-policy.cjs`; una regresión comprueba igualdad.

| Ruta | Uso |
| --- | --- |
| GET /comerciales/ventas o /presupuestos | Registros filtrados en servidor |
| GET /comerciales/{dominio}/opciones | Destinatarios, solo administrador |
| POST /comerciales/{dominio}/reasignar | ID, UID y revisión/propietario esperados |
| POST /comerciales/{dominio}/preparar | Vincular identidad histórica inequívoca antes de editar |

Cada petición usa Bearer y no-store. Ver como solo admite contexto desde un Auth
Administrador real, muestra la colección del usuario elegido y no reasigna desde
esa vista. Cambio de identidad/logout descarta respuestas tardías y limpia ambas
colecciones. Actualización local cada 15 segundos, al recuperar visibilidad y
después de reasignar; no se anuncia como escucha instantánea de RTDB.

responsableUid explícito prevalece sobre todo alias. Para el legado se usan UID
originales o coincidencias exactas y únicas contra perfiles protegidos. Un
comisionado de venta no prueba autoría. Un presupuesto convertido usa la identidad
de su presupuesto origen. Registros ambiguos se mantienen solo para Administrador;
no se infieren por coincidencia parcial de nombres ni se migran al cargar.

Preparar una edición vincula los metadatos de identidad en una transacción del
registro, conserva sus datos y deja auditoría. Después, la escritura comercial
mantiene la comprobación de cambios concurrentes. Reasignar tiene revisión propia;
dos pestañas no se pisan. Las fuentes `_sv...` del DTO no se persisten.

Proyectos filtra presupuestos consultados/vinculados y presenta un vínculo
restringido sin título, importe, ítems o ID fuente si el usuario no puede verlo.
No modifica las membresías ni el resto del proyecto.

## Fechas y productos

Editar conserva autoría, instante original ts/creadoEn y fecha comercial. Un cambio
manual de fecha pregunta **Actualizar productos** o **Conservar importes**, reutiliza
actualizarValoresVenta/actualizarValoresPpto y deja la elección en auditoría.
Actualizar productos o renovar vigencia no altera automáticamente la fecha del
presupuesto. fechaOrden derivada para ordenar no se confunde con un campo guardado.

## Reglas propuestas; no aplicadas

`node scripts/prepare-commercial-ownership-rules.cjs` genera exclusivamente una
candidata en tmp, desde la base exacta efectiva e5dbd9b0… del commit de auditoría
5193bc10. Rechaza otra huella; no autentica ni despliega. Mantiene guard de acceso
temporal y todas las reglas de dominios ajenos. Cierra lectura/escritura padre de
las dos colecciones para no poder eludir restricciones de hijos. Admin consulta
la colección; otros leen/escriben solo registros propios canónicos. Se protegen
autoría y timestamps; fecha comercial requiere marcador manual vinculado al actor.
Las concesiones anidadas de cobros también requieren ser dueño de esa venta.
El alta de una venta convertida valida autoría contra su presupuesto protegido,
acceso del convertidor y clave determinista; no exige que el autor original sea el
responsable actual. Así permite convertir un presupuesto reasignado sin atribuir
su creación al nuevo operador ni sustituir nombres históricos por el directorio.

Antes de un corte hay que volver a leer las reglas remotas, comparar huella, tener
respaldo y probar el conjunto exacto. Preparar servidor compatible primero; luego
coordinar cliente y reglas con actualización obligatoria: clientes antiguos que
leían la colección completa perderán esa lectura. No activar solo las reglas ni
presentar el push de esta rama como privacidad ya vigente. El cliente nuevo también
requiere servidor compatible; no copiar sus activos al espejo habitual con el
servidor viejo. No se cambian casillas ni permisos generales de usuarios.

## Auditoría de comisiones: problema conocido, no reparado con apertura de permisos

Una consulta privada de solo lectura confirmó que el circuito automático vigente
intenta escribir desde el navegador en registros que los roles comerciales no
pueden crear tras el corte de permisos. Es independiente del porcentaje o de cómo
se muestra el creador. El emulador reproduce la denegación. No se ampliaron permisos,
no se generaron ni recalcularon comisiones existentes. Falta migrar esa generación
al servidor, conservando idempotencia y base financiera comprobada. Los documentos
antiguos sin costos de origen exigen conciliación; catálogo actual no demuestra
un costo histórico. Los resultados con nombres, operaciones y cifras reales
quedaron exclusivamente en tmp privado de la PC original, fuera de Git.

## Verificación y límites

Suite vigente, pruebas del servidor y emulador demo; resultados finales en
CONTEXTO_ACTUAL. `scripts/test-commercial-ownership-emulator.cjs` usa loopback 9008,
Java 21 y SV_SECURITY_TOOLS; solo demo-sisventas-commercial, sin credenciales reales.
El SDK Admin de pruebas se indica con SV_PRIVATE_FINANCE_ADMIN_MODULE si no está
instalado en cotizador. Se reutilizó ese nombre de configuración local existente.

`node scripts/dev-commercial-ownership.cjs` sirve 127.0.0.1:8764 con API real de este
módulo sobre memoria y personas/datos ficticios. Comprueba el selector y el filtro
sin cargar Firebase ni credenciales. No es todo SisVentas ni prueba todos los
formularios financieros. La prueba visual cubrió reasignación de venta, pérdida y
ganancia de acceso, exclusión del técnico, escritorio/móvil emulado 390×844 y
restauración inmediata del scroll. No equivale a teléfono físico ni escritura real.
Las decisiones de fecha se probaron funcionalmente reutilizando los dos métodos
existentes; falta una comprobación autenticada integral antes de una futura publicación.
