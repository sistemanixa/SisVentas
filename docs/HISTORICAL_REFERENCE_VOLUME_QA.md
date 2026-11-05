# Fixture histórico sintético y primera matriz local

Base exacta `05be68ac4cbc92feb0318b849449d80bb4a48a9e`, worktree `C:/SisVentas/.local/qa-historical-volume-05be`, sólo archivos nuevos. Perfil `historical-reference`, semilla20261104, `currentEquivalent:false`, `coherentSnapshot:false`. No se tocó app/índice/reader/host de Core ni servidor8765.

El perfil JSON versionado conserva únicamente agregados:1.095ventas/1.095pagos/123presupuestos/492fichas/407estructuras/488entradas de índice (diagnóstico leído2026-11-04T00:48:15.154Z, marcado coherentForActivationfalse);639productos/865ofertas (2026-11-03T04:35:47.920Z);131OT/40reclamos/252gastos (plan31/10);40órdenes/27listas/111registros de inventario (plan30/10). Fechas, fuentes locales y hashes por colección en `test/fixtures/historical-reference-profile.json`. No representan una foto única ni los conteos actuales.

Generación determinista sin acceso a archivos privados, red o credenciales.1.095ventas con5.913ítems conservan el histograma numérico exacto (mediana4/p9514/máximo28); productos conservan histograma de ofertas (85sinofertas,865total,máximo4).81fechas noISO/ausentes se modelan como fechaausente con tsficticio explícito: no se conoce su reparto original. Nombres/códigos/domicilios/usuarios/precios son inventados. Topología de clientes, reparto por responsable/rol y calendario son supuestos sintéticos, no una anonimización de la base.1.095pagos no se interpretan como uno porventa: hay un objetivo sin pagos y otra venta con dos.

Proyecciones construidas por createCoordinatedBackend real (Pages/Accounts/H7/membership), plan real de búsqueda y scan real de listados auxiliares. No se escribe coverage a mano ni se ejecuta activate/corte. La preparación declara sólo completitud de estas entradas sintéticas conocidas. El guard/protocolos/servicios de pago y comisión son código real; Auth/transporte/persistencia son memoria ficticia.

## Comandos y alcance explícito

Desde este checkout, con Node:

```
node scripts/test-historical-reference.cjs --plan
node scripts/test-historical-reference.cjs --stage volume
node scripts/test-historical-reference.cjs --all
```

El runner reutiliza las pruebas existentes, conserva sus aserciones y permite `--stage id,id`. Bloquea fetch/http/https/net en los procesos de prueba y elimina variables de credenciales/servicios del entorno hijo, sin modificar el entorno padre. No instala servicios ni abre navegador/UI. Compra ejecuta únicamente los tres casos Node seleccionados, no el caso de navegador.

**Primer circuito realmente ejecutado con volumen, una sola base:** lector realPages50+50filas sin solapamiento y total1.095 → pago parcial40 → comisión no generada aún → pago de saldo restante → reenvío del mismo pago sin duplicado → comisión generada → regeneración sin duplicar gasto → coherencia de deuda Pages/Accounts/H7.2PASS,0FAIL/SKIP, exit0. Deuda ficticia66821100→66672000centavos; comisión210 para14ítems; pagos1095→1097, gastos252→253. Cinco commits coordinados en memoria. Todos los gastos previos, stock, productos y precio público del objetivo preservados.12consultas del lector (dos paginadas acotadas a50), seis lecturas del adaptador de comisión. No se consultan raíces ventas/pagos para fabricar la página.

Primera muestra verde: preparar proyecciones36145.5ms y total37393.4ms. Repetición final con el runner/bloqueo de red definitivos:2PASS,0FAIL/SKIP, exit0; preparar54073.4ms y total55209.0ms, Node24.17.0. Son tiempos locales de construcción/modelos y memoria, sensibles a carga de esta PC; **no latencia de aplicación, navegador ni Firebase**. Log `C:/SisVentas/tmp/historical-reference-volume-final.private.log`, SHA256 `30a1cd83e6ab03658f847c53bd51cf56c055019e50fa5f7195c05b88bf7698b8`. El test conserva su cuerpo y se entrega como `.integration.cjs`, ejecución explícita; no agrega55s a la puerta general por descubrimiento automático.

Rojo conservado: primera ejecución1PASS/1FAIL, SV_LABOR_LEASE_EXPIRED durante comisión. El adaptador pequeño reutilizado clonaba la base entera al construir cada referencia. Se reemplazó por refs de lectura puntual sobre la misma memoria; no se amplió lease ni se cambió guard/servicio/aserción financiera. Logs privados `C:/SisVentas/tmp/historical-reference-volume-first.private.log` y `historical-reference-volume-point-adapter.private.log`.

Matriz reutilizada ejecutada aparte: creación/contexto/conversión7PASS; pago/evento/comisión5PASS; recepcióncompra2/3+ACKperdido3PASS; entrega/cicloOT6PASS; lectores/permisos34PASS.55PASS,0FAIL/SKIP, exit0, `historical-reference-reused-matrix.private.log`, SHA256 `291cf0de76e31b3909df453bde4e781cf87c51a6b40e0328a6b6a7ce20d27bbc`. **Son fixtures separados, sin volumen histórico: no forman una cadena de punta a punta sobre esta base.** Su selección y límites están en el runner; no se suman como55circuitos integrales.

