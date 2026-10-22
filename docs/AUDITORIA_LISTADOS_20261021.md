# Listados comerciales y carga inicial

## Alcance preparado en v3.14.3, sin publicar

Base local `b1a4960399356640f0bfceee51aa853cd4a92f58`, rama
`codex/listados-historial-acotado`. Conserva las bonificaciones independientes
con mes de cómputo y la eliminación confirmada de presupuestos de las candidatas
3.14.1/3.14.2. Producción sigue en3.14.0 y Cotizador
`cotizador-scoped19-9c6b3126`, según CONTEXTO_ACTUAL. No se modificaron servicios,
reglas, índices remotos, facturación ni registros comerciales para esta prueba.

## Trabajo que se evita

- Ventas resuelve únicamente los presupuestos de origen referenciados por las
  ventas, deduplicados y con un máximo de seis lecturas simultáneas. También
  preparar/reasignar una venta lee su origen puntual y reintenta de forma acotada
  si la referencia cambia durante la transacción. Se conservan responsable,
  autor original y auditoría histórica; una lectura fallida no produce una lista
  parcial presentada como completa.
- El lector condicional de las dos colecciones comerciales conserva sólo datos
  en memoria de la instancia, hasta8MiB por raíz. Cada solicitud sigue
  autorizándose y validando el ETag en RTDB. Un304 evita volver a descargar el
  JSON; un error no devuelve datos viejos. No hay caché de permisos, sondeos,
  servicio nuevo ni almacenamiento persistente. Las operaciones financieras,
  guardas de dependencias y fichas puntuales conservan sus lecturas SDK.
- Guardar un presupuesto con la proyección completa ya cargada utiliza el
  registro confirmado para actualizar las vistas, sin releer la colección.
  Si la carga inicial estaba incompleta, conserva el refresco que incorpora los
  demás registros. Sincronizar explícitamente, recuperar conexión y recibir
  cambios de otra sesión siguen funcionando. Un error de render posterior al
  acuse se informa como problema de vista, sin afirmar que falló el guardado.
- Los formularios de ficha e integrantes de Proyectos piden opciones básicas.
  El selector de presupuestos se consulta sólo al abrir Vincular. La lectura
  pendiente se puede cancelar, un fallo permite cerrar y reintentar, y una
  respuesta antigua no abre ni reemplaza un diálogo de otra sesión o ruta.
  El contrato anterior de opciones completas se conserva para clientes antiguos.

## Medición aislada

El arranque ahora confirma los permisos, restaura la ruta y prioriza sus fuentes
antes del arranque compartido. Observa el mismo estado de datos que la pantalla;
ya no declara éxito al llegar a3.200ms. El plazo de permisos es15s por intento,
con reintento explícito y guard de aplicación del resultado tardío. El GET del
SDK no puede abortarse: no se afirma que el transporte se haya cancelado.
Los datos conservan su propio plazo de error recuperable, que no corre mientras
se verifican permisos. Cambiar de sesión/rol/ruta no permite que una respuesta
anterior cierre la vista nueva. El mensaje queda visible también al restaurar
una sesión, con el mismo estilo oscuro y botón neutro.

Medición de planificación contra app3.14.2/base anterior, funciones reales y
reloj idéntico con fuentes ficticias idempotentes: OT300ms, Clientes100ms,
Productos150ms, Ventas7.000ms y Cobros4.000ms. Permisos:220→0ms; solicitud
OT:220→0ms; OT completa:520→300ms; retiro del inicio:3.420→300ms. El inicio
anterior se retiraba por su límite aunque faltaban fuentes comerciales; el
candidato termina cuando está completo el módulo requerido. Los retardos de
220ms y restauración de ruta2.100ms concurrían: no sumarlos como una demora.
Esto no mide la latencia de producción ni incluye Auth/session-assets previos.
Los tres módulos previos de sesión se conservaron: Compras participa de stock/OT
y los portales tienen sincronización de proveedores que necesita otra revisión.

Las observaciones externas de UI en producción14.0 indicaron navegación caliente
alrededor de1,3s y recargas con dos esperas: OT disponible antes de13s y Dashboard
con Ventas pendiente a20,9s, ya disponible en una observación a33,3s. Incluyen
automatización y huecos entre observaciones; no son tiempos de red ni medición
exacta del fin. No se comparan contra300ms ficticios para anunciar un ahorro real.

Comparación contra la fuente base con200 presupuestos sin relación y una venta
vinculada. Se utilizaron las mismas identidades, permisos y datos ficticios;
la representación resultante es idéntica.

| Operación | Lecturas get/on | Bytes JSON leídos | Transacciones |
|---|---:|---:|---:|
| Listar Ventas | 5 → 5 | 1.914.236 → 1.535 | 0 → 0 |
| Preparar venta | 5 → 5 | 1.914.004 → 1.303 | 1 → 1 |

Son bytes de `JSON.stringify(snapshot.val())`, incluidos perfiles/permisos,
sin protocolo, compresión ni respuesta de transacción. Esta comparación aísla
el recorte de orígenes, sin el lector condicional. No mide tiempo de red,
bytes facturados ni ahorro mensual. Muchos orígenes distintos agregan lecturas
puntuales; menos bytes no garantiza menor latencia en todos los conjuntos.

El emulador RTDB local comprobó el304 real y cambios entre dos instancias,
centavos/ítems/pagos/comisionados intactos, segregación de usuarios y revocación,
altas/bajas/reasignaciones y cambios del origen mientras Ventas responde304.
Todo utilizó una namespace demo y credenciales ficticias de loopback.

Validación final:3.249 aprobadas/27opt-in/0fallos en la puerta vigente (3.276
total),94/94 Cotizador y5/5 integración RTDB local. QA visual aislado de Proyectos
y arranque en escritorio y390x844, incluyendo cancelar/fallar/reintentar y OT
retenida13s. Cero conexiones comerciales y guardados reales en esos ejemplos.
Una expectativa estática que buscaba el arranque antiguo se reemplazó por una
prueba funcional: permisos pendientes o denegados no abren listeners; permisos
confirmados los abren una vez. No se alteró la protección para hacerla pasar.

## Límites que se conservan visibles

La primera lectura, una instancia nueva, una raíz modificada o una raíz mayor
al límite siguen descargando el historial de esa colección. No hay paginación
financiera ni sustitución de totales por una muestra reciente. Cuenta corriente,
comisiones, métricas, ranking y otros consumidores necesitan ese historial;
acotarlo exige proyecciones e índices completos propios, con pruebas separadas.
Un304 sigue teniendo solicitud y cómputo de autorización/filtrado/serialización.

Las mejoras de Cotizador requieren su publicación posterior autorizada. La web
local continúa usando el servidor publicado y no demuestra esta reducción en
producción. No se consultó facturación para atribuir un ahorro monetario.

Evidencia privada fuera de Git: `C:/SisVentas/tmp/listados-v3143-*`, incluyendo
script y JSON reproducibles del benchmark, suites y capturas de QA. La integración
RTDB opt-in se ejecuta con `FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9027`
y `node --test test/commercial-collection-emulator.integration.cjs`; no acepta
otro destino.
