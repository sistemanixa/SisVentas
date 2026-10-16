# Publicación con cabeceras de seguridad

Estado al preparar este documento: **DNS sigue en GitHub Pages**. No ejecutar una migración como efecto de sincronizar Git o verificar un traslado. Consultar CONTEXTO_ACTUAL y obtener el alcance autorizado.

## Cuando se active Firebase Hosting como destino de ventas

1. Usar un checkout público limpio con la versión y el commit revisados; conservar los cambios de otra PC en su rama. Ejecutar la suite vigente, sintaxis, diff y coherencia local de versión.
2. Publicar Git según el alcance aprobado y registrar el SHA completo. Mantener el repositorio como referencia compartida, aunque el alojamiento deje de depender de Pages.
3. Desde ese checkout limpio ejecutar, con la identidad Google Cloud configurada de forma segura:

   ```sh
   node scripts/deploy-secure-hosting.cjs --apply --expected-commit SHA_COMPLETO_REVISADO
   ```

   El destino fijo es `nixa-sisventas-seguro`, proyecto `nixa-sisventas`. El comando no modifica DNS. Publica únicamente la lista de activos públicos y las cabeceras revisadas. Requiere permisos de administración de versiones/releases del sitio de Hosting; no necesita cambiar IAM de usuarios ni exportar claves. No servir la raíz del repositorio ni subir documentación/informes a Hosting.

4. Verificar en el dominio real: index, aplicación/versiones inmutables, módulos cambiados, Service Worker, catálogos y cabeceras. Un código de salida correcto o un push no acreditan que todos los clientes reciban el paquete.
5. Solo después, ejecutar `scripts/actualizar-nodo-version.ps1 -Version vX.Y.Z` para comprobar la web y actualizar el aviso Firebase. Si falla la web, no forzar el aviso.

## Primera migración del dominio

La [guía oficial de Hosting](https://firebase.google.com/docs/hosting/custom-domain) permite preparar certificado con validación DNS/HTTP antes de apuntar tráfico. Primero verificar el certificado para `ventas.sistemanixa.com`, el contenido del sitio de Hosting y la compatibilidad del cliente/API; después cambiar únicamente el CNAME `ventas` con autorización concreta. Confirmar TLS y cabeceras desde el dominio real. Mantener el antiguo destino documentado para reversión; la propagación DNS puede mezclar proveedores temporalmente, por lo que ambos deben servir el mismo cliente compatible.

No cambiar los dominios autorizados de Auth ni CORS por analogía: el dominio de producción permanece igual. La URL `web.app` sirve para comprobar activos/cabeceras; no afirmar que un login en ese origen temporal esté autorizado o probado. No desactivar protecciones para facilitar la vista previa.

Configuración, copias de reversión y evidencias privadas van en `tmp/`; nunca tokens, sesiones, datos de negocio ni claves en Git. Los entornos nuevos deben configurar sus propias identidades, no copiar credenciales de esta PC.
