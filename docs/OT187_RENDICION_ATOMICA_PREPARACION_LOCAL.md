# OT187: comando de rendición atómica, sólo local

## Estado y autorización

Preparación local autorizada por el titular a través de coordinación. No
publicar, cambiar servidor/reglas/flags, corregir inventario real ni reintentar
entrega/rendición/instalación/cierre de OT187. La autorización de frontend18
conservaba expresamente servidor y reglas; no cubre este nuevo corte.

Web acreditada:18, Hosting `7c8ee763638d3dfa`; Cotizador
`cotizador-ccot31917-dd416173`. Las lecturas acotadas del incidente y sus límites
siguen en OT187_RENDICION_STOCK_Y_UNIDADES_LOCAL.md. No se atribuye al intento
real el consumo parcial reproducido con datos ficticios. Falta inventario
operativo no equivale a conocer stock físico; no se crea desde el remito.

## Contrato preparado

- GET `/ot/rendicion/disponible?otKey=...`: Auth fresca, rol, acción y asignación
  vigentes; requiere configuración OT existente y devuelve protocolo
  `ot-rendition-atomic-v1` sólo si está habilitado.
- POST `/ot/rendicion`: mismo Auth, cuerpo máximo2MiB, kindcustody, identificador
  único, hash esperado de OT y protocolo explícito incluido en el digest.
- Planifica todos los productos en memoria con inventarios reales acotados a
  sus claves; aplica el plan stock existente, no resta cantidades por otra vía.
  Inventario ausente y stock insuficiente tienen códigos/mensajes diferentes.
- El mismo lease y un solo PATCH confirman inventario, recibos por fila, OT,
  resúmenes y recibo de operación. CAS final sobre OT, venta, catálogo,
  asignación/permiso e inventarios; las fuentes económicas no se recalculan.
- Recibo previo compatible de una rendición interrumpida se reconoce sin doble
  consumo. Rechazo posterior, revocación o conflicto dejan cero efecto propio.
  ACK perdido consulta el recibo por operación y conserva el mismo identificador.
- El transporte liga la instantánea de inventarios al plan interno mediante
  capacidad emitida en servidor; claims recibidos o copias del objeto no sirven.
  La validación estricta del ledger comprueba el recibo dentro del PATCH staged.
- Adicional pendiente usa sólo su base guardada verificable; no toma reserva
  original. Corrección cerrada mantiene sus permisos, fecha, firma y auditoría.

## Componentes y despliegue que NO se ejecutó

Frontend: `ot-material-custody.js` y `ot-lifecycle.js`. Para OT vinculada, Todo
instalado, acción individual, excepciones y Completar stock llaman al comando
conjunto sin transacciones SDK separadas. No fallback contra servidor antiguo o
deshabilitado. Antes de publicar deben prepararse nueva versión inmutable,
marcadores, Novedades, URLs y SW; no reutilizar18 para servir bytes distintos.

Servidor: `ot-rendition-stock-plan.js` nuevo; `ot-lifecycle.js`,
`ot-lifecycle-policy.js`, `ot-delivery-commit-protocol.js` e inicialización/rutas
en `index.js`. Flag nuevo único: `OT_ATOMIC_RENDITION_READY=true`; por defecto
false. No flagFirebase ni cambio de roles. Las capacidades existentes y sus
permisos se mantienen; no se concede acceso comercial al técnico.

Con flag activo, el preparecustody antiguo rechaza antes de iniciar consumo
separado de OT vinculada. Se conservan close/return y la conciliación de recibos
antiguos. **Límite:** la ruta manual sin venta vinculada conserva su circuito
anterior; no se declara resuelta su atomicidad universal con esta candidata.

No se propone una regla nueva: matriz de emulador sobre la copia exacta de las
reglas publicadas, sin builder ni ampliaciones, aprobó admin/administrativo/
técnico, fallo de fila posterior, revocación justo antes del PATCH y adicional
de OT cerrada. Esto acredita esa copia; antes de un corte se debe comprobar
que las reglas remotas no hayan cambiado. No escribirlas si siguen iguales.

**No es todavía un paquete remoto desplegable.** El runtime preparado del
repositorio difiere del de la imagen activa en archivos OT/transporte que
incluyen trabajos anteriores. Prohibido desplegar todo `cotizador/` como atajo.
Falta componer un overlay mínimo contra los bytes exactos de la imagen activa,
inventariar dependencias, probarlo como artefacto y fijar SHA/digest/revisión.
Las referencias locales retenidas sirven para detectar diferencias, no para
afirmar que cualquier archivo del repo ya existe en esa imagen.

## Verificación y límites

Caracterización del flujo publicado18 se conserva con su handler fijado por
commit d671090b: falla de fila posterior deja consumo parcial; repetir no lo
duplica. La candidata tiene negativos opuestos con cero efectos conjuntos.

Pruebas de modelo/comando/cliente/transporte y ChromeHTMLcompleto incluyen
éxito390/1280, respuesta perdida/consulta y falta de inventario. Se corrigió la
fixture para construir sus proyecciones desde los originales iniciales, en vez
de añadir una OT fuera de la cobertura del historial. No se desactivó esa
invariante. Variantes adicionales: venta sin estado recibe estado/audit
autoritativos conservando economía; audit concurrente produce conflicto sin
sobrescribir; cobertura ausente/readiness producen rechazo seguro explícito.

Los tests viejos de corrección cerrada ahora usan el planificador servidor real
en la frontera simulada. Tres expectativas que admitían consumo antes de un
PATCH rechazado se fortalecieron de1a0. La caracterización anterior y sus logs
permanecen, no se ocultó el comportamiento antiguo.

Se conservaron rojos de emulador (validación contra ledger anterior al PATCH)
y de navegador (fixture sin configuración, ruta, cobertura e instalación inicial
coherentes). No equivalen a fallos reales ni se descartan; la puerta completa
debe ejecutarse sobre la fuente final congelada antes de un cierre local.

## Corte y rollback futuros, todavía sin autorización

Una vez probado el overlay exacto: respaldar revisión/configuración/tráfico y
Hosting, comprobar estado de intentos admitidos y no repetir los inciertos.
Preparar candidata sin tráfico, conservar recursos/identidad y los15accesos,
verificar controles antes de habilitar el flag y publicar el frontend compatible.
No migrar históricos ni crear inventario para hacer pasar la prueba. La OT187
real seguirá bloqueada por sus fuentes de stock mientras no se concilien por
un circuito administrativo autorizado, separado de este despliegue.

Rollback sólo de código/tráfico/flag y Hosting18; nunca restaurar cantidades o
borrar recibos confirmados. La versión anterior puede recuperar recibos por el
mismo contrato de coordinación; comprobar esa compatibilidad en el artefacto.

La decisión humana futura deberá nombrar overlay/digest y revisión concretos,
flagnuevo, frontendposterior18, accesos conservados y estimación de costo. No
formular ahora un permiso genérico: faltan artefacto exacto y puerta final. No
hay servicios nuevos, reglas o cambios comerciales implícitos en este plan.
