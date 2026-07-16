# Cotizador NIXA

Servicio Cloud Run separado para cotizar proveedores con login real.

## Qué hace

- Recibe `proveedorKey` y URL exacta del producto.
- Lee `sisventas/proveedores/{proveedorKey}` desde Firebase.
- Usa `usuario` y `password` guardados en el proveedor.
- Inicia sesión en Biosegur.
- Abre la URL exacta del producto.
- Extrae el precio visible en ARS.

## Variables de entorno

- `FRONTEND_KEY`: misma clave que usa el frontend para autorizar llamadas.
- `FIREBASE_DATABASE_URL`: `https://nixa-sisventas-default-rtdb.firebaseio.com`
- `ALLOW_ORIGIN`: `https://ventas.sistemanixa.com`

Cloud Run debe ejecutar con una cuenta de servicio que pueda leer Realtime Database.

## Endpoint

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
  "url": "https://www.biosegur.com.ar/...",
  "codigo": "P401",
  "producto": "Balun HD Hikvision..."
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
  --allow-unauthenticated \
  --set-env-vars FRONTEND_KEY=...,FIREBASE_DATABASE_URL=https://nixa-sisventas-default-rtdb.firebaseio.com,ALLOW_ORIGIN=https://ventas.sistemanixa.com
```

