# Guard personal ante primera entrega vacía · rojo real40d

Fuente roja40d955fba895e21ee61fd793b2add7896810baf8, app activa3.19.4. Al montar el contexto autorizado de los retornos apareció TypeError:Cannot read properties of null(reading salesAuthorMonthlyComplete). El host puede tener authority=current mientras status=loading/error y data=null; el renderer dereferenciaba data antes de comprobar la capacidad. No es un error de endpoint ficticio.

Reproducción entregada antes de cambiar producto: tmp/personal-current-empty-product-red.private.log y test/dashboard-personal-current-empty.test.cjs. Matriz posterior preservada sobre app congelada40d:loading/current yerror/current rojos, idle/retired verde. Mismos tres casos con candidato corregido:PASS; junto a renderer personal/últimas y cinco reproducciones previas:14PASS. Logs tmp/personal-null-40d-red.private.log y tmp/personal-null-candidate-green.private.log. El adaptador privado sólo cambia la fuente de app leída para repetir40d, no cuerpos/expectativas.

Cambio funcional mínimo: acceso opcional a data en dos predicados, monthly ylatest. Sin objeto{}fabricado, default0, lecturas legacy ni red. Datos faltantes siguen pendientes; retiro conserva la retirada. El hunk es aplicable al renderer idéntico de app3.19.3 de root y app3.19.4 candidata; no editar originales congelados40d/67. Este checkout aislado sólo propone corrección posterior.

Entregar este commit separado del harness H7/retornos. Se requiere rehash/revisión del nuevo paquete tras cualquier importación funcional; el manifiesto40d permanece como antecedente, no se etiqueta vigente para la app corregida. Sin push, producción ni cambios remotos.
