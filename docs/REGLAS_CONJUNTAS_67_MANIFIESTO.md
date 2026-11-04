# Composición local exacta de reglas sobre67

Fuente de builders/runtime: `67f0418cc2b67618b0b3d89cfed365c2acd352b9`. Resultado: propuesta ficticia probada en emulador propio, no reglas remotas ni autorización de corte. No se editó root ni el checkout de publicación.

Existe el frontend preparado `v3.19.4`, fuente `40d955fba895e21ee61fd793b2add7896810baf8`, en `integracion-paquete-v3194`: se comprobó HEAD e índice con Accounts/H7/Dashboard/avisos ON y app versionada3.19.4. Su aceptación está en curso y no es la fuente/imagen firmada por este ensayo. La firma de fixture **no ampara ese frontend ni una imagen backend real**.

El [manifiesto](reglas-conjuntas-67.manifest.json) registra hashes de baseline, cada builder/etapa,48dependencias y archivos de runtime/tests, readback y logs. Se contrastaron contra objetos Git67, admitiendo sólo la diferencia CRLF/LF del archivo extraído; incluye tanto hash real ensayado como hash del contenido Git y hash normalizado.

## Baseline y secuencia

Base usada: snapshot histórico local `rules-observed-final.private.json`, ya documentado por ensayos anteriores del plan. No se descargó ni consultó Google/Firebase real. SHA256 `dee40945c7224f449a1f460193c268796341bd97e3c82c8e00ea236385be1fb7`,1.647.036bytes. Se conserva privado; no se añade el JSON de reglas a Git. No acredita actualidad remota.

Secuencia exacta, sin modificar builders:

1. `commercial-write-cut-rules.prepare`: protocolo escritor2, Accounts/Cobranzas nativa, retorno económico, fence operativo, H7 sólo escritura, dependencias financieras, eliminación OT y pausa SDK.
2. `sdk-admission-pause-rules.strip`: retira únicamente el envelope exacto verificable antes de componer más reglas.
3. `ot-lifecycle-rules.build`: contrato de campos económicos/operativos autorizados del ciclo existente.
4. `ot-delivery-fence.prepare`: sella OT canónica/resúmenes y conserva fence de inventario, permisos y condiciones del protocolo; índices del catálogo.
5. `ot-delivery-attestation-rules.prepare`: namespace de marcador cerrado a sesiones de aplicación, incluido administrador.
6. `sdk-admission-pause-rules.prepare`: reaplica el envelope final a todas las escrituras inventariadas, incluidas las incorporadas en etapas3/4. No se compone encima de un envelope alterado ni se pierde la pausa por agregar escritores después.

Salida JSON compacta: **2.307.150bytes**, SHA256 `00e35a5f888701dcd2a39f8c731b41f9871dddecd415c6c4369f8bd8a7cbeca8`. El emulador aceptó la composición y su readback de reglas resultó idéntico en bytes y estructura. Esto certifica sólo el servidor emulado y esa baseline histórica, no un despliegue.

## Ensayo conjunto actual:5PASS,0FAIL/SKIP

`test/joint-commercial-rules-67.integration.cjs` y su helper offline componen los builders reales. Node22.23.4, emuladorRTDB4.11.2 propio en127.0.0.1:9063, namespaces `demo-*`, ejecución serial, fetch restringido al puerto propio y limpieza del proceso en finally. No se ocuparon9017/9046 ni se detuvo proceso ajeno;9063 quedó sin listener al cerrar.

1. Composición exacta compilada/readback y namespace de atestación privado: GET/PUT/DELETE denegados a administrador de aplicación y tercero. Estado privado H7 no expuesto.
2. Entrega2 con `createOTLifecycle`/guard/REST store reales y verificador Ed25519 real sobre marcador/configuración emulados: un remito, replay sin duplicado, inventario intacto y deuda26000centavos coherente Accounts/H7.
3. Revocar el marcador o cambiar la generación retira el fence y rechaza entrega sin modificarla.
4. SDK no puede editar OT/inventario del fixture instalado ni operar `sdkAdmissionPaused`, con pausa false/true. No se amplían permisos para aprobar.
5. Escritores sin mantenimiento Accounts o H7 no llegan al trabajo ni alteran originales instalados.

