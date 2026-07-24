# Reconstrucción progresiva del núcleo de SisVentas

## Estado y objetivo

La versión `v2.0.194` permanece como producción estable. El núcleo `v3` se
construye en paralelo y no está cargado por `index.html`; por eso estos trabajos
no pueden alterar el sistema que usa la empresa.

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
