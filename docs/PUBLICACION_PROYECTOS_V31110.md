# Publicación de Proyectos v3.11.10 (16/10/2026)

El titular aprobó el diseño y autorizó publicar Proyectos con servidor y permisos necesarios, verificando compatibilidad y sin tocar datos existentes.

## Preparación comprobada

- Código de primera versión: `8bd88beb1d0e9f87e74844b0ff5843c680004729`, rama `codex/proyectos-v31110`, desde main `2a0d01e747204e42c278fc2ddf0f4ae3f1aad893`. Fetch previo sin cambios ajenos pendientes en main. La auditoría general y el archivo histórico local modificado permanecen aislados en la copia original.
- 1.577 pruebas generales, 94 de Cotizador, 6 de RTDB emulado, 24 comprobaciones de interfaz y puente al formulario comercial, aprobados. También 20 comprobaciones de acceso existentes, con cuentas/correos ficticios. Sintaxis, diff y coherencia de versión correctos. No se guardaron operaciones de negocio como prueba.
- Reglas RTDB remotas exactas: hash normalizado `2fab3dfbda44e88c165729f4ab41bdcd8c3b36318f8dd280d81286675a20b56c`, igual a la base ensayada. Sin lectura/escritura de raíz ni concesión a `sv_proyectos`; el emulador verificó denegación directa para administrador, responsable, lector y ajeno. **No hizo falta desplegar ni ampliar reglas.**

## Servidor aplicado

- Cotizador se construyó desde la carpeta versionada con Dockerfile, sin node_modules/fixtures/archivos privados. Cloud Build `ad8ddf72-8b96-45a5-b189-5273926dfa9a`, SUCCESS.
- Revisión **`cotizador-00102-red`**, primero a 0% con etiqueta `proyectos-v31110`; luego activa al **100% del tráfico general** después de la validación.
- Comparación exacta de la especificación de ejecución: se conservaron variables, referencias a secretos, cuenta de servicio, recursos y demás opciones. Única variable añadida: `PROJECTS_ENABLED=true`. No se cambió IAM. Las diez etiquetas anteriores conservan su revisión protegida `cotizador-00100-boc`; no se retiró su guard de acceso temporal ni se cambiaron Asistente/Functions.
- 15 comprobaciones HTTP: rutas de Proyectos y rutas existentes de acceso, laboral, comisiones y cotización rechazan identidad ausente/token falso con 401; acceso RTDB anónimo a la nueva raíz también rechazado. Sin ejecutar operaciones comerciales.
- Administrador real desde la ventana local: listado vacío de Proyectos y formulario con opciones reales cargados correctamente contra la revisión preparada. Se canceló el formulario sin crear proyectos, asignar integrantes, vincular presupuestos ni alterar clientes. La vista previa ficticia sigue siendo local y no se migró al servidor.
- Los permisos son los del servidor: identidad interna activa, bloqueo por módulo/acción y membresía lector/editor. Responsable/admin gestionan integrantes. Se reutilizan los defaults de Roles sin reescribir configuraciones existentes. No es el corte pendiente de permisos por dominio de toda la auditoría.

## Cliente y estado de publicación

**Publicado y verificado.** Main recibió por avance normal `2bbc0fd12f0e778f0ae1cb94c1400d89f7a38aa2`, que incluye el código `8bd88beb1d0e9f87e74844b0ff5843c680004729`. GitHub Pages **`38850026864`**, completed/success. Los **14 activos HTTP** coinciden por SHA-256 normalizado UTF-8/LF con el paquete probado: índice, SW, aplicación/marcadores, CSS/modelo/módulo de Proyectos, permisos, Firebase, acceso y entrada/contexto de catálogo.

Después se ejecutó `scripts/actualizar-nodo-version.ps1 -Version v3.11.10`, que comprobó web/SW y escritura más lectura posterior de **`sisventas/config/version = v3.11.10-firebase`**. Esa marca es la única escritura de datos de la publicación; no se alteraron proyectos, clientes, presupuestos, ventas, cobros, comisiones, roles, contraseñas o correos reales como prueba. Las reglas se volvieron a leer: idénticas al respaldo previo. Tráfico final confirmado al 100% en `cotizador-00102-red`.

Ventana local restaurada al módulo exacto del repositorio, sin el destino temporal de prueba, sin `proyectos_preview=1` y con la sesión de administrador conservada. El servicio habitual cargó listado y formulario con sus opciones reales; se canceló sin guardar. La nota de cierre posterior cambia únicamente documentación y no requiere otro aviso ni despliegue del servidor.

Evidencia y respaldo privados en `.local/proyectos-v31110/tmp/publicacion-proyectos-v31110/`, fuera de Git. Reversión del servidor disponible a `cotizador-00100-boc`, que conserva el guard de acceso; no revertir a revisiones que lo omiten. Ante una reversión del cliente, conservar los proyectos nuevos y la raíz privada; no restaurar bases completas.

Límites: escrituras y conflictos probados con RTDB demo, no con proyectos de negocio. Sin validación de teléfono físico ni sesiones reales de todos los roles. Presupuestos comerciales conservan su política previa, aunque estén vinculados: ver [PROYECTOS.md](PROYECTOS.md). La auditoría general sigue pendiente en su rama.
