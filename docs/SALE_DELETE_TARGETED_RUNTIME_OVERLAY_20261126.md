# Derivación del runtime puntual de borrado

Derivador puro `scripts/lib/sale-delete-targeted-runtime-overlay.cjs`, congelado a fuente funcional `d5087b2b01bfa1ad426001d791730bc38f8fb85e` y a la imagen nativa vigente `7f69f558cbf7a8f149dd8bd87d84f93a6a992218ee42c8ea08e711797b041624`.

`derive({baselines,sources,expectedBaseHashes,expectedSourceHashes,baseImage})` exige mapas cerrados: cuatro cores nativos y los catorce archivos fuente explícitos de `SOURCES`. Verifica hashes RAW de las bases y hashes RAW del llamador más hashes LF fijos del freeze. Devuelve `{files,hunks,manifest}`. No accede al filesystem, imagen, red, credenciales ni configuración. No publica ni activa.

## Alcance

Produce cuatro cores derivados (`index`, Guard, Store, Runtime) y diez leafs curadas. Seis leafs son nuevos módulos del índice y su preparación/lectura; los otros cuatro son Gateway, Command, Fence y adaptador HTTP revisados. Cada hunk tiene ancla única y reversión completa que recupera exactamente el Buffer RAW nativo de entrada, incluidos sus saltos de línea. No se copian cores completos de Git.

Guard añade el proyector específico, preparación con identidad privada del scope, comprobación de las 16 fuentes antes de instalar metadatos, raíz protegida, permiso de mantenimiento y claim derivado exclusivamente del resultado del mantenimiento. Conserva `stock.ajustar`, los demás escritores y las proyecciones nativas actuales. No importa los proyectores History/Financial de Git ni Dashboard. Store sólo reserva/emite el nuevo claim 0/1 y el esquema de escritor correspondiente: EmployeeResources y los protocolos OT permanecen fuera de los hunks. Runtime conserva H/Fin desactivados y añade modo `targeted` cerrado. Índice del servidor añade la bandera de mantenimiento de vínculos y el handler preparatorio antes del borrado existente; no importa rutas/comportamientos ajenos.

El Gateway curado difiere del nativo sólo en reservar `sv_sale_delete_relations`. Las dependencias existentes se retienen desde el paquete nativo, incluidas las tres variantes optimizadas de Accounts y los módulos de OT y pagos. La corrección financiera bucket de la imagen vigente se conserva: no se reemplaza con la versión anterior del stage histórico de lector.

## Verificación acotada

12 pruebas PASS, 0 FAIL/condicionales en la ejecución con paquete privado exacto. Comprueban reversión RAW de los cuatro cores, pins y mapas cerrados, código compilable, conservación de autoridad Stock/EmployeeResources/OT y rechazo de ocho mutaciones de entradas. La prueba de paquete copia los originales nativos y verifica que todos los archivos fuera del alcance permanezcan byte idénticos; añade únicamente los seis módulos nuevos.

Ese paquete derivado ejecuta Runtime/Guard/RESTStore/modelos y adaptadores genuinos con fronteras de Auth/RTDB ficticias: preparación sólo de metadatos con fuentes inalteradas, luego borrado puntual de venta+pago y anulación de presupuesto, claim1 derivado, H/Fin0 y cero GET de colecciones originales durante el borrado. No es prueba de Rules remotas, IAM, cierre de escritores, ACK/CAS, firma de OT ni despliegue. El proveedor financiero conserva el veto global existente de fuentes sin resolver; no se declara borrable una venta con dependencia ambigua.

Variables de prueba: `SV_SALE_DELETE_CURRENT_NATIVE_ROOT` apunta a los archivos RAW del stage de lector previo cuyos cuatro cores coinciden con la imagen vigente; `SV_SALE_DELETE_CURRENT_DELTA_PATH` apunta al leaf bucket real, con SHA256 fijo `5c42b9f5d44206c5e83fe86bf04dbf753ac9da15e1b8246743588af2a7bb4a20`. `SV_SALE_DELETE_TARGETED_OVERLAY_SOURCE_ROOT` permite señalar el checkout congelado. Si falta el paquete privado, las pruebas se declaran condicionales y no acreditan esta evidencia.
