# Instalación individual e históricos · v3.15.15

Autorización del titular: corregir la rendición anterior de original/adicional,
agregar Marcar instalado por ítem, probar con ficticios y publicar. No ejecutar
la corrección sobre OT-173 ni su inventario como prueba.

## Vista e identidad

SVOTMaterialRows normaliza vendida/qty/cantidad/cant sin convertir cero en uno.
Conserva originales y adicionales del mismo código como renglones distintos.
Una referencia de items que ya figura en materiales no se suma otra vez.
Renglones existentes en items pero ausentes de materiales se presentan como
registro anterior. Su origen se conserva al confirmar y evita recuperarlos dos
veces. No se crean productos, ventas, pagos ni cantidades por sólo abrir la OT.
No se deducen materiales desde el nombre del cliente ni desde totales comerciales.

El normalizador de progreso conserva identidad y campos propios del material;
no copia adicionalOT, destino o referencias de stock por coincidir solamente el
código. Avance instalado sólo se toma de una referencia inequívoca cuando el
original no tiene ese dato; cero explícito prevalece.

## Acción por ítem

Acciones contiene Marcar instalado para cada producto físico. Confirma el ítem
seleccionado y deja los demás sin instalar. Admin habilita Corregir materiales
si la OT está cerrada. Permisos existentes y bloqueo Ver como conservados.
Si falta entrega, se exige permiso de entregar (original) o corregir materiales
(adicional) y la confirmación indica que se registrará esa entrega. Un original
y un adicional se pueden confirmar en cualquier orden. Todo instalado también
incluye las referencias históricas válidas. La OT permanece cerrada y auditada.
Servicios no consumen stock; devoluciones recibidas, pendientes e incidencias
se respetan en la instalación individual.

Se reutiliza sin cambios el motor de stock15.14: recibo/revisión por renglón,
reserva propia para original y general disponible para adicional. No toma
reserva original ni ajena. Repetir una confirmación o recuperar un fallo OT no
consume dos veces. Stock/OT siguen dos confirmaciones; no se promete atomicidad
multidominio. Un registro anterior ya instalado no se vuelve a cobrar en stock
por normalizar su presentación. Incertidumbres de consumo histórico requieren
revisión explícita; no se migran ni corrigen automáticamente.

## Verificación y límites

65 casos específicos ficticios: formatos históricos, mismo código, no duplicar,
ambos órdenes, reintento/guardado fallido, faltante, permisos, cancelación,
Ver como y conservación de los avances existentes. UI390/768/1280 con módulos
reales: dos renglones, dos instalaciones, dos consumos, reintento sin cambio,
columna Acciones y cero solicitudes externas. Suite vigente al cierre.
Sólo Hosting; no servidor, reglas, roles, IAM, servicios nuevos ni sondeos.

Inspección real anterior sólo habilitó controles y canceló el formulario sin
confirmar instalación. Una consulta puntual filtrada posterior devolvió400:
no se descargó el historial como alternativa ni se modificaron datos reales.
La reproducción usa formatos ficticios; no se afirma haber corregido el registro
del titular ni comprobado su consumo real después de guardar.

Evidencia privada en C:/SisVentas/tmp/ot31515-release, fuera de Git.

Puerta final: 6.252 casos, 6.225 PASS / 27 opt-in / 0 fallos.65 focalesPASS.
El módulo de custodia se solicita con ?v=3.15.15; motor de stock y servidor
permanecen sin cambios respecto del bloque anterior.
