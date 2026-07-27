# Reconstrucción progresiva del núcleo de SisVentas

## Estado y objetivo

La versión `v2.0.194` permanece como referencia estable en `origin/main`. El
núcleo `v3` se construye en paralelo y se carga en modo sombra desde
`index.html`, pero queda inactivo por defecto: no reemplaza pantallas, no escribe
Firebase y sólo se ejecuta con una habilitación diagnóstica explícita.

La auditoría estructural inicial encontró:

- `js/app.js`: 33.470 líneas, 1.730.666 bytes y 1.215 funciones declaradas.
- 261 operaciones Firebase directas dentro de ese mismo archivo.
- 435 manejadores `onclick` embebidos en `index.html`.
- índices anteriores que asignan `mapa[numeroVisible] = registro`; ante un
  duplicado, el último registro reemplaza al anterior sin aviso.

Estos valores explican por qué corregir un módulo podía alterar otro y por qué
las pruebas pequeñas no detectaron el bloqueo de datos reales. El problema no
es Firebase ni el tamaño actual de la empresa: es la falta de límites internos
entre identidad, datos, cálculos y pantallas.

El objetivo no es volver a escribir pantallas. Es sustituir gradualmente las
reglas internas que hoy están repetidas en un archivo monolítico por una única
fuente comprobable para identidad, relaciones, métricas y persistencia.

## Reglas obligatorias

1. `fbKey` es la identidad técnica inmutable de cada registro.
2. `PP-0031`, `V-100`, `OT-054`, nombres y códigos son datos comerciales:
   pueden mostrarse y editarse, pero no son claves de base de datos.
3. Una relación nueva guarda siempre la clave técnica del registro relacionado.
4. Si un dato histórico sólo tiene un número o nombre, se acepta únicamente
   cuando existe una coincidencia única.
5. Una relación ambigua o inexistente se informa; nunca se elige “el primero”.
6. La misma colección canónica alimenta tabla, filtros, tarjetas y totales.
7. Las consultas frecuentes usan índices construidos una vez. Ninguna métrica
   recorre todas las ventas dentro de otro recorrido.
8. Las migraciones de datos son primero de diagnóstico y luego reversibles. No
   se corrige información productiva de forma automática o destructiva.

## Componentes implementados

- `identity-index.js`: claves técnicas, coincidencias históricas únicas y
  conflictos explícitos.
- `domain-store.js`: repositorio en memoria e índices por dominio.
- `sales-read-model.js`: pagos, saldos y relaciones de ventas sin recorridos
  anidados.
- `ot-read-model.js`: una sola lista canónica para tabla y métricas de OT.
- `record-repository.js`: crea, modifica y elimina únicamente por clave técnica.
- `legacy-snapshot.js`: adapta datos históricos sin contaminar el núcleo.
- `shadow-comparison.js`: compara resultados actuales/nuevos y bloquea la
  migración si existe cualquier diferencia o conflicto.
- `attachment-task.js`: subida común para fotos y comprobantes con progreso,
  cancelación, tiempo límite y persistencia posterior a la confirmación.
- `data-lifecycle.js`: separa generaciones de sesión y descarta respuestas
  tardías para impedir que un usuario herede datos del anterior.
- `feature-gates.js`: ningún módulo nuevo toma control sólo por existir; exige
  comparación aprobada, modo activo y habilitación explícita por módulo.
- `v3-shadow-runtime.js`: ejecuta auditorías acotadas y de sólo lectura, con
  tiempo límite, resumen de conflictos y sin exponer datos personales.
- Pruebas de identidad duplicada, relación vencida, pagos duplicados, coherencia
  de OT y volumen.

## Orden de migración

1. Identidad y lectura de presupuestos/ventas.
2. Pagos, cuenta corriente y métricas financieras.
3. Órdenes de trabajo, fotos, documentos y estados.
4. Productos, proveedores y actualización de precios.
5. Escrituras mediante repositorios con validación y auditoría.
6. Eliminación del código legacy sólo después de comparar resultados y ejecutar
   los recorridos completos en un entorno de prueba.

Cada etapa se integra detrás de una capa de compatibilidad. Si una comparación
no coincide, la versión nueva no toma control y el conflicto queda diagnosticado.
