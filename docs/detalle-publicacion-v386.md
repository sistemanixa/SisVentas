# Detalle consolidado de correcciones — v2.0.386

Fecha: 23/08/2026

## Actualizador y cotización de proveedores

- Los casos pendientes incorporan **Ir al proveedor** igual que los demás errores.
- Ir al proveedor abre también **Cambiar URL** y selecciona la dirección completa para reemplazarla sin borrar manualmente.
- Guardar una URL nueva vuelve a cotizar inmediatamente. Si obtiene un precio válido, actualiza el proveedor y retira solamente ese caso de pendientes; si falla, conserva el diagnóstico.
- Se investigó el producto P-51758 y se reforzó la resolución de publicaciones y redirecciones de Mercado Libre sin atribuirlo erróneamente al token general.
- La cotización individual y el actualizador masivo comparten las mismas barreras: identidad, nombre, moneda, URL exacta y variación excepcional.
- Ambos recorridos permiten corregir un nombre y aprobar administrativamente una variación grande, conservando evidencia y auditoría.
- El cotizador remoto admite de forma restringida `127.0.0.1:8080` y `localhost:8080`, permitiendo probar el actualizador desde el servidor local sin abrir CORS a terceros.

## Productos y vigencia de precios

- Cada producto puede activarse o desactivarse sin eliminarlo.
- El listado permite revisar productos sin ventas y ordenarlos por precio.
- La vigencia de costos se configura en días y se comparte entre Productos, Ventas y Actualizador.
- Las fechas de proveedores distinguen visualmente vigente y vencido.
- Importes y referencias de costos conservan centavos.
- Se mejoró el contraste del modo claro en ficha, filtros, tarjetas y acciones.

## Gastos, haberes y pagos

- Gastos usa el mes efectivo del pago para horas extra, reintegros y registros históricos, conservando por separado el período trabajado y la fecha original.
- Los gastos de julio pagados en agosto aparecen en agosto sin perder su origen.
- La reparación histórica dejó de ejecutarse automáticamente al iniciar. Está disponible manualmente en Configuración → Mantenimiento.
- La edición de un pago reconoce el monto dinámico y permite cambiar correctamente el medio de pago.
- Cerrar y maximizar usan controles del mismo tamaño y posición.

## Facturación

- Las facturas históricas sin foto fiscal original ya no se comparan usando reglas actuales de IVA.
- Esos comprobantes se identifican como históricos y no recomiendan una nota de crédito por una diferencia inventada.
- Las emisiones nuevas guardan el total fiscal esperado, el total comercial del momento y la versión del contrato de integridad.
- Las futuras diferencias se calculan únicamente contra esa fotografía inmutable.

## Rendimiento y tareas en segundo plano

- La carga inicial dejó de abrir más de veinte colecciones completas de Firebase simultáneamente.
- Identidad y datos de la pantalla visible se conectan primero.
- Los módulos secundarios se distribuyen en lotes con demoras mínimas de 0,7, 1,8 y 3,8 segundos y esperan tiempo ocioso.
- Cargos, presencia y comisiones impiden listeners o lecturas duplicadas.
- Órdenes de compra se difiere salvo que el usuario abra directamente esa pantalla.
- Aguinaldos se conecta junto con Gastos y no en toda sesión.
- El histórico del dólar se inicializa una sola vez después de resolver la sesión.
- Notificaciones, actualización PWA y chequeos web dejan de trabajar con la pestaña oculta y reducen consultas redundantes.

## Coherencia visual validada

- Se recorrieron los 33 módulos visibles con ancho móvil de 454 px.
- No se detectaron controles fuera de pantalla, desbordamiento global ni errores de consola.
- Se revisaron directamente tema oscuro y claro en Configuración, Productos, Gastos, Facturas y Actualizador.
- Las tarjetas móviles ahora ignoran máximos de ancho heredados del escritorio, evitando fechas y CAE cortados.
- El Actualizador muestra un proveedor por fila en celulares para conservar nombre, vinculados y pendientes legibles.

## Deuda técnica identificada

- `app.js` continúa siendo un monolito de aproximadamente 2,48 MB y debe separarse por dominio en una siguiente etapa.
- Productos renderiza una cantidad elevada de controles en el DOM; conviene incorporar paginación o virtualización sin limitar la búsqueda completa.
- Existen 41 candidatos a código sin referencias. No se eliminaron automáticamente porque algunos pueden ser herramientas administrativas invocadas manualmente.
- La batería completa contiene pruebas históricas que exigen que versiones antiguas sigan activas. Deben migrarse para comprobar su archivo inmutable sin comparar contra el `index.html` actual.
