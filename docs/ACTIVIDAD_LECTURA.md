# Lectura del historial de Actividad

## Alcance de la candidata v3.14.16

Configuración → Actividad abre con **Últimos 30 días**, muestra las fechas del
filtro y ofrece **Ver todo el historial**. Es un alcance explícito del listado de
auditoría, no un recorte de cuentas, pagos o comisiones. El estado externo de la
publicación se registra en [CONTEXTO_ACTUAL.md](CONTEXTO_ACTUAL.md); preparar o
probar esta candidata no acredita que esté desplegada.

La lectura de 30 días usa `orderByChild('fecha')`, `startAt(fromInclusive)` y
`endAt(toExclusive)` sobre `sisventas/log_actividad`. El modelo puro
`SVActivityPeriod` calcula desde las 00:00 locales de hoy menos 29 días hasta las
00:00 locales de mañana. Convierte esos dos instantes a ISO UTC para la consulta;
no obtiene el día local cortando un ISO UTC. La ventana queda capturada durante
la operación: un cambio de día no modifica una respuesta ya pendiente.

RTDB incluye el extremo de `endAt`; el modelo elimina después los registros
exactamente iguales al final. El resultado efectivo es
`fromInclusive <= fecha < toExclusive`. Sólo entran fechas ISO UTC canónicas,
con milisegundos y calendario válido. No se reinterpretan ni reescriben fechas
antiguas incompletas, con otro formato o con offset: el aviso indica que se
consultan mediante **Todo el historial**.

Todo el historial hace el GET de la raíz que existía antes y devuelve los datos
sin coerción por el modelo. Conserva exactamente la proyección anterior:
`Object.values`, orden estable descendente por el texto de `fecha` y hasta
300 actividades de presentación, incluidos los casos antiguos. No equivale a
mostrar todas las filas de la base. En ambos modos siguen los filtros de usuario
y acción; los empates, las claves numéricas y los arrays no se sustituyen por un
supuesto orden cronológico de claves Firebase.

## Índice y fallos

El único cambio de reglas preparado para esta consulta es añadir `fecha` a
`.indexOn` en `rules/sisventas/log_actividad`. El constructor offline exige una
base y su hash semántico revisado, un destino separado `.candidate.json` y no
permite sobrescribirlo. Conserva los índices anteriores y todos los demás
objetos; no cambia `.read`, `.write`, `.validate`, permisos, guardas ni datos.
El archivo propuesto no acredita el estado remoto: su aplicación y verificación
deben constar por separado antes de activar la web que lo necesita.

Si falla la consulta acotada, falta su API o falta el índice, se muestra error y
**Reintentar**. No se descarga silenciosamente la raíz como alternativa. Sólo la
acción explícita Todo el historial solicita la raíz completa. Reducir el cuerpo
lógico de una respuesta con historia fuera del período no mide por sí solo la
transferencia facturada ni promete un ahorro fijo.

## Concurrencia, estados y permisos

Se conserva la corrección de v3.14.15: las invocaciones simultáneas del mismo
contexto y período comparten sólo la promesa pendiente. Después de resolver,
Actualizar vuelve a consultar. No hay caché de resultados que acredite frescura,
reloj de actualización ni escucha nueva de datos.

UID, objeto Auth, rol, revisión, época de sesión, vista, perfil, permiso de
Configuración y del dominio, página, panel y primer plano cercan la operación.
Un resultado retirado se descarta antes de decodificar el snapshot. Cambiar de
identidad limpia los filtros; salir y volver con la misma identidad los conserva.
Regresar al primer plano no dispara otra lectura por sí solo.

Carga, error y vacío confirmado son estados distintos. Actualizar indica que
está ocupado; Reintentar es manual. Los mensajes viven fuera de la tabla ancha y
las tarjetas móviles sólo muestran datos confirmados. Todo el historial oculta
también por estilo su botón de acceso redundante, además del atributo `hidden`.

Limpiar conserva permiso, confirmación, escritura y auditoría existentes. Se
cercan los diálogos, los duplicados y el ACK; salir durante la confirmación
impide enviar el borrado. Una escritura SDK ya enviada no puede cancelarse.
No se ejecutó ninguna limpieza real como prueba.

## Evidencia local y límites

- Modelo y constructor: 63 pruebas aprobadas, incluidas zonas Argentina/UTC,
  cambios de horario de verano, fin de mes/año, bisiestos, límites exclusivos,
  350 empates y conservación exacta del modo completo.
- Emulador RTDB local: 7 pruebas efectivamente aprobadas con motor 4.11.2 y SDK
  oficial 10.12.0. Cubren necesidad del índice, equivalencia con el mismo período
  filtrado desde la raíz, formatos antiguos, claves numéricas, arrays dispersos,
  350 empates y denegaciones técnicas/revocadas. Los centinelas ficticios de
  Gastos, CTA, Haberes, comisiones y pagos permanecieron iguales. No se usaron
  Google ni credenciales de producción; el namespace de prueba fue eliminado y
  el emulador quedó detenido, sin conexiones.
- QA visual aislada con fuente, markup, CSS y módulo móvil reales en 320, 390,
  768 y 1280 px: carga, datos, cambio a Todo, regreso a 30 días, fallo, Reintentar
  con teclado y vacío confirmado. Cada guion hizo cinco lecturas ficticias:
  cuatro consultas acotadas y un GET raíz únicamente al elegir Todo. Cero
  escrituras, conexiones externas, errores JavaScript o desbordes. Se revisaron
  visualmente las capturas finales de 320 y 1280 px.

La puerta integrada final de v3.14.16 aprobó 5.292 pruebas, con 27 opt-in omitidas
y cero fallos; 5.319 casos totales. Pasaron la sintaxis de 35 archivos JavaScript
y la validación local oficial. El emulador anterior se ejecutó aparte: no se
confunde una prueba opt-in omitida en la puerta con su ejecución efectiva.

La evidencia privada permanece fuera de Git. El SHA revisado y la comprobación
externa se documentan en CONTEXTO_ACTUAL. Esta mejora cierra el alcance de
Actividad, no la auditoría de todos los listados.
