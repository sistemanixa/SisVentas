# Transporte comercial pendiente de aislamiento

Estado: auditoría local del 25/10/2026, candidata v3.15.0. **No implementado ni publicado.** Este informe no acredita confidencialidad completa de Ventas, Presupuestos o Cobros. Las pruebas usan únicamente registros ficticios y evaluadores locales; no se consultó producción, SDK, emulador ni servicios externos.

## Qué se demostró

Un vendedor con `ventas.verMargen=false` y `presupuestos.verMargen=false` recibe costos comerciales en sus registros. Estos campos tienen escritores actuales: `items[].costoUnitarioCompra`, `items[].costoTotalCompra`, `costoTotal` y `margenPct` se guardan en `js/app.v3.15.0.js` (bloque de confirmación de venta, líneas observadas 16420–16421 y16470–16471). Presupuestos también puede guardar `items[].costoUnitarioCompra` desde una propuesta de compra (`getPpItems`, líneas observadas57542–57545).

Las mismas salidas conservan un canario artificial `pctOriginal` y `comisionConfiguracion:{pct,gananciaBase}`. Esto demuestra una capacidad del transporte para reenviar campos innecesarios; **no demuestra que esos campos existan en ventas o presupuestos históricos**. No se encontró un escritor actual de `comisionConfiguracion` en esos documentos. El generador actual guarda porcentajes y base en CTA/Gastos/controles; sobre la venta escribe `comisionesGeneradas` y una auditoría neutra (`cotizador/commission-generation.js:71–82`).

Los costos comerciales autorizados y la base de una comisión no son el mismo permiso. Conservar el costeo para quien tenga el permiso correspondiente no autoriza a transportar porcentajes o snapshots de comisión. Si una persona tiene acceso legítimo tanto a costos como a su comisión, no se puede prometer impedir deducciones aritméticas a partir de información autorizada.

## Seis salidas que llegan al cliente

Son seis variantes de respuesta sobre cinco endpoints distintos; las dos últimas comparten ruta.

| Salida | Origen del contenido | Resultado observado |
|---|---|---|
| GET `/comerciales/ventas` | `commercial-ownership.list`, línea108: copia `...r` después de filtrar propiedad | Conserva costos/margen y campos canario |
| POST `/comerciales/ventas/preparar` | `mutate`, línea160: `snapshot.val()` completo | Conserva los mismos campos |
| GET `/comerciales/presupuestos` | El mismo `list` | Conserva los mismos campos si están almacenados |
| POST `/comerciales/presupuestos/preparar` | El mismo `mutate` | Conserva los mismos campos |
| POST `/cobranzas/operacion`, registro/anulación | `payment-commands.js:102,113,115`: `resultados[].venta` con `...sale` | El acuse incluye la ficha completa |
| POST `/cobranzas/operacion`, recuperación | `payment-commands.js:61,69`: hidratación mediante `readAsUser` y `...sale` | La recuperación vuelve a incluir la ficha completa |

`cotizador/index.js` envía esas respuestas sin otro proyector. `commercial-response.js` autentica/serializa/comprime el resultado; no elimina campos. Reasignar también devuelve la ficha completa, pero sólo admite administrador y no se cuenta como fuga a un usuario no administrador.

## Diez lecturas SDK que siguen concedidas

La candidata de reglas conserva las concesiones de las fichas comerciales propias. La autorización del registro completo concede también estos descendientes; un veto en el hijo no podría revocarla:

| Dominio propio | Descendientes verificados |
|---|---|
| `sisventas/ventas/{id}` | `costoTotal`, `items/0/costoUnitarioCompra`, `comisionConfiguracion/pct`, `comisionConfiguracion/gananciaBase`, `pctOriginal` |
| `sisventas/presupuestos/{id}` | Los mismos cinco |

Las diez decisiones se verificaron con un propietario ficticio, permisos de margen explícitamente falsos y las expresiones de la base626817 más el constructor propuesto. Es evaluación de expresiones, no compilación ni despliegue de reglas.

