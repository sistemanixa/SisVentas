# Integración local v3.19.5

Estado final: integración local verificada sobre la fuente funcional congelada
`76a549ff989abd00f594fb700692448791fe7601`. Publicación y push detenidos.
Este cierre documental no cambia los activos probados ni recarga la ventana.

Comprobación productiva posterior: la publicación exacta quedó bloqueada por
las capacidades nativas ausentes de Cobranzas. La evidencia local no cubría
ese estado del backend publicado. Ver
PUBLICACION_OFF_V3195_BLOQUEO_COMPATIBILIDAD.md. No se publicó ni se activaron
índices para sortear el bloqueo.

Base compatible: `05be68ac4cbc92feb0318b849449d80bb4a48a9e`.
Rama: `codex/integracion-circuitos-local`. La ventana 8765 y la candidata
3.19.4 con activaciones pendientes permanecen intactas. No hay autorización
vigente de publicación en este bloque, ni se modifican datos reales.

## Componentes reunidos

- Retorno comercial: ef213218, validación autorizada antes de reutilizar una
  representación completa; no usar una página como historial completo.
- Selector de venta en Cobros: 2ea3ddde, agrupación de pulsaciones y cancelación
  al limpiar, salir o perder acceso; mantiene el formulario sin guardar.
- Búsqueda de Ventas: 92479e43, coincidencias locales provisorias, consulta
  histórica acotada y tarjetas financieras independientes del texto.
- Comisiones personales: 93511fc9, filtros sobre columnas autorizadas sin
  modificar importes, generación ni aprobaciones.
- ARCA: 95f7dbde, período común y distinción entre pendiente, error y vacío.
- OT: c928ec9f, preparación de entrada retirada si comenzó otra apertura.
- Resúmenes: 55467d9a, una construcción económica por llamada; sin caché
  persistente, cambio monetario ni aumento del umbral temporal.
- QA: 1d02878c + c8492449, cadena sobre una sola base sintética; dfc9698e
  clasifica individualmente los 81 fallos del intento anterior.
- Contrato RAW: herramientas de b6488617, prevalidación anterior a credenciales
  y compresión. Nunca se ejecuta el publicador con `--apply` en este bloque.

Los conflictos de integración fueron documentales en CONTEXTO_ACTUAL; se
conservaron ambos informes. El delta ARCA y el de OT se unieron sin conflicto.
La aplicación histórica 3.19.3 se conserva; sus cambios pasan a la nueva
aplicación inmutable 3.19.5. Índice, marcador, Novedades y caché del worker
concuerdan, y los seis módulos modificados reciben URL nueva. Accounts e
Historial conservan sus activaciones OFF; no se activan servicios pendientes.

## Evidencia preliminar, antes del congelamiento

51 pruebas focales conjuntas PASS. Cadena completa sintética PASS con 14
commits coordinados en memoria y reintentos sin duplicación. No equivale a
formularios reales ni a una copia exacta de los registros actuales.

Prueba nativa conjunta: 16 PASS / 4 FAIL; los cuatro fallaron al lanzar un
Chrome inexistente por faltar SV_CHROME_PATH. Repetición de ese archivo con
la ruta instalada: 4 PASS. Se conserva el intento fallido; no se convierte
retroactivamente en verde. Los otros 16 recorren ARCA, Ventas y Cobranzas en
escritorio/móvil, con datos ficticios. La integración final debe repetir las
pruebas sobre los bytes congelados.

Pendiente en esa etapa: puerta vigente completa de la fuente conjunta final, prueba de
upgrade del worker y binding RAW; luego aceptación de este bloque local.
Los resultados de ramas individuales no sustituyen esa puerta. Las pruebas
opt-in omitidas y los límites de cobertura se informarán expresamente.
No implica permisos remotos, corte, publicación, push ni operaciones reales.

## Primer congelamiento y corrección de integración

Fuente `fdd161713870a951542f47cab26e2445dc7af43d`: RAW 624 archivos,
20.788.008 bytes. Upgrade SW real 2 PASS en 390/1280, con carga online y
probe estático offline de cinco módulos y rechazo de query desconocida.
El primer ensayo SW 0/2 se conserva: el arranque del fixture activaba Accounts
pese a probar OFF. Se agregó una opción ficticia con el valor por defecto
anterior; el ensayo OFF la fija en false. No se cambió el producto por ello.

