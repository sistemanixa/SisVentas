# Lectura compartida de Vacaciones

## Alcance de la candidata14

Continuación autorizada después de publicar la3.14.11: corregir consultas
repetidas de los listados sin recortar historia ni modificar pagos, permisos o
comisiones. Trabajo aislado desde el código11; no incorpora las candidatas12/13
ni autoriza su publicación. Ningún dato productivo se usa como prueba.

## Problema reproducido en11

`fbCargarVacaciones` ya mantiene una escucha de la colección autorizada o una
consulta propia por empleado. `renderModuloVacaciones` interpretaba un array
vacío como ausencia de carga y lanzaba otro GET de la colección completa.

En la fixture ficticia: tres entradas mientras la escucha está pendiente más
tres después de un resultado vacío producen seis GET duplicados, además de la
escucha existente. Una respuesta del GET anterior también puede sustituir en
memoria un período entregado posteriormente por la escucha. Las llamadas son
invocaciones del cliente, no una medición de bytes o factura de Google.

## Corrección en preparación

Compartir el estado de la fuente y distinguir pendiente, vacío confirmado y
error. La interfaz debe consumir la lectura autorizada existente, cercada por
identidad, permisos y alcance. Una respuesta anterior no puede limpiar ni
cancelar una fuente posterior. La recuperación tras error es manual.

Se conservan los consumidores de Inicio, Mi cuenta y disponibilidad técnica.
Una disponibilidad desconocida nunca se presenta como ausencia de vacaciones.
Los cálculos y guardados de períodos mantienen su circuito: no cambia la
asignación de días ni reescribe datos de empleados.

## Estado preservado al priorizar el cierre de OT

La fuente quedó congelada en SHA256
`f6059ca69aa48be0d1388f6e5955d2ad5cef22cff3585a43a20a0e3ed36c501b`.
Pasaron68 pruebas focales del implementador, la revisión independiente y7
escenarios comparativos con rutas/renderers reales sobre SDK y DOM ficticios.
Se conservan29 funciones sensibles byteidénticas, el historial2016/2030, claves
numéricas, orden, filtros y KPI. El guion vacío pasa de6GET duplicados a0 y
conserva1escucha; no se deduce de ello latencia o factura productiva.

La puerta final pasó4.943 pruebas,27 opt-in omitidas y0fallos (4.970total,
35,31s). La primera corrida detectó11 fallos del fixture de arranque por faltar
el nuevo cargador en su entorno simulado; se añadió esa dependencia y una prueba
de entrada directa sin quitar las aserciones anteriores. La prueba de vacaciones
personales adapta Auth/dependencias y exige retirar la caché al invalidarse la
sesión, en vez de conservar datos de la persona anterior.

La QA visual NO está cerrada. El primer ejemplo no cargaba el envoltorio real de
tablas/estilo v3; el segundo detectó que su CSP con nonce bloqueaba los handlers
inline del reintento, a diferencia de la CSP de la aplicación. Se debe corregir
el fixture, volver a probar y resolver la presentación del estado/error dentro
de una tabla ancha: en320px el texto y la acción pueden requerir desplazamiento
horizontal. No afirmar que ese aspecto ya quedó pulido ni que la candidata está
lista para publicar. No se alteró la fuente congelada por esos ensayos.

El titular priorizó finalizar la candidata12 de OT/garantías;14 se conserva
separada, sin desplegar ni cambiar el espejo local o la pestaña real. Evidencia
privada: `tmp/listings-next-private/vacaciones-audit11`,
`vacaciones14-independent`, `vacaciones14-ui` y los logs de puerta, fuera de Git.
