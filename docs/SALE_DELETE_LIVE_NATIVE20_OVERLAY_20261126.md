# Derivación Live sobre el nativo20

Artefacto puro y separado del overlay H/Fin histórico. No modifica el checkout
coordinador, imágenes, servicios, Rules, flags ni datos reales. No publica.

Base: imagen `cotizador@sha256:00e36728c5d9a895ce5e17cc5e4cede770843831fe0203eabe6f32c2088647e0`,
150 módulos nativos20. Fuentes nuevas congeladas en
`1f654e674271506a2cde855ae7a3b096931b34f0`. Los cuatro SHA256 RAW de base y
los trece SHA256 de fuente normalizada LF están fijados dentro del builder.
Además se exige al consumidor el mapa de hashes RAW de las fuentes entregadas.
Recalcular ese mapa no permite incorporar fuentes ajenas al freeze.

## API

`scripts/lib/sale-delete-live-runtime-overlay.cjs` exporta
`derive({baselines,sources,expectedBaseHashes,expectedSourceHashes,baseImage})`.
Los mapas deben contener exactamente `NAMES` (cuatro cores) o `SOURCES`
(cuatro cores de referencia más nueve hojas), según corresponda. Acepta bytes
Buffer o texto UTF-8. Devuelve `{files,hunks,manifest}` sin hacer IO.

`files` contiene trece archivos: tres cores derivados, Store idéntico a sus
bytes de base y nueve hojas del freeze. Las referencias Git de los cores sirven
para comprobar los hooks revisados; no se copian completas. Cada sustitución
exige un único anchor y se revierte al final contra todo el archivo de base LF.
El manifiesto identifica hashes de entrada/salida y de cada hunk.

| Core | Hunks | Alcance |
| --- | ---: | --- |
| index.js | 4 | Opciones cerradas servidor, servicio/fence, POST y capacidad SaleDelete |
| labor-guard.js | 8 | Acción administrativa, Activity7, alcance CC3, getter y permisos finales |
| labor-runtime.js | 3 | Opciones, provider genuino y getter de Activity |
| labor-rtdb-store.js | 0 | Byteidéntico, incluyendo EmployeeResources y contrato OT |

Las nueve hojas son cinco `sale-delete` (command/fence/relations/activity/HTTP),
`sale-delete-live-financial-evidence` y Financial model/delta/provider.
No se incluye `sale-delete-relations-indexed`, History, protocolo financiero ni
proyecciones H/Fin. Imports directos externos a esas hojas resuelven sobre los
módulos nativos conservados: Payment snapshot/membership/matcher, OT delete
policy y commission calculations. Sus dependencias transitivas siguen nativas.

Defaults: Activity false, modo indexed, History false y Financial false. El
índice selecciona únicamente el enum servidor `SALE_DELETE_EVIDENCE_MODE`,
validado como indexed/live-originals; READY y FENCE_READY gobiernan Activity.
En live-originals el proveedor conserva su marca privada y exige ausencia de
History, su configuración y Financial. No se fabrican índices persistentes.
Store conserva H0/Fin0. `stock.ajustar`, las tres optimizaciones Accounts/Pages,
OT3 y labor2 no se reemplazan con versiones Git.

## Evidencia focal y límites

Con `SV_SALE_DELETE_NATIVE20_ROOT` apuntando al paquete nativo privado:

```powershell
node --test test/sale-delete-live-runtime-overlay.test.cjs
```

13 casos PASS, cero fallos/exclusiones: hashes y reversa, rechazo de fuentes
refirmadas y mapas extra, portabilidad LF/CRLF, defaults/modos cerrados, provider
genuino, ausencia parcial, claims nativos H0/Fin0, orden de permisos y revocación
tardía. Adapter real, BusinessAuth, gateway, Guard y RESTStore derivados
completan una eliminación ficticia con un commit y recibo, sin escribir H/Fin.

Para ventas.eliminar los mismos dos GET finales de rol/permisos ocurren después
de los finalChecks. Para stock.ajustar se mantiene el orden anterior. También
hay lecturas iniciales legítimas de contexto: no se contabilizan como una nueva
consulta final ni se eliminan. El primer ensayo del test contó esas lecturas
iniciales como finales y falló en dos expectativas; se corrigió el punto de
medición al inicio de work, sin cambiar producto.

La frontera ficticia reemplaza sólo Auth/RTDB transport y declara preparación
local de Pages/Accounts/Payment. No demuestra Rules desplegadas, writer closure,
CAS/concurrencia RTDB, ACK perdido, rutas completas del index en HTTP, regresión
OT V2 ni autorización de publicación. No se ejecutó emulador, suite global,
navegador ni operación productiva. La integración y esas pruebas corresponden
al coordinador y a sus responsables asignados.
