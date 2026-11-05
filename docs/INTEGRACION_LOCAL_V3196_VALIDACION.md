# Integración compatible OFF v3.19.6 · validación pendiente

Integra el fallback de Cobranzas, su QA HTML completo y la entrega completa de materiales OT compatible con el servidor actualmente desplegado. Accounts e Historial permanecen OFF. No activa el contrato futuro de entrega parcial.

La primera prueba conjunta de Cobranzas sobre 9a84f3d5 dio 36 PASS / 4 FAIL. Los cuatro fallos buscaban el alias histórico del cliente aunque el fixture asigna un nombre vigente único. Se conservó el rojo; el ajuste exige ahora ese nombre vigente y filas de cobros históricos de 2020. Repetición completa sobre 4dc289d8: 8 PASS / 0 FAIL / 0 SKIP, escritorio y móvil, importes y deuda histórica comprobados, sin escrituras comerciales.

El 05/11/2026 a las 05:40:19 UTC se consultaron únicamente las reglas actuales mediante GET. Coinciden byte por byte con el snapshot usado por el emulador de OT: SHA256 dee40945c7224f449a1f460193c268796341bd97e3c82c8e00ea236385be1fb7. No se aplicaron reglas ni se leyeron registros comerciales. Esa coincidencia no sustituye comprobar la configuración de los adaptadores ni la pantalla independiente.

QA independiente OT sobre 4dc289d8: 2 PASS en 1280/390, confirmación/cancelación/rechazo/reintento/remito/retorno con transporte ficticio. Requiere repetición sobre fuente final. GET de configuración y cobertura técnica actual confirmó schema 1/ready y metadatos válidos, sin registros comerciales.

Puerta conjunta de 0916b8ff: 9.626 casos, 9.581 PASS, 14 FAIL, 31 SKIP. Log privado SHA256 c9496e8cc8b170872c4c3063d5b01b027299fe3787f0fa34e6e3d42b1d2a821d. Los 3.032 inputs RAW antes/después coincidieron (71b4dcd8037874ad972051fbcd872eee1790ac51c78829b6ad3f2729a840027e). Los 14 fallos son fixtures que exigían el transporte futuro: once en ot-delivery-remito y tres en ot-entrega-adicionales. Se conservaron los rojos y se sustituyó sólo el fixture por modelo/escritor/guarded reales; las assertions de negocio se conservaron. Repetición integrada: 26 PASS/0 FAIL. Los contratos futuros permanecen intactos. Esto no convierte retrospectivamente el gate rojo en verde.

Pendientes antes de publicar: nueva fuente exacta y materialización RAW, puerta conjunta y opt-in, repetición QA final y upgrade SW desde los activos públicos verificados de v3.18.20, manifiesto y comprobación final de compatibilidad. La validación de v3.19.5 no se atribuye a esta nueva fuente.

Producción, servidor, flags, datos reales y ventana del usuario intactos. Sin push. Respaldo y rollback de Hosting e34c489e90a0fbf7 conservados fuera de Git. La publicación sigue detenida hasta completar las verificaciones.
