# Mi cuenta: una escucha por empleado y contexto

## Candidata v3.14.11, sin publicar

El titular autorizó por coordinación con «Abrir SisVentas en ventana nueva»
corregir las escuchas de Cuenta del empleado y dejar la actualización lista para
publicar, conservando pagos, permisos, comisiones e historial. La implementación
comparte candidata11 con los avisos compactos pedidos directamente en este chat.
Producción conserva10. No hay cambios de servidor, reglas, índices ni datos reales.

## Cambio de lectura

`cargarCtaEmp` conserva una sola suscripción `ctaemp/<empleado>` por contexto.
Los inicializadores existentes de 250/300/360 ms se unen a esa lectura cuando
corresponde; una entrada posterior, salida o cambio de contexto invalida sus
callbacks diferidos. Las entregas de Gastos recomponen la vista con el último
snapshot CTA autorizado, sin cancelar y crear otra escucha CTA.

El contexto verifica Auth real, UID, rol/revisión, época de sesión, vista/perfil,
vínculo propio, permiso de gestión, empleado, ruta y contenedores vigentes.
Salir del módulo, limpiar selección, terminar sesión o cambiar rol retira la
lectura CTA. Una entrega oculta conserva sólo el snapshot del contexto y no pinta;
la restauración de primer plano repinta memoria. La conexión de RTDB continúa
bajo el mecanismo foreground existente, sin otro productor por reloj.

Gastos incorpora evidencia de la entrega ya existente: origen real, alcance
global o propio, contexto de vista/vínculo y referencia exacta de sus datos.
Los flags globales de carga no bastan para afirmar que la cuenta está completa.
Una fuente inválida o ajena deja los importes desconocidos; no equivale a cero.
La presentación retira KPI, pagos, comisiones y aviso de adelanto anteriores,
incluidas sus acciones. Los controles de filtro conservan su intención.

La recuperación de CTA fallida es explícita. «Actualizar gastos» tampoco crea
otra escucha CTA: revalida una fuente compartida global vigente sin sustituirla,
o retira y reinicia el productor normal cuando el alcance ya no sirve. No hay
reintento automático. Una fuente propia no se reutiliza como colección global
al regresar a Administrador; los callbacks retirados no pisan una fuente nueva.

## Conservación financiera

La proyección es el cuerpo del callback10 extraído sin cambiar sus reglas. Los
35 helpers revisados de cálculos, pagos, compensaciones y comisiones conservan
la versión10. El prefijo financiero de finance-details conserva sus bytes; sólo
su callback de entrada CTA tiene el fence adicional de contexto.

No se recorta historia, modifica orden, redondea, inventa pagos, cambia el
deduplicador legacy ni usa memoria de presentación como autorización para
guardar. El GET propio de horas de Inicio y sus validaciones siguen iguales.
Los comandos financieros, CAS, migraciones y generación de comisiones no cambian.

## Evidencia y límites

- 38 pruebas nuevas del controlador y 25 de fixtures existentes adaptados:
  63 PASS. Usan productores y callbacks reales sobre SDK/DOM ficticios; la paridad
  rica exige estado ready, sin llamar directamente a la proyección como rescate.
- Paridad10/11 de registros, orden, HTML, KPI, pagos y filtros con sueldos,
  adelantos/compensaciones, SAC histórico, bonificaciones de mes futuro,
  comisiones, pagos parciales/anulados, colisiones legacy, claves numéricas e IEEE.
  Ambos órdenes CTA/Gastos y las entradas diferidas quedan cubiertos.
- En el mismo guion propio de dos queries de Gastos, tres actualizaciones generan
  seis entregas: los registros de escucha CTA pasan de 7 a 1. La doble entrada
  inicial pasa de 2 a 1. Son invocaciones del cliente, no solicitudes físicas,
  bytes, segundos facturables ni ahorro monetario medido. No agrega servicios
  ni gastos fijos, pero las lecturas legítimas conservan su costo variable.
- La puerta vigente final pasó 4.919 pruebas, con 27 opt-in omitidas y cero
  fallos; 4.946 casos totales, 40,84 s. Las puertas anteriores conservadas fueron
  previas al caso de alcance all/own y a completar el retiro del aviso de adelanto;
  no sustituyen la corrida final. Sintaxis, diff y coherencia local11 aprobados.
- La QA de navegador de esta tanda corresponde a los avisos compactos con datos
  ficticios en 320/390/768/1280. No hubo guardados ni operaciones financieras
  productivas; el controlador CTA tiene la cobertura aislada descrita arriba.

Los snapshots SDK no acreditan frescura de servidor ni CAS financiero. Reemplazar
Auth por otro objeto del mismo UID sin emitir evento invalida al siguiente
callback/comprobación, no instantáneamente. Entregas idénticas todavía reconstruyen
HTML, aunque no recrean la escucha; ese trabajo de presentación queda como
pendiente separado. La lectura propia conserva toda la historia del seleccionado
y la lectura administrativa de Gastos no se acota en esta tanda.

Evidencia privada en `tmp/listings-next-private/compact11-final` y
`tmp/listings-next-private/cta-visible-followup10`, fuera de Git. Publicar requiere
la autorización posterior y el procedimiento de Hosting/activos/aviso.
