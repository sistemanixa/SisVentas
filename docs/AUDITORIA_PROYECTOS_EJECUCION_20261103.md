# Revisión independiente de Proyectos · 03/11/2026

Alcance revisado: commit fe5989b337a88b78f834f81b9c256c493c4b4ec3 en la rama local salarios-por-periodo, aún sin integrar en la aplicación publicada v3.17.20. Sólo análisis y reproducciones ficticias: cero escrituras reales, sin cambios de infraestructura ni publicación.

## Hallazgos que conviene resolver antes de publicar

1. **P1 · Una necesidad ejecutada puede perder su historial al quitarla.** `cotizador/projects-model.js:67` elimina la necesidad completa si no está vinculada a un presupuesto; no protege notas técnicas ni fotografías. Reproducción: una tarea realizada con nota y foto queda eliminada, sin copia de esa ejecución en el proyecto. Archivar con trazabilidad o impedir la eliminación cuando tenga ejecución; preservar el historial.
2. **P1 · Escape durante una subida pierde la nota en edición.** `js/modules/projects.js:143` deshabilita botones, pero no establece `dataset.uploading`, que controla el cierre en la línea152. Prueba de navegador con FileReader demorado: Escape cierra, la fotografía se guarda después y la nota no guardada se pierde. Bloquear/cancelar el cierre de manera coherente y conservar el borrador, incluso ante error/cambio de sesión.
3. **P2 · Foto huérfana ante conflicto concurrente.** `cotizador/projects.js:100` guarda el archivo antes de confirmar su referencia mediante transacción. Reproducción ficticia con revisión modificada entre ambos pasos:409, un archivo almacenado, ninguna referencia en el proyecto. Hace falta recuperación o limpieza segura por generación del objeto; no borrar por error un archivo compartido por un reintento confirmado.
4. **P2 · Importación incompleta de materiales sin aviso.** `cotizador/projects.js:25` corta a200 renglones antes de preparar materiales. Presupuesto ficticio con201 productos: importación exitosa de200. Debe completar el alcance con límites explícitos o rechazarlo claramente, sin mostrar una importación parcial como completa.
5. **P2 · Vínculo comercial sin conciliación suficiente.** La importación no vuelve a comprobar que el cliente actual del presupuesto coincida con el proyecto. Reproducción: presupuesto cambia de cliente después de vincularlo y sus materiales se importan igual. Además, `budget-remove` permite retirar un vínculo con cantidades utilizadas: sobreviven los materiales, pero sin vínculo activo ni aviso de origen desvinculado. Conservar origen histórico y exigir conciliación explícita.
6. **P2 · El listado lee proyectos completos antes de filtrar.** `cotizador/projects.js:58` lee `sv_proyectos` completo. Fixture:60 proyectos leídos para devolver sólo uno al técnico. No implica que el técnico reciba los otros59, pero sí transferencia innecesaria y carga creciente de tareas/actividad/fotos. Preparar resumen acotado por usuario y detalle puntual; no limitar sólo el dibujo de la lista.

## Faltantes funcionales y de activación

- El flujo de etapas termina en Aprobado/Descartado; no hay cierre y reapertura operativos explícitos con pendientes visibles. El progreso por checks existe, pero no sustituye esa decisión final.
- Fotos reales: falta verificar/configurar el almacenamiento privado existente (`PROJECTS_MEDIA_BUCKET`, PAP y acceso uniforme), sin crear servicios o reutilizar un dominio privado ajeno por defecto. La implementación falla con503 si no está configurado; la demo no valida esta activación.
- No hay acción de retirar/corregir una fotografía equivocada con trazabilidad. Las imágenes se muestran como miniaturas, sin ampliación implementada.
- Conservar la identidad de materiales ya probada: reordenar no reasigna consumos, reemplazar producto no hereda rendición. Probar también líneas duplicadas y cambios de cantidades/variantes antes de una migración.
- El informe PDF continúa excluido hasta recibir las referencias acordadas.
- Integrar sólo archivos del bloque sobre la versión vigente, luego verificar en local con los permisos reales de cada rol. La rama antigua completa no es una fuente de publicación válida para la web actual.

## Validación repetida

Nueve pruebas de `test/projects-execution.test.cjs` aprobadas: checks, conservación al editar, importación sin precios/duplicados, proyección técnica, rechazo de metadatos inyectados, almacenamiento privado y permisos/revocación, identidad al reordenar/sustituir. Eso no cubría las reproducciones anteriores.

Pruebas adicionales privadas: pérdida de ejecución al quitar, desvinculación con consumo, lectura completa del listado,201→200 renglones, cambio de cliente, Escape durante subida y conflicto después de guardar imagen. Todas usan fixtures; la de navegador bloquea red exterior y usa sólo localStorage ficticio. Evidencias en `C:/SisVentas/tmp/projects-review/`, fuera de Git. Dos primeros intentos del fixture visual no cargaron por configuración de rutas/codificación; se corrigió únicamente el entorno de prueba y la reproducción UTF-8 final fue concluyente. No son fallos de Proyectos atribuidos al producto.

Conclusión: la base está implementada y tiene controles valiosos, pero este bloque todavía no debe considerarse terminado ni listo para publicar.
