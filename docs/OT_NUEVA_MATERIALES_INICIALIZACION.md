# Inicialización acotada de materiales nuevos de OT

Cambio exclusivo en `js/modules/ot-workflow.js`, entrada
`crearRegistroOTSeguro`. No modifica aplicación, índice, reglas, transporte,
autoridad de servidor ni estados financieros. No es migración de históricos.

Se agregan `entregada: 0` y `devuelta: 0` sólo a la copia de una fila con
`instalada === 0`, cantidades vendidas numéricas positivas y coherentes, sin
campos previos de entrega/devolución, custodia, stock, rendición o recuperación.
Si ya existen esos campos, incluso en cero/null/false, se conservan exactamente.
Una fila recuperada o con procedencia histórica no se completa. Tampoco se infiere
la instalación si falta, es nula o está expresada como texto.

El contenedor debe ser una alta sin identidad previa (`id` incluido), revisiones,
custodia, stock ni `items` históricos; estado ausente/pendiente y progreso
ausente/cero. Una auditoría presente debe identificar creación/generación sin
movimientos. **Un número comercial preasignado no demuestra novedad**: también
excluye la inicialización. Esto es deliberadamente conservador y no desbloquea
una entrada histórica ambigua sólo porque se la copie para crear otra visita.

No se cambia ninguna cantidad, costo, precio, destino, evidencia ni unidad.
Se clona antes de inicializar. El resultado devuelto combina el registro enviado
con la respuesta efectiva de persistencia, conservando revisiones/operación que
devuelva el escritor, sin fabricar recibos. Los llamadores que mantienen su objeto
nuevo reciben una copia independiente de los materiales inicializados sólo tras
confirmarse el guardado. El resultado, el objeto del llamador y el array de origen
no comparten filas. Un error de copia no recurre a una copia superficial.

La compatibilidad de número/fecha del objeto nuevo también se actualiza después
de confirmar, para no modificarlo cuando la persistencia falla o no devuelve
clave. Una entrada con identidad previa permanece intacta. `evitarDoble` conserva
su misma promesa, una reserva de número y un único guardado concurrente.

## Verificación

`test/ot-new-material-initialization.test.cjs`: siete pruebas propias, incluyendo
matrices de identidad, cantidades previas, stock/custodia, filas recuperadas,
fallos, creación concurrente y fallback de push. Carga el creador real, los
wrappers y el gateway/H7 reales con datos ficticios; luego ejecuta
`cambiarTecnicoOT` extraída de la aplicación activa. Confirma alta y asignación,
dos comandos/commits, auditoría posterior, ceros explícitos, fuentes intactas y
ausencia de remito o recibo de stock inventado.

Node `v22.23.4`: **40 PASS, 0 FAIL, 0 SKIP** junto a identidad/comisiones,
enrutamiento OT y los dos flujos de Reclamos. `node --check` y
`git diff --check -- js/modules/ot-workflow.js`: PASS. Se normalizaron a LF los
finales mezclados del módulo para retirar los avisos de trailing whitespace.
Log privado: `tmp/ot-new-material-initialization-final.private.log`.

No se ejecutó otra puerta global: queda a cargo de la integración congelada.
La prueba de gateway usa la autoridad disponible en este checkout; no reemplaza
la validación posterior con el estado estricto `pristine` de Costos cuando se
integre su propuesta separada. Los faltantes históricos se preservan para que
esa autoridad los siga rechazando, sin una excepción nueva en servidor.
