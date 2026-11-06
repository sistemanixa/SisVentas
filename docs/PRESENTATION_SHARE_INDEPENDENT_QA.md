# QA independiente Presentación y Compartir — 06/11/2026

## Resultado y fuentes

- Rojo funcional bb33599b: 18 casos, 8 PASS / 10 FAIL, sin SKIP. Ocho fallos de rueda sobre foto/texto (incluido Control) y dos táctiles. Margen, teclado/retorno y cuatro casos de entrega ya pasaban.
- Verde funcional a6b9b665f2e401403cae25c0288bbd9cfa2b678c: repetición completa final 18 PASS / 0 FAIL / 0 SKIP, 96.264 ms.
- Combinado LOCAL v3.19.12: 5cd341aec9f5702368ad2cf322c82d365697e332 más copia congelada del único WIP CSS de Presentación (min-height móvil 44px). Resultado 19 PASS / 1 FAIL / 0 SKIP, 104.696 ms. Los 18 casos comparables pasan; pager escritorio pasa; superficie móvil falla.
- SHA256 del CSS WIP probado: ab555d94e3ae2e5a99186ecbe2750ab8b480a126655eb24c85c4b4d28cd55254. Ese WIP no se incluye en este commit QA.
- El diff funcional del checkout combinado frente al SHA fuente contiene únicamente css/project-presentation-trial.css. En a6 sólo difieren los tres archivos QA nuevos.

## Hallazgo pendiente

A 390px el mínimo calculado del botón del pager es 36px, no 44px. css/app.css:1463 declara .btn{min-height:36px!important} y prevalece sobre el WIP específico sin !important. La prueba conserva la expectativa 44px. No se modificó CSS ni runtime compartido. Hace falta corrección del integrador y repetición focal; no corresponde aceptar el conjunto como completamente verde.

## Método y entrega

HTML completo real con sus scripts y CSS, fixture comercial existente sin editar, cuenta/presupuesto/datos sintéticos, Chrome efímero 390 y 1280. Rueda sobre foto/texto/margen/Control; secuencia CDP touchStart/touchMove/touchEnd; PageDown/End/Home y restauración de foco/overflow/fondo. El primer sintetizador CDP de scroll no producía desplazamiento: se reemplazó sólo en QA por eventos táctiles reales y se repitió control rojo (2 FAIL), verde focal (2 PASS), verde completo y combinado completo. No se alteraron expectativas del producto.

Compartir normal usa el HTML y renderer html2pdf0.10.1 reales, con navigator.share controlado para mantener pendiente, cancelar y resolver. La descarga continúa disponible durante espera; cancelación permite reintento. No se abrió panel Windows ni se enviaron archivos a destinatarios.

Presentación usa descarga efectiva del navegador guardada en disco: PDF automático y enlace persistente entregan bytes idénticos; cambio de cotización retira/revoca blob previo, exige revisión y genera otro PDF válido. Revocación de rol cierra y revoca. Se probó respuesta DTO tardía después de cerrar sesión; no se acredita revocación durante un canvas de exportación ya en marcha.

Cada ejecución conserva cinco PDFs físicos ficticios: dos presupuestos de una página y tres presentaciones de seis. Verificación %PDF/EOF, pdf-lib y pypdf independientes; render Poppler e inspección visual de Control e Inversión verdes. Las imágenes son placeholders mínimos, no fotos reales; no acredita el diseño/corte de imágenes de cliente.

Los teardown verifican cero intentos SDK de escritura comercial, cero POST de negocio, cero comandos/commits del fixture y snapshot comercial idéntico; bloquean solicitudes externas. No se tocó Firebase, sesión real, reglas, servidor remoto, comisiones ni publicación. No se ejecutó puerta global ni emulador.

## Archivos y reproducción

Nuevos archivos propios: test/helpers/presentation-share-full-html-independent.cjs; test/presentation-scroll-real-html-independent.integration.cjs; test/presentation-share-delivery-real-html-independent.integration.cjs; test/presentation-pager-combined-independent.integration.cjs.

Ejecutar con Node22 y --test --test-concurrency=1 los tres archivos *.integration.cjs. Requiere SV_PRESENTATION_SHARE_QA=1, SV_TEST_CHROME, SV_QA_HTML2PDF (bundle local real), SV_QA_OUTPUT y NODE_PATH con playwright/pdf-lib. Sólo ejecutar pager-combined sobre fuente combinada con ajuste móvil; a6 intencionalmente conserva mínimo anterior.

Evidencia privada, fuera de Git: C:/SisVentas/tmp/qa-presentation-share-real-html/{red,green-a6b9,combined-31912}/. Logs matrix-final.private.log; control táctil rojo touch-events.private.log; pdf-manifest.private.json conserva tamaños, páginas y SHA256. El PDF combinado presentation-auto.pdf tiene 1.104.006 bytes, seis páginas, SHA256 86d531fb2c23d83359caaa04e196963989d0a093fa0fcdf2acb5ce99d687a0a2.

Chrome liberado tras finalizar matriz. Siguiente paso: integrador corrige prioridad CSS móvil, repite pager focal y sigue sus 10 HTML Soporte y puerta conjunta. Este informe no declara publicación ni aceptación final.
