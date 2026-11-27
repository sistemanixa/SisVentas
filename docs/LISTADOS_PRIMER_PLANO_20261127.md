# Listados al ocultar y recuperar la ventana · 27/11/2026

Candidata local v3.22.7, desde4dbedff33cab97d363172801656b98349b50d299 (fuente3.22.6 preservada). Rama codex/retain-lists-foreground-20261127; vista local8766 apunta a este checkout. Sin despliegue, cambios Rules/backend ni escrituras de negocio.

## Criterio
Pausar transporte y retirar respuestas pendientes no equivale a destruir la última presentación. Mismo usuario/Auth/db/rol/permisos, ruta y filtros: conservar filas/nodos/página/scroll/foco. Al retornar se reanudan verificaciones y escuchas; sólo un cambio real reemplaza datos. Primera carga, nuevo filtro, identidad distinta, revocación o error de acceso siguen el flujo estricto. La presentación retenida no declara readiness verdadero ni autoriza pagos u otras acciones. No TTL, polling ni caché persistente nueva.

## Inventario de los patrones activos
- Cuenta corriente: separadas suspensión y cancelación; coverage igual no repite browse/ledger; preparedSales siempre retirada; modal de pago exige carga real. Fuente A48008b16 integrada; historial Git conserva el SHA de integración.
- Ventas/Cobranzas y host comercial anterior: suspenden operaciones y escuchas sin borrar state/metadata/DOM; retorno verifica configuración/cobertura, sin volver a pedir páginas/totales si no cambió; cambio refresca en segundo plano. Acciones hidratan originales y verifican contexto.
- Historial: conserva sólo solapa pública verificada/domicilio/página. Retira credenciales, secretos e intenciones. La API existente exige consultar identidad y página autorizadas al volver; misma respuesta no repinta. No se abren índices privados ni se elude servidor.
- Reportes/Estadísticas/Rentabilidad: conserva período y presentación; reinstala verificaciones de cobertura/configuración/fingerprints; recarga payload sólo al detectar cambio.
- Agenda: transporte DataQuery conserva su retiro estricto. El consumidor mantiene una presentación pausada del mismo contexto/rango; primera respuesta idéntica no redibuja, distinta sí. Respuestas tardías no pisan un rango nuevo. Fuentes y matching no cambiados.
- Relevamientos: pausa escucha y detalles sin vaciar lista terminada; al regresar reutiliza el DOM si el índice/resultado coincide. Permisos/sesión/ruta sí retiran; no se alteran guardados ni adjuntos.
- Cuenta de empleados y Vacaciones: eventos de regreso no reconstruyen resultados si referencias verificadas y contexto no cambiaron; callbacks de datos y acciones explícitas mantienen render normal.
- Productos, Clientes, Gastos, Empleados, Proveedores, OT, Reclamos, Equipos, Compras y Stock: listeners deduplicados existentes no se reinician por visibility en su capa listada; conservados sus consumidores cruzados y eventos de datos. La pausa común offline/online no borra DOM por sí misma. Sin introducir resuscripciones nuevas a sus raíces.
- Presupuestos: CommercialOwnership ya conserva snapshot/ETag y no repinta con304 o respuesta idéntica; no se elimina su revalidación autorizada.
- Dashboard y tarjetas: conservado el circuito existente de presentación retenida/agenda; permisos y fuentes siguen separados.
- Auth/perfil/inactividad, cámara, dictado, credenciales, formularios sensibles y comandos: sus cancelaciones no son un vaciado de listado. Se conservan cierre de sesión y retiro de capacidades/secretos; no se desactivan controles globales para evitar un parpadeo.

## Verificación
Frentes A/B/C usaron fuentes4db y fixtures aislados: Cuenta corriente22focales+4Chrome; comercial33casos afectados(11nuevosChrome+22existentes), hunk final de eventos4casos; Historial/Reportes44unit+7Chrome. Evidencia Root tras integración: Agenda/Dashboard/Vacaciones182focales; legado/Agenda97incluidos solapados; surveys+readiness62; conjuntohosts87; commoncore50. No sumar como suites independientes porque se solapan. Root5Chrome(Cuenta corriente/Historialfullindex/Reportes)+1ChromecontratoReadiness PASS. No se afirma revisión de todos los formularios financieros ni oclusión OS: pruebas Chrome ejercitan lifecycle hidden/visible. Local real8766 recargada con13cuentas visibles sólo lectura.

Pendiente al congelar: puerta vigente completa y revisión local final. Publicación requiere solicitud posterior del titular. No datos privados en este documento.
