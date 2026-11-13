# Lectura por columnas y revisión pendiente

Candidata aislada desde `260ccb13`, sin despliegue ni cambios de servidor.

## Comportamiento

- Contrasta moneda únicamente con encabezados y posiciones explícitos de PESOS/DÓLARES. Coincidencia única por página, concepto, importe y fecha; un interés compensatorio sin fecha propia conserva la fecha ya leída.
- Recupera sólo pagos negativos de rótulos permitidos con fecha y columna inequívocas. No inventa consumos omitidos ni ajusta importes para hacer coincidir un saldo.
- Separa avisos de «Novedades débito automático» del libro de movimientos, conservándolos para revisión. Si hay evidencia de un cargo real coincidente, prevalece la revisión conservadora y no se lo elimina.
- «Corregir lectura» permite modificar importe y moneda de un movimiento pendiente. Aplicar y cancelar no suben documentos ni guardan operaciones. Conserva IDs, referencias, cuotas y original; las diferencias manuales quedan descriptas al confirmar el resumen.
- La edición no se ofrece para resúmenes guardados. No cambia los permisos del dominio privado ni permite confirmar un descuadre desde la interfaz.

## Verificación

168 pruebas focales del dominio aprobadas. Chrome completo con servicio ficticio en memoria: 3 recorridos, 390/820/1440 px, edición negativa y cambio de moneda, cancelación, regreso a la cola y reapertura; ninguna escritura ni subida, una lectura simulada por recorrido. Sintaxis y diff sin errores. Capturas ficticias y logs únicamente en `tmp/private-finance-reader-qa` (fuera de Git).

La puerta general se intentó sobre esta base y no pasó: 10.396 casos, 10.064 aprobados, 248 fallidos y 84 omitidos. Incluye dependencias de navegador no disponibles sin NODE_PATH y contratos ajenos a este alcance. No se corrigieron pruebas ajenas ni se presenta la candidata como publicable; el integrador debe repetir su puerta sobre la versión conjunta vigente.

## Límites y siguiente paso

No contiene documentos, cifras, identificadores ni respuestas de IA reales. Los ejemplos son ficticios. La inspección local de originales privados comprobó los patrones de columnas, aviso informativo y pago omitido sin reenviar documentos a IA.

La sesión web conserva sus borradores, que todavía usan el lector publicado anterior. No se inyecta código ni se fuerza un botón deshabilitado. Antes de recargar se debe acordar cómo conservar/reabrir los pendientes; la aplicación actual no exporta la cola en memoria. La integración requiere actualizar los marcadores de activos de `personal-finance.html` y del caché según el procedimiento del responsable de publicación. Este bloque no modifica esos marcadores, Hosting, reglas ni infraestructura.

Pruebas:

```powershell
$cases = (Get-ChildItem test/private-finance-*.test.cjs).FullName
node --test $cases
$env:NODE_PATH = 'C:/SisVentas/cotizador/node_modules'
node --test test/private-finance-reading.native.cjs
```

La prueba nativa inicia y cierra su propio servidor ficticio en `127.0.0.1:8960`; no requiere ni utiliza credenciales.
