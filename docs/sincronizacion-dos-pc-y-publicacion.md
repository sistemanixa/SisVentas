# Sincronización entre las dos PC y publicación

Este documento es el procedimiento vigente desde `v2.0.282`. Git conserva el código y la historia; Firebase conserva estados externos, incluido `sisventas/config/version`. Traer Git no modifica por sí solo ese nodo.

## Antes de trabajar en cualquiera de las PC

```powershell
cd C:\SisVentas
git switch codex/v3-integracion-v236
git pull --ff-only origin codex/v3-integracion-v236
```

No se comienza una modificación si `git status --short` muestra cambios desconocidos. Primero se revisan y se conservan o se integran; nunca se borran a ciegas.

## Al terminar un bloque importante

1. Ejecutar las pruebas vigentes.
2. Crear un commit con el motivo del cambio.
3. Subir `codex/v3-integracion-v236`.
4. En la otra PC, ejecutar nuevamente `git pull --ff-only` antes de continuar.

Un cambio que existe solamente en una PC y no tiene commit y push no puede recuperarse desde la otra PC si la primera está apagada.

## Componentes que deben coincidir en cada versión

- marcador `VERSION` de `index.html`;
- `js/app.vX.Y.Z.js`;
- `js/core/version.vX.Y.Z.js`;
- marcador liviano `js/core/version.js`;
- caché de `sw.js`;
- nodo Firebase `sisventas/config/version`.

La prueba incremental vigente bloquea diferencias entre los cinco archivos del repositorio. El nodo Firebase se actualiza recién después de comprobar que todos esos archivos ya están disponibles en la web.

## Publicación

1. Confirmar que las pruebas pasan y el repositorio está limpio.
2. Sincronizar la rama de trabajo remota.
3. Verificar que `origin/main` sea antecesor de la rama; nunca forzar el push.
4. Publicar el frontend mediante un avance normal de `main`.
5. Si cambió `cotizador/`, desplegar Cloud Run y verificar que la nueva revisión reciba 100% del tráfico.
6. Esperar a que la web entregue la versión nueva.
7. Ejecutar:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\actualizar-nodo-version.ps1 -Version v2.0.282
```

El script se niega a actualizar Firebase si `index.html`, la aplicación inmutable, el marcador liviano o el Service Worker todavía no coinciden. Así las sesiones abiertas nunca reciben la orden de recargar hacia una publicación incompleta.

## Recuperación en una PC nueva o desactualizada

```powershell
cd C:\SisVentas
git fetch origin
git switch codex/v3-integracion-v236
git pull --ff-only origin codex/v3-integracion-v236
```

Luego se verifica `git log -1 --oneline` contra la otra PC o contra GitHub. La rama `main` representa lo publicado; `codex/v3-integracion-v236` conserva el trabajo V3 y debe apuntar, como mínimo, al mismo commit publicado.
