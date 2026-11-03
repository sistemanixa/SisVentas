# Cuenta corriente: preparación local por cliente

Estado al 03/11/2026: **integración local v3.18.13 en curso, sin activación remota**. El host usa la tabla y las acciones existentes únicamente cuando la configuración acredita cobertura completa. Producción sigue en18.10. No representa el cierre de la auditoría ni está servido en la ventana humana8766.

## Implementado en este bloque

- Identidad compartida navegador/servidor: conserva las referencias explícitas y grupos unificados; no selecciona una ficha por coincidencia de nombre. Domicilio físico y cliente principal son referencias distintas. Conflictos y códigos desconocidos permanecen identificables, sin asociarlos a otro cliente. Los identificadores numéricos textuales no pasan por Number.
- Proyección propuesta `sv_client_accounts/v1`: cuentas y totales por ámbito, miembros mínimos de ventas/cobros, páginas de 50 y búsqueda por cliente. Las fuentes comerciales no se escriben. Los resúmenes excluyen productos, costos, facturas y adjuntos binarios.
- Actualización incremental pura: comprueba la imagen anterior, membresía, revisión y cobertura antes de producir un parche técnico. No revive pagos embebidos cuando existen globales anulados, conserva la prioridad de la referencia técnica y rechaza cobros relacionados con varias ventas. Totales y deuda utilizan el conjunto completo, no la página visible.
- Lector propuesto: sólo consulta el ámbito autorizado y el cliente seleccionado, comprueba cobertura antes y después y cancela ante cambio de sesión, permisos, pantalla o conectividad. No sondea por reloj ni descarga originales como alternativa a un error del índice.
- Extracto puro por cliente: exige todos los miembros de ese ámbito, comprueba que cargos, pagos y saldo coincidan exactamente con los totales y luego pagina de 50. Conserva saldo anterior por período, claves de cobros agrupados, centavos y fechas desconocidas. Distingue el importe original del aplicado cuando hay sobrepago/devolución; no altera ninguno. Un saldo legacy conocido se presenta sin inventar un cobro ni un comprobante. Los comprobantes embebidos conservan tokens mínimos; su archivo sólo se obtiene por acción y pertenencia verificada. El escritor compartido y la pantalla nativa ya están conectados en la candidata local, sujetos al cierre de validación antes de activar.
- Propuesta offline de reglas: módulo Cuenta corriente, ámbito propio salvo administrador, consultas limitadas a 50, restablecimientos de acceso y escritura bajo el control existente del servicio. Fuentes internas, actividad y directorios técnicos no se entregan al cliente. No aplica reglas ni activa configuraciones.

## Evidencia

Evidencia inicial de39 pruebas unitarias: identidad, proyección, lector y propuesta de reglas. Matriz de reglas adicional aprobada en el emulador `demo-expense-audit3186`, sin credenciales de producción. Comprueba ámbito propio/ajeno, administrador, técnico sin módulo, revocación, cobertura obsoleta, consultas sin límite o de 51 y escritura directa denegada.

Medición reproducida con datos ficticios: 1.000 ventas, 1.000 cobros y 100 clientes. Tres lecturas completas sumarían 1.354.223 bytes JSON. Lector propuesto: primera página y totales completos, 8 lecturas/31.704 bytes; ventas y cobros del cliente elegido, 10 lecturas/8.846 bytes. Se muestran 50 cuentas y se mantiene la deuda completa de 8.000.000 centavos. No es una medición de red, facturación ni latencia de producción; incluye imágenes ficticias en los originales para reproducir su exclusión de los listados. Evidencia y script privados en `tmp/post-index-audit3186`, fuera de Git.

## Integración posterior comprobada

El host conserva la tabla de7columnas, carga50cuentas y consulta búsquedas históricas y extractos con límites50. Los importes se mantienen en centavos; saldo anterior y cierre del período se obtienen del extracto completo. La tarjeta de antigüedad identifica saldo según fecha de venta, sin inventar vencimientos; separa fechas desconocidas. Lectura individual de Clientes sólo al abrir su ficha o imprimir, sin resolver por nombre. El estado listo de la proyección se invalida al salir para que otro módulo no lo interprete como originales completos.

Nueve recorridos de navegador aislado:390/768/1280, cargador SVDataReadiness real, revocación, rama desactivada, reposo oculto, formulario real de pago contra guard compartido, replay y anulación, documento bajo acción y extracto impreso completo de241movimientos aunque se vean50. El archivo sólo devuelve documento, nunca costos ni metadatos de venta. Son pruebas ficticias, no registros reales ni una medición de producción. Ocho casos de escritores cubren altas de scope, pérdida de cobertura, cambio de cliente, unificación, nombre y eliminación de ficha sin mover financieros históricos.

## Trabajo ejecutable que sigue abierto