## Bytes y pendientes

| Colección | JSON generado | Cuerpo histórico local |
|---|---:|---:|
|Ventas|1552560|5364288|
|Pagos|237271|503429|
|Presupuestos|32556|1255694|
|Productos|183720|5563775|

El resumen informa todas las colecciones comparables. No se añadió padding para fingir equivalencia. Faltan distribución de adjuntos/imágenes/campos y forma de registros, costes de decodificación/render y comprensibilidad visual. No se copiaron fotos, descripciones ni precios originales. La referencia de bytes corresponde a otras fechas y serialización; igual cardinalidad no prueba igual carga real.

La continuación `complete-chain` conecta ahora una sola base histórica sintética: alta protegida de cliente/producto/presupuesto → función activa de conversión → cobros parcial/total → comisión → alta protegida de compra/OT → recepción real → entrega/remito → consumo real de stock → rendición → cierre instalado → consulta real de 50+50 filas. Reenvíos de conversión, pago, comisión, entrega, rendición y cierre conservan cardinalidad; revisión vencida y técnico sin permiso rechazan sin commit. Los originales previos se comparan registro por registro. No se reconstruyen proyecciones tras las mutaciones. Precio público300, costo presupuestado30, recibido36; comisión existente67.5 conservada. Catorce commits coordinados; cierre completado y stock consumido3/reservado0.

Repetición final: tres casos PASS (dos previos y cadena completa), cero FAIL/SKIP, Node24.17.0. Log privado `historical-chain-final.private.log`, SHA256 `e76459969adef85dd60b66ee8ed929e3735a5e5233bf30517676984236d453e4`. El generador admite capacidad parametrizada por el llamador, sin modificar el perfil histórico ni leer diagnósticos privados. Ensayo adicional privado de capacidad aprobado; sus conteos y procedencia no se incorporan a Git. Las filas extra repiten formas históricas sintéticas: no son contenido ni distribución actuales comprobados.

Runner final `node scripts/test-historical-reference.cjs --stage complete-chain`: 1PASS/0FAIL/SKIP, exit0; además verifica que la deuda global vuelve exactamente a su valor inicial tras crear y cobrar la nueva venta. Log `historical-chain-debt-final.private.log`, SHA256 `6166bae148783b4c68c623d1c98b2a7dc9a178f86c7d5982e7d0e60e71a7c79f`. El generador parametrizado tiene una prueba pública adicional con capacidades ficticias, 1PASS. `node --check` de los cinco JS propios y `git diff --check` aprobados. Suite general intentada con la puerta oficial; este checkout carece de playwright, por lo que sus casos dependientes fallan al cargar (incluidos servicios que importan navegador-compartido), no se presenta como puerta verde ni como fallo funcional de esta cadena.

La puerta oficial terminó exit1: 9397 casos / 9287PASS / 81FAIL / 29SKIP en cuatro lotes. También hay EACCES de loopback y escrituras Git en temporales restringidos; no se atribuyen todos los81 fallos a una sola causa ni se cambian expectativas ajenas. Log privado `historical-chain-current-gate.private.log`, SHA256 `6808f9bb23550070d379106a325c8435686e934693032ab824f361970f2baeaf`. No reemplaza la puerta previa del candidato ni acredita una nueva puerta general aprobada. Sigue pendiente repetirla en el entorno equipado/autorizado cuando corresponda.

Rojos iniciales conservados en logs privados `historical-chain-first` a `historical-chain-fifth`: faltaba la ruta local preparar; faltaba instalar el host real de Accounts antes de calcular rutas protegidas; OT ficticia firmada antes de entregar; origen nuevo sin auditoría/cantidades completas; comando negativo sin action. Se completaron únicamente el montaje y los datos ficticios/adaptadores de prueba; ningún guard, cálculo, plazo o aserción de producto fue debilitado. La preparación comercial usa el servicio real, con transacción de transporte que exige identidad del registro ya asignado. El fence remoto se inyecta como prueba ficticia explícita: NO certifica reglas remotas. Permisos de interfaz son stubs; el rechazo acreditado es del servidor real con identidades ficticias.

Pendientes: recorrer retornos y formularios reales con navegador sobre volumen después del congelamiento de Core; USD/centavos/costos inciertos y conflictos como perfiles de rarezas explícitos. Alta y OT usan gateway real con payload ficticio, no formularios. La consulta es el lector real, no medición visual. Igual conteo no significa equivalencia de registros, bytes, adjuntos o snapshot atómico.

Medición UI preparada como siguiente fase, no ejecutada: ruta/inicialización reales, input→primer resultado→resultado completo, p50/p95/máximo y tamaño de muestra, solicitudes/bytes por fase, límites de consulta, longtasks, duración de Cargando, vaciados/reemplazos DOM y respuestas fuera de orden. Comparar frío/caliente1280/390 y reposo, con demoras sintéticas declaradas. No llamar rendimiento productivo a esta matriz Node. Sin datos reales mutados, publicación, push, UI ni cambios de producción.
