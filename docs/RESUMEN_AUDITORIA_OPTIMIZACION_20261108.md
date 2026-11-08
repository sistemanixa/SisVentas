# Auditoría de optimización: estado documental al 08/11/2026

Este resumen distingue lo publicado de lo preparado y de lo no comprobado. Se elaboró leyendo los documentos del repositorio; **no se volvió a consultar producción**. Los estados remotos siguientes son los últimos documentados, no una certificación de su vigencia actual. Una URL, un commit o una suite local por sí solos no acreditan una activación.

## Objetivo y criterio de cierre

El [plan integral de etapa 1](PLAN_INTEGRAL_ETAPA1.md) conserva una fuente original autoritativa y proyecciones reconstruibles. Las listas pueden mostrar 50 filas sin limitar los totales ni la deuda histórica a esas filas. La búsqueda debe conservar continuación histórica; ausencia de cobertura no equivale a cero o a registro inexistente. Cada guardado debe comprobar identidad, permiso y revisión, tener una operación estable y permitir recuperar el resultado sin duplicarlo.

El orden acordado es: base coherente; núcleo comercial; Cuenta Corriente; relaciones OT/Compras/stock/remitos y Gastos; Historial; consultas y métricas; transición y publicación. Las cuatro revisiones iniciales fueron inspecciones focales: no equivalen a ejecutar todas las matrices ni a cerrar todos los pasos. El trabajo acumulado es reutilizable, pero el conjunto no debe presentarse como una auditoría global terminada.

## Publicado según la evidencia conservada

| Bloque | Evidencia documental | Alcance y límite |
|---|---|---|
| Presentación/Compartir y demanda puntual de Soporte/Garantías, v3.19.14 | Fuente `0e8079046d1753a11113c760b11ac32e68e37553`; puerta 9.830 PASS, cero FAIL, 37 SKIP; Hosting `12e50f99f424b3d9`, ocho activos exactos y aviso oficial | Publicación web. Conserva Comisiones. La aplicación libera su captura temporal al compartir; no acredita reparar los iconos del panel nativo de Windows. Una selección de cliente todavía podía leer toda la colección autorizada. |
| Compatibilidad económica y porcentaje de comisión, v3.19.16 | CONTEXTO registra fuente `3f2ca7b30721d4d1b426b774c4dfc027d531720b`, puerta 9.898 PASS y 37 SKIP, actualización compatible de servidor y verificación web | No acredita resolver el descubrimiento en frío de todas las comisiones desde una caché parcial. La operación real autorizada descrita allí ya terminó y no se debe repetir como prueba. |
| Cuenta Corriente y condición de vínculo histórico OT, v3.19.17 | Fuente `72db94334701bad67525445a08ec94ba0476cd7f`; puerta 9.910 PASS, cero FAIL, 46 SKIP; Cotizador `cotizador-ccot31917-dd416173`; Hosting `082c4e8d365a887a` | Cuenta Corriente conserva lecturas, saldos y autores; mejora concurrencia de consultas del listado, no de guardados. OT acepta un vínculo unidireccional comprobado sin inventar enlace primario. No se cerró una OT real para probarlo. |
| Pantalla de materiales OT, v3.19.18 | CONTEXTO registra fuente `d671090b814735db51a0d071444a7e6d80141dcd`, Hosting `7c8ee763638d3dfa`, siete activos exactos y aviso oficial | Publicación exclusivamente frontend. No activó la rendición atómica posterior, Tecnoprices, reglas o servidor nuevos. El selector de técnicos quedó fuera de ese cierre. |

La medición documentada de Cuenta Corriente mostró la lista visible al volver en 503 ms, con revalidaciones de 1,99–2,03 s. No fue una comparación controlada y **no acredita una reducción de transferencia**. Un 304 al navegador no demuestra por sí solo menos lecturas de Firebase. Las cifras y omisiones corresponden a fuentes distintas; no se suman como cobertura independiente.

## Preparado en local, sin acreditar activación productiva

