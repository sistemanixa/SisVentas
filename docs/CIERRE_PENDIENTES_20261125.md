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

## Integración local de autoridades y UI

Guard incorpora begin/sealDerived/validate de Compras y el puente genuino de corrección de costos; Store emite SourceCost V2 y vínculo sólo desde capacidades privadas, sanea claims entrantes y rechaza override mayor a16KiB antes del PATCH. Pruebas de falsificación, transporte y Guard27PASS; Link y validador de campos27PASS. La cadena conjunta recibir→conciliar→cancelar pasó4casos con Guard real y almacenamiento ficticio, sin afirmar RTDB por ese ensayo.

OrderProjection opcional postOperational conserva la fuente sellada sin sus derivados, verifica StockPolicy/PurchasePolicy y emite capacidad propia; ninguna bandera de cliente acredita el original. Runtime sólo lo acepta como puerto explícito, apagado por defecto.32pruebas de dominio/Store y43Guard/Link/Joint PASS. La composición de cohorte usa firmas y paquete reales:8casosPASS, incluidos OFF sinIO, presencia inválida sticky, cambio de paquete y lectura fresca de autorización. No está montada ni habilitada en producción.

UI Compras congelada dc605844 se integra separada de la publicación16;49casos focales de contrato/formulario/preparaciónPASS y5recorridos de montaje Stock390/768/1280PASS con datos ficticios. El primer intento del último grupo carecía NODE_PATH; se repitió con dependencias existentes sin instalar ni alterar expectativas. Falta composición completa de rutas, escritores OT, empaquetado y Rules finales. La candidata16 es otra rama limpia con presentación/directorio/OT acotados: no incluye esta migración.

Cotizador: revisión cotizador-returncfg-32113, imagen6b6276dd6b53f3ea745be726e0b277eaabf7d571a44e1948932756303045a01a. Lifecycle/Delivery/OTOfficeCount/OfficeStock/ClientAccounts/CommercialPages/OperationalSummaries habilitados; ClientHistory/ClientHistoryRead/SaleFinancialDependencies deshabilitados. No se infiere por eso una cohorte mapped instalada. No cambiar esos controles para hacer pasar una prueba.
