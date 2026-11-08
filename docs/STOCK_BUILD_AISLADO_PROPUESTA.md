# Stock: build aislado propuesto · 08/11/2026

Propuesta offline para imagen Stock fuente28436175, paquete b894cfeb792cce04278bc5c3dd04f7c6e96700456f8212a37c56bf2bed37d4bf. Sin envío ni build remoto ejecutado. No Docker/Podman ni WSL instalado: no existe motor local disponible; no se instala ninguno.

## Acción concreta para aprobación

Un Cloud Build en nixa-sisventas, región southamerica-east1, máquina E2_STANDARD_2, máximo600s más cola300s (cola no computa minutos de build). Cuenta existente171899432710-compute@developer.gserviceaccount.com, sin IAM nuevo. Docker builder fijado por digest fbc05705e6f24467e40ae8a4097ab9b8fae1116551f838fa2c55f4367427fc36. Base cf7bcefb inmutable. Contexto permitido: siete fuentes públicas de servidor, receta, manifiesto de hashes y comprobaciones ficticias; sin credenciales, exportaciones, perfiles ni documentos comerciales. No envía frontend al build.

Primero verifica hashes, descarga la base y construye con networknone; conserva exactamente la configuración base (sin imprimir sus valores). Después ejecuta las comprobaciones dentro de contenedor con networknone, rootfs readonly, UID65534, sin capacidades y sin credenciales montadas, límites de memoria/CPU/procesos. Un preloader también rechaza red y subprocess. Sólo si todos los pasos pasan CloudBuild conserva la imagen en el repositorio existente cloud-run-source-deploy/cotizador, etiqueta stock-validation-28436175. Se retiene digest de la imagen probada; no se despliega, cambian tráfico/reglas/capacidades ni se escriben datos. No se cambia el escaneo del repositorio ni la facturación.

## Costos antes de ejecutar

Tarifa oficial CloudBuild consultada08/11/2026: USD0,006/min E2_STANDARD_2. Diez minutos equivalen a USD0,06 de cómputo, sin asumir cuota promocional disponible. Se suman fuente/logs/almacenamiento de imagen y posibles cargos de escaneo ya configurado. Estimación total esperada para una ejecución: menor a USD1; no es garantía ni límite exacto de factura. No hay servicio nuevo ni costo de instancia permanente por este build. Imagen usa el mismo repositorio/base; almacenamiento real se informa según capas efectivamente añadidas. Si la configuración revisada requiere otro recurso/IAM o cambia el costo previsto, no ampliar automáticamente.

Referencias: https://cloud.google.com/build/pricing y https://cloud.google.com/artifact-registry/pricing . La tarifa consultada no acredita cuota gratis, descuento, estado de presupuesto ni límite remoto activo. No se modifica el control de costos del proyecto.

## Evidencia local y límites

scripts/prepare-office-stock-build-proposal.cjs sólo genera archivos, no puede invocar gcloud/docker ni subir. Verifica paquete exacto completo y copia únicamente su allowlist. Dos pruebas del contrato de build PASS. Nueve comprobaciones del artefacto/comandos PASS en host usando exactamente el runtime compuesto retenido y preloader de aislamiento; esto NO es ejecución dentro de imagen. Cubren integridad/imports, rol admin/administrativo, rechazo técnico/vendedor, histórico, replay único, concurrencia, rechazo de commit, cero y conservación de finanzas/stock no ajustado. Comparación compuesta13emulador y regresión70 ya conservadas aparte; no sumar como cobertura independiente.

Contexto v2 privado stock-build-proposal-28436175-v2:15archivos permitidos, manifiesto eb315a3eb31bfa55d05e2a67a3c0eba52c57c2a1a348fed1646e25661594e56b. Primera preparación v1 se conserva sólo como antecedente, NO ejecutar: el runner v2 evita subprocess y respeta el preloader. Antes de enviar revalidar contexto, origen/base y configuración de build; no reintentar automáticamente generando otro cargo. El comando de envío no se ejecutó.

Aprobación pendiente: ejecución pagada descrita y almacenamiento de esa imagen candidata. Publicación productiva sigue separada. Si falla, conservar log/ID/causa y corregir en local; no modificar datos/permisos reales para hacer pasar pruebas.

## Resultado autorizado posterior
El08/11 el titular autorizó un único build y retener candidata. Build0f27e6e9-ef58-4b74-a4b6-c656f7d071e9 SUCCESS;9tests dentro deimagenPASS/0FAIL. Digest sha256:ce214d16acc17a89acecab937a499c4984ca49c5f6a097fedba2d5aab73fb8a2 guardado/verificado.63,855s; estimación cómputoUSD0,0063855+extras, nofactura. Producción/revisión/tráfico15accesos idénticos. No publicación ni datos reales. Sustituye únicamente la condición anterior de build pendiente; evidencia en CONTEXTO_ACTUAL. Futuro corte debe usar digest ya probado, sin reconstrucción.
