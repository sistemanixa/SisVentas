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
