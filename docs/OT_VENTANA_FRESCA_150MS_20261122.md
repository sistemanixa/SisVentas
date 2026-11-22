# OT: ventana acotada de lecturas frescas

Segundo parche de latencia, hijo de `652f3c7ccbed2aec56b5ccb5929d387e3d8123b9`, aislado del WIP de vínculos. El coordinador informó metadata de tres POST `/ot/ciclo` HTTP200 de la revisión actual: mediana 10.668,378 ms y máximo 11.196,541 ms. Esa evidencia no fue producida mediante operaciones de prueba de este frente. El ahorro anterior de cuatro lecturas no cerraba esa demora.

## Cambio

Las cinco lecturas independientes de activación se solicitan juntas. En precommit se conserva primero la validación fresca de perfil/permisos. Sólo después se programan configuraciones, originales, inventario autenticado y consultas de pertenencia en una ventana común de seis solicitudes. Una cobertura lenta no impide leer otro original independiente. Todas las fuentes se vuelven a leer: no se reutiliza planificación en esta fase.

Se esperan todos los resultados, incluidos rechazos, antes de abandonar la fase. Una lectura fallida no deja comprobaciones ejecutándose después de abortar la guarda. Las verificaciones de igualdad, autorización, revisión, inventario, cobertura y catálogo permanecen. No se modifica el guard, store, claims, recibos genéricos, conexiones, TTL, keepalive ni datos.

## Medición con IO ficticio de 150 ms

Se compiló el `ot-lifecycle.js` anterior extraído de Git `652f3c7c`, conservando sus dependencias y el mismo fixture/runtime. Se alternaron tres pares antes/después con el mismo conjunto ficticio de cuatro materiales y 138 resúmenes ajenos. El helper permite inyectar el módulo previo sólo en pruebas; no modifica el código anterior ni el runtime de producto.

| Par | Antes, ms | Después, ms |
| --- | ---: | ---: |
| 1 | 4861 | 4290 |
| 2 | 4725 | 4247 |
| 3 | 4752 | 4261 |
| Mediana | 4752 | 4261 |

Reducción sintética de mediana: 491 ms, aproximadamente 10,3%. En todos los casos: 79 solicitudes, concurrencia máxima seis y un commit. Los requests frescos de precommit y validación independiente no se retiraron. El primer parche había reducido 83 a 79; este segundo reduce serialización, no el número de comprobaciones.

No es medición productiva ni demuestra resueltos los aproximadamente 10,7 segundos observados. Los tiempos dependen del doble, temporizador y host; no proyectar esa proporción sobre Cloud Run.

## Pruebas y límites

Regresión inicial de solapamiento: 7 PASS/1 FAIL. Después: 123 PASS/0 FAIL/0 SKIP en rendimiento, ciclo, precommit, compatibilidad y documentos. Además de los negativos previos: cobertura lenta no bloquea originales independientes, revocación de permisos detiene la fase antes de originales privados, y un fallo drena las lecturas pendientes sin commit. Sintaxis/diff correctos. No se ejecutó otra suite general.

Evidencia privada en `C:/SisVentas/.local/audit-20261122-ot-latency/tmp/audit-front-d/`:

| Archivo | SHA-256 |
| --- | --- |
| ot-window-red.log | cd38ea2effeeed0ec3dd18d90e2bffa18d0f90097b5a24c9143d90911fd0f1d2 |
| ot-window-final-green.log | fc6e54592c7c62eb504553297c414d1e9dad5622b01454463129d640091e9471 |
| ot-window-150-final.json | 4aa10bc0fe9d97a06625db0fefc06dc99e569236d60f29a976dc54695ff0f58a |

La traza conserva solicitudes por path, query, actor de lectura, fase y duración ficticia. El siguiente punto de revisión es la validación independiente de commit: parte de su secuencia está en `labor-rtdb-store`, propiedad de otro frente. No se editaron esas autorizaciones para acelerar. Cualquier ampliación debe coordinarse y conservar autenticación actual y lecturas frescas.

Sin operaciones reales, navegador humano, builds, reglas, permisos, instalaciones, publicación ni push. Consumidores de vínculos permanecen en otro worktree, sin habilitación.
