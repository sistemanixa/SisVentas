# Puertos compartidos: contrato para A/D/C

Fuente de código/paquete antes de nueva funcionalidad:55db3ed4a34694792816bf586cfc2ebcd087f58c. Árbol sin WIP al repartir. E conserva exclusivamente núcleo reference/loader/coverage/barrier/plan/policy/command y backend office-stock. A posee Compras; D posee OT; C posee UI. Este informe fija nombres y límites: no conecta rutas ni declara implementado un export que todavía no existe.

## Callback interno reservado para consumidores A/D

Módulo reservado del núcleo: `cotizador/office-stock-reference-port.js`. Factory prevista: `createReferenceResolver({enabled=false, loadCoverage})`; devuelve `resolveReference(input, ports)`. E implementará ese módulo; A/D no deben crear otro resolver de mapping ni copiar la política.

`input`: propósito `stock|purchase|ot`, referencia del original de servidor (ruta exacta y selector de fila validado por el dominio). No incluir claves supuestamente canónicas, receiptIdentityKey, snapshots, cobertura o hints tomados directamente del body cliente. El wrapper propietario debe comprobar pertenencia de fila/documento y autorización antes de llamar al callback.

`ports`: `read(path)`, `query(path,field,value)` si hace falta resolución histórica indexada, `track(path,value)` para sumar lecturas al CAS del dominio, y `legacy(original)` que ejecuta la resolución actual del dominio sobre su original (no sobre el formulario enviado). El núcleo registra también sus propias lecturas; el adaptador a scope.get/scope.query y beforeCommit corresponde al escritor propietario. No hacer un GET raíz ni suponer que un error de lectura equivale a ausencia de mapping.

Resultado estable: `{productKey, inventoryKey, receiptIdentityKey, mappingRevision, mapped, readSet}`. readSet contiene originales privados necesarios para comparar freshCAS y no debe salir a UI ni logs, porque puede incluir ledger/costos. Las tres identidades permanecen distintas. No incluir nuevas cantidades calculadas en esa respuesta.

OFF debe delegar al recorrido legacy exacto sin lecturas de mapping/cobertura. ON sin mapping validado debe conservar el resultado legacy exacto, con mappingRevision0; una inversa huérfana o cobertura incompleta no cuenta como ausencia. ON con mapping valida forward+inverse, identidad histórica/candidatos/propietarios y registra las lecturas para CAS. Todos los consumidores deben dejar el núcleo OFF hasta cerrar barrera/reglas/carreras.

El original se debe leer/verificar ANTES de aceptar claves derivadas. Para OT, el callback debe permitir resolver desde la identidad histórica de servidor (inventario/stockRegistro/origen) ANTES del lookup por clave de catálogo, que puede haber quedado obsoleta. No cambiar hashes de recibos/remitos ni tratar productKey nuevo como identidad histórica. El loader autoritativo decide si hay evidencia única; si no, bloquea para conciliación, no usa un hint del cliente.

La forma exacta del selector depende del dominio y queda a validar entre E y su propietario; no inventar índices posicionales cuando el original tenga clave estable ni admitir filas ajenas. Si el recorrido legacy devuelve más contexto, el adaptador del propietario lo conserva y sólo sustituye rutas físicas explícitas cuando mapped=true.

## Cobertura/barrera del núcleo E

loadCoverage aún no tiene implementación productiva. Debe construirse y verificarse desde fuentes autoritativas con tooling ficticio de preparación, indexado/cobertura de propietarios y aliases e identidad histórica; no aceptar complete=true del cliente ni inferir completitud por un límite de consulta. assertBarrier debe verificar la barrera/pins reales; el builder candidato de catálogo de A no equivale a un despliegue. El módulo command actual sigue fallando cerrado si faltan estas dependencias.

## Puertos UI C, sin HTTP

Interfaz inyectada reservada: `searchProducts({query, signal})`, `preview({productKey, inventoryKey, signal})`, `execute({id, productKey, inventoryKey, reason, expectedHash})`, `context()`. context devuelve identidad/rol/revisión/activo/autorización/Ver como del adaptador real; C no debe fabricar permisos ni snapshots. El comando no acepta señales ni ready en su body: el adaptador UI maneja abort signal fuera de los argumentos de negocio.

searchProducts sólo ofrece catálogo activo/no servicio/eliminado y no crea productos. preview se adapta al componente existente `command.preview(identity, {productKey,inventoryKey})`, devuelve referencia mínima/expectedHash/canRepair, sin readSet/costos/historial. execute se adapta a `command.execute(identity, body)` y conserva operationId/payload al reintentar tras respuesta perdida. context inválido cancela la revisión. No registrar index ni habilitar Guardar hasta la aceptación de todos los consumidores y carreras.

Un inactivo exacto permanece identificado con estado inactive y reparación bloqueada (sin reactivar ni reasociar); producto ausente/servicio/eliminado/ambiguo exige diagnóstico/decisión explícita. UI no puede convertir un resultado de búsqueda en prueba de vínculo. Nuevas necesidades de contrato se consultan al núcleo E; no introducir en cada frente metadatos o claves alternativas ignoradas por los demás.
