# Corte final de auditoría, preparado el 16/10/2026

**Estado: preparado y probado; todavía no aplicado a producción.** La revisión automática rechazó activar la nueva revisión sin autorización explícita de su alcance. Hay preguntas de autorización pendientes. Este documento no sustituye la constancia de un corte verificado.

## Estado comprobado

- Referencia compartida: main `e21c04e81ef3e43854d8f8630a7756ee0df8e1d4`, cliente publicado v3.11.10. La nueva rama remota `codex/referencia-gastos-personales` no se integró: es trabajo ajeno fuera de este bloque.
- Auditoría en `codex/traslado-nube-seguridad-20261015`, con merge explícito `2faacc66a20f047c8171ad5e13a14e03220ee232`. Paquete público aislado en `codex/publicar-auditoria-v31111`; primeros commits `8af13701fd972a753313ab1ad6d34090246ee185` y `c110e93df93eb76dafcaf454d144b1d57ab35000`. Consultar el SHA final entregado; las correcciones de inventario/configuración posteriores todavía no pertenecen a esos dos commits iniciales.
- Cotizador activo: `cotizador-00102-red`, 100%. Preparado: `cotizador-00104-zuh`, 0%, etiqueta `auditoria-v31111`. Se preservaron cuenta de servicio, recursos, secretos, configuración y etiquetas anteriores; solo se añadió `USER_DIRECTORY_ENABLED=true`.
- Asistente y funciones fiscales no se redesplegaron. No se generaron claves temporales, correos reales, facturas, ventas, cobros ni comisiones de prueba.
- Reglas remotas: `2fab3dfbda44e88c165729f4ab41bdcd8c3b36318f8dd280d81286675a20b56c`. No cambiaron durante las compilaciones `dryRun=true`.
- Candidata final vigente: `security/database.compact-final.candidate.json`, SHA normalizado **`e5dbd9b0ca5e7e63f7966184a39350184d55fa9d7c4111c23e82ef0beb4dbc10`**. Las candidatas `8c318727…` y anteriores quedaron superadas antes del corte: faltaba incluir Relevamientos y configuración heredada. No aplicarlas.

## Cambios concretos

| Área | Resultado preparado y motivo |
| --- | --- |
| Usuarios | Perfil propio por UID exacto, directorio interno mínimo y lista administrativa con campos permitidos. No se entregan contraseñas, tokens ni campos arbitrarios. Se cierran todas las lecturas crudas de perfiles, incluso para admin; editar usa la proyección del servidor. |
| Sesiones | Respuestas tardías se descartan por sesión/vista; la identidad protegida sigue vigilada y su revocación cierra el acceso. El estado de carga de Usuarios se completa también cuando los datos llegan por API. |
| Roles | Índice de 44 módulos, versión/revisión y validación contra casillas; se conservan bloqueados, permitidos, acciones y demás datos. Guardados consecutivos mantienen la revisión; se rechazan actualizaciones antiguas o concurrentes incoherentes. |
| Dominios | Lecturas comerciales, consultas propias de empleados y escrituras finales compuestas con el guard de contraseñas. Root comercial no se puede leer ni reemplazar. Clientes/productos siguen como dependencias explícitas de OT; bloquear su menú no equivale a eliminar materiales y selección de clientes de OT. |
| Relevamientos | El inventario de nombres detectó que no figuraba en las candidatas antiguas. Ahora tiene permiso explícito de módulo y conserva el guardado del borrador con claves de ítems seguras. Mantenimiento, migraciones e integridad quedan bajo Configuración. |
| Configuración | Se bloquea la lectura de una configuración de acceso obsoleta. Porcentajes de empleados se limitan a ámbitos comerciales autorizados; categorías salariales a Personal/Configuración. El técnico que no necesita porcentajes no los solicita. Logout borra esa caché y descarta respuestas anteriores. |
| Chat | Nuevos mensajes guardan UID y autor protegido. La edición/reacción pasa por transacción del servidor; una persona no puede editar otro mensaje, falsificar su autor, modificar una reacción ajena o reemplazar un canal. Recibos y escritura se atribuyen al UID real. La limpieza de canal conserva su autorización administrativa. |
| Historia del chat | No se reescribieron mensajes existentes. Sin UID histórico, solo se mantiene la edición cuando autor/rol coinciden con el directorio protegido y el nombre es inequívoco; la ambigüedad se rechaza. Editar tras lectura está permitido; eliminar un mensaje leído sigue bloqueado. |
| Adjuntos históricos | Se valida el protocolo HTTPS al renderizar: escapar HTML por sí solo no evita un enlace javascript. La visualización no reescribe mensajes guardados; los adjuntos válidos conservan audio/imagen/documento. |
| Ver como | No publica presencia con el nombre/rol simulado. Es una vista administrativa, no una sesión Firebase Auth del técnico ni una validación de sus reglas reales. |

