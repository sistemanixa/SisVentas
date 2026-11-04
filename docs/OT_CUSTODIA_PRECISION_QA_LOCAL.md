# Precisión de cantidades en custodia: QA local

04/11/2026. Checkout aislado `integracion-v3190-verificada`, base `36c8a745`. Alcance autorizado: aritmética de cantidades de `js/modules/ot-material-custody.js`, prueba pública nueva y carga del Money real en fixtures existentes. Sin modificaciones de servidor, modelos Stock, permisos, aplicación, índice ni Service Worker; sin publicación ni operaciones reales.

El reproductor nuevo `test/ot-custody-quantity-precision.test.cjs` llama las acciones públicas desde Node VM. Usa Money y consumo de stock reales; DOM, autorización y persistencia de ciclo son adaptaciones ficticias. No acredita servicios desplegados ni diseño visual.

Antes de corregir, los cinco casos iniciales fallaron: instalación individual y Todo instalado enviaban `0.19999999999999998` para 0,3 entregadas menos 0,1 devueltas; excepciones enviaba `0.09999999999999998`; recepción y resumen producían `0.30000000000000004`. El log previo se conserva privado.

La corrección usa `SVCommercialMoney.quantitySum` para sumas/restas de cantidades en instalación, clasificación, rendición, recepción, remitos y resúmenes. Conserva las condiciones, permisos, confirmaciones y tolerancia preexistente. No agrega redondeo. Los seis fixtures anteriores solo incorporan el módulo Money real; ninguna expectativa cambió. El formato visual preexistente de descripción de entrega no se modificó.

La prueba nueva final tiene seis casos, incluido uno que conserva `0.20000001` sin limitarlo a seis decimales. También verifica que repetir instalación no repita comando ni consumo.

Validación: **96/96 focales**, **6/6 nativas/cadena**, cero omisiones. Las seis últimas incluyen las tres cadenas recepción→entrega→instalación→corrección→devolución (normal, ACK perdido y ausencia histórica de estado) y las tres pruebas públicas de entrega del coordinador en escritorio/móvil/permisos. Los archivos de cadena y del coordinador no forman parte de este cambio. No se ejecutó la suite completa.

Evidencia privada fuera de Git:

| Archivo | SHA256 |
| --- | --- |
| `tmp/ot-custody-quantity-precision-before.private.log` (0 PASS / 5 FAIL) | `b0f6c8b8c423e8d40880691a8a52800797728d13bfe0858b5e0df96979341235` |
| `tmp/ot-custody-quantity-focal-final.private.log` (96 PASS) | `b5a7b55052c113f4170e6019be2fbf87ac916b1f085c2405195bc091f254780b` |
| `tmp/ot-custody-precision-native-chain.private.log` (6 PASS) | `0b459f0ded14eab5f7ef0395e343625e81371990e5616fab399361493f086f81` |
| Custodia ensayada | `7f5a6189ac806b415f8a80830b372f9dc507ddf6dc5d4362d29233be2bf80f11` |
| Prueba nueva | `29a7496bb1a326b4e96661ada1b261531330daef821f4d9ab566202b2445ab3d` |

Capturas/JSON de la cadena: `C:/SisVentas/tmp/partial-delivery-chain-native-20261104/custody-precision/`, con `SV_CHAIN_EVIDENCE`. Son del host sintético; no equivalen a verificación visual de toda la aplicación. La repetición independiente del coordinador queda pendiente.
