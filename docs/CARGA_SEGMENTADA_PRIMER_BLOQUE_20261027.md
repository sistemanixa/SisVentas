# Primer bloque de carga segmentada · candidata local v3.15.9

Estado: implementado y probado localmente desde producción v3.15.8 (a7592ccc853a386a62ce54748a3117895ee36ac0). No publicado ni activado en Firebase/Cloud Run. Rama codex/carga-segmentada-detalle; checkout propio carga-segmentada.

## Alcance real

Entrada `?ventaPuntual=<clave técnica>#/detalle`, con enlace «Consulta puntual» en el detalle existente. Usa el ingreso existente y después evita la carga global/activos de otros módulos. Consulta de sólo lectura: cliente, artículos, total, cobros y saldo de UNA venta. No reemplaza editor, comisiones, OT ni el resto del detalle completo. El enlace al sistema completo conserva esos circuitos anteriores.

Servidor: GET `/comerciales/ventas/puntual/:key`, Auth verificado, identidad activa, permiso de módulo, propiedad y revalidación antes de responder. No amplía permisos. Proyección explícita sin PDFs de facturas, costos privados ni comisiones. La venta se lee por clave; los cobros utilizan el índice existente paymentRefs_v1 y las fuentes individuales. No hay fallback a raíces de ventas/pagos. Cobertura faltante produce error, nunca saldo cero. Cobro global relacionado sólo por número comercial (sin clave técnica) se rechaza como pendiente de revisión: no se presume unicidad de alias históricos sin un índice de ventas que la pruebe. Conserva pagos antiguos/embebidos/legacy y anulación según el modelo vigente. Cambios concurrentes de venta, cobertura o permisos retiran el resultado.

No crea servicios, cron, listeners globales ni escritores. Límite de 2.000 candidatos de cobro por venta; requiere revisión específica si se excede. Las lecturas pequeñas de usuarios/roles/permisos siguen completas como en el autorizador actual; el tamaño real depende del directorio. No se afirman costos cero ni ahorro de factura medido.

## Medición antes/después

Aplicación real v3.15.8 contra candidata, navegador Chrome, SDK/Auth y negocio ficticios; 1.001 ventas, venta solicitada de 2024 con cobro actual, total10.000/cobrado3.000/saldo7.000. HTTP real en loopback, latencia/ancho de banda simulado sobre negocio (128KB/s +150ms HTTP, +30ms DB); activos estáticos sin limitación. Tres repeticiones por variante/perfil; espera adicional2,5s para incluir lecturas secundarias iniciadas. Baseline muestra detalle completo; candidata muestra consulta acotada de sólo lectura: no hay paridad de todas las acciones.

| Conexión | Antes, mediana usable | Después, mediana usable | JSON lógico DB antes/después | Cuerpo HTTP negocio antes/después |
|---|---:|---:|---:|---:|
| Normal |516ms|328ms|881,8KB /2,6KB|1.037,6KB /454B|
| Lenta simulada |8.540ms|1.097ms|881,8KB /2,6KB|519,5KB /454B|

Rango normal anterior510–7.963ms por primer arranque frío; nuevo277–337ms. Lento anterior8.537–8.574ms; nuevo1.077–1.198ms. Diferencia de HTTP anterior según perfil responde a cargas secundarias/caché y ventana observada; no se extrapola a tarifa de Google. DB es suma JSON lógico de lecturas instrumentadas, no framing/facturación Firebase. Nuevo20 lecturas, ninguna a raíces de historiales; cero escritores ficticios. Saldo7.000 correcto en todas las repeticiones. No se consultaron registros reales ni servicios de Google para medir.

Comparador reproducible: `scripts/qa-carga-segmentada.cjs`, requiere Playwright/Chrome/Git disponibles. `SEGMENT_OUTPUT` controla salida privada; `SEGMENT_QUICK=1` repite una vez por variante/perfil; `CHROME_BIN` permite Chrome instalado. `--serve` abre sólo loopback8936 con identidad y negocio FICTICIOS; CSP self, sin SDK Firebase, sin escrituras HTTP y rutas estáticas permitidas. No sirve el repositorio completo. Resultados privados no se agregan a Git. Prueba local visible al usuario en8936; NO implica sesión real ni datos de producción.

## Validación

- Suite vigente:6.102total /6.075PASS /27opt-in omitidas /0fallos, tras integración y ajustes de sesión/móvil.
- Servicio cotizador:94PASS/0fallos.
-12 regresiones nuevas: saldo antiguo/cobro actual, volumen ajeno constante, cobertura, revocación, concurrencia, permiso de cobros, ausencia de escrituras, legacy, anulados, flag/propiedad, Ver como/reset.
- UI realapp ficticia390/1280: panel sin desborde, tabla con scroll propio y teclado, saldo correcto, cero escrituras. Error/reintento, cambio de rol y cierre de sesión comprobados. Contraste corregido e inspeccionado.
- Sintaxis, versión local con script oficial `-ValidarLocal` y diff verificados. Ninguna actualización del aviso remoto.

## Dependencias y siguiente bloque

Antes de activar: revisar configuración real de COMMERCIAL_OWNERSHIP_ENABLED y COMMERCIAL_POINT_READ_ENABLED; el nuevo flag está apagado por defecto. Comprobar cobertura de paymentRefs_v1 y que TODOS los escritores mantengan membresías/coverage con el protocolo existente. No ejecutar migración ni activar sólo un flag suponiendo que el índice existe. Coordinar con titular de publicación el servidor/índices/seguridad antes de web, con revisión de las dependencias comerciales todavía no publicadas. Esta entrega no modifica cobertura remota, datos, reglas, garantías ni saldos.

PENDIENTE: dashboard de mes actual/anterior, lista de seis meses paginada/Mostrar anteriores, búsqueda e historial puntual del cliente, obligaciones históricas completas, y migración de consumidores que dependen de ventasList/pagosList globales. No recortar esos arreglos hasta sustituir cada cálculo y demostrar paridad (deudas viejas, devoluciones, comisiones, OT, inventario). Este primer bloque NO vuelve liviano el inicio general ni elimina sus raíces globales. No declarar completada la segmentación de todo SisVentas.