## Consumidores y límites de una corrección

- `js/core/commercial-ownership.js` conserva las respuestas en la suscripción y en `cachedRecords`; `clean` sólo elimina metadatos técnicos. `prepare` entrega al editor tanto la ficha actual como su baseline. `confirmWrite` reemplaza el presupuesto visible con el snapshot confirmado.
- `js/modules/commercial-document-controls.js:5` y `js/core/commission-generation.js:15` preservan costos históricos desde el baseline. Los editores de venta/presupuesto llaman `prepare` antes de construir el guardado. Retirar campos de la respuesta sin cambiar ese protocolo puede perder originales o convertir una proyección en una falsa comparación financiera.
- `js/modules/budget-presentation.js:28` consulta directamente el presupuesto por SDK. Corregir sólo el listado HTTP no cubre esa lectura.
- `cotizador/projects.js:23` proyecta presupuestos por allowlist (identidad, título, total, moneda, estado e ítems comerciales); no conserva los campos de comisión ni costos de compra. No se encontró una fuga adicional allí.
- El HTTP de generación aplica `commission-public-response`; sus respuestas públicas actuales no devuelven base/porcentajes. `sv_commission_generation` no tiene lectura cliente; los índices/recibos financieros son exclusivos del servicio. Los originales CTA/Gastos/configuración y sus companions están cubiertos por el bloque independiente de vistas propuestas, sin que eso cierre el canal comercial descrito aquí.
- Las respuestas fiscales inspeccionadas contienen datos fiscales y de comprobante, no un spread de la venta original. No se modificó el circuito fiscal.

## Contrato propuesto antes de cerrar el pendiente

1. Un único proyector comercial de servidor para listado, preparación, detalle, SDK equivalente, acuses de cobro y recuperación. Los snapshots de comisión se excluyen para todo actor sin autorización financiera. Los costos/márgenes comerciales se incluyen sólo según el permiso real de cada dominio; no se retiran por extensión a quien sí puede costear.
2. El cliente recibe una revisión opaca de la ficha/proyección, nunca el hash del original privado. `responsableRevision` no sustituye esa revisión: sólo versiona la responsabilidad y no todos los cambios comerciales.
3. Los guardados verifican esa revisión y la autorización vigente bajo transacción/fence, leen el original internamente y aplican únicamente diferencias comerciales permitidas. Los campos privados ausentes del DTO se conservan; no se reemplaza el original con la proyección.
4. Los ítems requieren identidad estable y correspondencia inequívoca incluso con líneas duplicadas, reordenamientos o variantes. Se conservan costos originales de los ítems existentes; las altas o cambios explícitos usan su comando y permisos propios. No se recalculan históricos con catálogo actual.
5. Cobros siguen operando sobre originales internos. Su respuesta debe ser mínima o contener la misma proyección autorizada, también al recuperar un acuse perdido. No cambia la imputación ni genera otra comisión por recuperar una respuesta.
6. Las concesiones SDK de originales comerciales deben cerrarse al mismo tiempo que se activa la fuente proyectada y el protocolo de escritura compatible. Mantener un grant al registro completo deja abierto el transporte aunque el HTML o el endpoint HTTP estén saneados.

Pruebas de aceptación necesarias: roles con/sin margen, propietario/asignado/ajeno, administrador/Ver como, metadatos de comisión anidados, edición de descuentos y de ítems duplicados, costos históricos desconocidos, pagos parciales/completos, acuse perdido/recuperación, revocación y ambos órdenes de llegada de fuentes. No usar operaciones reales como prueba.

Evidencia privada local: `tmp/commission-privacy15-rules-proposal/commercial-transport-review.private.json` y su runner. No se versionan esos artefactos ni registros reales. Este documento registra el pendiente y su contrato; no añade un arreglo al contador de cambios terminados.
