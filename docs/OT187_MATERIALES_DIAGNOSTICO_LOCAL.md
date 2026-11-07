# OT-187: entrega, rendición y acciones en móvil

Diagnóstico del 7 de noviembre de 2026. Fuente publicada analizada:
`72db94334701bad67525445a08ec94ba0476cd7f` / v3.19.17. Este informe no cambia
código, datos, permisos ni despliegues. El arreglo previo del vínculo OT/venta y
el defecto del selector de técnicos son asuntos distintos de este incidente.

## Identificación y lectura acotada

Los dos archivos Library citados no pudieron abrirse desde este chat. El
coordinador inspeccionó las capturas e identificó OT-187; no se asumió que fuera
OT-179. Sus textos descritos indicaban entrega sin registrar, «No entregado»,
«Pendiente de entrega» y «No hay materiales pendientes de entregar».
Las imágenes parciales no acreditan ausencia del botón en toda la pantalla.

Se buscó OT-187 en la ventana web existente, sin pulsar entrega, instalación,
guardado o cierre. Se hicieron dos GET puntuales: original y resumen de esa OT.
La proyección privada conserva sólo los campos necesarios para este diagnóstico,
fuera de Git, sin guardar firmas ni el original completo.

El estado actual **ya difiere** de lo descrito en las capturas: tiene entrega
iniciada, rendición pendiente, un remito RE-OT-187-1 y revisión6 coincidente en
original y resumen. Las filas físicas actuales tienen cantidad entregada y
custodia activa; instalación sigue en cero. El botón «Todo instalado» estaba
visible en escritorio al abrir Materiales. Esta entrega existía antes de abrir
el detalle durante la inspección; no fue registrada por este trabajo.

No hay instantánea persistida del estado anterior de las capturas ni se conoce
la versión exacta del cliente móvil de ese momento. No se concluye que el estado
viejo se debiera a caché, ni que el botón haya funcionado en aquel teléfono.
La OT quedó abierta en Materiales sin ejecutar operaciones.

## Reproducciones ficticias

Chrome headless, con markup real de la tarjeta de Materiales, stylesheet y
módulos publicados; cuatro estados, a390 y1280px. Sólo servidor propio de
loopback, recursos externos bloqueados y funciones de escritura/fetch comercial
prohibidas. Ocho comprobaciones aprobadas; fuentes ficticias idénticas después.
El alcance es **el componente**, no la totalidad del wizard ni el teléfono real.

| Estado ficticio, con permiso administrativo habilitado | Entregar | Todo instalado | Resultado |
|---|---|---|---|
| Cantidad pendiente, entrega aún cero | Visible | Oculto | La instalación exige registrar la entrega |
| Cantidad entregada igual a vendida, custodia inactiva y sin bandera global | Oculto | Oculto | Fila «No entregado» y aviso «No hay materiales pendientes de entregar» |
| Entrega y custodia confirmadas, falta instalación | Oculto | Visible | Misma condición en390 y1280px; sin desborde del documento |
| Fila histórica sólo en items, sin materiales persistidos | Oculto | Oculto | La fila se muestra, pero entrega informa que no tiene pendientes |

Esto prueba dos formas de producir la contradicción, **no cuál fue el estado
histórico concreto de OT-187**. La primera combinación se reproduce aunque no
se haya configurado ningún fallo de permisos. La segunda descubre diferencias
entre las fuentes usadas por la vista y por el comando de entrega.

### Condiciones concretas del código

- `pendingDelivery()` usa únicamente `ot.materiales` y compara cantidad vendida
  contra `entregada`; no comprueba `custodiaActiva` ni usa la vista histórica.
- Las filas y sus acciones se dibujan mediante `materialRows()`; ésta puede
  recuperar filas de `items`. El estado «No entregado» depende de
  `custodiaActiva`, no de aquella comparación de cantidades.
- «Todo instalado» exige OT editable, permiso `ot.rendirMateriales`, entrega
  iniciada o evidencia de entrega/consumo verificada y rendición aún necesaria.
  Ser admin no elimina esas precondiciones. No tiene una regla específica que
  lo oculte por ancho de pantalla en las fuentes analizadas.
- La ejecución de `allInstalled()` también exige la bandera global
  `custodiaIniciada`. No corresponde mostrar o forzar esa acción para resolver
  datos contradictorios sin determinar previamente qué entrega está acreditada.

Referencias: `js/modules/ot-material-custody.js`, funciones `pendingDelivery`,
`stateBadge`, `itemAction`, `render`, `deliver` y `allInstalled`;
`js/modules/ot-material-rows.v1.js`, función `view`; tarjeta en `index.html`.

## Otro defecto confirmado: «Lista para finalizar»

`otEstadoParaMostrar()` devuelve `lista_finalizar` con `progreso>=100` sin
comprobar entrega ni rendición. Una VM con el bloque real, progreso100 y ambas
banderas false devolvió ese estado. La OT inspeccionada mostraba esa etiqueta
aunque su rendición actual seguía pendiente. No es evidencia de que el cierre
esté autorizado ni de que deba saltarse el control de materiales.

## Observación de asignación, sin alterar roles

La proyección puntual actual conserva el texto «Sin asignar» y no una clave de
técnico. El guard inicial del comando UI de entrega sólo comprueba que el texto
no esté vacío. Esto requiere revisión de coherencia con la asignación real;
no se probó registrar una entrega a ese valor ni se modificó un responsable.
Tampoco se extrapola a un bypass de reglas de servidor a partir de ese guard UI.

## Límites y siguiente corrección propuesta

Quedan abiertos la contradicción de criterios vista/entrega y el estado listo
basado sólo en progreso. Debe usarse un estado canónico de materiales que
distinga pendiente real, entrega confirmada y registro inconsistente o histórico
sin confirmar, compartido por mensajes, botones y preparación del comando.
Un registro inconsistente debe ofrecer revisión explícita; nunca convertir
automáticamente cantidades en entrega o instalación ni emitir otro remito.

Las validaciones deben cubrir originales e items históricos, cantidades
parciales, remitos existentes, revocación/cambio de sesión y llegadas tardías de
datos. La revisión móvil completa debe recorrer el wizard, no sólo esta tarjeta.
No se implementa ni publica esa corrección en este bloque de diagnóstico.

No falta el identificador de la OT. Si la ausencia sigue ocurriendo en el
teléfono con el estado actual, el dato mínimo pendiente es la versión del
cliente y una captura actual completa de Materiales después de volver a abrir
OT-187, para ubicar el botón y distinguir estado anterior de un problema de UI.
El relato de obra terminada o dos cámaras no autoriza inferir la cantidad
instalada de cada otro material ni ejecutar «Todo instalado» como prueba.

Evidencia privada en `C:/SisVentas/tmp/ot187-diagnostic-20261107/`: proyección
puntual, ocho screenshots ficticios, log y resultado de componente, y
reproducción del estado listo. SHA256 del resultado de componente:
`7589851b541eba0b27679615d00e14d6967151eee5df467cb3491217364e6a2a`.
Los artefactos privados no se agregan a Git. No se repite la publicación17 ni
se atribuyen estas reproducciones a la puerta anterior de9.910PASS/46SKIP.
