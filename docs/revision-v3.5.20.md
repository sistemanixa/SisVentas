# v3.5.20

Los borradores se sincronizan por UID entre dispositivos y orígenes. Los descartes persisten para impedir que una copia antigua reaparezca. Borradores aparece junto a los filtros del presupuesto y muestra sus filas en la grilla. Se descartaron los dos borradores locales autorizados.

El chat usa rutas protegidas independientes de la antigua rama general. Administración / Ventas admite administración y ventas; Técnicos admite roles técnicos; General admite usuarios activos. Administradores acceden a los tres grupos. Técnico vendedor pertenece a ambos grupos por su rol combinado. Los mensajes directos usan UID de los participantes. La edición administrativa de usuarios actualiza su rol protegido de forma atómica.

Migración verificada: 7 identidades, 3 canales y 64 mensajes; respaldo local privado y retirada de la copia antigua tras comprobar la integridad. La validación de la ruta antigua impide que clientes anteriores vuelvan a escribir allí.

Validación: 21 comprobaciones de acceso reales en Firebase, incluida denegación por rol, privacidad de borradores y acceso anónimo. Pruebas locales de matriz de grupos, retención, aislamiento, descarte sincronizado y recarga sin resurrección aprobadas. Sintaxis y consistencia de versión correctas. En la ventana local se verificó la pestaña Borradores y su grilla vacía.
