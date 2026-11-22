# Frente C — Gastos y lectores, 22/11/2026

Base local `060c77f8`, aplicación activa `js/app.v3.21.2.js`, rama `codex/audit-20261122-consultas-gastos`. Fuente publicada documentada `5e4bb83db6dec44962fd3ff42c48dfe4e10e78dd`. La raíz histórica no se utilizó como fuente funcional. `origin/main` apunta a una línea funcional anterior (índice v3.12.5); no se fusionó ni se publicaron cambios.

## Gastos: clasificación y cambio

Los cuatro fallos se reproducen al no indicar navegador: Playwright busca un Chromium ausente en su perfil y falla en `browserType.launch`, antes de ejecutar aserciones de producto. Con Chrome instalado los mismos cuatro casos pasan sin tocar la aplicación. `cerrarFormGasto` ya llama a `SisVentas.prepareResizablePage(lista)` en la base revisada.

Se agrega únicamente una alternativa de selección de Chrome instalado en Windows en `test/gastos-form-return-native.test.cjs`. Se conservan las prioridades explícitas SV_TEST_CHROME, SV_TEST_CHROMIUM y CHROME_BIN; en otros entornos continúa la selección de Playwright. No se instalan dependencias ni se omiten casos. No cambia ninguna aserción.

Antes, sin variables: 0 PASS / 4 FAIL por ejecutable ausente. Después, sin variables: 4 PASS / 0 FAIL / 0 SKIP. Los casos cubren 390/768/1280 y retorno heredado basado sólo en display, tabla diferida, identidad de filas, filtros, scroll, foco e idempotencia; verifican cero consultas, escrituras y renderizados adicionales. No acreditan todos los formularios de Gastos.

## Lectores y búsqueda

Tanda focal secuencial: **114 PASS / 0 FAIL / 0 SKIP**, salida normal código 0, 124 segundos. Incluye commercial-report-*, client-account-reader, ledger-reader, readiness-handoff, legacy-ready-browser, sales-search-plan/retention/intent-repaint y budget-share-preview-browser. Node portable 22 y dependencias Playwright existentes de cotizador; Chrome instalado, datos sintéticos, sin sesiones comerciales.

La cobertura incluye rechazo de períodos parciales, importes inconsistentes y cambios concurrentes de cobertura/permisos; consumidores activos que esperan la fuente completa; invalidación y limpieza de DOM sensible; cambio Reportes → Estadísticas → Rentabilidad y períodos en 390/1280; eventos de Gastos y retiro de escuchas al salir. Cuenta Corriente pagina 121 cuentas en 50/50/21, conserva totales completos, cancela resultados de otra identidad y limita miembros al cliente elegido. Búsqueda real con 1.120 ventas ficticias conserva filas, deuda y filtros mientras responde una consulta anterior, usa páginas acotadas y conserva el estado sintético original. No se encontró evidencia en estos casos para cambiar los lectores de producción.

El primer intento restringido encontró `ERR_NETWORK_ACCESS_DENIED` en loopback; no constituye fallo de producto. Se interrumpió y se repitió la tanda completa con acceso al servidor local permitido. La tanda final terminó normalmente; no se ejecutó la suite global, reservada al coordinador.

## Omisiones y requisitos

El número histórico de 91 SKIP de la puerta global no equivale a 91 verificaciones realizadas aquí ni puede clasificarse exhaustivamente sin su listado exacto. Inventario relevante del dominio:

- `client-account-legacy-ready-browser`: cuatro opt-in requieren ruta de Chrome; habilitados aquí, cuatro PASS.
- `budget-share-preview-browser`: dos opt-in requieren Chrome; habilitados aquí, dos PASS. Usa el render preparado y transporte simulado; no certifica un PDF generado por html2pdf real.
- `project-presentation-trial-browser`: opt-in Chrome; corresponde a presentaciones, fuera del frente C. No ejecutado ni modificado; su caso de descarga usa html2pdf simulado.
- `client-account-rules.integration.cjs`: requiere emulador RTDB loopback 9046 y archivo de reglas candidato explícito. No había servicio escuchando en ese puerto al revisar; no ejecutado, sin cambios de reglas.
- `client-account-writer-proof.integration.cjs`: requiere emulador 9046, marca fiction-only y archivos explícitos de reglas inicial/final. `client-account-writer-protocol.integration.cjs` requiere emulador loopback. Son verificación local de servidor, no dependencia de producción; no ejecutados ni declarados cubiertos por pruebas unitarias.
- `sales-search-rules.integration.cjs`: requiere herramientas de seguridad y emulador configurado. Hay dependencias locales existentes, pero eso no acredita un emulador ni una configuración de reglas; no ejecutado.
- `test/browser/document-pdf-preview.cjs`: ejecución separada, necesita PDF ficticio de seis páginas y activos locales del visor; no ejecutado. La exportación de órdenes requiere bundle local html2pdf mediante SV_TEST_HTML2PDF_BUNDLE. No se descargaron bundles ni se extendió el alcance a PDF/exportación.

