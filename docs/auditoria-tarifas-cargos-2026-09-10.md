# Auditoría de tarifas de cargos — 10/09/2026

## Alcance y evidencia

Revisión del archivo activo `js/app.v3.5.4.js`, módulos de PC/móvil, inicialización Firebase, scripts de publicación, mantenimiento, cotizador y funciones de servidor disponibles en este repositorio. No se modificaron tarifas de producción ni se hicieron pruebas de escritura sobre datos reales.

Los seis valores observados coinciden con la antigua semilla: B/C 9700, A 7500, Administrativo 8700, Inicial 6750, Temporal 7200. No se encontró un proceso que aplique periódicamente 50% a la tarifa. B/C habría dado 9675 sobre 6450, no 9700. Esta coincidencia señala la semilla, pero no demuestra que se ejecutó en el incidente: no hay trazabilidad histórica suficiente de horas extra.

## Caminos de escritura

| Camino | Hallazgo | Tratamiento local |
|---|---|---|
| cargarCargos / listener | Escribía toda la semilla si recibía null | Eliminada escritura; lectura exclusivamente |
| Guardar fila PC | Sin comparación contra servidor; historial sólo de hora normal | Transacción con base mostrada, validación e historial por campo |
| Guardar móvil | parseFloat o cero; podía enviar valores viejos | Conserva base de la tarjeta, pasa texto al validador y utiliza la misma transacción |
| Editar cargo / modal | Reenviaba todos los campos desde un formulario posiblemente antiguo | Captura base al abrir y rechaza cambios concurrentes; conserva otros campos del cargo |
| cargosEditarRapido | Ruta heredada que escribía sin Guardar e historial incompleto | Sólo prepara campo y habilita Guardar |
| Copiar hora a extra | Acción explícita; ya no guardaba automáticamente | Mantiene esa conducta; valida formato antes de copiar |
| Nuevo cargo | Carrera entre comprobación local y creación | Transacción rechaza un ID que ya existe |
| Eliminar cargo | Borrado explícito tras confirmación y control de empleados locales | Agregado control administrador; no se convierte en reposición automática |
| Solo comisión | Cambio explícito de modalidad pone tarifas en cero | Se conserva como comportamiento de negocio y queda auditado |
| Aprobación de horas | Lee valorHoraExtra del cargo vigente del empleado | No escribe tarifas; solicitudes pendientes no congelan tarifa |
| Mantenimiento, cotizador y publicación | No se hallaron escrituras de cargos en las rutas revisadas | Sin cambios |

## Correcciones y pruebas

El guardado ahora conserva auditoría de cada campo, incluyendo hora extra: anterior, nuevo, fecha/hora, usuario y versión. El historial existente de hora normal se conserva separado para sus avisos. El visor incorpora el historial nuevo. El control de concurrencia compara los campos enviados con la base mostrada; no sustituye una tarifa concurrente ni recrea un cargo eliminado. Transacción con applyLocally:false; no se anuncia éxito antes de committed.

Se rechazan vacío, negativo, texto parcial y formato ambiguo con separadores de miles. Se admite decimal con punto o coma, sin miles, y cero explícito. Hora normal y extra siguen siendo independientes.

Pruebas ejecutadas: `cargos-carga-sin-escrituras.test.js` y `cargos-tarifas-seguras.test.js`, más sintaxis de app y módulo móvil. Cubren reconexión/nodo vacío, independencia, edición concurrente, creación simultánea, cargo eliminado, conservación de otros campos, auditoría, entradas inválidas y denegación por rol. Son pruebas con dobles de Firebase; no constituyen una prueba de reglas de producción.

## Límites pendientes

- No hay reglas de Realtime Database versionadas ni herramientas administrativas Firebase/gcloud disponibles en esta sesión. `storage.rules` corresponde a archivos, no a cargos. Las reglas efectivamente desplegadas no fueron verificadas. El control de rol de interfaz NO reemplaza reglas de servidor.
- Los JS históricos disponibles, incluido app.js, aún contienen el código anterior. No se modificaron artefactos históricos. Una sesión antigua puede seguir escribiendo con su lógica mientras el servidor lo permita. Publicar la corrección y actualizar clientes es necesario; una garantía contra clientes antiguos requiere revisar/endurecer reglas reales.
- No se encontró un restaurador genérico de cargos en el código activo. No se pueden descartar restauraciones externas, consola o scripts fuera del repositorio.
- El historial anterior no permite atribuir el incidente a fecha/usuario/proceso. No se inventó ni reconstruyó historial.
- El borrado conserva la comprobación de empleados del código existente; no se implementó una transacción conjunta entre empleados y cargos. No explica la reposición de todas las tarifas.
- Los cambios permanecen locales y no se han publicado. Los importes existentes siguen intactos.
