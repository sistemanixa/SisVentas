# Presentación de proyecto · v3.19.8

Alcance autorizado: botón **Modo presentación** únicamente para Administrador en PP-0167. Vista y PDF dinámicos a partir del presupuesto guardado, con cantidades, descuento e importes globales. USD usa la cotización que muestra la barra superior al abrir/exportar; se identifica en el documento. No cambia presupuesto, costos, ventas, cobros, comisiones, stock ni históricos. No es un despliegue de eliminaciones/Tecnoprices ni una certificación de toda la auditoría.

## Fuente y seguridad

- Frontend parte de la fuente publicada `8de364cd728067c651cd514bc83b841b64ac6258`. La aplicación inmutable nueva sólo agrega versión/Novedades; el componente es independiente.
- Endpoint nuevo, de lectura: `POST /presupuestos/presentacion-proyecto`. Token vigente, identidad activa Administrador, permiso de Presupuestos y control de restablecimiento; revalida autorización y presupuesto antes de responder. No acepta una clave arbitraria distinta de la prueba privada configurada. No entrega costos, precios de línea ni metadatos privados del registro.
- Las seis ilustraciones aprobadas están en el bucket privado existente, fuera de Git y de Hosting. Se comprueban privacidad, secuencia, tamaño, dimensiones y SHA256. Sólo se descargan al abrir explícitamente la presentación. Exportar vuelve a consultar los datos sin descargar las imágenes otra vez. Sin sondeos ni generación automática de imágenes.
- La vista descarta respuestas tardías al salir/cambiar sesión. Ver como no habilita el botón. Preview y PDF conservan el mismo snapshot; cambios detectados antes o durante la exportación obligan a revisar la vista actualizada.
- Las imágenes son ilustrativas y se recortan sin mostrar los textos/precios originales de las láminas. Equipos, cantidades y totales son DOM dinámico; si se agregan ítems, la paginación se adapta. No se publica un visor de seis PNG estáticos.

## Servidor sin mezclar cambios pendientes

El servidor vigente no corresponde al checkout del frontend. El Dockerfile de `cotizador/presentation-overlay/` extiende su imagen exacta e inmutable y agrega únicamente el endpoint/modelo. `attach.cjs` exige el SHA256 exacto del entrypoint publicado y verifica que retirar sus dos inserciones recupere cada byte original. No modifica los otros recorridos. No desplegar el `cotizador/index.js` de este checkout por analogía.

Base de imagen `cotizador:return910199-bbf61e86@sha256:09a9d7f6bfffb4a13ec2aa00235dbc52c442bc4f86737d49f3d82a161888353f`; entrypoint SHA256 `50e9a049d412515ad4062af0acb793b9a268d3919da97376e4f4dbd66c7bee85`. Candidata `cotizador-presentation3198-a75ce892`, imagen SHA256 `813a22a1b2614280109ddecd2320c5ac9a768963c8cc2cf80bc6e00f52ef813b`. Configuración, recursos, cuenta de servicio y accesos anteriores conservados. Sin IAM, reglas, servicios ni tareas por reloj nuevos.

## Evidencia local y límites

- Modelo: 61 casos ficticios PASS; servidor: 61 PASS. Los rojos iniciales se conservaron; se corrigió una eliminación concurrente que no era detectada al comparar sólo el DTO.
- Interfaz: 4 casos Chrome PASS, 390/1280, cero consultas iniciales de presentación, lectura explícita, cambio de ítems/cotización, retiro por rol y descarte de respuesta tardía. No se usó Firebase real como fixture.
- PDF real generado desde escritorio y móvil: seis páginas apaisadas, renderizadas con Poppler e inspeccionadas. Se corrigió un corte lateral producido por forzar un viewport de captura distinto del real. Sin página inicial vacía. Evidencias privadas fuera de Git.
- Puerta vigente completa con Chrome: 9.748 casos, 9.717 PASS, 0 FAIL, 31 SKIP, exit 0. Los cuatro casos de interfaz nuevos se ejecutaron aparte después de la selección inicial de esa puerta. Las 31 omisiones especiales no se presentan como aprobadas.
- Candidata remota sin tráfico: endpoint sin autenticación 401, preflight 204 con origen correcto, endpoint comercial existente 401. Estas verificaciones no equivalen a una prueba autenticada de la vista en producción.

La publicación y el aviso de versión sólo se consideran completados tras verificar los activos reales y el recorrido autorizado. El estado externo de ese cierre se registra en CONTEXTO_ACTUAL; este documento no afirma por sí solo que se activó tráfico.

## Ajuste visual posterior v3.19.9

La primera comprobación autenticada de 3.19.8 detectó siete páginas: NSPanel quedaba en Iluminación. La 3.19.9 distingue panel de control de panel/tecla eléctrica y conserva las seis páginas del documento revisado. El ajuste de padding de la tabla económica evita que nombres largos empujen el total y su equivalente sobre el pie. Se conservaron los rojos ficticios y se revisó un PDF de la copia documental real en modo sólo lectura. No cambia ningún cálculo, clasificación financiera ni presupuesto. La evidencia de la puerta final de 3.19.9 y el cierre externo se registran en CONTEXTO_ACTUAL.