No se requieren credenciales ni datos remotos para los opt-in locales anteriores. Sus requisitos faltantes no se reemplazaron con acceso real. No hubo modificaciones de versión, índice, Service Worker, CONTEXTO compartido, backend, permisos, exportación ni publicación. El pedido anterior de arreglo de exportación permanece separado de esta auditoría.

## Evidencia privada reproducible

Directorio fuera de Git: `C:/SisVentas/tmp/audit-20261122-C`.

- `gastos-before.log`: cuatro PASS sobre código original con Chrome explícito; SHA256 cc94c5843e81b5adc7d16702de06e6151880e1a9fc161f1486da6dd961eb7e6d.
- `gastos-default-browser.log`: cuatro fallos de lanzamiento; SHA256 717774db4491af47f0d13d77eff6cc6b7ece959e0d2ea4a97dc86521311616ec.
- `gastos-fixed.log`: cuatro PASS sin variables; SHA256 75d8af1c1bac1d760b9a8130508941f6614e428c97655a4489c8eada04884d2a.
- `readers-local.log`: 114 PASS; SHA256 c6124edc7c3f50cc5b0e9429d593c25f4b30de5095d7d0fe3bb264f7d754a858.

Para repetir: NODE_PATH al cotizador/node_modules existente; Node --test --test-concurrency=1 sobre los archivos indicados, Chrome explícito para los opt-in. El caso Gastos se repite sin las tres variables de selección. Sintaxis del test y git diff --check correctos. Siguiente paso: coordinador revisa el commit local e integra únicamente el ajuste de prueba/informe; ejecuta su puerta global una vez. Ningún resultado autoriza publicación ni escrituras comerciales.

## Ampliación local: seis opt-in de Nueva garantía fría

Por pedido del coordinador se ejecutaron los seis originales de `test/page-demand-readiness.test.cjs` seleccionando `--test-name-pattern='Nueva garantía fría'`, con `SV_GARANTIA_MANUAL_RUN=1` y `SV_GARANTIA_MANUAL_CHROME` apuntando al Chrome instalado. NODE_PATH y Node son los indicados arriba; concurrencia 1. Resultado: **6 PASS / 0 FAIL / 0 SKIP**, código 0, 10,36 segundos. No se modificaron código ni aserciones; no apareció un defecto que requiriera corrección.

El HTML y aplicación activa se sirvieron en loopback con `postventa-full-app.cjs`, SDK ficticio y conexiones externas bloqueadas. En 390 y 1280, cliente y venta original ausentes de memoria se resuelven con una consulta de ventas y una del registro elegido; los equipos se completan conservando ventasList vacía. Los otros cuatro casos verifican denegación distinguida de cliente sin ventas, cambio de cliente, cierre de modal y fin de sesión. Las respuestas originales tardías no repueblan el formulario; ambos selectores quedan deshabilitados y la lista temporal vacía. Los seis conservan cero escrituras, errores y bloqueos de red registrados por la fixture. Son pruebas de lectura y descarte; no se guardó una garantía ni se probaron operaciones reales.

Evidencia privada `C:/SisVentas/tmp/audit-20261122-C/garantia-cold.log`, SHA256 `80e3a1ba06a756902a0ab41d74c668f7cc134d3f7ecb983b3c41da8fb93c8b13`. No se controló la ventana del usuario, no se preparó infraestructura externa ni se ejecutó otra suite global. Presentaciones, exportación y publicación quedaron fuera de esta ampliación.
