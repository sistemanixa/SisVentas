# Integración sobre Stock publicado · 08/11/2026

Base de trabajo857782ac, interfazStock4620bed23b631822818cb49d9d7dcb120f779c18. El delta revisado074bb5ac de Eliminaciones/Tecnoprices se integró sin conflictos y conservando Stock. No se desplegó el árbol de auditoría.

Estado local comprobado:

- Eliminaciones: primera matriz740casos,738PASS/2opt-in. Composición offline con las reglas retenidas de Stock SHA57934e54…:60PASS. Emulador propio sobre esa misma baseline:94PASS/0FAIL/0SKIP, incluyendo tres comandos, recuperación, veto de revocaciones posteriores y controles del retorno a presupuesto. Namespace demo limpiado hasta null literal y proceso propio detenido. No permisos ampliados ni datos remotos.
- Tecnoprices:56PASS con cookies y HTTP loopback. Overlay mínimo adicional fija exactamente la imagenStockce214d16… y el entrypoint1f9f7b82…; seis pruebas de composición/transportePASS, reversión exacta y conservación de las rutasStock/Presentación. Esto no acredita contenedor construido ni credenciales/login del proveedor real.
- Stock: selector y existencias positivas según STOCK_LISTADO_DISPONIBLE_LOCAL.md. No cambios del servidor por esta interfaz.
- Primera puerta integrada:10554casos,10483PASS/2FAIL/69SKIP. Dos fallos intermitentes se reprodujeron como sincronización no determinista del fixture: Dashboard dependía de200ms para observar frío y OT de100vueltas de setImmediate mientras corría hash asíncrono. Ambos pasaron19/19 en aislamiento sin cambiar funcionales. Se sustituyeron las esperas por barrera explícita de primera respuesta y evento real de recuperación desconocida, manteniendo aserciones de permisos, saldos y un solo commit; nueva focal19/19PASS. La puerta anterior NO se declara verde retroactivamente.

Pendiente de cierre: puerta sobre la fuente congelada posterior; prueba del artefacto/imágenes exactos; contraste del estado remoto actual, cobertura y exclusión de escritores del corte completo antes de activación. El titular pidió publicar sólo al terminar el conjunto: no publicación parcialStock. Los originales de negocio no se usan como prueba ni se reescriben para conciliar proyecciones. Conservación de comisiones, pagos, cantidades y reservas obligatoria.

Las pruebas actuales no sustituyen el procedimiento CORTE_INTEGRACION_COMERCIAL.md. No se emite una activación real con las claves ficticias de los fixtures. No se usó otro build ni se cambiaron reglas, banderas, tráfico o IAM. Evidencia privada y capturas quedan en tmp/eliminaciones-tecnoprices-20261108, fuera deGit.
