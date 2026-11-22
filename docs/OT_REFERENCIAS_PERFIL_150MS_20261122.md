# Perfil ficticio ON/OFF de referencias OT

Estado: **no habilitar ON por este perfil**. Se encontró una regresión real en la candidata, no una reducción demostrada de la demora productiva. No se generaron operaciones ni consultas de datos reales.

## Composición y medición

Consumidores `74337bcf`, núcleo comprometido `01347ba1c269fed21d015ca4253832fdf3708fd8`, más instrumentación propia. El segundo perfil incorpora la deduplicación de páginas de planificación descrita abajo. La base de consumidores todavía parte de 652 y no contiene los dos commits posteriores de latencia que ya conserva la integración central: no atribuir estos milisegundos al conjunto central final.

`test/ot-stock-reference-performance.benchmark.cjs` es una ejecución explícita, fuera de la puerta habitual. Prepara 641 productos exclusivamente ficticios con `id` numérico, 138 resúmenes de otras OT y 1/6/12 materiales. Los recibos originales se obtienen del modelo real de entrega física. OFF y ON usan los mismos originales/ledger; el escenario mapeado agrega solamente las asociaciones. Las identidades coinciden en este benchmark para comparar el mismo recurso físico en OFF; los casos funcionales de tres identidades permanecen separados.

Cada IO de la fixture espera realmente 150 ms. Se mantiene el guard y su plazo real; no se amplía ni se congela el reloj. Un resultado rechazado conserva error, solicitudes, fases y cero commits. Cada celda debe drenar todo IO iniciado antes de comenzar la siguiente. Es una muestra por celda, no una distribución estadística ni una prueba de latencia de Firebase.

Preparación y repetición local:

```powershell
node test/helpers/stock-reference-committed-core.cjs
$env:SV_OT_PROFILE_LATENCY='150'
node test/ot-stock-reference-performance.benchmark.cjs
```

La salida incluye trazas por fase y las ejecuciones siguientes incluyen huellas del código. Usar siempre la guardia de red exterior de la auditoría al repetir en el comité. No requiere instalar paquetes.

## Resultado con 641 productos

| Materiales | OFF: ms / solicitudes | ON sin vínculo: ms / solicitudes | ON con vínculo |
|---|---:|---:|---|
| 1 | 4285 / 45 | 6547 / 67 | Rechazado en 4192 ms, 36 solicitudes |
| 6 | 4533 / 75 | 7860 / 202 | Rechazado en 4101 ms, 101 solicitudes |
| 12 | 5477 / 111 | 12212 / 364 | Rechazado en 4255 ms, 107 solicitudes |

Los tres rechazos son `SV_STOCK_COVERAGE_LIMIT` del núcleo 01347 y **cero commits**. No se comparan sus tiempos como si fueran operaciones terminadas. La consulta amplia de IDs numéricos excede el límite, pese a que los códigos e IDs ficticios son únicos. El frente E conserva la propiedad del plan de cobertura y debe entregar su corrección antes de repetir una matriz exitosa.

Para 12 materiales sin vínculo: planificación 119 solicitudes/3669 ms, precommit 121/3668 ms y commit 112/3494 ms. OFF: planificación 35/1430 ms, precommit 36/1417 ms y commit 28/1264 ms. En todos los casos el máximo observado fue seis IO concurrentes. El incremento sin vínculo también queda pendiente; no se oculta porque el error de cobertura afecte al escenario mapeado.

Log/JSON privados: `tmp/audit-front-d/ot-reference-profile-641-150.log` y `ot-reference-profile-641-150.json`, SHA-256 del JSON `a49cc5d321a982302c3b099e1fae4f9131368e4f017c9024a3a33d824f21d10e`.

## Antecedente pequeño y corrección acotada

Antes de añadir los IDs y el catálogo grande, un material mapeado hizo 189 solicitudes y tardó 25881 ms, frente a OFF 45/4264 ms y ON sin vínculo 67/6485 ms. Seis materiales mapeados excedieron el plazo real del guard durante la planificación; el lanzador anterior detuvo la matriz y no preservó una celda completa. Se retiene ese error en `ot-reference-profile-150.log`; no se atribuye una latencia final inexistente a seis o doce materiales. El conteo sin demora de 12 materiales era 2124 solicitudes, con 1152 rangos en planificación.

La corrección del consumidor comparte promesas de páginas **completas e idénticas**, sólo durante la planificación de una operación autorizada. No comparte resoluciones completas: `identifyOriginal` e historia siguen verificándose por fila y hash del original. Devuelve copias para impedir contaminación por mutación. Al entrar en el control final descarta todas las páginas; reconsulta cada rango registrado con hasta seis slots y espera que termine el lote iniciado incluso cuando una consulta falla. Las resoluciones posteriores del commit no reutilizan páginas de planificación ni del control fresco. OFF no ejecuta consultas nuevas ni deja de invocar su callback legado.

Un perfil exclusivamente del componente con dos identidades y 18 consultas idénticas, a 150 ms por IO, pasó de 54 solicitudes/8420 ms (planificación 5614, fresco 2806) a 36/3274 ms (2808 y 466). Conserva dos verificaciones de identidad y las 18 consultas frescas; máximo seis. Archivo privado `reference-operation-micro-150.json`. **No es una medición de OT completa** y no resuelve el rechazo de 641 productos ni el costo sin vínculo.

## Validación y continuidad

18 archivos de dominio: **258 PASS, cero fallos, omisiones y cancelaciones**. Incluyen composición con núcleo real, OFF exacto, tres identidades, revisión de mapeo/permisos, alias concurrente, replay, conteo, aislamiento de operaciones, copias de páginas, descarte al pasar a commit y drenaje de lotes rechazados. Log privado `ot-reference-phase-sharing-domain.log`. Sintaxis y `git diff --check` obligatorios antes del commit. La puerta global corresponde al integrador central.

La corrección funcional de firma y cantidad de auditoría de conteo ya se entregó aparte en `0b8f54fff3e376d6f6593e8ca1ad6966d74a7e58`. Este bloque no edita core E, guard, permisos, SDK, versión, índice, SW ni despliegue. Siguiente paso: núcleo de consultas exactas de E; repetir el perfil completo sobre la integración con las optimizaciones previas, mantener ON desactivado y cerrar las regresiones que sigan apareciendo.
