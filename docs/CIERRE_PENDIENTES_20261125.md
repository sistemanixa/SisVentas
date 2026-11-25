# Cierre de pendientes anteriores · trabajo retomado · 25/11/2026

El titular aclaró que el alcance incluye los pendientes anteriores de OT/Stock/Compras y la optimización operativa del servidor; pidió repartirlos entre los cinco chats existentes. Base pública v3.21.15 fuente4ef9f97c, cierre37e1cbab. La suite verde de esa publicación NO acredita migraciones que quedaron fuera.

## Propiedad de los frentes

- OT: comandos, metadata, conteo, creación/relaciones, entrega/rendición/cierre y sus clientes.
- Stock: referencia P/J/R, vínculo explícito y ausencia certificada/inicialización.
- Compras: modelos, comandos, numeración, listas, USD y cliente typed.
- Consultas: medición por función/ruta y optimizaciones seguras de recorridos actuales.
- Reglas/preparación: contrato firmado, cierre de escritores, permisos y emulador.
- Coordinador: Guard/Store/runtime/index, activos/versiones y publicación conjunta. Cada frente trabaja desde37e1 en copia propia y entrega commits acotados; no incorporar WIP histórico completo.

## Primer puerto compartido local

Store.queryPage conserva la allowlist exacta revisada de fed81584 para productos, inventario_operativo y dos índices stock_vinculos; límites2..129 y consultas dirigidas. No amplía readQuery de directorios ni permite raíces comerciales completas. Scope.queryPage consulta originales, sin mezclar staging; el consumidor conserva la obligación de validar su readSet/autoridad y registrar frescura. beforeCommit.queryPageFresh comprueba lease antes y después del IO; ausencia del puerto es503, nunca inventario vacío.

24 pruebas PASS de Store/Guard/puerto con datos ficticios: parámetros REST, consultas inválidas sinHTTP, respuestas independientes, vencimiento en planificación/precommit y uso tras cierre. No Rules, runtime, claims de escritura, datos reales ni despliegue modificados. Este puerto NO habilita por sí mismo Stock/OT/Compras. Falta integración de autoridades y verificación completa conjunta.

## Composición remota observada, sólo lectura

Cotizador: revisión cotizador-returncfg-32113, imagen6b6276dd6b53f3ea745be726e0b277eaabf7d571a44e1948932756303045a01a. Lifecycle/Delivery/OTOfficeCount/OfficeStock/ClientAccounts/CommercialPages/OperationalSummaries habilitados; ClientHistory/ClientHistoryRead/SaleFinancialDependencies deshabilitados. No se infiere por eso una cohorte mapped instalada. No cambiar esos controles para hacer pasar una prueba.
