# Corte aplicado · v3.13.19

Estado: **corte autorizado, aplicado y web publicada/verificada el20/10/2026**. El titular confirmó que no había pagos ni emisiones en curso. Guardados habilitados; misma sesión y pestaña conservadas. Estado externo, SHA, hashes, pruebas y límites registrados en el primer bloque de [CONTEXTO_ACTUAL.md](CONTEXTO_ACTUAL.md).

Cotizador activo `cotizador-scoped19-9c6b3126` con14 tags y modo acotado; emitirFactura `emitirfactura-00029-pob`. Ambos fuera del modo revisión, mínimo0/CPU por solicitud y configuración ajena conservada. Reglas exactas aplicadas `978cea4169880cd9b5d2782fbe17b7243a2fea562cb1737cb15292ebaa2e1782`;141 escritores antiguos retirados antes de la preparación única de índices, confirmada y verificada sin cambiar registros financieros. Hosting `918f982124142fff`,16/16 activos y aviso19 comprobados. Se conservaron revisiones nuevas protegidas en revisión para contención.

**No repetir bootstrap ni ejecutar este protocolo como si siguiera pendiente.** Los apartados siguientes conservan la preparación y la secuencia histórica revisada. La web real se comprobó en lectura; las pruebas de operaciones financieras y concurrencia fueron aisladas con datos ficticios. No se registraron pagos, comisiones ni emisiones reales de prueba.

## Paquete y comportamiento

La base es la web publicada v3.13.18. Conserva el visualizador, aprobación confirmada de presupuestos, F5, seguros/cuotas y las reparaciones de sincronización. Los cuatro comandos laborales dejan el GET/PUT de toda `sisventas` y usan conjuntos de registros, con las mismas funciones de cálculo. Pago, cuenta del empleado, adjunto, lote, auditoría, índice y acuse se confirman en la misma operación cuando corresponden.

Conserva pagos anteriores, centavos, comisiones pagadas, participantes y permisos. Una respuesta perdida exige consultar el intento antes de repetirlo. No agrega consultas periódicas ni instancias mínimas. SAC, incorporación explícita de comisiones antiguas y algunos mantenimientos conservan lecturas amplias de Gastos para detectar históricos: este corte no demuestra eliminación de toda lectura amplia ni un costo mensual garantizado.

La revisión final añadió dos defensas de autorización: bloqueos RTDB como objetos dispersos se respetan en redistribución y servicios fiscales; configuraciones malformadas se deniegan. La clase de factura/NC se deriva del tipo fiscal, evitando que una bandera falsa eluda el permiso de nota de crédito. Los cálculos fiscales canónicos permanecen intactos. El espejo fuente de autorización de Asistente también está corregido para conservar paridad, pero no es un escritor financiero y este corte no requiere desplegarlo.

## Verificación reproducible

- Puerta vigente mediante `scripts/test-current.ps1`:2.967aprobadas,27opt-in,0fallos (2.994casos), con Node24.17.0 y las dependencias locales existentes. Los 27 casos opt-in de reglas/runtime se ejecutan además explícitamente en emulador demo; no se convierten en ceros por omitirlos en la puerta normal.
- Cotizador: `node --test test/*.test.js` desde su carpeta;94/94. HTTP comercial y firmas OIDC efímeras:8/8, sin Google ni datos reales.
- Emulador:43/43, secuencial, proyecto `demo-sisventas-fence-proof`, loopback9017, reglas completas generadas desde la base exacta. Incluye revocación, cambios de rol/revisión, fence vencido, escapes Admin/callbacks tardíos, pagos concurrentes, tombstone/respuesta perdida y generación de comisión idempotente. Otras16 pruebas puras de política/bootstrap también aprobadas.
- Borradores representativos de presupuesto/venta guardados y editados en emulador:60 comprobaciones contra base actual y candidata; aislamiento entre UID, revocación, ID y tombstone. Relevamientos/configuración ajena y huellas de negocio ficticio conservados. No se guardó un borrador real.
- Fiscal/permisos/paridad:45/45; revisión independiente42/42 y matriz del handler con Facturas y NC A/B/C. Sólo proveedor ficticio. Empaquetador fiscal12/12. No son emisiones reales.
- Aviso de recuperación con CSS/módulo reales, transporte en memoria y CSP `connect-src none`: escritorio1280x720 y móvil390x844; centrado, foco, Escape, fondo bloqueado y recuperación sin reenviar. Demo y servidor cerrados; viewport restaurado. No se recargó ni modificó la pestaña comercial del titular durante estas pruebas.

