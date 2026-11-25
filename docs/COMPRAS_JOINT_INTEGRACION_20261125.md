# Cierre de despacho conjunto de Compras

La prueba contra el Guard del principal pasó recepción y extra de Stock. Al extenderla a recibir → conciliar → cancelar detectó dos omisiones del checkpoint: el wrapper de conciliación usaba siempre el modelo simple y no entregaba la lista hija; el emisor SourceCost intentaba tratar toda operación conjunta como costo V2, incluso cancelación sin autoridad de costos.

Se carga la hija original por listaOrigenId y se usa Joint.reconcile exclusivamente cuando la lista original es conjunta. El adaptador verifica padre/hija/venta/FK y restaura auditoría/precondiciones, sin simular un origen simple. SourceCost V2 se mantiene para receive conjunto y prepare/reconcile; cancelación mantiene la operación tipada y devuelve versión0, sin ganar permiso de costo.

14 focales de autoridad/cadena de modelos/protección económica pasaron. El control de composición real extendido quedó rojo en Root antes del fix (reconcile REVIEW), registrado en tmp/purchase-joint-guard-chain-red-20261125.log. No se cambiaron sus expectativas.

Repetición de integración en copia del principal, sólo lectura:

```powershell
$env:SV_PURCHASE_JOINT_CORE_SOURCE='C:/SisVentas/.local/finish-pending-20261125'
node --test test/purchase-joint-command.integration.cjs
```

La fixture firma una cohorte ficticia con clases de la misma fuente seleccionada. Guard, Policy, SourceCost, proyecciones, E y modelos se cargan de esa fuente; no se copian Guard/Store históricos. El backend de estas pruebas aún usa almacenamiento de memoria coordinado: no acredita Store REST, reglas RTDB o emulador. El principal debe repetir después de incorporar el commit. La migración no se activa por esta evidencia.
