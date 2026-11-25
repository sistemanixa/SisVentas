# QA aislada de carga común · 25/11/2026

Fuentes WIP externas explícitas: `SV_ACTION_SOURCE_ROOT`; sin variable la prueba es opt-in y se omite. No se modificó el código del coordinador. Chromium headless propio, HTML ficticio mediante setContent, sin datos reales ni ventana del usuario.

Tanda inicial: **5 escenarios PASS, 2 FAIL** (el test padre también falla). SHA256 estables antes/después:

- loading-indicator.js: b6085898569c22239d22b5cd84acb225d79bfe7a93cf50f8abb56f8c9def5a22
- action-feedback.js: a9bcf7408c919921af56b6ce7875a81634ffef905daa128188919ec64ef211fb
- operation-feedback.css: d5ad5e181a6023da61cdf90084758e1922e19df3cec808b1186242099d204bab

Verdes: global inline async/doble clic/nodos dinámicos/geometría de texto en 390/768/1280; listeners async/remove/once/AbortSignal/handleEvent; callback onclick/error/finally; confirmación síncrona/cancelación; cambio de rol/sesión y sustitución del DOM sin contaminar el botón nuevo.

Fallos reproducibles, sin relajar las aserciones:

1. `async eliminar(){await Promise.resolve(); if(!await svConfirm())return;}` deja visible «Eliminando…» mientras la confirmación espera. El puente usa un contexto síncrono que desaparece tras await. La aserción exige cero indicadores de operación durante la pregunta.
2. Botón inline-flex con icono y texto separados por gap12 pierde 12px de ancho (116.046875→104.046875). El wrapper de los hijos elimina la separación flex original. La aserción compara boundingBox exacta antes/durante.

Repetir sin modificar las aserciones después del arreglo; el test registra los hashes de cada ejecución y rechaza modificaciones de fuente durante una misma tanda. Esto prueba el puente genérico con eventos reales de Chromium, no todos los formularios de SisVentas ni los transportes de negocio.

Ejecutar con NODE_PATH apuntando a las dependencias existentes de cotizador y SV_ACTION_SOURCE_ROOT al checkout de fuentes. Archivo: test/action-feedback-native.test.cjs. No instalar dependencias ni ejecutar la suite global para esta tarea.

## Repetición tras corrección del coordinador

Los siete escenarios originales pasaron sin cambiar sus aserciones. Ampliación posterior: **10/10 escenarios PASS, 11/11 TAP incluyendo padre, cero omitidos**. Nuevos casos: input submit muestra actividad y restaura valor/tamaño/width vacío; botón fixed conserva coordenadas y posición y restaura CSSOM vacío; dos acciones paralelas sobreviven a confirmación false y conservan resultados A/B/false, sin confundir false con cancelación completa.

Hashes estables de fuentes corregidas:

- loading-indicator.js: eb113db250bf3decbde8c79980546e7b5a6b4593a351df2695f7142eceb387c6
- action-feedback.js: 6f508e544ddd82e04ccbdaaa684f66a34a6aa4fd941a2480633853866ddaa567
- operation-feedback.css: ffbdfe9eba5e02269bddb418217d34534d08ed38b630eb63ed3754aa7a43253f

En INPUT submit se comprueban texto de actividad/aria-busy y bloqueo, no un spinner gráfico: el elemento no admite hijos y la fuente actual no añade un círculo mediante fondo. Los botones normales sí usan el spinner compartido. No se modificó ninguna aserción original para obtener verde; las fuentes externas se mantuvieron idénticas durante ambas tandas.
