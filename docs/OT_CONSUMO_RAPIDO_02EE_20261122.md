# Comando OT completo: consumo rápido 02ee, datos ficticios

Estado: **OFF**. Se compone el núcleo comprometido `02ee4f6d03acbac48b9c431acb28e25e1b222498` mediante exportación Git y SHA-256 fijados. Los consumidores de producción no se modifican en este bloque; cambian únicamente el laboratorio, las fixtures y la documentación. No se publican ni registran rutas o certificados reales.

## Autoridad de prueba y alcance

La fixture usa una clave Ed25519 efímera, sólo en memoria. El manifiesto total incluye el descriptor exacto `Explicit.STOCK_REFERENCES`; su digest coincide con `expectedPins.contractDigest`. Generación, cuatro codePins y digest de reglas son exclusivamente ficticios. Se construyen pares de ocho campos y sus dos recibos de origen preexistentes para ensayar el consumo, no se atribuye aquí una nueva creación de L con el comando Link. La firma acredita coherencia del laboratorio, **no el despliegue ni la validez de una cohorte real**.

Los recibos de entrega de la matriz provienen del modelo físico real. El catálogo contiene 641 productos con IDs numéricos y la OT tiene 1/6/12 filas, más 138 resúmenes de otras OT. OFF y ON operan sobre los mismos originales y recursos; en este benchmark P y J coinciden para permitir esa comparación directa. Los casos funcionales separados verifican tres identidades distintas.

La fase de planificación, el control fresco y el protocolo de commit tienen lectores independientes. Reloj real, lease original de 30 segundos, demora ficticia efectiva de 150 ms por IO y límite observado de seis. No se renovó ni amplió el plazo. Una muestra por celda; no es una medición productiva ni una distribución estadística.

## Matriz terminada, sin repetir las nueve celdas

| Materiales | OFF: ms / solicitudes | ON sin vínculo: ms / solicitudes | ON vinculado: ms / solicitudes |
|---|---:|---:|---:|
| 1 | 4229 / 45 | 6800 / 70 | 6365 / 70 |
| 6 | 4476 / 75 | 8160 / 205 | 8303 / 205 |
| 12 | 5404 / 111 | 12532 / 367 | 12617 / 367 |

Las nueve celdas completaron un commit ficticio y terminaron con lease vigente. Máximo seis IO en los escenarios ON. Se ejecutó primero la matriz 0 ms para descartar errores funcionales; sus tiempos no se presentan como latencia de red.

Doce vinculados bajan de 44061 ms/1534 solicitudes del núcleo intermedio 1c18 a 12617/367 con 02ee. El caso anterior había excedido el lease y no era PASS. El costo sigue siendo mayor que OFF (5404/111), de modo que **no se declara resuelta la demora productiva ni se autoriza activar**.

JSON privado `tmp/audit-front-d/ot-reference-core02ee-fast-641-150.json`, SHA-256 `0a623a1318a8b9dfbbd77b0aa4f713d112c2c12ab835b8cc6ab8fcd9b93f13d0`. Incluye tiempos por fase, paths, queries y huellas de los fuentes; log adyacente del mismo nombre. No se guardan claves de firma ni registros comerciales en Git.

## Desglose de las 367 solicitudes y siguiente optimización posible

| Fase | Solicitudes | Productos | Vínculos/recibos de dominio | Inventarios | Activación | Recibos genéricos |
|---|---:|---:|---:|---:|---:|---:|
| Planificación | 120 | 12 | 60 | 24 | 1 | 12 |
| Fresco | 122 | 12 | 60 | 24 | 1 | 12 |
| Commit | 113 | 12 | 60 | 24 | 1 | 12 |

Las otras doce solicitudes corresponden a preflight 8, guard 2, validación 1 y lectura posterior 1. Dentro de cada fase hay **cero paths duplicados** al distinguir path, consulta y lectura autenticada. La activación se lee una vez por fase; otro memo de puntos no reduce esas solicitudes.

Por fase, los 60 accesos de vínculos son forward P (12), inverse P (12), forward código (12), inverse código (12) y recibo de dominio (12). Los 24 inventarios son P (12) y código (12). La clasificación histórica del consumidor todavía consulta alias de código: hasta 36 dependencias extra por fase. Suprimirlas sólo es admisible bajo un contrato explícito de servidor reconocido por el núcleo y la cohorte firmada, con historia por fila y original verificables; no introducir un booleano cliente ni reutilizar planificación al revalidar. No se ejecutó un nuevo experimento ni se eliminó esa evidencia como atajo.

## Validación y límites pendientes

18 archivos de dominio: **267 PASS, cero fallos/omisiones/cancelaciones**. Log privado `ot-core02ee-fast-domain.log`. Composición explícita: 22 PASS, incluidos entrega/consumo/conteo con tres identidades, replay, revocación de firma/recibo, propietario contrario y rechazo de J huérfano sin crear P sombra. Sintaxis y diff correctos antes del commit.

El primer intento de composición rápida rechazó correctamente una OT hermana ficticia sin historia cuyo producto antiguo no coincidía con P. Se corrigió la construcción del escenario nuevo, usando el canónico en esa fila sin recibos; no se relajó el núcleo ni se reescribió historia real. Los originales históricos con recibos mantienen su identidad.

La expiración remota se valida como bloque separado contra la copia exacta de reglas y el overlay coordinado; una fixture REST permisiva no basta. El primer intento de emulador estuvo bloqueado por permisos de loopback. El reintento permitió comprobar rechazos, pero la prueba positiva inicial omitía el recibo atómico requerido y fue rechazada: ese antecedente **no es una acreditación de expiración**. No se cambia el predicado para obtener verde. La fixture del emulador permanece fuera de este commit hasta completar su positivo y el rechazo en tránsito con el mismo cuerpo/override y lease real.

No se tocaron guard/Store, código compartido de reglas, datos reales, navegador del usuario, versión, índice, SW ni despliegues. El estado central y su CONTEXTO los mantiene el integrador. Conservar ON desactivado hasta cerrar permisos, expiración, empaquetado y el costo pendiente.
