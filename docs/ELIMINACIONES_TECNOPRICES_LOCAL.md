# Eliminaciones y Tecnoprices · cierre local comprobado

## Resultado final

Fuente exacta probada: `b1cf32fe8389e1b5b8fbe7635051027e65614af1`. La documentación de cierre posterior no cambia sus funcionales.

| Comprobación | Resultado | SHA256 del log privado |
| --- | --- | --- |
| Puerta vigente completa, con navegador | 10.321 casos; 10.289 PASS; 0 FAIL; 32 SKIP; exit 0 | `de998d978671bf437c9fbb3c04f788fe2907be15ee60d1d612a00355dd18121e` |
| Cotizador, incluidos los transportes de Tecnoprices | 150 PASS, sin omisiones | `7dff6c4175b5342a226af55e6b365d0fd919217208bfb27f68d5f6d38ef3c148` |
| Autoridad, tuplas, montaje y protocolo de eliminación | 144 PASS, sin omisiones | `19d740a0da3a77f8177c6f434d65871efc5140de2c05e939fab79e05dc3a1399` |
| Emulador propio, composición completa, comandos reales y retorno | 34 PASS, sin omisiones | `db61aa2be8d4ffebe2da8d03780f2ae55f9b2588721837bc7402eca7520fdbe5` |
| Composición offline contra baseline retenida | 60 PASS, sin omisiones | Registro `baseline.private.log` del mismo freeze |
| Sintaxis | 52 archivos JS/CJS modificados, 0 errores | Registro `syntax.private.json` del mismo freeze |

Los 32 SKIP de la puerta no se cuentan como aprobados. La nueva condición opt-in de baseline se habilitó y comprobó en la ejecución separada de 60 casos. Los otros 31 controles especiales conservan sus límites y no se certifican por resultados de una fuente anterior. Las ejecuciones específicas se informan por separado, sin sumar pruebas repetidas como si fueran casos únicos.

Los manifiestos incrementales antes/después coinciden: `fe2df1c26965999038c5d5e2df6c1343155a7f38818c38a871f90461d7e31fc9`. Incluyen 3.101 entradas: 71 archivos del delta y puntos de entrada verificados nuevamente en RAW, más 3.030 sin cambios reutilizados del manifiesto previo comprobado. Se detuvo la relectura redundante y muy lenta de las versiones históricas; no se afirma un rehash completo nuevo. La materialización de finales de línea se comprobó contra los blobs exactos de HEAD antes de refrescar sólo sus rutas; no se descartaron cambios diferentes. Las capturas ficticias y logs permanecen fuera de Git.

El emulador final usó `demo-ot-composition-owner-20261106-m`, terminó en `null` literal y su proceso/listener propio quedó detenido. El puerto ajeno 9046 no se usó ni se detuvo. No se modificaron datos reales, servidor, permisos, reglas, configuración, pagos, comisiones ni stock productivos. La ventana del titular no fue recargada. No hubo publicación ni push.

El cierre corresponde al alcance local solicitado. Las capacidades productivas siguen OFF y no se emitió una activación real. El acceso real de Tecnoprices no se probó con una cuenta del proveedor: la validación utiliza formularios/interacciones interceptados y HTTP/cookie jar reales exclusivamente en loopback. Una publicación o corte futuro deberá contrastar el baseline remoto vigente y sus artefactos; esta evidencia no los sustituye.

Los apartados siguientes conservan la evolución y sus intentos anteriores.

Pedido humano06/11/2026: terminar ambos circuitos localmente, sin datos reales ni publicación. La puerta aprobada5c811a48 corresponde al bloque anterior; no se atribuye a los cambios funcionales nuevos que siguen en integración.

## Integración vigente y evidencia local

Fuente funcional actual: `02ff82801ea7dc218e24275bd740cd5b359365d6`. Los apartados posteriores conservan la secuencia inicial y sus fallos; no describen pendientes actuales cuando el cierre se acredita aquí.

El runtime instala siempre el proveedor de eliminaciones, deshabilitado sin configuración explícita y evidencia firmada. Cada comando captura una prueba opaca después de autorizar al usuario, la conserva sólo en RAM y revalida dentro del guard, antes del commit y en el transporte. Las capacidades comparten una sola comprobación fresca por solicitud. El store neutraliza los claims reservados recibidos del cliente antes de derivar los propios. El constructor `commercial-delete-full-cut-rules` compone los escritores existentes y estrecha la autoridad de las tres eliminaciones sin borrar permisos de otros dominios. Los helpers, proveedor y protocolo necesarios están incluidos en Docker.

La autoridad atómica comprueba ambos snapshots, incluidas coberturas y conteos. La pertenencia de cobros enlaza dos tuplas validadas independientemente (anterior y posterior), no obliga a conservar el mismo hash cuando hay un cambio legítimo. Los claims agrupan los seis campos de cada tupla en dos mapas para evitar repetir sus prefijos. El retorno autorizado de una venta sin actividad a presupuesto conserva su circuito económico, permisos y destino exacto; no se trata como eliminación general ni recibe una autorización derivada del JWT.

Se corrigió una hipótesis errónea del verificador: el escritor H7 incrementa sólo las revisiones de dominios afectados. Los demás conservan revisiones anteriores válidas. Se comprueban rango, generación, conteos y total global; no se exige igualdad de todas las revisiones. El caso rojo de replay quedó preservado y después pasó con el escritor real.

Tecnoprices envía las credenciales únicamente al POST fijo `/control.php` mediante el cookie jar del contexto. No rellena el DOM. El POST no sigue redirecciones; sólo 301/302/303 válidos permiten una navegación GET posterior al mismo origen. Las pruebas de mutación de formulario y redirecciones quedan conservadas. No se inició sesión en el proveedor real ni se utilizaron credenciales reales.

