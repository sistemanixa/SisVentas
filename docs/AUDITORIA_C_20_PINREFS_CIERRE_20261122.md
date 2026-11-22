# Cierre C: adaptador y 20 pinrefs · 22/11/2026

Resultado final: 20/20 PASS, 0 FAIL y 0 SKIP. Además, 3/3 pruebas nuevas de preservación y rechazo adversarial. Sintaxis del script/test y git diff --check PASS. No suite general ni nuevos recorridos UI: el coordinador repetirá los focales al integrar.

## Reparación acotada

Sólo scripts/lib/client-account-runtime-overlay.cjs: acepta las parejas exactas de servicio/sanitización históricas y actuales por SHA256. Reconstruye únicamente el fragmento revisado de claims de Accounts desde el servicio actual. Mantiene los hashes de las cuatro bases predecesoras. Rechaza servicio ajeno, sanitización debilitada o sustituida, duplicados y versiones desconocidas. No modifica labor-rtdb-store.js ni sus políticas en ejecución.

El segundo fallo encontrado fue que la extracción entre readQuery y acquire incluía ahora queryPage de Stock. Se fijaron las dos formas completas por hash; la forma moderna se reduce al prefijo readQuery exacto histórico y se verifica nuevamente su hash. No se acepta una expresión regular genérica. Staging verifica la paridad LF histórica, 125 bases, 26 copias Git, 4 derivados, 146 finales y 116 archivos preservados; el resultado pasa sin cambiar esas expectativas.

Las fixtures contienen sólo líneas/bloques de código público del repositorio, sin datos de clientes ni secretos. Las pruebas nuevas verifican reversión exacta y rechazo de modificaciones de claims, código añadido, controles de consulta cambiados y sanitización debilitada. No se normalizaron ni reescribieron los inputs existentes: la derivación mantiene su contrato previo de LF interno y las bases siguen verificadas por bytes crudos.

## Fuente y método de ejecución

Fuente base fijada f927f74a505fcc1712e254cf99cb05aec5e2c5f7, más exclusivamente el adaptador candidato SHA256 47df8f627a7ee258e0dca28404298537f86d48d489b0411a6cf22f4e7f1fce52. Un preload local acotado reemplaza ese módulo y la lectura de ese único archivo al construir la fixture Git de staging; los demás archivos de f927 y todos los hashes de referencia permanecen intactos. No se atribuye este resultado al f927 sin parche. El preload no cambia assertions, manifiestos, políticas, pruebas ni módulos de negocio. Root debe repetir sobre la integración normal, sin preload.

Se ejecutaron los 20 nombres exactos de la tabla original, ahora todos PASS:

| Archivo | Nombre exacto | Resultado |
|---|---|---|
| test/cc-opening-overlay.test.cjs | exact deployed baseline retains write/auth functions while changing only the list read pool | PASS |
| test/combined-accounts-clothing-overlay.test.cjs | reviewed four-file derivation preserves every other inherited runtime file | PASS |
| test/employee-resources-combined-overlay.test.cjs | real reviewed Accounts assembly preserves readQuery, writer claims and all unrelated native bytes | PASS |
| test/ot-lifecycle-missing-primary-rules.test.cjs | exact reviewed rule baseline changes only two lifecycle grants | PASS |
| test/ot-lifecycle-missing-primary-rules.test.cjs | pinned deployed model retains every byte outside one verified-link branch | PASS |
| test/stage-combined-runtime.test.cjs | real native inventory stages 26 Git copies and four derived outputs with LF parity | PASS |
| test/stage-combined-runtime.test.cjs | baseline manifest, immutable image, payload hash and path escape fail before output | PASS |
| test/stage-combined-runtime.test.cjs | reference parity and baseline symlinks are rejected | PASS |
| test/tecnoprices-container-contract.test.cjs | retained image sources form the exact reversible combined filesystem; not a container run | PASS |
| test/tecnoprices-current-overlay.test.cjs | exact current overlay preserves all non-reader bytes including OT auth and Stock | PASS |
| test/tecnoprices-current-overlay.test.cjs | packaging includes helper in COPY and startup check without changing runtime configuration | PASS |
| test/tecnoprices-overlay-http-loopback.test.cjs | exact composed scraper and preserved Presentation handler over own HTTP loopback; provider API is fictitious | PASS |
| test/tecnoprices-presentation-overlay.test.cjs | CLI apply/verify/revert are exact and refused writes leave their input intact | PASS |
| test/tecnoprices-presentation-overlay.test.cjs | private reference is exactly deterministic Presentation overlay of the pinned old entrypoint | PASS |
| test/tecnoprices-presentation-overlay.test.cjs | apply and reversal preserve every byte outside the login scraper, including Presentation/auth/deletion behavior | PASS |
| test/tecnoprices-presentation-overlay.test.cjs | Presentation model authorization still requires genuine active admin context; no data IO | PASS |
| test/tecnoprices-presentation-overlay.test.cjs | patched exact scraper with real helper and synthetic API: authenticated | PASS |
| test/tecnoprices-presentation-overlay.test.cjs | patched exact scraper with real helper and synthetic API: HTTP401 | PASS |
| test/tecnoprices-presentation-overlay.test.cjs | patched exact scraper with real helper and synthetic API: login-with-price | PASS |
| test/tecnoprices-production-overlay.test.cjs | production package pins the serving base, changes only Tecnoprices context, and declares all three files | PASS |

## Referencia histórica de reglas recuperada

SV_OT_LINK_RULES = C:/SisVentas/tmp/stage1-integral-plan/return910199-rules.before.private.json — SHA256 d670adb183dc9ffd2b21d5f0531c16802e0f0cf028564e9902d521926ef993bb. El caso no fija un hash constante: exige las dos anclas literales antiguas y comprueba que sólo cambien los grants estadoInst/audit, conservación del input y rechazo de doble aplicación. Esta fuente histórica satisface esos controles; rules-current sigue rechazada y no se alteró. No se aplicaron reglas a Firebase.

Los siete casos antes excluidos se ejecutaron tras autorización explícita, con archivos/repositorios temporales propios y sólo servidor loopback ficticio. Las pruebas eliminan sus recursos al terminar. No hubo build de imagen, descarga de dependencia, activación ni envío a servicios externos.

## Evidencia privada local

Directorio C:/SisVentas/tmp/audit-20261122-C, fuera de Git:

- pinrefs-expanded-final.log — SHA256 20ea3fbbe4e920b260c731f740647b87b6f29c05b327ca8ed2e6494b5b2e1e91
- pinrefs-expanded-final.json — SHA256 574e346a3badbeeb13d5285bf1ecf193a3a4ba37f9996cc616d8713aace6bd15
- pinrefs-adapter-preload.cjs — SHA256 5601f7e2fb5ac032d532e586827a5ed50717d607b468b523cd0cf2575998dc28
- pinrefs-staging-final.log — SHA256 acaebfda625ad91b216f5a55a5f06b41187632a6344a6a198015be00658525b5

El JSON final conserva selección exacta, hash del candidato y hashes antes/después. Todos los inputs anteriores permanecieron iguales. Las referencias completas y la comparación 125/125 están en AUDITORIA_C_20_PINREFS_20261122.md y pinrefs-inventory.json. No publicación, datos reales, credenciales, respaldos ni sesiones copiados. Sin push por restricción de red.
