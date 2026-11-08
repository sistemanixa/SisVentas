# Eliminaciones y Tecnoprices sobre la base publicada v3.19.16

## Alcance local del 7 de noviembre de 2026

Base: `fdc05b03`, que conserva los funcionales publicados de `3f2ca7b3`.
Rama aislada: `codex/eliminaciones-tecnoprices-local`.

Se integró el delta revisado `5c811a48..b1cf32fe` de Cotizador,
constructores de reglas y pruebas, sin sustituir la aplicación, sus lectores
económicos ni los arreglos publicados de comisión y recibos. La política OT de
esta base carecía de las verificaciones de custodia, cantidades históricas y
documentos incorporadas en el frente separado; se incorporó la versión completa
de esa política, compartida por la eliminación individual y la cascada de venta.

Eliminaciones exige autorización fresca, prueba de activación firmada y una
confirmación atómica. Revocaciones, cambios de vínculos y actividad de OT
rechazan la operación. Los reintentos recuperan el recibo existente. El retorno
autorizado a presupuesto conserva su circuito separado y no queda bloqueado por
tener las eliminaciones desactivadas.

Tecnoprices valida un único formulario del mismo origen y envía el acceso al
destino fijo mediante el contexto HTTP, sin escribir las credenciales en el DOM
ni reenviarlas mediante redirecciones. Verifica la sesión antes de aceptar un
precio. Free Electron conserva su recorrido.

## Evidencia de esta integración

- Cotizador completo: 150 pruebas aprobadas, cero fallos u omisiones.
- Tecnoprices: 56 pruebas aprobadas incluidas en la puerta anterior; formularios,
  mutaciones, sesión, errores y cookies HTTP reales en loopback.
- Reglas en emulador propio: 34 aprobadas, cero fallos. El namespace terminó en
  `null` y el proceso propio quedó detenido. Otras 46 pruebas opt-in no se
  ejecutaron dentro de ese comando: se ejecutaron aparte y aprobaron las 46.
- Contrato del overlay retenido: 12 aprobadas sin omisiones. Acredita los bytes,
  reversión y transporte local del baseline retenido, no una imagen construida
  con la base actual.

Los logs, respaldos y referencias retenidas quedan fuera de Git. La ejecución
inicial restringida tuvo un fallo de `fetch` en loopback; se conserva como
intento fallido, no se atribuye a un registro real ni se cambió su expectativa.
La puerta completa y los recorridos nativos de esta integración se registran en
el cierre posterior, sin trasladar resultados de otra rama.

## Separación respecto de producción

No se modificó Firebase, Hosting, Cotizador remoto, IAM, permisos, datos de
negocio, pagos, comisiones o stock. No se firmó una activación real ni se
habilitaron capacidades por un resultado local. No se usaron credenciales ni una
sesión real de Tecnoprices.

Esta entrega no acredita un contenedor construido: no hay motor local disponible.
El overlay antiguo fija una imagen anterior; no se debe desplegar sobre la
revisión actual sin componer y comprobar el artefacto vigente. Un corte futuro
requiere inventario actualizado de escritores, reglas y proyecciones, además de
la activación del conjunto compatible. El procedimiento general permanece en
`CORTE_INTEGRACION_COMERCIAL.md` y las evidencias históricas mantienen el SHA de
su propia fuente.
