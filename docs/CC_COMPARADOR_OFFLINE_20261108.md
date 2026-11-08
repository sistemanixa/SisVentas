# Comparador offline de Cuenta corriente

Preparado sobre `10aecd47a71954ccffb455c956c011bc90e62325`, sin editar el producto,
consultar producción ni crear recursos. Complementa el corte único de Accounts;
no agrega otro lector. No acredita que ese corte esté publicado.

## Ejecución

Con Node 22, desde la raíz:

```sh
node --test test/cc-before-after-comparator.test.cjs
node test/fixtures/cc-before-after-comparator.cjs
```

`compare(options)` permite definir clientes, ventas, presupuestos, repeticiones
y demora simulada. No acepta URL, credenciales ni transporte externo.

El conjunto predeterminado tiene 225 clientes ficticios, 1.200 ventas con doce
ítems cada una, 400 pagos globales, pagos embebidos y resúmenes legacy, anulados,
ventas de 2020 y 2026 y 64 presupuestos vinculados. El actor es administrador,
scope `all`, revisión de permisos 1. Todos los casos comparten exactamente los
mismos originales y su checksum. El test pequeño usa 75 clientes/300 ventas.

El antes ejecuta `createCommercialOwnership.authorize/list` y la función activa
`_svConstruirCuentaCorriente`; el después ejecuta el reader real de Accounts y
la proyección real del mismo conjunto. La adaptación de identidad legacy sólo
resuelve los IDs explícitos de la fixture: no es prueba de identidades ambiguas.
La paridad recorre TODAS las páginas fuera del tiempo de primera entrada,
comparando cada cuenta y los totales en centavos. No compara sólo las 50 visibles.
También comprueba originales intactos, ausencia de consultas en reposo y rechazo
antes de leer tras revocar acceso. Las pruebas completas de sesión/concurrencia,
reglas/escritores/identidad y ACK incierto son las del paquete, no este runner.

## Resultado de esta ejecución

Diez repeticiones tras calentamiento. Demora pedida al temporizador ficticio:
2 ms por operación; Windows puede agrupar temporizadores, por lo que la espera
observada NO equivale a una red de 2 ms. CPU de proceso y unión de intervalos
de espera se registran por separado del tiempo de pared. No deben sumarse:
pueden solaparse y la CPU de Node es de granularidad gruesa.

| Medida | Legado | Accounts |
|---|---:|---:|
| Primera entrada, mediana de pared | 145,95 ms | 40,19 ms |
| CPU del proceso, mediana | 62 ms | 15 ms |
| Espera simulada observada, mediana | 94,75 ms | 39,97 ms |
| JSON entregado al cliente | 2.104.582 bytes | 34.978 bytes |
| JSON interno del backend | 1.951.590 bytes | no modelado para SDK |
| Operaciones simuladas, ambas capas | 71 | 8 |

Paridad: 225 cuentas completas idénticas, SHA256 del resumen canónico
`bdfc90771e7cce4ef2dcb9be60b7013912ecbec96cfb8a6a8e817df8e070f382`.
Checksum de originales ficticios:
`a4327d072fc741a6f6339f71d3dbf04e89a7525ededc84f34a32dcde1a52c4c4`.
Construcción inicial de la proyección y del índice ficticio fuera de la medición;
el costo de mantener la proyección por escritura queda expresamente sin medir.

Los 71 llamados incluyen frontend y backend del legado; los ocho del reader son
operaciones SDK. Se conservan recuentos por capa en la salida: no presentar esa
comparación como número de solicitudes HTTP equivalente ni como factura. Los
bytes son JSON sin compresión ni cabeceras, no transferencia real facturable.
No incluye token, autorización de reglas RTDB ni caché/304 real en el transporte
del SDK. No simula DOM, filtros, Service Worker, cold start o render del navegador.

## Aceptación pendiente en web

La observación real anterior fue retorno de unos 2,95 s y recarga sin filas al
comprobar a ~6 s/con filas a ~11,2 s; son tiempos de automatización y cotas de
observación, no RTT exacto. No atribuirlos al DOM: evidencia sintética previa
registró aproximadamente 20 ms de conciliación y 10 ms de tabla para 225 cuentas.

Después del único corte coordinado, comparar la misma identidad, filtros y
datos verificados: recarga, retorno desde Dashboard y detalle de cuenta. Separar
primer contenido útil de READY confirmado, metadata de red, cálculo y pintado;
conservar totales históricos completos y errores/revocaciones. Verificar bytes,
lecturas y reposo sin aumentos, además del costo de mantenimiento de escritores.
La prueba offline no sustituye esa medición ni demuestra ahorro en dólares.
