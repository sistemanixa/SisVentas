# Preparación de Cuenta corriente y Cobranzas nativa

Estado: local, sin activación. Las herramientas siguientes no tienen red ni
escriben Firebase. Sus resultados contienen información privada derivada y se
conservan únicamente en `tmp/`, nunca en Git.

## Preparación emparejada

`scripts/lib/client-account-preparation.cjs` recibe siete fuentes completas
explícitas: ventas, cobros, presupuestos de origen, directorio de clientes
(clientes, unificaciones e índice), usuarios, identidades activas y permisos. No obtiene registros de las
primeras 50 filas ni de una caché de pantalla. Requiere generación nueva y revisión
uno. Usa los modelos reales de cuentas, listado comercial, pertenencia de pagos
y responsables; no modifica los originales de entrada.

El artefacto contrasta cada contribución financiera y la deuda completa entre
los dos índices. Clientes unificados conservan una cuenta y un deudor; no se
modifican nombres históricos para conseguirlo. Incluye evidencia de responsables
con contadores actuales y ámbitos vacíos sólo para identidades activas,
inequívocas y habilitadas. Los alias históricos no resueltos siguen siendo
evidencia, no se asignan a un usuario por semejanza. Si una venta sin responsable
resuelto tiene UID o alias candidatos de una cuenta actualmente habilitada, se
rechaza toda la preparación con SV_CLIENT_ACCOUNTS_OWNER_REVIEW: ni cero falso
ni cuenta parcialmente completa. El mensaje expone sólo el problema y la cantidad;
privateReview conserva referencias para diagnóstico privado local, fuera de Git.
No se borra un índice parcial para encubrir la ambigüedad.

`verify(plan, sources)` rechaza cambios en cualquiera de las siete fuentes o en
el artefacto, incluidos importes, generaciones y configuración propuesta. No es
una firma, autorización ni garantía de actualidad del remoto: el operador debe
volver a contrastar las fuentes efectivas bajo el bloqueo de corte. Un hash
correcto de una lectura antigua no acredita una cobertura actual.

El parche contiene sólo tres reemplazos completos de raíces técnicas (cuentas,
listado comercial y pertenencia de cobros), nunca un overlay de filas que
conserve miembros obsoletos. Esta preparación inicial exige comprobar un destino
de cuentas ausente; rechaza reescribir uno existente y perder sus evidencias.
Los responsables y sus marcadores históricos se resuelven con la misma política
del lector original: presupuesto de origen antes que conversor, salvo responsable
explícito de venta. Las modificaciones posteriores de presupuesto pasan por el
guard y conservan marcadores anteriores; también se empareja su fence.

El parche contiene sólo datos técnicos. La configuración de activación está
separada y no se aplica automáticamente. No reutilizar una configuración de
activación aislada ni sobrescribir otras opciones comerciales existentes.

## Reglas emparejadas

`scripts/lib/client-account-cut-rules.cjs` compone la consulta nativa de
Cobranzas, Cuenta corriente, los fences de identidad de clientes y presupuestos, y el índice
`sv_usuarios/uid`. Preserva los índices y autorizaciones anteriores de Usuarios,
así como los escritores financieros originales. Rechaza autoridad de cuentas
preexistente y reglas padre amplias en vez de reemplazarlas sin revisión.

El 03/11 a las 21:29 Argentina se hizo una lectura técnica de reglas y
configuraciones, sin leer originales comerciales. Cuenta corriente no tenía
configuración; el listado comercial estaba listo pero su capacidad nativa de
Cobranzas no. La composición exacta de esas reglas pasó tres pruebas RTDB
emuladas: matriz de acceso, ámbito vacío y primer delta, e Historial persistido.
Evidencia privada: `tmp/account-cut31814/`. No se aplicaron reglas remotas. Esa
foto debe contrastarse de nuevo antes de cualquier corte.

## Dependencias que aún impiden activar