| Bloque | Estado documentado | Siguiente condición verificable |
|---|---|---|
| Eliminaciones coordinadas | Revalidación local: 211 PASS, cero FAIL/SKIP sobre la fuente indicada en su documento; incluye permisos, concurrencia, cancelación y respuesta perdida con registros ficticios | Verificar paquete compatible, estado remoto y corte específico. Las capacidades no se activaron en esa revalidación. |
| Tecnoprices | Contratos y proveedor HTTP simulado aprobados; composición offline conservada | Construir y ejecutar la imagen exacta. Falta motor Docker/Podman; pruebas de archivos/HTTP no prueban imagen, login, TLS o cookies reales del proveedor. |
| Rendición atómica OT187 | Fuente `8e37b62deeeaeac9d2a264bd7d4c3b2c42008b8d`; puerta 9.971 PASS, cero FAIL, 46 SKIP; overlay mínimo y seis casos de emulador documentados | Falta comprobación de imagen/contenedor y corte autorizado. No desplegar el repositorio completo ni reconciliar la OT real como prueba. |
| Accounts/Historial H7 | Contratos, fuentes y preparación descritos en el plan y CONTEXTO | La mejora compatible publicada de Cuenta Corriente no acredita el despliegue general de Accounts/H7. Hace falta validar sus escritores, proyecciones, audiencias, recuperación y activación correspondientes. |
| Stock de oficina simple | Integración local en curso, con fuente y pruebas propias | Su cierre se informa en [STOCK_OFICINA_SIMPLE_LOCAL.md](STOCK_OFICINA_SIMPLE_LOCAL.md). No hereda la autorización ni el estado de publicación de OT18. No se ajustan existencias reales para probarlo. |

## Lo que todavía no puede afirmarse

- Que se probó cada circuito con una copia exacta y vigente del volumen completo de producción. Las referencias históricas de cantidad de ventas/productos sirven para diseñar carga sintética, no para afirmar equivalencia actual.
- Que todos los consumidores dejaron de depender de memoria parcial o que toda búsqueda histórica está indexada. El plan exige inventario, cobertura y continuación por consumidor; una primera página correcta no completa esa prueba.
- Que todas las omisiones de las puertas pasaron por otra vía. Los 46 SKIP del cierre CC/OT están inventariados separadamente y no cuentan como aprobados.
- Que toda la auditoría, todos los pendientes o todos los cambios preparados están publicados. Debe existir evidencia por paquete, servidor, reglas, configuración y comprobación web.
- Que las optimizaciones ya redujeron una factura determinada. Requiere medición comparable de transferencia/ejecución y período de facturación, no inferencia a partir del diseño o de la latencia visible.

## Por qué hubo revisiones y demoras

Los documentos registran causas concretas: coexistencia de una base publicada y otra preparada; contratos y configuraciones todavía no activados; fixtures que no representaban el transporte realmente vigente; fallos reproducidos de permisos, datos parciales y atomicidad; y cortes urgentes acotados que conservaron otros bloques sin publicar. También hubo restricciones de loopback/navegador y falta de motor de contenedores. Los intentos fallidos se conservaron y se distinguieron de repeticiones aprobadas.

Esto explica comprobaciones adicionales; no convierte cada resultado local en una solución productiva. Para evitar repetir la confusión, cada entrega debe dejar una fuente congelada, matriz ejecutada con límites explícitos, artefacto compatible, activación separada y comprobación posterior. No se incluye una estimación de horas ni de ahorro sin evidencia para sostenerla.

## Fuentes y precedencia

- [PLAN_INTEGRAL_ETAPA1.md](PLAN_INTEGRAL_ETAPA1.md): contratos, etapas y matrices; contiene actualizaciones y bases históricas.
- [INTEGRACION_LOCAL_V31914.md](INTEGRACION_LOCAL_V31914.md): prevalece su apartado «Cierre publicado» sobre los párrafos anteriores de preparación.
- [CUENTA_CORRIENTE_OT_V31917.md](CUENTA_CORRIENTE_OT_V31917.md): prevalece «Cierre publicado y comprobado» sobre «Estado al congelar».
- [ELIMINACIONES_TECNOPRICES_REVALIDACION_LOCAL_20261107.md](ELIMINACIONES_TECNOPRICES_REVALIDACION_LOCAL_20261107.md): revalidación local y límite de contenedor.
- [CONTEXTO_ACTUAL.md](CONTEXTO_ACTUAL.md): cierres posteriores y límites de OT18/rendición atómica; sus antecedentes no sustituyen el cierre más reciente de cada bloque.

Este documento no ejecuta migraciones, permisos, publicaciones ni operaciones comerciales. Costos y conciliaciones reales conservan sus alcances separados.
