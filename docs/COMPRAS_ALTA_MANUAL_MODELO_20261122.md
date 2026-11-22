# Modelo puro de alta manual — 22/11/2026

Base: 7fe2c12063470e17d8146082fba20919554649f7. Propuesta local, sin ruta, permisos, activación ni publicación. Sólo orden manual independiente con inventarios físicos existentes verificados. No es alta manual completa: crear el primer inventario sigue pendiente del contrato de ausencia/alias de A/E. No se pide un conteo ficticio como sustituto.

`require('../cotizador/purchase-manual-create-model').plan(input)` devuelve `{patch,preconditions,result}`. El resultado es un plan, NO una confirmación de persistencia; `result` sólo puede publicarse tras commit confirmado por el guard. No escribe ni consulta servicios.

## Contrato de entrada

- `body`: declaración del operador con allowlist estricta `{providerKey,currency,date,items:[{productKey,quantity,unitCost,publicPrice}]}`. ARS/USD; fecha comercial ISO válida; cantidades positivas, enteras para unidades; costos y PVP numéricos finitos no negativos. No acepta creador, número, identificador, estado, descuentos, venta/lista, recepción ni patch. PVP y costo acordados son obligatorios explícitos: no toma un precio actual ni inventa cero por omisión.
- `context`: exclusivamente servidor autenticado `{orderKey,numero,id,at,actor:{uid,name}}`. El caller reserva/genera número, clave e identificador fuera del body, dentro del contrato de concurrencia existente. Este modelo no implementa allocator ni permiso ni prueba unicidad global de número: el servidor debe hacerlo. La clave de orden tiene precondición null.
- `originalOrder`: lectura autoritativa del destino, exactamente null. Ausente/undefined o documento existente rechazan.
- `operationReceipt`: lectura autoritativa del recibo de operación, exactamente null. Recibo pendiente/confirmado/ausente rechaza; recuperación y replay pertenecen al guard. El caller debe vincular y revalidar ese recibo bajo lease, no permitir otra id para el mismo intento perdido.
- `products`: mapa por productKey de originales completos con fbKey coincidente, activo=true, codigo/nombre/unidad; imagen opcional. El caller debe autorizar el catálogo y aplicar la clasificación canónica de material comprable (incluida exclusión de mano de obra); el rechazo local `esManoDeObra` es defensa adicional, no reemplaza esa clasificación.
- `provider`: original completo con fbKey coincidente, activo=true y nombre. No resuelve nombres, códigos ni coincidencias aproximadas.
- `references`: triples productKey/inventoryKey/receiptIdentityKey autoritativamente resueltas por servidor para cada producto. No acepta prueba de vínculo ni boolean desde body. El modelo verifica forma, pertenencia y colisión entre productos; NO demuestra que el vínculo sea correcto/fresco. El verificador de A/E debe comprobar catálogo, mapping, alias físico, identidad histórica, permisos y cohorte bajo guard y revalidarlos inmediatamente antes del commit.
- `inventories`: originales físicos presentes por inventoryKey. Omisión/null rechazan. Jamás crea P cuando referencia señala J. Hasta contrato canónico de ausencia acreditada no inicializa ningún inventario, aunque existe inicializador legacy en purchase-orders.js:983.

## Plan y preservación

Reutiliza `purchase-inventory-model.planPendingOrder(register)`; múltiples renglones del mismo producto acumulan una sola operación física. Orden e inventarios se devuelven juntos. `preconditions` contiene orden=null y cada inventario original completo; el caller debe comprobarlos y sumar las dependencias autoritativas de catálogo/proveedor/referencia/recibo al protocolo de frescura de su guard. Estos checks no se sustituyen por una comparación aislada de la salida.

Conserva inventario completo salvo `enCompra` y operación id→at; no cambia general, reservas, consumo ni costo de referencia. La orden conserva snapshots acordados `costoUnitario`, `costoUnitarioPresupuestado`, `precioPublico`, proveedor y datos del producto; autoría y timestamp salen del servidor. Usa dinero/cantidades canónicos sin redondeo visual USD ni conversión de moneda. Subtotal y total siguen el cálculo raw vigente del plan de Compras: no introduce una nueva regla de redondeo.

Marcador compatible con plan vigente: `inventarioCompra={schema:1,registered:true,revision:1,lastOperation:id,references:{indice:{productKey,inventoryKey,receiptIdentityKey,operationId:id}}}`. La orden no almacena fbKey: esa identidad la proporciona el path. No recibe materiales ni toca venta, lista, pagos, descuentos o comisiones.

## Validación local

37 pruebas propias PASS y22regresiones del comando vigente PASS (59totales): ARS/USD con centavos, precisión acordada adicional, cantidades mixtas, líneas repetidas, P→J, preservación completa de inventario, autoría/contador del servidor, null/missing originales, alias ambiguo, recibo pendiente/confirmado, operación ya aplicada, límites numéricos y ausencia de mutación. Sintaxis y diff se verifican al entregar. Sin suite general, navegador, credenciales, red ni datos reales.
