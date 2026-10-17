# Comprobantes de Distribuidora · primera versión

Estado: candidata v3.11.19, sin publicar, desde cc7e2cc9c09e32f0cd896394309f33ebb6cdb4fe. Producción sigue v3.11.18. No se cargaron clientes, productos, cobros ni documentos ficticios en Firebase.

## Decisiones de la primera versión

- Un acceso «Comprobantes» dentro de Distribuidora. Remito documenta la entrega y recibo documenta dinero recibido por el total de los productos incluidos. Todavía no hay recibos parciales, aplicación a una deuda ni vínculo a una lista/remito anterior.
- Cliente/contacto/domicilio se ingresan en el comprobante; no crea ni modifica clientes generales de SisVentas. Historial propio por emisor, buscador, tipo, vista previa, impresión/Guardar como PDF desde el navegador y anulación con motivo, sin borrar el original. El borrador permanece en memoria hasta emitir; no hay sincronización de borradores entre PC.
- Precios iniciales: `sv_catalogo_publico.precioUSD`, la misma proyección usada por el catálogo público y solicitudes. Se comprueba también que el maestro siga activo, visible, categoría COMPRAS PARAGUAY y no mano de obra. Primera versión incluye solo los productos publicados. No interpreta costo de proveedor como precio de venta, no vuelve ARS→USD ni inventa costos históricos. USD original se conserva; ARS se calcula con cotización configurada del momento. En pantalla y papel USD se presenta entero, sin redondear la base guardada.
- El servidor compara los precios revisados por el usuario contra el catálogo/cotización al emitir. Un cambio devuelve conflicto y conserva el formulario; el usuario pulsa Actualizar precios y revisa de nuevo. No se aplica una diferencia de precio silenciosamente. Empresa, cliente, renglones, cotización, total, emisor y fecha quedan guardados; reabrir/imprimir no consulta precios ni empresa actuales.
- Número automático separado por tipo RE/RC, reservado mediante transacción. Reintentos del mismo identificador son idempotentes y no crean dos documentos. Puede haber huecos por concurrencia, fallos posteriores a reservar número o reintentos simultáneos; no se presenta como numeración fiscal.
- Emitido es inmutable salvo anular con motivo y auditoría. No mueve stock, Caja, cuenta corriente, ventas de SisVentas ni comisiones. Recibo es un comprobante independiente, no un registro contable automático. Documento indica que no reemplaza la factura.

## Implementación y seguridad

- `cotizador/distributor-documents.js`: Auth con comprobación de revocación, identidad activa, habilitación y permiso. Administrador autorizado por defecto; rol Distribuidora requiere `sv_distribuidora_permisos/comprobantes=true` (nuevo control en Configuración de Distribuidora, por defecto falso). Otros roles requieren acceso explícito `sv_permisos/{rol}/distribuidora=true` y acción `acciones/distribuidora/comprobantes=true`; no se habilitan por entrar a Ventas ni al portal. El formulario «Ver como» no emite por otra persona.
- APIs GET `/distribuidora/comprobantes` y `/opciones`; POST `/emitir` y `/anular`. Flag del servidor `DISTRIBUTOR_DOCUMENTS_ENABLED=true` necesario. Dockerfile incluye el módulo. Nada se activó en el servidor real.
- Almacenamiento independiente `sv_distribuidora_comprobantes/{uid}/{id}` y contadores `sv_distribuidora_comprobantes_contadores/{tipo}`. API no acepta uid destino ni reutiliza el de un parámetro de vista; consulta y anula exclusivamente documentos propios, incluso admin en esta primera iteración. Autor y fecha de servidor; no acepta totales, costos, estados, emisor ni auditoría enviados por el navegador.
- Fragmento `security/distributor-documents.rules.candidate.json` propone lectura/escritura directa denegadas para ambos nodos. **No desplegado**. Antes de habilitar: revisar reglas remotas y todos los ancestros/comodines (un permiso en padre no se puede revocar en hijo), probar el fragmento integrado en emulador y comprobar rechazos directos. No reabrir base ni aplicar automáticamente la instantánea histórica database.paraguay.rules.json.
- Peticiones no-store, límites de datos, productos, cantidades, enteros seguros y textos; escape del documento imprimible. Formulario y respuestas de otra sesión se descartan. No se conservan comprobantes reales en localStorage.

## Prueba local independiente

Desde la raíz del checkout: `node scripts/dev-distributor-documents.cjs`. Abrir `http://127.0.0.1:8763/`. Solo sirve una lista explícita de activos de prueba y escucha loopback. No importa Firebase Admin ni credenciales. Todas las escrituras y contadores se mantienen en RAM; reiniciar el servidor descarta las pruebas. Usa el mismo módulo de servidor y UI con un autorizador ficticio identificado como demo. No demuestra un login real ni reglas remotas.

Validación automatizada: `node --test test/distributor-documents.test.cjs`, más suite vigente, servidor, sintaxis y coherencia de v3.11.19. Pruebas de autorización/permiso/revocación de flag, aislamiento, catálogo, snapshot histórico, recibo ARS, validación, concurrencia/numeración/idempotencia y escape/formato de impresión. Pruebas visuales y límites finales deben registrarse en CONTEXTO_ACTUAL; no declarar teléfono físico o PDF exportado si solo se vio HTML.

## Próxima iteración

Revisión visual con el titular; decidir integración a listas/cliente, recibos parciales y cobros, administración de comprobantes ajenos, descuentos/precios acordados y stock. No conectar a Caja ni stock sin definir qué operación representa cada comprobante y evitar duplicar ventas o pagos. Antes de publicar: emulador de reglas, servidor candidato y sesión autorizada real, sin emitir registros de negocio como prueba incidental.

## Informe de garantía y lector de series (candidata)

El remito permite adjuntar una hoja de garantía con condiciones del maestro y serie por unidad. El servidor verifica condiciones vigentes, series obligatorias y duplicadas antes de emitir; el documento guarda el snapshot. No asigna fecha de inicio/fin de cobertura, no crea equipos/garantías ni sustituye históricos. Si no hay condiciones definidas, hay que configurarlas; no se inventa un plazo. Recibo no incluye esta hoja.

Cada serie tiene Escanear con cámara: abre un diálogo nativo modal, solicita solo video, prefiere cámara trasera y permite elegir dispositivo. ZXing/browser incluido localmente decodifica códigos de barras y QR; no hay OCR de una serie impresa sin código. Bip único, serie revisable y carga manual. Los cuadros permanecen en el navegador y no se almacenan. Tracks y respuestas pendientes se cancelan al cerrar, leer, abandonar/ocultar la página o terminar sesión. HTTPS/loopback y permisos del navegador son necesarios; HTTP de una IP de red no permite usar cámara desde celular. Volumen/permisos del equipo pueden impedir oír el bip.

Pruebas: test/serial-camera-scanner.test.cjs ejecuta 12 escenarios, incluidos tres QR y un Code128 decodificados realmente desde píxeles ficticios, conservación de ceros, errores de permisos y cancelación antes/después de recibir stream. La vista /test/fixtures/serial-camera.html usa video simulado, no una cámara física. /mobile?scanner_demo=1 conecta esa simulación al formulario de 390 px, verifica unidad elegida, duplicados y papel emitido en RAM. Prueba física de cámara/sonido y exportación de PDF siguen pendientes. Nada se publicó.