La puerta completa de esa fuente terminó exit1: 9598 casos, 9552 PASS,
15 FAIL y 31 SKIP. Catorce contrastes de igualdad de modelos encontraron
LF público frente a CRLF de las copias del servidor; además faltaba llevar
la optimización canónica al modelo empaquetado de ventas. No se relajaron
comparaciones ni se reetiqueta ese resultado como aprobado. Log privado
current-gate.private.log SHA256
6ce31dd28cf14c1ddb3d4e56557df49ccc37b68681d99b5cc1fa1765fa79dc70.

En `17ae4151a373d5161fe585801bf013eeac350141` se alineó la copia local del
servidor con el modelo canónico. Después se materializaron los 3017 inputs
tracked desde los blobs RAW de ese commit, no desde expectativas de pruebas.
Los 15 archivos que fallaron pasaron 275/275; el contraste compartido previo
también pasó 96/96. Son focales superpuestos, no una nueva puerta completa.
No se actualizó Cotizador. La siguiente fuente conjunta debe incluir además
la corrección de intención de búsqueda antes de repetir gate y aceptación.

## Cierre de la fuente funcional exacta

Se incorporó `675275a1`: un repintado de otro consumidor ya no inicia una
consulta del texto anterior durante el debounce. La revisión del borrado de
texto/espacios no reprodujo ese defecto con el manejador real: actualiza el
filtro de forma inmediata. Dos casos adicionales de contraste pasaron sin
otro parche; no se cambió el producto para satisfacer una simulación incompleta.

| Verificación sobre 76a549ff | Resultado |
|---|---:|
| Puerta vigente completa, incluido catálogo en navegador | 9604 casos: 9573 PASS, 0 FAIL, 31 SKIP |
| Los mismos 31 casos opt-in ejecutados aparte | 31 PASS, 0 FAIL, 0 SKIP |
| Upgrade SW real y arranque/retornos OFF con 1096 ventas ficticias, 390/1280 | 4 PASS |
| Cadena sobre una única base histórica sintética | 1 PASS |

Los 31 casos omitidos por la puerta son 27 de runtime financiero, dos de
admisión SDK, uno de métricas y uno de retiro de editor. Se ejecutaron todos
sobre la misma fuente, con Node22.23.4; no se suman los focales superpuestos
como circuitos nuevos. Emuladores exclusivos 9017/9067: namespaces ficticios
vacíos y procesos propios detenidos. Las pruebas de UI cerraron sus navegadores
y servidores; la ventana del usuario quedó intacta.

Se inspeccionaron las capturas oscuras de 1280/390. El recorrido OFF comprueba
50 filas, búsqueda histórica, detalle y Volver, Dashboard/Notificaciones y
retorno, sin relectura de tarjetas por texto y con deuda histórica exacta.
No aporta una notificación individual; las fuentes/iconos externos del fixture
están bloqueados. No equivale a validación de cada formulario o de producción.

El contrato público versionado es INTEGRACION_CIRCUITOS_V3195_MANIFEST.json:
624 archivos, 20.788.370 bytes, SHA256
`8bb02fa24cb2b27f7bf70a13380fc04f2a08df3c4b6765ebe55e246ffa672294`.
Los 3021 inputs RAW completos antes/después tienen el mismo SHA256
`7e802350b173712c18f48169ce48e66f50323f469134df202a49e9fef536b7d7`.
No se normalizaron bytes para aceptar ni se cambiaron expectativas.

Evidencia privada conservada bajo tmp/integracion-circuitos/76a549ff:

- current-gate-final.private.log:
  `4b7824f8612745241bca515e5f503085f28b8a01ddbb16b8d44920513b4b6a36`.
- native-final.private.log:
  `14be39c4325c5a8854e1cbe52f7a6404fbd51ecb3db08073229e8227f3c303c7`.
- chain-final.private.log:
  `5d0bdc77651ff37393171edb30ad6b717589f20d9711c8561ece852993157507`.
- qa-optin31-evidence.private.json:
  `394155f4acbf39cfd71fd8960453c0a26061732f4cf712ea16779031066c6a99`.

Los rojos y ensayos intermedios permanecen separados. No se publican logs,
reglas privadas, perfiles ni datos. La baseline de reglas del emulador es
histórica local: no certifica reglas remotas actuales. Las cardinalidades y
formas sintéticas no equivalen a los registros, adjuntos o payloads reales.
Los tiempos de fixture no acreditan latencia productiva ni ahorro de RTDB.

Quedan fuera de este cierre: activar la candidata 3.19.4 ON o sus lectores
dependientes de preparación remota, publicar la web, actualizar Cotizador,
modificar reglas/índices/flags productivos y respaldar mediante push. Se
mantienen detenidos según la última instrucción; no se presentan como aplicados.
