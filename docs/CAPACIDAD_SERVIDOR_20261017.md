# Capacidad del servidor · 17/10/2026

## Causa y alcance

Cloud Run rechazaba consultas con HTTP429 por falta de una instancia disponible.
En una muestra anterior de diez minutos hubo 13 rechazos: seis de Ventas, seis
de Presupuestos y uno de cotización por lote. Las cotizaciones observadas
duraban hasta 32,6 segundos. El usuario indicó que coincidía con el actualizador.
La competencia entre trabajos largos y lecturas es coherente con esos datos;
no se dispone de una correlación por instancia de cada solicitud rechazada.

La revisión activa tenía máximo **4 instancias**, concurrencia **1** y memoria
**2 GiB / 1 CPU**. El máximo20 del servicio no eliminaba el límite4 de la revisión.
Se elevó exclusivamente el máximo de la revisión a **12**. Se mantuvo la
concurrencia1 para conservar el aislamiento de las consultas pesadas a proveedores.
El máximo superior permite más costo durante actividad alta; no se aumentó el mínimo.

## Prueba previa al corte

- Candidata `cotizador-capacidad-20261017`, inicialmente0% de tráfico, etiqueta
  temporal `capacidad-test`. Región `southamerica-east1`, proyecto `nixa-sisventas`.
- Misma imagen que `cotizador-pdf-0532bb93`:
  `sha256:d169bde2dcf600db7b44df8c30012e5fc9cdbd36b7cd0cdda814b02631b57d58`.
  Comparación completa del spec normalizando la imagen por digest: idéntica,
  incluidos entorno, referencias a secretos, cuenta de servicio, recursos,
  timeout300s, probes y concurrencia. CPU sin throttling conservada.
- **1.862 pruebas vigentes** y **12 específicas** aprobadas. La integración
  `test/commercial-capacity.integration.cjs` ejecuta el código real de lotes con
  proveedor/base ficticios: cuatro lotes detenidos esperando respuesta,24 lecturas
  comerciales que completan antes de liberarlos, aislamiento de cuentas,
  rechazo al técnico sin permiso y base idéntica al terminar. También se verifican
  transporte/ETag/Brotli/CORS y orden/progreso del actualizador.
- Navegador local con sesión existente: Ventas y Presupuestos cargaron desde la
  candidata. Dos rondas de12 GET simultáneos (seis por dominio):24/24 correctos,
  sin escrituras. Rutas comerciales, perfil, Proyectos y finanzas privadas
  rechazaron anónimos con401. Sin contraseñas nuevas ni correos.

## Aplicación y comprobación

- Autorización: el titular pidió corregir capacidad, probar antes y aplicar si
  funciona. Se releyó el servicio antes del corte: seguía100% en la revisión
  anterior y conservaba las14 etiquetas esperadas.
- Desde aproximadamente **14:34 UTC**,100% en `cotizador-capacidad-20261017`.
  Las14 etiquetas existentes apuntan a la misma revisión nueva. Etiqueta temporal
  retirada. No se publicaron frontend, reglas, Asistente ni cambios del PDF.
  Cliente/Hosting/aviso siguen **v3.12.5**.
- Destino normal repetido desde navegador con la misma sesión:24/24 GET correctos;
  Ventas y Presupuestos visibles, estado Sincronizado, consola sin errores observados.
  En la muestra posterior al corte consultada a14:35:32 UTC:55 respuestas
  (35 HTTP200 y20 HTTP304),23 lecturas por dominio comercial y **cero429/5xx**.
- No se iniciaron actualizaciones reales de precios, guardados financieros ni
  operaciones comerciales de prueba. La prueba de lotes lentos fue ficticia/local;
  la de capacidad remota fue una ráfaga de lecturas autenticadas reales. No
  afirmar una prueba remota prolongada del actualizador con proveedores reales.
  La pestaña web y los PDF pendientes no se recargaron ni manipularon.

## Reversión y seguimiento

La revisión anterior `cotizador-pdf-0532bb93` sigue disponible: volver el100% y
las14 etiquetas a ella restaura el límite4 sin restaurar bases. Las copias exactas
de servicio/revisión, evidencia de consultas y capturas permanecen privadas en
`C:/SisVentas/tmp/capacidad-servidor/`; no subirlas a Git ni Hosting.

Para repetir pruebas HTTP locales en Windows usar ejecución con acceso loopback;
el sandbox puede producir EACCES, que no es fallo del servidor probado:

```powershell
node --test test/commercial-capacity.integration.cjs test/commercial-transport.integration.cjs cotizador/test/lote-automatico.test.js
```

Seguir observando429, latencia, instancias y costo durante uso normal del
actualizador. Si crece la carga, separar trabajos largos de la API interactiva;
el nuevo máximo es capacidad adicional, no una garantía ilimitada. No ocultar
errores ni ampliar permisos para resolver saturación. Referencia de infraestructura:
[Cloud Run: instancias no disponibles](https://docs.cloud.google.com/run/docs/troubleshooting#abort-request).
