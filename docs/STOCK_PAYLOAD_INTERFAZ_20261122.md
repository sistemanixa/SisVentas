# Payload cerrado e interfaz mínima para repartir consumidores

## Paquete local, sin build

Dockerfile añade únicamente COPY office-stock-reference.js office-stock-link-plan.js office-stock-link-policy.js. Son la dependencia transitiva introducida por el hook de labor-rtdb-store. office-stock-link-command.js NO se copia porque no está importado por index/runtime; no hay handler de reparación ni bandera activada.

office-stock-copy-closure.test.cjs recorre desde index.js y labor-rtdb-store.js los require literales relativos, rechaza invocaciones no literales que no pueda probar, comprueba que cada destino está en COPY y que no sale del directorio de servidor. Confirma alcance transitivo de las3dependencias nuevas y ausencia de command en runtime. No hace npm install, build ni conexión externa.

Se ejecutó además la prueba existente dashboard-backend-mount, sólo el caso Docker COPY payload alone: copia los archivos declarados a un directorio temporal, monta el index real con Auth/DB/transporte dobles y verifica boot false/true con los flags de Dashboard/Pages/escritor que ese caso ya define. No simula activar un handler Link inexistente. Ningún navegador, contenedor o servicio real se abrió.

Resultado:2casosPASS,0FAIL,0SKIP. Primer intento rojo: el inventariador de función fiscal rechazaba un template dinámico de index aunque no fuera un require; se reemplazó por inventario específico que exige imports literales, y el arranque real comprueba la composición. En ese intento también faltó NODE_PATH para Playwright existente: se corrigió el entorno, no dependencias ni expectativas. La repetición usa el runtime ya instalado. No suite global.

## Estado de propiedad

No hay WIP ni edición de este frente en purchase-orders.js, módulos OT ni frontend office-stock/adapter/host/CSS. El coordinador puede repartirlos a A/D/C. Cambios de este paquete se limitan a Dockerfile, prueba y este informe. Los commits comunes B ya están incorporados y no se vuelven a emitir aquí.

## Interfaz estable para consumidores

- Resolver puro: Reference.resolve(snapshot, selectedInventoryKey opcional) retorna productKey, inventoryKey, receiptIdentityKey, mappingRevision, status y mapped. Catálogo, inventario y recibos son identidades distintas. No usar productKey nuevo para recalcular hashes o sustituir stockRegistro; los consumidores actuales sin mapping deben mantener su decisión histórica exacta.
- Snapshot confiable: producto y candidatos originales, links.byProduct/byInventory, ownersByInventory, aliasOwners, receiptIdentityKey, cobertura completa y contexto de permisos; cobertura debe venir del loader autoritativo del servidor. No puede fabricarla el cliente. El mapping ausente no debe confundirse con un GET denegado, índice incompleto o inversa huérfana.
- Mutaciones: resolver bajo lease/fence antes de calcular deltas y revalidar en beforeCommit. Nunca actualizar sólo un lector mientras otro escritor sigue ignorando el mapping. Las operaciones posteriores I/R evolucionan ledger normalmente; la asociación L conserva sus bytes. La matriz histórica de D sigue obligatoria.

## API prevista para UI, aún OFF

create de office-stock-link-command depende de authorize/store/guard/loadCoverage/assertBarrier/now y enabled=false. authorize(req) usa el verificador existente, rechaza Ver como. preview(identity,{productKey,inventoryKey}) devuelve referencia mínima, expectedHash y canRepair, sin cantidades/costos/historial. execute(identity,{id,productKey,inventoryKey,reason,expectedHash}) sólo puede ser conectado una vez aprobados barreras/reglas/consumidores; conserva operación/recibo original al reintentar. No registrar index ni habilitar interfaz en este bloque.

La política reserva svStockLink* y no usa la capacidad de conteo. El hook stock.ajustar autorizado ya está en0f2f8730; la composición Stock→guard→política→store real con fetch ficticio pasó65pruebas y no certifica reglas remotas. La cobertura/índices autoritativos y assertBarrier productivos siguen pendientes del core; A/B preparan reglas locales, sin permisos ampliados. Si el reparto requiere otro contrato, acordarlo antes de cambiar esas firmas.
