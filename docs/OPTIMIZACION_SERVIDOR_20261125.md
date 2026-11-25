> Estado final: selector de imágenes integrado y publicado en v3.21.15, fuente pública4ef9f97c y722activos verificados. Las decisiones de mantener los controles servidor se conservan; no se habilitaron nuevas lecturas/escrituras SDK de negocio.

# Optimización de intervenciones del servidor · 25/11/2026

## Alcance comprobado

Fuente inspeccionada: `9cbe59dd76a1d1e5aa0caaeb0ccab3427832d4a2`, aplicación activa `v3.21.12`. Inventario de fuente: **90 plantillas de ruta de Cotizador, 91 combinaciones de método/ruta y 28 entradas adicionales** de otros servicios y eventos; ocho de estas últimas son exportaciones Push condicionadas por una bandera, no servicios supuestamente activos. Los tipos de comando dentro de las rutas genéricas también están enumerados.

El archivo [OPTIMIZACION_SERVIDOR_20261125.json](OPTIMIZACION_SERVIDOR_20261125.json) contiene cada ruta, método, familia, módulo servidor, llamadores de frontend y decisión. Los llamadores con coincidencia literal tienen archivo/línea; las URLs construidas dinámicamente se identifican como llamador de familia, sin inventar una línea exacta. No cuenta cada combinación posible de query strings o identificadores como una operación distinta. La prueba de cobertura detecta nuevas rutas literales o comandos que no estén en el inventario.

Esto es un inventario exhaustivo de las entradas de **esta fuente**, no una inspección remota de todos los contenedores. El runtime desplegado tiene una composición distinta del Dockerfile general y las banderas pueden dejar rutas preparadas deshabilitadas. No se consultaron RTDB, Billing, IAM, credenciales, Storage ni servicios reales en esta auditoría. No se declaró una ruta publicada sólo por verla en `index.js`.

## Resultado

Un salto al servidor puede ser innecesario para cargar un recurso que Firebase ya autoriza directamente. No es innecesario cuando evita exponer una colección privada, calcula una proyección para un rol, conserva una vinculación histórica o confirma varias escrituras con un mismo recibo. Tampoco se justifica convertir un PATCH coordinado en varias escrituras del navegador porque su botón diga «Guardar nota».

**Mejora concreta preparada:** la impresión de presupuesto enviaba incluso las URLs tokenizadas del bucket Firebase propio a `/imagen-producto`; ese proxy no admite el host de Firebase y devolvía400. El selector `SVProductMediaSource.direct` utiliza la descarga original de Firebase directamente, sin crear tokens ni modificar registros. Mantiene el proxy para los proveedores externos. El coordinador integra dos líneas en la nueva aplicación y añade el módulo al índice/SHELL; véase [la integración y evidencia](PRODUCT_MEDIA_SOURCE_CALLER_20261125.md).

No se identificó una escritura de negocio que pueda mudarse hoy a SDK **demostrando equivalencia con las reglas remotas actuales**, porque no se inspeccionaron esas reglas ni sus perfiles en esta tarea. No presentar esta falta de prueba como permiso para habilitar escrituras. El código ya tiene caminos Firebase directos en algunos dominios; el plan compara contra ese estado, no supone que todo pasa por Cloud Run.

## Matriz de decisión por circuito

Los nombres y URLs completos están en el JSON. Esta tabla explica la función del intermediario y el siguiente cambio que puede ser razonable.

