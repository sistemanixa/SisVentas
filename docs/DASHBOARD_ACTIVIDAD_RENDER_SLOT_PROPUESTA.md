# Consumidor de actividad reciente · slot de host propuesto

Diff aislado para `js/modules/activity-history.js`, sin tocar app/index ni integración root. El camino nuevo sólo se elige cuando window.SV_DASHBOARD_READS_LOCAL === true; OFF/ausente/no booleano conserva el renderer legacy estable. Mantiene `window.dashRenderActividadReciente()`, IDs `dash-actividad-card` / `dash-actividad-lista`, cinco filas, iconos/clases/colores, estructura flex/ellipsis y formato visual legacy de importes enteros. Los importes vienen de `amountCents` canónicos; no se escriben ni redondean originales. OT/Presupuesto no muestran importes. Se conserva la condición `tienePermiso('dashboard.actividad')` y la clase de tarjeta existente; no se amplía acceso de roles.

## API frontend para conectar desde root

El renderer consulta únicamente `window.SVDashboardActivityHost.peek()`, síncrono y sin efectos de red:

```js
{
  status: 'idle' | 'loading' | 'ready' | 'error',
  authority: 'current' | 'retired',
  data: aggregatePacketOrNull,
  revalidating: false,
  error: optionalError // no se muestra su texto
}
```

`data` es DIRECTAMENTE el resultado real de `SVDashboardActivityAggregateProposal.create(...).read()`: schema1, con `activity` schema2, complete, order global v3, precision legacy-instant, status ready/empty, sources completas e items ya ordenados/máximo cinco. No `{ok,result}`, no arrays de originales ni prefijos parciales. El módulo valida el resultado usado para pintar: orden/protocolo, fuentes completas, tipos, clave/sort/id únicos y dinero canónico. Usa `SVDashboardActivityModelV2` ya requerido por el agregador; si falta no certifica vacío ni arranca lecturas.

Root es dueño de lectura, readiness del nuevo consumidor, retención e invalidación. Debe enlazar ese slot con su snapshot verificado y llamar a `dashRenderActividadReciente()` después de cada cambio visible (incluido retiro). `peek` debe comprobar/retirar autoridad con sus guardas locales antes de entregar datos; nunca llamar ensure/read/refresh ni iniciar una petición. No se añade un contrato backend ni un índice/servicio.

`authority:'current'` sólo permite retener datos del mismo contexto autorizado. 401/403, cambio de User/Auth/UID/rol/permisos/grants/sessionEpoch/dataEpoch o retiro de la captura deben producir `authority:'retired'`/data retirada, no un simple error con datos antiguos. Un error de transporte/revalidación bajo la misma autoridad puede conservar el último paquete válido. No es responsabilidad del renderer obtener tokens, comprobar Firebase ni mantener una caché propia.

## Estados y límites

- Sin slot / idle / loading sin dato: «Actividad pendiente de carga», aria-busy, nunca «Sin movimientos».
- Ready completo no vacío: exactamente los items del merge, sin reordenar por fecha local ni volver a filtrar arrays.
- Ready completo vacío: único estado que certifica «Sin movimientos recientes».
- Revalidación con dato actual válido: conserva las filas y agrega «Actualizando actividad…».
- Error con dato actual válido: conserva las filas y agrega error estático. Sin dato: error explícito, no cero.
- Autoridad retirada: borra las filas incluso si el host todavía pasó un dato viejo. No recupera filas de una caché interna.
- Permiso de tarjeta denegado: oculta/limpia y ni siquiera consulta el slot. Al reautorizar restaura sólo la visibilidad que había ocultado el módulo.

La rama ON no accede a ventasList, pagos, otData, pptoData ni SVDataReadiness original; no declara completas esas colecciones. No llama fetch/fbGet/onValue/ensure/refresh. El calendario de etiquetas sigue siendo presentación Date/es-AR como antes; la selección/orden de eventos proviene del merge validado, no de un parser local.

## Pruebas y entrega

