# Búsquedas sin resultados anteriores — 25/11/2026

Base revisada: v3.21.12, `9cbe59dd76a1d1e5aa0caaeb0ccab3427832d4a2`. La integración/publicación pertenece al principal sobre v3.21.13. Este bloque sólo modifica tres hosts de lectura; no escribe datos históricos ni cambia servidor, reglas, permisos o importes.

## Causas y corrección

- **Detalle de venta**: `previewSearch` mostraba un subconjunto local de la página anterior o la página entera con el aviso «provisorio» mientras llegaba la búsqueda indexada. Ahora un texto distinto retira esas filas inmediatamente, conserva la altura de la tabla y las métricas globales verificadas, y muestra Cargando en la región existente. Un repintado de otro consumidor no revive filas anteriores ni dispara otra consulta. Volver exactamente al filtro ya verificado puede recuperar su página sin otra lectura. Un error de otro filtro deja la búsqueda vacía con reintento, sin presentar como resultado datos de una consulta diferente.
- **Cuenta corriente**: el debounce y la consulta dejaban visible el tbody anterior, y un repintado podía volver a dibujarlo. Ahora se oculta durante la espera, preservando geometría y métricas; el paginador no añade filas. Al abrir otro cliente se limpian nombre, importes y extracto anteriores antes de consultar. Cada consulta de movimientos tiene secuencia propia y rango capturado: una respuesta de fechas anterior no reemplaza la última. Sólo se restaura una página tras un error transitorio cuando corresponde al mismo rango/filtro verificado.
- **Cobranzas**: ocurría la misma retención visual durante el debounce y la respuesta indexada. Se oculta el cuerpo conservando su altura y se impide repintarlo mientras espera. La configuración nativa desconocida tampoco deja visible una página antigua; el modo legado explícitamente deshabilitado se conserva.

Los estados usan opcionalmente `SisVentas.carga.estado(texto)`, contrato central del principal; en fixtures anteriores usan texto. No se crean avisos de pantalla completa, sondeos por reloj ni consultas históricas completas. Se conservan cancelación, sesión, revisión de permisos, cobertura, límites de consulta y readiness. Las expectativas antiguas que exigían filas «provisorias» se actualizaron por la petición expresa del usuario; sus aserciones de seguridad, métricas e IO se conservan.

## Sitios cercanos revisados

| Sitio | Resultado de inspección |
| --- | --- |
| Tres hosts indicados arriba | Patrón reproducido y corregido |
| Historial de cliente (`client-history-host.v1.js`) | Limpia regiones e identidad antes de resolver; `load` sustituye el contenido de la solapa antes de consultar. No se cambió |
| Selector de venta de Cobranzas | Ya vacía el desplegable y valida secuencia/contexto antes de publicar. No se cambió |
| Búsqueda de productos de compras (`purchase-order-search.v1.js`) | Modelo síncrono; no se observó carrera de respuesta remota en este módulo. No se cambió |
| `commercial-pages-view.v1.js` | Inactivo en índice vigente; no se modificó una copia histórica |

Este inventario no certifica todos los formularios del sistema ni las pantallas del monolito. El principal mantiene el inventario global y el indicador común.

## Evidencia local

Todas las pruebas de navegador usan HTTP ficticio en loopback y Chrome aislado; no usan la sesión del usuario. Fuentes del checkout congelado y ninguna escritura real.

- Ventas: 35/35 pruebas de modelo/host/readiness, incluidas cuatro reproducciones nuevas inicialmente rojas.
- Ventas Chrome: 3/3 (390/1280 y ordenar durante debounce); respuesta anterior cancelada no reemplaza la búsqueda actual, métricas listas y mismo total de lecturas globales. La prueba observa mutaciones de DOM durante la espera y exige cero filas para los estados Cargando.
- Cuenta corriente: 6/6 Chrome (390/768/1280 para búsqueda/reintento, apertura de otro cliente y respuestas de períodos fuera de orden).
- Paginación de extracto: 5/5 Chrome; 241 movimientos únicos, recorrido completo y regreso, error de continuación recuperable, Anterior/Página/Siguiente en la misma línea y altura estable durante Cargando.
- Cobranzas: 11/11 Chrome, incluidas búsqueda, permisos, filtros, retorno, escritura ficticia/replay existente y reproducción nueva de retención visual.
- `node --check` de los tres módulos y `git diff --check` correctos.

Logs privados bajo `C:/SisVentas/tmp/stale-*`; no se incorporan datos o artefactos privados a Git. No se ejecutó otra suite global ni se publicó desde este frente. Antes de publicar, el principal debe integrar el helper central, renovar URLs/caché de los tres módulos, ejecutar la puerta vigente y validar el sistema integrado. Las pruebas de este bloque no acreditan un cambio de Firebase ni de infraestructura.
