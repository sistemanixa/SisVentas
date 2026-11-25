# Interfaz Compras: flujo disponible v2

Delta sobre dc605: recepción futura suma al general con traza descriptiva y no aumenta reservado; usar existencias conserva saldos y guarda vínculos schema2. El modo coordinado mantiene rutas, CAS, recovery y prohibición de fallback SDK tras errores. El modo OFF explícito usa los originales completos o devuelve REVIEW si la identidad física es ambigua; no crea una rama de inventario desconocida.

Se conservan recibos anteriores, pendientes históricos y reservas físicas. Sólo el evento de recepción nuevo se marca `inventoryFlowVersion:2`; completar una recepción sobre una orden antigua no etiqueta retrospectivamente toda esa orden. La prueba del controlador completo simula pérdida de ACK y comprueba un ingreso único, conservación de la recepción anterior y continuidad de pagos/comisiones.

Eliminar se ofrece para borradores independientes elegibles. Las órdenes linked muestran Cancelar con motivo identificable para conservar vínculos de venta/lista. Instalación con escritor OT OFF devuelve REVIEW sin escrituras ni confirmación: no inventa entrega/custodia ni omite una actualización genuina del ledger. La conexión de entrega/instalación/devolución pertenece al frente OT del principal.

Evidencia final main: 63 pruebas focales PASS; dos controles Chrome del borrado nativo revisado PASS; 31 escenarios HTML ON ×390/768/1280 PASS en Chrome headless contra HTTP ficticio, con cero escrituras SDK en esos recorridos. OFF se verificó mediante controlador completo Node/VM, no se cuenta como recorrido visual Chrome. No emulador ni producción.

Fuentes congeladas SHA256: purchase-orders.js `2178eabc7486b44a325c3bff88938a144455772a2d20a7038b163d2145c51e92`; adapter `5b0664731683a50651a2bbb0d9baf2da5ddcdd73dcddc3e9d21c260344c146bb`. Logs privados en tmp/purchase-ui-v2-main-63-20261125.log, purchase-ui-v2-browser-main-20261125.log y purchase-oc49-native-v2-main-20261125.log.
