# Cobertura dirigida: corrección y rendimiento — 22/11/2026

La función continúa OFF. Este incremento corrige el barrido numérico global que rechazaba catálogos grandes aun cuando el alias era único. No activa rutas, cambia versiones o datos, aplica índices ni usa producción.

## Consultas completas con menos lecturas

Un target sin `_` y menor a 120 caracteres solo puede provenir de un string ASCII idéntico al normalizar: se consulta por igualdad. Si el campo es `$key`, se lee el punto exacto y se registra evidencia de ese punto; no se fabrica el resultado/hash de una consulta no ejecutada. El snapshot reutiliza esos mismos puntos dentro de su lectura, sin guardar caché entre fases.

Targets con `_` o truncados a 120 conservan el rango por prefijo completo y acotado. Los posibles números finitos se enumeran invirtiendo los únicos caracteres de String(number) que normalizan a `_`: punto decimal o `+` de exponente. Se acepta un candidato solo si `normalize(number)===target`, y se consulta con igualdad numérica. No hay barrido del bucket numérico. Se mantienen igualdad booleana y bucket acotado de objetos/arrays por campo: un array `[12345]` también puede normalizar al string `12345`. El bucket de objetos nunca se da por cubierto si excede el límite.

En inventario, alias de `$key/codigo/cod/id` conservan esa cobertura completa. `productoKey/productKey` son referencias estrictas al canónico P en el modelo existente, por lo que sus dos consultas son igualdad exacta a P. No se reinterpretan códigos/ids como propietarios. Conflictos en el propietario del registro seleccionado siguen verificados puntualmente; otro inventario propietario de P sigue siendo un fantasma bloqueante.

## Concurrencia y contrato A/D

`office-stock-reference-io.createReferencePhase({queryPage})` crea una capacidad de servidor que memoriza solo consultas exactas `[path,options]` pendientes/resultados de una fase. Cada lectura devuelve una copia. Un pool compartido limita la E/S de referencia a seis solicitudes simultáneas. Los lotes preservan el orden de declaración y drenan todos los trabajos iniciados con allSettled antes de rechazar; no quedan solicitudes posteriores al retorno del error.

Para compartir consultas entre varias filas de una misma operación, A/D crean una fase y la pasan como `ports.referencePhase` al resolver. `loadSnapshot` y el loader propagan esa fase. Los observadores `trackQueryPage` y readSet siguen registrando cada dependencia lógica incluso cuando la consulta usa el resultado compartido. Los readSet se ordenan por clave para que el hash no dependa del orden de respuesta de la red.

Para lanzar una cohorte de filas, A/D pueden usar `mapOrdered` de este módulo: además de la ventana global de E/S, espera la terminación de todas las filas iniciadas antes de devolver un error. El lote exterior también debe drenar sus tareas; drenar solo la consulta local no sustituye esperar otros resolvers que su consumidor haya lanzado en paralelo.

En el check final debe crearse **otra fase nueva** a partir de `queryPageFresh` y pasar `freshPhase.queryPage` como cuarto argumento de `assertFresh`. Esa función también drena/verifica en paralelo con la ventana común. No reutilizar la fase de planificación para el check final ni compartir fases entre operaciones. No hay TTL ni cache global de puntos/ledger: hacerlo ocultaría cambios del overlay. El memo de puntos de loadSnapshot vive solo durante esa lectura individual.

El nuevo módulo IO es transitivo de catalog-coverage, directed-coverage, command y reference-port. El runtime de esta rama no registra estos componentes, por lo que su Docker COPY vigente sigue cerrado. La coordinación debe incluir IO cuando copie esos componentes para la integración central; un test local del cierre antiguo no certifica el paquete nuevo de otra rama.

## Evidencia

171 PASS de once suites del núcleo, guard, store REST, consumidores y procedencia; 2 PASS de la UI real de C en 390/1280; 1 PASS de cierre COPY de Docker, sin build. Incluyen rechazo que drena incluso un valor no Error, límite seis entre fases independientes, deduplicación pendiente, nueva fase tras rechazo/cambio y hashes idénticos con distinto orden de respuesta.

15 PASS adicionales contra Database Emulator v4.11.2 instalado, loopback 9079 y namespace demo aislado con reglas sintéticas. Se acredita un catálogo de 641 productos con ids numéricos, código único; colisiones con 1.5, 1e+21, 1e-7 y decimal negativo largo; arrays/objetos, Unicode, clave numérica y truncamiento. No equivale a emular las reglas candidatas completas de B.

Medición con demora **ficticia fija de 150 ms por lectura/consulta**, sin red ni datos reales:

| Caso | Antes serial | Optimizado | Lecturas / consultas optimizadas | Máximo simultáneo |
| --- | ---: | ---: | ---: | ---: |
| Link preview, fixture de dos alias | 7.207 ms | 2.052 ms | 11 / 24 | 6 |
| Link execute, dos fases completas | 14.700 ms | 4.399 ms | 24 / 48 | 6 |
| Loader, 1 registro con id numérico | — | 2.029 ms | 13 / 42 | 6 |
| Loader, 6 registros distintos/fase común | — | 7.831 ms | 78 / 222 | 6 |
| Loader, 12 registros distintos/fase común | — | 15.460 ms | 156 / 438 | 6 |

Los dos benchmarks son opt-in (`SV_STOCK_REFERENCE_BENCHMARK=1`), no forman parte de la puerta de tests. Estos tiempos describen el loader y comando de vínculo, no una OT completa ni el máximo permitido de producción. D debe repetir 1/6/12 con sus comandos reales, fases nuevas y barreras antes de cerrar el límite de rendimiento. Doce registros distintos siguen siendo costosos; este incremento no autoriza activar sobre esa sola evidencia.
