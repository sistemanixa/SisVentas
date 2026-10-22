# Horas Extra: consulta de pendientes

La candidata v3.14.8 reduce las lecturas del panel de aprobación y de su contador
global. Ambos consultaban todas las solicitudes y luego descartaban aprobadas y
rechazadas. Ahora comparten una consulta por estado igual a pendiente, sin límite
de fecha, personas o filas. La clave Firebase conserva la identidad; el agrupador,
los importes y los comandos de aprobación/rechazo siguen iguales a la v3.14.7.

La ventana aparece antes de esperar la lectura. Un rechazo o error muestra un
reintento explícito y mantiene desconocidos los resultados. Un plazo local de
20 segundos retira una espera excesiva; no vuelve a consultar ni crea un proceso
por reloj. Cierre, ocultación, sesión, rol, revisión y generación invalidan una
respuesta anterior. El cierre restaura foco y scroll.

El contador conserva una sola suscripción push, el wrapper de Firebase y su
suspensión de transporte al ocultarse. Una respuesta que llega durante la
ocultación se retiene sólo en memoria del contexto vigente; volver aplica ese
resultado una vez, sin GET ni suscripción nuevos. Error, revocación y logout
limpian el resultado y los avisos. Desconocido se distingue de cero comprobado.

## Índice necesario antes de publicar la web

El script prepare-hs-extra-pending-index.cjs sólo prepara un archivo local.
Agrega estado a sisventas/hsextra_solicitudes/.indexOn, conservando todos los
demás índices, permisos, validaciones y nodos. La base revisada de v3.14.7 es
cf03c8023e13b0eebb28419c84b6ada82524f79e7f12e40dfa68c23ed0e3b064 y la candidata
derivada es 4a859ae7ac48ff46554dcbc2b35ca9dab3057794630758b4674c1cf8c856c8a7.

El índice todavía no está aplicado. Una futura publicación requiere respaldo
remoto nuevo, comparación exacta antes del cambio y relectura después. Si la
base difiere, revisar y conservar los cambios ajenos; nunca restaurar reglas6 o
reglas7 históricas a ciegas. No hay concesiones nuevas, backfill ni migración.
No hace falta reconstruir Cotizador o emitirFactura para esta tanda. Después
del índice corresponden Hosting desde SHA limpio, hashes/cabeceras/SW y aviso
oficial, según PUBLICACION_HOSTING_SEGURO.md. La autorización de publicar7 no
se extiende automáticamente a publicar8.

## Pruebas y evidencia

La puerta vigente terminó con 4.569 aprobadas,27 opt-in omitidas y0 fallos.
Las35 pruebas del panel/contador y51 del builder están incluidas en esa cifra.
Una fixture de menú se actualizó para representar atributos DOM, contexto y
consulta reales; se conservaron y ampliaron sus garantías de única escucha,
actualización, logout y resultados desconocidos. La primera corrida falló por
el stub DOM incompleto; el informe anterior se conserva y la puerta final pasó.

El motor RTDB aislado completó20 casos,0 omitidos:18 comparaciones de reglas,
permisos y membresía REST, y2 con el SDK oficial10.12.0 que importa la aplicación.
La consulta REST sin índice devolvió400 y con índice200. El JSON REST no conserva
el mismo orden de propiedades; esa primera aserción diagnóstica fallida no se
presenta como un fallo del producto ni se oculta. El SDK real confirmó igualdad
exacta de snapshot.val(), orden, IDs, nombres, detalle, grupos y sumas IEEE antes
y después, sin ordenar ni alterar el agrupador. Hubo10 lecturas SDK sólo contra
http/ws127.0.0.1:9038. El namespace demo se eliminó y el emulador se detuvo.

Los dos activos oficiales del SDK se descargaron a tmp privado. La prueba usa
una copia ESM con un único import reescrito al archivo local y bloquea destinos
ajenos al emulador; los hashes originales/modificados quedan en la evidencia.
No se incorpora ese vendor ni datos reales a Git. La integración es opt-in y
requiere FIREBASE_DATABASE_EMULATOR_HOST,SV_HSEX_RULES_TEST_FILE y SV_HSEX_SDK_DIR;
no inicia servicios, busca credenciales ni consulta producción por su cuenta.

QA con CUA en HTML aislado de funciones y CSS reales,24 solicitudes ficticias:
escritorio1280 y anchos320/390/768 mediante iframe local, error/reintento,
detalle, cabecera opaca, cierre X/Escape, Tab/ShiftTab y foco restaurado. El
listado llegó a scrollTop846 con fondo0; cerrar restituyó overflow auto. La
inyección directa de rueda de este control no movió la fixture: no se afirma
haber probado un gesto físico de ratón/táctil ni un dispositivo real. Las fuentes
de iconos externas quedaron bloqueadas deliberadamente. No se aprobó/rechazó ni
guardó ninguna operación real. Evidencia privada en tmp/listings-next-private/
hs-extra-proposal y hs-extra-ui8, fuera de Git.

## Rendimiento y límites abiertos

Una fixture finita de10.026 solicitudes,24 pendientes, conserva grupos, HTML de
tarjetas, horas e IDs. Un GET y la primera entrega del listener suman6.441.200
bytes JSON de raíz frente a10.994 del subconjunto, suponiendo selección en el
servidor con índice. No son bytes de red facturados ni un precio. No se midió
latencia productiva y no se promete una factura o rapidez universal.

Esta tanda sólo optimiza el panel y el contador. Dashboard Mi Cuenta todavía
contiene otra lectura de la raíz y el rechazo agrupado conserva su CAS histórico.
Los comandos financieros no se modificaron; sus garantías dependen del circuito
vigente. Cobranzas y las demás ramas pendientes conservan su auditoría abierta.
