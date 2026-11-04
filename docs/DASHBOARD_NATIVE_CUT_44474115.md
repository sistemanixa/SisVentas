# Corte nativo de Dashboard: 44474115

Fuente exacta: `444741152751797ed0923a2a5d0cc41e1ce3e952`. El test `a8f6792ee37f0e0a4eed5b1ca8d874a5bf208309` no cambia aplicación, reglas candidatas ni backend. El manifiesto adjunto registra dependencias transitivas cargadas, hashes de los activos de montaje, reglas compiladas y resultados. Cada dependencia se contrasta con el SHA fuente normalizando únicamente LF/CRLF; sus hashes registrados corresponden a los bytes locales ejecutados.

## Resultado nativo

9 PASS, 0 FAIL/SKIP, con Node v24.17.0, Firebase cliente 10.12.0 y emulador RTDB 4.11.2. Puerto propio 9059, namespace ficticio aleatorio; se verificó raíz vacía tras DELETE y se detuvo únicamente el Java creado. No se tocaron procesos ajenos.

- Conexión SDK real y Fresh/Month HTTP con reglas standalone SDK extendidas por `dashboard-budget-month-rules.proposal.cjs`. Admin `all` conserva dos presupuestos de su nombre, incluido uno reasignado; regular `u_u` conserva sólo sus dos registros. Ambos dan 1 convertido y 50%. Nombre coincidente ajeno y mes anterior no amplían el alcance regular. El token regular no puede leer mensual `all`.
- `cotizador/index.js` real monta las cinco rutas GET existentes sobre servidor HTTP de loopback. Cliente HTTP real consume presupuesto, avisos, ventas, pagos y OT, para admin y regular. El almacén REST real consulta el emulador; se prohíben lecturas Admin cacheadas, originales `sisventas`, escrituras del lector y solicitudes fuera del origen/namespace propio. Se comprueba que los originales no cambian.
- Las cinco rutas rechazan identidad inactiva, pérdida actual del módulo Dashboard y cobertura inválida de cada proyección. El verificador Auth es ficticio y liga UID/audiencia al namespace; no es validación criptográfica ni revocación de un proveedor real. El token owner sustituye únicamente la credencial de servicio del backend.

Logs privados bajo `C:/SisVentas/tmp/stage1-integral-plan/`, con SHA256 en el manifiesto. Primera corrida roja: faltaba montar la extensión de reglas mensuales y la comparación de hashes trataba CRLF como drift; segunda: un constructor ajeno rechazaba el query namespace de la URL del fixture. Se corrigió el montaje: URL base para constructores ajenos y URL con namespace sólo en el runtime REST bajo prueba. Tercera y final: 9/9 verdes. No se alteró código productivo para resolver esos fallos.

## Carrera del fixture de eventos

Root había obtenido 81 PASS/1 FAIL (`8 !== 7`) en el corte integrado. La reproducción controlada conserva las expectativas: se retiene el digest **real** de WebCrypto, se ejecuta `flush` de 30 `setImmediate` y se observa Source `loading` con siete requests; al liberar el digest y esperar la promesa pendiente, Source pasa a `ready` con ocho. La octava es B1 de la misma lectura, no una nueva revalidación.

`373d7930e8d1adfc1414b95038722ed53a418469` cambia sólo el test: después de la microtarea que despacha el evento, espera `Source.ensure`, que se une al pendiente existente. Mantiene los conteos originales y agrega una regresión con el digest retenido; no aumenta ticks ni modifica el host. Repetición: 58 PASS, 0 FAIL/SKIP en host, callpoints, orden de índice, KPI y HTTP. Sintaxis y `git diff --check` correctos. Root debe repetir su conjunto combinado; esta corrida no reemplaza sus 82 controles.

## Reproducción y límites

Con el SHA fuente disponible y sin cambios semánticos en dependencias, iniciar un emulador **propio**, comprobando previamente que 9059 esté libre. Usar el JAR local y Java con `--host 127.0.0.1 --port 9059`. Configurar `SV_NATIVE_CUT=1`, `FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9059`, `SV_NATIVE_CUT_OUTPUT` absoluto privado y `NODE_PATH=C:/SisVentas/cotizador/node_modules`; ejecutar `node --test test/dashboard-native-cut-44474115.integration.cjs`. El test usa las dependencias existentes de `C:/SisVentas/tmp/firebase-security-tools`; no instala paquetes. Detener sólo el PID propio en un finally.

No cubre montaje browser, formularios financieros, Auth real, reglas remotas, imagen Docker ni despliegue. El índice/host se hashean, pero este test no ejecuta su montaje en navegador; QA independiente mantiene ese alcance. No hubo datos reales, configuración remota, push ni publicación.
