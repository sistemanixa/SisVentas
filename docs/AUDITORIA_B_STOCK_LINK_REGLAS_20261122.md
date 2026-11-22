# B · Stock Link1 · candidata local · 22/11/2026

Estado: preparación OFF. Ninguna regla, configuración, activación, dato comercial o interfaz de producción fue modificada. No equivale a integración final ni a autorización de corte.

Base local E `55db3ed4`, barrera A `994341b91fd1e5f32c6811ee4af37ffbfaa5c2b2` aplicada como `9f9f10e9`. Los módulos nuevos componen la barrera, excluyen stock_vinculos de dos concesiones comodín, restringen 158 concesiones de escritura únicamente para Link1 fuera de los cinco destinos y condicionan siete concesiones de catálogo/inventario a activación de cohorte. El manifiesto enumera cada ruta. Restaurar sólo esas rutas y metadata recupera exactamente por hash la candidata A; la base privada permanece intacta. No se incluye su contenido en Git.

Contrato propuesto: activación privada con firma Ed25519 verificada en runtime mediante clave pública y pins esperados de servidor. Rules verifican semántica de los pins y confían en namespace privado; no verifican criptografía. rulesDigest se compara externamente para evitar hash circular. Los pins/firma usados aquí son ficticios, no son el conjunto final de artefactos. El verificador puro todavía requiere integración por E; no hay activación.

Los ocho campos de ambos espejos y los seis campos de resultado se comparan escalarmente. RTDB no sirve para igualdad profunda de objetos mediante val() === val(). La prueba sintética rechazó incluso objetos iguales. La restricción global Link1 aprobada sustituye aquella protección incorrecta. Las capacidades anteriores conservan expresiones originales bajo condición Link0/ausente. Falta ampliar controles positivos de otras capacidades y de compatibilidad SDK con activación ausente antes de considerar cerrado el paquete.

Evidencia inicial: siete pruebas unitarias PASS; 32/32 casos de emulador PASS con base privada SHA256 ea197750dc668aedffc5e182dd6a6e7fd6e939279690cf4a8077ac4cd975f3db, candidata SHA256 e4be8c68b8091347274e36ab0711b18f8d1e40e0e7bd6884e11d206a4ee9c4c7. Incluye command/guard/store reales, dos roles, replay/ACK, revocaciones y rechazo atómico de mezclas OT/finanzas/catálogo/inventario/desconocidas. Cobertura de ownership es doble explícito de servidor con dueño ficticio; no demuestra exhaustividad del índice real. Modelo continúa OFF.

Intentos conservados: primera tanda29=26PASS3FAIL por wildcard del recibo bloqueando campos conocidos; segunda29=28PASS1FAIL por simulación ACK cancelando body null de print=silent. Se corrigieron constructor de reglas y fixture respectivamente, sin alterar expectativas ni código E. Fallo previo de regex Java y diagnóstico de coverage colgado son límites de infraestructura registrados en continuidad, no resultados de negocio. No usar el endpoint inspect coverage.

Repetición ampliada con activación inválida y SDK postlease: 39/39 PASS; emulador propio limpiado y detenido. La puerta completa pertenece al principal; no se ejecutó aquí. Chrome continúa reservado por integración central y no se atribuyeron nombres a dos fallos UI no identificados en esta continuidad.

## Ampliación posterior al primer paquete

La tanda completa ampliada de 50 casos pasó: cinco ataques a parent/guard/recibo, cuatro controles de conteo real Link0 (dos roles, activación presente/ausente), dos controles SDK legacy con activación ausente. Primeros controles SDK fallaron por fixture incompleta: catálogo sin codigo/categoria e inventario sin espejo coordinado. Se completó la fixture y actualización atómica de espejo; no se modificaron reglas ni expectativas para admitir datos inválidos. La capacidad anterior de conteo atravesó servicio/guard/store reales.

Se añadió además binding explícito del productKey del par previo a la claim y un ataque concurrente con un par previo ajeno. Matriz final: 51/51 PASS, siete unitarias PASS; emulador limpiado y detenido.

Precisión sobre firma: el caso con firma forjada es rechazo del contrato del servidor antes de PATCH. RTDB sólo comprueba pins y forma, no Ed25519. Una configuración privada escrita por un actor privilegiado con pins correctos y firma falsa podría retirar SDK aunque runtime Link permanezca OFF. Antes de cualquier activación futura debe verificarse firma y reglas exactas antes de escribir esa configuración, con respaldo y corte auditado. No se realizó ese paso.

Pendientes reales: integración E del verificador, pins finales de todos los escritores, demostración de cobertura exhaustiva y revisión de controles de otras capacidades distintas del conteo Stock. No se afirma cobertura universal. Los dos casos UI externos quedaron NO asignados por el principal; Chrome libre no identifica cuáles eran.
