# Inicio de sesión: primera mejora de rendimiento

Versión preparada: v3.9.26. Fecha: 09/10/2026.
Rama local: `codex/login-performance-v3926`. Sin publicación ni modificación del nodo de versión en Firebase.

## Cambio

La preparación de rutas devuelve los snapshots de identidad y usuarios al resolutor de acceso. La restauración de una sesión interna deja de invocar seis lecturas en esa cadena y utiliza dos. El login manual pasa de cuatro a dos; si el observador Auth coincide durante la preparación, comparte esa operación pendiente. Esto reduce llamadas, no demuestra todavía una reducción concreta de segundos o bytes en producción: Firebase puede reutilizar datos en memoria.

No se conserva una caché de autorizaciones entre ingresos: cada preparación nueva consulta nuevamente. Salir o cambiar de identidad invalida el trabajo anterior. El observador descarta respuestas de eventos Auth anteriores. El login manual tampoco dispara simultáneamente la restauración automática.

Se mantienen la verificación de UID único, coincidencia de rol, identidad activa y ficha habilitada. Los portales exteriores continúan consultando su ficha por UID. Cuando la copia protegida de usuarios ya existe, se evita el listener redundante que sólo comprobaba existencia; la sincronización normal sigue en `fbCargarUsuarios`. Si la copia aún no existe, se conserva el observador de migración.

Los archivos inmutables anteriores se conservaron. La entrada, los marcadores, el Service Worker y Novedades apuntan a v3.9.26. Las referencias de Firebase y almacenamiento protegido llevan la nueva versión en ambos manifiestos.

## Validación

- Batería vigente: 357 archivos de pruebas aprobados; cero fallos, usando los filtros de `scripts/test-current.ps1` sin navegador.
- Pruebas nuevas del flujo real aislado: número de lecturas al restaurar, preparación concurrente, revocación al reingresar, UID duplicado, ficha inactiva, rol inconsistente, ficha ausente, consulta exterior por UID, cancelación durante lectura, invalidación de generación, reintento después de error de red y logout mientras Auth espera.
- Sintaxis de JavaScript y `git diff --check` correctos.
- Consistencia de versión verificada por `test/version-consistency.test.js`. No se ejecutó el script PowerShell de validación/publicación; no se creó un commit de release ni se publicó.

No se midieron tiempos reales con celular, Auth ni RTDB. No cambió todavía el tamaño de la carga inicial: separar el login del monolito es el siguiente bloque de la auditoría. Tampoco se recortó el historial comercial ni se modificaron las reglas de seguridad.
