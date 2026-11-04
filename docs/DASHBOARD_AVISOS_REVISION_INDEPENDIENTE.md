# Avisos: revisión independiente local

04/11/2026. Solo test y documento propios; lector/índice/runtime y pruebas compartidas no fueron editados por esta revisión. Bloque todavía sin montar; no se ejecutó la puerta general ni se consultaron remotos.

Primer defecto: administrador podía obtener `complete:true, rows:[]` con cobertura global de un registro y su fuente intacta al perder juntos stats/proof/candidatos de `all`; también aceptaba stats cero con proof autoconsistente contradiciendo `coverage.records=1`. Baseline propio: 3 PASS / 2 FAIL, log privado `C:/SisVentas/tmp/dashboard-budget-notice-absence-independent-before.private.log`, SHA256 `bd2574a0a1137cb620e1d7486479785a6eac54c7070d41340b73945e50b896df`. Lector inicial SHA256 `10594bdb3893a7b9d2581e78db7699bcecf8d97707c4f0b6d63228d146e2203a`.

Root corrigió obligatoriedad del scope global, igualdad con cobertura y rango entero de `coverage.records`. Los cinco casos propios originales se conservaron y pasaron después, incluidos los vacíos propios/globales legítimos y el histórico propio con fecha ambigua/importe desconocido, sin datos ajenos ni campos privados.

La revisión adicional de proofs reprodujo otro defecto: stats propios con revisiones `0`, `-1`, `0.5` o `"1"` y digest coincidente aún se aceptan porque solo se compara `revision <= coverage.revision`. Se agregaron cuatro negativos que exigen `SV_BUDGET_NOTICES_INCOMPLETE`. Se conserva el control positivo de revisión entera anterior válida: no se debe exigir igualdad de revisión para un scope sin cambios. Proof incorrecto, generación diferente, revisión futura y permiso retirado sí se rechazan; este último antes de leer candidatos.

Estado de la prueba ampliada: **10 PASS / 4 FAIL**, exit 1. Los cuatro fallos son exactamente las revisiones no canónicas, no regresiones de los cinco casos originales. Log privado `C:/SisVentas/tmp/dashboard-budget-notice-absence-independent-revisions-before.private.log`, SHA256 `853e36a88ee4a46229e438431629782bcbf70edd5087a1768bcfa529aa85d1b0`. Lector observado después del primer arreglo SHA256 `95ee15ab0daa5c90debd7c29628f5cc64f9811e1bfbbd6e012c2373b05399aff`; test ampliado `74681c0cf9146255378db0c2230cc7c7df44dcb473d7965a4876719563cdccc3`.

Pendiente corregir y repetir esos cuatro negativos sin alterar expectativas. Este commit captura un contrato todavía rojo, no aprobación del lector. Transporte de fixtures en memoria; funciones de autoridad, proyección e interpretación reales. No acredita integración SDK/DTO, reglas, publicación ni todos los históricos.
