# Compresión comercial Brotli · publicada con cliente v3.11.20

Rama codex/lecturas-brotli-v3120 desde 0dc86f160dab57619cf9990be206c1ec60f0a0e9. El nombre de rama es de trabajo: no crea un cliente v3.12.0. Cliente publicado, Hosting y aviso permanecen v3.11.20.

Publicada desde d849afb4d843ed3cdc8c6024e89d50abb9136f58: cotizador-load-d849afb4 al 100%, 14 etiquetas conservadas, temporal retirada y configuración/reglas/DNS intactos. Estado y digest exactos en CONTEXTO_ACTUAL. Dos muestras de Dashboard post-corte: 6.718 y 7.981 ms, con variabilidad; no constituyen garantía porcentual.

## Cambio

GET de ventas y presupuestos conserva el DTO completo, permisos por petición, ETag de los bytes JSON sin comprimir, no-store privado, Vary por identidad/origen/codificación y 304 sin cuerpo. Negocia Brotli cuando el navegador lo admite y no prefiere gzip. Usa calidad4 y compresión asíncrona del runtime existente, sin dependencias nuevas. Mantiene gzip y representación sin comprimir, el umbral de 1 KiB y la condición de no agrandar el cuerpo. No elimina adjuntos, ítems, auditoría ni centavos y no escribe registros de negocio.

No reemplaza la futura separación de documentos/detalle: solo reduce bytes conservando el contrato completo. No cachea ni comparte Auth, roles o datos entre usuarios.

## Benchmark de lectura en memoria

Se leyó el historial para comparar codificaciones en memoria, sin guardar registros ni exportaciones. Solo se conservaron métricas agregadas ignoradas en tmp/release-v31120/compression-benchmark.json. Los bytes descomprimidos se compararon íntegramente con el original.

- 1.084 ventas, JSON de referencia de 4.806.303 bytes (sin las proyecciones de identidad añadidas por API).
- gzip: 2.044.380 bytes y 73 ms en la muestra.
- Brotli calidad4: 1.806.100 bytes y 30 ms; reducción de bytes de aproximadamente 11,7% respecto de gzip.
- Calidad6: 1.768.092 bytes y 44 ms. Se elige calidad4 para favorecer latencia y trabajo de CPU.

No extrapolar tiempos de CPU de esta PC a Cloud Run ni convertir la reducción de bytes en una promesa de mejora del arranque total. Las consultas actuales y la recepción del historial continúan existiendo.

## Verificación y publicación

1.773 pruebas generales y 94 servidor aprobadas. Cuatro pruebas nuevas de negociación/Brotli, incluidos bytes íntegros con documentos y centavos, representación pequeña y validadores. 20 pruebas de integración HTTP real de transporte y sesión aprobadas, incluido Brotli; usan datos ficticios, sin Firebase. Coherencia de cliente20 intacta.

Preparar imagen desde commit limpio, revisión sin tráfico, comprobar variables/secretos/cuenta/recursos/tráfico original y reglas sin cambiarlos. Probar GET autenticado y descompresión automática del navegador contra la etiqueta candidata, además de gzip/304/401/403/CORS. Solo entonces cambiar tráfico y etiquetas conservando la configuración exacta. No activar nuevamente ni cambiar el corte de generación de comisiones; no hacer backfill. Reversión: cotizador-documents-31119-7e9a1c1e, sin restaurar datos.

## Observador: trabajo innecesario durante el inicio

En la revisión preliminar sin tráfico se observó una cola inicial de 1.055 ventas cobradas. Inventario de solo lectura: 63 tienen comisionHabilitada estrictamente true; las otras 992 siempre terminaban no_aplica en el modelo, después de releer venta, configuración, pagos y comisiones. El callback ahora descarta esos snapshots antes de repetir consultas. No cambia elegibilidad: una habilitación posterior llega por child_changed y pasa por la validación completa. Reintentos sin snapshot mantienen la ruta anterior. No se filtra por una fecha de creación que pudiera ocultar un cobro reciente. El corte, costos, porcentajes y destinos create-only permanecen intactos.

Tres pruebas nuevas: mil snapshots sin habilitación no leen dependencias ni alteran datos; habilitar luego genera una sola comisión pendiente en datos ficticios; un snapshot habilitado no reemplaza el estado actual validado en servidor. La revisión 788b320e con solo Brotli se probó pero no recibió tráfico productivo; quedó superada antes del corte por esta corrección adicional. No activar esa imagen preliminar como paquete final.

Comparación autenticada preliminar: Ventas 4.910.631 bytes descomprimidos idénticos y mismo ETag (2.050.318 bytes gzip frente a 1.808.223 en candidata); Presupuestos 1.172.955 bytes idénticos (597.712 frente a 450.096). Ambos validadores devolvieron 304 sin cuerpo. Perfil, Proyectos, Comprobantes y acceso privado dieron 200. El arranque completo observado fue 9,6 s, con variación frente a las muestras previas: no anunciar mejora porcentual del total. Se conservan las huellas de 224 gastos, 122 movimientos y 47 controles y tres registros de la operación protegida. Repetir evidencia con la revisión final antes del corte.

Verificación final: revisión con filtro comparó de nuevo cuerpos/ETag exactos y 304; perfiles/proyectos/comprobantes/acceso privado 200. Observador conectado/listo sin pendientes, errores, reintentos o generaciones en muestras post-corte; huellas financieras íntegras. Evidencia privada en tmp/load-release-d849afb4. No se activó la preliminar788.
