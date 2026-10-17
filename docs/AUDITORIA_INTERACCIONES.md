# Auditoría de carteles, clics y desplazamiento

17/10/2026. Candidata local v3.12.9, rama `codex/auditoria-interacciones` desde `918f0923`. Producción conserva v3.12.8. Sin cambios de datos, permisos, contraseñas ni servidor remoto.

## Criterio obligatorio

| Área | Condición que debe cumplirse |
| --- | --- |
| Clic | El control visible recibe el clic; ni una capa invisible ni el fondo ejecutan otra acción. |
| Teclado | Enter respeta el botón enfocado; Cancelar nunca confirma. Enter en un área multilínea sigue siendo salto de línea y la composición del teclado no confirma. |
| Foco | Tab y Shift+Tab permanecen en la confirmación. Al cerrar vuelve al control de origen si sigue conectado y visible. |
| Capas | Una confirmación superior no desactiva su propio botón. Los diálogos nativos conservan su capa superior. |
| Scroll | Desplazar una lista frontal no mueve el fondo. Cerrar o minimizar libera la página; restaurar recupera el bloqueo y el diseño. |
| Cabeceras | Fondo opaco y contenido vertical conservado. El gestor de ventanas no debe convertir todo un panel en cabecera. |
| Móvil | Controles dentro de pantalla, sin maximizar de escritorio; botones táctiles de confirmación y diálogos de Proyectos de al menos44px. |
| Reposo | Una pila sin cambios no vuelve a escribir clases ni realimenta su MutationObserver. |

Estos criterios se comprueban antes de afirmar que una corrección de interacción está terminada. No sustituyen pruebas funcionales de guardar, permisos o concurrencia.

## Fallas reproducidas y correcciones

- El listener de confirmaciones interceptaba Enter también sobre Cancelar y resolvía `true`. Ahora los botones conservan su acción nativa; el listener solo procesa teclas del propio diálogo, sin composición ni eventos ya consumidos.
- Tab podía salir de la confirmación y el cierre dejaba el foco sin restaurar. Se contiene el recorrido y se devuelve al control anterior sin desplazar la página. Escape consumido no cierra también el diálogo padre.
- La sincronización removía/reagregaba clases en cada ejecución. Veinte sincronizaciones sin cambios produjeron80 escrituras en la prueba anterior; ahora producen cero. Solo se escriben estados que cambiaron. El observador incluye `hidden`, `open` y flags de minimización/bloqueo.
- Un overlay con `role=dialog` era considerado directamente panel aunque tuviera una `.modal` interior; el gestor podía aplicar el formato de cabecera al panel entero. Ahora prioriza el panel hijo y conserva el caso de un panel que sea él mismo el diálogo.
- La regla móvil general `.btn{min-height:36px!important}` vencía a las reglas de44px. Se ajustó únicamente la prioridad de confirmaciones, Reintentar carga y botones de diálogos de Proyectos. Medición real posterior:44px en confirmación y diálogo nativo con estilos de Proyectos; tablas y demás botones no se ampliaron globalmente.

## Evidencia y alcance

- 1.878 pruebas vigentes aprobadas;27 complementarias de aviso/portal, acciones de notificaciones y menús también aprobadas. Ocho casos nuevos en la puerta vigente; las pruebas leen la aplicación activa y reprodujeron los fallos antes de corregirlos.
- Una primera ejecución concurrente falló por el plazo fijo de espera de una prueba existente de cola PDF (esperaba una lectura iniciada y obtuvo cero). Ese archivo pasó aisladamente y la suite completa repetida pasó. No se cambió la implementación PDF ni se alteró la expectativa; queda identificado como prueba sensible a carga para revisar su sincronización por condición.
- Navegador local aislado, sin Firebase: Cancelar con Enter resolvió `false`, Tab circuló en el diálogo y cerrar restauró el foco. Una lista desplazó651px con fondo en0; después del cierre el fondo pudo desplazarse624px. Confirmación sobre lista y dentro de `dialog.showModal()` recibió el clic mediante `elementFromPoint`, sin `inert`. Maximizar/restaurar/cerrar y liberación de clases verificados. En reposo: cero mutaciones de capas en500ms.
- A390×844: controles dentro de pantalla y cabecera opaca; maximizar oculto; confirmación y botón del diálogo nativo con44px. Es tamaño de navegador, no celular físico ni prueba de rueda/touch reales. El scroll se verificó con PageDown.
- Aplicación local completa con sesión existente: abrió sincronizada. Nuevo cliente abierto y cancelado sin escribir: panel vertical, cabecera opaca, un único Maximizar, bloqueo activo al abrir y liberado al cerrar. No se guardaron clientes ni operaciones de prueba.
- Inventario inicial del índice:43 pantallas y84 módulos importados. Revisión de infraestructura compartida y consumidores representativos; no se recorrieron todos los formularios ni cada combinación de datos/roles de esas pantallas. No declarar auditoría universal ni ausencia absoluta de fallos.

## Repetir las pruebas de interfaz sin datos reales

```powershell
node scripts/dev-interaction-audit.cjs
```

Abrir `http://127.0.0.1:8784/` en la misma pestaña de trabajo. La herramienta extrae los componentes compartidos de la aplicación activa y sirve solo la página ficticia y cuatro CSS permitidos. No carga Firebase, autenticaciones, documentos ni módulos financieros; no sirve el repositorio completo. `INTERACTION_AUDIT_PORT` permite otro puerto de loopback. No se incluye en Hosting.

Controles: Confirmación (Cancelar con Enter, Tab, Escape), Ventana con lista (scroll, confirmación anidada, maximizar/restaurar/cerrar), Diálogo nativo (confirmación interior) y Comprobar reposo. Restaurar el tamaño normal del navegador y volver a SisVentas al terminar. `test/fixtures/interactions.html` contiene solo datos ficticios.

## Próximos recorridos, por prioridad

1. Repetir rueda, gestos y teclado virtual en un dispositivo físico; comprobar Actualizador minimizado/restaurado sin iniciar un lote real.
2. Carteles críticos y menús flotantes junto a formularios: revisar sus portales/capas propios, no suprimir alertas como arreglo general.
3. Recorrer formularios particulares de Ventas/Presupuestos, Comisiones, Compras/Distribuidora, OT/Relevamientos, PDF/Gastos personales y Administración. Preparar fixtures para operaciones que escriben; no probar sobre datos reales.
4. Rotación, cambios de ruta, respuestas tardías y repetición de abrir/cerrar en esos consumidores. Registrar por pantalla lo probado y lo pendiente.

Publicar esta candidata requiere la autorización de su alcance y el proceso de Hosting habitual. Las correcciones comunes no cambian cálculos financieros ni amplían permisos.