| Circuito y entradas principales | Qué hace además de transportar datos | Decisión y siguiente paso |
|---|---|---|
| `/imagen-producto` | Allowlist de proveedor, destino final, CORS, MIME y tamaño; no lee RTDB | **Firebase directo sólo para la descarga ya autorizada del bucket propio.** Proveedores siguen por el proxy. Preparado y probado; sin despliegue servidor nuevo. |
| `/cotizar`, `/biosegur`, `/cotizar-lote`, `/verificar-proveedor`, `/cotizacion-guarani`, `/` | HTTP de proveedores, normalización y secretos/API cuando aplican | Mantener servidor. Agrupar una tanda con el endpoint de lote existente y no repetir la cotización sin cambio de entrada. |
| `/catalogo/cotizar`, `/catalogo/solicitar` | Precio público verificado, identidad/cuotas de solicitud anónima y avisos asociados | Mantener verificación servidor. Una proyección pública futura exige fuente/cobertura/reglas, no leer catálogo privado directamente. |
| `/mercadolibre/oauth/{start,callback,status}` | Client secret, token/refresh privado y estado OAuth | Mantener servidor. Start y callback tienen su autorización/estado; `status` sólo publica el estado sanitizado y no entrega el token. |
| `/usuarios/{perfil,directorio,administracion}` | Revocación/reset, perfil propio frente a directorio mínimo o ficha administrativa | Mantener proyección protegida. Reducir duplicados de la misma consulta pendiente y reutilizar sólo un snapshot vigente de la sesión, nunca la colección privada completa. |
| `/usuarios/acceso/{estado,temporal,correo,completar}` | Firebase Auth administrativo, contraseña/claims, revisión de acceso y correo | Mantener servidor. No trasladar credenciales o autoridad administrativa al navegador. |
| `/laboral/{directorio,disponibilidad,horas-propias,vinculo-propio}`, `/compras/proveedores` | Proyección de empleados/proveedores; vínculo de UID/empleado; fecha y período de vacaciones | Mantener proyección. Probar consultas por fecha/alcance en lugar de raíces completas cuando conservan el mismo resultado; no exponer salarios o datos de terceros para quitar un salto. |
| `/comerciales/{ventas,presupuestos}` y opciones/registro | Propietario/asignado, Ver como, vista de comisión sanitizada y respuesta condicional | Mantener alcance servidor. Reusar el acuse y el snapshot sólo dentro de contexto válido; no mostrar el snapshot anterior mientras cambia la búsqueda. Borrado y reasignación siguen coordinados. |
| `/commercial/dashboard/*` | Cobertura/versiones de proyección y totales completos por alcance | Mantener verificación. No sustituir un total validado por una lista parcial cargada. Medir lecturas de una respuesta304: no equivale a cero lecturas de RTDB. |
| `/cuentas/preparar`, `/cuentas/comprobante*`, `/clientes/historial*` | Scopes/cobertura y vínculo exacto entre movimiento, venta/pago y archivo; revisión/hash histórico | Mantener verificación servidor. Un token de comprobante no autoriza un GET libre a otra clave. Reducir payload y lecturas repetidas sólo conservando generación/revisión y checks finales. |
| `/proyectos*` | Membresías/roles, importación de presupuesto visible, revisión/historial y fotos de bucket privado | Mantener servidor para comandos y medios privados. Separar opciones base de presupuestos ya existe; evitar descargar presupuestos completos sólo para abrir el formulario. |
| `/distribuidora/comprobantes*` | Permisos, numeración/identidad y documento con su origen | Mantener servidor. Eliminar una llamada repetida no debe permitir duplicar numeración o conservar un comprobante sin su referencia. |
| `/cobranzas/operacion`, `/laboral/gastos/*`, `/laboral/bonificaciones/pagar` | Saldos, pago/gasto original, membresías, recursos e índices; recibo y ACK incierto | **Mantener coordinado.** El SDK no reemplaza la confirmación atómica de varios dominios ni su recuperación. Preservar base USD/tasa original y comisiones existentes. |
| `/comisiones/*`, `/internal/commission-event*`, forwarder | Venta autorizada, cobro completo, participantes/costos originales y entrega OIDC | Mantener servidor/evento. Nunca cambiar el comisionado por el usuario que cobra ni crear duplicados por reintento. |
| `/stock-oficina/*`, `/ot/ciclo*`, `/inventario/contar-desde-ot`, `/operaciones/ot/*`, `/compras/ordenes/eliminar` | Identidad y ledger originales, reservas/custodia/consumo, P/J/R, vínculos, recibo y reversión | **Mantener coordinado.** Los detalles físicos no se migran a set/transaction independientes. La lista puede aprovechar el catálogo autorizado de la sesión, mejora ya preparada en v12. |
| `/laboral/escritura`, `/laboral/operacion`, `/laboral/capacidades` | Comparación de originales, propósito/acción, guard global, proyecciones e idempotencia | Mantener protocolo. Inventariar por `kind`/`purpose` y efectos reales. Reducir lecturas de una nota puntual puede ser válido sin retirar las garantías del guard. |
| `/laboral/{solicitar-horas,solicitar-gasto,aprobar-horas}` | Identidad laboral propia y autoridad del aprobador; referencias e índices | Mantener servidor. No confiar en un empleado o monto enviado por el navegador. |
| `/privado/finanzas*`, IA y lectura de resúmenes | UID propietario configurado en servidor; bucket privado; base USD/ARS separada; secretos y cuota de IA | Mantener servidor. No basta ser admin ni existe acceso implícito durante Ver como. No mezclar con dominio laboral ni hacer escrituras por subir un PDF. |
| `emitirFactura`, `testTFApp` | Secretos fiscales, identidad/CAE, consulta, NC y vinculación idempotente con una emisión | Mantener servidor. Una emisión incierta se consulta o vincula; nunca se reemite para comprobarla. |
| Eventos de correo, límites de costo y Push condicional | Credenciales de correo/FCM, entrega de eventos y permisos de infraestructura | Mantener servidor si están habilitados. El controlador de costos no pertenece al navegador. No activar Push o un horario por el solo inventario. |

