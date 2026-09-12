# v3.6.0

Publicación conjunta autorizada de los cambios revisados en local.

- Actualizador: rótulos por proveedor con total, vigentes y por revisar; progreso expresado como consultas por producto y proveedor. Recotizar vigentes inicia desmarcado.
- Identidad y variación de precio: confirmar identidad conserva la fila y el costo anterior cuando falta aprobar el precio. La aprobación del importe requiere resolver primero la identidad.
- Catálogo: el importe abre los artículos seleccionados y permite ajustar cantidades. Usuarios sin permiso de crear presupuesto pueden enviar una selección a revisión si tienen el permiso específico del catálogo. Se crea un presupuesto pendiente; conserva autor, cantidades y selección si falla. Las notificaciones siguen el circuito de aprobación existente.
- Proveedores exteriores: gestión visible por defecto para admin y administrativa. Comparación de costos y margen del presupuesto tiene un permiso independiente, solo admin por defecto. Las autorizaciones explícitas configuradas en Roles prevalecen.
- Simulación de Paraguay: compara costos en ARS, usa cotización USD actual cuando hay precio original, indica vigencia/stock, conserva costos sin alternativa y permite agregar gastos adicionales. No altera la venta. No calcula margen completo si faltan costos.

Validación específica: separación de aprobaciones, cálculo de escenarios y costos faltantes, envío técnico a revisión, rechazo sin permiso, conservación del carrito ante error. Comprobaciones de sintaxis y versión. No se enviaron solicitudes ni aprobaron precios de prueba en producción.

## Convención de versiones

Formato mayor.menor.parche. El parche recorre 0 a 20; después se incrementa la versión menor y se vuelve a parche 0. Tras 3.5.21 se comienza 3.6.0 por instrucción del usuario. Usar scripts/siguiente-version.ps1 para calcular la siguiente versión. No publicar sin autorización del usuario.