Los logs, capturas, reglas y manifiestos privados quedan en `C:/SisVentas/tmp/big-update19/` y `C:/SisVentas/tmp/big-update-preflight/`, fuera de Git. El resultado final y el SHA se registran en CONTEXTO_ACTUAL al cerrar la preparación.

## Preflight externo de sólo lectura · 20/10/2026

Reglas vigentes leídas a18:30UTC, hash semántico `136954197b29137f0f92f0765dedace395c84d19c316ed02d33958316e83822a`. Candidata regenerada idéntica a la ya compilada sin aplicar: `978cea4169880cd9b5d2782fbe17b7243a2fea562cb1737cb15292ebaa2e1782`. No se aplicó ninguna regla. Repetir la comparación inmediatamente antes del corte; un cambio exige revisar y probar otra candidata.

Los dos escritores están en `southamerica-east1`:

| Servicio | Revisión lista/última | Tráfico y accesos | Inventario completo |
| --- | --- | --- | --- |
| Cotizador | `cotizador-quota-notes-254e69d7` |100% y14 tags a esa revisión |114 revisiones |
| emitirFactura | `emitirfactura-00027-yed` |100% a LATEST, sin tags |27 revisiones |

Cotizador tiene `COMMISSION_OBSERVER_ENABLED=false`; ninguno tiene el modo acotado activo. Ambos usan CPU por solicitud y mínimo0 implícito en la configuración leída. No se cambió capacidad, tráfico, etiquetas, secretos, IAM ni DNS. Este inventario es una foto de configuración, **no acredita ausencia de solicitudes ni drenaje**. No se consultaron operaciones financieras ni se leyeron datos de clientes para obtenerlo.

## Orden del corte posterior

Aplicar el protocolo completo de [REDISENO_CIRCUITO_LABORAL.md](REDISENO_CIRCUITO_LABORAL.md), sin saltarse estas condiciones:

1. Confirmar con el titular una ventana sin pagos, comisiones o emisiones en curso. Resolver previamente intentos ambiguos con sus acuses. Guardar SHA completo, paquetes, configuración e inventario actualizados; no lanzar scripts Admin de mantenimiento.
2. Preparar los dos servicios desde la fuente revisada, con circuito acotado y modo de revisión activos; conservar cobro por solicitud/mínimo0 y los demás límites existentes. No activar el observador por reloj. No cambia el resto de servicios.
3. Cerrar clientes antiguos mediante las reglas exactas probadas. Dirigir tráfico y todos los tags al código protegido o retirar tags que ya no correspondan. Retirar escritores Admin anteriores conforme al protocolo y acreditar terminación; un timeout o migrar tráfico no demuestra cierre de una solicitud. Si falta evidencia, conservar modo revisión y no ejecutar bootstrap.
4. Sólo después, preparación explícita de índices/configuración con hash de reglas exacto. No migra ni reemplaza pagos/ventas/gastos/comisiones. Límite8MiB/60s y verificación de cobertura; no usar una descarga de la raíz como alternativa.
5. Habilitar guardados protegidos; publicar Hosting desde el SHA limpio, comparar activos, y sólo después actualizar el aviso de versión. Verificación de producción en lectura, sin operaciones ficticias. Mantener sesión, borradores y navegación.
6. Ante fallo, conservar reglas y modo revisión; corregir hacia adelante. No volver a Admin/PUT raíz ni restaurar negocio sobre operaciones nuevas.

Preparar los paquetes es local y no construye imágenes en Google. La estimación anterior para la futura compilación era menor aUSD1 y la preparación del índice aproximadamenteUSD0,007, según la medición privada anterior; no es una tarifa fija ni una lectura nueva de facturación. Reconfirmar el alcance/costo informado antes de activar. No se agrega un servicio ni costo fijo de infraestructura.
