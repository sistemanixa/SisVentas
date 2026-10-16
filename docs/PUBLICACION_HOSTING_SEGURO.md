# Publicación con cabeceras de seguridad

Estado vigente al 16/10/2026: **ventas.sistemanixa.com usa Firebase Hosting**, con A 199.36.158.100 y certificado activo; transición autorizada y verificada. GitHub conserva el código, pero un push de Pages no publica en este destino. Consultar CONTEXTO_ACTUAL antes de cada publicación. No modificar DNS como efecto de sincronizar Git.

## Cuando se active Firebase Hosting como destino de ventas

1. Usar un checkout público limpio con la versión y el commit revisados; conservar los cambios de otra PC en su rama. Ejecutar la suite vigente, sintaxis, diff y coherencia local de versión.
2. Publicar Git según el alcance aprobado y registrar el SHA completo. Mantener el repositorio como referencia compartida, aunque el alojamiento deje de depender de Pages.
3. Desde ese checkout limpio ejecutar, con la identidad Google Cloud configurada de forma segura:

   ```sh
   node scripts/deploy-secure-hosting.cjs --apply --expected-commit SHA_COMPLETO_REVISADO
   ```

   El destino fijo es `nixa-sisventas-seguro`, proyecto `nixa-sisventas`. El comando no modifica DNS. Publica únicamente la lista de activos públicos y las cabeceras revisadas. Para la aplicación monolítica incluye la versión activa del índice y las dos anteriores; los cientos de versiones históricas siguen en Git y no se comprimen ni suben en cada release. Requiere permisos de administración de versiones/releases del sitio de Hosting; no necesita cambiar IAM de usuarios ni exportar claves. No servir la raíz del repositorio ni subir documentación/informes a Hosting.

4. Verificar en el dominio real: index, aplicación/versiones inmutables, módulos cambiados, Service Worker, catálogos y cabeceras. Un código de salida correcto o un push no acreditan que todos los clientes reciban el paquete.
5. Solo después, ejecutar `scripts/actualizar-nodo-version.ps1 -Version vX.Y.Z` para comprobar la web y actualizar el aviso Firebase. Si falla la web, no forzar el aviso.

## Primera migración del dominio

La [guía oficial de Hosting](https://firebase.google.com/docs/hosting/custom-domain) permite preparar certificado con validación DNS/HTTP antes de apuntar tráfico. Primero verificar el certificado para `ventas.sistemanixa.com`, el contenido del sitio de Hosting y la compatibilidad del cliente/API; después cambiar únicamente el CNAME `ventas` con autorización concreta. Confirmar TLS y cabeceras desde el dominio real. Mantener el antiguo destino documentado para reversión; la propagación DNS puede mezclar proveedores temporalmente, por lo que ambos deben servir el mismo cliente compatible.

No cambiar los dominios autorizados de Auth ni CORS por analogía: el dominio de producción permanece igual. La URL `web.app` sirve para comprobar activos/cabeceras; no afirmar que un login en ese origen temporal esté autorizado o probado. No desactivar protecciones para facilitar la vista previa.

### Si el origen anterior usa CNAME

El TXT de ACME valida el certificado, pero no sustituye la asociación de Hosting `hosting-site=[site_id]`. Antes de un corte sin interrupciones hay que comprobar **también el contenido mediante el nombre real** contra el destino nuevo: web.app correcto y TLS válido no bastan si la asociación todavía devuelve 404. CNAME y TXT no pueden convivir en el mismo nombre.

Para `ventas` se preparó una transición por A/TXT: sustituir primero el CNAME anterior por un A equivalente al proveedor que sigue atendiendo (GitHub `185.199.108.153`, probado con hostname real, TLS y cinco activos idénticos), agregar el TXT `ventas = hosting-site=nixa-sisventas-seguro`, y esperar asociación y certificado activos. Solo después verificar el contenido contra Firebase `199.36.158.100` y cambiar el A de **ventas** a ese destino. No cambiar raíz, www ni correo. Conservar el TXT de asociación; la reversión de tráfico consiste en volver el A al proveedor anterior. La autorización del traslado ya fue concedida; revisar el estado exacto antes de cada paso, sin suponer que el plan está aplicado.

Configuración, copias de reversión y evidencias privadas van en `tmp/`; nunca tokens, sesiones, datos de negocio ni claves en Git. Los entornos nuevos deben configurar sus propias identidades, no copiar credenciales de esta PC.
