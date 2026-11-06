# Nueva Garantía: regresión HTML ficticia

`test/page-demand-readiness.test.cjs` conserva seis casos opt-in de Nueva Garantía. Usa `./fixtures/postventa-full-app.cjs`, que sirve el índice y la aplicación activos del checkout, módulos reales y datos exclusivamente ficticios en loopback. No depende de archivos privados ni de una versión histórica fija.

Después de coordinar el uso exclusivo de Chrome, ejecutar desde la raíz del checkout, con Node y Playwright disponibles:

```powershell
$env:SV_GARANTIA_MANUAL_RUN='1'
$env:SV_GARANTIA_MANUAL_CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe'
node --test --test-name-pattern 'Nueva garantía fría' test/page-demand-readiness.test.cjs
```

Ambas variables son obligatorias para ejecutar los casos; sin ellas quedan omitidos. Si Playwright no está instalado en la resolución de módulos del entorno, configurar `NODE_PATH` hacia su instalación disponible. No se instalan dependencias automáticamente. El ejecutable del navegador se configura por variable, sin rutas personales incrustadas.

Casos conservados:

1. En 390 px, lista fría sin consultas comerciales; elegir cliente consulta ventas autorizadas y elegir venta obtiene el original puntual antes de habilitar equipos.
2. El mismo recorrido en 1280 px. En ambos casos `ventasList` permanece vacío y se verifica la referencia del producto.
3. Denegación al consultar ventas: selector deshabilitado, error visible y ausencia de falso «no tiene ventas».
4. Cambiar cliente mientras el original está retenido: recibir la respuesta HTTP tardía no repuebla equipos ni conserva opciones anteriores.
5. Cerrar el modal con el original retenido: recibir la respuesta HTTP tardía no restaura opciones ni equipos.
6. Terminar sesión con el original retenido: limpieza inmediata de controles y caché del formulario. Este caso no exige recibir la respuesta, porque terminar sesión cancela el transporte.

Cada caso crea y cierra su propio servidor y navegador headless; bloquea solicitudes de navegador fuera del origen ficticio y comprueba que no haya escrituras simuladas, errores JS ni accesos bloqueados registrados por el SDK ficticio. No abre el navegador del usuario ni pulsa Guardar.

La selección explícita de cliente usa el lector completo autorizado existente y conserva sólo las filas de ese cliente en el formulario. No equivale a una consulta indexada por cliente ni promete cero lecturas históricas. La lista y el arranque no hacen esa lectura comercial.

Los seis casos pasaron en la validación local del bloque. La repetición sobre la integración final queda a cargo del coordinador. Las pruebas financieras y de integridad del original permanecen en sus archivos Node separados. Esto no valida todos los formularios, operaciones financieras, permisos remotos, foco/teclado ni dispositivos físicos, y no acredita un despliegue.
