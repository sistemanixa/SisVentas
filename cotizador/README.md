# Cotizador NIXA

Servicio Cloud Run separado para cotizar proveedores por su URL exacta.

## Qué hace

- Recibe `proveedorKey` y URL exacta del producto.
- Lee `sisventas/proveedores/{proveedorKey}` desde Firebase.
- Usa `usuario` y `password` cuando el proveedor requiere acceso.
- Inicia sesión en Biosegur, Free Electron o Tecnoprices.
- Para Mercado Libre usa OAuth y la API oficial; renueva el acceso automáticamente.
- Abre la URL exacta del producto.
- Extrae el precio visible en ARS y la disponibilidad.
- Bloquea variaciones anormales para conservar el precio anterior.

## Variables de entorno

- `FRONTEND_KEY`: misma clave que usa el frontend para autorizar llamadas.
- `FIREBASE_DATABASE_URL`: `https://nixa-sisventas-default-rtdb.firebaseio.com`
- `ALLOW_ORIGIN`: `https://ventas.sistemanixa.com`
- `REQUIRE_FIREBASE_AUTH`: `true` en producción; exige un ID token Firebase válido además de `FRONTEND_KEY`
- `ML_CLIENT_ID`: Client ID de la aplicación de Mercado Libre.
- `ML_CLIENT_SECRET`: secreto de la aplicación (configurarlo en Cloud, nunca en Git).
- `ML_REDIRECT_URI`: callback registrado en Mercado Libre.
- `ML_TOKEN_KEY`: clave privada aleatoria para cifrar los tokens antes de guardarlos.

Cloud Run debe ejecutar con una cuenta de servicio que pueda leer Realtime Database.
La conexión inicial se completa una sola vez abriendo `GET /mercadolibre/oauth/start`.

## Endpoint

### Alta de producto desde URL exacta

El mismo `POST /cotizar` acepta `incluirFicha: true` y `altaProducto: true`.
El alta puede enviar `producto: ""`: el nombre se obtiene de la página exacta
y la respuesta queda para revisión en el formulario, sin persistir productos.
La cotización habitual conserva la comparación del nombre y la protección de
variaciones de precio.

Además del precio, la respuesta incluye `ficha` con `nombre`, `marca`, `detalle`,
`imagenUrl`, `urlOrigen`, `fuente` y `faltantes`. No se infieren marcas ni se
buscan productos alternativos. En los proveedores con navegador se extraen los
campos en la misma sesión autenticada y página donde se leyó el precio. Mercado
Libre aprovecha los datos de API/SEO ya obtenidos y puede informar campos
faltantes si esa fuente no los expone.

La URL debe corresponder al proveedor registrado; no puede seleccionar otra
cuenta por su dominio. La navegación de importación se limita al comercio
seleccionado. La interfaz manda el identificador del proveedor y la sesión de
SisVentas; no manda la contraseña del comercio.

Validación real inicial: Biosegur, ficha P2822 (Trinktech F-102T), con nombre,
marca, descripción, imagen y precio autenticado obtenidos en una consulta.
Las fichas de los otros conectores requieren muestras reales adicionales.
Los proveedores no soportados continúan requiriendo su conexión específica.

El despliegue necesita tanto `index.js` como `ficha-producto.js`; el Dockerfile
copia ambos. Desplegar el servicio antes de publicar el formulario nuevo.

`POST /cotizar`

Headers:

```http
Content-Type: application/json
X-Frontend-Key: ...
```

Body:

```json
{
  "proveedorKey": "-firebase-key",
  "url": "https://articulo.mercadolibre.com.ar/...",
  "codigo": "P401",
  "producto": "Producto publicado..."
}
```

Respuesta esperada:

```json
{
  "ok": true,
  "proveedor": "BIOSEGUR",
  "precioArs": 4933.5,
  "sinIva": true,
  "precioConIva": 5969.54,
  "fuente": "biosegur_login_url_exacta"
}
```

## Despliegue sugerido

Desde esta carpeta:

```bash
gcloud run deploy cotizador \
  --source . \
  --region southamerica-east1 \
  --memory 2Gi \
  --concurrency 1 \
  --allow-unauthenticated \
  --set-env-vars FRONTEND_KEY=...,FIREBASE_DATABASE_URL=https://nixa-sisventas-default-rtdb.firebaseio.com,ALLOW_ORIGIN=https://ventas.sistemanixa.com,REQUIRE_FIREBASE_AUTH=true
```

El cotizador abre Chromium para los proveedores que requieren una sesión. Por eso
cada instancia procesa una sola solicitud a la vez y dispone de 2 GiB: dos
navegadores simultáneos pueden superar el límite de memoria y provocar respuestas
503 aunque la conexión del usuario funcione correctamente.

