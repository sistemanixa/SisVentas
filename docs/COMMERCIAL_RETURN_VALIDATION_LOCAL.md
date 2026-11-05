# Retorno a lecturas comerciales completas · local

Base `05be68ac4cbc92feb0318b849449d80bb4a48a9e`. No cambia pagos, comisiones, stock, permisos del servidor ni registros originales. La copia aislada no se sirve todavía en la ventana humana y no modifica los paquetes congelados.

Al alternar entre la lista paginada y una pantalla que necesita la colección comercial completa, `stopDomain` eliminaba su representación y ETag. Al volver, la nueva suscripción no podía validar esa representación y volvía a recibir/interpretar el JSON completo.

La corrección conserva como máximo dos representaciones **sólo en memoria**, Ventas y Presupuestos, de hasta ocho millones de caracteres cada una. No se muestran ni se entregan a `cachedRecords` hasta recibir una respuesta autorizada vigente: 304 confirma la representación; 200 instala la nueva. No hay persistencia, timer ni lectura periódica nueva. Una respuesta anterior, un fallo de red o la mera existencia del caché no acreditan disponibilidad.

El validador queda ligado al objeto de autenticación, usuario, rol, revisión de permisos, base, servicio y generación de sesión. Fin de sesión, revocación y acuses confirmados descartan los validadores retenidos. La comparación monotónica de acceso rechaza un 304 ya pendiente si otra petición revoca el dominio. Los acuses de escritura/eliminación durante un retorno pendiente programan una reconciliación nueva para completar la fuente, sin repetir la operación de negocio.

## Verificación

- Reproducción inicial: 2 PASS / 1 FAIL, log `commercial-return-cache-before.private.log`, SHA256 `f3a670ed554078f35c88f09f25f7820472c4640ca0778808078f51bcb02fe24a`.
- Los mismos seis casos ampliados contra la fuente original: 4 PASS / 2 FAIL, log `commercial-return-cache-baseline-final.private.log`, SHA256 `4f4e72aabde2382ca0336d98749ab6bd90049e22a0356d9f038a47e35d23188b`. El selector de fuente es sólo una variable de test; no cambia expectativas ni código productivo.
- La revisión independiente encontró dos carreras, preservadas en `commercial-return-cache-review-before.private.log`, SHA256 `491629642ec66b4c214b4f460c22baf26eb2976257c12798bed99dd08317c325`. Ambas se corrigieron y se añadieron variantes para Presupuestos y eliminaciones.
- Suite focal final de propiedad, sesión y retorno: **41 PASS / 0 FAIL / 0 SKIP**. Log `commercial-return-cache-final-reviewed.private.log`, SHA256 `5948995f2fff9a9a46f9c9f47d10683f13879a5cf0c768063398471961d658e0`. La revisión independiente informó 49 PASS en su selección superpuesta; no sumar ambos conteos.
- Regresión adicional: 135 PASS / 1 FAIL por transporte loopback bloqueado en el entorno restringido. El archivo de transporte se repitió con loopback habilitado y pasó, sin modificarlo. Ambos logs se conservan: `commercial-return-cache-regression.private.log` y `commercial-return-cache-transport-allowed.private.log`. No reetiquetar la corrida restringida como exit 0.
- Casos sintéticos con 1.095 registros: una segunda lectura autorizada 304 no interpreta otro cuerpo JSON; no hay replay antes de la respuesta; cambios de identidad, permisos, base/servicio y revocaciones no recuperan datos retenidos. Se prueban respuestas tardías, acuses durante validación, cancelaciones repetidas, presupuesto idéntico con 200 y límite de memoria.

## Límites de la mejora

El backend existente puede seguir leyendo sus fuentes para calcular el ETag. Estas pruebas demuestran la reutilización autorizada y la reducción de payload/parseo del cliente en el fixture, **no ahorro de lecturas RTDB ni una medida de facturación o latencia productiva**. No se sustituyen colecciones completas por cincuenta resúmenes ni se cambia su clasificación financiera.

Falta integrar con el arreglo del buscador, usar una referencia de módulo nueva coherente con índice/SW y ejecutar las pruebas conjuntas y visuales de la fuente final. La puerta anterior de los paquetes congelados no se atribuye a este delta. No hay publicación, push, recarga ni prueba con operaciones reales.
