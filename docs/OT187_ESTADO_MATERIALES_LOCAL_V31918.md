# OT-187: corrección local de estados y acciones

## Alcance

Rama `codex/ot187-material-state-local`, desde1136ae6a. Candidata local3.19.18;
la web3.19.17 y la OT real no se modifican. La causa exacta del estado anterior
de las capturas sigue sin acreditarse: este bloque corrige los defectos
reproducidos, no inventa una instantánea histórica ni un movimiento faltante.

La clasificación de Materiales usa la misma vista de filas para pendientes,
acciones y validación de cierre. Cantidades ya entregadas con custodia ausente,
sobrerendición y registros históricos sin confirmar piden revisión. No dicen
«No hay materiales pendientes» ni se convierten por inferencia en entrega o
instalación. No se emite un remito para reconciliar una inconsistencia. Las
cantidades, fuentes originales e items históricos se conservan al consultar.

La revisión administrativa histórica explícita que ya existía conserva sus
validaciones y recorrido individual. La consulta no la ejecuta automáticamente.
Las entregas parciales siguen permitiendo rendir solamente lo entregado; el
resto continúa pendiente. Los cálculos decimales conservan el helper canónico.

«Lista para finalizar» requiere además la validación de materiales. Completar
el checklist ya no anuncia que se puede finalizar con materiales pendientes ni
repite ese aviso al abrir una OT que ya estaba al100%.

La confirmación de Todo instalado se descarta si cambian registro, cantidades,
sesión, rol, revisión de permisos o autorización. No comienza el consumo de
stock para una intención invalidada. Las llegadas de datos actualizan el panel
por el evento existente, sin nuevas consultas ni sondeos. Un evento idéntico no
reconstruye la tabla. El paso del wizard y la edición de otros campos se
conservan; se retiran los replays retardados250/900ms del paso inicial.

## Verificación focal y de pantalla

La reproducción roja inicial dio3PASS/5FAIL en los ocho casos iniciales. Después
del cambio pasan56focales, sin fallos ni omisiones: incluye los nuevos casos y
regresiones de históricos, corrección de OT cerrada y precisión decimal. La
confirmación ficticia de entrega parcial2,75/0,25 instala sólo0,25, no cambia la
cantidad entregada y no declara rendida la cantidad faltante.

Dos recorridos Chrome sobre el HTML completo, a390 y1280px, pasan sin fallos:

- Navegación Cliente/Materiales/Checklist/Trabajo/Finalizar/Historial y retorno.
- Estado inconsistente solicita revisión; no ofrece instalación automática.
- Llegada de una entrega parcial válida muestra Todo instalado en ambos anchos.
- Cancelar no guarda; revocar permiso o cambiar sesión/cantidad durante la
  confirmación aborta antes de enviar comandos.
- Llegada tardía de clasificación del catálogo actualiza las filas y conserva
  el paso; un evento idéntico conserva la identidad del DOM de la tabla.
- Fila histórica sigue pendiente de revisión, sin remito o instalación inferida.
- Una rendición ficticia ya completa permite mostrar Lista para finalizar.

El servidor de la fixture recibe sólo tráfico local, con recursos externos
bloqueados. Esos recorridos de pantalla acreditan cero POST de operación,
comandos o commits, y ventas/pagos/inventario/comisiones ficticios iguales. No
certifican un guardado productivo ni equivalen a todas las operaciones del
wizard. El guardado positivo de cantidades se verifica en las pruebas focales
y sus modelos locales; no se cierra OT-187.

Los intentos nativos iniciales conservaron un fallo de estado aún no visible;
se añadió espera por el mensaje visible y se mantuvieron todas las aserciones.
También se conservan los logs rojos y las capturas ficticias en la carpeta
privada `C:/SisVentas/tmp/ot187-state-local-20261107/`, fuera de Git.

## Estado de este checkpoint

Sintaxis, diff y marcadores18 locales coherentes. Pendiente ejecutar la puerta
completa sobre la fuente congelada y registrar su resultado. No atribuir a esta
candidata la puerta9.910PASS/46SKIP de la publicación17. No publicar por este
seguimiento. La captura/versión actual del teléfono particular sigue siendo
necesaria sólo si se quiere acreditar su comportamiento exacto.

No cambia la política de asignación del técnico, no completa nombres o actas,
no mueve cantidades reales, no cambia permisos, pagos, comisiones o stock, y
no activa otros frentes. El defecto separado del selector de técnicos conserva
su propio pendiente.
