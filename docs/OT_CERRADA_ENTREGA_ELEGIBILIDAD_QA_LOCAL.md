# OT cerrada: elegibilidad de entrega nueva

04/11/2026. Continuación local sobre `d2d59d62`, checkout `integracion-v3190-verificada`. Sin modificación de servidor ni capacidades.

El servidor rechaza entregar un original nuevo en OT cerrada. Activar la corrección administrativa de rendición no autoriza esa entrega. La UI permitía mostrar y seleccionar ese original después de activar corrección, lo que terminaba en un rechazo del servidor. La prueba nativa nueva reprodujo el desajuste en 390 y 1280 px: 0 PASS / 2 FAIL, conservado.

Se alineó exclusivamente la elegibilidad de entrega: botón general, botón por ítem, selección y llamada directa reservan las nuevas entregas de OT cerradas a filas canónicas `adicionalOT: true`. La etiqueta histórica `origen: adicional_ot` sola no amplía la autorización que exige el backend. El mensaje de activación ahora menciona corrección de rendición. La corrección de un original ya entregado sigue habilitada; no se amplió el circuito de entrega.

`test/ot-closed-delivery-eligibility-native.integration.cjs` usa el renderer y las acciones públicas reales en el host ficticio existente. Activa corrección, comprueba que el original conserva «Marcar instalado» y no ofrece «Entregar», que una llamada directa no prepara ni guarda, y que solo el adicional canónico entra al selector. Cancela el selector: no envía entregas. No valida reglas remotas ni constituye aceptación de una nueva entrega original cerrada. Ese circuito permanece pendiente de diseño y autorización explícitos.

Validación final: **96/96 focales**, **8/8 navegador/cadena**, sin omisiones. Incluye las dos variantes nuevas, las tres cadenas completas y las tres acciones públicas del coordinador. Pruebas anteriores y expectativas intactas; sintaxis y diff correctos. No se ejecutó la suite general ni se publicó.

| Archivo o evidencia privada | SHA256 |
| --- | --- |
| Custodia final | `b08f593db09b53a8da448a0d2d009e18f9ca0a9311cd0005ea9ed75c2a3035d4` |
| Prueba nueva | `7dbcd7b0c596df7285c80dc1d51e75831dcfde22e15311c08fb75d0ecdf36aa5` |
| `C:/SisVentas/tmp/ot-closed-delivery-eligibility-before.private.log` | `5a66244b52d115bfc0135fc5bd1762a5eb59235791a78384a836536ee1dc9879` |
| `C:/SisVentas/tmp/ot-closed-delivery-focal-final.private.log` | `aedf8e5b8d67317354f52a89857d1076e9ec38c52119e93b7ede2315b0467c59` |
| `C:/SisVentas/tmp/ot-closed-delivery-native-chain-final.private.log` | `5a6eb16f627ae3bc8809b1e9c2932e8d8547ed05552d07201d8683d57bfaa1f6` |

La repetición independiente queda pendiente. Este commit contiene únicamente custodia, prueba nueva y este documento.