El inventario privado revisó 8 perfiles, 5 roles versión 7 y 57 nombres de dominios, sin exportar registros comerciales. No encontró UID duplicados ni vínculos internos de empleados incorrectos. La excepción de Distribuidora sin empleado asociado es válida, no un vínculo a reparar. Se encontraron dos campos heredados de credenciales en ubicaciones distintas: sus valores no se leyeron ni se copiaron. El borrado puntual está pendiente de autorización y no cambiará contraseñas de Auth. El informe original y los detalles privados siguen fuera de Git.

## Evidencia y límites

- 54 pruebas RTDB en `demo-sisventas-security`, loopback, aprobadas: consultas propias/ajenas, permisos/acciones, guard temporal/versiones, cuentas, concurrencia de stock, directorio, chat y Relevamientos.
- 94 pruebas del servidor existente aprobadas. Nuevas pruebas de directorio/chat/cambio de sesión forman parte de la suite general del cliente; no sumar esas cifras como si fueran la misma puerta.
- Paquete aislado final: **1.599 pruebas generales aprobadas**, cero fallos. Rama de auditoría: **1.617 aprobadas**, cero fallos; incluye pruebas/generadores de las candidatas que no se mezclan en el paquete público. Sintaxis, diff y coherencia local v3.11.11 verificados.
- Navegador aislado: 66 comprobaciones de directorio en siete roles/escritorio/móvil emulado; 20 de acceso; 24 de Proyectos y puente al editor; presencia de chat comprobada con fixture. No usan usuarios reales ni red de negocio.
- Servidor preparado: 20 respuestas 401 de diez rutas con sesión ausente/inválida; comparación íntegra de configuración anterior, exceptuando el flag añadido. Las reglas final/lecturas/directorio compilaron en el compilador remoto mediante el mismo `dryRun=true` que usa Firebase CLI, sin aplicarse.
- Producción anterior: 12 comprobaciones adicionales 401 de Facturación, prueba fiscal, Asistente, aprendizaje/importación y comienzo OAuth. La autorización ocurre antes de emitir o consumir servicios externos. Se conservan las validaciones de catálogo público del servidor anterior, ensayadas con fixtures; no se crearon pedidos reales para probarlas.
- Local real: se recargó el administrador en v3.11.11; Usuarios terminó de cargar y se abrió/canceló la ficha de Mauro con su vínculo correcto. La primera comprobación móvil de Osmar mostró su nombre/cuenta; detectó la presencia simulada y originó la corrección. La sesión local terminó posteriormente y está en el acceso: no afirmar una segunda verificación autenticada terminada ni inventar su causa.
- Se comprobó el mecanismo de GET con contexto UID limitado, verificando primero el rechazo del nodo de control privado. Solo se leyeron estados HTTP/estructura mínima; no se generaron credenciales. Esto permite contrastar permisos de identidades existentes después del corte, pero no sustituye un login propio ni un teléfono físico.

No se ejecutaron operaciones financieras ficticias sobre producción para demostrar permisos. El login propio de Osmar y el teléfono físico/suspensión/reconexión siguen necesitando al titular/usuario; no obtenerlos cambiando su clave para una prueba.

