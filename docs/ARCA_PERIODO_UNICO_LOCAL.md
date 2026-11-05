# ARCA: período único, preparación local

Base: `05be68ac4cbc92feb0318b849449d80bb4a48a9e`. Copia aislada
`arca-periodo-unico-local`; no se cambió el servidor 8765 ni la sesión real.

## Problema confirmado

Recibidas y Emitidas conservaban selecciones distintas. Las tarjetas de
compensación seguían la solapa y tomaban el otro mes como alternativa cuando
la selección propia era `null`, valor usado también para Todos. Los cargadores
seleccionaban el último mes disponible, no necesariamente el mes calendario.
Una fuente sin respuesta podía participar como arreglo vacío en el cálculo.

La inspección real anterior sólo constató noviembre en Recibidas y octubre como
último mes del listado de Emitidas. No certifica que no haya emitidas en ARCA.
Esta preparación no importa, emite, concilia ni repara comprobantes reales.

## Cambio de interfaz y estado

- Selector único sobre las tarjetas: mes calendario por defecto, incluso vacío.
- Selección histórica explícita y Todos se conservan al llegar snapshots y al
  cambiar de solapa. El mes automático avanza por eventos existentes, sin reloj.
- Ambas fuentes deben estar recibidas y autorizadas antes de mostrar la
  compensación. Pendiente/error/permisos no se presentan como cero confirmado.
- El mes vacío dice **Sin comprobantes cargados**; no significa ausencia en ARCA.
- Se conservan aritmética, signos de notas, importes y originales. Se reconocen
  ISO y fechas históricas `DD/MM/YYYY` o `DD-MM-YYYY` sólo para seleccionar el
  período, sin reescribir fechas ni adivinar fechas inválidas.
- Se retiran datos al cambiar sesión/rol y se descartan callbacks anteriores.
  El selector no agrega consultas: utiliza los dos lectores fiscales existentes.
- La eliminación administrativa sigue disponible con sus permisos y
  confirmaciones, separada de la selección de mes; no se ejecutó en estas pruebas.

## Evidencia y límites

Pruebas de las funciones activas antes del cambio: la primera ejecución tuvo
1 PASS/6 FAIL. El caso de cambio de solapa se reforzó para que ambas fuentes
tuvieran dos meses: la reproducción congelada sobre la fuente base tiene
7 FAIL/0 PASS. Con la corrección: 9/9 PASS, más 4/4 recorridos nativos en
1280 y 390 px y ambos órdenes de llegada. Se inspeccionaron capturas oscuras.

Los fallos del montaje se distinguen del producto: primero faltaba incluir el
normalizador real de identidad; además había campos fiscales ficticios
incompletos y lectura antes del pintado de `content-visibility:auto`. El montaje
final incorpora el normalizador real, valores ficticios completos y espera el
pintado antes de comprobar texto, sin retirar expectativas de período o saldo.
Las pruebas nativas verifican cero comandos y cero pedidos externos.

Evidencia privada: `tmp/arca-period-local/red.private.log`,
`green-model.private.log`, `native-final2/` y `gate.private.log`.
Suite vigente completa: 9543 casos, 9510 PASS, 31 SKIP y 2 FAIL (exit1).
Los dos fallos fueron montajes de dashboard-loading-scope y domain-read-policy
que extraían cargadores sin factPuedeLeer. Se cargó la función real y estado
ficticio, aislando sólo el render fuera de alcance. Antes se corrigió de igual
modo collection-subscription-lifecycle, conservando 8/16 escuchas. Tras los
ajustes, los cuatro archivos focales pasan 30/30. No se afirma gate global verde
tras esos últimos cambios de montaje: integración debe repetirlo. Los 31 opt-in
omitidos no fueron ejecutados por este bloque. Capturas finales inspeccionadas
en gate-final-screens/ (390/1280). Sin cambios de producto durante estas repeticiones.
No equivale a emisión fiscal real, certificación del contenido de ARCA ni prueba
de todos los permisos remotos. Integración, versión de entrega y publicación
quedan a cargo del propietario del paquete; no activar la candidata ON.

## Puerta final sobre fuente congelada

Tercera ejecución completa: exit0, 9543 casos, 9512 PASS, 0 FAIL, 31 SKIP.
Log privado gate-complete.private.log. Los dos intentos exit1 permanecen
conservados y documentados arriba; no se reinterpretan como aprobados.
La puerta final incluye los tres montajes corregidos. Los31 opt-in no fueron
ejecutados por este bloque. No se cambió código de producto durante las
repeticiones. Integración aún debe probar su paquete combinado y versionarlo.
