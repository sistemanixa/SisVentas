# Integración local v3.19.5

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

Pendiente: puerta vigente completa de la fuente conjunta final, prueba de
upgrade del worker y binding RAW; luego aceptación de este bloque local.
Los resultados de ramas individuales no sustituyen esa puerta. Las pruebas
opt-in omitidas y los límites de cobertura se informarán expresamente.
No implica permisos remotos, corte, publicación, push ni operaciones reales.
