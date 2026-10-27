# WhatsApp y selector de clientes v3.15.8

## Publicación web separada v3.15.8 · 27/10/2026

El titular pidió publicar lo terminado. Se separa desde51f5a861/productiva15.6;
15.7 sigue reservada a la candidata amplia incompleta. Se incluyen formato de
WhatsApp en Mi lista y Preparar compra, y buscador compartido de clientes.
No se activa el rediseño financiero, fiscal, proveedores por API ni custodia/OT.

WhatsApp agrupa por proveedor y muestra cantidad/código, nombre y enlace exacto;
un enlace inseguro, faltante o ambiguo queda pendiente. PDF/CSV conservan su
salida anterior, lista completa, orden e importes. El selector conserva scroll
interno, teclado, límites visibles y ARIA al cambiar de campo.

Comparación AST con15.6:2.283funciones idénticas, sólo tres cuerpos del selector
modificados y dos helpers nuevos; sin funciones eliminadas. Servidor, reglas,
guardados, pagos, comisiones, permisos y módulo Distribuidora sin cambios.

Puerta vigente6.090total/6.063PASS/27opt-in/0fallos,66,35s.35focalesPASS;
ocho recorridos de selector y cuatro de pedidos1280/390 con datos ficticios,
sin lecturas/escrituras comerciales externas. Tres PDF renderizados,13páginas
sin blancos; primeras páginas de ambos circuitos inspeccionadas. No es prueba
de sesión auténtica ni dispositivo físico. Sintaxis/diff/versión local correctos.

Preflight remoto confirmó Hosting51c65abc66f76de1, aviso15.6 y reglas626817;
cuatro consultas de metadatos, sin leer clientes/ventas. Publicación sólo Hosting,
sin nuevos servicios ni costo fijo. Validación HTTPS y aviso pendientes hasta
ejecutar y verificar el despliegue. Evidencia privada tmp/web3158-release.

## WhatsApp y selector publicados v3.15.8 · 27/10/2026

Fuente pública a7592ccc853a386a62ce54748a3117895ee36ac0, rama
codex/web-prioridades-v3158. Hosting86ac0bcb76848423:461activos/8cargas.
26hashesHTTPS exactos, mirror,7cabeceras y6rutas privadas/históricas404 correctos.
Script oficial confirmó web/core/SW/avisoFirebase v3.15.8-firebase.
Cuatro recorridos posteriores con módulos reales publicados y datos ficticios
pasaron: WhatsApp, CSV/PDF y compartir en ambos circuitos1280/390;75filas de
estrés, sin escrituras ni consultas comerciales. No se simuló un envío real a
WhatsApp ni se guardaron listas. CUA falló kernelassets: no se refrescó ni verificó
la sesión auténtica. Local8766 sirve los mismos archivos del checkout actualizado.

Incluye sólo WhatsApp y selector; no activa candidata amplia15.7, fiscal,
proveedores por API ni OT/custodia. Sin cambios de servidor/reglas/flags/IAM/DNS,
sin nuevos servicios/costo fijo ni datos financieros reales como prueba.
Pagos, comisiones y permisos permanecen en la fuente productiva previa.
Continúan custodia y corte amplio; la auditoría/segmentación no están terminadas.
Evidencia privada tmp/web3158-release; detalle WEB_PRIORIDADES_V3158.md.