Evidencia anterior a la puerta final:

- Regresión completa de Cotizador: 144 PASS; log privado SHA256 `1be4c3c4c35a51d59433deddf5554427abb5bd440b1d336054e4be1b10cee5b7`.
- Cookie jar y HTTP reales entre servidores loopback propios: 6 PASS; SHA256 `feb5ecf31f5d1bd925507e1fced9fcfd510cb1f94830f0959b954f8bbbccc73e`. El intento sin variable de Chrome no encontró el navegador del paquete; se conservó y se repitió con Chrome instalado, sin instalar dependencias.
- UI completa de eliminación, escritorio/móvil, cancelación y acuse incierto: 4 PASS; SHA256 `6a0bf454524eb1217e48cbd56aebad007f94255ec525d35c5e01f63d96db1603`.
- Composición anterior Accounts/Operational/H7/OT: 14 PASS en emulador propio. Los fallos iniciales identificaron normalización de arrays vacíos y permisos insuficientes del fixture positivo; se conservaron negativos equivalentes. No se relajaron reglas para hacerlos pasar.
- Composición completa con runtime/store/comandos reales: 34/34 PASS, sin omisiones. Baseline local retenida `dee40945…`, sin consultar reglas remotas. Namespace `demo-ot-composition-owner-20261106-l`, vacío literal `null` al cerrar y proceso/listener propios detenidos. Log SHA256 `e1281edb3511e0d819686c098d78b7dc299fd892ee7262ae58483cb37cbb1730`.

Los intentos h/i/j/k no constituyen validación: la representación extensa del JWT sintético provocaba HTTP 400 incluso con una regla literal que permitía todo. El intento de ampliar el límite URI sólo del proceso Java no resolvió ese rechazo. Se compactó la representación de claims manteniendo los mismos campos y se repitió sin modificar el emulador. Los negativos finales exigen explícitamente HTTP 401/403: un error de transporte ya no cuenta como veto de permisos. El positivo de retorno inicialmente carecía del nombre del autor en el directorio ficticio; se completó el fixture exigido por las reglas originales, manteniendo un negativo de permiso denegado.

Pendiente de este cierre: QA de la representación compacta y puerta conjunta sobre fuente congelada. El frontend no cambió respecto a `5c811a48`; su validación anterior no sustituye las nuevas pruebas de servidor y reglas. La pestaña real no fue recargada. No hay publicación, activación, datos reales, push ni cambio de `main`.

## Cambios ya integrados

-83d5f6e0 comparte `ot-delete-policy.assertNoActivity` entre eliminación OT y cascada de Venta. Se conservaron origen/referencias específicos de cada operación; una OT vacía vinculada sigue admitida en la cascada existente. Rojo29casos:1PASS/28FAIL, incluyendo aceptación indebida por el comando real ficticio.
-3e6330d3 amplía el criterio canónico a controles/progreso, estados cerrados según el modelo de ciclo, acta, firma y fotos históricas. Rojo adicional70casos:30PASS/40FAIL; regresión posterior299PASS. No cambia históricos ni habilita endpoints reales.
-Tecnoprices2b3f251b integrado71639199 y helper empaquetado en Docker3e6330d3. Formulario mismo origen y destino normalizado `/control.php`, tres controles del mismo formulario; sesión acreditada antes de cache/precio y error breve. Navegador con páginas interceptadas y prueba de dependencias:23PASS. No se probó login del proveedor real ni se usaron credenciales. El primer intento local no encontró el Chromium del paquete; repetición con Chrome instalado mediante la variable propia del test pasó, sin instalar nada.
-Pruebas independientes H7 y matriz de cascada3a9b283a/30db6560 integradase8af738c/75979b92. El contrato preparado y su matriz pasan65casos en el árbol root; eso no acredita ejecución de emulador.

Logs privados: regresiónOT SHA256 `e95ba135357370781be9f2b88a254ea64ff39b1c1dff65cb79b49eecf27e8300`; Tecnoprices/contenedor SHA256 `643bf98657e27744d3bd8d76fa925ce0847c4d35f63b7267704439c8a14ee848`.

## Composición y evidencia pendientes

Ensayo de composición inicial en Java propio9047, namespace `demo-ot-composition-owner-20261106-a`:14casos,3PASS/11FAIL. Baseline local05/11dee40945, sin lectura remota. Root comprobó limpieza final literalnull y proceso/listener detenido. Los fallos se conservan: el cuerpo del fixture usa hash previo a la normalización RTDB que retira arrays vacíos, y exige positivo SDK de Ventas pese a su fence preexistente. QA debe demostrar cada causa y preparar hash del original realmente persistido, manteniendo CAS y positivos legítimos. No relajar el comando ni atribuir estos fallos a datos productivos.

El proveedor de acta firmado preparado5a752acf está en rama separada:124focalesPASS y ocho pruebas de exclusión de escritor SDK. Sus dos rojos muestran que retirar acta/config después de la última relectura todavía permite un PATCH ficticio. No se integra como solución aceptada: falta predicate atómico de reglas/claims que cierre esa ventana. Núcleo prepara archivos nuevos; principal es único integrador de runtime/index/store/comandos.

Las capacidades siguen deshabilitadas por defecto y en producción. No se firma acta real ni se convierte un manifiesto offline en observación remota. El cierre local exigirá prueba del proveedor vigente, revocación en el commit, reglas candidatas contra emulador, replay/acuse incierto, permisos y proyecciones, seguido de fuente congelada y puerta conjunta nueva.
