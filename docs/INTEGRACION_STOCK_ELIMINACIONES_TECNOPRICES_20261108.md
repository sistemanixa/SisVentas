# Integración sobre Stock publicado · 08/11/2026

Base de trabajo857782ac, interfazStock4620bed23b631822818cb49d9d7dcb120f779c18. El delta revisado074bb5ac de Eliminaciones/Tecnoprices se integró sin conflictos y conservando Stock. No se desplegó el árbol de auditoría.

Estado local comprobado:

- Eliminaciones: primera matriz740casos,738PASS/2opt-in. Composición offline con las reglas retenidas de Stock SHA57934e54…:60PASS. Emulador propio sobre esa misma baseline:94PASS/0FAIL/0SKIP, incluyendo tres comandos, recuperación, veto de revocaciones posteriores y controles del retorno a presupuesto. Namespace demo limpiado hasta null literal y proceso propio detenido. No permisos ampliados ni datos remotos.
- Tecnoprices:56PASS con cookies y HTTP loopback. Overlay mínimo adicional fija exactamente la imagenStockce214d16… y el entrypoint1f9f7b82…; seis pruebas de composición/transportePASS, reversión exacta y conservación de las rutasStock/Presentación. Esto no acredita contenedor construido ni credenciales/login del proveedor real.
- Stock: selector y existencias positivas según STOCK_LISTADO_DISPONIBLE_LOCAL.md. No cambios del servidor por esta interfaz.
- Primera puerta integrada:10554casos,10483PASS/2FAIL/69SKIP. Dos fallos intermitentes se reprodujeron como sincronización no determinista del fixture: Dashboard dependía de200ms para observar frío y OT de100vueltas de setImmediate mientras corría hash asíncrono. Ambos pasaron19/19 en aislamiento sin cambiar funcionales. Se sustituyeron las esperas por barrera explícita de primera respuesta y evento real de recuperación desconocida, manteniendo aserciones de permisos, saldos y un solo commit; nueva focal19/19PASS. La puerta anterior NO se declara verde retroactivamente.

Pendiente de cierre: puerta sobre la fuente congelada posterior; prueba del artefacto/imágenes exactos; contraste del estado remoto actual, cobertura y exclusión de escritores del corte completo antes de activación. El titular pidió publicar sólo al terminar el conjunto: no publicación parcialStock. Los originales de negocio no se usan como prueba ni se reescriben para conciliar proyecciones. Conservación de comisiones, pagos, cantidades y reservas obligatoria.

Las pruebas actuales no sustituyen el procedimiento CORTE_INTEGRACION_COMERCIAL.md. No se emite una activación real con las claves ficticias de los fixtures. No se usó otro build ni se cambiaron reglas, banderas, tráfico o IAM. Evidencia privada y capturas quedan en tmp/eliminaciones-tecnoprices-20261108, fuera deGit.

## Evidencia posterior sobre fuente congelada

Fuente exacta: `10aecd47a71954ccffb455c956c011bc90e62325`. Puerta vigente: 10.556 casos, 10.489 aprobados, cero fallos y 67 omitidos. Cotizador: 150 aprobados. Los omitidos no se cuentan como aprobados; las matrices aisladas de reglas y navegador conservan su alcance propio.

Con autorización humana específica se ejecutó un único build adicional, `f6423019-7755-442e-9d52-bdca18a50143`, región southamerica-east1. Estado SUCCESS: construcción y verificación aislada del contenedor aprobadas. Inicio 20:43:40.217893116 UTC y fin 20:44:48.425341 UTC del 08/11/2026. No se activó tráfico ni se publicó la web por este build.

Imagen del registro existente: `cotizador:audit-validation-10aecd47`, digest `sha256:e1f5880e03170ec40325806bc3d6a6d764dea41338cc3b8bf833f4b04433c3d5`. Manifiesto de runtime: `116f19d340b1b3fc75eb4fb586ff43b09ef9c530dbfaf54d2b1929269cdb7ce2`. Usar esta imagen sin reconstruir. La autorización no comprende otra compilación fiscal ni equivale a activación productiva.

La nueva infraestructura local de preparación/corte pasó en ejecución conjunta 105 pruebas: captura e instalación técnica, recuperación ante respuesta perdida, CAS, orquestación, firma y transporte acotado. Sigue pendiente integrar observadores operacionales fiables y ensayar el corte completo contra un emulador propio. Los adaptadores inyectados y una imagen construida no acreditan por sí solos exclusión de escritores, drenaje fiscal ni publicación.

Frontend preparado v3.19.20: validación funcional Accounts/History y Service Worker en 390/1280 aprobada con datos ficticios. El índice fuente v3.19.19 conserva las banderas desactivadas deliberadamente; sólo el artefacto generado contiene la activación conjunta. Falta materializar y revisar su checkout público exacto, además del corte remoto coordinado. No afirmar mejora publicada de Cuenta corriente ni comparación real antes/después todavía.
