# B · Candidata SourceCost de recepción vinculada · 22/11/2026

OFF. Base confirmada A b581688e8c8726a5eb2dbe30ebcaf0854cf4247f; hook confirmado ee7e766835dfc1c8713d73ba02d4896a8e46fc17 importado como a163b47c en copia B aislada. No se editó Store/guard compartido, protocolo A ni reglas remotas. Dependencias comunes Activation (dos módulos ya revisados de B) importadas como 2abdee3e; el principal ya las tiene y no debe duplicarlas. Esta entrega funcional agrega únicamente builder/pruebas/informe propios. No toca CONTEXTO_ACTUAL.

## Protocolo revisado

purchase-source-cost-protocol sanea todo prefijo svPurchaseSourceCost, reserva Version0 y emite Version1 únicamente cuando Policy.getSourceAuthority inspecciona WeakMap real vinculado a actor/lease/solicitud/rol/revisión/digest y al parche sellado completo, kind receive, saleWritten y saleKey. RAW sin sello, otras operaciones, objeto serializado, actor/lease o parche alterados no emiten autoridad. Sin IO adicional.

Las pruebas B construyen Linked.build, Policy.issue/begin, planes Operational y Policy.sealDerived reales; Policy.validate verifica originales y permisos antes de enviar la fixture al emulador. No se inventa un objeto sourceAuthority para emitir claims. El actor administrativo tiene Órdenes y Productos, sin Venta/Detalle ni ventas.corregirCosto. La emisión del protocolo no reemplaza assertAdmission ni revalidación de la cohorte del comando.

## Regla propuesta

scripts/lib/purchase-source-cost-rules.cjs agrega una alternativa exclusivamente en la hoja existente sisventas/ventas/$venta/.write. No agrega ni modifica grant en ventas padre, validadores anteriores u otros dominios. Rechaza wildcard ambiguo, representación desconocida o doble composición. Recuperar la única expresión original devuelve exactamente por hash la base completa EA, sin copiar sus bytes a Git/informe.

La alternativa exige servicio schema2 bajo fence/lease/receipt propios, actor user actual, acción ordenes.editar, perfil activo/rol/revisión y permiso de Órdenes vigente (incluido bloqueo normalizado 0..63), reset/version, cohorte común mediante Activation.predicate y kind receive. Limita saleKey a la hoja; OrderKey debe existir y mantener ventaFbKey igual a esa venta tanto en original como en nuevo estado. Exige escribir la orden con inventarioCompra revision+1 y lastOperation propia, y registrar recepción nueva en la venta. Conserva por igualdad escalar totales públicos, totalPagado/estadoPago, autoría, responsable, fecha y referencias/indicadores de comisión enumerados en protectedScalars. No requiere habilitar detalle/ventas.corregirCosto ni lo habilita.

Las claves de orden mantienen compatibilidad con el modelo de A (hasta768, sin separadores de RTDB ni nombres de prototipo). Las claves persistidas ya están sujetas al límite de bytes y caracteres de RTDB y a Inventory.key del servidor. Caso con Unicode/espacios se verifica. La variante de regex con rangos hex de control rechazó también claves válidas en el emulador (24/26: sólo positivos fallaron); se retiró ese rango redundante, sin relajar los separadores/prototipos ni la existencia/FK. No se instala un índice o espejo nuevo.

## Qué NO garantiza RTDB

- No calcula SHA256 del parche, originales o permisos. Los tres hashes del protocolo se comprueban sólo por forma64hex. Un caso explícito del emulador sustituye esos tres hashes por otros64hex y se acepta; es la prueba del límite, no una validación criptográfica de contenido.
- No verifica WeakMap, identidad de objetos, sello backend o firma Ed25519. Cliente SDK no obtiene svLaborService/claims reservadas válidas. El store debe sanear/version0 por defecto e inyectar claims sólo desde el protocolo real después de validar el sello y la cohorte.
- No prueba igualdad profunda de objetos/arrays ni que cada costo nuevo sea el resultado canónico. Precio/cantidad por renglón, pagos, comisiones, campos desconocidos e históricos requieren el plan exacto sellado y sale-cost-correction.validateChangedCosts. Nunca declarar que estos hashes o un flag de body lo sustituyen.
- Una concesión existente en un padre sigue heredándose: esta candidata la preserva, no pretende revocarla desde la hoja. La alternativa nueva no amplía edición manual. Los permisos comerciales originales y los validadores existentes siguen siendo necesarios.

## Evidencia y estado de integración

Antes del hook ee7, copia A aislada:25 pruebas=14PASS11FAIL por guard aún sin sellado/lease; no se atribuyó el fallo a RTDB ni se alteraron expectativas. Tras incorporar el hook confirmado:28/28 focales PASS (reglas, protocolo, política y comando vinculado), sin editar SharedGuard. Se conservan ambos logs privados.

Emulador con copia privada completa EA (SHA256 ea197750dc668aedffc5e182dd6a6e7fd6e939279690cf4a8077ac4cd975f3db), no una política mínima sintética.26/26 PASS antes de añadir compatibilidad de clave amplia; nueva matriz final27:27/27 PASS, emulador propio limpiado y detenido. Incluye PATCH completo de compra sellada (orden/inventario/resúmenes/venta/receipt/guard), vínculo/venta ajenos, kind/version/hashes malformados, rol/revisión/acción/cohorte/reset revocados, omisión de orden, venta extra y rechazo de cambios protegidos. La firma de fixture es real Ed25519 y usa digest de candidata y pins ficticios; no representa la cohorte final de producción. No hay usuario/venta real.

Pendientes del principal: composición con SourceCost sanitize/version0/claims del store, OrderWriter strip y sello base correcto, cohorte final, reglas combinadas de SDK cut y matriz real de comando+guard+store+RTDB/replay/ACK. Los tests unitarios del comando con hook y los tests de reglas con plan sellado son evidencias complementarias, no se afirma la integración completa de transporte actual. No publicar ni activar por este bloque.
