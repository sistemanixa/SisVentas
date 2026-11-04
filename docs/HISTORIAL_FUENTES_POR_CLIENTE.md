# Historial: fuentes por cliente y domicilio

## Estado

Preparación local durante la auditoría del 03/11/2026. Está conectada condicionalmente al guard/runtime y al paquete del servidor; no está conectada a la pantalla, al adaptador de escrituras del navegador ni a reglas remotas. No se creó
`sv_client_history_config` en producción. El Historial publicado todavía usa
sus fuentes anteriores; este documento no acredita una reducción productiva.

## Componentes preparados

- `cotizador/client-history-model.js` exige las siete fuentes explícitas:
  ventas, pagos, presupuestos, OT, reclamos, tickets y equipos. Una fuente
  omitida no equivale a una fuente vacía. Emplea la identidad compartida y la
  contribución financiera canónica de Cuenta corriente; no recalcula costos.
- `cotizador/client-history-delta.js` recibe imágenes anterior/posterior
  verificadas y devuelve únicamente un parche técnico. No es una API ni lee o
  escribe originales. Revisa fuente, cobertura, revisión y membresías antes de
  actualizar páginas, totales, domicilios y límites de página juntos. Cambiar
  la identidad de una venta exige actualizar todos sus vínculos en ese commit.
- `js/core/client-history-reader.v1.js` solicita sólo una solapa, cliente y
  domicilio, en páginas de 50. Comprueba los extremos de página contra el
  manifiesto completo; conserva totales completos aunque sólo muestre 50.
  Rechaza respuestas mixtas, cobertura incompleta y números no enteros.

Las coberturas financieras y los contadores sin vínculo se separan por ámbito
propio/administrador. Una solapa operativa no recibe los metadatos comerciales
de otra solapa. Las audiencias técnicas todavía requieren integración; el lector
las rechaza explícitamente antes de consultar, en lugar de presentar cero.

Los registros antiguos ambiguos se conservan sin asociarlos por nombre. Los
equipos y tickets embebidos se conservan con índice/token; sólo un vínculo
técnico explícito a su registro global evita contarlo dos veces. Los importes de presupuesto usan sólo valores guardados (incluidos sus alias y cero explícito). Si falta el importe, se conserva un indicador de monto desconocido y el total se informa incompleto, incluso cuando la fila faltante queda fuera de las primeras 50; no se reconstruye con productos o precios actuales. Las páginas
excluyen productos, costos, credenciales, fotos y documentos. Los originales no
se transforman ni se reescriben al preparar estos resúmenes.

## Evidencia local

33 casos de modelo, delta y lector aprobados con datos ficticios. Incluyen
121 registros, eliminación de 21 al cruzar el límite de página, saldo exacto,
anulados/sobrepagos, fuentes omitidas, domicilios unificados explícitamente,
homónimos, referencias técnicas contradictorias, embebidos/globales, regreso
con cursor obsoleto, revocación/sesión/oculto/offline, importe inválido y
metadatos financieros restringidos al propietario. Las actualizaciones
técnicas se aplican sólo a un árbol en memoria; nunca a Firebase real.

No confundir esto con una prueba del formulario completo, reglas de seguridad
remotas, escritura del servidor o preparación de todas las audiencias.

## Dependencias antes de activar

1. Conectar la proyección al guard compartido y verificar cada escritor de las
   siete fuentes, incluidos embebidos y clientes/unificaciones. Todos los
   vínculos deben actualizarse en la misma operación; no por un reloj.
2. Derivar y probar las audiencias operativas del permiso y asignación reales.
   No ampliar el acceso a una venta por poder consultar una OT o cobrar.
3. Preparar reglas e índices emparejados contra el estado remoto, con matriz de
   emulador por roles, ámbitos, consultas limitadas, revocación y concurrencia.
   Ningún permiso de lectura de una solapa debe abrir el padre completo.
4. Integrar la pantalla y sus acciones puntuales, timeline, filtros y retornos
   con `SVDataReadiness`. No entregar un resumen como registro editable ni
   alimentar conciliadores completos con una página de 50.
5. Construir una candidata integral, contrastar la cobertura, recorrer el
   circuito nativo ficticio y comprobar el estado publicado antes de activarlo.

El alta de un usuario sin movimientos sigue siendo una dependencia aparte de
Cuenta corriente: una cobertura ausente no se convierte en cero. Debe verificarse
la política de responsables históricos y la creación de su ámbito completo.

Los pagos embebidos sólo se incorporan cuando no hay cobros globales autoritativos, incluidos los anulados. Sus dependencias quedan privadas y el delta exige retirar los miembros embebidos al aparecer el cobro global. El permiso de comisiones por sí solo no habilita las solapas financieras.33 casos de modelo/delta/lector aprobados con datos ficticios; sin integración productiva.

## Escritores coordinados preparados

client-history-projections mantiene las siete fuentes mediante componentes de registros vinculados y lecturas puntuales; el constructor de contribuciones usa el mismo formato que la preparación completa, sin emitir cobertura global a partir de un componente. Los importes financieros vienen de las contribuciones canónicas de Cuenta corriente. Dependencias privadas de directorio, claves técnicas, alias comerciales y referencias de equipos permiten refrescar identidades y resolver referencias antes ausentes sin escanear raíces. Los pagos relacionados reutilizan metadata canónica, no sus comprobantes originales. Una OT sin cambios de identidad no descarga originales de otras áreas. Un embebido sustituido por un registro canónico se retira del índice, conservando ambos originales intactos.

Modelo/delta/lector35casos y12escritoresPASS;7regresiones de adaptador incluyen6variantes de escritura bajo la misma política dinámica (set/update/remove/transaction/push/atomic). Se reprodujo un bypass de update y se corrigió también remove/transaction/query: todos usan guard.affects. Total focal54PASS, sin datos reales.3casos RTDB emuladoPASS incluyendo vacío de Historial persistido y actualización posterior. La prueba de paquete autónomoPASS incluye las nuevas dependencias. No confundir estos resultados con una activación productiva.

CLIENT_HISTORY_ENABLED permanece ausente/desactivado; sv_client_history_config no se creó. La futura bandera exige Cuenta corriente y fuentes comerciales coordinadas, configuración writerSchema1 y preparación completa nueva con dependencyManifest1. No activar antes de cerrar las audiencias técnicas reales, reglas emparejadas de lectura/escritura, el adaptador del navegador, pantallas/acciones, usuarios y clientes sin movimientos y todos los escritores de cada dominio. No se permite suministrar raíces técnicas como datos desde el gateway o scope.update.
