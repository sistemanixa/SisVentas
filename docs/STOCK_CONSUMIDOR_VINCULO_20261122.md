# Consumidor Stock del vínculo — 22/11/2026

Stock `detail/history/save` admiten `create({resolver})`, sin imports ni registro de rutas nuevos. Ausencia de resolver o resolver OFF mantiene exactamente el recorrido anterior, su hash, respuesta y presupuesto de lecturas. `list/productFor/positiveRow` no se modifican: pertenecen a C.

`createStockReferenceResolver({enabled:false,queryPage,loadCoverage,assertBarrier})` en reference-port devuelve `{resolve,assertFresh,lookupInventory}`. ON exige el verificador de barrera inyectado, tanto al resolver como al revalidar. No construye una supuesta prueba de reglas a partir de indicadores cliente. La activación y su verificador firmado corresponden a coordinación/B; el módulo permanece sin conectar al runtime.

## Ficha, historial y conteo

El consumidor parte del producto canónico P: consulta primero forward P y resuelve el inventario físico J con el loader dirigido completo. El hash de detalle contiene inventario, las tres identidades, revisión de mapping y readSet de puntos/rangos. El comando cliente conserva solo `productKey=P` y `expectedHash`; rechaza `inventoryKey` suministrado por cliente. La política existente recibe J mediante su capacidad interna y el patch actualiza exclusivamente ese inventario y su proyección normal, auditoría/recibo del conteo y guard.

El check final usa puertos frescos del guard para comparar membresías y reconstruir la referencia completa. Un cambio de mapping, identidad histórica, producto, inventario o permisos descarta el staging. La creación del vínculo conserva exactamente el inventario; un conteo explícito igual al actual crea una sola auditoría y su replay reutiliza el recibo. Respuesta perdida no crea otra rama P ni otro conteo.

Historial consulta ajustesConteo de J. Ficha/historial exponen `reference={productKey,inventoryKey,receiptIdentityKey,mappingRevision,status,mapped}` cuando el resolver está ON. Sin mapping mantiene legacy, pero registra las ausencias puntuales para impedir confirmar después de un alta de vínculo concurrente. Un inverso huérfano nunca se trata como ausencia.

Servicio y eliminado siguen bloqueados; inactivo con mapping no exacto se rechaza. Inactivo exacto admite únicamente cero explícito (`zeroOnly` en ficha), sin reactivar producto ni cambiar reservas, costos o historia existente.

Solo la función `provenance` del adapter fue modificada: usa `history.reference.inventoryKey` para el costo físico y valida la forma/referencia canónica de la respuesta. La compatibilidad con respuesta anterior usa el key de fila previo. No atribuye compras por la identidad de recibo OT ni inventa que una referencia de costo explique todas las unidades.

## Puerto de lista para C (lectura, sin prueba de escritura)

`resolver.lookupInventory(inventoryKey,{read})` devuelve `null` OFF sin lecturas. ON verifica primero barrera/cohorte, lee inverso J, forward P, producto actual P, vuelve a comparar ambos mappings y revalida barrera. Ausencia inversa comprobada devuelve null para legacy; inverso inválido, pair divergente, eliminado, servicio e inactivo se rechazan. Devuelve `{productKey,product,reference}`; no emite cobertura ni readSet de escritura. Tiene cinco lecturas puntuales más las del verificador; no ejecuta consultas de catálogo ni inventario. Una escritura posterior siempre vuelve a realizar cobertura completa.

Esta entrega no modifica la selección de producto de la lista: C integrará este puerto opt-in con su propio permiso y contrato de cohorte. No habilitar vínculos antes de integrar todos los consumidores y barreras.

## Evidencia del incremento

109 PASS en seis suites: consumidor mapeado, procedencia, port genérico, guard, store REST compuesto y cobertura dirigida. Incluyen vínculo→conteo igual con un solo efecto, escritura por J con claim físico verificado en el store real, ACK perdido/replay, servicio/eliminado/inactivo/revocación, ambigüedad legacy, mapeos colgantes, cambio de membresía y denegación del rango fresco. Procedencia sigue J y no atribuye a P una compra histórica distinta. Sintaxis de cuatro módulos y diff check correctos. Datos exclusivamente ficticios; sin cambios de listado, activación, rutas, reglas, cantidades reales, build o publicación. La suite general y composición conjunta con C/A/D siguen a cargo de coordinación.
