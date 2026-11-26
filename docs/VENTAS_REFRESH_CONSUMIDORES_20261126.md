# Refresco de Ventas según consumidor visible

Bloque aislado desde `7714ce9bd35fd711fa09f6265d7b2d686ac466e4`, rama `codex/sales-read-trim-20261126`. No cambia aplicación inmutable, índices, versión, backend, permisos ni datos. Root integra el leaf en su próxima versión y registra activos/SW; no se publicó desde este bloque.

## Causa y cambio

Después de visitar Productos puede quedar una suscripción HTTP al historial completo de ventas, necesaria para Más vendidos, Sin ventas y las métricas del producto. `refreshVisible()` actualizaba esa colección al recuperar foco/conexión desde cualquier pantalla salvo cinco exclusiones. Actualizador de precios y Kits no consumen ese historial: su entrada declara productos/proveedores y kits/productos respectivamente.

Se conserva la carga legítima de Productos. El refresco **automático** de una suscripción heredada de Ventas ahora se activa sólo en sus consumidores declarados: Dashboard, Historial del cliente, Productos, Comisiones, Facturas, Detalle, Cuenta corriente, Cobranzas y Balance de compra. Productos mantiene además su exclusión de foreground ya publicada. Los demás dominios conservan su comportamiento previo.

Al salir a una pantalla que no usa el historial se marca diferido. Al volver a una que lo necesita, `sisventas:page-changed` lo reconcilia con una lectura autorizada; avisos coincidentes comparten la solicitud en curso. No se agrega caché, sondeo ni retención nueva. Las consultas puntuales y `refresh()` explícito tras escrituras quedan intactos; tampoco se anulan autenticación, rechazo403, invalidación por revisión o cancelación de sesión.

## Evidencia

- RED aplicación completa390/1280: Detalle indexado → Productos (un GET global legítimo) → Actualizador → regreso a foco causaba un segundo GET global innecesario. Ambos casos fallaron exactamente `2 !== 1`. La primera corrida restringida no pudo acceder a loopback; no se la contó como defecto del producto.
- GREEN aplicación completa390/1280: mismo recorrido, tres avisos de foco en Actualizador y uno en Kits no agregan GET de Ventas. Volver a Facturas realiza el GET legítimo siguiente. Se mantienen readiness real, datos del backend ficticio idénticos, cero comandos y cero commits.
- Pruebas de modelo cubren diez pantallas sin consumo global, regreso al consumidor, foco oculto, coalescencia, refresco explícito, lectura puntual desde OT, revisión de permisos, respuesta403 y logout. Ocho consumidores visibles mantienen su refresco.
- Regresión de arranque completo Nueva venta390/1280: continúa con cero lecturas de historial. Productos y empleados siguen siendo fuentes necesarias; el número sólo se asigna al guardar.
- No se modificaron expectativas de tests existentes ni reglas económicas. No se ejecutó la suite global ni se acreditan consultas de todas las pantallas o ahorro global de producción.

Comandos focales:

```powershell
$env:NODE_PATH='C:/SisVentas/cotizador/node_modules'
node --test test/sales-foreground-consumers.test.cjs test/commercial-cached-records.test.cjs test/commercial-ownership-session.test.cjs
node --test test/sales-foreground-consumers-full-app.test.cjs test/new-sale-no-history-full-app.test.cjs
node --check js/core/commercial-ownership.js
git diff --check
```

La métrica acreditada es cero GET global adicionales durante foco en las dos herramientas del recorrido, en vez de uno por la ráfaga reproducida. No se atribuye una mejora de milisegundos de producción ni reducción de lecturas RTDB por un304. El transporte de autenticación/SDK es ficticio, con el índice y aplicación completos reales.

## Revisión descartada

Se examinó si entrar a Detalle indexado refrescaba también el historial completo. La prueba mostró que el host ya hace `stopDomain('ventas')`; por eso no se añadió un veto redundante ni se cambió ese circuito. Tampoco se retiró `fbCargarVentas` de Productos: sus consumidores visibles hacen legítima esa dependencia.
