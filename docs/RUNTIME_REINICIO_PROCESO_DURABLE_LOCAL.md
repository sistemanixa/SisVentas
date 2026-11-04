# Reinicio real de proceso: recibo y lease durables

La búsqueda focal en pruebas de restart/recovery/runtime/receipt y llamadas spawn/fork/kill no encontró un ensayo equivalente. `commercial-draft-transport-restart-native.test.cjs` y su helper dicen explícitamente que reinician sólo el listener HTTP, conservando backend/guard/RAM; esa prueba sigue siendo válida para su propio alcance y no se modificó.

Se agrega `test/runtime-process-durable-restart.integration.cjs` con `test/helpers/runtime-process-durable-child.cjs`. Fuente de runtime congelada: `29228fdb7d4d34faab700a5b9a3e53315f0af21d`, copia privada extraída de Git. No se editó root ni el candidato.

El proceso hijo instancia **createLaborRuntime real**, su `labor-rtdb-store`, `labor-guard` y el `labor-write-gateway.resolve` existentes. Cada hijo tiene heap/guard/instancia nuevos. El padre envía comandos de fixture por IPC y mata exclusivamente sus hijos con SIGKILL, esperando su salida antes de arrancar el reemplazo; se comprueba PID distinto.

El transporte REST del store se reemplaza por un adaptador de prueba en disco: lee `state.json`, escribe archivo nuevo, fsync y rename atómico; el mismo reemplazo contiene efecto, recibo y eliminación del guard. No hay backend RAM compartido entre hijos. El estado se conserva en una carpeta temporal única; los nombres y la ubicación se validan antes de limpieza recursiva. No hay llamadas de red: el adaptador acepta únicamente la URL ficticia loopback/demo y no la solicita realmente.

## Dos casos, sin reloj inventado

1. **Commit durable y respuesta perdida por caída:** el hijo persiste incremento de un contador ficticio de empleado, recibo y guard ausente; queda retenido antes de responder. El padre comprueba el estado y mata el proceso. El hijo nuevo lee ese mismo archivo, `resolve` devuelve confirmed y repetir la misma operación/digest devuelve su resultado sin ejecutar otra vez el trabajo. Efecto=1 y un solo commit de negocio; sentinel conservado. Otro UID no puede recuperar ese recibo (409). El log registra PIDs y huella del estado antes/después del reinicio.
2. **Caída después de adquirir, antes de commit:** el lease queda persistido. Tras matar el hijo, el nuevo proceso conserva ese fence y devuelve pending mientras está vigente. Se espera su vencimiento real (aproximadamente30s, sin cambiar Date.now ni fechas del lease). `resolve` escribe el recibo rechazado, libera guard y repetir la petición original no ejecuta el incremento: efecto=0. No se borra manualmente el lease ni se restaura una copia previa.

El incremento usa una ruta ficticia y controlada de `empleados` para que ejecutar dos veces el trabajo sea observable; no pretende validar el formulario de salarios ni un comando financiero nuevo. Accounts/H7/Pages/Dashboard se pasan false en esta prueba del contrato de recuperación, sin afirmar aceptación de sus proyecciones por este ensayo.

## Evidencia y reproducción

Resultado: **2 PASS, 0 FAIL, 0 SKIP**, Node22.23.4, ejecución serial. Log privado `tmp/sdk-proof/runtime-process-durable-final.log`, con diagnósticos de PID, guard, expiración y efecto. Sintaxis y diff verificados. Se preservaron intentos restringidos anteriores: el sandbox impedía rename entre padre/hijo con EPERM; la repetición autorizada permitió el reemplazo atómico sin cambiar esa semántica.

```powershell
$env:SV_PROCESS_RESTART_SOURCE='C:/ruta/absoluta/copia-de-la-fuente'
node --test --test-concurrency=1 test/runtime-process-durable-restart.integration.cjs
```

No se ejecuta por la puerta general debido a su extensión `.integration.cjs`; debe citarse por separado. Todos los hijos se cierran y sus carpetas se limpian en finally; no se detiene proceso ajeno.

## Límite preciso

Esto cubre reinicio del proceso que contiene runtime/guard/store y recuperación con persistencia de fixture. **No es equivalencia con Cloud Run**: no inicia Cotizador/index, HTTP real, Firebase Auth ni RTDB; el adaptador no certifica reglas, infraestructura, varios escritores concurrentes ni durabilidad frente a corte eléctrico/caída del SO. Las fronteras de caída probadas son después de la persistencia completa de acquire o commit, no en medio del fsync/rename.

Tampoco certifica recuperación fiscal externa o el paquete ON3.19.4. Es una prueba local acotada del hueco de proceso del transversal8; no amplía permisos, no cambia el contrato de producto ni autoriza activación remota.
