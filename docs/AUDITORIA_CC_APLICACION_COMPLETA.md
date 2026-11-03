# Cuenta corriente: prueba en aplicación completa

Extensión de la auditoría maestra solicitada por el chat de integración. Sólo se editó `codex/auditoria-maestra`; el checkout `C:/SisVentas/.local/restaurar-grilla-original-v31714` se leyó como fuente. El HTML activo v3.18.14, su aplicación, lector/host CC y proyecciones se identifican por SHA256 antes y después. Si cambian durante una ejecución, esa evidencia se invalida.

## Entorno

Chrome de escritorio,1280×950, HTTP loopback, servidor y bases en memoria. Se carga el `index.html` completo, sus módulos y `fbCargarTodo()` nativo; caches de clientes/productos/empleados empiezan vacías y **no se marca DataReadiness como listo manualmente**. Identidad/token y SDK son ficticios, no se certifica el inicio de sesión real ni reglas remotas.

Las proyecciones de Account/Commercial/Membership y el directorio protegido utilizan las fábricas de la fuente auditada. La consulta SDK simulada respeta orden, rango, igualdad y límite. La sonda pública de conectividad se responde con el manifiesto local: permite probar el monitor real sin Internet, pero no demuestra conectividad con producción. No se sustituyó `canSync` ni se forzó el estado de conexión.

## Casos

| Caso | Resultado |
|---|---|
|121 cuentas, ventas100 y cobros20 por cuenta | PASS:50 filas iniciales, deuda total9.680; segunda página distinta con50 filas; extracto de cuenta con2 movimientos y saldo80 |
| Vacío global certificado por las proyecciones | PASS:0clientes y $0,00, sin convertir una ausencia desconocida en vacío |
| Cobertura eliminada de la memoria ficticia | Rechazo seguro sin totales falsos; aviso específico PASS en corridas anteriores, **FAIL de presentación estable en la corrida fría final** (error general de carga y timeout del conductor) |
| Administrativo nuevo, sin ventas propias ni scope preparado | **FAIL / pendiente**: `coverage/u_u` devuelve null y la pantalla queda sin un resultado verificable; no se aprueba como cuenta vacía |

En la corrida fría `auditoria-maestra-cc-fullapp-final`: arranque536–663ms; entrada CC163–226ms. Son tiempos locales con fixtures, no latencia productiva. Los hashes antes/después fueron iguales. La corrida `auditoria-maestra-cc-fullapp-proof` añade comparación de ventas/pagos/stock ficticios antes/después y registra las escrituras de simulación. La corrida final conserva dos FAIL (aviso estable de cobertura y usuario nuevo); ventas/pagos/stock quedan idénticos en los cuatro casos. El retorno distinto de cero se conserva mientras esos casos no se resuelvan; no se relaja la expectativa para ocultarlo.

El problema del usuario nuevo se comunicó al chat dueño. Resolverlo exige inicializar/certificar su ámbito vacío bajo cobertura vigente, sin leer datos de otro usuario ni tratar cualquier null como cero. El error debe quedar visible y accionable. No se modificó el modelo ni el host desde este bloque.

## Límites y mantenimiento

- Las corridas iniciales sin sonda de transporte simulada se descartaron: el bloqueo de servicios externos hacía caer al monitor y no probaba CC.
- Una primera versión del conductor podía registrar PASS con contador vacío; se corrigió, y ese caso queda FAIL explícito.
- El directorio no estaba simulado al principio; se incorporó su fábrica real sobre RAM, con rechazo401 sin token ficticio. El fallo del usuario nuevo persiste con directorio200 y sin errores JS/HTTP.
- No se editaron ni activaron CloudRun, configuración, reglas, datos reales o Historial. Este último sigue fuera de la certificación integrada.
- Regresión del presupuesto→PDF→venta→cobros previamente probado PASS después de extender el servidor; aislamiento/consulta paginada/directorio PASS; sintaxis/diff PASS.

Reproducción (sólo fuente local revisada):

```powershell
$env:NODE_PATH='C:/SisVentas/cotizador/node_modules'
node scripts/audit-master-accounts.cjs C:/SisVentas/.local/restaurar-grilla-original-v31714 C:/SisVentas/tmp/auditoria-maestra-cc-fullapp
node --test test/master-audit-isolation.integration.cjs
```

Las capturas, logs y reportes completos quedan en `C:/SisVentas/tmp/auditoria-maestra-cc-fullapp*`, fuera de Git. No interpretar apertura de43pantallas ni una suite aprobada como cierre de este bloqueo funcional.

La evidencia de rechazo financiero y la de presentación no se mezclan: un error general que oculta un contador no se aprobó como si la pantalla hubiera terminado de cargar. No se relajó la prueba para convertir esos FAIL en aprobaciones.
