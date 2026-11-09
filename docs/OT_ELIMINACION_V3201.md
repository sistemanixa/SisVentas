# Eliminación de OT: preparación v3.20.1

La interfaz comprueba disponibilidad y permisos antes de leer el original y pedir confirmación. Una respuesta incierta conserva el mismo intento y consulta el recibo; no vuelve al borrado directo del SDK.

El servidor se prepara mediante un overlay mínimo sobre la imagen publicada de Stock. Conserva Pages y RecordList de esa imagen. Una OT sin actividad puede retirarse junto con sus referencias exactas en la venta, en un único guardado. La venta, sus importes, pagos, comisionados y materiales quedan conservados. Entregas, instalaciones, documentos u otros vínculos impiden el borrado.

Las reglas candidatas agregan restricciones y no conceden nuevos accesos. La habilitación usa `OT_DELETE_OPERATIONAL_READY`, `OT_DELETE_OPERATIONAL_PUBLIC_KEY` y `OT_DELETE_OPERATIONAL_PINS_JSON`, además de actas técnicas verificadas. Las claves privadas y los respaldos no forman parte del repositorio. La generación de configuración operacional identifica la activación, no una reconstrucción histórica de sus resúmenes.

Fuente de preparación del servidor: `603483d318b9bc903ca5cca4a5c6002f6e8d4ebe`. La primera imagen `80826ad5c304709524cf6ce33257c1abd45b18f92ca604ee5e462681f13e0b11` permitió detectar una revalidación de identidad dentro de un contexto que ya se estaba confirmando. Ese rechazo se mostraba incorrectamente como sesión vencida; no se confirmó el borrado.

La corrección posterior, fuente `d6fa8a993ac177b1e49c1730a0a972c7b8e33c75`, reutiliza la autenticación canónica con una autoridad OT de sólo lectura para el estado privado de acceso y el perfil. No expone escrituras ni amplía permisos. La imagen final construida es `sha256:977f670b2790a87163ba615508fdd3432dae756fd5a62797ee551bfc08be75d9`: sólo sustituye el índice y añade esa autoridad sobre la imagen anterior. Siete casos reproducen el fallo anterior, confirman el recorrido corregido y rechazan cambios tardíos de identidad, contraseña, versión de acceso o perfil. No desplegar el checkout completo de auditoría ni activar Accounts/H7 como requisito de esta corrección.

Validación local: guard, DB, runtime y store HTTP compuesto contra emulador y reglas exactas; eliminación, reintento y revocación sin efectos parciales. Suite vigente del frontend aislado: 9.991 casos, 9.926 aprobados, cero fallos y 65 omitidos. Una corrida anterior detectó que la simulación de UI no ofrecía el preflight nuevo; se incorporó ese método sin cambiar las expectativas del comando ni del resultado y se repitió la puerta completa.

Este documento registra preparación y pruebas. La construcción de una imagen, un commit o una candidata sin tráfico no acreditan por sí solos activación, eliminación real o publicación; esos resultados requieren verificación posterior.
