# Volver en módulos — v3.10.2

Se revisaron 41 contenedores de módulos del índice. Todos comparten el botón Volver al inicio del contenido, debajo de la cabecera, fuera de los contenedores reemplazados por renderizado dinámico. La tabla distingue botones estáticos; no afirma ausencia de botones creados por JavaScript.

El botón usa el mismo recorrido que Escape: ventanas, formularios y retornos internos antes del historial de módulos. No inventa un destino si no existe historial. Se evita la recursión cuando un retorno local delega al mismo manejador, y se omiten módulos del historial sin permisos actuales.

| Módulo | Retorno estático local | Cobertura global |
|---|---|---|
| dashboard | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| venta | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| detalle | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| presupuesto | Sí | Inicio del contenido |
| ordentrabajo | Sí | Inicio del contenido |
| cobranzas | Sí | Inicio del contenido |
| cuentacorriente | Sí | Inicio del contenido |
| tesoreria | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| configuracion | Sí | Inicio del contenido |
| agenda | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| servicios | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| remitos | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| proveedores | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| balancecompra | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| ordenes | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| facturas | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| creditofiscal | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| estadisticas | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| notificaciones | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| garantias | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| soporte | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| relevamientos | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| equipos | Sí | Inicio del contenido |
| historialcliente | Sí | Inicio del contenido |
| clientes | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| catalogo | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| productos | Sí | Inicio del contenido |
| kits | Sí | Inicio del contenido |
| actualizadorprecios | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| empleados | Sí | Inicio del contenido |
| usuarios | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| reportes | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| comisiones | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| gastos | Sí | Inicio del contenido |
| asistente | Sí | Inicio del contenido |
| vacaciones | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| rentabilidad | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| ctaemp | Sí | Inicio del contenido |
| informes | Sí | Inicio del contenido |
| caja | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
| tablero | Sin botón estático; puede generarse al abrir una vista | Inicio del contenido |
