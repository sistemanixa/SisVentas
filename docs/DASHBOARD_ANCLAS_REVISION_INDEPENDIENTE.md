# Revisión independiente del reuso de anclas

Se inspeccionó el lector integrado en el árbol local de root sobre HEAD `ee46d78edbcad865a09b159dbac325b9cf25903a`, con WIP ajeno presente. No se editó root ni se asumió que ese WIP estuviera confirmado. El lector, normalizando sólo CRLF/LF, coincide exactamente con la entrega de anclas de `6eed87a9`.

Confirmaciones estáticas y cinco pruebas sobre copia del lector integrado:

- `anchors`, `evidence` y `read` se crean dentro de cada invocación a `read(req,domain)`, en el bloque opcional latest. No hay estado de anclas en el módulo ni en la instancia del lector.
- Las dos anclas se copian profundamente desde cobertura/total capturados B0. Cada acceso del helper recibe una copia nueva. Mutar una devolución no modifica B0 ni accesos siguientes.
- El B0 y el B1 exterior usan `raw` real, no el adaptador con anclas. Se conservan **dos lecturas frescas** por petición de cada path total/cobertura. Dos peticiones tienen cuatro lecturas del total y observan cambios reales entre ellas.
- El grupo exacto se consulta y reconsulta; hasta cinco filas seleccionadas se consultan y reconsultan. No se excluyó ninguna de estas evidencias de su replay independiente.
- Total/cobertura cambiados durante grupo o fila provocan rechazo de la respuesta exterior. Grupo/fila cambiados a igual revisión provocan latest incompleto, sin falsear el contador.

Resultado sobre integración copiada: **5 PASS, 0 FAIL/SKIP**, log privado `tmp/sdk-proof/creator-latest-anchor-review-integrated.log`. No hallazgo adicional de caché cruzada ni pérdida de B1 en este alcance.

## Interacción con igualdad por campos de creatorOrder

El helper presente al inspeccionar todavía usaba `JSON.stringify` para comparar `creatorOrder`; objetos equivalentes provenientes de RTDB pueden tener otro orden de propiedades. La prueba nueva `test/dashboard-creator-order-anchor-interaction.test.cjs` reproduce ese caso: **2 PASS / 1 FAIL** antes, sin modificar root.

Se ensayó únicamente en copia privada reemplazar esa comparación por igualdad estricta de `schema`, `rawDate`, `loaderTime`, `loaderTs`, conservando además exactamente cuatro propiedades. Ese experimento, las cinco pruebas de anclas y las once del helper dieron **19 PASS, 0 FAIL/SKIP**. Cambiar cualquiera de los cuatro valores sigue rechazando el punto. No se entrega ni aplica ese cambio funcional, que prepara Costos; esto demuestra compatibilidad del mecanismo, no certifica un parche futuro aún no recibido.

Los hashes usados por el replay y el B1 exterior son canónicos: ordenan las propiedades antes de calcular el digest. Ya consideran iguales dos `creatorOrder` con mismos valores y diferente orden de claves; un cambio en cualquiera de sus valores cambia el hash. Por eso la corrección semántica del helper no requiere modificar ni retirar las verificaciones de anclas/grupo/puntos. No conviene sustituir esos hashes por `JSON.stringify`.

Logs privados: `tmp/sdk-proof/creator-order-anchor-before.log` y `creator-order-anchor-semantic-experiment.log`. La prueba nueva debe ejecutarse con el parche real de Costos para validarlo; antes de ese arreglo conserva intencionalmente el caso fallido conocido. No importar como gate verde hasta contrastar ese cambio concreto.

Sin cambios funcionales, capacidades nuevas, edición de root, navegador, datos reales ni despliegue. La entrega contiene sólo esta documentación y tres pruebas de interacción.
