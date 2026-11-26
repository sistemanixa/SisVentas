# Una consulta por apertura de Detalle e Historial

Base aislada: `7714ce9bd35fd711fa09f6265d7b2d686ac466e4`, rama `codex/payment-history-qa-20261126`. Publicación de referencia: app19; se usan su índice completo y sus fuentes reales. SDK/Auth/HTTP están sustituidos sólo en la frontera de datos ficticios, mediante el fixture completo existente. No navegador del titular, datos reales, Rules, configuración, app inmutable, index ni servidor modificados.

## Reproducción y medición

En 390 y 1280, la app19 abría con **un SDK GET de `sisventas/ventas/fixture0` y un GET comercial `registro/fixture0?para=pagos`** que volvía a entregar ese original. No eran dos GET comerciales. El test contó ambas lecturas del original y falló correctamente `2 !== 1`; la expectativa no se relajó. La primera medición que contaba sólo HTTP comercial daba 1 y no detectaba esta redundancia; se corrigió la instrumentación para incluir el SDK.

Después del cambio: **0 lecturas SDK del original + 1 GET combinado**, en ambas resoluciones. Permanecen lectura del config, resumen por ID y cobertura antes/después de CommercialPagesReader.detail. Estas dos coberturas son controles de coherencia, no consultas duplicadas eliminables. Preferencias y notificaciones pueden generar lecturas independientes; no se atribuyen al pago.

Antes: ficha inicial con historial pendiente y segundo render al llegar el original fresco. Medición instrumentada: primer render1; fresh5 contando tres repintados manuales de prueba, es decir dos renders naturales. Después: durante la consulta se mantiene «Abriendo venta…», selección null, sin ficha parcial ni «Sin pagos»; primer render1 contiene historial ready. Tres repintados posteriores no vuelven a consultar. El evento concurrente de recuperación sin operación no dispara GET extra. No se certifica aquí el circuito financiero de una recuperación real con escritura.

SVDataReadiness conserva scope propio salePaymentHistory pendiente→ready; se cancelan sólo tokens de esa apertura. No se instala listener global de pagos. El inventario de subscriptions observado conserva clientes/productos/coverage y las fuentes normales de la sesión, con cero subscriptions de sisventas/pagos. No se cambia su ciclo de vida.

## Implementación acotada

- `sale-payment-history.v1.js`: `opening(isCurrentIntent)` hace el GET auténtico, valida DTO y retiene la respuesta en un cierre privado de un uso. Devuelve read(key), commit(validatedRecord), cancel(). No acepta JSON de respuesta externo, flags ready ni cache global. Liga uid/user/auth/db/rol/revisión/epoch/ruta/selección vacía y secuencia del intent. Commit compara el original retenido con los campos del registro ya validado por el reader, y acredita ready sólo para ese objeto en WeakMap. Clones no heredan estado.
- `sales-indexed-host.v1.js`: sólo openSale usa esa lectura combinada como detailRead del reader privado. Tras summary/coverage y hydrate válidos, publica la prueba antes de renderDetalleVenta. App19 encuentra ready y no vuelve a pedir pagos. Cancelación/navegación/revocación/otra apertura descartan la respuesta. No fallback SDK ante error. Error de apertura usa el estado y Volver existentes; reabrir solicita respuesta nueva, sin botones nuevos ni pausas artificiales.
- Las acciones hydrate sin intent —editar, imprimir, asignar y demás— conservan su recorrido previo. No se cambió CommercialPagesReader ni ownership.

## Evidencia y límites

41/41 focales PASS: 35 del helper (incluye respuesta privada de un uso, original modificado, cancelación, permisos/selección/revisión) y 6 de índice/app completa (mediciones390/1280, navegación390, revocación1280, error503+reapertura390, éxito1280). Cero comandos/commits de negocio y originales ficticios preservados. 26/26 regresiones adicionales de apertura nativa, asignación y UI de grilla PASS. Syntax/diff check PASS. No puerta global ni publicación.

Los fixtures de apertura antes detenían SDK; ahora detienen el GET combinado y sirven servicio C real con Auth/SDK ficticios. Se mantienen los asserts de inversión de respuestas, retiro de acciones previas, cambios de DB/permisos/sesión y Volver. El fixture de error del historial ahora reabre desde Volver porque la consulta combinada falla antes de crear la ficha parcial. La lectura visual espera la condición renderizada del importe, no un sleep.

Root debe registrar ambos leafs en los activos de la próxima versión inmutable y verificar su composición/publicación. Esto no acredita una reducción de latencia real del backend: sólo elimina una lectura original redundante en el recorrido medido.

## Follow-up de cuatro rojos de Historial de cliente · c411
Los dos leafs y los dos tests eran byteidénticos a Rootc411843fecca95e8317cf58f20d456004cfc3189. Se reprodujo Bootstrap390: timeout al abrir la venta fuera de las 50 iniciales. Los tests de Historial no instalaban el endpoint combinado en su frontera HTTP ficticia; no se atribuyó automáticamente a contexto de producto. Se agregó únicamente import/install del helper sale-payment-history-http-fixture existente en ambos tests antes de goto, sin modificar fixture compartido ni producto. Los cuatro casos390/1280 pasan; se añadieron aserciones de selección fbKey===outside e historial ready. Se conservan todos los asserts de96000, páginas50/10, generación/revisión, domicilio, timeline, retorno a Historial, revocación, ausencia de lecturas raíz, originales íntegros y cero commits. Reejecución final4/4PASS0fail/skip14.2s, syntax/diff PASS. No suiteglobal repetida ni publicación.