| Trabajo | Estado / siguiente acción |
| --- | --- |
| Guardados coordinados | Guard, SDK, gateway, runtime y puente fiscal integrados condicionalmente; empaquetado y ocho casos probados. Completar matriz de concurrencia/roles del formulario y cotejar todos los escritores antes de activar. |
| Identidades y unificación | Directorio técnico y dependencias incrementales conectados; sin asociaciones por nombre. Unificación, contador comercial y búsqueda coherente probados; falta preparar el alta de usuarios sin movimientos. |
| Extracto y saldo anterior | Modelo, escritor y lector conectados, documentos históricos conservados y acciones probadas. Actualización durante formulario y retorno a Cobros probados con guard RAM y limpieza nativa; falta cotejar el arranque autenticado integral. No se alimenta el conciliador antiguo con50filas. |
| Interfaz e Historial | Tabla y acciones CC conectadas localmente. Historial sigue pendiente: presupuestos, OT, soporte y equipos requieren sus fuentes completas autorizadas por cliente/domicilio, incluyendo embebidos identificables sin duplicarlos. |
| Arranque y sincronización | Integrar resultado/error/cancelación/sesión con SVDataReadiness real y probar ambos órdenes de llegada, retornos y cambios de rol. El fixture conectado ya utiliza SVDataReadiness real; falta el arranque autenticado integral con activación coherente. |
| Validación visual y transferencia | Navegador aislado escritorio/móvil y medición de las peticiones de la pantalla conectada. No confundir los bytes del modelo con transferencia real. |
| Productos, Comisiones y Facturas | Continuar el inventario por dependencia después de la fuente por cliente; no declarar resueltos por esta preparación. |

## Activación externa separada

No hay publicación, push, configuración remota, nuevas tareas periódicas ni modificación de ventas, pagos, comisiones o stock. La futura activación exige una candidata integral, cobertura contrastada, prueba de todos los escritores y reglas verificadas contra el estado remoto. Hasta entonces, este bloque no reduce las lecturas productivas ni cambia sus permisos.

## Continuidad local14

Se detienen las escuchas completas anteriores de Clientes y unificaciones al reclamar CC nativa; se reabren al entrar al directorio fuera de CC. Actualizar deuda con un formulario abierto conserva sus campos y archivo, recarga los miembros completos a revisión coherente y actualiza la imputación; confirmar queda bloqueado mientras se prepara. Un pago concurrente ficticio de40 reduce una deuda100 a60: el importe80 que el usuario escribió se conserva y muestra exceso20, sin registrar otro pago. Una operación ya en curso conserva su intento y difiere el refresco hasta concluir. La navegación de cobro instala el contexto después de la limpieza nativa de entrada y lo restaura al regresar. No se ejecutaron pagos ni consultas de datos reales para estos casos.

Al volver de oculto con formulario abierto, se recarga su membresía y conserva lo escrito; mientras está oculto no consulta. El cambio de rol/sesión retira el formulario y su información privada. Caso browser adicional reproducido antes y después, con cero guardados RAM. Suite final local7359total/7332PASS/27skip/0fallos; no certifica activación remota ni cierra Historial.

## Inicialización local del ámbito propio

POST /cuentas/preparar acepta sólo generación, nunca UID. Auth revocado, perfil, permisos, estado de clave y directorio propio se comprueban antes y de nuevo dentro de la confirmación del guard compartido; un sello interno impide invocar esa ampliación desde un comando forjado. La evidencia privada de autores/UIDs del historial completo debe probar que ningún registro puede corresponder a esa identidad. Coincidencia heredada, duplicado de perfil, cobertura incompleta o cambio concurrente bloquean; no amplía asignaciones ni modifica originales. El cliente sólo lo solicita al entrar con cobertura propia ausente y capacidad explícita scopeBootstrapVersion1; una tentativa por sesión/contexto/generación, sin reloj ni reintentos al volver de oculto. El ACK no dibuja cero: vuelve a leer las coberturas y totales autorizados.

La regla propuesta permite consultar sólo la existencia de cobertura propia antes del alta; totales/páginas conservan el requisito de certificado vigente. Índices privados nunca se entregan al navegador. Dos pruebas reales de RTDB emulado verifican límites/permisos/cerco y roundtrip de vacío→primer delta→deuda positiva con fechas faltantes rechazada. Firebase elimina mapas/listas vacíos: únicamente balanceCents0 validado permite mapa de fechas ausente; la evidencia tiene contadores explícitos de UID/alias para distinguir listas vacías de cobertura perdida. Prueba RAM adicional usa el guard real tras normalización y conserva los originales. No se modificaron reglas, configuración ni datos productivos. Falta cerrar la prueba fullapp y la puerta completa del nuevo bloque antes de considerar activación.

La prueba con createLaborDb real reprodujo «El guardado ya se está confirmando» y luego pasó al revalidar mediante readFresh/queryFresh del guard y Auth crudo (con assertAccessReady explícito usando esas lecturas), no mediante snapshots de laborRuntime.db. Se revalidan también configuración y directorio tras las lecturas. El rechazo conserva motivo visible y métricas— con paneles inert, sin marcar la fuente como lista ni habilitar acciones. La copia anterior con DB RAM crudo no certifica esta dependencia; se repite fullapp sobre una nueva foto congelada.
