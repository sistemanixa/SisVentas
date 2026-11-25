# Borrado de borradores nuevos de Compras

Misma ruta `POST /compras/ordenes/eliminar`, mismo body exacto `{id,orderKey,expectedHash}`. El host ON compone `purchase-typed-delete-command`; OFF conserva el handler nativo revisado independiente. No se modifica la revisión histórica OC49.

El nuevo comando usa `mode:user`, `financialAction:ordenes.eliminar`, `operation:purchase-typed-delete`, hash del body literal, autorización de sesión/permisos, lectura visible mediante `scope.getAsUser`, admisión genuina y resolución E histórica de cada fila. Revalida referencias, sesión, permisos y admisión antes del commit. No acepta parches, cantidades, identidades físicas ni banderas de autoridad del cliente.

El modelo sólo elimina borradores `manual` o `extra_stock` independientes, registrados con `inventarioCompra` schema1, sin recepciones ni historia adicional. Comprueba referencias P/J/R por fila y su operación respaldada en el ledger original. Escribe `Order:null` y resta únicamente las unidades propias `enCompra`, conservando físico, reservas, trazas y capturas. No reutiliza el modelo histórico que infería claves físicas.

Policy emite una capacidad privada WeakMap y sella el plan RAW y las derivadas con el Guard. El validador genuino existente de Purchase puede ser consumido por OrderC; no hay una excepción por nombre de operación ni un booleano confiado. No produce SourceCost ni reserva nueva de numeración. Las órdenes linked conservan cancelación trazable y la interfaz debe explicar ese destino.

Evidencia local inicial: 71 pruebas modelo/Policy/host PASS (49 modelo +9 Policy/entrada +13 host). Extracción del fixture REST compartido conserva los 10 casos de alta PASS contra Root genuino. Se añade `purchase-typed-delete-core.integration.cjs` con seis casos nuevos (borrado, ACK perdido, conflictos tardíos y permiso denegado); requieren integrar este SHA en el core seleccionado antes de acreditarlos. No emulador ni producción; host OFF hasta cierre integrado.
