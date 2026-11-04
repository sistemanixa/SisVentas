# Asistente: procedencia y límites del inventario de corte

Revisión readonly del 04/11/2026. Este documento pertenece al frente de revisión
de escritores; no modifica CONTEXTO_ACTUAL, fuentes congeladas ni autoriza un
corte. La observación es puntual y debe renovarse si cambia la revisión.

## Procedencia exacta observada

- Proyecto: `nixa-sisventas`. Región `southamerica-east1`, identificada por
  `cloud.googleapis.com/location` al listar servicios, no inferida del nombre.
- Revisión lista: `asistente-calendar-2d8b0cf0`.
- Imagen: `southamerica-east1-docker.pkg.dev/nixa-sisventas/cloud-run-source-deploy/asistente@sha256:ce29187e7da14d9205111d49f4a2c6fe2ddf0a2bc664f630c693bf68b8e8197f`.
- Anotación `run.googleapis.com/build-id`, contenedor `asistente-1`:
  `b28b6d6d-8b66-4970-a1b3-1ed4e0be7268`. Cloud Build informa SUCCESS y el
  mismo digest de imagen. Su respuesta no proporciona una procedencia Git.
- Anotación `run.googleapis.com/build-source-location`:
  `gs://run-sources-nixa-sisventas-southamerica-east1/services/asistente/1792643481.340958-403fba1a50bf4b08866817e12ae245ab.zip#1792643482107555`.
  Se verificaron tamaño **31.020 bytes** y generación **1792643482107555** antes
  de descargar únicamente ese archivo identificado. No se descargó el contenedor.
- Copia privada local: `C:/SisVentas/tmp/asistente-calendar-2d8b0cf0-source.private.zip`;
  no incorporarla a Git. Contiene index.js, admin.cjs, audio.cjs,
  service-auth.cjs, statement-import.cjs, usage-limit.cjs, package.json,
  package-lock.json y .gitignore. El inicio declarado es `node index.js`.

El commit `2d8b0cf0` corresponde a cambios de frontend; el nombre de revisión no
prueba que ese commit contenga esta fuente. La copia anterior
`tmp/asistente-source/index.js` no sirve como sustituto de la fuente vinculada.

## Escrituras y servicios encontrados en esta fuente

`index.js:19` admite sólo POST a `/`, `/learn`, `/purchase-import`,
`/statement-import` y `/transcribe`; OPTIONS se resuelve antes. El resto devuelve
404. El archivo no contiene rutas Calendar/agenda. El proxy llama a Anthropic
(`index.js:48–60`); transcripción llama a Google Speech (`audio.cjs`). Las
propuestas de reglas y la normalización de extractos se devuelven al solicitante;
no se persisten como cambios comerciales desde este servicio.

La única escritura RTDB encontrada en los módulos del paquete es la transacción
de cuotas `sv_server_ai_usage` (`usage-limit.cjs:8–17`). service-auth.cjs y
audio.cjs leen roles, permisos y marcas de acceso; admin.cjs inicializa el SDK.
statement-import.cjs exporta construcción de payload y normalización, sin
transporte ni persistencia. No se encontró escritor de agenda, OT, ventas o
pagos, ni integración Google Calendar en esta fuente.

Esto permite excluir esta revisión del inventario de escritores comerciales
directos. No certifica otras revisiones, etiquetas, URLs antiguas, otros
servicios, clientes instalados, herramientas privadas ni efectos posteriores
que un cliente decida aplicar a partir de la respuesta de IA. No se invocaron
APIs funcionales, leyeron registros comerciales, desplegaron servicios ni
modificaron IAM/reglas/configuraciones.

## Revisión de herramientas de preparación y corte

1. `scripts/lib/commercial-cut-evidence.cjs` exige dominios, fences, proyecciones
   y circuitos, y rechaza omitir un escritor **ya declarado** para un dominio.
   Devuelve expresamente `scope: offline-consistency-only`,
   `remoteVerified: false`, `activationAuthorized: false`. Correcto como
   consistencia offline; no es una puerta remota completa. No hay inventario
   externo obligatorio de servicios/regiones/revisiones/etiquetas/URLs o clientes
   antiguos, fecha de observación ni contraste con archivos de prueba: acepta
   hashes de 64 caracteres sin leer ni autenticar sus artefactos. Un escritor
   omitido de todo el manifiesto no puede ser detectado por esa comprobación.
2. `scripts/lib/client-account-preparation.cjs` verifica siete entradas y sus
   huellas, reconciliación y destino de cuentas declarado ausente. No demuestra
   que las entradas sean completas/remotas ni que exista pausa y drenaje efectivos;
   `accountDestination: null` es un argumento, no una consulta. Devuelve una
   propuesta `activation` con ready true separada del parche; no aplica nada.
   Extraer esa propuesta y tomar verify=true como permiso sería incorrecto.
3. `scripts/lib/commercial-write-cut-rules.cjs` sólo compone reglas offline y lo
   declara. No consume el manifiesto de evidencia ni acredita el cierre de
   escritores privilegiados, que no queda demostrado por reglas SDK.
