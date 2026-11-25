# Flujo OT sobre base pública 15

Port quirúrgico de 316cfe73, sin restaurar mapped ni reemplazar State/Guard/Store/runtime. Preparación devuelve hash/revisión de la OT autorizada; cliente conserva capacidad privada ligada a sesión y de un uso. El servidor sigue releyendo originales, permiso y CAS antes del commit. Configuración/servidor antiguo sin hash conserva lectura del original.

Comparación única ficticia, base 37e1cbab compilada en memoria frente al candidato, frontend ServiceAuth+Recovery y Guard/REST Store de repositorio: 641 productos, 1.100 otras OT, 12 filas, latencia150ms. Antes7115ms, después6971ms; backend119 solicitudes en ambos, concurrencia máxima6, una escritura, guarda no vencida. Cliente GET+SDK+POST pasa a GET+POST. Son144ms observados, no prueba de latencia de producción ni solución completa del costo principal. Runtime remoto tiene Guard/Store/composición distintos y esta medición NO lo certifica.

23 pruebas de cliente/recorrido/cierre PASS; pruebas negativas de hash, sesión, replay/ACK perdido y permiso fresco. Evidencia privada local tmp/ot-active-writers/current-before.json y current-after.json. Pendiente integrar Inventory/Count y medir conjunto final; sin flags ni datos reales.
