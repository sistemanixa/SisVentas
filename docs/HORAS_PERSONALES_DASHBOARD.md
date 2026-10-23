# Horas personales de Inicio · v3.14.10 publicada

Publicada el 23/10/2026 con autorización humana específica y coordinación de
publicador exclusivo. Fuente `2952ae512fed2d45474dfec8f722a6f5bf38af89`:
primero Cotizador y su índice, después Hosting y aviso oficial. El despliegue
detallado y los límites constan en `CONTEXTO_ACTUAL.md`; la evidencia privada
permanece fuera de Git en `tmp/v31410-release`. El espejo local8766 conserva
los mismos437activos públicos del SHA publicado, sin servir fuentes privadas.

## Problema y comportamiento

`renderDashMiCuenta` descargaba `hsextra_solicitudes` completo y filtraba por
empleado después. Esa lectura estaba denegada para un técnico y su error se
silenciaba. La candidata sustituye solamente esa lectura por un GET autenticado
a `/laboral/horas-propias`, dentro de Cotizador existente.

La respuesta contiene todas las solicitudes del empleado, con sus claves reales
y los campos necesarios para este indicador. No hay recorte por antigüedad,
estado o cantidad de filas. Un error se muestra como desconocido; no equivale a
cero solicitudes. Se conserva el cálculo de horas y su orden de suma, sin
redondear ni modificar registros.

El umbral de aprobadas usa el mes calendario anterior local, sin el desborde de
`Date.setMonth` el día 31 ni la conversión UTC. El texto dice «desde septiembre
de 2026», por ejemplo, porque el cálculo existente incluía el mes anterior. No
se cambia el helper global de meses ni se excluyen fechas futuras legacy por
extensión de esta mejora.

## Acceso y transporte

- Auth real con revocación y control de cambio de acceso; rol interno activo,
  índice de permisos vigente, Dashboard y Mi cuenta habilitados.
- Identidad propia desde el vínculo UID/perfil protegido. No se buscan personas
  por nombre o correo y no se permite elegir un empleado o una ruta de base.
- `viewProfile` sólo mantiene Ver como para un administrador con impersonación
  y el permiso que ya autorizaba la lectura administrativa de horas. Comprueba
  también el perfil, vínculo, rol y Dashboard del destinatario.
- Después de la consulta vuelve a comprobar las fuentes de autorización. Una
  diferencia persistente rechaza toda la respuesta. Son dos capturas, no una
  transacción que detecte cambios transitorios restituidos entre ambas.
- Query fija `empFbKey` con índice. El builder offline conserva `estado` y añade
  sólo `empFbKey`: no cambia lecturas, escrituras, validaciones ni otros índices.
  No se incorpora la propuesta descartada de conceder lectura propia en un padre.
- DTO mínimo sin nombres, notas, aportes ni adjuntos. El orden es exactamente
  `Object.keys(snapshot.val())`, incluidas claves numéricas de Firebase. El
  cliente valida dueño, claves, tipos, duplicados y orden antes de presentarlo.
- `private, no-store`, sin caché de permisos, fallback a la raíz o respuesta
  parcial presentada como total.

La única llamada del nuevo lector está en el callback CTA existente de Inicio.
No agrega disparadores por reloj, polling, listeners de datos ni servicios.
Ocultar, salir, cambiar de sesión/rol/vista o detener módulos aborta el intento y
descarta respuestas tardías. Volver visible sólo repinta memoria del contexto
vigente. Los productores y sincronizaciones anteriores de Dashboard permanecen;
esto no prueba que todas sus demás consultas estén eliminadas.

## Retorno de teclado

La QA de web9 mostró que Volver a Inicio enfocaba el botón del aviso antes de la
recarga normal y después terminaba en BODY. La candidata conserva una intención
de retorno sólo desde el botón humano. El renderer la consume al llegar una
carga verificada y un botón conectado. Una interacción, navegación, ocultación
o pérdida de contexto la cancela; no usa otro timer, observer o consulta.

## Evidencia y límites de rendimiento

Puerta vigente completa: 4.859 PASS, 27 opt-in omitidas y cero fallos; 4.886
casos totales, 61,16 s. Cotizador conserva 94/94 aprobadas. Sintaxis, diff y
script oficial `-ValidarLocal` coherentes10. La primera corrida quedó incompleta
al detectar dependencias faltantes en fixtures extraídos; la siguiente detectó
dos fixtures más y el COPY del lector ausente en Docker. Se corrigieron las
dependencias de prueba conservando sus aserciones y se incluyó el módulo real
en la imagen; la puerta final completa aprobó.

