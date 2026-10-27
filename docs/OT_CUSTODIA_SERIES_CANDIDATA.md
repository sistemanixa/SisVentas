# Custodia de materiales por serie

## Interfaz de custodia implementada, sin activar · 27/10/2026

Después de publicar15.8 se continuó trabajo autorizado en la candidata amplia.
Nuevo js/modules/ot-unit-custody.js: diálogo centrado con scroll propio, una
serie y lector por unidad, selección explícita de devolución/recepción y mapeo
histórico confirmado sólo por admin. Usa nodos/textContent; sin JSON visible.
No guarda al escanear; valida series repetidas y acuses de exactamente las
unidades elegidas. Actividad visible, doble clic bloqueado y espera de acuse;
Cancelar/Enter no confirma, Tab conserva foco y se retiran lecturas/lector al
cambiar contexto. Conserva datos del formulario ante fallo de servidor.

Rutas /ot/custodia/preparar y /confirmar enlazadas únicamente en código candidato.
Servidor exige laborScoped + OT_UNIT_CONFIRMATION_ENABLED + OT_UNIT_CUSTODY_ENABLED;
cliente exige SV_OT_UNIT_CUSTODY_ENABLED===true. Ningún flag remoto se cambió.
La disponibilidad del cliente no otorga permisos: endpoint/reglas verifican
identidad, OT, acción vigente y guard. Sin consultas periódicas ni infraestructura.

18pruebasUI +12endpoint +26modelo =56focalesPASS. Cuatro recorridos navegador
320/390/768/1280PASS, sin solicitudes comerciales externas/escrituras reales;
cinco series,4/5bloqueado, duplicado de lector, Cancelar conEnter, dobleclic,
espera de acuse y recepción sólo de una devolución. Imágenes móvil/escritorio
inspeccionadas; lector simulado, cámara física no probada.94servidorPASS.
Puerta final8.084total/8.057PASS/27opt-in/0fallos,53,30s; sintaxis/diff y versión
local15.7 correctos. No confundir esta candidata con la productiva15.8.

No se añadió aún acceso al flujo normal de materiales: primero falta integrar
instalación, equipo/garantía y consumo de stock en el mismo commit, conservar
las series al preparar instalación y proteger escritores agregados antiguos.
No habilitar los flags ni reemplazar guardados financieros para omitir ese trabajo.
Sigue también preparación/cobertura/drenaje y candidata exacta del corte amplio.
Producción15.8 conserva pagos/permisos/comisiones previos. Segmentación se trabaja
en otro checkout coordinado; no se editaron aquí esos contratos ni sus archivos.
Evidencias privadas tmp/priority3157/custody-browser y logs custody-ui-*, fuera de Git.
