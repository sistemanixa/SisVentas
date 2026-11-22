# Barrera de catálogo: candidata exclusivamente local

Base `30010f0e` sobre integración `3510ef2f`. Autorización del coordinador limitada
a builder candidato, emulador y datos ficticios. No modifica archivos fuente de
reglas, guard, scope, claims, permisos, flags, UI ni base remota. No habilita
asociación de inventarios ni constituye autorización de corte.

## Cambio mínimo y autoridad conservada

`scripts/lib/catalog-write-fence-rules.cjs` exporta `prepare(copiaCompleta)`.
Clona la entrada y recorre las concesiones compatibles con
`/sisventas/productos`, incluidos descendientes y comodines solapados. Rechaza
ancestros abiertos que no puede acotar. Mantiene reglas cerradas intactas.

Cada concesión existente queda como condición necesaria: permiso original AND
(guard ausente/vencido OR commit coordinado legítimo). La rama coordinada reutiliza
`labor-fence-policy.fence`, `serverActor` y `userActor`: coincidencia de actor,
fence, operación y digest, lease vigente, configuración preparada, recibo nuevo
y liberación del guard en el mismo commit. No se agrega una concesión OR que
pueda reemplazar permisos originales. En comodines la barrera es condicional al
dominio catálogo y el resto conserva literalmente su expresión original.

En la copia completa revisada cambia solamente seis `.write`:

- `/sisventas/productos`.
- `/sisventas/productos/$producto`.
- Sus hijos `stock`, `proveedores` y `garantiaConfig`.
- `/sisventas/$dominio`, sólo cuando corresponde a `productos`.

Todas las lecturas, validadores, índices y demás reglas permanecen idénticos.
El builder es idempotente y no tiene IO ni mecanismo de despliegue.

## Identidad de insumos y salida

SHA256 de los bytes de la copia privada autorizada:
`ea197750dc668aedffc5e182dd6a6e7fd6e939279690cf4a8077ac4cd975f3db`.

SHA256 de `JSON.stringify(candidate)`:
`c08017af02cbe53f463ae34085fa78c135f10658c7feb2fcb67f84f4b86d767c`.
No confundir hash canónico de salida con hash de un archivo con indentación.
El contenido privado y el JSON candidato íntegro no se agregan a Git.

## Matriz ejecutada en emulador aislado

Puerto exclusivo 127.0.0.1:9058, namespace demo-catalog-fence-20261122.
Dependencias Java y emulador ya existentes, sin instalación ni acceso remoto.

| Caso | Resultado exigido |
| --- | --- |
| Reglas completas originales, SDK durante lease | Admitido: reproduce el hueco del catálogo. |
| Candidata, SDK antes y después del guard | Admitido por permiso original. |
| Candidata, SDK durante guard en colección, registro, codigo y cod | Rechazado; catálogo íntegro sin cambios. |
| Distribuidora con concesión en hijo | Admitida antes/después, rechazada durante. |
| Guard/store reales, edición legítima | Commit conjunto, recibo y liberación; recuperación ejecuta work una sola vez. |
| Reset de contraseña, versión obsoleta, usuario inactivo, módulo revocado | Rechazado sin ampliar permisos. |
| Lease vencido | Restaura únicamente la autoridad SDK original. |
| Claims de servicio con fence/operación/digest/actor incorrectos | Rechazados durante guard; no crean cambio. |
| Revisión de permisos obsoleta | Hook beforeCommit existente rechaza, sin datos ni recibo. |
| Sesión revocada después de planificar | Commit real rechazado, sin datos ni recibo. |
| Comodines padre/hijo solapados sintéticos | No eluden barrera; dominio ajeno mantiene autoridad anterior. |

Los comodines permisivos adicionales son una fixture adversarial sólo del
emulador, no parte de la candidata entregada. Un primer intento de esa fixture
usó un técnico sin autorización de campo y falló su positivo de control: se
cambió al administrador autorizado para aislar barrera de validación de campo.
Se conservaron logs privados de los intentos; no se relajaron expectativas.

## Interfaz mínima para E y límites

No hace falta cambiar guard ni emitir claims nuevos para cerrar catálogo.
El comando de asociación sigue necesitando autoridad específica sobre sus
destinos exactos; esta candidata no la crea y no reutiliza el permiso de conteo.

El comando debe autorizar sesión/rol/acción actuales antes de `guard.run`, ligar
actor/operationId/digest, resolver catálogo, mapping, inversa y candidatos mediante
scope, y comparar originales y consultas frescas en beforeCommit. Debe comparar
revisión Y digest de permisos y revalidar sesión, siguiendo el patrón de
`office-stock.save/verify`; la barrera no agrega esa semántica de aplicación a
una operación nueva. El ensayo de revisión obsoleta acredita el hook, no una
nueva comprobación automática de revisión en las reglas de productos.

Compras y OT deben consumir la misma resolución dentro de su exclusión. Las
reglas actuales de inventario ya frenan SDK durante lease; un escritor antiguo
que resuelve otra clave sigue siendo incompatible después del guard. No se
declara cerrada esa migración ni probada la matriz comercial completa por estos
ensayos de catálogo. La UI de reparación debe continuar deshabilitada.

Ejecución explícita: definir `SV_CATALOG_RULES_FILE` con la ruta privada revisada,
iniciar el emulador aislado del puerto indicado y ejecutar con Node
`--test --test-concurrency=1 test/catalog-write-fence.test.cjs test/catalog-write-fence.integration.cjs`.
El test exige el SHA completo, nunca consulta ni acepta un endpoint remoto.
Logs privados: `C:/SisVentas/tmp/catalog-fence-20261122/`, fuera de Git.

Validación final: **30 PASS, 0 FAIL, 0 SKIP**, incluyendo matriz completa,
builder y regresiones de ajuste/productos eliminados. Sintaxis y diff correctos.
La suite general y cualquier decisión de integración/corte quedan al coordinador.
