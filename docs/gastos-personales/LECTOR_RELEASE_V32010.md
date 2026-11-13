# Preparación aislada del lector v3.20.10

Base pública comprobada: v3.20.9, fuente `260ccb13`. Integra únicamente el lector y la revisión pendiente de `76d8092b`; no incorpora Accounts, Indumentaria, presentaciones ni cambios de servidor.

Aplicación y marcadores inmutables nuevos, índice, marcador liviano y caché/SHELL coherentes con v3.20.10. El portal abre el HTML privado con el marcador nuevo; el HTML y el Service Worker referencian las nuevas URLs del lector y de la interfaz. No cambia la autenticación ni el contrato de guardado.

La suite focal del dominio tiene 168 casos aprobados y la interfaz completa tres recorridos ficticios de 390, 820 y 1440 px. La puerta general de la candidata anterior, con Node22 y dependencias configuradas, tiene 10.546 casos: 10.389 aprobados, 105 fallidos y 52 omitidos. Los 28 archivos de familias fallidas se contrastaron contra un checkout limpio de la base con el mismo entorno: 228 casos en cada fuente, 122 aprobados, 105 fallidos y uno omitido, sin diferencias caso por caso. Esto no representa una puerta general aprobada. La preparación de versión requiere repetir la validación sobre sus activos finales y revisión del responsable del despliegue.

No publicación, aviso remoto ni confirmación de datos reales en este commit. Los originales y borradores privados se conservan separados de Git. La confirmación de los resúmenes se realizará desde la interfaz autorizada, después de verificar el despliegue y conciliar cada documento, sin volver a registrar los pagos incluidos en el PDF.
