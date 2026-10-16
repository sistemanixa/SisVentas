# Gastos personales · implementación v3.11.12

Estado: implementación local en `codex/gastos-personales-v31112`, desde main
`4442fd7336834914c5814e908bf18a887353ab95`. Referencia aprobada consultada con
`git show`: `e3876728e2f06a0521f5f365e3fe71ad7601e89b`, rama
`origin/codex/referencia-gastos-personales`. No se cambió la rama original ni su
archivo histórico local. Los tres documentos de referencia se conservaron aquí.

**No está publicado ni habilitado sobre datos reales.** No se creó un bucket,
no se configuró un UID real, no se cambiaron reglas, contraseñas ni DNS y no se
importaron cifras de la demo. La producción y la transición HTTPS anteriores
conservan el estado documentado antes de este bloque.

## Espacio y diseño

Acceso adyacente a Gastos, visible solo tras autorizar el servidor. Espacio propio
en `personal-finance.html`, con los colores, paneles, navegación y controles del
prototipo aprobado. Se reutilizó su gráfica, sin su inicialización, almacenamiento
local ni semillas. Las ocho secciones están conectadas a operaciones del servicio.

El iframe se usa para aislar los estilos, no como frontera de seguridad. El
controlador de SisVentas conserva ruta, desplazamiento y foco de origen; bloquea
el fondo con `inert` y overflow y los restaura al volver. El hijo no recibe tokens:
su puente comprueba sesión/identidad antes y después de cada petición.

Logout, cambio de identidad y Ver como invalidan peticiones pendientes, retiran
el espacio y limpian su contenido y originales de memoria. No se guarda información
financiera en localStorage, IndexedDB ni cachés compartidas. El Service Worker
excluye las peticiones autenticadas y `/privado/finanzas`; no guarda respuestas
marcadas private/no-store. El HTML y los módulos públicos no contienen datos.

## Modelo y persistencia

Fuente pura: `cotizador/private-finance-model.js`; copia de navegador en
`js/core/private-finance-model.js`. Sincronizar con
`node scripts/sync-private-finance-model.cjs`; una prueba comprueba igualdad.

Nodo exclusivo **`sv_personal_finance/{ownerUid}`**, fuera de `sisventas`.
Contiene cards, statements, movements, payments, insurances, installments,
expenses, strategies, documents e history. Cada entidad tiene identificador,
propietario, timestamps y revisión de servidor. Las auditorías incluyen actor UID,
origen y valores anteriores/nuevos; las anulaciones conservan el pago.

Las reglas efectivas del corte e5dbd9b0… niegan por omisión el acceso directo a
esta raíz, también al titular y a administradores. El cliente solo usa el servidor.
No se agregan permisos padres ni se sustituye una base empresarial. Antes de una
habilitación real hay que comprobar que esas restricciones siguen efectivas.

Cada operación lleva UUID, revisión esperada y huella de contenido. La transacción
reconoce el reintento idéntico antes de evaluar la revisión; una colisión con otro
contenido y los cambios de otra pestaña devuelven 409. La interfaz conserva el
formulario y ofrece actualizar la base y comparar los registros actuales. No
anuncia éxito ante caída o respuesta incierta. El límite inicial es 6 MB de JSON
y 10.000 operaciones; al alcanzarlo se detiene con error explícito, sin borrar
historia automáticamente. Se necesitará paginación/archivo para volúmenes mayores.

## Dinero y conciliación

- Enteros en centavos, monedas separadas, entrada decimal analizada sin multiplicar
  un número flotante por 100. El cálculo de intereses redondea con enteros/BigInt.
- Saldo estimado por moneda: cierre + cargos posteriores asignados − pagos activos
  posteriores. Los movimientos incluidos en el PDF no se vuelven a sumar; el
  agregado toma un solo último cierre por tarjeta. Archivar no borra su deuda.
- Un campo ausente queda null. Un exceso de pago o saldo desconocido exige motivo
  explícito de conciliación. No se ocultan saldos negativos con un máximo a cero.
- Completar la fecha del mínimo declarado modifica ese registro, sin otro
  descuento. Pago futuro, moneda de mínimo distinta, duplicado y total incorrecto
  se rechazan. Guardar un pago no transfiere dinero.
- Revisar el mismo período conserva la identidad del resumen, pagos, originales
  y versiones previas. Un período nuevo no arrastra/descuenta otra vez pagos del
  ciclo anterior. Diferencias de subtotales requieren revisión y explicación.
- Seguros/cargos conservan su asociación histórica. Los débitos importados son
  candidatos; el usuario debe vincular explícitamente un seguro o compra ya
  existente. No se fusionan por semejanza de nombre. Solicitar o registrar baja
  no la ejecuta externamente ni acredita ahorro realizado.
- Cuotas: fin/liberación derivados de período y actual/total; no se avanzan con
  el reloj. La gráfica de liberación es ARS; las filas conservan su moneda.
- Externos vinculados exigen moneda/importe idénticos y no admiten asignaciones
  parciales ni dobles. Mensual es información, no generador automático.
- Escenarios guardan base por tarjeta, revisiones, tasas, aportes, resultados y
  supuestos. No modifican hechos. La curva es parcial de la tarjeta objetivo; las
  demás no se proyectan. Capital amortizado queda no determinable sin imputación.

## PDF y documentos

PDF.js **4.10.38** vendorizado desde npm, licencia Apache 2.0 incluida. Se ejecuta
en navegador con evaluación dinámica deshabilitada, sin servicios de IA ni envío
del contenido a terceros. El original puede compararse en un visor canvas separado
sin perder el formulario y descargarse mediante la misma autorización.

