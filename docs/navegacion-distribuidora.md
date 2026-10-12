# Navegación de Distribuidora

- Configuración se ubica al pie del menú lateral, con ícono, justo encima de la línea del usuario.
- El botón interior Volver recorre solamente vistas y acciones de Distribuidora. Al agotar el historial permanece en el portal: nunca abre SisVentas.
- La salida a SisVentas es una acción separada y corresponde únicamente a usuarios cuyo rol permite acceder al sistema general.
- Los roles distribuidora y compras_paraguay no acceden al sistema general. Su acción de salida es Cerrar sesión, aunque tengan permisos internos de Distribuidora.
- Mantener las verificaciones de rol y permisos tanto en navegación como en Firebase; ocultar un botón no reemplaza la autorización.
