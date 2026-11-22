# Recibos y eliminación: auditoría local del 22/11/2026

Base: `060c77f8`, fuente publicada v3.21.2. Trabajo aislado en
`codex/audit-20261122-receipts`; sin publicación ni cambios remotos.
`origin/main` (`4639a87b`) no contiene estos dos archivos de pruebas ni el
adaptador/fence actuales: no se importan sus eliminaciones como solución.

## Reproducción y causa

| Casos originales | Causa | Corrección y evidencia |
| --- | --- | --- |
| Recibo persistido tras cambio de uid, rol, contraseña o revocación (4) | La fixture REST omitía `saleFinancialDependencies:true`; el fence rechazaba incluso el primer comando legítimo. | Activar explícitamente el mantenimiento financiero ficticio en el constructor real. Las cuatro aserciones originales pasan, sin cambiar autorización ni recuperación. |
| ID concurrente idéntico; ID idéntico con cuerpo distinto (2) | Misma preparación incompleta. | Pasan con un único commit; petición distinta rechazada. |
| Capacidad y recuperación privada sin lectura comercial (1) | Mismo flag omitido; capability devolvía false. | Pasa sin lecturas comerciales ni nuevas escrituras al recuperar. |
| Runtime REST, gateway y despacho HTTP real local (1) | Primero conexión `EACCES` a 127.0.0.1; la fixture también omitía el flag. | Ejecución con permiso de loopback y preparación completa: pasa HTTP real, repetición y rechazo de otro usuario. |

Primera ejecución: 9 casos, 1 PASS y 8 FAIL. Tras completar fixtures dentro del
entorno restringido: 8 PASS y 1 fallo de conexión. Ejecución autorizada de
loopback: 9 PASS, 0 FAIL, 0 SKIP. No se cambia código de producto, expectativas,
normalización reservada de claims ni condiciones del fence.

## Eliminaciones y comisiones

Se incluyen pruebas vigentes de comando, adaptador, actividad, dependencias
financieras, índice, relaciones y UI de eliminación; generación de comisiones,
margen original, CAS de redistribución, prueba de escritura, cruce cobro/comisión
y recuperación. La cascada de venta usa UI/transport reales sobre backend ficticio,
conservando comprobantes fiscales, stock y comisiones. Los casos de dependencias
financieras y concurrencia impiden eliminar cuando el contrato no se cumple.

La documentación antigua de porcentaje v3.19.16 no acredita un pendiente actual
por sí sola: `COMISIONES_CIRCUITO_LOCAL_V3209.md` registra un circuito posterior
con originales, idempotencia, CAS y habilitación explícita. No se habilitan ventas,
recalculan comisiones ni se aplica una migración histórica. Los documentos de la
propuesta de cascada de cliente del antiguo worktree 10aecd47 no están en esta
base; este informe no declara resuelta una cascada de clientes por comprobar ventas.

Regresión inicial de dominio: 158 casos, 157 PASS, 1 error de entorno
`Cannot find module 'playwright'` en el caso nativo de
`commission-enabled-entrypoints.test.cjs`; no llegó a iniciar navegador.
El archivo se conserva íntegro y no se altera para ocultar ese fallo.
La ejecución separada sin ese archivo nativo terminó con **154 PASS, 0 FAIL,
0 SKIP**, concurrencia de archivos 1. Incluye los nueve casos de recibos;
no sumar ambos conteos. Sintaxis de los dos JS y `git diff --check`: PASS.

Opt-ins inspeccionados: `sale-delete-rules.integration.cjs` requiere emulador
127.0.0.1:9046 y copia local de reglas; no se arrancó ni se usaron reglas remotas.
`labor-write-recovery-native.test.cjs` requiere Playwright y Chrome; no se ejecutó
porque este frente tiene prohibido usar navegador/PC. Quedan para coordinación
central si se autoriza ese recurso. No atribuir a esta auditoría PDF, recorridos
HTML visuales, reglas desplegadas ni el estado de producción.

Logs privados fuera de Git: `C:/SisVentas/tmp/receipts-20261122-*.log`.
La puerta general se ejecuta centralmente por el principal, no en este frente.
