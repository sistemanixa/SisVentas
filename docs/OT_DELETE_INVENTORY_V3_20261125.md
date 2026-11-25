# Borrado nativo de OT con cohorte de inventario preparada

Checkpoint local, sin publicación, corte ni datos reales. No cambia ot-delete-command, modelos de borrado, Guard ni REST Store. Conserva la restricción de OT prístina del modelo existente; no habilita borrar OT con trabajo, recepciones, firma, checklist, vínculos ambiguos ni otras referencias históricas.

## Contrato cerrado V3

OT_DELETE_OPERATIONAL_PINS_JSON schema3 contiene todos los campos exactos de schema2 y únicamente estos ocho adicionales:

- inventoryGeneration, inventoryContractDigest, inventoryPinsSha256.
- historyGeneration, historyConfigSha256, minimumHistoryRevision.
- financialGeneration, minimumFinancialRevision.

No existe ni se inventa configuración financiera separada: se verifica sv_sale_financial_dependencies/v1/coverage con el validador real, generación y revisión mínima. Historial exige config schema1/ready/writerSchema1, hash exacto de config, state listo con dependencyManifest1 y coberturas coherentes de todos los dominios. Las revisiones por dominio pueden ser anteriores al state global y nunca posteriores; un borrado legítimo no inutiliza el siguiente. Las cuentas conservan su verificador operativo existente y deben concordar con las cantidades de ventas/pagos del Historial y Pages.

Marker y cohorte nativos conservan sus campos originales y firmas Ed25519. Marker schema3 usa capability ot-delete-operational-inventory-v3; pinsSha256 liga los ocho campos nuevos al cierre nativo firmado. Se sigue exigiendo la cohorte nativa completa de cinco tipos de escritor, además de la cohorte de inventario genuina. runtimeReady3 exige coordinated=true, readOnly=false, commercialPages=true, operationalSummaries=true, clientAccounts=true, clientHistory=true y saleFinancialDependencies=true. Los predicados v1/v2 y sus exigencias de ausencia de padres originales permanecen sin cambios de comportamiento.

## Puerto de servidor y wiring de Root

Nuevo módulo cotizador/ot-delete-inventory-cohort.js exporta createInventoryCohortAuthority({mappedAdmission,verifier}) e isAuthority. Exige marcas reales Explicit.isMappedAdmission y Pins.isVerifier. La autoridad retornada es congelada y marcada por WeakSet; un objeto JSON o callback Boolean no sirve. capture lee activation+installed, valida el marker con Installation.validateMarker y el verificador genuino, ejecuta admit real y relee ambas fuentes. Liga generación, contractDigest, digest de los seis campos exactos de Activation.pins y rulesDigest a los pins nativos V3. No calcula code pins por operación; reutiliza el verificador creado al arrancar sobre bytes inmutables.

Root debe construir esa autoridad dentro de inventory-cohort-runtime, donde ya tiene el verificador privado y mappedAdmission, y exponer sólo la autoridad opaca. Pasarla como inventoryCohort a ot-delete-operational-runtime.create; éste la transmite al contrato. El runtime callback debe incluir saleFinancialDependencies del guard real. Mantener saneamiento del prefijo svOTDeleteOperational existente y protección física real del Store cuando esté instalada la cohorte. No aceptar esos parámetros desde el body del cliente.

V3 conserva el proof WeakSet propio de cada verifier: clone/copia no se admite y assertCurrent vuelve a verificar markers, configuraciones y cohorte. projectedPlan reconstruye el mismo borrado prístino existente, Operational, RecordList, Pages, Accounts, Historial y Financial, en el orden coordinado correspondiente, y compara el PATCH completo excluyendo únicamente guard/recibo propios. No copia campos financieros elegidos por el cliente. La desvinculación de una venta mantiene precios, importes y originales; su índice financiero puede avanzar revisión/sourceHash legítimamente para reflejar el nuevo original. No se afirma que ese índice quede byte idéntico en un unlink.

Docker/closure: incluir ot-delete-inventory-cohort.js además de las versiones nuevas de ot-delete-operational-contract.js y ot-delete-operational-runtime.js. Sus dependencias de inventario ya son parte del núcleo curado: labor-guard, inventory-code-pins, inventory-installation-contract, stock-link-activation-contract, office-stock-explicit-reference y transitivos. No hay dependencia npm nueva ni firmador privado en estos módulos.

## Reglas: cuatro atributos exactos

ot-delete-inventory-v3-rules.prepare(candidate,{baseline,activationPins}) sólo acepta baseline5a completo y las hashes originales esperadas de cuatro atributos. Verifica que cada rama original permanezca exactamente una vez en la candidata y agrega un OR estrictamente V3, dejando el texto original v1/v2 intacto:

