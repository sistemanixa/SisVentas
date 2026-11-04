# Frescura del puerto backend de Dashboard

2026-11-04. Base congelada `53b8f128`, rama aislada `codex/dashboard-admin-freshness`, checkout `C:/SisVentas/.local/dashboard-admin-freshness`. No se editó root ni se activaron flags.

## Reproducción

Admin SDK **13.10.0**, emulador propio `127.0.0.1:9059`, namespace ficticio. Se mantienen listeners reales del SDK en un perfil y en la consulta UID indexada. El harness retiene únicamente los eventos data del socket WebSocket de loopback, dejando pasar el HTTP REST. No reemplaza get(), snapshots, algoritmos de caché ni el SDK. Las funciones de socket se restauran en finally.

Tras un PATCH REST confirmado que cambia activo true→false y revisión 1→2, `ref.get()` y la consulta UID con listener activo siguen devolviendo **revisión 1**. Ambos get se completan con **cero escrituras nuevas al WebSocket**. `labor-rtdb-store.read/query` y el adaptador propuesto devuelven **revisión 2/activo false** mientras el listener continúa retenido. Hay una reproducción directa del riesgo, no sólo una inferencia del código del SDK.

## Delta mínimo

Index cambia únicamente el puerto usado por los cinco lectores de Dashboard: de Admin database a `dashboard-rtdb-read-db.create({store:laborRuntime.store})`. El adaptador expone sólo el subconjunto de lectura que esos controladores ya utilizan: ref/get, igualdad UID limitada y rangos de claves limitados. Usa el transporte REST existente, no crea servicios, autorizaciones, índices, relojes, listeners, cachés ni escrituras.

Se agrega `readQuery` al store para reutilizar request, token, URL, timeout y manejo de errores ya existentes. Las consultas UID exigen igualdad y máximo dos fichas; los índices ordenados exigen límite 1..50. No se modifica read/query anteriores ni acquire/commit/abort. Los lectores/validadores de actor, rol, permisos, generation/revision/proof permanecen intactos. Docker copia un módulo adicional; flags y capacidades no cambian.

Los rangos exclusivos usan startAt(cursor + espacio): espacio es el menor carácter permitido en claves RTDB; incluye las extensiones legales de la clave sin incluir la propia clave. El test nativo incluye `a`, `a `, `aa` y `b` para comprobar ese límite sin ampliar páginas a 51 ni saltar claves prefijo. Se aplica a índices con claves lexicográficas codificadas del contrato actual; no es un adaptador Admin completo ni implementa orden numérico arbitrario de claves originales.

El harness del montaje existente se adapta para simular GET REST sobre los mismos datos ficticios y mantener la prohibición de escrituras. Ya no trata un GET de metadata como transporte indebido del guard; sigue rechazando métodos de escritura, credenciales reales y originales. No se cambian expectativas de contenido/autorización.

## Validación y límites

- **2/2 nativos PASS**, cero FAIL/SKIP. Además de la caché Admin retenida, lectores reales de actividad/avisos recorren 101 registros ficticios por REST con límites cinco/50, conteos correctos y rechazo tras revocación actual.
- **17/17 focales PASS**, cero FAIL/SKIP: adaptador, cinco rutas/arranque/payload COPY existentes, store RTDB y dependencias Docker.
- Sintaxis de los seis JS/CJS afectados y diff-check: PASS. No hubo puerta general.

Logs privados: `C:/SisVentas/tmp/stage1-integral-plan/dashboard-admin-cache-native-final.private.log` y `dashboard-admin-rest-focal.private.log`. Se conservan intentos exploratorios separados: el primer hook a faye no interceptó el bundle standalone de Admin; otro intento alcanzó las aserciones pero falló al consultar package.json no exportado. Una iteración de rango con NUL fue rechazada por RTDB; el límite final con espacio se verificó nativamente. No se presentan esos intentos como resultados aprobados.

Ambos namespaces se eliminaron con verificación null y el emulador propio se detuvo; no se usaron puertos ajenos, servicios reales ni datos productivos. El delta elimina la reutilización de caché Admin en estos lectores. No vuelve atómicas las lecturas secuenciales ni elimina la ventana de un escritor privilegiado fuera del guard después del último check. Persisten los requisitos de corte/exclusividad y la validación final conjunta antes de activar flags.
