# Adjuntos y carga común · 25/11/2026

`agregarFotosEquipo` y `agregarFotosRel` devuelven ahora la Promise de preparación completa (compresión/FileReader), sin cambiar el formato adjunto_base64 ni escribir al seleccionar. Limpian el input como antes. Puesto que el puente genérico excluye inputs file, estas funciones invocan explícitamente `SisVentas.carga.ejecutarAccion` con mensaje Preparando imágenes y clave de input; doble selección pendiente comparte operación. Si falta el helper se conserva la función con Promise.

`guardarRelevamiento` y el hueco contiguo `subirFotosEquipo` devuelven su Promise hasta todos los ACK y usan el mismo helper de actividad. Doble invocación pendiente por equipo comparte Promise y no duplica Push. Los campos, rutas, método, autor, fechas y fotos permanecen con el esquema anterior. No se cambia SDK por servidor ni a la inversa, no se añade permiso ni transporte.

Antes de aplicar previews/resultados locales se comprueban UID, identidad Auth, rol, epoch y equipo originales; un input reemplazado no recibe la preparación vieja. Un ACK antiguo no limpia el borrador de otro equipo ni abre su ficha. No se cancela ni reenvía una escritura que ya salió. Error conserva borrador y notifica como antes en el contexto vigente.

8 pruebas puras PASS con FileReader/ACK controlados: Promise completa, dedupe, formato, sin selección/formato inválido/helper ausente, cambio de rol/equipo/input, campos exactos de intervención/fotos, ACK tardío y rechazo. Syntax/diff PASS. Sin datos reales ni reglas remotas.

Límite conservado: guardarRelevamiento ya usaba Promise.all de Updateestado y Pushintervención independientes; este cambio no transforma esas dos escrituras en transacción ni promete atomicidad nueva. La emisión/validación de negocio existente no se altera. Root integra el módulo en su versión nueva y repite su QA global de carga común; esta evidencia no equivale a recorrer los formularios reales de equipos.
