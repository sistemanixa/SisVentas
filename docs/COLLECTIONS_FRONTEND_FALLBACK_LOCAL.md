# Cobranzas: fallback frontend por capacidades · propuesta local

Base: `2bfc979fecc0d547cfe5ac925eef35640bd9bfa8`. Rama aislada `codex/collections-frontend-fallback`. Única fuente funcional modificada: `js/modules/collections-indexed-host.v1.js`. Sin cambios en app/index/SW, fixtures compartidos, servidor, reglas, flags, DB, ventana8765, push o publicación. No se ejecuta una puerta global.

## Contrato

Una lectura exitosa y vigente de configuración puede resolver que el modo nativo no está disponible: `ready`/`schema` y `nativeCollectionsReady`/`nativeCollectionsSchema` deben ser exactamente true/1 para reclamarlo. Si faltan capacidades, están incompletas o están desactivadas, bootstrap queda validado para ese actor pero `active()` devuelve false. Los callbacks de entrada de la aplicación pueden continuar con sus lectores y render legacy; no se crea lector nativo ni se detienen los existentes.

Esto no es un fallback por error:403 de configuración, pérdida de Auth/permisos, otro actor/base/ruta o respuesta retirada no validan bootstrap ni reanudan callbacks. Un modo nativo ya validado tampoco cambia a legacy por error de cobertura o conexión.

El arranque compartido tiene contexto y secuencia propios. Consumidores concurrentes comparten una lectura, pero cada callback comprueba que sigue vigente. Un finally de la sesión anterior no borra la tarea de arranque nueva. La validación se retira ante cambios de sesión/rol/permisos. Al recuperar visibilidad, un arranque que quedó sin validar puede reintentarse y ceder a los lectores de la aplicación sólo tras una respuesta nueva válida.

Los hooks offline/visibility/reset sólo limpian DOM y estado de selección cuando el host había tomado la pantalla (`claimed`). Un host inactivo no borra filas, selector ni métricas legacy. Las páginas nativas mantienen su límite50, búsqueda, selector, importes y acciones existentes.

## Evidencia

El rojo previo del coordinador se conserva en `C:/SisVentas/tmp/publish-off3195-20261105-verified/collections-incompatible.private.json`: capacidades nativas ausentes, host activo y0filas. Se consultó como evidencia histórica; esta rama no volvió a leer producción ni datos reales.

- Primeros10 casos nuevos:2PASS/8FAIL en fuente original;10PASS tras corregirla. Log rojo privado conservado.
- Suite unitaria final:22PASS/0FAIL/0SKIP. Host/reader/Readiness reales, SDK/DOM sintéticos y callbacks legacy observados. Su DOM preexistente es un marcador para detectar borrados; no implementa ni simula el lector legacy real.
- Focal combinado:36PASS/0FAIL/0SKIP (22unitarios y14 recorridos de los archivos nativo/selector). Después se repitieron sólo los22 unitarios al hacer explícito el marcador de DOM del helper;22PASS. Incluye native50 a390/768/1280, historial/búsqueda, selector, refresh y permisos; no equivale a probar todos los formularios financieros.
- Config403 y error posterior de cobertura no producen fallback; las carreras cubren callbacks concurrentes, logout, permisos, Auth, base, ruta y finally antiguo frente a arranque nuevo. Offline/foreground nativos recuperan50 sin llamar legacy.
- Syntax/diff checks del alcance. No se alteró ninguna expectativa histórica fuera del caso autorizado siguiente.

## Único caso vigente actualizado por cambio de requisito

Se reemplaza únicamente `native capability stays unavailable until complete coverage; no full-history fallback` en `test/collections-indexed-native-ui.test.cjs`. Su exigencia de bloqueo con `nativeCollectionsReady=false` contradice el requisito frontend ahora autorizado. El texto anterior queda en Git de la base y en `tmp/collections-original-blocking-case.private.txt`.

Nuevo caso: `validated disabled capability yields to legacy callbacks and inactive hooks preserve the existing DOM`. El fixture nativo compartido no implementa legacy y no se modifica: la prueba observa únicamente los callbacks de cesión de control, no fabrica una lista. Comprueba inactive/ready, los dos callbacks, DOM intacto tras eventos y ausencia de lecturas indexadas. El mismo caso con el host original inyectado dio0PASS/1FAIL (esperaba inactive y recibió active); con el host corregido pasa. El resto de las pruebas del archivo permanece intacto.

El override `SV_COLLECTIONS_FALLBACK_TEST_HOST` sólo permite repetir ese contraste focal contra un archivo local del host anterior. No cambia la configuración de producto ni sus expectativas. La validación de lectores/render legacy reales sobre HTML completo corresponde a QA y a la nueva fuente integrada; estos tests no la sustituyen.

## Artefactos y siguiente paso

Logs ignorados de esta copia: `tmp/collections-fallback-red.private.log`, `tmp/collections-disabled-contract-red.private.log`, `tmp/collections-fallback-final.private.log`, `tmp/collections-fallback-unit-final.private.log`. Helpers y pruebas son nuevos salvo el único caso autorizado.

El coordinador integra/versiona el módulo, mantiene la fuenteOFF y ejecuta su puerta única y QA HTML completo. No se heredan aprobaciones de la fuente anterior como evidencia de este cambio. Esta entrega no publica ni cambia backend/índices/flags ni certifica producción.
