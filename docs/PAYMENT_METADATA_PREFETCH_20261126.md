# Precarga acotada de metadatos de cobros — 2026-11-26

Follow-up de 7e3afefb; un único archivo de producto: commercial-sale-payments.js.

Los buckets se derivan exclusivamente de originalRead.record, consumido de la autoridad privada de Ownership, con fbKey canónica de la ruta. Cobertura y buckets arrancan en el mismo pool, limitado por readConcurrency (16 en este GET), y comparten observed memo con Snapshot. No se anticipan cobros ni respuestas: Snapshot todavía valida cobertura y pertenencia; cada bucket y fuente se relee; autorización, propiedad y cobertura finales mantienen su orden. No hay nuevas rutas, consultas amplias, caché entre peticiones ni escrituras. Un error espera el drenaje de los trabajadores del pool.

50/50 focales: metadata-prefetch, authorization-latency, commercial-sale-payments y commercial-sale-payments-http. Los cinco casos nuevos comprueban solapamiento inicial/conteos exactos, mutaciones de bucket y cobertura con error específico, cobertura no preparada sin leer cobros, y concurrencia total/drenaje ante fallo. node --check y git diff --check correctos.

Medición reproducible: node scripts/measure-payment-reader-latency.cjs 7e3afefb. Misma fixture ficticia, fuentes anteriores compiladas en memoria, 39 lecturas antes y después. RTT20:409→379ms; RTT80:1209→1103ms; RTT175:2416→2241ms. Son muestras locales, sin certificado de emulador ni percentiles de producción. No navegador, suite global ni cambios remotos. Root integra y congela las fuentes.
