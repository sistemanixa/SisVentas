# Stock de oficina · integración local

Estado al 8/11/2026: versión local v3.19.19, no publicada ni activada. El checkpoint 34e089ce era sólo el prototipo. La integración añade menú, permisos, readiness, adaptador autenticado, servicio y guardado protegido.

Lista con foto, producto y cantidad disponible; hasta 50 productos por página. El buscador filtra productos cargados, no promete búsqueda histórica indexada. El lápiz solicita cantidad nueva y observación obligatoria; historial muestra anterior/nueva, usuario, fecha y motivo. Administrador y administrativo necesitan módulo y acción autorizados; Ver como no permite operar.

Sólo cambia general: disponible sin reservas ni materiales entregados. Reservas, consumos, costos, asignaciones, recibos, compras, ventas, pagos y comisiones se conservan. Primer conteo explícito permite crear disponible, incluso cero, conservando anterior desconocido mediante anteriorDesconocida; no inventa reservas o consumos. Se reutiliza ajustesConteo, sin segundo historial.

Se lee el registro vigente al editar. El comando compara versión/contenido, valida unidad confiable y revalida permisos antes del commit atómico de original, resumen y recibo. Alias históricos se resuelven sin duplicar inventarios; la ambigüedad rechaza el ajuste. Respuesta incierta consulta recibo sin repetirlo. Cantidades precisas sin redondeo automático.

Revisión paralela corrigió readiness persistente tras fallo recuperado. La recuperación de respuesta incierta permanece dentro del diálogo nativo. Reglas candidatas agregan validaciones finales sin ampliar concesiones de lectura/escritura; sólo propuestas locales.

Validación definitiva en curso: focales, aplicación completa escritorio/móvil, emulador ficticio y puerta general. Registrar resultados finales en CONTEXTO_ACTUAL al cerrar. Una ejecución iniciada no acredita aprobación.

Producción requiere paquete mínimo separado de la preparación OT heredada, revisión de servidor/reglas/configuración y permisos. Nada fue activado en este bloque. La demo usa servidor/base en memoria y CSP de conexiones sólo al mismo origen; no conecta Firebase real. No equivale a una sesión real del titular.
