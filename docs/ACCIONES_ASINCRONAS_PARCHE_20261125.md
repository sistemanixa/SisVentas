# Acciones asíncronas: parche de composición — 25/11/2026

Este bloque no modifica la aplicación inmutable, índice ni Service Worker. Aplicar `require('./scripts/lib/active-action-feedback-overlay.cjs').apply(source)` al texto de la NUEVA aplicación que prepare integración. El resultado conserva el resto de la fuente; cada función original exige SHA256 exacto y se rechaza cualquier divergencia. Contraste de las ocho funciones con la aplicación pública v3.21.13: hashes idénticos, parche aplicable.

| Función | Cambio |
|---|---|
| guardarKit | Devuelve la escritura y su continuación existente, tanto alta como edición. |
| guardarMaxComisionPct | Devuelve la cadena existente sin alterar valor ni destino. |
| guardarAlicuotaIVA | Devuelve GET y SET interno; termina después del guardado real. |
| guardarImpuestosGenerales | Devuelve GET y SET interno, conservando campos anteriores. |
| guardarDatosEmpresa | Devuelve SET y elimina falso Guardado previo a confirmación; el indicador común controla actividad. |
| guardarPeriodoVac | Devuelve la cadena existente; cierre y render siguen después de confirmar. |
| credGuardar | Devuelve la cadena existente, conservando validación y propietario. |
| spAgregarNota | Promesa compartida por input pendiente, captura reclamo original, agrega una sola nota y conserva borrador cambiado durante el guardado. Usa ejecutarAccion si está disponible. |

Los módulos catalog-promotions-config y paraguay-budget-margin devuelven una promesa compartida por botón, bloquean Guardando hasta terminar y usan ejecutarAccion con fallback local. Conservan validaciones, sesión/contexto, formatos y escrituras originales. La fixture antigua de ofertas ahora distingue el botón del status, como el DOM real; ninguna aserción semántica fue retirada.

Validación: 25/25 pruebas focales (15 propias y 10 de ofertas/contexto), 0 skip, más node --check de módulos y overlay, git diff --check. Incluye GET→SET pendiente, copia de historia sin mutar original, doble clic una escritura, borrador nuevo/contexto cambiado preservados y helper/fallback. No prueba UI completa ni todas las acciones del sistema. Los seis cambios de sólo retorno se contrastan byte a byte salvo el retorno añadido. Sin red, datos reales, despliegue ni migración de Firebase/servidor.

Límite: la nota conserva el esquema histórico existente. El bloqueo evita doble envío local; no introduce transacción ni resuelve ediciones simultáneas de otro cliente. La integración debe cargar primero el indicador común y aplicar el parche únicamente al nuevo activo.
