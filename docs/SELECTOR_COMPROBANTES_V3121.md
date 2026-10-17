# Selector visual de Comprobantes · candidata v3.12.1

17/10/2026. Rama `codex/proyectos-movil-integral`, base de este bloque `af04ddc2a1a1b918b1e8981e1bd057eb892dcfcc`. Conserva Proyectos móvil y lector compartido anteriores. Sin publicación ni cambios en datos reales.

## Comportamiento

- Sustituye el desplegable de texto por búsqueda visual centrada, con miniatura, código, nombre, marca y precio. Busca palabras sin distinguir acentos y permite filtrar por marca. Presenta hasta 80 coincidencias y pide afinar la búsqueda cuando hay más.
- Recibe exclusivamente los productos habilitados devueltos por `/opciones` de Comprobantes. No amplía la lista con Productos de SisVentas. El servidor conserva los filtros existentes de categoría, actividad, visibilidad y precio válido.
- El servidor agrega foto, marca y descripción del catálogo público, sin costos ni datos privados del proveedor. URLs de imagen inseguras se omiten. Un producto sin foto sigue disponible con el marcador correspondiente.
- Compatibilidad con servidor anterior: únicamente para imágenes, el cliente puede reutilizar una foto ya disponible en la caché autorizada de Productos, por ID previamente permitido. No incorpora productos ni precios desde esa caché. Para disponer de fotos/marcas en todos los roles hace falta publicar también el servidor candidato; todavía no se desplegó.
- Conserva lectura QR/barras dentro del buscador. El resultado solo filtra; agregar exige seleccionar explícitamente. Repetir un producto incrementa cantidad. USD se muestra entero, conservando el importe preciso original para cálculo/emisión. No recalcula documentos anteriores.
- Diálogo nativo, cabecera/pie opacos, scroll propio y bloqueo/restauración del fondo. Cierre, cambio de sección y fin de sesión liberan el lector. Revalida sesión y borrador antes de agregar.

## Evidencia y límites

- 1.795 pruebas generales y 94 de servidor aprobadas; 17 específicas de selector/Comprobantes incluidas en las generales. Sintaxis, diff y coherencia local v3.12.1 correctos.
- Prueba de interfaz aislada en `http://127.0.0.1:8773/`: miniaturas cargadas, búsqueda por nombre, marca, búsqueda sin coincidencias, selección y repetición incrementando cantidad. Tres fotos vectoriales ficticias. En 390 px diálogo centrado, sin desborde horizontal; comprobación también en escritorio. No se emitieron comprobantes.
- Cámara simulada con decodificación real Code128 SN-001: vuelve al selector con una coincidencia y cero productos agregados. La prueba física de cámara/sonido permanece pendiente.
- Espejo local 8766 actualizado y ventana principal efectivamente recargada, autenticada y devuelta a Productos tras consultar Distribuidora. Selector visual mostrado y fotografiado en fixture aislado; no afirmar emisión autenticada real ni cobertura de todos los roles con el servidor remoto anterior.
- No cambian permisos, Firebase, Hosting, Cloud Run, contraseñas, correos, stock ni cobros. Producción permanece v3.12.0/servidor `cotizador-load-d849afb4`.

Próximo paso: revisión del usuario del selector y publicación conjunta cliente/servidor cuando corresponda; mantener abiertos los pendientes de auditoría y el incidente de fetch documentados en CONTEXTO_ACTUAL.
