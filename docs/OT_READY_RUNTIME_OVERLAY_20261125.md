# Overlay mínimo runtime6b6276dd

API pura require(ot-ready-overlay).apply(filename, Buffer|string) devuelve mismo tipo. Soporta sólo ot-lifecycle.js y ot-delivery.js: agrega otKey/otRevision/expectedOTHash a available, y en Delivery asigna a variable la lectura autorizada ya existente. No paralelismo nuevo ni restauración de consumidores del repositorio sobre imagen. No modifica disco. Exactamente una coincidencia dentro de available, idempotencia estricta, aborta ante forma inesperada y verifica reversión textual exacta del cambio. Todo lo anterior/posterior a available permanece byte idéntico, incluidos summaryDigest, batches, activation, execute y fresh checks.

Prueba4PASS con SV_OT_REVIEWED_RUNTIME=C:/SisVentas/tmp/runtime-6b6276dd/source. Loader in-memory valida SHA256 de los8 módulos del manifest y2OT del manifest OT; carga Runtime/Guard/Store/Life/Policy reales en un grafo aislado. Ejercita cliente+ServiceAuth+Recovery+comando custodia y un solo efecto/sinSDK extra, además available Delivery real con attestation sólo ficticia. Resto de dependencias desde checkout, declaradas, sin index startup.

Límite explícito: ot-summary-digest.js no fue capturado. Su dependencia de prueba falla si se entra a esa rama; el escenario no incluye otras custodias y no la ejecuta. Por tanto NO certifica esa rama ni igualdad del resto de la imagen. No se reemplazó por una implementación histórica. Root debe recuperar ese archivo para ampliar composición adversarial, sin cambiar el overlay que ya preserva esas llamadas intactas.

Fix close d55/45942cbb es independiente de este overlay y modifica sólo la línea de authority en Policy real idéntica al repo. Sin despliegue de backend/Rules ni acceso a datos reales.
