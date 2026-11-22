# Frente E — Stock de oficina, 22/11/2026

## Fuente y alcance

Worktree exclusivo `.local/audit-20261122-stock`, rama `codex/audit-20261122-stock`, desde060c77f8. La continuidad de esa fuente informa frontendv3.21.2 publicado desde5e4bb83d; este frente no consultó producción. `origin/main`4639a87b se contrastó para estos archivos: su limpieza histórica retira los módulos Stock y no representa la fuente funcional publicada. No se fusionó. No se tocaron raíz atrasada, checkout compartido, versiones/index/SW, CONTEXTO_ACTUAL compartido, OT, recibos, claims, reglas ni empaquetado.

## Correcciones locales

- Confirmar explícitamente la misma cantidad con observación registra un nuevo conteo con anterior=nueva. No cambia general, reservas, costos, operaciones, asignaciones ni registros previos. El mismo ID conserva replay idempotente y la revisión esperada sigue siendo obligatoria. Modelo cliente y servidor corregidos en paralelo.
- Detalle, historial y guardado ahora rechazan productos con eliminado=true. Antes el listado los bloqueaba pero estas rutas sólo comprobaban existencia/servicio. La prueba de guardado usa un doble de scope y comprueba cero actualizaciones; no certifica las reglas remotas ni el backend de recibos.

La prueba anterior que exigía rechazar una cantidad igual se reemplazó explícitamente por la conducta funcional solicitada: registro único, saldos íntegros y replay. Se conservan todos los rechazos de precisión, cantidad inválida, observación vacía, permisos y concurrencia. No es una relajación para esconder un fallo.

## Comportamiento actual comprobado

- Apertura sólo con existencias positivas; la consulta numérica inicia en Number.MIN_VALUE, que es positivo, no negativo. Se investigó una hipótesis de cursor cero/negativo; el ensayo mostró que esa frontera no es alcanzable en la consulta inicial. Se retiró la modificación tentativa del validador y se dejó cobertura de exclusión de negativos/ceros. El intento fallido no representa un bug confirmado.
- Paginación de cantidades numéricas iguales y legado string: sin duplicados, string cero excluido visualmente y positivo string recuperado. Sin lectura de inventarios originales en el listado.
- Orden descendente de cantidades cargadas, alternativas de orden y paginación: pruebas390/768/1280. No se afirma orden descendente global entre páginas; el servidor sigue paginando por general ascendente y la UI ordena lo descargado.
- Alta: selector separado con catálogo/readiness reales del cliente encuentra un producto sin saldo en390/1280, sin escrituras ni red exterior. No se limita a las filas visibles de Stock.
- Compras/ajustes enlazados: recepción explícita y única, referencias incompletas no inventan cantidades; permisos/revocación/cancelación y apertura de compra fuera de memoria cubiertos.
- Unidades: el modelo toma unidad del producto confiable para admitir fracciones (metros y unidades continuas existentes); no confía en la unidad enviada por cliente. Cero y precisión pequeña preservados, unidad discreta rechaza fracción. No se amplió el catálogo de unidades ni se inventó unidad ausente.

## Integrado frente a pendiente

Los componentes anteriores están en la fuente publicada comunicada, salvo las dos correcciones de este commit que son sólo locales. El catálogo público/cliente y el módulo de Stock no incorporan la herramienta anterior «Revisar vínculo», la ficha contextual con dos fuentes de stock, ni la restricción inactivo-sólo-cero del prototipo89515. No se copiaron sus wrappers, activos de aplicación histórica ni referencias a checkouts antiguos.

El listado actual marca revisión ante producto inactivo, servicio, eliminado o no único. Identificar/corregir un vínculo sigue pendiente de un protocolo compatible con Compras/OT/reservas; este frente no mueve ni fusiona inventario ni agrega metadatos ignorados por otros escritores. Una corrección posterior debe preservar exactamente cantidades/costos/ajustesConteo/asignaciones/rendicionesOT/operaciones, validar catálogo/alias/permiso/CAS y reintento, y coordinar contratos con los frentes propietarios. No habilitar el guardado real de reparación sólo con cambios de UI.

## Evidencia y límites

43 casos de dominio PASS,0FAIL,0SKIP en dos tandas no solapadas (38base+5nuevos): modelos, listado API ficticio, procedencia, Roles, host/readiness, controles, UI real y picker compuesto con aplicación activa. Un navegador headless a la vez;390/768/1280 según prueba. Sin ventanas del usuario, sesiones reales, operaciones comerciales, despliegues ni builds. Suite general reservada al coordinador; no se anuncia verde global. No se ejecutó emulador ni transporte HTTP del backend desplegado.

Comando de la tanda38: `node --test --test-concurrency=1 test/office-stock-adjustment.test.cjs test/office-stock-list-audit.test.cjs test/office-stock-provenance.test.cjs test/office-stock-roles.test.cjs test/office-stock-host.test.cjs test/office-stock-controls-native.test.cjs test/office-stock-native.test.cjs test/office-stock-published-picker-composition.test.cjs`.

Tanda5: `node --test --test-concurrency=1 test/office-stock-deleted-product.test.cjs test/office-stock-same-count-native.test.cjs`.

Se usó Playwright existente mediante NODE_PATH del runtime local; sin instalaciones. `node --check` de los tres JS de producto modificados y `git diff --check` forman el cierre. Entrega mediante commit local; no push ni publicación. Siguiente paso del coordinador: revisión del commit, integración selectiva y puerta general centralizada; validar backend de Stock compuesto antes de cualquier corte.
