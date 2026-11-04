# Aviso → presupuesto puntual: inyección propuesta, sin montar

## Entrega funcional aislada sobre 53b8f128

Este bloque actualiza la propuesta de los apartados siguientes. Ya existe código importable: `js/core/dashboard-budget-notice-detail-proposal.js`, más `docs/patches/dashboard-budget-notice-detail-functional.patch`. Root no se modificó. El patch se aplicó y probó únicamente en `tmp/notice-detail-functional-contract`, copia congelada de 53b8f128. No sustituir archivos enteros en root85d0e730: fusionar los hunks y conservar su transporte, pluginGuard y demás cambios.

El módulo exporta `SVDashboardBudgetNoticeDetail.create(window,{capture,valid})`. Root debe cargar el archivo y asignar el resultado a `window._svBudgetNoticeDetailHost`, reutilizando la captura/validación de sesión existentes. No inventar épocas ni grants. El flag `window.SV_BUDGET_NOTICES_LOCAL` requiere true estricto y sigue OFF por defecto. Esta entrega no cambia index, versiones, Service Worker ni bootstrap root.

Delta previo al freeze: actor exige dataEpoch entero seguro >=0 y permissionSignature textual no vacía (tampoco sólo espacios). Capturas inválidas no leen; cambios posteriores retiran tanto snapshots listos como respuestas pendientes. La visibilidad se separa de la autoridad: ocultar conserva el mismo detalle autorizado y su retorno, pero open rechaza aperturas nuevas mientras hidden=true. Los eventos siguen comprobando la captura; ocultar no evita el retiro si realmente cambió. No se inicia una lectura automática por volver a visible ni se marca ready de nuevo para fingir una recarga. Validación del delta: 9 unitarias y 5 nativas PASS, 0 SKIP; logs privados notice-point-epoch-visibility-unit.log y notice-point-epoch-visibility-native.log. El caso nativo dispara visibilitychange y controla document.hidden en Chrome; no prueba minimizar físicamente una ventana del sistema operativo.

El helper implementa open/resolve/ownsPointView/claimsPointView/refresh/back/reset/dispose, y needsFormData/enterForm para acciones explícitas de edición. Reutiliza el request GET ya existente. Fija sesión/User, UID/rol, revisión/firma, epochs, db y grants; comparte lecturas pendientes al mismo key, descarta intenciones reemplazadas, retira la ficha al salir o cambiar autoridad y conserva errores sin fallback a caché. El retorno limpia el contexto de editor y restaura origen, scroll y foco cuando el elemento sigue conectado.

El patch funcional contiene el abridor por key, lookup puntual, readiness exclusivo, exclusión del loader y render diferido de lista durante el detalle, reintento puntual, retorno al origen, las cuatro acciones canónicas del generador y el botón interno editarPptoParaMigrar (incluye escape de key con apóstrofo). verPpto conserva su renderer real y no se reescribe ningún importe. Las filas puntuales no se agregan a pptoData ni completan la fuente presupuestos.

Abrir el aviso sólo hace el GET puntual. **Sólo si el usuario pide editar**, enterForm comprueba el permiso existente, deja la cobertura de detalle y solicita los cargadores reales del formulario; espera su readiness antes de ejecutar el editor original. Esas lecturas completas son reales por esa acción explícita: nunca se simula completitud con la entidad puntual. Clicks repetidos durante esa espera no adelantan el editor. No se guarda, convierte ni prepara un registro como efecto de abrir o editar el formulario de prueba.

Validación final: `test/dashboard-budget-notice-detail-runtime.test.cjs` **6 PASS, 0 SKIP**, y `test/dashboard-budget-notice-detail-native.integration.cjs` **4 PASS, 0 SKIP**. La prueba nativa usa Chrome real a 1280 y 390 px, index/app completos con showPage real, request real del cliente, renderer verPpto, acción interna de migración por Enter y retorno por el botón Volver. Comprueba un solo GET y pptoData vacío al abrir, readiness puntual, key con apóstrofo, base monetaria intacta, 403 por actor inactivo, 404 por key ausente, retiro durante lectura pendiente y ausencia de mutaciones de sisventas. La acción de formulario se abrió y canceló; no se probaron todos los formularios ni operaciones financieras.

El servidor es loopback ficticio basado en el fixture existente. El puerto Auth devuelve una identidad ficticia; el handler de prueba reproduce la rama GET con los métodos reales authorize/visibleRecordsByIds de commercial-ownership. No ejecuta cotizador/index completo ni Firebase de producción. Las primeras corridas detectaron un enlace incorrecto del fixture y un token ficticio esperado distinto: se corrigieron esos puertos; se agregaron aserciones explícitas de 403/404 para evitar falsos positivos. El código de navegación exitoso se volvió a ejecutar después de las correcciones finales.

