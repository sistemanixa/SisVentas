# Paquete mínimo de Accounts e Indumentaria

El stager local no compila, no usa credenciales, no consulta red y no publica. Prepara un contexto Docker nuevo a partir de un checkout limpio cuyo HEAD coincida con un SHA completo revisado. Los archivos se extraen mediante Git, no desde copias locales normalizadas por Windows.

La imagen base permanece fijada al digest inmutable de Cotizador terminado en 0b67b0a7. El inventario real tiene 125 archivos base. El resultado conserva 116 de ellos sin cambios y contiene 146 archivos: 26 copias exactas de Git y cuatro derivaciones verificadas sobre los bytes nativos, con 21 ausencias iniciales comprobadas. No se presenta una derivación como una copia Git.

Los cuatro archivos derivados son index.js, labor-runtime.js, labor-guard.js y labor-rtdb-store.js. Los tres helpers puros conservan sus hashes Git y distinguen hashes base, fuente, salida y paridad LF. Antes de componer Indumentaria se contrasta semánticamente la propuesta Accounts ya revisada; CRLF y LF sólo se normalizan para esa comparación, nunca para afirmar igualdad de bytes.

El stager requiere todos estos argumentos:

- --source-checkout: checkout público limpio.
- --expected-commit: SHA Git completo revisado.
- --native-base-directory: inventario nativo reconstruido, sólo lectura.
- --base-manifest y --expected-base-manifest-sha256: contrato local revisado de los 125 archivos.
- --accounts-reference-directory: paquete Accounts ya revisado.
- --accounts-reference-manifest y --expected-accounts-reference-manifest-sha256: contrato de esa referencia.
- --output: directorio absoluto nuevo, fuera del checkout y las referencias.

Manifiestos locales, rutas privadas y credenciales no se copian al contexto. El manifiesto generado conserva sólo hashes y nombres de código público. El stager rechaza rutas escapadas, symlinks/junctions, fuentes sucias, SHA divergente, carpetas de salida existentes, imagen base diferente y nuevas dependencias externas.

Docker usa únicamente FROM inmutable, WORKDIR, COPY de los insumos públicos y un RUN Node en forma ejecutable JSON, sin shell. Ese RUN verifica los 125 hashes originales y las 21 ausencias; deriva cuatro archivos con fuentes/helpers hashados; instala las 26 copias Git; comprueba los 146 hashes finales, sintaxis de los 30 cambiados y doce imports puros. Conserva package.json y package-lock.json de la base; no ejecuta npm ni instala dependencias.

Al terminar se elimina todo el directorio temporal de compilación: cuatro fuentes de derivación, runner, tres helpers, contrato y copias intermedias. El runtime final sólo recibe los 30 cambios autorizados. No se ejecuta index.js durante los imports de comprobación, para no abrir un servidor o iniciar conexiones.

Prueba portable: test/stage-combined-runtime.test.cjs. Para contrastar además los insumos reales locales, configurar SV_COMBINED_NATIVE_BASE, SV_COMBINED_BASE_MANIFEST, SV_CLIENT_ACCOUNTS_ASSEMBLY y SV_COMBINED_ACCOUNTS_MANIFEST. Las pruebas usan un repositorio Git sintético separado y no alteran la base revisada.

La creación del contexto no autoriza ni acredita un build, una imagen probada, una activación, un cambio de reglas o una publicación web. Esos pasos pertenecen al corte coordinado y requieren su evidencia independiente.