34 focales PASS, cero FAIL/SKIP: diez casos ejecutan el archivo REAL del renderer con paquetes obtenidos del agregador real y puertos ficticios; se instrumentan getters prohibidos de arrays/readiness y métodos de red. Cubren carga, vacío certificado, revalidación, error con/sin datos, retiro, permiso, integridad y escape de texto. Dieciocho pruebas del modelo previo y seis del modelo v2 continúan aprobadas.

La prueba antigua que afirmaba que el renderer seguía una página histórica se sustituyó por la regresión positiva del consumidor actual. La comprobación independiente del parser legacy conserva sus casos/valores: sólo se movió su oracle congelado de 9779d059 a `test/fixtures/activity-history-date-legacy.cjs`, porque producción ya no debe parsear originales. La prueba de orden v2 ahora comprueba que el renderer muestra sin cambios el orden entregado por el merge; no simula que el renderer todavía calcula ese orden.

Dos casos Chrome headless PASS, 1280 y390px: fuente JS real servida sólo por loopback, cinco filas, fondo opaco, ellipsis y sin overflow horizontal, actualización/error conservados, retiro sin filas y cero requests del renderer. Se revisaron visualmente las capturas ready/error de escritorio/móvil en `C:/SisVentas/tmp/activity-{1280,390}-{ready,error}.private.png`. La maqueta usa tema oscuro mínimo; no carga la fuente externa Tabler (se verifican las clases, no sus glifos). No es una verificación del HTML completo, del botón existente ni de todos los formularios de la aplicación.

Repetir navegador con `SV_ACTIVITY_RENDER_BROWSER=1`, `SV_ACTIVITY_RENDER_ARTIFACTS` en carpeta privada existente, NODE_PATH a Playwright y opcional SV_CHROME_PATH. Los servidores/Chrome de prueba se cierran al terminar. Logs privados `activity-history-render-focal.private.log` y `activity-history-render-browser.private.log`. No se ejecutó general ni se recargó la ventana del titular; sigue pendiente montar host/contexto/readiness y comprobar la unidad en la aplicación real. No hay publicación, cambios financieros ni nuevos endpoints.

SHA256 focal: B786847778F3880DB3D002A662D976351CE97B53DDAFB7AC2C0259471A84E6A1; navegador: C23D96F82E7123940A9AD01323A0D3EC2BE0E929F31C82BF2CCBE804431259E9.

## Transición explícita sobre 2bc44c5a

Se corrige el reemplazo incondicional: se preserva la implementación legacy de 9779d059 dentro de una función privada y sólo se usa con SV_DASHBOARD_READS_LOCAL distinto de true booleano. No se establece/activa el flag en producción, no se modifica app/index y no se duplica ni crea un host. OFF no inspecciona el slot ni requiere Core; mantiene exactamente el HTML, arrays, parser y permiso anteriores. Es una compatibilidad temporal explícita, no una reparación de las limitaciones legacy.

ON continúa usando exclusivamente el snapshot verificado. Missing/error/retired no cambian el flag ni llaman legacy: el caso ON tiene getters de arrays que fallan si se acceden. Las pruebas anteriores de consumidor/renderer y navegador ahora declaran ON sólo dentro de sus fixtures. El oracle de fechas legacy ya congelado queda intacto. Un nuevo oracle del renderer estable permite comparar HTML y visibilidad OFF sin cambiar las expectativas anteriores.

Resultado del delta: 39 focales PASS, cero FAIL/SKIP (34 anteriores más cuatro flags OFF/no booleanos y un caso ON sin fallback); cada caso OFF compara también vacío y permiso denegado contra el legacy congelado. Dos Chrome ON PASS a1280/390, cero FAIL/SKIP. Logs privados activity-history-transition-focal.private.log y activity-history-transition-browser.private.log. No se ejecutó general, no hubo publicación ni recarga de la aplicación; root conectará el slot y la activación en su unidad.

SHA256 transición: focal 83A1C89EA72AE63E21F348F6888E046253D14C26BFDB24B2F92E7F4EC186743B; navegador 3B7CA0F73B29D598510C0CDC2596C71855D27AC1D05D027473A1EEFF868A5115.