Logs privados: `tmp/sdk-proof/notice-point-functional-unit.log` y `notice-point-functional-native.log`. Capturas revisadas: `notice-point-1280.png` y `notice-point-390.png`. Son del tema que usa el fixture; no se cambiaron CSS ni preferencias reales. Reproducción nativa: SV_BUDGET_NOTICE_DETAIL_NATIVE=1, SV_BUDGET_DETAIL_FUNCTIONAL_ROOT apuntando a la copia de 53b8f128 con el patch aplicado, NODE_PATH con Playwright instalado; ejecutar node --test sobre el archivo integration. No se repitió ninguna puerta general ni se reabrió la clasificación de 76 fallos.

El test/documento anterior faccefc9 permanece como antecedente de diseño, no sustituye esta prueba funcional. El consumo Source.peek('notices') y la instalación de hosts siguen siendo responsabilidad del montaje coordinado por root; no se expandió esa integración en esta entrega. Flag OFF hasta importación, freeze conjunto y QA vigente.

## Antecedente faccefc9, anterior a la entrega funcional

Estado: OFF, pendiente del freeze de root. No se editó app.v3.19.3, notifications.js, data-readiness.js ni ningún runtime root. El esbozo ejecutable vive exclusivamente dentro de un test y modifica copias de funciones en memoria. No instala infraestructura ni un endpoint nuevo.

## Bloqueo reproducido

`abrirPresupuestoDesdeNotificacion` busca en pptoData y retorna antes de navegar cuando falta el registro. `verPpto` vuelve a usar `buscarPptoPorRef`, que sólo consulta esa lista. La página presupuesto además requiere clientes/productos/presupuestos/empleados y su loader inicia la lista completa. Resolver únicamente la generación de avisos dejaría roto el acceso real al detalle.

No usar el patrón de client-history-bootstrap que agrega el presupuesto puntual a pptoData: esta propuesta mantiene la entidad temporal aparte y no declara completa la colección general.

## Puntos concretos de inyección después del freeze

| Punto actual | Inyección propuesta |
|---|---|
| app.v3.19.3.js:55821, cuatro acciones dentro de generarNotificaciones | En modo propuesto usar `accion.id = String(p.fbKey)`. Mantener id, título y leyendas del aviso basados en el id histórico. Las filas ya vienen del snapshot del adaptador y tienen fbKey canónico. OFF conserva la acción anterior. |
| js/modules/notifications.js:380, abrirPresupuestoDesdeNotificacion | Antes de buscar en caché, si el flag local estricto está ON, delegar y retornar `host.open(key)`. El host maneja sus rechazos para que el dispatcher síncrono no deje promesas rechazadas sin atender. No buscar por número comercial como alternativa. |
| js/core/commercial-ownership.js, request existente | Reutilizar `SVCommercialOwnership.request('presupuestos','registro/'+encodeURIComponent(key))`. Sin body es **GET**; conserva token fresco, no-store y los controles de sesión del cliente existentes. No llamar preparar ni ningún POST para abrir. |
| cotizador/index.js:2076, ruta existente | Ya resuelve GET /comerciales/presupuestos/registro/{key} mediante authorize y visibleRecordsByIds y devuelve record.fbKey canónico. No cambiar este endpoint ni omitir autorización. La prueba del cliente usa un puerto HTTP ficticio; no certifica servidor. |
| app.v3.19.3.js:34880, buscarPptoPorRef | Si el host reclama una vista puntual de presupuesto, resolver únicamente el fbKey exacto de la entidad autorizada temporal, o null. Fuera de esa vista conservar el buscador actual. No agregar filas a pptoData ni permitir que una caché ajena supla un error del GET. |
| app.v3.19.3.js:47592, verPpto | Conservar el renderer completo. pptoActualId queda fijado al fbKey retornado. El callback directo invoca verPpto(key) sólo tras validar respuesta, intención y sesión. Las dependencias visuales/monetarias siguen siendo las actuales. |
| js/core/data-readiness.js:77, requirements | Mientras el host reclame esta vista puntual, devolver sólo la fuente local `budgetNoticeDetail`, antes de los requisitos de la colección completa. beginSource/ready/error/cancel usan el sistema existente; nunca ready('presupuestos'). |
| app.v3.19.3.js:6157, svCargarDatosDePaginaActual | Tras permisoModulo y antes de construir los loaders, retornar cuando el host reclame la vista puntual. Esto evita fbCargarPresupuestos y los cargadores de formulario al abrir el aviso. |
| app.v3.19.3.js:6213, svReintentarDatosDePagina | En la vista puntual delegar sólo al reintento explícito del mismo GET, con autoridad nueva. No reenviar a la carga general. El test actual no monta ni certifica este control de UI. |
| app.v3.19.3.js:11078, svNavegarDirecto | Reutilizarlo; conserva apertura directa y evita la exposición inicial de la lista. Si la navegación se cancela o redirige, cancelar la fuente puntual y no iniciar el GET. |
| app.v3.19.3.js:49105, volverListaPpto | En la excursión puntual, retirar entidad/token y volver a la pantalla de origen; no ejecutar la rama que muestra/renderiza la lista. Fuera de la excursión conservar la función existente. |

