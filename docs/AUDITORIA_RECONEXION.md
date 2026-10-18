# Auditoría de corte y retorno de conexión

18/10/2026. Base publicada v3.12.11, commit de entrega
`737943f63409a4f11095e431a7358fd46633b093`. Rama de trabajo
`codex/auditoria-reconexion`, candidata local v3.12.12, sin publicar.

## Hallazgo y corrección

Firebase RTDB recupera su transporte, pero las lecturas HTTP de Ventas,
Presupuestos y Usuarios no escuchaban el regreso de internet. Dependían del
siguiente intervalo visible (15/30segundos) o de volver a primer plano.
Además iniciaban consultas aunque el navegador ya declarase estar offline.

La candidata escucha `online`, consulta sólo suscripciones existentes de la
sesión vigente y evita nuevas consultas mientras `navigator.onLine` es falso.
Si la pestaña está oculta, conserva la recuperación al volver a primer plano.
Se mantienen los intervalos de respaldo, plazos de peticiones, validadores
HTTP, agrupación de consultas pendientes y controles de identidad/rol.
No hay reautenticación inventada, fallback global ni borrado de almacenamiento.

Un corte transitorio conserva la información recibida. Una denegación real
401/403 sigue cerrando el acceso y limpiando la colección correspondiente.
No confundir conservar datos durante una falla de red con mantener acceso
después de una revocación.

## Evidencia y cobertura

- Siete casos funcionales nuevos cargan los módulos reales y el seguimiento
  real de carga: inicio offline, retorno inmediato, conservación/recuperación
  tras error, eventos repetidos con peticiones pendientes, cierre de sesión
  durante el corte, retorno oculto/visible y varios ciclos con revocación.
  Cinco fallaban antes del ajuste; los siete pasan después.
- Suite vigente:1.919 pruebas aprobadas; sintaxis, diff y versión local
  coherentes. Las pruebas previas siguen cubriendo 304, respuestas tardías,
  cambio de identidad/rol y la limpieza de errores sin repintados idénticos.
- Navegador con SDK Firebase10.12.0 y política publicada: tres cortes mediante
  `goOffline` y retornos mediante `goOnline`, con confirmación real de
  `.info/connected` después de cada uno. Comenzó por long polling y mejoró a
  WebSocket. Sesión anónima y origen aislado, sin Auth de usuarios: sólo estado
  y referencia inexistente `__sisventas_transport_probe__`, sin colecciones
  de negocio ni escrituras.
- Navegador HTTP aislado con los módulos reales de lectura: tres cortes y
  retornos, luego503 y recuperación. Ventas y Presupuestos conservan revisión4
  durante el error y reciben revisión5 al recuperar. El contador de recuperación
  espera respuestas nuevas de los tres dominios; no marca éxito por conservar
  un estado anterior. Después de cerrar la sesión ficticia durante el corte,
  el retorno conserva20 lecturas acumuladas, sin iniciar otras.
- Integración de aislamiento aprobada: solo rutas expresas, tokens ficticios,
  GET de lectura; otros métodos405, privados404, servicio sin Auth401,
  corte de socket y503 simulados en RAM. CSP de la fixture limita las conexiones
  al propio origen. No carga SDK Firebase ni credenciales reales.
- Capturas y registros en `C:/SisVentas/tmp/reconexion-*`, fuera de Git y Hosting.

## Repetir

```powershell
node --test test/reconnection-cycle.test.cjs test/commercial-ownership-session.test.cjs test/user-directory.test.cjs
node --test test/reconnection-audit-isolation.integration.cjs
node scripts/dev-reconnection-audit.cjs
```

La última orden abre la fixture HTTP sólo en loopback8796. No servir el
repositorio completo para esta prueba. La prueba de transporte Firebase es
`scripts/dev-realtime-transport.cjs` con `/?reconnect=1`; configuración del SDK
temporal y puerto en [DIAGNOSTICO_CARGA_PERSISTENTE.md](DIAGNOSTICO_CARGA_PERSISTENTE.md).
Pulsar Finalizar prueba antes de abandonar esa comprobación.

## Límites y próximo paso

No se desconectó el adaptador de red de la PC ni un celular físico: se
interrumpió el transporte SDK y se simularon offline/fallos de lecturas HTTP
en orígenes aislados. Tampoco se probaron escrituras offline ni colas de
operaciones reales. Una petición que sigue pendiente conserva sus plazos
previos20/60s; un evento online no crea solicitudes concurrentes para saltearla.

La candidata no está desplegada y no se modificaron servidor, reglas, DNS,
contraseñas ni datos financieros. Antes de publicar, revisar la candidata local;
después del despliegue autorizado, repetir en un dispositivo físico un corte
de Wi-Fi/datos y volver, con sesión y borradores conservados, sin operaciones.
