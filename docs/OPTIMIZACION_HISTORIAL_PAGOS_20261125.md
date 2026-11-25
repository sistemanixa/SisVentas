# Historial de pagos: reducir esperas sin modificar cobros

Alcance: sólo lector comercial de pagos publicado18. No cambia frontend, escrituras, reglas ni importes. No requiere una nueva versión web.

La venta autorizada y la cobertura se precargan juntas en la memoria de esta solicitud. Las relecturas independientes de fuentes y buckets se validan en un grupo con máximo seis lecturas simultáneas. Se conserva la autenticación inicial de la ruta y una autenticación fresca después de las relecturas; se elimina la autenticación intermedia idéntica. La venta/propiedad se comprueba de nuevo, y la cobertura se comprueba al final. La misma cobertura no se descarga también en la etapa intermedia. No hay caché entre solicitudes, sondeo ni lectura de toda la colección de pagos.

Comparación aislada con un pago y 20ms simulados por GET, tres corridas por versión: antes 218–222ms y 13 GET de Store; después 154–158ms y 12 GET. Aproximadamente 29% menos espera en este recorrido. No mide autenticación remota, TLS, arranque de Cloud Run ni latencia real del usuario. La autenticación final evita también la repetición intermedia de verificación del token/perfil/permisos. Las lecturas iniciales de la ruta y sus fuentes de autorización no están incluidas en los 12 GET de Store.

Pruebas nuevas: presupuesto de lecturas y concurrencia, una autenticación final por solicitud, cero consultas en reposo, revocación durante la última lectura autorizada y mutaciones finales de venta/cobertura. Se conservan las matrices anteriores de propietario, permisos/revisión, sesión, anulación, duplicados, referencias, importes, documentos y cero escrituras. Las pruebas usan datos ficticios; ningún pago real se registra ni anula para probar.
