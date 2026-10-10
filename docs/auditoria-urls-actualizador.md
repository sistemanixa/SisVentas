# Auditoría de URLs del actualizador — 2026-10-10

El actualizador obtiene los vínculos de `productos/<id>/proveedores/<índice>/url`. La compatibilidad con productos antiguos usa el vínculo principal cuando no hay filas de proveedores. El maestro de proveedores aporta configuración y credenciales, no una segunda lista de URLs de productos.

El modal conserva una cola de vínculos. `/cotizar-lote` recibe la URL de cada vínculo y el cotizador utiliza esa URL. Su caché en memoria incorpora la consulta completa, incluida la URL: resultados verificados durante 60 segundos y errores ML_VERIFICACION_SEGURIDAD durante 120 segundos. Cambiar la URL cambia la clave de caché.

## Fallas corregidas en v3.10.1

- La cola podía consultar URLs capturadas antes de una edición. Cada bloque ahora resuelve el vínculo vigente antes de enviarlo.
- Una respuesta tardía podía reaparecer como fallo del enlace anterior. Se descarta si cambió la URL.
- El guardado de resultados escribía un array de proveedores construido desde una copia antigua. Ahora una transacción por producto verifica proveedor y URL en Firebase y aplica el resultado sobre los datos actuales, conservando otras ediciones. Si cambió la fila, aborta.
- Cambiar URL intentaba modificar propiedades de vínculos congelados por la integración V3. Ahora reemplaza el vínculo para que el reintento use la URL guardada.

Pruebas: `test/actualizador-url-concurrencia.test.cjs` y `test/product-url-persistence.test.cjs`. Cubren URL cambiada antes de la consulta, respuesta tardía, memoria desactualizada respecto de Firebase, otros proveedores editados, reordenamientos y reintento desde vínculo inmutable.

No se modificaron URLs ni precios de productos reales en esta auditoría. Estas fallas demuestran riesgos del circuito anterior; no prueban que todos los errores de Mercado Libre fueran causados por ellas. La clasificación de bloqueo de cada publicación requiere revisar su respuesta específica. Incluido en la versión v3.10.1.