## Reglas para aceptar otro traslado directo

1. Definir path, campos y alcance exactos, además del objetivo de la acción. Identificar si el dato es original, proyección, identificador/recibo o archivo privado.
2. Comparar la autorización del servidor con **las reglas efectivas**, incluidos grants en padres y comodines. Un veto hijo de RTDB no revoca un grant padre. Nunca usar acceso Admin como prueba de acceso SDK.
3. Probar en emulador administrador/administrativo/vendedor/técnico/Distribuidora, propios/ajenos, permisos explícitamente denegados, desactivación/reset y Ver como. Probar ambos órdenes de carga de fuentes.
4. Para escrituras: un único resultado atómico, concurrencia/CAS, doble clic, pérdida de ACK y reinicio de transporte; campos/autoría/timestamps/costos originales intactos. El evento de éxito de la UI requiere confirmación; un rechazo no puede caer silenciosamente al SDK.
5. Para lecturas: respuestas fuera de orden, cierre, cambio de usuario/rol, foco/visibilidad y cobertura insuficiente. Una pantalla con datos de otra consulta no se usa como indicador de «velocidad».
6. Aplicar el indicador de carga uniforme del coordinador, con controles estables y sin desplazar la página. Es una condición previa al cambio de transporte.
7. Si se requieren permisos nuevos, metadatos/backfill o un corte de escritores, separarlo y revisar el resultado concreto antes de activarlo. No publicar una migración general como arreglo de latencia.

## Medición y orden de implementación

| Etapa | Medir | Criterio de salida |
|---|---|---|
| 0 · inventario | Ruta/llamador/configuración real, original/proyección, bytes y número de reads/writes | Cada acción tiene dueño y decisión; rutas preparadas separadas de publicadas. |
| 1 · UI y lecturas repetidas | Número de pedidos de un doble clic y al entrar/volver; eventos de readiness/cancelación | Un único pedido compartido cuando corresponde; sin datos viejos, sondeo ni reconstrucción en reposo. |
| 2 · medio Firebase | Proxy vs descarga directa, CORS, MIME, token/origen y error | Una descarga autorizada, cero proxy, sin cambios en datos/historia. **Preparado 18PASS.** |
| 3 · lectura candidata SDK | GET, bytes y consultas reales para la misma salida/autorización | Mejora medida sin ampliar lectura ni usar una fuente incompleta. No hay traslado de esta clase habilitado por este informe. |
| 4 · escritura candidata | Originales, CAS/atomicidad/recibo, idempotencia y roles | Cero diferencias históricas/financieras; si exige guard o secrecía, permanece en servidor. |
| 5 · publicación acotada | Commit limpio, suite vigente y focales; imagen/reglas/frontend compatibles; comportamiento real en lectura | Verificar activos/aviso después del despliegue. No modificar datos reales como prueba incidental. |

La instrumentación debe registrar sólo plantilla de ruta, cantidad de solicitudes, bytes y duración; nunca cuerpos, tokens, datos financieros o URLs de descarga con token. Medir p50/p95 por operación y arranque frío/caliente, solicitudes Firebase y trabajo en reposo. No introducir una consulta por reloj para medir ahorro. Contar todos los efectos, también almacenamiento/Build/logs, no sólo Cloud Run.

En la prueba nativa del medio Firebase se comprobó una llamada fallida al proxy antes y una descarga directa PNG después. No se comparan tiempos de producción ni se promete un importe de ahorro: la versión anterior no obtenía una imagen, por lo que no es una comparación de dos resultados equivalentes. La transferencia de Storage sigue existiendo y puede tener costo. No se agregó servicio, instancia mínima, job, sondeo, regla, credencial ni configuración remota.

## Límites y trabajo no realizado

Las modificaciones funcionales de este frente se limitan al selector de URL Firebase y al hunk de integración entregado al coordinador. No se cambió ningún path de escritura ni se habilitó SDK en finanzas, OC, OT, Stock, cuentas o chat. Falta contrastar el inventario contra la composición y los flags desplegados antes de seleccionar otro transporte. El controlador de costos tiene una allowlist explícita de servicios; cualquier incorporación futura requiere su propia revisión de alcance, no una afirmación de tope exacto.
