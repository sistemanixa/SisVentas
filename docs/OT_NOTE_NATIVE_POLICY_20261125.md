# Notas OT: adaptador de servidor para el wire vigente

Base c6045073. Archivos propios: cotizador/ot-note-native-policy.js y test/ot-note-native-policy.test.cjs. Sin cambios en Gateway, cliente, MetadataPolicy/Model, Guard, Store, runtime, Docker o Rules. El principal incorpora el hook y su cierre de dependencias.

## API exacta

`await require('./ot-note-native-policy').prepare({actor,lease,body,patch,scope,now})` devuelve `{patch,notePath,canonicalNote}` congelado. `now` admite reloj de servidor o instante numérico; por defecto Date.now. Debe llamarse dentro de Guard, con su scope/lease reales y el mismo actor mutable de esa ejecución. Requiere mode user, opId y transportDigest ligados al body literal y lease. No modifica body, actor.input, uid, opId ni digest.

El caller decide la instalación mediante la admisión real de cohorte; únicamente ON admitido llama a este adaptador. OFF conserva el circuito preexistente. Este módulo no usa un booleano de cliente como autoridad ni acredita instalación: exige además sv_ot_metadata_config schema1/ready/generation del servidor. Un error no es OFF ni autoriza fallback. Con cohorte ON, un intento que toca notas pero excede este contrato debe rechazarse, no caer al escritor genérico.

Wire exacto conservado: `{id,kind:'atomic',path:'',value:{[notePath]:after},expectedHashes:{[parent+'/id']:hash(ot.id),[notePath]:hash(before)}}`, donde parent es sisventas/ordenes_trabajo/OT y notePath parent/notasTecnico/N. Un único valor y exactamente dos hashes; sin purpose, cambios adicionales, reemplazo de OT ni precondiciones extras. OT/N usan las claves aceptadas por MetadataPolicy (hasta128 caracteres); los ids habituales del cliente cumplen ese límite.

`patch` de entrada es el parche RAW de la petición, idéntico a body.value. `patch` devuelto contiene únicamente notePath canónico y parent/audit derivado de ModelMetadata.plan. El caller ejecuta scope.update(plan.patch) y devuelve del callback de Guard sólo un ACK mínimo, por ejemplo `{ok:true,committed:true,operationId:body.id}`. **No devolver canonicalNote del callback de Guard**, para que el recibo no duplique la nota.

## Autoridad y conservación

Lee el parent original por scope.getAsUser, reusando el cache nativo para las proyecciones. Valida identidad y CAS, rol/permisos mediante Model.authority('note'), reset de acceso, directorio y asignación técnica. El fallback de asignación por nombre exige consulta acotada inequívoca mediante ot-personal-scope; claves de empleado tienen prioridad. Las consultas se reutilizan sólo dentro de cada fase, nunca en un cache global.

Model.plan deriva la nota y auditoría con UID, nombre del directorio y fecha del servidor. Nueva nota admite los campos del wire actual; autor/rol/_firebaseKey declarados deben coincidir con la identidad autorizada, timestamp no es autoridad y se reemplaza con el instante del servidor. Se añade autorUid y se deriva _firebaseKey de N. Campos UID ajenos o extras se rechazan.

Editar sólo cambia texto: el resultado fusiona el RAW before con el texto validado por Model. Conserva todos los demás campos, incluidos autor, fecha, ts, UID ausente, fotos, _firebaseKey histórico distinto y metadatos desconocidos. MetadataModel mantiene su autorización de autor para técnicos. Eliminar exige un original objeto real; false u otros escalares legacy no se reinterpretan. Una auditoría legacy no-array requiere revisión y no se sustituye por un array nuevo.

Se adjunta una capacidad genuina Policy.issue(kind note), se cambia actor.operation a ot-metadata y se actualiza su contexto de permisos. beforeCommit comprueba capacidad por identidad/token genuino, wire/actor intactos, lectura autorizada fresca del original completo, permisos/configuración/directorio/reset y asignación. El CAS interno del parent protege la auditoría y el origen de las proyecciones ante cambios concurrentes; no añade un hash de parent al wire del cliente. No hace commit ni reintentos.

`canonicalNote` es efímera para el caller, incluida null en eliminación. La autoría/fecha nuevas pueden diferir del after del cliente: no alterar body ni su digest para sustituirlo. Si el principal necesita sincronizar la copia local del cliente, debe hacerlo fuera del recibo; un replay no vuelve a ejecutar prepare, por lo que entonces la nota canónica debe obtenerse del servidor autorizado.

## Evidencia y límites

81 pruebas focales PASS (64 del adaptador +17 Metadata existentes), ejecutadas por main. Guard y REST Store reales con datos ficticios; protección física por constructor tanto OFF por defecto como ON. Cliente writeOTNote y hash reales, Recovery y resolver genérico reales: perder ACK produce un POST, un commit y una auditoría; consultar no reenvía ni almacena la nota en el recibo. Rechazos por capacidad clonada, autor/UID forjados, rutas extra, CAS obsoleto, rol/permisos/directorio/reset revocados, asignación por clave/nombre alterada y originales escalares. Sintaxis y diff-check correctos.

Log privado C:/SisVentas/tmp/ot-note-native-policy-main-20261125.log. No prueba de montaje Gateway/HTTP completo, emulador, Rules, CodePins, despliegue o habilitación de cohorte. El principal debe incorporar esos pasos; no se modificó producción.
