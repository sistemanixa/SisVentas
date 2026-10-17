# Proyectos móvil · candidata local v3.12.1

17/10/2026. Rama `codex/proyectos-movil-integral`, desde `89705b74cf73249c00257099bfc984ac4e35b23b`. Producción continúa v3.12.0; no se publicaron cliente, servidor ni reglas en este bloque.

## Hallazgos y corrección

- La barra de etapas era solo decorativa y competía con las solapas. Cambiar etapa estaba escondido dentro de Editar ficha. Se reemplazó por «Etapa del proyecto» y «Cambiar etapa» explícitos, con descripción de cada opción. Usa la actualización existente, revisión y permisos del servidor; no aprueba presupuestos ni crea ventas/OT. Editar otros campos conserva la etapa.
- En móvil las cuatro solapas quedan en dos filas visibles, sin desplazamiento lateral. Cambiarlas actualiza el panel sin reconstruir los controles ni perder el foco; incluye navegación por teclado y relaciones tab/panel. Cabeceras/acciones ajustadas, controles táctiles de 44 px e inputs de 16 px para evitar zoom de foco en iOS.
- El buscador de integrantes marcaba `hidden`, pero `display:flex` lo anulaba. Corregida la regla; se comprobó que el integrante no coincidente deja de tener rectángulo visible y vuelve al limpiar el texto. Buscar no desmarca integrantes seleccionados.
- Las condiciones del borrador no llegaban a Observaciones del presupuesto comercial. Ahora se copian al preparar el formulario. Sin cantidades o permiso no se reemplaza el formulario.
- Se muestra Aprobado/Borrador en vez de estados internos como aprobado_int. Un proyecto sin necesidades pide agregar la primera en lugar de afirmar que todo está definido. La respuesta de vínculo actualiza la ficha, sin retroceder una revisión posterior ni repetir el evento de guardado.

## Ejemplo recorrido en navegador

Servidor aislado `scripts/dev-projects-flow.cjs`, puerto configurable `SV_PROJECTS_FLOW_PORT` (se usó 8771). `/mobile` ofrece iframe de 390 px; `/` vista completa. Solo loopback, rutas permitidas y CSP sin conexiones externas. Identidades ficticias; servicio/modelo Proyectos reales sobre RAM. No usa Firebase real ni importa demo a producción. Recargar conserva mientras siga corriendo; reiniciar el servidor pierde el ejemplo.

Se usan formulario, creación de filas, cálculo y guardado comercial extraídos de la aplicación activa. Se sustituyen explícitamente autenticación, persistencia, catálogo y auxiliares de aprobación/documento de la prueba; no acredita facturación, aprobación real, impresión, selección de catálogo ni todo el módulo comercial. No lanzar los scripts históricos de navegador por shell: la interacción se hizo con CUA.

Ejemplo creado desde cero: Seguridad del edificio Mirador, cliente ficticio, domicilio, objetivo y fecha 05/11/2026; responsable más Lucía editora y Mateo lector. Tres necesidades: dos cámaras, cableado inicialmente sin cantidad y luego 35 m, ocho horas de instalación. Se comprobó bloqueo por cantidad faltante, modificación posterior, quitar/reincorporar integrantes, búsqueda y guardado.

Dos propuestas vinculadas: $487.630 (403.000 + IVA 84.630) y alternativa $475.530 (393.000 + IVA 82.530). Se usó el guardado comercial extraído y la asociación real del servicio aislado; alternativa conserva condiciones. Avance Planificación → Presupuestando → Presentado → Aprobado, edición de domicilio sin retroceder etapa y reapertura tras recargar con tres necesidades, tres integrantes y dos presupuestos conservados. No se suman alternativas como una compra.

En 360 px: ancho interior343, scroll343, cuatro solapas de 44 px; diálogo de etapa dentro del viewport. Al reducir altura de760 a460, el campo mantiene foco/texto y tamaño16; cancelar conserva el original. Es una simulación de espacio disponible, no un teclado físico. La consola del contenedor aislado tuvo una excepción MutationObserver sin fuente/stack identificados; no atribuir ni presentar como consola móvil totalmente limpia. La aplicación completa local v3.12.1 abrió Proyectos con sesión existente y sin errores/warnings observados, solo lectura.

## Verificación y entrega

1.784 pruebas generales, incluidas seis regresiones nuevas del flujo; seis de integración en RTDB emulado aprobadas. Primer intento de emulador no abrió el puerto en sandbox; repetición con acceso loopback pasó. Reglas propuestas no desplegadas. Sintaxis, diff y coherencia local de versión correctos.

Espejo8766 actualizado explícitamente y ventana local abierta en Proyectos, v3.12.1. Ejemplo separado en http://127.0.0.1:8771/mobile. Evidencias privadas: `C:/SisVentas/tmp/proyectos-movil-*`. No publicar fixtures, logs ni ejemplos. No se guardaron operaciones reales ni se cambiaron permisos de producción. Falta prueba en teléfono físico y autorización/revisión del titular antes de publicar este bloque.
