# Publicación v3.19.5: bloqueo técnico comprobado

Resultado al 05/11/2026 05:00:54 UTC: **no se publicó**. Hosting y el aviso
de versión continúan en v3.18.20. No se ejecutó el publicador, un rollback,
un push, una activación de índices ni una escritura de negocio.

La autorización humana de publicar lo probado fue verificada por el hilo
coordinador: mensaje del 05/11 02:37:33 UTC. El mensaje posterior sobre fallos
originó una detención técnica anunciada por el asistente; no se encontró una
revocación humana explícita en los turnos revisados. El impedimento actual
no es una confirmación genérica pendiente: es la incompatibilidad siguiente.

## Paquete y destino comprobados

- Fuente funcional: 76a549ff989abd00f594fb700692448791fe7601.
- Cierre revisado: e8fe4d9faa55f619f7d5fdc39e8147bbaa04d514.
- Manifest RAW: 624 archivos, 20.788.370 bytes, SHA256
  8bb02fa24cb2b27f7bf70a13380fc04f2a08df3c4b6765ebe55e246ffa672294.
- Sitio Hosting: nixa-sisventas-seguro; dominio ventas.sistemanixa.com.
- Versión activa: sites/nixa-sisventas-seguro/versions/e34c489e90a0fbf7.
- Release activo: sites/nixa-sisventas-seguro/releases/1793767942033000.
- Cotizador: cotizador-return910199-bbf61e86 al 100%; las catorce etiquetas
  anteriores siguen apuntando a expenses3186a-bfe0052f. No se actualizó.

Se leyeron metadatos de Hosting/Cloud Run y dos configuraciones técnicas,
sin consultar ventas, pagos u otros registros comerciales. La configuración
de Hosting coincide con la propuesta. Los destinos de servicio del frontend
son los mismos; su comparación textual inicial difería por LF/CRLF, por lo
que ese booleano de correlación no acredita un cambio de API.

La web publicada no corresponde a la base local 05be68ac/v3.19.3: está en
v3.18.20 y no contiene collections-indexed-host.v1.js. Por ello, aceptar
la suite local contra un backend preparado no bastaba para publicar.

## Incompatibilidad que impide la publicación

La configuración técnica vigente de Commercial Pages tiene ready=true,
schema=1, searchReady=true y searchSchema=1. **No contiene**
nativeCollectionsReady ni nativeCollectionsSchema.

El nuevo host de Cobranzas lee esas capacidades y calcula enabled=false.
Sin embargo, su active() se basa en ruta, bootReady y permisos, sin exigir
enabled. Reclama la vista, evita el listado legacy y load() borra las filas
con el mensaje «Los resúmenes de Cobranzas todavía no están preparados».
Los interruptores OFF de Accounts/H7 no desactivan este recorrido.

Se reprodujo usando el host y cargadores reales con registros ficticios,
con las mismas capacidades técnicas ausentes y generación sintética coherente:
active=true, cero filas y el mensaje indicado. No hubo escrituras ni uso de
datos comerciales reales. La comprobación de compatibilidad terminó exit1.
No se modificó el paquete exacto para sortearla.

Las pruebas nativas anteriores de Cobranzas preparaban expresamente sus
capacidades; el recorrido OFF completo comprobó Ventas, Dashboard y retornos.
Esos resultados siguen siendo válidos dentro de su alcance, pero no cubrían
este estado de producción sin el nuevo índice.

## Respaldo y reversión preparados

Se conservaron configuración, release/version inmutables y listado completo
de archivos. Se respaldaron 580 activos públicos (20.619.349 bytes), verificando
cada uno contra el hash gzip de la versión de Hosting. Los dos recursos
reservados __/firebase/init.js e init.json se registraron sin descargarlos ni
ampliar la lista autorizada del publicador. La versión inmutable anterior
conserva la reversión completa.

El plan de rollback crea un release desde la versión e34c489e90a0fbf7 en el
mismo sitio, sin cambiar DNS. No se ejecutó: la publicación activa nunca se
movió. El índice público, release y aviso Firebase fueron comprobados al final
contra el respaldo y siguen iguales. No se tocaron sesiones o ediciones
abiertas; PP-0159 y V-910199 no fueron usados como pruebas.

Los intentos iniciales de respaldo se conservaron: el validador rechazó la
ruta reservada y luego la correlación detectó un módulo ausente del sitio
anterior. Un chequeo final de lectura omitió el encabezado de proyecto de cuota
y recibió 403; al usar el mismo encabezado e identidad del preflight autorizado,
el chequeo pasó. No se cambió IAM ni se eludió una denegación de negocio.

## Siguiente paso técnico, separado de esta publicación exacta

Corregir localmente el selector para conservar el circuito legacy cuando la
capacidad nativa de Cobranzas no está lista. No debe reclamar la vista, detener
los lectores previos ni presentar una página de 50 como historial completo.
Probar arranque y navegación con capacidades ausentes, incompletas y listas,
ambos órdenes de fuentes, permisos/revocaciones y deuda histórica. Mantener
los casos nativos preparados y los cálculos financieros existentes.

Luego congelar una fuente nueva y repetir sus verificaciones de compatibilidad,
suite, upgrade y RAW antes de publicar. **No activar flags, crear derivados ni
migrar Accounts/H7 como arreglo rápido.** No se solicita otra autorización
genérica para publicar: falta resolver este paso técnico.

Evidencia privada conservada en tmp/publish-off3195-20261105-verified:
preflight.private.json (SHA256 1de13b71ca607584820c68afa775648de03e0667a25eb3239908cb824202bcaf),
collections-incompatible.private.json (SHA256 4c21a124fae85e868ced694ca57e64f8926cfe461c2b05dda118412abcf307e0),
blocked-final-status.private.json y captura ficticia. Respaldos, reglas,
credenciales y registros no se incorporan a Git.