No se reemplaza el verificador por un callback que devuelve `verified:true`. La clave privada de prueba se genera en RAM y no se registra. El marcador local está vinculado al SHA de estas reglas y a la generación ficticia observadas; `artifactSha256` es deliberadamente un artefacto de prueba identificado como tal. No afirma exclusión real de publicadores, drenaje HTTP/fiscal ni proof de corte; `remoteVerified`, `activationAuthorized` y `publisherExclusiveProof` permanecen false.

Logs privados: `tmp/joint-rules-67/final/test.private.log`, `emulator.stdout.private.log` y `emulator.stderr.private.log`. Los primeros intentos se conservaron: copia incompleta de dependencias y luego hash calculado antes de que RTDB normalizara campos vacíos. El fixture final toma el hash del original ficticio realmente persistido; no se alteraron código de negocio ni expectativas económicas para aprobar.

## Matrices anteriores repetidas:8PASS,0FAIL/SKIP

No se asumieron vigentes los conteos15/85 de revisiones anteriores. Desde1c12 cambiaron, entre otras dependencias cargadas, guard, Pages y builders de fence/namespace de entrega; además cambiaron runtime/store/lifecycle. La comparación por archivo queda en el manifiesto.

Se repitieron sólo estas integraciones, en serie y mismo emulador propio:

- `commercial-writer-protocol.rules.integration.cjs`
- `client-account-writer-protocol.integration.cjs`
- `client-history-write-rules.integration.cjs`
- `purchase-delete-rules.integration.cjs`
- `sale-delete-rules.integration.cjs`
- `sale-return-composed-rules.integration.cjs`
- `sale-financial-write-rules.integration.cjs`
- `sdk-admission-pause-rules.integration.cjs`

Las aserciones originales se conservaron. Sólo se adaptó el literal local9046→9063 durante compilación de las copias privadas de tests/helper y se limitó fetch a `demo-*`/9063. Los hashes del código original, adaptación y log están registrados. La matriz de pausa incluye216controles de creación/actualización y recuperación fiscal real `bridge.resume` con guard/store: ready=true adjunta resultado durable; ready=false conserva pendiente sin reemitir. Esos216son comprobaciones internas de un caso, no216tests adicionales.

Cada matriz heredada prueba su candidata/variante original, no necesariamente las seis etapas exactas conjuntas. Algunas sustituyen autoridad/fence de eliminación en el fixture: se conservan con ese límite y **no** se usan para certificar el fence de entrega ni un corte real. El ensayo conjunto anterior usa firma/verificador reales para cubrir esa separación. Log privado: `tmp/joint-rules-67/regression/test.private.log`.

## Reproducir y cerrar límites

Con emulador propio iniciado y una copia exacta de67:

```powershell
$env:SV_JOINT_RULES_SOURCE='C:/ruta/absoluta/copia67'
$env:SV_JOINT_RULES_BASELINE='C:/ruta/privada/snapshot-historico.json'
$env:SV_JOINT_RULES_PORT='9063'
$env:NODE_PATH='C:/SisVentas/cotizador/node_modules'
node --test --test-concurrency=1 test/joint-commercial-rules-67.integration.cjs
```

El fixture no inicia servicios, no publica, no instala reglas fuera del puerto explícito y no contiene un orquestador remoto. El manifiesto público no contiene baseline, reglas privadas, datos reales ni claves.

Pendientes externos/finales: aceptación del frontend preparado40d y de la imagen backend definitiva, bindings de sus bytes reales, baseline remota fresca, composición/revalidación contra esa baseline, permisos/publicación exclusiva, pausa y drenaje efectivos, snapshot completo, publicación/revocación del marcador y readback antes de reapertura. No se suministran booleanos de publisher para aparentar esas pruebas. Estos resultados no activan flags, no autorizan producción ni convierten el ensayo ficticio en firma del paquete3.19.4.

Los dos documentos históricos se reconciliaron sólo en este checkout: Historial ya reconoce transporte/host/audiencias integrados bajo rolloutOFF en67; OT distingue integración local actual y pendientes externos, y corrige el contrato actual de atestaciónV2 sin renovación diaria. La evidencia heredada permanece identificada como tal.