1. Preparar la imagen integral y el cliente definitivo, conservando los cambios
   web publicados posteriormente a la candidata local. Verificar sus hashes,
   capacidades y pruebas nativas completas antes de llevar tráfico.
2. Probar y concretar el tratamiento de pestañas antiguas: el cliente publicado
   todavía no deriva escrituras de clientes por el host nuevo. Al activar el
   fence, un PUT antiguo sería rechazado. No presentar ese rechazo como una
   transición compatible ni habilitar un escritor alternativo que omita el índice.
   La recarga debe respetar ediciones sin guardar y la pausa de operaciones.
3. Preparar una foto coherente de las siete fuentes durante el corte y contrastar
   el artefacto contra ellas antes del commit técnico. La lectura técnica ya
   realizada no proporciona esas fuentes ni autoriza a afirmar que están listas.
4. Emparejar imagen, reglas probadas, datos técnicos y configuraciones, con
   respaldo privado y comprobación de ausencia de guardado activo. No activar
   flags por separado ni preparar la evidencia desde un conjunto parcial.
5. Verificar activos web y capacidades remotas y finalmente el aviso de versión.
   Comprobar lecturas autorizadas; no registrar pagos ficticios en producción.

La preparación tiene dieciséis pruebas ficticias, incluidos 122 registros,
unificaciones, anulaciones, sobrepago, usuarios duplicados/inactivos y deriva de
fuentes. No equivale a probar el corte, una sesión productiva ni toda la auditoría.

## Reconstrucción de extractos

El constructor usa un índice de intersecciones del parche durante la pasada
de extractos: conserva el orden original y los reemplazos de padres/hijos, pero
no enumera todos los destinos otra vez para cada lectura puntual. Sólo se añaden
destinos de extracto durante esa pasada; fuentes y membresías permanecen fijas.
Tres pruebas comprueban equivalencia, copias y una sola enumeración ante mil
consultas sobre diez mil destinos ajenos. Este ajuste no prueba latencia web.

## Ventanas abiertas y pausa persistente: implementación local

El modo de escritura se comparte mediante client-account-mode.v1 entre navegador
y servidor. Antes de cada acción de identidad, prepareWrite consulta sólo su
configuración puntual: una ventana con el puente que vio readyfalse no conserva
ese resultado para elegir el SDK tras la activación. La comprobación no cierra
ni reinicia el formulario y no requiere consultar una cuenta privada.

writerMode=coordinated-v1 persiste cuando readyfalse representa una pausa. Las
reglas mantienen el fence por esa marca o por la cobertura global ya instalada;
quitar la disponibilidad o perder la configuración no vuelve a abrir el SDK. El
servidor usa el mismo clasificador y rechaza el commit completo si la cobertura
instalada quedó pausada, antes de tocar fuentes. Sólo el estado nunca instalado
conserva el transporte anterior. La activación preparada incluye writerMode.

Si la activación sucede entre el GET de modo legado y un SDK rechazado por
PERMISSION_DENIED, se permite una única consulta diagnóstica de modo. No se repite
la escritura: si cambió el circuito se conserva el formulario y se solicita un
reintento explícito. Un error de red incierto no activa ese diagnóstico ni un
replay automático. El endpoint autorizado de capacidades existente incluye ahora
los flags emparejados reales y la revisión del servidor, sin consultar originales;
el corte debe comprobarlos antes de levantar la pausa.

Límite importante: este puente debe publicarse y probarse con el paquete completo
actualizado antes del corte. Una pestaña anterior al puente no puede adquirir
código nuevo por magia: sus SDK son rechazados por reglas, conservando originales,
y requiere actualización segura. No afirmar compatibilidad transparente de esos
clientes ni aplicar fences mientras haya formularios no resguardados. Aún falta
concretar el protocolo de recarga de esas ventanas y la foto coherente de todas
las fuentes bajo pausa, incluidos directorios/identidades/permisos. Nada de este
bloque se aplicó remotamente.
