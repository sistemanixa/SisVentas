# Acceso explícito al documento fiscal · candidata v3.15.7

Estado27/10/2026: implementado y probado localmente, **no desplegado ni
activado**. El titular respondió: «Sí, sólo con esa acción y permisos» al
acceso desde Ver factura con permiso Ver facturas emitidas y acceso a la venta.
Esa decisión está resuelta; no sustituye los controles pendientes del corte.

## Lectura

El listado, detalle y acuses comerciales del nuevo protocolo conservan sólo
metadatos fiscales tipados. No contienen URLs ni Base64 del documento, tampoco
en la variante de acceso financiero completo. Los originales se mantienen en
el servidor: editar metadatos no reescribe ni borra los PDFs ocultos.

La acción solicita un único documento por GET a
/comerciales/ventas/documento/:venta/:tipo/:referencia opcional. Se admite
factura principal, nota de crédito, clave exacta de una adicional y posición
canónica acotada del historial. No se aceptan rutas arbitrarias.

Servidor exige identidad activa, sesión sin cambio de contraseña pendiente,
módulo Facturas y facturas.verEmitidas vigente, más acceso a esa venta. Una
denegación explícita también bloquea al administrador. El rol admin conserva
su permiso por defecto sólo donde no existe una denegación. Ver como no da
acceso. Se verifica otra vez identidad/permiso y responsable antes de entregar;
un actor inventado o una autorización ya consumida se rechaza.

Se devuelve sólo el archivo elegido, sin ficha de venta, costos, porcentajes,
pagos ni configuración de comisiones. HTTPS sin credenciales embebidas o PDF
Base64 con firma y tamaño máximo2MiB. Un documento inexistente tiene error
identificable, no un éxito vacío. Si la principal electrónica conserva snapshot
fiscal verificable pero carece de PDF, la copia se obtiene con el renderer
canónico y los datos fiscales guardados, sin ARCA ni guardados. Una factura
externa nunca se reconstruye para sustituir su archivo original.

## Acciones y compatibilidad

Factura, NC y parciales utilizan el lector sólo al pulsar su botón. Ingreso,
listado y resumen no descargan el documento. Tras emitir, el circuito protegido
abre el resumen y espera Ver factura. Doble clic comparte el envío pendiente;
el archivo no se conserva en la venta ni en el caché del listado. Sesión,
permisos, ruta, vista, épocas o visibilidad retiradas descartan el resultado.
Los botones muestran actividad y se liberan al terminar o fallar.

La consulta fiscal antigua conserva su identidad, importes, cliente y detalles,
pero su respuesta elimina archivos/enlaces PDF anidados. regenerar_pdf genérico
devuelve409 indicando abrirlo desde su venta, sin llamar al proveedor. No tiene
consumidores en los circuitos activos revisados. Emisión, preflight, persistencia,
vinculación y recibos durables conservan exactamente sus contratos y resultados;
no se eliminan documentos ni se modifica un cobro para probar el cambio.

## Pruebas y límites

-65casos nuevos, incluidos permisos, alias, rutas, revocación, reasignación,
  formatos inseguros, copia verificada, originales conservados y cero carga
  automática. No son65problemas distintos.
-Puerta completa:7.672total/7.645PASS/27opt-in/0fallos,37,10s. Servicio:94PASS.
-Navegador aislado:16lecturas explícitas en320/390/768/1280, acciones reales de
  resumen/NC/parciales y cliente HTTP real con endpoint ficticio. Incluye PDF
  histórico sin nombre. Cero solicitudes externas y escrituras financieras.
  Capturas de resumen móvil/escritorio revisadas. El visor es una sonda de UI;
  no acredita render de PDFs reales, impresión física ni sesión autenticada.
-AST:2.292funciones de app idénticas; sólo abrirResumenFactura,
  verComprobanteFacturaVenta y verFacturaEmitida cambian. El renderer y cálculo
  fiscal son idénticos. Al revertir en memoria los dos bloques de consulta/
  entrega del index fiscal, el resto coincide exactamente con la fuente base.
-Docker:87módulos relativos alcanzables, sin faltantes y con el lector nuevo
  copiado; el empaquetador fiscal probó cierre autónomo sin npm adicional.
  Sintaxis, diff y validación local correctos.

Las pruebas usan únicamente datos inventados. No hubo lecturas/guardados de
negocio real, despliegues, cambios de reglas/flags/IAM ni nuevos servicios o
sondeos. Cada clic usa la autorización existente (incluidos sus directorios),
una ficha concreta y comprobaciones finales acotadas; la fixture no demuestra
bytes ni costo de producción. El índice público sigue15.6, comprobado por HTTPS.

Queda aplicar este bloque junto a la activación comercial coherente: preparar
vistas/cobertura, drenar escritores, validar reglas por método permitido y
cerrar el corte con inventario remoto/costo/estado operativo. No ampliar la
contención del emulador ni reintentar OT12 por esta autorización fiscal.
