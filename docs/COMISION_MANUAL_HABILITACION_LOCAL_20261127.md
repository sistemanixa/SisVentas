# Comisión manual con habilitación conjunta

Candidata local v3.22.7. No publicada.

La carga manual autorizada puede habilitar la comisión de la venta y crear el movimiento, su gasto pendiente y el control de unicidad en un solo guardado protegido. Una confirmación identifica venta, persona e importe. Cancelar no escribe. La generación automática conserva su requisito de habilitación previa. No se modifican responsables comerciales ni comisiones anteriores.

El servidor admite exclusivamente el campo comisionHabilitada=true adicional al comando de participante manual identificado por origenCarga y cargadaManualmente; esas marcas no otorgan autoridad. Exige administrador activo, permisos actuales de crear comisiones y, para habilitar, módulo Venta y configurarComision. La capacidad privada queda vinculada al comando completo y a su actor. Ver como y actores trasplantados se rechazan.

Se conservan los seis originales comparados por hash. La habilitación vuelve a calcular la base con el modelo económico y costos históricos compartidos, sin catálogo actual; exige importe y porcentaje coherentes. Conserva límites del grupo, índices, duplicados canónicos e históricos, comprobación final de fuentes/permisos y exclusión de escrituras ajenas. Un fallo no deja la venta habilitada sin su comisión. Los reintentos usan el recibo del guardado; un nuevo intento tampoco reemplaza un movimiento existente.

Pruebas locales: 138 casos focales, incluidos Chrome390/1280 con formulario y confirmación actuales, LaborWrites, HTTP, autorización del Gateway, Guard y proyecciones Accounts/Pages/History genuinas; Firebase y originales son ficticios en memoria. Se probó cancelación, commit conjunto, replay, segundo intento y generador automático real tras el manual (resultado existente, sin cambios). Negativos de permisos, cambios concurrentes, costos faltantes, importes falsos, anuladas, duplicados y tope compartido. Los consumidores actuales requirieron adaptar tres fixtures/expectativas al nuevo contrato; esos tres archivos completos pasaron41 casos. No sumar estas cantidades como suites independientes, pues se solapan.

No se afirma validación contra Rules remotas ni un despliegue de servidor. Al publicar habrá que integrar los dos módulos de servidor con el runtime desplegado preservando sus diferencias nativas, comprobar la autoridad RTDB efectiva y publicar web/servidor coordinadamente. El puerto8766 sirve sólo el frontend local; no sustituye el backend real. La ejecución completa nueva se probó en el servidor HTTP ficticio aislado. Ninguna comisión real fue creada, habilitada, aprobada o pagada.

Cierre: puerta vigente completa sobre 04ba0c68, exit0: 12066 casos, 11922PASS, 0FAIL y144skip en cinco lotes. Ventana local8766 recargada efectivamente en Comisiones; se abrió el formulario vacío y se comprobó el texto de habilitación conjunta. No se confirmó ningún registro real. El backend productivo sigue sin actualizar.