## Orden del corte y reversión

1. Obtener aprobación del alcance vigente. No aplicar la candidata antigua mencionada en una pregunta anterior: fue reemplazada tras detectar Relevamientos/configuración.
2. Activar exactamente `cotizador-00104-zuh` al 100%, conservando las etiquetas. Si falla, restaurar `cotizador-00102-red` al 100%; no cambiar contraseñas ni secretos para probarlo.
3. Publicar el cliente compatible desde el paquete limpio. Verificar los activos HTTP y después actualizar el aviso de versión. Los clientes antiguos deben actualizarse antes de seguir operando; las reglas nuevas no conservan escrituras inseguras de versiones anteriores.
4. Ejecutar `node scripts/apply-audit-cutover.cjs --check`. Por defecto el script solo muestra un plan. `--check` lee huellas y compila; no cambia datos ni reglas.
5. Con aprobación, `--apply` exige `--expected-rules-sha` y `--expected-permissions-sha` completos. Guarda copia privada, añade el índice de Roles mediante PUT condicional con ETag y aplica exclusivamente reglas; no reemplaza la base comercial. Exige cliente v3.11.11 publicado y API compatible. Si falta ETag de reglas se hacen dos lecturas adicionales; no se presenta como un bloqueo atómico de la configuración remota de reglas.
6. Verificar huella, guard, rechazo de anónimos/desconocidos, lecturas por dominio y consultas propias con contextos UID; volver a comprobar UI con admin y usuario real disponible. Ante una respuesta incierta, leer el estado antes de reintentar. Si falla un recorrido necesario, restaurar las reglas exactas de la copia privada; nunca añadir lectura/escritura padre como arreglo.
7. La reversión de reglas no requiere quitar inmediatamente el índice: no cambia casillas y el cliente v3.11.11 conserva su revisión. Documentar el estado que realmente quede aplicado.

Herramientas transferibles en la rama de auditoría: `audit-user-metadata.cjs --check`
regenera el inventario privado sin leer valores de credenciales;
`verify-audit-read-contexts.cjs --check` comprueba GET tras el corte exacto;
`remove-obsolete-credentials.cjs --check` verifica los dos campos y entrega la
huella del perfil revisado, sin borrarlos. Su `--apply` requiere aprobación
explícita de ambos campos y `--profile-metadata-sha`. No llama a Auth ni conserva
copias de los valores eliminados. Sin modo explícito las tres herramientas
solo muestran un plan. Los JSON resultantes siguen en `tmp/`, fuera de Git.

## Hosting y cabeceras

El sitio actual sigue en GitHub Pages y no devuelve CSP, X-Frame-Options, nosniff, HSTS ni Referrer-Policy. Firebase Hosting `nixa-sisventas-seguro` ya existía con una publicación antigua: no se confunde con producción vigente.

Se creó el recurso de dominio/certificado de `ventas.sistemanixa.com`, sin tocar DNS ni tráfico. Está pendiente la aprobación para el TXT de validación en Squarespace. El destino actual sigue siendo `sistemanixa.github.io`; no tocar correo, dominio raíz, `www` ni otros servicios. Preparar TLS antes de cambiar el CNAME y verificar certificado, activos y cabeceras. Guardar el destino anterior para revertir.

`scripts/deploy-secure-hosting.cjs` solo publica activos públicos y ahora exige checkout limpio y `--expected-commit` completo. Sin `--apply` no autentica ni despliega. La política CSP de compatibilidad mantiene inline/eval porque la aplicación actual los usa; no equivale a una CSP estricta sin scripts inline.

Si se autoriza el cambio de alojamiento, la publicación en Hosting debe incorporarse al procedimiento futuro: un push de GitHub Pages no actualizará por sí solo ese sitio. Ver [PUBLICACION_HOSTING_SEGURO.md](PUBLICACION_HOSTING_SEGURO.md). **La auditoría no se da por aplicada ni cerrada mientras estas activaciones sigan pendientes.**