El extractor conservador reconoce etiquetas explícitas de período, cierre,
vencimiento, saldos con moneda, mínimo y tasas; filas con fecha completa, moneda e
importe. Conserva texto original/página/unidad. Etiquetas contradictorias quedan
pendientes. No convierte TNA en TEM ni completa cifras ausentes como cero.

**Límite pendiente de fuentes privadas:** la rama de referencia no contiene las
cinco plantillas bancarias ni PDF originales. Se comprobó extracción/render con
un PDF sintético. No se declara compatibilidad probada con esos bancos, archivos
escaneados/OCR o cifrados. En esos casos se informa y permite completar manualmente
contra el original. La tarjeta debe elegirse; no se infiere por el primer registro.

Originales de hasta 15 MB, firma PDF, SHA-256 y metadatos verificados en servidor.
El hash impide duplicar bytes renombrados. Un original conservado cuyo resumen no
se confirmó queda pendiente de vincular, sin crear deuda. No hay importación
automática del respaldo del prototipo; su posible migración requerirá validación
privada independiente. Exportar datos JSON y descargar los originales son acciones
separadas, siempre del titular.

## API y configuración para una futura habilitación

Servidor Cotizador, bajo el guard empresarial de sesión/revocación/cambio de clave:

| Método y ruta | Uso |
| --- | --- |
| GET `/privado/finanzas/acceso` | Capacidad del titular, sin exponer su UID configurado |
| GET `/privado/finanzas` | Espacio completo del titular |
| POST `/privado/finanzas/guardar` | Comando revisado/idempotente |
| POST `/privado/finanzas/documentos` | Original PDF, base64 solo en tránsito autenticado |
| GET `/privado/finanzas/documentos/{sha256}` | Original autenticado, sin enlace público |

Todas las respuestas llevan private/no-store. No hay rutas para elegir otro UID.
Otro administrador es rechazado como cualquier otro usuario. Ver como se bloquea
en el puente y el servidor rechaza el encabezado de contexto si se presenta; la
autorización real siempre corresponde al UID del token, no al nombre simulado.

Configurar mediante el mecanismo privado del entorno, **sin valores en Git**:

- `PERSONAL_FINANCE_ENABLED=true`, solo al habilitar el servicio compatible.
- `PERSONAL_FINANCE_OWNER_UID`: UID Firebase Auth exacto del titular, confirmado
  con su cuenta y la ficha protegida inequívoca. No buscar por nombre visible ni
  conceder acceso por ser admin. Si falta, el servidor permanece cerrado.
- `PERSONAL_FINANCE_BUCKET`: bucket GCS **dedicado** a este dominio. No reutilizar
  el bucket de adjuntos de SisVentas. El código rechaza los buckets predeterminados
  conocidos y exige uniform bucket-level access y public access prevention enforced.
- Identidad de servicio: permisos `storage.buckets.get`, `storage.objects.create`
  y `storage.objects.get` sobre ese bucket dedicado. Mantener los permisos RTDB
  existentes del servidor; no entregar claves privadas al cliente ni al repositorio.
- Mantener el mismo origen productivo y las configuraciones anteriores de Cloud
  Run. No ampliar CORS/IAM público para probar el módulo. Los operadores con acceso
  administrativo de Google Cloud siguen pudiendo administrar infraestructura; la
  exclusividad descrita corresponde a usuarios de la aplicación.

La activación requiere un despliegue autorizado de servidor/cliente y comprobar
el UID/bucket privado. Un commit/push no realiza ese paso. Si se confirma que
ventas ya usa Hosting, seguir también PUBLICACION_HOSTING_SEGURO.md; el empaquetado
ahora incluye personal-finance.html, módulos .mjs y licencia, sin datos ni fixtures.

## Repetir la validación local

`node scripts/dev-private-finance.cjs` abre **127.0.0.1:8765**, solo con API y
almacenamiento ficticios en memoria; no importa firebase-admin ni credenciales.
El fixture distingue titular, otro administrador, técnico, Ver como y logout.
No sustituye el servidor habitual de 8766. Reiniciarlo restaura la muestra ficticia.

Pruebas específicas: `node --test test/private-finance.test.cjs
test/private-finance-session.test.cjs test/private-finance-storage.test.cjs`.
Suite general: `scripts/test-current.ps1`.
Servidor: desde cotizador, `npm ci` y `npm test`. Sincronizar modelos antes de probar.

Emulador: `node scripts/test-private-finance-emulator.cjs`. Requiere Java 21,
`SV_SECURITY_TOOLS` con firebase-tools, firebase y rules-unit-testing, y
firebase-admin en cotizador o `SV_PRIVATE_FINANCE_ADMIN_MODULE`. Usa exclusivamente
`demo-sisventas-private-finance` en 127.0.0.1:9007 y borra credenciales de su entorno.
Obtiene la instantánea efectiva del commit de auditoría 5193bc10 mediante git show;
si no está disponible, traer esa rama o indicar `SV_PRIVATE_FINANCE_RULES` con la
misma huella exacta. La copia queda en tmp; no la despliega.

Evidencia local en tmp, fuera de Git. La validación final y sus límites se registran
en CONTEXTO_ACTUAL. Falta probar plantillas privadas, teléfono físico y el primer
uso real tras una futura activación; no se obtuvieron contraseñas para las pruebas.
