# Historial de pagos regional · 26/11/2026

Fuente funcional: 66b5e9a8da881acf70ef86c06867aae5a91b7117, candidata v3.22.0. El lector conserva BusinessAuth, Ownership, PaymentSnapshot, las relecturas de fuentes, autorización final, propiedad vigente y cobertura final. No modifica pagos ni reglas de datos. Una apertura combina venta e historial, sin consulta SDK adicional ni fallback tras un error.

La medición regional de sólo lectura confirmó que la base está en Iowa: cinco GET del mismo metadato y dos consultas Auth inexistentes, con identidad equivalente. Muestras cálidas de RTDB en São Paulo 175–178 ms frente a Iowa 31–32 ms; Auth cálida 359 ms frente a 58 ms. Son mediciones de transporte, no tiempos de apertura de una venta. Los Jobs temporales fueron eliminados.

Servicio sv-sale-payment-read, us-central1, revisión sv-sale-payment-read-00001-6r6, mínimo0/máximo4/concurrencia1/CPU1/2Gi; misma identidad que el servidor actual. Imagen sha256:82a81b0394a3dcae17ef73df627accf9f9dd942ab4974b58fa93a43fdcf54a33: conserva150 archivos exactos de producción20 y añade sólo entry readonly + adaptador de lectura. Comando node sale-payment-read-server.js. No cambia el servidor principal ni sus capacidades.

El corte de gasto existente incluye ahora este quinto servicio: dos líneas de política, mismas condiciones USD60/noviembre, cuatro fuentes remotas verificadas, misma configuración y trigger. Misma cuenta de control con rol get/update, vinculado sólo al nuevo servicio. No se ejecutó evento de corte ni se deshabilitó RTDB como prueba.

38 pruebas sobre módulos exactos de imagen y QA fullindex22 AUTO390/1280 correctos: 1GET por apertura, repintado0GET, retorno y rechazo403 sin fallback; datos ficticios intactos. Revisión independiente de entrada y selector sin bloqueantes. HTTPS privado: 401 sin sesión comercial, POST501, ruta ajena404, preflight origen exacto204.

Publicación aplicada: suite vigente 11.481 total, 11.389 PASS, 0 FAIL, 0 canceladas, 92 condicionales omitidas, SHA antes/después estable y árbol limpio. Hosting 729/729 activos HTTPS con SHA exacto y cabeceras conservadas; aviso oficial confirma v3.22.0-firebase. Transporte público sólo de este lector, Auth comercial sigue obligatoria; HTTPS real 401 sin sesión, 403 origen ajeno y preflight204. El servidor principal permanece en cotizador-r20-abb16d8.

Límite pendiente: la herramienta visual no pudo inicializar (Windows GetCursorPos Acceso denegado0x80070005); no se pudo medir todavía una apertura real del mismo pago. Logs del lector sin GET200 al cierre de esta comprobación. No atribuir los tiempos del probe ni del fixture al pago real. Se pidió desbloquear la PC para continuar esa lectura; no se extrajeron tokens ni se hicieron escrituras financieras.