- sisventas/ordenes_trabajo/$record/.write.
- sisventas/listados_resumen/ordenes_trabajo/$record/.write.
- sv_labor_guard/.write.
- sv_labor_receipts/$op/.write.

Los dos últimos también tenían el cierre nativo schema1|2 y eran necesarios para guardnull+recibo. Conservan además el fence técnico original: no nuevo acquire/abort ni escritura sin operación viva. Los cuatro exigen la misma OT eliminada atómicamente, op/fence/digest/actor del guard, schema2 del escritor, proof nativo Version1 firmado, marker schema3/capability exacta, cohorte instalada coherente, rol/revisión/reset/Eliminar actuales, protección física inalterada y writers Accounts/History/Financial1. No se agrega grant de padre de negocio ni grant de venta. El modelo/contract de servidor verifica criptografía, hashes completos y ausencia de actividad; RTDB no calcula SHA ni reconstruye todos los originales.

inventory-current-rules añade esta etapa después de OT familias y antes de LedgerPreserve y Presence; Presence sigue último. Por defecto no instala opt-ins History/Financial. El emulador usa una candidata de laboratorio distinta y explícita: constructor actual5a, constructores revisados History/Financial de Root, Presence final y digest real de esa candidata en firmas. Esto no equivale a cambiar flags ni a prepararlos automáticamente en producción.

## Evidencia y límites

54 PASS/0FAIL/0SKIP en la pasada focal final. Incluye 13 casos de comando/admisión actual, cuatro de contrato/compatibilidad/reversión y las regresiones de familias/Presence/candidata conjunta. Dos casos reproducen command+Guard+REST Store reales leídos del Root actual, con History/Financial verdaderos, protección física del Store activada y autoridad genuina: generan exactamente un PATCH completo; ese PATCH y todas sus claims se ejecutan luego contra la candidata firmada en RTDB emulado con auth nativa y merge atómico. OT independiente y vinculada pasan; se conserva otra OT histórica y su fuente de Historial, cantidades físicas, comisiones e importes de venta. La admisión vuelve a estar lista tras avanzar revisiones derivadas. El caso vinculado necesita indiceModulos/venta como exige la regla de venta preexistente; quitarlo rechaza sin efectos. No se amplió para suplirlo.

Negativos reales: writer History/Financial ausente, revisión de rol, marker instalado, schema nativo o clave OT incorrectos, permisos revocados antes/después del lease, fuente vinculada tardía, custodia registrada, config/cobertura incompleta, activación retirada y proof clonado. El modelo de actividad se prueba con expectedHash actualizado para no confundirlo con un CAS viejo.

La primera prueba con JWT grande en URL dio400; Bearer fue descartado porque el emulador le atribuyó autoridad administrativa (el negativo lo detectó). Las aceptaciones Bearer NO cuentan. La prueba final usa WebSocket auth con el JWT completo y acción merge; no elimina claims ni rutas del PATCH. Los negativos demuestran evaluación bajo el usuario, no bypass administrador. El HTTP REST Store se ejecuta con transporte de memoria ficticio; su mismo PATCH/claims completos se evalúan después en el emulador. No es una petición HTTP productiva ni un deploy de runtime.

Root/D avanzaron mientras se repetían regresiones. Para conservar la referencia anterior, SV_OT_FINAL_POLICY_REVISION admite exclusivamente 3ae017c87dbe12bcabe9eff4011b0258716d7f78: lee cinco políticas mediante git show de sólo lectura, verifica sus cinco SHA y conserva instancias privadas únicas. No copia ramas ni módulos compartidos ni relaja las hashes. Las pruebas V3 usan los módulos actuales del Root; las pruebas de familias históricas siguen siendo referencia D3ae, no acreditación del siguiente materials/support de D.

Salida privada tmp/finish-rules-20261125/delete-v3-all.private.log. Emulador propio limpio/detenido y paquetes temporales propios eliminados con verificación del destino. Falta wiring de Root, revisión de helpers materials/support recién entregados por D y la puerta integral antes de publicación; no hay Ready remoto.

## Bloques exactos para preservación de fuente

test/helpers/ot-delete-v3-source-blocks.cjs contiene before/after exactos y cantidades por bloque, más SHA LF antes/después para los dos archivos existentes. Para la comparación de commission-native-production-preservation, Root puede revertir sus changes en orden inverso con replaceAll(after,before), verificar cada count y comparar SHA original. La prueba unitaria lo hace sin escribir archivos. SHA originales recuperables: contrato0f0a0dbf741e7180b36e85399e6d407380bd4e521851cb1fbf33f569e1d223dd; runtime103f938f1bb94c998277d418ec0d744fa2f7097373cd97a4b76a85ff0893b23b. Root es dueño del test de preservación y de los módulos compartidos; B no los modifica.
