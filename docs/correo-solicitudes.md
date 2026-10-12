# Correo automático de solicitudes

Remitente: nixa@sistemanixa.com. Credencial exclusivamente en Secret Manager: NIXA_GMAIL_APP_PASSWORD.

Los eventos nuevos de sv_catalogo_solicitudes_atencion y sv_catalogo_solicitudes_declinacion envían la confirmación o el motivo de declinación al email del registro original. Los registros anteriores al despliegue no se notifican retroactivamente.

El estado técnico queda en sv_catalogo_solicitudes_correo/<id>/<confirmada|declinada>: enviando, enviado, error o sin_email. Enviado significa aceptación SMTP, no prueba de lectura ni garantía de entrega a la bandeja de entrada.

Las reservas de envío duran diez minutos; los errores permiten reintentos. Una interrupción entre la aceptación SMTP y la escritura de estado puede producir un duplicado al reintentar: SMTP no permite asegurar entrega exactamente una vez.

Servicios: correoSolicitudConfirmada y correoSolicitudDeclinada, Node.js 22, us-central1, Firebase nixa-sisventas-default-rtdb. Cuenta de ejecución: 171899432710-compute@developer.gserviceaccount.com, acceso de lector limitado al secreto citado.

Pruebas: node --test test/catalog-request-mail.test.cjs. No guardar contraseñas en archivos, código, logs ni documentación.

## Verificación del 12/10/2026

Se probó autenticación SMTP y un correo técnico a la misma cuenta remitente. Se desplegaron ambos receptores con Google Cloud Functions Framework, firma CloudEvent y Firebase Admin modular. Los avisos de uuid del framework se corrigieron mediante override compatible a 11.1.1; npm audit final: cero vulnerabilidades.

Solicitudes técnicas conservadas y visibles por pedido del usuario:
- Confirmación: a9859c0f-6f75-4c51-a453-8647a2496599.
- Declinación: 755c97c0-6616-4aaa-8793-a3b671756dea.

Despliegue reproducible: scripts/deploy-solicitudes-correo.ps1. Requiere sesión Google Cloud con permisos de despliegue y acceso del servicio de ejecución al secreto.

Resultado: ambas solicitudes técnicas llegaron al estado enviado, con messageId registrado. Los reintentos de Eventarc recuperaron los eventos originales después de corregir los receptores; no se recrearon las solicitudes ni se tocaron pedidos reales.

## Diseño del correo

Plantillas HTML en template.cjs: estética oscura SisVentas, estado verde para confirmación y dorado para declinación, nombre del pedido, motivo personalizado, enlace al catálogo y respuesta al remitente. Tablas y estilos inline para correo; conserva alternativa de texto simple. Todos los datos del cliente se escapan antes de insertarlos en HTML.

Se enviaron las dos pruebas de diseño a nixa@sistemanixa.com. Gmail aceptó ambas. No se enviaron pruebas a clientes reales.