4. `scripts/apply-commercial-ownership-rules.cjs` es un aplicador histórico de
   ownership, no el aplicador del nuevo corte integral. Con --apply exige hash
   candidato, base remota exacta, compilación y contraste posterior; no exige
   manifiesto de escritores, evidencia de URLs antiguas, paquete compatible ni
   pausa/drenaje. No reutilizarlo como puerta de activación integral. Su salida
   alreadyApplied usa applied=true incluso sin --apply cuando las reglas ya
   coinciden: informa equivalencia de reglas, no autorización del nuevo corte.

Conclusión de revisión: las herramientas offline no declaran activación
autorizada, pero **no exigen por sí solas evidencia de todos los accesos antiguos**.
Falta una puerta operativa que contraste inventario remoto fresco y exhaustivo,
artefactos reales y paquete exacto; incluya todos los endpoints/revisiones con
acceso privilegiado, clientes anteriores y scripts privados; y compruebe pausa,
drenaje y exclusión de las siete fuentes antes del commit técnico. Los resultados
de emulador/offline no reemplazan esas pruebas ni autorizan activar capacidades.
Estos son límites de las herramientas inspeccionadas, no una prueba de que un
escritor omitido haya modificado datos en producción. No se ejecutó el aplicador.

## Cierre local mediante archivos explícitos

Se añadió `scripts/lib/commercial-cut-file-evidence.cjs`, separado del validador
compartido y de cualquier aplicador. API: `validate(bundle, options)`. No tiene
CLI de despliegue ni red, descubrimiento de archivos, lectura de credenciales o
escrituras. Sólo abre los archivos indicados explícitamente por el llamador;
usar exclusivamente evidencias previamente sanitizadas, nunca originales ni
credenciales. Admite archivos públicos o privados fuera del checkout; no copia
sus contenidos al repositorio ni los devuelve en el resultado.

Contrato schema 1:

- Cada referencia de archivo es `{path, sha256}`: ruta absoluta, hash SHA256 de
  bytes exactos, archivo regular hasta20MiB. Rechaza enlaces simbólicos finales;
  no se presenta como un sandbox contra directorios padres enlazados. Las rutas
  son entradas confiables y explícitas del operador, sin enumeración recursiva.
- bundle contiene únicamente schema, manifest, baseline, inventory, declarations,
  pause y artifacts. Los primeros cuatro documentos de evidencia se aportan como
  referencias de archivo (manifest, baseline, inventory, pause); declarations es
  un array y artifacts es la lista de referencias de archivos probatorios.
- options exige expectedBaselineSha256, now (epoch ms) y maxAgeMs positivo hasta
  24horas. La huella basal se aporta por separado; debe coincidir con los bytes
  del archivo basal y observed.rulesSha256 del manifiesto. Es hash de bytes,
  no el hash semántico JSON de otros scripts. No sustituir una convención por otra.
- manifest conserva el contrato de commercial-cut-evidence. Todos sus hashes
  Sha256 deben corresponder a archivos leídos y contrastados de artifacts,
  salvo projectionSha256, que el validador compartido calcula sobre las
  proyecciones canónicas del propio manifiesto.
- inventory contiene schema, observedAt ISO, baselineSha256, scopes y accesses.
  Cada scope declara id, kind, complete=true y proofSha256. Se exigen al menos
  cloud-run, functions, browser y private-tools; los id deben identificar los
  ámbitos realmente inventariados (proyecto/región/servicio según corresponda).
  La evidencia de complete debe listar sus ámbitos y método de descubrimiento.
  Cada access contiene id, scopeId, revision, url, trafficPercent, tag y
  proofSha256. Incluir cada URL/etiqueta antigua aunque tenga tráfico0; en
  navegador/herramientas identificar versión o huella y punto de acceso.
- declarations debe coincidir exactamente por id con accesses. Cada entrada
  contiene id, accessSha256 (hash JSON canónico del access observado), writerIds
  y excludedProofSha256. Debe asociar escritores del manifiesto o justificar
  exclusión con archivo probatorio; al asociar escritores, excludedProofSha256
  es null. No admite escritores del manifiesto sin acceso asociado.
- pause contiene schema, baselineSha256, inventorySha256, manifestSha256,
  pausedAt, drainedAt, sources y accesses. Vincula los archivos exactos de
  inventario/manifiesto; exige observación≤pausa≤drenaje≤now y frescura. Las siete
  fuentes sales/payments/budgets/customers/users/identities/permissions requieren
  name, paused=true, drained=true y proofSha256. Cada acceso observado requiere
  id, paused=true, inFlight=0 y proofSha256; los accesos excluidos también deben
  quedar contabilizados en esta evidencia conservadora del corte.

El resultado conserva remoteVerified=false y activationAuthorized=false, con
scope=offline-files-and-declared-observations-only. La comparación detecta un
acceso antiguo observado y omitido de declarations; no puede descubrir uno
omitido también del inventario observado. Los archivos probatorios quedan
vinculados por contenido, pero sus afirmaciones no son verificadas remotamente
ni firmadas por esta herramienta. complete/paused/drained son afirmaciones
aportadas con evidencia, no una adquisición efectiva de bloqueo. Nunca tomar
este resultado como permiso para ejecutar ownership/apply o activar flags.

Verificación ficticia:23casos nuevos más20del validador compartido,43/43PASS;
node --check de ambos archivos nuevos y git diff --check sin errores. No se
ejecutaron aplicadores, consultas de red ni operaciones sobre datos reales.
