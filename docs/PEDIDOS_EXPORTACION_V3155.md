# Herramientas de pedido preparadas · v3.15.5

Estado: **publicada v3.15.5**, fuente9bc483cffa3058236d00b1df012fa18586ce10b5, Hosting09cc2c55f9d01218 y aviso oficial verificados. Se publicó sólo este alcance desde15.4, sin activar la candidata amplia15.6.

## Ubicación y comportamiento

- **Ofertas / Distribuidora → Mis listas de compra → Mi lista**: las cuatro herramientas quedan debajo de la cabecera de Lista de compra. Agregar productos, Eliminar lista y Guardar lista conservan sus acciones.
- **Compras de exterior → Preparar compra desde una venta**: las cuatro herramientas quedan en la cabecera, debajo del nombre y del total, visibles en Productos, Entrega y pago y Resumen.
- Herramientas: Copiar para WhatsApp, Exportar PDF, Descargar CSV y Compartir. En escritorio se alinean a la derecha; en móvil se distribuyen en dos columnas con controles táctiles.
- El selector de proveedor afecta únicamente WhatsApp y Compartir. PDF y CSV contienen siempre la lista completa seleccionada, en su orden original. No se agrupa ni reordena automáticamente por proveedor, marca, categoría o destacado.
- Compartir abre un cuadro de preparación. El usuario elige copiar texto, abrir su panel nativo de compartir, preparar/compartir PDF o compartir/descargar CSV. No se abre WhatsApp ni se envía un mensaje automáticamente. Si el equipo no permite compartir archivos, se descarga el archivo para compartirlo manualmente.

## Contenido del documento

El pedido muestra nombre de lista, código, producto, proveedor, cantidad a comprar, moneda, precio unitario y subtotal. Totales independientes por moneda, sin convertirlos ni sumarlos entre sí. El encabezado es neutro: no incorpora Ofertas, destacados, descripciones promocionales, Mercado Libre, descuentos del catálogo, ganancia o precio de venta.

Mi lista usa sus cantidades solicitadas, nunca la cantidad recibida/comprada como sustituto. Usa el precio de compra y la moneda conservados; si faltan, puede presentar la referencia de compra explícitamente identificada o un precio pendiente. Un producto faltante/inválido no se omite silenciosamente para aparentar una lista completa.

Preparar compra usa las cantidades que se están comprando: descuenta stock existente, respeta la cantidad pedida y agrega extras destinados a stock. Una fila resuelta completamente con stock no genera una compra. Conserva proveedor y precio acordado del borrador y su moneda; no exporta la base de ganancia, la venta al cliente ni el costo histórico para reemplazar un precio pendiente.

USD en Mi lista conserva la presentación entera acordada; ARS y el preparador mantienen sus formatos. CSV conserva la precisión numérica de la fuente. Esto no redondea ni guarda la base. El redondeo a centavos que ya realiza `initialize` del preparador no fue modificado; el exportador recibe su borrador resultante, sin alterar el original.

El PDF promocional del **catálogo completo** continúa separado. El CSV de datos crudos anterior sigue disponible como función interna; los nuevos botones de pedido usan exclusivamente el documento de compra seguro.

## Implementación y límites

- `js/core/purchase-order-export.v1.js`: DTO con lista permitida de campos, formato común, filtro manual de proveedor, CSV protegido contra fórmulas, copia y cuadro de compartir. Ninguna lectura de Firebase, guardado financiero, envío de mensajes ni consulta periódica.
- Adaptadores de sólo lectura en `paraguay-shopping-access.js` y `exterior-preparation.js`; sus cálculos y escritores anteriores se conservan.
- PDF con páginas de tamaño acotado, encabezados repetidos, filas completas o continuación explícita para una descripción mayor que una página, sin duplicar cantidad/precio. Reutiliza la dependencia PDF existente; se carga sólo al solicitar un PDF. No cambia el generador compartido de otros documentos.
- Los primeros archivos largos revelaron estilos `nowrap` y pérdida de últimas filas en el recorte de HTML heredado. La versión final genera sus propias páginas y dibuja cada fila planificada, sin usar ese recorte. No se afirma haber reparado todos los documentos antiguos.
- Índice, Service Worker y referencias de módulos preparados para la versión candidata. No despliegue de Hosting, servidor, reglas, flags, IAM, DNS, servicios o cambios de datos.

## Verificación

- **24 regresiones nuevas**: orden exacto de cinco códigos mixtos, precios/monedas, exclusión de otros productos y datos internos, fuente congelada/no-mutación, stock/extras, CSV con precisión/caracteres/fórmulas, precios pendientes, cantidades inválidas y cobertura completa de páginas. Incluye una descripción de 9.000 caracteres con continuación sin repetir cantidades ni precios.
- Puerta de preparación en la candidata amplia: **7.595 total / 7.568 aprobadas / 27 opt-in omitidas / 0 fallos**, 28,82 s. La primera puerta pasó antes de la reparación del render largo y no se usa como cobertura visual de la versión final.
- Navegador aislado: **4 recorridos completos**, ambos circuitos en 1280 y 390, módulos reales y transporte ficticio. Copia, selección de proveedor, CSV completo, PDF, compartir texto y archivos PDF/CSV, Tab/Shift+Tab, Enter en Cerrar y retorno del foco. Cero escrituras, cero consultas adicionales de negocio por exportar, cero errores JS y sin red comercial exterior. La dependencia PDF se sirvió desde una copia local de prueba.
- Cinco productos mixtos y PDFs reales de ambos circuitos; prueba de 75 filas con nombres largos: **11 páginas**, última fila75 y totales presentes, ninguna página vacía. Se renderizaron todas las páginas; revisión visual de primera, segunda y última. El PDF nativo de referencia conserva los75códigos en orden; no sustituye la prueba del PDF descargado por el botón.
- No teléfono físico, WhatsApp real ni panel nativo real del sistema operativo: esos canales se simulan para comprobar los payloads sin enviarlos. Tampoco se modificó ni navegó una sesión comercial real. Evidencia privada en `tmp/order-tools3155-qa` y `tmp/listings-next-private/order-tools3155-*`, fuera de Git.

La publicación aislada ya se completó; próximas entregas deben integrar expresamente sólo su alcance con la versión que corresponda. No usar esta rama como autorización para activar las otras modificaciones de la candidata amplia: sus bloqueos fiscales/preparación/drenaje/OT/emulador siguen vigentes.


## Comprobación posterior a Hosting

25hashes HTTPS, mirror,7cabeceras y7rutas404 verificados; web/core/SW/aviso15.5 confirmados.4recorridos con los activos reales publicados y la dependencia PDF pública, datos/SDK ficticios y llamadas comerciales exteriores bloqueadas. PDFs/CSV revisados desde ese recorrido; lista de5ítems y documento de75filas completo. La sesión auténtica no pudo inspeccionarse porque CUA falló; no se modificaron datos reales ni se enviaron mensajes. Fuente/activos y límites detallados en CONTEXTO_ACTUAL.
