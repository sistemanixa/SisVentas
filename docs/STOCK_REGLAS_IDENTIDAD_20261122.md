# Reglas actuales e identidad histórica: revisión incremental

## Evidencia privada y alcance

Se leyó únicamente la copia autorizada por coordinación, sin GETs adicionales ni datos comerciales. Archivo privado3576401bytes, SHA256ea197750dc668aedffc5e182dd6a6e7fd6e939279690cf4a8077ac4cd975f3db. No se copia el archivo ni sus expresiones grandes a Git/documentación/logs. Se inspeccionaron las ramas y ancestros indicados a continuación; no se aplicaron reglas ni permisos.

| Ruta/regla | SHA256 de la expresión | Hallazgo |
| --- | --- | --- |
| sisventas/.write | fcbcf165908dd18a9e49f7ff27810176db8e9f63b4352213741664245224f8aa | literal false; no concede escritura por sí sola |
| sisventas/$dominio/.write | b60a9fc34cb6d7e52bdd7fd1c82c40dd1c65349ac525d8845d74b921ae6829cf | contempla inventario entre dominios operativos; rama de usuario condicionada por ausencia/caducidad de guard |
| sisventas/inventario_operativo/$record/.write | a00e4abc5a8ceb04209199e73e63c193dafd3ee8ebc51950cae9fbc79485157b | contiene autorización SDK condicionada por ausencia o caducidad de sv_labor_guard, y ramas de servicio/fence |
| sisventas/inventario_operativo/$record/.validate | a8fd05b2e492b37de29cf2ccc1b9680e5e29e3f7249ff515c91c5bee0365eca8 | capacidad Stock, clave física autorizada y lease/fence; no asociación nueva |
| sisventas/productos/.write | 83acf1ca747e19f057fab3c4f4ca03776484704135646e1d20d51439d185530a | permiso de catálogo, sin referencia a sv_labor_guard en esta expresión |
| sisventas/productos/$producto/.write | 607fa8d381eaf80fd86c7944d9c812044ac8b941fae58fe4cccf2771f4cdf637 | permiso puntual; tampoco presenta fence de inventario |
| sv_labor_guard/.write | b20d34eab00d51c00c6e082f76fd7a938af6df480b09ecf490782acee518fcc9 | lease/servicio y versiones de circuitos; no modificar desde este frente |

Son hallazgos estáticos, no resultados de emulador. La evaluación completa de ramas, wildcard, claims, validadores y caducidad debe probarse sobre la copia íntegra; no se afirma un permiso sólo por encontrar texto ni se presume que un veto hijo revoca un permiso padre.

## Corrección del diagnóstico anterior

La primera carrera de bde5dc96 usa un SDK ficticio sin reglas y NO demuestra que la escritura SDK esté permitida durante un lease vigente con las reglas actuales. La regla de inventario sí muestra una barrera contra esa rama de usuario mientras el guard está activo. La prueba sigue sirviendo como contraejemplo cuando se omite la barrera, no como prueba de explotación de producción.

La segunda carrera sigue describiendo el problema funcional pendiente: una vez terminado el lease, un escritor antiguo puede volver a resolver la clave canónica e ignorar el mapping. Cambiar sólo Stock o añadir un campo lock no corrige ese escritor. También falta demostrar en emulador la estabilidad del catálogo durante el commit, porque sus reglas de escritura inspeccionadas no usan el fence de inventario. No dar por suficiente el GET final de catálogo frente a una escritura posterior a ese GET.

La propuesta de ingreso único de Compras es una opción segura de migración, no una necesidad deducida únicamente de que no existiera fence. El coordinador/A deben comparar un portado de todos los SDK con validadores de mapping + fence ya existente frente a migrar comandos; ambos requieren cerrar clientes antiguos y catálogo concurrente sin ampliar autoridad. No hay interfaz habilitada mientras no se pruebe ese corte.

## Ajuste de contrato solicitado por D

Resolver y plan ahora mantienen receiptIdentityKey separado de productKey e inventoryKey. Ese valor proviene de evidencia autoritativa histórica, nunca de una normalización nueva ni del comando cliente, y forma parte del hash CAS y de ambas direcciones de asociación. Si cambia respecto del mapping existente se bloquea. El loader deberá demostrar que la identidad es única y respaldada; historias contradictorias se concilian, no se elige un alias arbitrario.

No se toca stockRegistro, identidad OT/fila/venta-destino/origen, firmas, remitos o digests existentes. La asociación L no cambia un byte del ledger. Entregas/instalaciones/correcciones/devoluciones posteriores sí pueden evolucionar rendicionesOT por sus comandos normales. Resolver no reescribe esas operaciones.

Antes de consumidores incluir los sitios adicionales de D: rama de retorno de ot-lifecycle que construye inventario directo; receiptHash fallback; legacyReceiptIdentity de ot-material-state; heldByOthers y grupos por inventario físico+asignación, resolviendo aliases antes de filtrar; revalidación en ot-delivery-commit-protocol sin relajar el guard.

Matriz a implementar con consumidores y barrera real: L-D-I frente a D-L-I; D-I-L conserva bytes enL; D-L-R conserva reserva original; D-I-corrección-L-R frente a D-I-L-corrección-R; D-R-L-I sin nuevaD rechaza; respuestaD perdida-L-replay original unavez/mismo remito. No se presenta esta matriz como ejecutada todavía.

## Verificación de este incremento

34PASS:28modelo/resolver (incluida identidad histórica distinta de ambas claves),2SDK con doble sin reglas,4riesgos de consumidores actuales. Sintaxis/diff correctos. No navegador, emulador, servidor, cambios reales o reglas remotas. Esperar el informe de hooks/A antes del comando ejecutable; consumidores/UI aún no habilitados.
