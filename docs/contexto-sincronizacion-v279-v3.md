# Contexto de sincronización SisVentas v2.0.279 + V3

> Documento histórico de la recuperación realizada sobre v2.0.279. El procedimiento operativo vigente está en [sincronizacion-dos-pc-y-publicacion.md](sincronizacion-dos-pc-y-publicacion.md).

Fecha de reconstrucción: 03/08/2026.

## Estado recuperado

- Repositorio remoto: `origin` (`sistemanixa/SisVentas`).
- Última versión publicada encontrada en Git: `v2.0.279`.
- Último commit remoto: `9066c28`, “Usar consenso de precios Mercado Libre”.
- Integración local: `f9fb67f`, “Integrar v2.0.279 conservando V3”.
- Rama de trabajo: `codex/v3-integracion-v236`.
- Estado respecto de `origin/main`: cero commits faltantes; cuatro commits locales de V3 por delante.
- No se hizo push ni deploy desde esta PC.

## Por qué se hicieron las actualizaciones

### Actualizador de precios y proveedores

El objetivo fue evitar bloqueos, repeticiones y revisiones imposibles. Se agregó progreso legible, minimización real, reanudación sin repetir consultas, métricas coherentes, navegación directa a la ficha del producto y control de identidad entre proveedor, dominio y URL. También se incorporó Mercado Libre con OAuth, lectura dinámica, variantes, catálogos, publicaciones oficiales y consenso de precios.

### Presupuestos, ventas, pagos y deuda

Se unificaron importes históricos, descuentos, saldos y cuenta corriente para que dashboard, cobranzas, detalle e informes usen la misma fuente. Se completó la duplicación de presupuestos y ventas, la aprobación administrativa y el control de variaciones excepcionales.

### Notificaciones y navegación

Los avisos importantes dejaron de perderse o duplicarse. Se concentraron en el dashboard, se agregó recuperación de leídos, cola de avisos y navegación directa al registro correcto. Los procesos largos pueden minimizarse sin bloquear el sistema.

### Interfaz responsive y operación diaria

Se corrigieron grillas, columnas, tarjetas móviles y tablet, reordenamiento de ítems, alineación de controles, menú lateral y liberación de vistas ocultas. Se mejoraron gastos mensuales, haberes, cargos y accesos flotantes.

### V3

V3 conserva `fbKey` como identidad técnica, centraliza cálculos y persistencia, agrega comparaciones sombra, compuertas reversibles y rollback. La integración actual cubre presupuestos, ventas/pagos, órdenes de trabajo/adjuntos y productos/proveedores. Está conectada sobre `v2.0.279` sin reemplazar a ciegas la versión estable.

## Ramas remotas revisadas

- `origin/main`: integrada completamente hasta `9066c28`.
- `origin/codex/hotfix-v194-firma-actualizador`: ya contenida por la historia actual.
- `origin/codex/core-reconstruction`: antecedente V3 antiguo; sus capacidades están superadas por la integración V3 actual y sus 103 pruebas.
- `origin/sistemanixa-patch-1` y `origin/patch-1`: ramas antiguas/experimentales que cambiarían archivos históricos; no contienen mejoras actuales para integrar.

## Verificación realizada

- Sintaxis de `js/app.v2.0.279.js` y módulos V3: correcta.
- Suite vigente `v2.0.279 + V3 + cotizador + URLs`: 123 pruebas aprobadas, 0 fallas.
- No existen conflictos Git pendientes.
- Los tests incrementales históricos no se ejecutan todos juntos porque cada uno exige que `index.html` apunte a su versión histórica; la prueba vigente `v2.0.279` sí está aprobada.

## Historial exacto recuperado desde la base anterior

- d242f04 — Corregir apertura de productos desde auditoría
- 3fd4c14 — Completar circuito de duplicado y aprobacion de presupuestos
- f436227 — Permitir aprobar variaciones excepcionales de precio
- dfbdaef — Mostrar aprobaciones pendientes en auditoria de precios
- dfb96b3 — Corregir identidad de proveedor en URLs de productos
- 3f1ad21 — Unificar centro de actualizacion de precios
- 82d53ac — Hacer efectiva la aprobación de variaciones de precio
- 54dc284 — Unificar diálogos y corregir modales apilados
- d381c09 — Mantener avisos importantes hasta confirmacion
- 4d3d7d6 — Unificar calculo de deuda y documentar datos
- b8e7449 — Reconocer ventas con descuento total como sin cargo
- 0a708d8 — Corregir deteccion responsive de tablet
- b4e4c05 — Mejorar haberes y accesos flotantes v2.0.249
- e53bc3f — Agregar copia de valor hora a horas extra v2.0.250
- 6e698a3 — Ubicar flecha entre valor hora y horas extra v2.0.251
- 0f29fd4 — Registrar historial y avisos de aumentos v2.0.252
- c14d2fc — Adaptar cargos a tarjetas responsive
- ae6a433 — Unificar alineacion de controles en grillas
- db3b114 — Corregir detector publicado de version
- 20be8c0 — Publicar prueba de actualizacion automatica v2.0.255
- bfc7cde — Unificar redimensionado de columnas y porcentajes
- 43d3c66 — Permitir reordenar items en presupuestos y ventas
- 4c77a41 — Hacer robustos los controles de orden responsive
- 97b666f — Mantener visibles los avisos importantes
- 076d451 — Reactivar recordatorios urgentes en su fecha
- eee846f — Unificar notificaciones importantes en tarjetas laterales
- d72d722 — Permitir recuperar notificaciones leídas
- c388da8 — Evitar avisos duplicados dentro de notificaciones
- 4ba37fb — Liberar el sistema al minimizar el actualizador
- 2de710b — Aclarar el progreso del actualizador de precios
- 16d552d — Reanudar el actualizador sin repetir consultas
- eccb055 — Corregir métricas de revisión de precios
- 2217bcb — Corregir apertura desde notificaciones
- 71a6772 — Unificar navegacion directa a fichas
- 97766f0 — Hacer interactivos los resumenes de precios
- b164f7c — Concentrar avisos importantes en dashboard
- d3b0fb5 — Generalizar formatos de precio e IVA
- 6af425c — Aplicar IVA detectado en la ficha
- f96a053 — Corregir actualizador de Mercado Libre
- 768da50 — Corregir catalogo de Mercado Libre
- a1cc15e — Publicar v2.0.276 con OAuth de Mercado Libre
- 9923404 — Resolver precios de catalogo de Mercado Libre
- 3805004 — Publicar v2.0.277 con gastos mensuales claros
- a1c3f46 — Resolver variantes de catalogo de Mercado Libre
- 81dc2ba — Leer variantes picker de Mercado Libre
- 6c5f182 — Corregir lectura visual de Mercado Libre
- d8141d2 — Publicar v2.0.278 con actualizador mas claro
- 83d0ac2 — Esperar precio dinamico de Mercado Libre
- 8fbc7ab — Publicar v2.0.279 con carga guiada
- af86726 — Usar publicaciones oficiales de catalogo Mercado Libre
- 887b81a — Completar identidad del producto Mercado Libre
- 84d15fe — Reconocer equivalencias de packs Mercado Libre
- ddd33eb — Tomar ganador oficial de Mercado Libre
- d0b04cf — Diagnosticar candidatos de catalogo Mercado Libre
- 9066c28 — Usar consenso de precios Mercado Libre
