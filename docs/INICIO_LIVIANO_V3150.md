# Inicio liviano v3.15.0

Candidata sólo de frontend, separada de los trabajos de privacidad. Base ad8a3902 (producción v3.14.20). No modifica Cotizador, reglas, permisos, índices, datos financieros ni vistas históricas.

## Cambio

Dashboard inicia fuentes según las tarjetas autorizadas del usuario. Evita adelantar categorías y órdenes de compra sin consumidor de Inicio; conserva clientes y alias, presupuestos, pagos, precios y avisos cuando se necesitan. Las pantallas siguen cargando sus fuentes al navegar. El contexto estable se retira al cambiar autenticación, rol, permisos, generación, vista, página o visibilidad, sin crear consultas por esos eventos.

Se modifican tres funciones de arranque y se añaden cuatro auxiliares; 2.276 cuerpos de funciones globales de app20 permanecen idénticos. Readiness sólo intersecta su contrato crítico con la demanda y conserva el comportamiento anterior si el cliente no tiene el helper. No se añade polling, servicio, cron o proceso de servidor.

## Validación

- Puerta vigente: 5.981 PASS, 27 opt-in omitidas, cero fallos; 6.008 casos, 45,78 s. Las dependencias existentes se proporcionaron mediante NODE_PATH; no se instalaron paquetes. El primer intento tuvo 14 fallos por Playwright no resuelto en el checkout nuevo; se corrigió el entorno, sin modificar esas pruebas.
- 66 pruebas focales de demanda, contexto, navegación y cancelación; sintaxis, diff y validación local oficial de versión correctos.
- Aplicación completa con index, JS y CSS de las dos versiones, SDK sustituido por fixtures y HTTP exclusivamente local. Red normal y lenta (256 kbit/s, 800 ms), orden ABBA y dos roles ficticios: importes iguales, carga terminada y cero errores JS.

| Escenario lento | v3.14.20 | v3.15.0 |
| --- | --- | --- |
| Primer dato visible administrador | 4,932–4,958 s | 3,324–3,343 s |
| Solicitudes del administrador | 55 | 46 |
| Cuerpo de respuestas del administrador | 1269 B | 835 B |
| Primer dato visible técnico | 4,934 s | 4,933–4,945 s |
| Solicitudes y cuerpo del técnico | 36 / 764 B | 36 / 764 B |

El corte dirigido a la respuesta comercial durante dos segundos se recuperó; no acredita una prueba de reintento manual porque el escenario se recuperó solo. Cambiar sesión con una respuesta personal pendiente no pintó datos tardíos ni inició nuevas lecturas. QA a 1280 y 390 px conserva las tarjetas y sus importes.

Son fixtures pequeñas: los bytes corresponden a cuerpos HTTP locales, no al protocolo Firebase, TLS, WAN o facturación. Activos estáticos sin limitación de ancho de banda, SW bloqueado, DTO laboral auxiliar inmediato y permisos preparados de fixture. No se afirma auditoría remota, prueba de todos los formularios ni ahorro monetario medido.

## Publicación

Fuente y pruebas listas para el publicador exclusivo. Hosting, comprobación HTTPS y actualización del aviso se hacen después del commit limpio revisado. No se despliega servidor ni se prepara ningún dato de negocio. El aislamiento estructural de comisiones y los demás pendientes quedan fuera de esta entrega.