No se monta una API pública nueva: `host` es el estribo local que root debe conectar detrás de su flag default OFF. El esbozo de test demuestra open/resolve/claimsPointView/back/reset. Los nombres finales y la captura común quedan sujetos al freeze, sin cambios de grants ni actor del servidor.

## Orden de apertura y aislamiento

1. Recibir únicamente el key canónico del candidato, validar su forma y capturar auth/User, UID, rol, revisión, epoch, db y origen. Un segundo click pendiente al mismo key comparte la intención.
2. Reclamar el detalle temporal y comenzar budgetNoticeDetail antes de navegar, de modo que ni readiness ni el loader pidan la lista completa. La vista directa oculta lista/formulario y mantiene la capa de carga existente.
3. Ejecutar el GET puntual autorizado. Verificar respuesta record, fbKey exacto y contexto/intención/ruta todavía vigentes antes de exponerla al resolver. Un 401/403/404/503 conserva error, sin inventar inexistencia, cero o fuente completa y sin segundo transporte.
4. Usar el verPpto real y marcar ready exclusivamente para el detalle puntual una vez renderizado. Al volver, cambiar ruta/identidad o reemplazar la intención se retira la entidad. Una respuesta tardía no repone la ficha anterior.

El montaje definitivo debe conectar explícitamente el reset a eventos de sesión/ruta/permisos y retirar la ficha visible ante revocación posterior. El esbozo prueba descarte durante una lectura pendiente; no prueba todavía esos eventos en navegador real ni todas las operaciones de la ficha.

También hay acciones antiguas dentro del detalle que pasan p.id (por ejemplo editarPptoParaMigrar en el estado sin ítems). Al montar, deben usar fbKey o pasar por la transición explícita al formulario completo. No reintroducir búsqueda global por número para resolverlas. Editar/convertir/guardar requieren sus permisos y fuentes propios por acción: abrir desde un aviso no ejecuta ninguna de ellas. Esta revisión de acciones y su prueba nativa siguen pendientes antes de habilitar el flag.

## Evidencia específica

`test/dashboard-budget-notice-detail-navigation-proposal.test.cjs`: **8 PASS, 0 FAIL, 0 SKIP**. Ejecuta funciones completas reales de abrirPresupuestoDesdeNotificacion, buscarPptoPorRef, verPpto y svNavegarDirecto, junto con los módulos reales de request comercial y readiness. Las inyecciones están descritas en el test y sólo afectan a cadenas en memoria. showPage, DOM, permisos, renderers auxiliares y respuesta HTTP son puertos ficticios.

Incluye bloqueo original con lista vacía, GET sin body, detalle sin marcar colección completa, clicks duplicados, referencias comerciales duplicadas, key de respuesta incorrecto, errores de acceso/no disponible, sesión/ruta cambiada, retorno al origen y cuatro acciones del generador con key canónico conservando sus IDs históricos. El fixture verifica campos visibles del verPpto real, no sólo que se lo llamó. No equivale a prueba visual, integración de showPage completo ni autorización nativa del endpoint.

Para reproducir contra copia congelada de los archivos reales: SV_BUDGET_DETAIL_REFERENCE_ROOT apunta al directorio con js/app.v3.19.3.js, js/modules/notifications.js, js/core/commercial-ownership.js y js/core/data-readiness.js; ejecutar `node --test test/dashboard-budget-notice-detail-navigation-proposal.test.cjs`. Sin variable usa la app activa y módulos del checkout. Log privado: tmp/sdk-proof/notice-detail-callpoints.log; referencia privada copiada por lectura desde root, sin modificarlo.

No se ejecutó otra puerta general ni se volvió a analizar el antecedente de 76 fallos. Root informó por separado que los cuatro casos pendientes no se reprodujeron en su corrida serial; esto no aprueba la puerta conjunta vigente. Montaje y patch selectivo permanecen OFF hasta freeze, integración revisada y validación conjunta/nativa del recorrido real.
