# Integración compatible OFF v3.19.6 · validación pendiente

Integra el fallback de Cobranzas, su QA HTML completo y la entrega completa de materiales OT compatible con el servidor actualmente desplegado. Accounts e Historial permanecen OFF. No activa el contrato futuro de entrega parcial.

La primera prueba conjunta de Cobranzas sobre 9a84f3d5 dio 36 PASS / 4 FAIL. Los cuatro fallos buscaban el alias histórico del cliente aunque el fixture asigna un nombre vigente único. Se conservó el rojo; el ajuste exige ahora ese nombre vigente y filas de cobros históricos de 2020. Repetición completa sobre 4dc289d8: 8 PASS / 0 FAIL / 0 SKIP, escritorio y móvil, importes y deuda histórica comprobados, sin escrituras comerciales.

El 05/11/2026 a las 05:40:19 UTC se consultaron únicamente las reglas actuales mediante GET. Coinciden byte por byte con el snapshot usado por el emulador de OT: SHA256 dee40945c7224f449a1f460193c268796341bd97e3c82c8e00ea236385be1fb7. No se aplicaron reglas ni se leyeron registros comerciales. Esa coincidencia no sustituye comprobar la configuración de los adaptadores ni la pantalla independiente.

Pendientes antes de publicar: QA independiente OT, configuración técnica compatible, revisión de expectativas del contrato parcial futuro, nueva fuente exacta y materialización RAW, puerta conjunta y opt-in, upgrade SW desde los activos públicos verificados de v3.18.20, manifiesto y comprobación final de compatibilidad. La validación de v3.19.5 no se atribuye a esta nueva fuente.

Producción, servidor, flags, datos reales y ventana del usuario intactos. Sin push. Respaldo y rollback de Hosting e34c489e90a0fbf7 conservados fuera de Git. La publicación sigue detenida hasta completar las verificaciones.
