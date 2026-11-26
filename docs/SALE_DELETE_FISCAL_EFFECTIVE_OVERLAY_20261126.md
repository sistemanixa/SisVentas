# Derivador fiscal Graph sobre la fuente efectiva

Fuente privada efectiva: generación 1794595393706341, MD5
wWHIiIr5EAxFYHzCSdUHbw==. El builder fija SHA256 RAW de 73 archivos: las ocho
raíces fiscales y los vendors existentes, incluido su manifiesto de origen.
No descarga, escribe, despliega ni activa recursos.

`scripts/lib/sale-delete-fiscal-runtime-overlay.cjs` exporta
`derive({baselines,sources,expectedBaseHashes,expectedSourceHashes})` y los
catálogos BASES/SOURCES/MODULES/CHANGED. Exige mapas exactos. SOURCES contiene
las tres hojas Graph y Bridge del freeze d99769930dc4d4f47b8fbe785506aabae9d6905c;
se fijan sus hashes LF y se verifican además los hashes RAW entregados.

Devuelve files/hunks/manifest. Files tiene 76 entradas: los 73 archivos base y
tres hojas nuevas. Únicamente tres archivos existentes tienen hunks:

| Archivo | Hunks | Alcance |
| --- | ---: | --- |
| vendor/labor/labor-guard.js | 6 | Flag false/validación, namespace protegido, Graph después de Financial, claim derivado y affects16/getter |
| vendor/labor/labor-rtdb-store.js | 1 | Claim Graph reservado 0/1 después de los claims entrantes |
| labor-bridge.cjs | 1 | Parámetro saleDeleteRelations desde variable de entorno |

Cada sustitución tiene un anchor único y la reversa completa debe devolver los
bytes RAW de entrada, incluidos finales de línea. El manifiesto publica hashes
base/salida y hashes de cada hunk. Los restantes 70 archivos existentes salen
byteidénticos. No se reemplazan los cores por versiones Git.

Se conserva TODO el Store efectivo, incluidos commercialDeleteReadiness,
svLaborWriterSchema2 incondicional y la llamada OT delivery original. Guard no
recibe Activity, flags OT, puertos de preparación, nuevos protocolos ni cambios
de fase. Bridge conserva todas sus operaciones fiscales; sólo pasa el flag.
La activación real de esa variable queda a cargo del coordinador después de
sus validaciones. H/Fin OFF se conserva según la configuración del paquete.

Las hojas nuevas son sale-delete-target-index, sale-delete-target-index-delta y
sale-delete-target-projections. Su closure de imports literales se resuelve
exclusivamente entre las hojas nuevas y archivos base fijados. Financial model,
Matcher y PaymentIndex del vendor son iguales LF a Git del freeze. Financial
delta conserva SHA b2b36fcd0d1c7d66f93cb4e0f8992e4c0429ad767f19d43fff127372c0006be8:
es anterior al delta actual de Root, y NO se sustituye dentro de este alcance.
El test utiliza realmente esa versión vendorizada.

## Verificación focal

Con SV_FISCAL_EFFECTIVE_SOURCE_ROOT apuntando a la descarga privada efectiva:

    node --test test/sale-delete-fiscal-runtime-overlay.test.cjs

9 PASS, cero fallos/exclusiones; node --check de los dos archivos JS y diffcheck
verdes. Incluye reversa RAW, preservación completa fuera de tres archivos,
rechazo de bases/fuentes refirmadas/mapas extra, namespace protegido y affects16.

El test arma un paquete temporal real con los bytes derivados y carga Bridge
.runtime con vendors reales, Guard y RESTStore. Únicamente Auth/RTDB HTTP se
reemplazan por transporte y datos ficticios; no se interceptan los módulos de
negocio. La preparación Graph del fixture usa sus modelos genuinos, sin claim
booleano que simule mantenimiento.

resume de un CAE ficticio vincula venta y mantiene Graph en un mismo commit,
con claimGraph1 y H0/Fin0. Se valida el hash del original contra Graph y se
conservan otros dominios y el resultado fiscal durable. Un Graph parcial deja
persistenciaPendiente y cero commit, sin alterar la venta ni el comprobante.
Flag OFF conserva la vinculación sin mantener Graph; un claim1 entrante de
usuario se sobrescribe a cero en Store si no hay mantenimiento derivado.

Límites: no prueba Rules remotas, concurrencia RTDB, proveedor fiscal real,
cierre de todos los escritores, activación ni publicación. Los manifiestos de
origen se conservan como baseline; el coordinador debe generar la metadata del
artefacto final derivado. No se ejecutó otra suite, emulador, descarga o deploy.
No contiene datos ni credenciales reales. No se atribuyen aquí los tres tests
previos de RootGit como evidencia de estos vendors.
