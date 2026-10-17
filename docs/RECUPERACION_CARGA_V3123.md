# Recuperación de carga · candidata local v3.12.3

Rama `codex/diagnostico-sincronizacion-v3123`, base
`9bb698fec6d1bf2f57fef04ce93b04c370264681`. Producción conserva v3.12.2.

## Defectos reproducidos y corrección

- El observador Auth marcaba recepción antes de terminar perfil/preparación. Ante
  fallo, su catch no entregaba resultado y el fallback quedaba desactivado: espera
  indefinida. Ahora deriva el error recuperable al controlador de carga.
- Fallar la descarga de un módulo opcional acababa llamando a cancelación de Auth,
  convirtiendo un problema de transporte en cierre de sesión compartida. Ahora
  bloquea y limpia la interfaz protegida, conserva Auth y permite revalidar todo
  mediante Reintentar carga. Revocación/usuario deshabilitado/401/403 siguen cerrados.
- SDK de preparación/claims/token podía quedar pendiente antes de los tiempos de
  fetch. Deadline acotado, sin reintentos ni repetición de operaciones; un SDK sin
  cancelación física puede concluir después, pero se descarta su contexto vencido.
- Sincronizar ahora informaba tiempo real sin consultar las APIs ya activas.
  Ahora consulta lecturas autorizadas y comunica errores/resultados reales, con
  control de identidad, sin agregar escuchas ni operaciones de negocio.

## Evidencia

Fixture loopback8774 (`scripts/dev-session-recovery.cjs`), autenticación ficticia,
sin Firebase/red externa. Baseline inmutable v3.12.2: módulo fallido cierra Auth;
perfil fallido queda verificando. Candidata: bloquea datos, conserva sesión y
reintento verifica perfil/rol nuevamente; revocación cierra acceso. Pruebas de
doble clic, respuesta tardía, cambio de cuenta y deadlines de SDK.

Ventana real recargada/autenticada con candidata; Sincronizar ahora en Configuración
confirmó consultas completadas. Sin ventas, cobros, correos ni contraseñas de prueba.
Cinco recorridos de transporte:15 activos estáticos200 y10 consultas anónimas401
esperadas. No es una medición autenticada ni acredita todas las redes/dispositivos.

**No se confirmó qué produce la pérdida de transporte intermitente original.**
Se reprodujo/corrigió el manejo defectuoso que lo convertía en espera o cierre de
sesión; no declarar eliminados todos los fallos de red ni la auditoría terminada.
Conservar el diagnóstico seguro de v3.12.2 y correlacionar si vuelve a ocurrir.
