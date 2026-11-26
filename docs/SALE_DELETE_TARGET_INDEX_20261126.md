# Índice incremental del borrado de venta

Estos dos módulos puros sustituyen el catálogo estático de relaciones como propuesta de integración. No leen producción, no escriben originales, no activan reglas y no acreditan cierre de escritores por sí solos.

## Contrato

`sale-delete-target-index.js` exporta `ROOT = sv_sale_delete_relations/v1`, `CONFIG = sv_sale_delete_relations/config` y `FINANCIAL_ROOT = ROOT + /financial/v1`.

`prepare(sources, {generation})` recibe exactamente las 16 claves de colección de `roots`, con valores RAW completos `null` o mapas. Las cuentas de empleados contienen mapas de movimientos. No recibe una colección parcial ni interpreta falsos, cadenas, arrays o ausencia como vacío. Devuelve `{patch, coverage}`. El patch sólo contiene el namespace específico: configuración schema2/writerSchema1 y generación ready, cobertura, metadatos inversos, buckets de referencias y la proyección financiera real remapeada. Nunca recrea `paymentRefs_v1` ni instala History o el namespace financiero global.

`sale-delete-target-index-delta.delta({changes, read})` recibe cambios exactos `{path, before, after}` de originales individuales. Verifica que los metadatos anteriores correspondan al RAW anterior y produce un patch incremental. `read` sólo necesita rutas técnicas individuales del namespace. Avanza `coverage.revision` incluso con originales idénticos o `changes: []`: el adaptador debe invocarlo en cada escritura afectada. El patch técnico y el original deben confirmarse juntos bajo Guard. El módulo no autoriza un `before/after` entregado por un cliente.

La cobertura schema2 contiene exactamente `{schema,ready,generation,revision,records,sourceAccumulator}`. La configuración contiene exactamente `{schema:2,writerSchema:1,generation,ready:true}`. Ambas generaciones deben coincidir. `validateCoverage` y `validateConfig` rechazan otro contrato o una generación no preparada.

## Lectura puntual

`recordPath(path)` devuelve los metadatos de un original. `validateRecord(path, RAW, metadata)` recompone su imagen y exige igualdad completa. Los buckets sólo contienen IDs derivados de la ruta; el consumidor también debe verificar que `digest(metadata.path)` coincida con la clave del bucket.

`bucketPathsForSale({...saleRAW, fbKey})` devuelve las rutas de candidatos de esa venta. Cubre las referencias técnicas y comerciales con la precedencia canónica de Matcher, presupuestos en ambos sentidos y reclamos directos. `bucketPathsForOTs({otKey:otRAW})` añade reclamos y actividad indirecta de las OT descubiertas. `saleOwnerBucketPaths(metadata)` descubre las ventas que podrían compartir un alias de un candidato. El consumidor debe cargar esos originales, comprobar sus metadatos y conservar las decisiones de `Relations.resolve` y `Activity`: el catálogo entrega un superset, nunca una autorización de cascada.

`image(path, RAW)` devuelve `{schema:2,path,domain,key,sourceHash,tokens?,aliases?}`. Los arrays vacíos se omiten para conservar la forma real de RTDB. La imagen contiene hashes, coordenadas y referencias, no copia de los originales ni adjuntos.

El proveedor financiero existente se reutiliza intacto: su lector traduce únicamente rutas bajo `sale-financial-dependencies-model.ROOT` mediante `financialPath(path)` y delega los originales individuales fuera de ese prefijo al lector protegido. `Model.prepare` y `Delta.delta` financieros reales conservan prioridades, colisiones, dependencias y veto global de fuentes sin resolver. No se fabrican certificados de ausencia.

## Condiciones de instalación

El preparado inicial es una lectura completa única, bajo pausa y cierre comprobado de escritores; la operación habitual de borrar no vuelve a preparar colecciones. Configuración/cobertura se publican juntas como metadatos. La integridad exige mantener source y delta en el mismo commit para todos los escritores de las 16 fuentes, y reglas que rechacen escritores anteriores cuando esta configuración está instalada. Una cobertura estática sin mantenimiento no acredita ausencia.

El consumidor debe ejecutar permiso/Auth fresco, original/CAS, lectura de buckets y candidatos y sus comprobaciones dentro del lease; revalidar el conjunto leído y las revisiones antes de confirmar; conservar las protecciones fiscal, stock y contables existentes; y confirmar originales/proyecciones/recibo/liberación en el mismo patch. Las reglas deben cerrar la ventana de aparición o relink posterior a la última lectura. No se declara inmunidad frente a Admin externo ajeno al protocolo.

## Evidencia local

15 pruebas nuevas verifican preparado cerrado, equivalencia de delta frente a reconstrucción completa de todas las hojas técnicas, relink/edición/borrado, prioridad técnica, ceros significativos, colisiones, referencias inversas e indirectas, revisión por escritura sin cambios, formas RAW/RTDB, rechazos y proveedor financiero genuino. Con dos archivos financieros existentes: 31 PASS, 0 FAIL. Sintaxis y `git diff --check` correctos. No se probó integración Guard/Rules/runtime, navegador ni producción en este bloque.