Pruebas permanentes: 80 del lector/builder, 66 del modelo/transporte, 13 del
callback real de aplicación y 30 del retorno de foco. Los casos de flujo de
avisos mantienen sus aserciones financieras y de filtros. Además, siete pruebas
opt-in pasan contra RTDB 4.11.2 local, Web SDK 10.12.0 y Admin SDK 13.10.0:
paridad de claves, orden y suma IEEE, claves numéricas, denegaciones de lectura,
reset/revocación durante la query, Ver como y conservación financiera ficticia.
Namespace limpiado, emulador detenido y cero conexiones SDK restantes.

El recorrido ficticio del cliente conserva una lectura CTA y una llamada HTTP
por apertura. Esa cifra **no** representa el trabajo del servidor: el pipeline
propio, incluyendo `businessAuth`, hace doce GET de base y verifica Auth. Once
son verificaciones pequeñas de identidad/permisos y una es la query propia.

Comparación privada de cuerpos JSON lógicos, incluyendo esas verificaciones:

| Fixture | Raíz anterior | Base leída por la candidata | DTO al navegador |
| --- | ---: | ---: | ---: |
| 2 propias y 3 ajenas | 1.264 B | 2.486 B | 265 B |
| 24 propias y 10.000 ajenas | 5.596.846 B | 15.193 B | 2.744 B |
| 12.000 propias y ninguna ajena | 6.632.891 B | 6.634.877 B | 1.352.040 B |

Coincidieron claves y sumas en los tres escenarios. No se midieron cabeceras,
TLS, red productiva, Auth o cómputo de Cloud Run: no es factura ni promesa de
menor latencia o ahorro universal. No reduce la historia propia cuando ésta es
grande. No agrega costo fijo de un servicio nuevo. La compilación única de la
publicación duró80,734s; ese tiempo no permite deducir el importe facturado.

QA visual aislada a 320, 390, 768 vertical y 1280: sin desborde horizontal,
pendiente histórica, período aprobado largo, carga/error/vacío diferenciados y
Tab nativo. Tarjeta, CSS y modelo reales; transporte y personas ficticios, CSP
sin conexiones y consola sin errores. La corrección de foco tiene cobertura del
renderer real en DOM simulado. Capturas y medición privada fuera de Git, en
`tmp/listings-next-private/dashboard-hsex10`.

La QA autenticada posterior al despliegue usó la sesión técnica existente sin
impersonar: horas propias cargadas, avisos ready y apertura de Bonificaciones
con empleado bloqueado/tipo correcto/una fila. Volver a Inicio conservó el foco
en el botón del aviso después de la recarga normal; el lector volvió a terminar.
Ancho390 sin desborde, una columna y viewport restituido. No se realizaron
guardados, pagos, aprobaciones, rechazos ni eliminaciones reales.

Abrir Cargar hs extra mostró el bloqueo vigente por dos OT programadas vencidas
más de diez días. Se cerró sin presentar nada, liberando el scroll. Ese aviso
legacy deja el foco en BODY al cerrar; el markup es idéntico al de9 y queda como
pendiente separado del retorno de avisos corregido. No se acredita el formulario
de presentación ni operaciones financieras productivas con ese recorrido.

## Activación comprobada y alcance conservado

Se revisó el SHA limpio y la autorización concreta, se respaldó/comparó otra vez
la base remota, se aplicó sólo el índice y se verificó su relectura. Cotizador
conserva configuración/IAM y14accesos. Hosting437activos,34hashes y cabeceras
comprobados; sólo después se actualizó el marcador oficial. La base local del
builder no sustituyó la lectura fresca del estado remoto.

No se modifican pagos, permisos concedidos, solicitudes, sueldos, bonificaciones,
comisiones ni su generación. Tampoco flags financieros, fiscal, IAM, DNS,
servicios, migraciones o backfills. Las reglas remotas sólo añadieron el índice
descrito, sin cambiar permisos. La auditoría sigue abierta:
otras raíces CTA/listados y escrituras CAS necesitan sus revisiones separadas.
