# Proyectos: ejecución y cierre

Bloque v3.18.0 preparado sobre v3.17.20. Estado externo y evidencia final en CONTEXTO_ACTUAL; este documento no acredita activación.

## Comportamiento

- Necesidades con ejecución reversible, nota técnica y fotos privadas. Archivar conserva necesidad, ejecución y fotografías; el responsable puede consultar y restaurar. Retirar una foto exige motivo y conserva su referencia histórica.
- Finalizar/reabrir exige responsable o administrador y motivo. Con pendientes, el cierre requiere confirmación explícita. Cerrado no admite modificaciones operativas hasta reabrir.
- Materiales de presupuesto aprobado, con identidad estable, cantidades previstas/utilizadas/devueltas. No mueve stock ni modifica ventas, cobros o comisiones. Importa todos los renglones dentro del límite explícito de 300 materiales y 220 KB por proyecto; rechaza excedentes sin confirmación parcial.
- Revalida el cliente al importar. No permite quitar un presupuesto que sostiene materiales preparados. No convierte productos ni crea entregas de stock.
- Técnico participante recibe sólo proyección operativa, sin presupuestos, precios ni totales comerciales. Cambiar integrantes nunca concede permiso comercial.
- Subida bloquea el cierre del diálogo; borradores de notas quedan sólo en memoria y se limpian al terminar sesión/cambiar rol. Las fotos pendientes de un conflicto se recuperan explícitamente; no hay limpieza por reloj ni eliminación concurrente de objetos.

## Listado y privacidad

`sv_project_lists/all` y `sv_project_lists/u_UID` contienen resúmenes del servidor, consultados de 50 en 50. Cada ficha se carga puntualmente. Búsqueda/filtros se identifican como aplicados a la página; no se presentan como búsqueda histórica global. Los indicadores de la cabecera representan esa página, no un total histórico.

Cada transacción marca su proyección pendiente y conserva los ámbitos anteriores. Escrituras monotónicas por revisión evitan que un escritor atrasado restituya una membresía revocada. La siguiente consulta repara como máximo diez pendientes; si faltan más, informa que debe reintentarse. La consulta nueva `resumen=1` nunca descarga todos los proyectos como fallback con PROJECT_LISTS_ENABLED. Se conserva el contrato anterior sólo para navegadores que aún tienen el módulo viejo; publicar Hosting y el aviso de versión para que lo sustituyan.

Las reglas propuestas sólo agregan índices, no permisos. Ambos nodos técnicos quedan cerrados a clientes. La preparación inicial debe respaldar y verificar originales y reglas frescos, sin sobrescribir un cambio concurrente. El corte sólo cambia Proyectos y no pausa finanzas.

## Fotos y costos

`PROJECTS_MEDIA_BUCKET` requiere bucket propio de Proyectos, acceso uniforme y prevención de acceso público enforced. No reutilizar finanzas personales ni cambiar el bucket público del catálogo. Original hasta 2 MB y miniatura JPEG hasta 112 KB; miniatura al consultar y original al ampliar. Se sirve autenticado, sin enlaces públicos ni caché compartida. Las referencias pendientes se reservan antes de almacenar bytes y se eliminan de esa cola al confirmar la foto; un conflicto conserva la recuperación.

Estimación comunicada: menos de USD 1 por compilación/preparación; almacenamiento y transferencia de fotos por uso. No agrega procesos periódicos ni instancia permanente. PDF excluido hasta contar con las referencias del titular.

## Activación y límites

Actualizar únicamente Cotizador conservando recursos, mínimo cero y sus accesos existentes. Habilitar PROJECT_LISTS_ENABLED y PROJECTS_MEDIA_BUCKET después de preparar/validar los nodos. Esperar el drenaje de la revisión anterior antes de cerrar la cobertura del índice. Servidor candidato sin tráfico, pruebas aisladas, reglas compiladas/verificadas y Hosting desde SHA limpio revisado. No usar proyectos reales como pruebas de guardado.

Las pruebas no garantizan ausencia absoluta de fallas; detallan recorridos, conflictos, permisos y límites comprobados. No afirmar publicación por sólo tener un commit o demo.
