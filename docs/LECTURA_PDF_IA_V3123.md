# Lectura de PDF con IA · candidata local v3.12.3

## Alcance

Gastos personales inicia el análisis al seleccionar un PDF. El documento se envía a
Anthropic mediante Asistente, con aviso visible. No se guarda un resumen, se crea
un pago ni se conserva el original en el depósito hasta confirmar la revisión.
Se propone la tarjeta a partir de banco/marca; una tarjeta nueva se crea solo al
confirmar. El guardado parcial conserva la referencia de tarjeta/original para
reintentar sin duplicarlos. ARS y USD conservan centavos independientes.

El endpoint `/statement-import` autoriza token revocado, usuario activo, cambio
obligatorio de clave y UID titular. Otro administrador y Ver como quedan fuera.
Necesita `PERSONAL_FINANCE_ENABLED=true` y `PERSONAL_FINANCE_OWNER_UID` en
Asistente, con el mismo titular verificado que Cotizador. No registrar su valor.
Reutiliza `ANTHROPIC_KEY` existente, sin claves en cliente ni secretos nuevos.
Prompt fijo del servidor, sin herramientas ni navegación, PDF máximo15 MB,
100 páginas/500 movimientos y salida limitada. Respuesta truncada o inválida se
rechaza; no se presentan fragmentos como una lectura completa. Cancelar, cerrar o
cambiar de identidad invalida el resultado. No usa reintentos financieros.

Preparar compra vuelve a montar `SVPurchasePDF` en Productos. La revisión distingue
ARS/USD según cada fila, no convierte automáticamente, valida que el precio no
haya cambiado y conserva la referencia original. Aplicar guarda precios revisados
y comprobante mediante el guardado existente; no confirma órdenes. La importación
histórica mantiene USD como moneda de destino. Asistente deja de ofrecer búsqueda
web a `/purchase-import`.

## Prueba privada real autorizada

El titular adjuntó un resumen bancario de tres páginas y autorizó expresamente
su envío completo a Anthropic con la integración existente, solo para probar.
La primera ejecución fue bloqueada por revisión automática antes de transmitir;
se ejecutó tras la autorización específica. No incluir PDF, capturas, texto,
respuesta del proveedor, importes ni datos personales en Git/Hosting.

- Dos lecturas reales. La primera detectó15 movimientos y concilió ambos saldos,
  pero aproximó fechas sin imprimir y eligió un CFT de una oferta. No se dio por
  correcta. Se ajustaron instrucciones y validación y se repitió.
- Segunda lectura:15 campos financieros/de identificación de tarjeta contrastados
  con el original,15 movimientos contrastados individualmente (importe, moneda,
  fecha y tipo), saldos ARS/USD conciliados exactamente. Cuota y débito por revisar
  identificados. Cargos sin fecha usan el cierre, con esa procedencia explícita;
  período inferido marcado como sugerido y CFT de planes alternativos omitido.
- Tasas bancarias con tres decimales se conservan; modelo compartido y simulación
  admiten esa precisión sin redondear silenciosamente a dos.
- Mismo resultado real y PDF reproducidos en interfaz aislada8775, sin Firebase:
  revisión y guardado completo en RAM,15 movimientos, un candidato de seguro,
  una cuota, cero pagos creados. Eso prueba el recorrido local, no el despliegue.
- Resultado privado y comparación en `C:/SisVentas/tmp/pdf-ai/`, ignorado.
  `scripts/test-statement-ai-private.cjs` usa la clave existente en memoria, no la
  imprime; ejecutar solo con autorización explícita del documento y destino.
  El servidor de prueba puede reproducir el resultado privado con las variables
  `PRIVATE_FINANCE_AI_RESULT` y `PRIVATE_FINANCE_AI_PDF`; exige el mismo hash.

## Limpieza real solicitada

El titular pidió comenzar de cero en Gastos personales. Inventario real: una
tarjeta vacía y cero resúmenes, movimientos, pagos, seguros, cuotas, gastos,
estrategias o documentos. Se retiró únicamente esa tarjeta, con respaldo privado,
auditoría y ETag de concurrencia; lectura posterior confirmó el espacio vacío.
No se borraron datos empresariales ni se importó el PDF real a Firebase.
`scripts/clear-empty-personal-cards.cjs` se niega a actuar si hay datos financieros
o historial distinto de creación de tarjetas; no es un borrado general.

## Estado y límites

Candidata local, no publicada. Para activar el recorrido real faltan Asistente
con las variables privadas indicadas, Cotizador con el modelo de tasas/procedencia,
cliente y Hosting coordinados. No cambiar tráfico, reglas ni configuración de
producción automáticamente. El modelo actual de producción no admite TEM de tres
decimales; publicar solo el cliente no alcanza.

El caso verificado acredita ese PDF, no todos los bancos ni escaneos posibles.
La IA sigue requiriendo revisión: no prometer reconocimiento universal ni cálculos
definitivos cuando falta evidencia. El fallo de recarga mantiene sus límites en
[RECUPERACION_CARGA_V3123.md](RECUPERACION_CARGA_V3123.md).
